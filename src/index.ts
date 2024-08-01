import { MainClient } from './client/main.client';
import { RestAPIUrl } from './enums';
import { accountInfo } from './utils/account';
import { StrategyConfig } from './strategy/strategyConfig';
import { cancelAllOrdersAndClosePositions } from './strategy/closePosition';
import { spreadOrder } from './strategy/spreadOrder';
import { strategies } from './strategy/strategies';
import { startPeriodicMessages } from './utils/telegram/telegramBot';
import { stopFlag } from './globals';
import { createLogger } from './utils/logger/logger';

// 전략 실행 함수
async function executeStrategy(config: StrategyConfig) {
    const client = new MainClient(accountInfo, RestAPIUrl.mainnet);
    const { symbol, tradePeriodMs } = config;

    const token = symbol.split('_')[1];
    const logger = createLogger(token);

    // Ctrl+C 이벤트 핸들러
    process.on('SIGINT', async () => {
        logger.info(`Caught interrupt signal (SIGINT) for ${symbol}, canceling all orders and closing positions...`);
        await cancelAllOrdersAndClosePositions(client, symbol);
        process.exit();
    });

    // 전략 실행 반복 함수
    const runStrategy = async () => {
        try {
            if (stopFlag) {
                logger.info(`Trading for ${symbol} has been stopped.`);
                return;
            }
            logger.info(`Running market making strategy for ${symbol}...`);
            await spreadOrder(client, config, logger);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
            logger.error(`Error during strategy execution for ${symbol}: ${errorMessage}`);
        } finally {
            if (!stopFlag) {
                setTimeout(runStrategy, tradePeriodMs);
            }
        }
    };

    // 전략 실행
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

// 즉시 실행 함수
(async () => {
    try {
        console.log('Starting strategy execution for multiple symbols...');
        await executeMultipleStrategies(strategies);
        startPeriodicMessages();
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
        console.error(`Strategy execution failed: ${errorMessage}`);
    }
})();