import { MainClient } from './client/main.client';
import { RestAPIUrl } from './enums';
import { accountInfo } from './utils/account';
import { StrategyConfig } from './stratgy/stratgyConfig';
import { cancelAllOrdersAndClosePositions } from './stratgy/closePosition';
import { spreadOrder } from './stratgy/spreadOrder';

// let startTime: Date;

// 전략 실행 함수
async function executeStrategy() {
    // 클라이언트 인스턴스 생성
    const client = new MainClient(accountInfo, RestAPIUrl.mainnet);

    // 전략 설정
    const config: StrategyConfig = {
        symbol: 'PERP_TON_USDC',
        precision: 4,
        orderQuantity: 8,
        tradePeriodMs: 60000, //1분
        stdDevPeriod: 15,
        orderLevels: 10,
        orderSpacing: 0.05,
        takeProfitRatio: 0.03,
        stopLossRatio: 0.01,
        gamma: 0.55,
        k: 3,
        maxPosition: 30,
    };

    const { tradePeriodMs, symbol } = config;

     // 프로그램 실행 시간을 거래 시작 시간으로 설정
    //  startTime = new Date();

    // Ctrl+C 이벤트 핸들러
    process.on('SIGINT', async () => {
        console.log('Caught interrupt signal (SIGINT), canceling all orders and closing positions...');
        await cancelAllOrdersAndClosePositions(client, symbol);
        process.exit();
    });

    // 전략 실행 반복 함수
    const runStrategy = async () => {
        try {
            console.log('Running market making strategy...');
            await spreadOrder(client, config);

            // 주문이 체결될 시간을 주기 위한 지연 시간 추가 (예: 10초)
            // await delay(10000);

            // await fillOrderBook(client, config);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
            console.error(`Error during strategy execution: ${errorMessage}`);
        } finally {
            setTimeout(runStrategy, tradePeriodMs);
        }
    };

    // 전략 실행
    try {
        await runStrategy();
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
        console.error(`Strategy execution failed: ${errorMessage}`);
    }
}

// 즉시 실행 함수
(async () => {
    try {
        console.log('Starting strategy execution...');
        await executeStrategy();
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
        console.error(`Strategy execution failed: ${errorMessage}`);
    }
})();