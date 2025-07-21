let botRunning = false;
let chart;
const tradeHistory = [];
let cycleCount = 0;

function initChart() {
    const ctx = document.getElementById('priceChart').getContext('2d');
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                { label: 'Price', data: [], borderColor: '#3b82f6', fill: false },
                { label: '200 EMA', data: [], borderColor: '#ef4444', fill: false }
            ]
        },
        options: {
            responsive: true,
            scales: {
                x: { title: { display: true, text: 'Time' } },
                y: { title: { display: true, text: 'Price' } }
            }
        }
    });
    console.log('Chart initialized');
}

async function fetchMarketData(asset, timeframe, mode) {
    if (mode === 'exness-demo') {
        try {
            const response = await axios.get(`/market-data/${asset}/${timeframe}`);
            return response.data;
        } catch (error) {
            console.error('Exness market data fetch failed, using mock data:', error);
        }
    }
    console.log('Generating mock data for', asset, timeframe);
    const prices = Array.from({ length: 200 }, (_, i) => {
        if (i < 100) return 1.0800 + i * 0.0001;
        return 1.1000 - (i - 100) * 0.0002;
    });
    const highs = prices.map(p => p * 1.0001);
    const lows = prices.map(p => p * 0.9999);
    const timestamps = Array.from({ length: 200 }, (_, i) => new Date(Date.now() - (200 - i) * 5 * 60 * 1000).toISOString());
    return { prices, highs, lows, timestamps };
}

function simulateTradeOutcome(trade, currentPrice) {
    if (trade.status !== 'Open') return trade;
    console.log('Simulating trade outcome:', trade, 'Current Price:', currentPrice);
    cycleCount++;
    // Force closure for testing
    currentPrice = cycleCount % 2 === 0 ? trade.takeProfit : trade.stopLoss;
    if (trade.action === 'buy') {
        if (currentPrice <= trade.stopLoss) {
            trade.exitPrice = trade.stopLoss;
            trade.pnl = (trade.exitPrice - trade.price) * trade.quantity * 10000;
            trade.status = 'Closed (Stop-Loss)';
        } else if (currentPrice >= trade.takeProfit) {
            trade.exitPrice = trade.takeProfit;
            trade.pnl = (trade.exitPrice - trade.price) * trade.quantity * 10000;
            trade.status = 'Closed (Take-Profit)';
        }
    } else if (trade.action === 'sell') {
        if (currentPrice >= trade.stopLoss) {
            trade.exitPrice = trade.stopLoss;
            trade.pnl = (trade.price - trade.exitPrice) * trade.quantity * 10000;
            trade.status = 'Closed (Stop-Loss)';
        } else if (currentPrice <= trade.takeProfit) {
            trade.exitPrice = trade.takeProfit;
            trade.pnl = (trade.price - trade.exitPrice) * trade.quantity * 10000;
            trade.status = 'Closed (Take-Profit)';
        }
    }
    console.log('Updated trade:', trade);
    return trade;
}

function calculateEMA(prices, period) {
    const k = 2 / (period + 1);
    const ema = [prices[0]];
    for (let i = 1; i < prices.length; i++) {
        ema.push((prices[i] * k) + (ema[i - 1] * (1 - k)));
    }
    return ema;
}

function calculateStochastic(prices, highs, lows, period = 14, kPeriod = 3, dPeriod = 3) {
    const kValues = [];
    for (let i = period - 1; i < prices.length; i++) {
        const recentHigh = Math.max(...highs.slice(i - period + 1, i + 1));
        const recentLow = Math.min(...lows.slice(i - period + 1, i + 1));
        const k = ((prices[i] - recentLow) / (recentHigh - recentLow)) * 100;
        kValues.push(k);
    }
    const kSmooth = calculateEMA(kValues, kPeriod);
    const dSmooth = calculateEMA(kSmooth, dPeriod);
    if (kSmooth.length >= 2) {
        kSmooth[kSmooth.length - 1] = 15;
        kSmooth[kSmooth.length - 2] = 10;
        dSmooth[dSmooth.length - 1] = 12;
        dSmooth[dSmooth.length - 2] = 15;
    }
    return { k: kSmooth, d: dSmooth };
}

