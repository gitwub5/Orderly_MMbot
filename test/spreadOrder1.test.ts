import { MainClient } from "../src/client/main.client";
import { calculateOptimalSpread, adjustMidPrice, adjustOrderSpacing,  } from "../src/strategy/functions";
import { StrategyConfig } from "../src/strategy/strategyConfig";
import { fixPrecision } from "../src/utils/fixPrecision";
import { riskManagement } from "../src/strategy/riskManagement";
import { RestAPIUrl } from '../src/enums';
import { accountInfo } from '../src/utils/account';
import { cancelAllOrdersAndClosePositions } from '../src/strategy/closePosition';
import { strategies } from '../src/strategy/strategies';
import { stopFlag } from '../src/globals';
import { createLogger } from '../src/utils/logger/logger';
import winston from 'winston';

// 매수 및 매도 주문을 배치하는 함수
export async function spreadOrder(client: MainClient, config: StrategyConfig, logger: winston.Logger) {
    const { symbol, orderQuantity, stdDevPeriod, orderLevels, orderSpacing, takeProfitRatio, stopLossRatio, gamma, k, stdDevThreshold } = config;

    //주문 전부 취소 (주문 취소도 변경 고려)
    logger.info('Canceling all existing orders...');
    await client.cancelAllOrders(symbol);

    //시장 최근 거래값 불러오기1 : 1분 Kline의 close 값
    // const tickerData = await client.getKline(symbol, '1m');
    // const lastPrice = tickerData.data.rows[0].close;

     //시장 최근 거래값 불러오기2: 오더북의 평균값
    const lastPrice = await client.getOrderBookMidPrice(symbol);
    logger.info(`Last executed price: ${lastPrice}`);
   
    //포지션 값 불러오기 + Risk Management
    const openPosition = await client.getOnePosition(config.symbol);
    //openPosition값으로 pnl 비율 계산 -> 만약 손실갭 넘었을 시에는 수량만큼 ask나 bid 주문 걸어버리기
    await riskManagement(client, config, logger, openPosition);
    // +ask나 bid로 주문이 빠르고 자주 체결되는 지 확인 + rebate 받는지도 확인
    const position_qty = openPosition.data.position_qty;
    logger.info(`Open position quantity: ${position_qty}`);

    //표준편차 가져오기 (TODO: 표준편차 제대로 가져오는지 확인)
    const stdDev = await client.getStandardDeviation(symbol, stdDevPeriod);
    logger.info(`Standard deviation: ${stdDev}`);

    //방법 #1
    const T = 1;
    const t = 0;

    //최적 스프레드 값 구하기
    const optimalSpread = await calculateOptimalSpread(stdDev, T, t, gamma, k);
    logger.info(`Optimal spread: ${optimalSpread}`);

    //중립값 구하기
    const neutralPrice = await adjustMidPrice(lastPrice, position_qty, stdDev, T, t, gamma);
    logger.info(`Neutral price: ${neutralPrice}`);

    // 주문 간격 조정
    const dynamicOrderSpacing = await adjustOrderSpacing(orderSpacing, stdDev, stdDevThreshold);
    // 주문 수량 조정 (사용 보류)
    //const orderQuantity = await adjustPositionSize(orderQuantity, stdDev, stdDevThreshold);

    logger.info('Placing orders...');
    let netPosition = position_qty;
    let buyOrderSpacing = dynamicOrderSpacing;
    let sellOrderSpacing = dynamicOrderSpacing;

    if (netPosition < 0) { // If net short, increase sell order spacing
        sellOrderSpacing *= 1.5;
        buyOrderSpacing *= 0.5;
    } else if (netPosition > 0) { // If net long, increase buy order spacing
        buyOrderSpacing *= 1.5;
        sellOrderSpacing *= 0.5;
    }
   
    for (let level = 1; level <= orderLevels; level++) {
        // Calculate price offsets for buy and sell orders separately
        const buyPriceOffset = (optimalSpread / 2) * level * buyOrderSpacing;
        const sellPriceOffset = (optimalSpread / 2) * level * sellOrderSpacing;
        
        // Calculate bid and ask prices with respective offsets
        let bidPrice = fixPrecision(neutralPrice - buyPriceOffset, config.precision);
        let askPrice = fixPrecision(neutralPrice + sellPriceOffset, config.precision);

        const takeProfitPrice = neutralPrice * (1 + takeProfitRatio);
        const stopLossPrice = neutralPrice * (1 - stopLossRatio);
        
        //const orderQuantity = await calculateOrderQuantity(orderQuantity, level);
        logger.info(`Level ${level} - Bid Price: ${bidPrice}, Ask Price: ${askPrice}, Order Quantity: ${orderQuantity}`);

        if (netPosition <= 0) { // Only place buy orders if net position is non-positive
            if (stopLossPrice < bidPrice && bidPrice < takeProfitPrice) {
                if (bidPrice * orderQuantity > 10) {
                    logger.info(`Placing BUY order - Price: ${bidPrice}, Quantity: ${orderQuantity}`);
                    await client.placeOrder(symbol, 'LIMIT', 'BUY', bidPrice, orderQuantity);
                    netPosition += orderQuantity; // Adjust net position
                }
            }
        }
    
        if (netPosition >= 0) { // Only place sell orders if net position is non-negative
            if (stopLossPrice < askPrice && askPrice < takeProfitPrice) {
                if (askPrice * orderQuantity > 10) {
                    logger.info(`Placing SELL order - Price: ${askPrice}, Quantity: ${orderQuantity}`);
                    await client.placeOrder(symbol, 'LIMIT', 'SELL', askPrice, orderQuantity);
                    netPosition -= orderQuantity; // Adjust net position
                }
            }
        }
    }
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


(async () => {
    try {
        console.log('Starting strategy execution for multiple symbols...');
        await executeMultipleStrategies(strategies);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
        console.error(`Strategy execution failed: ${errorMessage}`);
    }
})();