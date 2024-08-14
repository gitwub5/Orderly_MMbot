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

// OrderType: ask, bid이랑 level값으로 주문하는 함수
// ASK type order behavior: the order price is guranteed to be the best ask price of the orderbook at the time it gets accepted.
// BID type order behavior: the order price is guranteed to be the best bid price of the orderbook at the time it gets accepted.
// level: Integer value from 0 to 4. This parameter controls wether to present the price of bid0 to bid4 or ask0 to ask4. Only allowed when order_type is BID or ASK.
// https://orderly.network/docs/build-on-evm/evm-api/restful-api/private/create-order
export async function spreadAskBidOrder(client: MainClient, config: StrategyConfig, logger: winston.Logger) {
    const { symbol, orderQuantity, orderLevels, tradePeriodMs } = config;

    logger.info('Canceling all existing orders...');
    await client.cancelAllOrders(symbol);

    const lastPrice = await client.getOrderBookMidPrice(symbol);
    logger.info(`Last executed price: ${lastPrice}`);

    const openPosition = await client.getOnePosition(config.symbol);

    if (openPosition.data.position_qty === 0 || Math.abs(openPosition.data.position_qty * openPosition.data.average_open_price) < 10) {
        for (let level = 0; level < orderLevels; level++) {
            await client.placeOrder(symbol, 'BID', 'BUY', null, orderQuantity, {
                body: JSON.stringify({ 'level': level })
            });

            await client.placeOrder(symbol, 'ASK', 'SELL', null, orderQuantity, {
                body: JSON.stringify({ 'level': level })
            });
        }
    }

    await delay(2000);

    const interval = setInterval(async () => {
        try {
            const openPosition = await client.getOnePosition(symbol);
            await riskManagement(client, config, logger, openPosition);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
            logger.error(`Error during risk management for ${symbol}: ${errorMessage}`);
        }
    }, 1500);

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
            await spreadAskBidOrder(client, config, logger);
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