import { MainClient } from "../../client/main.client";
import { calculateOptimalSpread  } from "../functions/optimalSpread";
import { StrategyConfig } from "../../interfaces/strategy";
import { fixPrecision } from "../../utils/fixPrecision";
import { riskManagement } from "./riskManagement";
import { delay, delayWithCountdown } from "../../utils/delay";
import { collectOrderBookData, predictPriceMovement } from "../data/orderBook.data";
import { collectTradeData, calculateStandardDeviation, predictMarketDirection } from "../data/trade.data";
import winston from 'winston';

// body 값에 visible_quantity, reduce_only 추가하면 수수료 rebate가 안됨 -> WHY???????
export async function spreadOrder(client: MainClient, config: StrategyConfig, logger: winston.Logger) {
    const { symbol, orderQuantity, orderLevels, orderSpacing, gamma, k, precision } = config;

    logger.info('Canceling all existing orders...');
    await client.cancelAllOrders(symbol);
   
    const openPosition = await client.getOnePosition(config.symbol)

    if (openPosition.data.position_qty === 0 || Math.abs(openPosition.data.position_qty * openPosition.data.average_open_price) < 10) {
        const duration = 10000; // 10초
        const interval = 1000;  // 1초 간격
        let elapsed = 0;        // 경과 시간


        // 오더북 데이터 및 거래 데이터를 백그라운드에서 수집 시작
        const orderBookData = collectOrderBookData(client, symbol, duration, interval);
        const tradeData = collectTradeData(client, symbol, duration, interval);

        while (elapsed < duration) {
            logger.info(`Elapsed Time: ${elapsed / 1000} seconds`);
            await delay(interval); // 1초 대기
            elapsed += interval;
        }

        // 백그라운드 데이터 수집 중 다른 작업 수행
        const orderBookSnapshots = await orderBookData;
        const tradeSnapshots = await tradeData;

        // 표준 편차 계산
        const stdDev = calculateStandardDeviation(tradeSnapshots);

         // 매수/매도 데이터를 기반으로 시장 방향 예측
        const marketDirectionPrediction = predictMarketDirection(tradeSnapshots);
        logger.info(`Market Direction Prediction: ${marketDirectionPrediction > 0 ? 'UP' : marketDirectionPrediction < 0 ? 'DOWN' : 'STABLE'}`);


        const bestBid = orderBookSnapshots[orderBookSnapshots.length - 1].orderBook.bids[0].price;
        const bestAsk = orderBookSnapshots[orderBookSnapshots.length - 1].orderBook.asks[0].price;
        const midPrice = (bestAsk + bestBid) / 2;

        // 예측 수행 (수집된 오더북 데이터를 기반으로)
        const orderBookPrediction = predictPriceMovement(orderBookSnapshots);
        logger.info(`Order Book Prediction: ${orderBookPrediction > 0 ? 'UP' : orderBookPrediction < 0 ? 'DOWN' : 'STABLE'}`);


        // 두 예측을 결합하여 최종 예측 결정
        let prediction;

        if (marketDirectionPrediction === 1 && orderBookPrediction === 1) {
            prediction = 1;  // 둘 다 상승 예측일 때
        } else if (marketDirectionPrediction === -1 && orderBookPrediction === -1) {
            prediction = -1;  // 둘 다 하락 예측일 때
        } else {
            prediction = 0;  // 나머지 경우, 안정적 또는 불확실한 상태로 판단
        }

        logger.info(`Final Combined Prediction: ${prediction === 1 ? 'UP' : prediction === -1 ? 'DOWN' : 'STABLE'}`);
        
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
        }
        await delayWithCountdown(10000, logger); 
    }
    
    // Risk management을 2초 간격으로 반복 실행
    const intervalId = setInterval(async () => {
        const openPositionAfterDelay = await client.getOnePosition(symbol);
        
        // 포지션이 모두 닫혔는지 확인
        if (openPositionAfterDelay.data.position_qty === 0 || Math.abs(openPositionAfterDelay.data.position_qty * openPositionAfterDelay.data.average_open_price) <= 10) {
            logger.info("All positions closed, stopping risk management.");
            clearInterval(intervalId); // 포지션이 모두 닫히면 반복 중지
            return; // 종료
        } 
        
        // riskManagement 실행
        try {
            await riskManagement(client, config, logger, openPositionAfterDelay);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
            logger.error(`Error during risk management for ${symbol}: ${errorMessage}`);
        }
    }, 2000);

    // `setInterval`이 정상 종료될 때까지 `spreadOrder`가 종료되지 않도록 유지
    await new Promise<void>((resolve) => {
        const checkIntervalId = setInterval(async () => {
            const openPositionAfterDelay = await client.getOnePosition(symbol);
            
            // 포지션이 모두 닫혔는지 확인
            if (openPositionAfterDelay.data.position_qty === 0 || Math.abs(openPositionAfterDelay.data.position_qty * openPositionAfterDelay.data.average_open_price) <= 10) {
                clearInterval(checkIntervalId); // 포지션이 모두 닫히면 반복 중지
                resolve(); // 종료 후 Promise 해제
            }
        }, 1000); // 1초 간격으로 상태 확인
    });
}