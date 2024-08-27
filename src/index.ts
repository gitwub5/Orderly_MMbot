import { MainClient } from './client/main.client';
import { RestAPIUrl, WsPrivateUrl } from './enums';
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
    private client: MainClient; // MainClient (오덜리 연결)
    private config: StrategyConfig; // 전략 안터페이스
    private logger: winston.Logger; // 로거 호출
    private strategyRunning: boolean = true; // 현재 실행 중인지 확인하는 변수

    constructor(config: StrategyConfig) {
        const { symbol } = config;
        this.client = new MainClient(accountInfo, RestAPIUrl.mainnet, WsPrivateUrl.mainnet); // 계정 정보, API 주소, ws 주소
        this.config = config;
        const token = symbol.split('_')[1];
        this.logger = createLogger(token); // 토큰별 로거 생성
    }

    // 전략 실행 함수
    private async executeStrategy() {
        try {
            this.logger.info(`Running market making strategy for ${this.config.symbol}...`);
            // SpreadOrder 객체 생성
            const spreadOrderExecutor = new SpreadOrder(this.client, this.config, this.logger);
            // SpreadOrder 실행
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
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }

    public async stopStrategy() {
        this.strategyRunning = false;
        // 모든 주문 취소 및 포지션 정리
        await cancelAllOrdersAndClosePositions(this.client, this.config.symbol);
        // 웹소켓 연결 해제
        await this.client.disconnect();
        this.logger.info(`Strategy for ${this.config.symbol} has been stopped.`);
    }
}

// 중앙에서 실행 전략 종료 관리
async function stopAllStrategies(executors: StrategyExecutor[]) {
    await Promise.all(executors.map(executor => executor.stopStrategy()));
}

// 여러 토큰 동시에 실행하는 함수 
async function executeMultipleStrategies(strategies: Record<string, StrategyConfig>) {
    const executors = Object.values(strategies).map(config => new StrategyExecutor(config));

    // 전역 신호 처리
    // Ctrl+C 입력시, 프로세스에 SIGINT라는 신호가 전달됨 -> 전략 실행 종료 이후 프로세스 실행 종료
    process.on('SIGINT', async () => {
        console.log("Received SIGINT, stopping all strategies...");
        await stopAllStrategies(executors);
        process.exit();
    });
    // Kill 명령을 통해 프로세스 종료 시 프로세스에 SIGTERM 신호가 전달됨 -> 전략 실행 종료 이후 프로세스 실행 종료
    process.on('SIGTERM', async () => {
        console.log("Received SIGTERM, stopping all strategies...");
        await stopAllStrategies(executors);
        process.exit();
    });

    await Promise.all(executors.map(executor => executor.run()));
}

//실행 함수
(async () => {
    try {
        console.log('Starting strategy execution for multiple symbols...');
        // 여러 토큰 동시에 전략 실행
        await executeMultipleStrategies(strategies);
        // 주기적으로 Telegram 메세지 전송
        startPeriodicMessages();
    } catch (error) {
        console.error(`Strategy execution failed: ${error}`);
    }
})();