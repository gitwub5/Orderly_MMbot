import { MainClient } from "../src/client/main.client";
import { calculateOptimalSpread, adjustMidPrice, adjustOrderSpacing,  } from "../src/strategy/functions";
import { StrategyConfig } from "../src/strategy/strategyConfig";
import { fixPrecision } from "../src/utils/fixPrecision";
import { RestAPIUrl } from '../src/enums';
import { accountInfo } from '../src/utils/account';
import { cancelAllOrdersAndClosePositions } from '../src/strategy/closePosition';
import { stopFlag } from '../src/globals';
import { createLogger } from '../src/utils/logger/logger';
import winston from 'winston';
import { OrderBookResponse, PositionResponse } from "../src/interfaces";


async function calculatePnLPercentage(openPosition : PositionResponse) {
    const { position_qty, mark_price, average_open_price } = openPosition.data;

    let pnlPercentage = 0;
    if (position_qty > 0) { // Long position
        pnlPercentage = ((mark_price - average_open_price) / average_open_price) * 100;
    } else if (position_qty < 0) { // Short position
        pnlPercentage = ((average_open_price - mark_price) / average_open_price) * 100;
    } else {
        pnlPercentage = 0; // No position
    }

    return pnlPercentage;
}

async function placeAskBidOrder(client: MainClient, symbol: string, position_qty: number){
    await client.cancelAllOrders(symbol);
    
    //만약 포지션이 음수이면 bidOrder
    if(position_qty < 0){
        await client.placeOrder(symbol, 'BID', 'BUY', null, -position_qty,
            //{ body: JSON.stringify({ reduce_only: true })}
        );
        console.log(`Placing BID BUY order`);
    }
    //만약 포지션이 양수이면 askOrder
    else if(position_qty > 0){
        await client.placeOrder(symbol, 'ASK', 'SELL', null, position_qty, 
           // { body: JSON.stringify({reduce_only: true })}
        );
        console.log(`Placing ASK SELL order`);
    }

    return true;
}

async function placeMarketOrder(client: MainClient, symbol: string, position_qty: number){
    await client.cancelAllOrders(symbol);
    
    //만약 포지션이 음수이면 bidOrder
    if(position_qty < 0){
        await client.placeOrder(symbol, 'MARKET', 'BUY', null, -position_qty, {
            body: JSON.stringify({ reduce_only: true })});
        console.log(`Placing MARKET BUY order`);
    }
    //만약 포지션이 양수이면 askOrder
    else if(position_qty > 0){
        await client.placeOrder(symbol, 'MARKET', 'SELL', null, position_qty, {
            body: JSON.stringify({ reduce_only: true })});
        console.log(`Placing MARKET SELL order`);
    }

    return true;
}

async function placeLimitOrder(client: MainClient, symbol: string, openPosition: PositionResponse){
    await client.cancelAllOrders(symbol);

    const position_qty = openPosition.data.position_qty;
    const average_open_price = openPosition.data.average_open_price;
    // const maxDeviation = average_open_price * 0.0002;

    let orderPrice = average_open_price;
    if (position_qty < 0) {
        // orderPrice += maxDeviation; // Increase the price for limit buy
        // orderPrice = fixPrecision(orderPrice, config.precision);
        await client.placeOrder(symbol, 'LIMIT', 'BUY', orderPrice, -position_qty, {
            body: JSON.stringify({ reduce_only: true,  visible_quantity: 0 })});
        console.log(`Placing LIMIT BUY order at ${orderPrice}`);
    } else if (position_qty > 0) {
        // orderPrice -= maxDeviation; // Decrease the price for limit sell
        // orderPrice = fixPrecision(orderPrice, config.precision);
        await client.placeOrder(symbol, 'LIMIT', 'SELL', orderPrice, position_qty, {
            body: JSON.stringify({ reduce_only: true,  visible_quantity: 0 })});
        console.log(`Placing LIMIT SELL order at ${orderPrice}`);
    }

    return true;
}

