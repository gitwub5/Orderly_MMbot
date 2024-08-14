import { MainClient } from './client/main.client';
import { RestAPIUrl } from './enums';
import { accountInfo } from './utils/account';
import { StrategyConfig } from './interfaces/strategy';
import { cancelAllOrdersAndClosePositions } from './strategy/trades/closePosition';
import { spreadOrder } from './strategy/trades/spreadOrder';
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
        startPeriodicMessages();
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
        console.error(`Strategy execution failed: ${errorMessage}`);
    }
})();
