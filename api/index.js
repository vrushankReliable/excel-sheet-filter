/**
 * API Health Check Endpoint
 * GET /api/ - Returns API status
 */

const app = require("../server");

module.exports = app;

module.exports = (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    return res.status(200).json({
        status: 'ok',
        service: 'Excel Lead Processor API',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        endpoints: {
            upload: 'POST /api/upload',
            health: 'GET /api'
        }
    });
};
