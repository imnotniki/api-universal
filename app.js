import dotenv from 'dotenv';
dotenv.config();
import express from 'ultimate-express';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';

import tokenManager from './utils/tokenManager.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(cookieParser());


const authenticateAPI = (apiName) => {
    return (req, res, next) => {
        // Skip authentication for health checks and registerAuth endpoints
        if (req.path.includes('/healthy') || req.path.includes('/registerAuth')) {
            return next();
        }

        // Check for auth in cookie first, then header, then legacy env token
        const authCookie = req.cookies['osrstoolsauth'];
        const authHeader = req.headers['osrstoolsauthenticate'];
        const legacyToken = process.env.API_AUTH_TOKEN;

        let isValid = false;

        // Check cookie token
        if (authCookie && tokenManager.isValidToken(apiName, authCookie)) {
            isValid = true;
        }
        // Check header token
        else if (authHeader && tokenManager.isValidToken(apiName, authHeader)) {
            isValid = true;
        }
        // Fallback to legacy env token
        else if ((authHeader === legacyToken || authCookie === legacyToken) && legacyToken) {
            isValid = true;
        }

        if (!isValid) {
            return res.status(401).json({
                error: 'You are not allowed here.',
                hint: `Visit /${apiName}/registerAuth?{token} to authenticate`
            });
        }
        
        next();
    };
};

// Dynamic registerAuth endpoints for each API
const availableApis = tokenManager.getAvailableApis();
for (const apiName of availableApis) {
    app.get(`/${apiName}/registerAuth`, (req, res) => {
        const token = req.query.token || Object.keys(req.query)[0]; // Support both ?token=xyz and ?xyz
        
        if (!token) {
            return res.status(400).json({
                error: 'Token required',
                usage: `/${apiName}/registerAuth?{your_token}`,
                available_apis: availableApis
            });
        }

        // Validate token
        if (!tokenManager.isValidToken(apiName, token)) {
            return res.status(401).json({
                error: 'Invalid token for this API',
                api: apiName
            });
        }

        // Set authentication cookie
        res.cookie('osrstoolsauth', token, {
            maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
            httpOnly: false, // Allow JavaScript access
            secure: process.env.NODE_ENV === 'production', // HTTPS only in production
            sameSite: 'lax'
        });

        const visitorId = req.cookies['randr'] || 'unknown';
        console.log(`Visitor ${visitorId} authenticated for ${apiName} API with token: ${token.substring(0, 8)}...`);

        res.json({
            message: `Successfully authenticated for ${apiName} API`,
            api: apiName,
            token_preview: token.substring(0, 8) + '...',
            expires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            visitor_id: visitorId
        });
    });

    app.use(`/${apiName}`, authenticateAPI(apiName));
}

// Legacy tribot support (in case it's not in tokens file)
if (!availableApis.includes('tribot')) {
    app.get('/tribot/registerAuth', (req, res) => {
        res.status(404).json({
            error: 'Tribot API not configured in tokens file',
            hint: 'Run setup-tokens.js to generate authentication tokens'
        });
    });
    app.use('/tribot', authenticateAPI('tribot'));
}

// Add a login endpoint to set the cookie
app.post('/auth/login', (req, res) => {
    const { token } = req.body;
    
    if (token === process.env.API_AUTH_TOKEN) {
        // Set cookie that expires in 24 hours
        res.cookie('osrstoolsauth', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', // HTTPS only in production
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });
        
        res.json({ 
            message: 'Authentication successful',
            expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        });
    } else {
        res.status(401).json({ error: 'Invalid token' });
    }
});

// Add logout endpoint
app.post('/auth/logout', (req, res) => {
    res.clearCookie('osrstoolsauth');
    res.json({ message: 'Logged out successfully' });
});

// CORS middleware
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, osrstoolsauthenticate");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    next();
});

app.use((req, res, next) => {
    // Check if visitor already has a randr cookie
    if (!req.headers.cookie || !req.headers.cookie.includes('randr=')) {
        // Generate random 12-character ID (alphanumeric)
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let randomId = '';
        for (let i = 0; i < 12; i++) {
            randomId += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        
        // Set cookie that expires in 1 year
        res.cookie('randr', randomId, {
            maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year in milliseconds
            httpOnly: false, // Allow JavaScript access if needed
            secure: process.env.NODE_ENV === 'production', // HTTPS only in production
            sameSite: 'lax'
        });
        
        console.log(`New visitor assigned ID: ${randomId}`);
    }
    next();
});

// Apply authentication to all API routes
app.use('/tribot', authenticateAPI);
// Add more API routes here as needed
// app.use('/other-api', authenticateAPI);

// Main health check endpoint
app.get('/healthy', async (req, res) => {
    try {
        // Define a reusable template function
        const healthTemplate = ({ servername, status = "error", server = true, database = false, error = null }) => ({
            servername,
            status,
            server,
            database,
            timestamp: new Date().toISOString(),
            error
        });

        // Helper function to fetch health from a service
        const checkService = async (servername, path) => {
            try {
                const response = await fetch(`http://localhost:${port}/${path}/healthy`);
                const data = await response.json();
                return healthTemplate({
                    servername,
                    status: data.status === "ok" ? "ok" : "error",
                    server: true,
                    database: data.database ?? false,
                    error: data.error ?? null
                });
            } catch (err) {
                return healthTemplate({
                    servername,
                    status: "error",
                    server: true,
                    database: false,
                    error: err.message
                });
            }
        };

        // Run checks in parallel for all your API services
        const [tribotHealth] = await Promise.all([
            checkService("tribot", "tribot")
            // Add more services here as you create them
            // checkService("other-service", "other-service")
        ]);

        // Wrap all results in one object
        return res.status(200).json({
            status: tribotHealth.status === "ok" ? "ok" : "error",
            server: true,
            timestamp: new Date().toISOString(),
            services: [tribotHealth]
        });
    } catch (error) {
        console.error("Health check failed:", error.message);
        return res.status(500).json({
            status: "error",
            server: true,
            timestamp: new Date().toISOString(),
            services: [],
            error: error.message
        });
    }
});

// Import and use routers
import oceanshareRoutes from './routers/oceanhero.js';
app.use('/oceanshare', oceanshareRoutes);

// Import and use routers
import tribotRoutes from './routers/tribot.js';
app.use('/tribot', tribotRoutes);

// Add more routers as needed
// import otherApiRoutes from './routers/other-api.js';
// app.use('/other-api', otherApiRoutes);

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'OSRS Tools API Server',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        endpoints: [
            '/healthy - Health check',
            '/tribot/* - Tribot API endpoints'
        ]
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Endpoint not found',
        timestamp: new Date().toISOString()
    });
});

// Error handler
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({
        error: 'Internal server error',
        timestamp: new Date().toISOString()
    });
});

// Start server
(async () => {
    app.listen(port, '0.0.0.0', () => {
        console.log(`🚀 OSRS Tools API Server running on port: ${port}`);
        console.log(`📡 Available at: http://localhost:${port} -> https://api.osrstools.site`);
        console.log(`🏥 Health check: https://api.osrstools.site/healthy`);
    });
})();