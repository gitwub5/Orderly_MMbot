import { MainClient } from "../client/main.client";
import { calculateOptimalSpread, adjustMidPrice, adjustPositionSize, adjustOrderSpacing, calculateOrderQuantity, setBidAskPrices } from "./functions";
import { StrategyConfig } from "./strategyConfig";
import { fixPrecision } from "../utils/fixPrecision";
import { riskManagement } from "./riskManagement";
import { predictPriceMovement, delay } from "./functions";
import winston from 'winston';

// body 값에 visible_quantity, reduce_only 추가하면 수수료 rebate가 안됨 -> WHY???????
export async function spreadOrder(client: MainClient, config: StrategyConfig, logger: winston.Logger) {
    const { symbol, orderQuantity, orderLevels, orderSpacing, tradePeriodMs, stdDevPeriod, gamma, k, precision, threshold} = config;

    logger.info('Canceling all existing orders...');
    await client.cancelAllOrders(symbol);

    const [spread, stdDev, orderBook, midPrice, openPosition] = await Promise.all([
        client.getOrderBookSpread(symbol),
        client.getStandardDeviation(symbol, stdDevPeriod),
        client.getOrderBook(symbol, 10),
        client.getOrderBookMidPrice(symbol),
        client.getOnePosition(config.symbol)
    ]);

    logger.info(`OrderBook Spread: ${spread}`);
    logger.info(`Standard deviation: ${stdDev}`);
    logger.info(`Last executed price(midPrice): ${midPrice}`);

    if (openPosition.data.position_qty === 0 || Math.abs(openPosition.data.position_qty * openPosition.data.average_open_price) < 10) {
        
        const prediction = predictPriceMovement(orderBook.data, threshold);

        if (prediction === 1) {
            logger.info('Prediction indicates price is likely to go up.');
            for (let level = 0; level < orderLevels; level++) {
                if(level === 0){
                    const buyPrice = fixPrecision(midPrice, precision);
                    await client.placeOrder(symbol, 'LIMIT', 'BUY', buyPrice, orderQuantity);
                }
                await client.placeOrder(symbol, 'BID', 'BUY', null, orderQuantity, {
                    body: JSON.stringify({ level: level })
                });
            }
        } else if (prediction === -1) {
            logger.info('Prediction indicates price is likely to go down.');
            for (let level = 0; level < orderLevels; level++) {
                if(level === 0){
                    const sellPrice = fixPrecision(midPrice, precision);
                    await client.placeOrder(symbol, 'LIMIT', 'SELL', sellPrice, orderQuantity);
                }
                await client.placeOrder(symbol, 'ASK', 'SELL', null, orderQuantity, {
                    body: JSON.stringify({ level: level })
                });
            }
        } else {
            logger.info('Prediction indicates price is likely to remain stable.');
            const T = 1;
            const t = 0;
            const optimalSpread = await calculateOptimalSpread(stdDev, T, t, gamma, k);
            logger.info(`Optimal spread: ${optimalSpread}`);

            for (let level = 0; level < orderLevels; level++) {

                if(level === 0){
                    await client.placeOrder(symbol, 'BID', 'BUY', null, orderQuantity, {
                        body: JSON.stringify({ level: level })
                        //body: JSON.stringify({ level: level + 1 ,  visible_quantity: 0 })
                    });
                    await client.placeOrder(symbol, 'ASK', 'SELL', null, orderQuantity, {
                        body: JSON.stringify({ level: level })
                        //body: JSON.stringify({ level: level + 1 ,  visible_quantity: 0 })
                    });
                }
                else{
                    const buyPriceOffset = (optimalSpread / 2) * level * orderSpacing;
                    const sellPriceOffset = (optimalSpread / 2) * level * orderSpacing;

                    let buyPrice = fixPrecision(midPrice - buyPriceOffset, precision);
                    let sellPrice = fixPrecision(midPrice + sellPriceOffset, precision);

                    await client.placeOrder(symbol, 'POST_ONLY', 'BUY', buyPrice, orderQuantity, {
                        body: JSON.stringify({ post_only_adjust: false })
                    });

                    await client.placeOrder(symbol, 'POST_ONLY', 'SELL', sellPrice, orderQuantity, {
                        body: JSON.stringify({ post_only_adjust: false })
                    });
                 }
            }
            await delay(10000); 
        }
    }

   
    const interval = setInterval(async () => {
        try {
            const openPosition = await client.getOnePosition(symbol);
            await riskManagement(client, config, logger, openPosition);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
            logger.error(`Error during risk management for ${symbol}: ${errorMessage}`);
        }
    }, 4000);

    // Ensure the interval is cleared after the trade period ends
    setTimeout(() => clearInterval(interval), tradePeriodMs);

}