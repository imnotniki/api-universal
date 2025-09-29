import express from 'ultimate-express';
import path from 'path';
import { fileURLToPath } from 'url';
import OceanshareDatabase from '../databases/OceanshareDatabase.js';
import dotenv from 'dotenv';

dotenv.config();


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const oceanshare = express.Router();
const base_route = ''; 

const db = await OceanshareDatabase.create('OCEAN');

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

// Get all user stats
oceanshare.get('/users', async (req, res) => {
    try {
        if (!db) {
            return res.status(503).json({
                error: "Database not initialized",
                message: "Database connection is not available"
            });
        }

        const [users] = await db.connection.execute(
            `SELECT id, name, shells_counter, search_counter, country, teamid, oceanid
             FROM users
             ORDER BY shells_counter DESC`
        );

        return res.status(200).json({
            success: true,
            count: users.length,
            users: users,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("Failed to fetch users:", error.message);
        return res.status(500).json({
            error: "Failed to fetch users",
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
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