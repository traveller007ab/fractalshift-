#property strict
#include <Trade\Trade.mqh>
CTrade trade;

void OnInit() {
    Print("Scalping Bot initialized on MT5");
}

void OnTick() {
    static datetime lastBar;
    datetime currentBar = TimeCurrent();
    if (lastBar != currentBar) {
        lastBar = currentBar;
        string symbol = "EURUSD";
        double prices[];
        double highs[];
        double lows[];
        CopyClose(symbol, PERIOD_M5, 0, 200, prices);
        CopyHigh(symbol, PERIOD_M5, 0, 200, highs);
        CopyLow(symbol, PERIOD_M5, 0, 200, lows);
        
        // Calculate indicators
        double ema[];
        ArraySetAsSeries(prices, true);
        ArraySetAsSeries(ema, true);
        int emaHandle = iMA(symbol, PERIOD_M5, 200, 0, MODE_EMA, PRICE_CLOSE);
        CopyBuffer(emaHandle, 0, 0, 200, ema);
        
        double k[], d[];
        ArraySetAsSeries(k, true);
        ArraySetAsSeries(d, true);
        int stochHandle = iStochastic(symbol, PERIOD_M5, 14, 3, 3, MODE_SMA, STO_LOWHIGH);
        CopyBuffer(stochHandle, 0, 0, 3, k);
        CopyBuffer(stochHandle, 1, 0, 3, d);
        
        double latestPrice = prices[0];
        double latestEMA = ema[0];
        double latestK = k[0];
        double prevK = k[1];
        double latestD = d[0];
        double prevD = d[1];
        double lotSize = 0.13;
        double pipValue = 0.0005;
        double sl = pipValue;
        double tp = pipValue * 2;

        if (latestPrice > latestEMA && latestK < 20 && prevK <= prevD && latestK > latestD) {
            double price = SymbolInfoDouble(symbol, SYMBOL_ASK);
            trade.Buy(lotSize, symbol, price, price - sl, price + tp, "Scalping Bot Buy");
        } else if (latestPrice < latestEMA && latestK > 80 && prevK >= prevD && latestK < latestD) {
            double price = SymbolInfoDouble(symbol, SYMBOL_BID);
            trade.Sell(lotSize, symbol, price, price + sl, price - tp, "Scalping Bot Sell");
        }
    }
}