export async function riskManagement(client: MainClient, config: StrategyConfig, logger: winston.Logger, openPosition: PositionResponse){
    const position_qty = openPosition.data.position_qty;
    // const average_open_price = openPosition.data.average_open_price;
    // const mark_price = openPosition.data.mark_price;

    if (position_qty !== 0 || Math.abs(openPosition.data.position_qty * openPosition.data.average_open_price) > 10) {
        // 현재 포지션 PnL 계산
        const pnlPercentage = await calculatePnLPercentage(openPosition);
        logger.info(`Current Position PnL Percentage: ${pnlPercentage.toFixed(4)}%`);

        // 손실관리 추가 (매우 보수적인 방법)
        // average_open_price 가격에 지정가 주문
        // 대부분 한 쪽에만 걸리고 반대편 주문 체결은 잘 안됨 -> 평균가에 주문을 걸면 수수료 + 현재가와 평균가 차이만큼의 이득을 먹고 나옴.
        // 

        // 손실관리 - 표준 (0% ~ 1% 손실)
        if (pnlPercentage < 0 
            && Math.abs(pnlPercentage) < config.stopLossRatio * 10) {
            logger.info(`Executing Standard Loss Management`);
            return await placeAskBidOrder(client, config.symbol, position_qty);
        }

        // 손실관리 - 공격적 (1% 이상 손실)
        if (pnlPercentage < 0 && Math.abs(pnlPercentage) >= config.stopLossRatio * 10) {
            logger.info(`Executing Aggressive Loss Management - MARKET Orders`);
            return await placeMarketOrder(client, config.symbol, position_qty);
        }

        // 이익실현 관리
        if (pnlPercentage >= 0) {
            logger.info(`TAKE Risk Management execute`);
            return await placeAskBidOrder(client, config.symbol, position_qty);
        }

        // if (pnlPercentage >= 0 && Math.abs(pnlPercentage) > config.takeProfitRatio){
        //     logger.info(`TAKE Risk Management execute`);
        //     return await placeAskBidOrder(client, config.symbol, position_qty);
        // }
    }
}

  
export function predictPriceMovement(orderBook: OrderBookResponse['data'], threshold: number): number {
    const totalBidQuantity = orderBook.bids.reduce((total, bid) => total + bid.quantity, 0);
    const totalAskQuantity = orderBook.asks.reduce((total, ask) => total + ask.quantity, 0);
  
    const totalQuantity = totalBidQuantity + totalAskQuantity;
    const bidPercentage = (totalBidQuantity / totalQuantity) * 100;
    const askPercentage = (totalAskQuantity / totalQuantity) * 100;
    
    console.log(bidPercentage, askPercentage);
    //const threshold = 55;  // N% 이상 차이가 나면 높은 가능성으로 판단
  
    if (bidPercentage > threshold) {
      return 1;  // 확실한 가격 상승 가능성
    } else if (askPercentage > threshold) {
      return -1;  // 확실한 가격 하락 가능성
    } else {
      return 0;  // 변동 없음 또는 예측 불확실
    }
  }

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

// 지연 시간을 주기 위한 함수
function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


// 전략 실행 함수
async function executeStrategy(config: StrategyConfig) {
    const client = new MainClient(accountInfo, RestAPIUrl.mainnet);
    const { symbol, tradePeriodMs } = config;

    const token = symbol.split('_')[1];
    const logger = createLogger(token);

    let strategyRunning = true;

    process.on('SIGINT', async () => {
        strategyRunning = false;
        logger.info(`Caught interrupt signal (SIGINT) for ${symbol}, canceling all orders and closing positions...`);
        await cancelAllOrdersAndClosePositions(client, symbol);
        process.exit();
    });

    const runStrategy = async () => {
        if (!strategyRunning || stopFlag) {
            logger.info(`Trading for ${symbol} has been stopped.`);
            return;
        }

        try {
            logger.info(`Running market making strategy for ${symbol}...`);
            await spreadOrder(client, config, logger);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
            logger.error(`Error during strategy execution for ${symbol}: ${errorMessage}`);
        } finally {
            if (strategyRunning && !stopFlag) {
                setTimeout(runStrategy, tradePeriodMs);
            }
        }
    };

    try {
        await runStrategy();
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
        logger.error(`Strategy execution failed for ${symbol}: ${errorMessage}`);
    }
}

// 다중 심볼 전략 실행 함수
async function executeMultipleStrategies(strategies: Record<string, StrategyConfig>) {
    await Promise.all(Object.values(strategies).map(config => executeStrategy(config)));
}


export const strategies: Record<string, StrategyConfig> = {
    // 'PERP_LINK_USDC': {
    //     symbol: 'PERP_LINK_USDC',
    //     precision: 3,
    //     orderQuantity: 1.5,
    //     tradePeriodMs: 20000,
    //     stdDevPeriod: 10,
    //     orderLevels: 3,
    //     orderSpacing: 0.05,
    //     takeProfitRatio: 0.01,
    //     stopLossRatio: 0.01,
    //     gamma: 0.4,
    //     k: 7,
    //     threshold: 60,
    // },

    'PERP_SOL_USDC': {
        symbol: 'PERP_SOL_USDC',
        precision: 3,
        orderQuantity: 0.1,
        tradePeriodMs: 20000,
        stdDevPeriod: 20,
        orderLevels: 3,
        orderSpacing: 0.05,
        takeProfitRatio: 0.01,
        stopLossRatio: 0.01,
        gamma: 0.4,
        k: 0.3,
        threshold: 55,
    },

    'PERP_DOGE_USDC': {
        symbol: 'PERP_DOGE_USDC',
        precision: 5,
        orderQuantity: 150,
        tradePeriodMs: 20000,
        stdDevPeriod: 50,
        orderLevels: 3,
        orderSpacing: 0.02,
        takeProfitRatio: 0.01,
        stopLossRatio: 0.01,
        gamma: 0.2,
        k: 240,
        threshold: 60,
    },

};

(async () => {
    try {
        console.log('Starting strategy execution for multiple symbols...');
        await executeMultipleStrategies(strategies);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
        console.error(`Strategy execution failed: ${errorMessage}`);
    }
})();

