const express = require('express');
const path = require('path');
const axios = require('axios');
const WebSocket = require('ws');
const app = express();
app.use(express.json());
app.use(express.static('public'));

// Serve index.html at root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// WebSocket server for MT5 communication
const wss = new WebSocket.Server({ port: 8080 });
wss.on('connection', ws => {
    console.log('MT5 client connected');
    ws.on('message', message => {
        const data = JSON.parse(message);
        if (data.type === 'trade') {
            console.log('Received MT5 trade:', data);
            ws.send(JSON.stringify({
                status: 'Trade executed',
                orderId: `mt5-${Date.now()}`,
                pnl: data.pnl || 0
            }));
        } else if (data.type === 'market-data') {
            ws.send(JSON.stringify({
                prices: Array.from({ length: 200 }, (_, i) => 1.0800 + i * 0.0001),
                highs: Array.from({ length: 200 }, (_, i) => (1.0800 + i * 0.0001) * 1.0001),
                lows: Array.from({ length: 200 }, (_, i) => (1.0800 + i * 0.0001) * 0.9999),
                timestamps: Array.from({ length: 200 }, (_, i) => new Date(Date.now() - (200 - i) * 5 * 60 * 1000).toISOString())
            }));
        }
    });
});

// Mock Exness API endpoints
app.post('/trade', async (req, res) => {
    const { asset, action, quantity, price, stopLoss, takeProfit } = req.body;
    try {
        // Simulate MT5 trade via WebSocket
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                    type: 'trade',
                    asset,
                    action,
                    quantity,
                    price,
                    stopLoss,
                    takeProfit
                }));
            }
        });
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
        // Simulate MT5 market data
        const prices = Array.from({ length: 200 }, (_, i) => {
            if (i < 100) return 1.0800 + i * 0.0001;
            return 1.1000 - (i - 100) * 0.0002;
        });
        res.json({
            prices,
            highs: prices.map(p => p * 1.0001),
            lows: prices.map(p => p * 0.9999),
            timestamps: Array.from({ length: 200 }, (_, i) => new Date(Date.now() - (200 - i) * 5 * 60 * 1000).toISOString())
        });
    } catch (error) {
        console.error('Market data error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.listen(3000, () => console.log('Server running on port 3000'));
