import express from 'ultimate-express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const oceanshare = express.Router();
const base_route = ''; 

oceanshare.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, osrstoolsauthenticate");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    next();
});

// Health check endpoint
oceanshare.get('/healthy', async (req, res) => {
    try {
        return res.status(200).json({
            status: "ok",
            database: false, 
            timestamp: new Date().toISOString(),
            service: "OceanShare"
        });
    } catch (error) {
        console.error("OceanShare health check failed:", error.message);
        return res.status(500).json({
            status: "error",
            database: false,
            error: error.message,
            timestamp: new Date().toISOString(),
            service: "OceanShare"
        });
    }
});


// Get all active bots
oceanshare.get('/getBottles', async (req, res) => {
   
        res.json({
            bottles: 20
        });
});

// Root endpoint for tribot API
oceanshare.get('/', (req, res) => {
    res.json({
        message: 'OceanShare API',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        endpoints: [
            'GET /healthy - Health check',
            'GET /getBottles - Get and remove next task(s)'
        ]
    });
});

export default oceanshare;