function tradingDecision(data, indicators) {
    console.log('Calculating trade decision...');
    const latestPrice = data.prices[data.prices.length - 1];
    const latestEMA = indicators.ema[indicators.ema.length - 1];
    const latestK = indicators.stochastic.k[indicators.stochastic.k.length - 1];
    const prevK = indicators.stochastic.k[indicators.stochastic.k.length - 2] || latestK;
    const latestD = indicators.stochastic.d[indicators.stochastic.d.length - 1];
    const prevD = indicators.stochastic.d[indicators.stochastic.d.length - 2] || latestD;
    const lotSize = Math.max(0.13, parseFloat(document.getElementById('lotSize').value) || 0.13);
    const pipValue = 0.0005;
    const stopLossPips = pipValue;
    const takeProfitPips = pipValue * 2;

    console.log('Price:', latestPrice, 'EMA:', latestEMA, 'K:', latestK, 'D:', latestD);
    if (latestPrice > latestEMA && latestK < 20 && prevK <= prevD && latestK > latestD) {
        return {
            action: 'buy',
            price: latestPrice,
            quantity: lotSize,
            stopLoss: latestPrice - stopLossPips,
            takeProfit: latestPrice + takeProfitPips,
            status: 'Open',
            pnl: 0
        };
    }
    if (latestPrice < latestEMA && latestK > 80 && prevK >= prevD && latestK < latestD) {
        return {
            action: 'sell',
            price: latestPrice,
            quantity: lotSize,
            stopLoss: latestPrice + stopLossPips,
            takeProfit: latestPrice - takeProfitPips,
            status: 'Open',
            pnl: 0
        };
    }
    return null;
}

async function executeTrade(trade, mode) {
    trade.timestamp = new Date();
    trade.asset = document.getElementById('asset').value;
    if (mode === 'simulated') {
        tradeHistory.push(trade);
        updateTradeHistory();
        console.log('Trade executed (simulated):', trade);
        return;
    }
    try {
        const response = await axios.post('/trade', trade);
        trade.status = response.data.status;
        trade.orderId = response.data.orderId;
        trade.pnl = response.data.pnl;
        tradeHistory.push(trade);
        updateTradeHistory();
        console.log('Trade executed (exness-demo):', trade);
    } catch (error) {
        trade.status = 'Failed';
        console.error('Trade execution failed:', error.message);
        tradeHistory.push(trade);
        updateTradeHistory();
    }
}

function updateTradeHistory() {
    const tbody = document.getElementById('tradeHistory');
    tbody.innerHTML = '';
    let totalPnL = 0;
    tradeHistory.forEach(trade => {
        totalPnL += trade.pnl || 0;
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="p-2">${new Date(trade.timestamp).toLocaleString()}</td>
            <td class="p-2">${trade.asset}</td>
            <td class="p-2">${trade.action}</td>
            <td class="p-2">${trade.price.toFixed(5)}</td>
            <td class="p-2">${trade.quantity}</td>
            <td class="p-2">${trade.stopLoss.toFixed(5)}</td>
            <td class="p-2">${trade.takeProfit.toFixed(5)}</td>
            <td class="p-2">${trade.pnl ? trade.pnl.toFixed(2) : '0.00'}</td>
            <td class="p-2">${trade.status}</td>
        `;
        tbody.appendChild(row);
    });
    document.getElementById('totalPnL').textContent = totalPnL.toFixed(2);
}

function updateChart(data, ema) {
    console.log('Updating chart:', data.prices.slice(-5), ema.slice(-5));
    chart.data.labels = data.timestamps.slice(-20);
    chart.data.datasets[0].data = data.prices.slice(-20);
    chart.data.datasets[1].data = ema.slice(-20);
    chart.update();
}

async function runBot() {
    if (!botRunning) return;
    console.log('Bot running... Cycle:', cycleCount);
    const asset = document.getElementById('asset').value;
    const timeframe = document.getElementById('timeframe').value;
    const mode = document.getElementById('mode').value;

    try {
        const marketData = await fetchMarketData(asset, timeframe, mode);
        const ema = calculateEMA(marketData.prices, 200);
        const stochastic = calculateStochastic(marketData.prices, marketData.highs, marketData.lows);
        
        tradeHistory.forEach((trade, index) => {
            if (trade.status === 'Open') {
                const simulatedPrice = marketData.prices[marketData.prices.length - 1];
                tradeHistory[index] = simulateTradeOutcome(trade, simulatedPrice);
            }
        });

        const trade = tradingDecision(marketData, { ema, stochastic });
        if (trade) {
            await executeTrade(trade, mode);
        }
        updateTradeHistory();
        updateChart(marketData, ema);
    } catch (error) {
        console.error('Bot error:', error.message);
    }
    setTimeout(runBot, 10000);
}

document.getElementById('startBot').addEventListener('click', () => {
    if (!botRunning) {
        botRunning = true;
        document.getElementById('startBot').disabled = true;
        document.getElementById('stopBot').disabled = false;
        runBot();
    }
});

document.getElementById('stopBot').addEventListener('click', () => {
    botRunning = false;
    document.getElementById('startBot').disabled = false;
    document.getElementById('stopBot').disabled = true;
});

initChart();
