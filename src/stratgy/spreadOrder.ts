import { MainClient } from "../client/main.client";
import { calculateOptimalSpread, adjustMidPrice, adjustPositionSize, adjustOrderSpacing, calculateOrderQuantity, setBidAskPrices } from "./functions";
import { StrategyConfig } from "./strategyConfig";
import { fixPrecision } from "../utils/fixPrecision";

// 매수 및 매도 주문을 배치하는 함수
export async function spreadOrder(client: MainClient, config: StrategyConfig) {
    const { symbol, orderQuantity, stdDevPeriod, orderLevels, orderSpacing, takeProfitRatio, stopLossRatio, gamma, k, maxPosition } = config;

    console.log('Retrieving market trades...');
    const tickerData = await client.getMarketTrades(symbol);

    console.log('Retrieving open position...');
    const openPosition = (await client.getOnePosition(config.symbol)).data.position_qty;
    console.log('Open position:', openPosition);

    const lastPrice = tickerData.data.rows[0].executed_price;
    console.log('Last executed price:', lastPrice);

    console.log('Calculating standard deviation...');
    const stdDev = await client.getStandardDeviation(symbol, stdDevPeriod);
    console.log('Standard deviation:', stdDev);

    //방법 #1
    const T = 1;
    const t = 0;

    console.log('Calculating optimal spread...');
    const optimalSpread = await calculateOptimalSpread(stdDev, T, t, gamma, k);
    console.log('Optimal spread:', optimalSpread);

    console.log('Adjusting mid price...');
    const neutralPrice = await adjustMidPrice(lastPrice, openPosition, stdDev, T, t, gamma);
    console.log('Neutral price:', neutralPrice);

    console.log('Canceling all existing orders...');
    await client.cancelAllOrders(symbol);

    // 주문 간격 조정 (TODO: 토큰별 Thershold값 정해야함)
    const dynamicOrderSpacing = await adjustOrderSpacing(orderSpacing, stdDev, 0.002);
    // 주문 수량 조정 (TODO: 토큰별 Thershold값 정해야함)
    const quantity = await adjustPositionSize(orderQuantity, stdDev, 0.002);

    console.log('Placing orders...');
    let netPosition = openPosition;
    let buyOrderSpacing = dynamicOrderSpacing;
    let sellOrderSpacing = dynamicOrderSpacing;

    if (netPosition < 0) { // If net short, increase sell order spacing
        sellOrderSpacing *= 1.5;
    } else if (netPosition > 0) { // If net long, increase buy order spacing
        buyOrderSpacing *= 1.5;
    }
   
    for (let level = 1; level <= orderLevels; level++) {
        // Calculate price offsets for buy and sell orders separately
        const buyPriceOffset = (optimalSpread / 2) * level * buyOrderSpacing;
        const sellPriceOffset = (optimalSpread / 2) * level * sellOrderSpacing;
        
        // Calculate bid and ask prices with respective offsets
        let bidPrice = fixPrecision(neutralPrice - buyPriceOffset, config.precision);
        let askPrice = fixPrecision(neutralPrice + sellPriceOffset, config.precision);

        const takeProfitPrice = lastPrice * (1 + takeProfitRatio);
        const stopLossPrice = lastPrice * (1 - stopLossRatio);
        
        //const quantity = await calculateOrderQuantity(quantity, level);
        console.log(`Level ${level} - Bid Price: ${bidPrice}, Ask Price: ${askPrice}, Order Quantity: ${quantity}`);

        if (netPosition <= 0) { // Only place buy orders if net position is non-positive
            if (stopLossPrice < bidPrice && bidPrice < takeProfitPrice) {
                if (bidPrice * quantity > 10) {
                    console.log(`Placing BUY order - Price: ${bidPrice}, Quantity: ${quantity}`);
                    await client.placeOrder(symbol, 'LIMIT', 'BUY', bidPrice, quantity);
                    netPosition += quantity; // Adjust net position
                }
            }
        }
    
        if (netPosition >= 0) { // Only place sell orders if net position is non-negative
            if (stopLossPrice < askPrice && askPrice < takeProfitPrice) {
                if (askPrice * quantity > 10) {
                    console.log(`Placing SELL order - Price: ${askPrice}, Quantity: ${quantity}`);
                    await client.placeOrder(symbol, 'LIMIT', 'SELL', askPrice, quantity);
                    netPosition -= quantity; // Adjust net position
                }
            }
        }
    }
}