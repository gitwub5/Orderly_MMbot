import { MainClient } from './client/main.client';
import { RestAPIUrl } from './enums';
import { accountInfo } from './utils/account';
import { StrategyConfig } from './interfaces/strategy';
import { cancelAllOrdersAndClosePositions } from './strategy/trades/closePosition';
import { SpreadOrder } from './strategy/trades/spreadOrder';
import { strategies } from './strategy/strategies';
import { startPeriodicMessages } from './utils/telegram/telegramBot';
import { stopFlag } from './globals';
import { createLogger } from './utils/logger/logger';
import winston from 'winston';

class StrategyExecutor {
    private client: MainClient;
    private config: StrategyConfig;
    private logger: winston.Logger;
    private strategyRunning: boolean = true;

    constructor(config: StrategyConfig) {
        const { symbol } = config;
        const token = symbol.split('_')[1];
        this.client = new MainClient(accountInfo, RestAPIUrl.mainnet);
        this.config = config;
        this.logger = createLogger(token);
        this.setupSignalHandlers();
    }

    private setupSignalHandlers() {
        process.on('SIGINT', async () => {
            this.logger.info(`Caught interrupt signal (SIGINT) for ${this.config.symbol}, canceling all orders and closing positions...`);
            await this.stopStrategy();
            process.exit();
        });

        process.on('SIGTERM', async () => {
            this.logger.info(`Caught termination signal (SIGTERM) for ${this.config.symbol}, canceling all orders and closing positions...`);
            await this.stopStrategy();
            process.exit();
        });
    }

    public async stopStrategy() {
        if (!this.strategyRunning) return;  // 중복 실행 방지
        this.strategyRunning = false;
        await cancelAllOrdersAndClosePositions(this.client, this.config.symbol);
    }

    private async executeStrategy() {
        try {
            this.logger.info(`Running market making strategy for ${this.config.symbol}...`);
            const spreadOrderExecutor = new SpreadOrder(this.client, this.config, this.logger);
            await spreadOrderExecutor.executeSpreadOrder();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
            this.logger.error(`Error during strategy execution for ${this.config.symbol}: ${errorMessage}`);
        }
    }

    public async run() {
        while (this.strategyRunning && !stopFlag) {
            await this.executeStrategy();
            if (this.strategyRunning && !stopFlag) {
                await this.delay(5000);
                //5초후 다시 시작
            }
        }
        this.logger.info(`Trading for ${this.config.symbol} has been stopped.`);
    }

    private async delay(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

async function executeMultipleStrategies(strategies: Record<string, StrategyConfig>) {
    const executors = Object.values(strategies).map(config => new StrategyExecutor(config));

    // 모든 전략을 중단하는 함수
    const stopAllStrategies = async () => {
        for (const executor of executors) {
            await executor.stopStrategy(); 
        }
    };

    // SIGINT 및 SIGTERM 신호를 처리하여 모든 전략 중단
    process.on('SIGINT', async () => {
        console.log("Caught interrupt signal (SIGINT), stopping all strategies...");
        await stopAllStrategies();
        process.exit();
    });

    process.on('SIGTERM', async () => {
        console.log("Caught termination signal (SIGTERM), stopping all strategies...");
        await stopAllStrategies();
        process.exit();
    });

    await Promise.all(executors.map(executor => executor.run()));
}

//실행 함수
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