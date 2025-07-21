const express = require('express');
const path = require('path');
const axios = require('axios');
const app = express();
app.use(express.json());
app.use(express.static('public'));

// Serve index.html at root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Mock Exness API (replace with MT5 integration)
const EXNESS_API_URL = 'https://api.exness.mock'; // Placeholder
const EXNESS_LOGIN = process.env.EXNESS_LOGIN;
const EXNESS_PASSWORD = process.env.EXNESS_PASSWORD;
const EXNESS_SERVER = process.env.EXNESS_SERVER;

app.post('/trade', async (req, res) => {
    const { asset, action, quantity, price, stopLoss, takeProfit } = req.body;
    try {
        // Mock trade execution
        console.log('Mock Exness trade:', { asset, action, quantity, price, stopLoss, takeProfit });
        res.json({
            status: 'Trade executed',
            orderId: `mock-${Date.now()}`,
            pnl: 0
        });
    } catch (error) {
        console.error('Trade error:', error.message);
        res.status(500).json({ status: 'Failed', error: error.message });
    }
});

app.get('/market-data/:asset/:timeframe', async (req, res) => {
    const { asset, timeframe } = req.params;
    try {
        // Mock market data
        const prices = Array.from({ length: 200 }, (_, i) => {
            if (i < 100) return 1.0800 + i * 0.0001;
            return 1.1000 - (i - 100) * 0.0002;
        });
        const highs = prices.map(p => p * 1.0001);
        const lows = prices.map(p => p * 0.9999);
        const timestamps = Array.from({ length: 200 }, (_, i) => new Date(Date.now() - (200 - i) * 5 * 60 * 1000).toISOString());
        res.json({ prices, highs, lows, timestamps });
    } catch (error) {
        console.error('Market data error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.listen(3000, () => console.log('Server running on port 3000'));
