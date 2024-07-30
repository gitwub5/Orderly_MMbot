import { MainClient } from "../client/main.client";
import { calculateOptimalSpread, adjustMidPrice, adjustPositionSize, adjustOrderSpacing, calculateOrderQuantity, setBidAskPrices } from "./stratgy";
import { StrategyConfig } from "./stratgyConfig";

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
    const dynamicOrderSpacing = await adjustOrderSpacing(orderSpacing, stdDev, 0.0025);
    // 주문 수량 조정 (TODO: 토큰별 Thershold값 정해야함)
    const adjustedOrderQuantity = await adjustPositionSize(orderQuantity, stdDev, 0.0025);

    console.log('Placing orders...');
    let totalPosition = openPosition; // 현재 포지션 크기
   
    for (let level = 1; level <= orderLevels; level++) {
        const priceOffset = (optimalSpread / 2) * level * dynamicOrderSpacing;
        let { bidPrice, askPrice } = setBidAskPrices(neutralPrice, priceOffset, config.precision);

        const takeProfitPrice = lastPrice * (1 + takeProfitRatio);
        const stopLossPrice = lastPrice * (1 - stopLossRatio);
        
        const levelOrderQuantity = await calculateOrderQuantity(adjustedOrderQuantity, level);
        console.log(`Level ${level} - Bid Price: ${bidPrice}, Ask Price: ${askPrice}, Order Quantity: ${levelOrderQuantity}`);

        if (bidPrice > stopLossPrice && bidPrice < takeProfitPrice && totalPosition + levelOrderQuantity <= maxPosition) {
            if (bidPrice * levelOrderQuantity > 10) {
                console.log(`Placing BUY order - Price: ${bidPrice}, Quantity: ${levelOrderQuantity}`);
                await client.placeOrder(symbol, 'LIMIT', 'BUY', bidPrice, levelOrderQuantity);
                totalPosition += levelOrderQuantity;
            }
        }

        if (askPrice < takeProfitPrice && askPrice > stopLossPrice && totalPosition - levelOrderQuantity >= -maxPosition) {
            if (askPrice * levelOrderQuantity > 10) {
                console.log(`Placing SELL order - Price: ${askPrice}, Quantity: ${levelOrderQuantity}`);
                await client.placeOrder(symbol, 'LIMIT', 'SELL', askPrice, levelOrderQuantity);
                totalPosition -= levelOrderQuantity;
            }
        }
    }
}