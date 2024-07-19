import { MainClient } from './client/main.client.ts';
import { RestAPIUrl } from './enums';
import { accountInfo } from './utils/account';

// 전략 설정을 위한 인터페이스
interface StrategyConfig {
    symbol: string; // 거래할 암호화폐 페어 (예: 'BTC-USD')
    orderQuantity: number; // 각 주문의 수량
    tradePeriodMs: number; // 거래 주기, 밀리초 단위 (예: 1분 = 60000 밀리초)
    stdDevPeriod: number; // 표준 편차를 계산할 최근 거래 수 (예: 최근 50번의 거래)
    orderLevels: number; // 주문 레벨 수
    orderSpacing: number; // 주문 간격 비율
    takeProfitRatio: number; // 이익 실현 비율
    stopLossRatio: number; // 손절매 비율
}

// 매수 및 매도 주문을 배치하는 함수
async function spreadOrder(client: MainClient, config: StrategyConfig) {
    const { symbol, orderQuantity, stdDevPeriod, orderLevels, orderSpacing, takeProfitRatio, stopLossRatio } = config;

    // 최신 시세 데이터 및 현재 포지션, 표준 편차 가져오기
    const tickerData = await client.getTicker(symbol);
    const openPosition = await client.getOpenPosition();
    const lastPrice = parseFloat(tickerData.ticker.last);
    const stdDev = await client.getStandardDeviation(symbol, stdDevPeriod);

    // 중립 평균 가격 계산
    const neutralPrice = lastPrice - openPosition * Math.pow(stdDev, 2);

    // 기존 주문 취소
    const openOrders = await client.getOpenOrders();
    for (const order of openOrders.orders) {
        await client.cancelOrder(symbol, order.id);
    }

    // 여러 레벨의 매수 및 매도 주문 배치
    for (let level = 1; level <= orderLevels; level++) {
        const priceOffset = orderSpacing * level * stdDev;
        const buyPrice = neutralPrice - priceOffset;
        const sellPrice = neutralPrice + priceOffset;
        const takeProfitPrice = lastPrice * (1 + takeProfitRatio);
        const stopLossPrice = lastPrice * (1 - stopLossRatio);

        // 매수 주문 배치
        if (buyPrice > stopLossPrice && buyPrice < takeProfitPrice) {
            await client.placeOrder(symbol, 'LIMIT','BUY', parseFloat(buyPrice.toFixed(4)), orderQuantity);
        }

        // 매도 주문 배치
        if (sellPrice < takeProfitPrice && sellPrice > stopLossPrice) {
            await client.placeOrder(symbol, 'LIMIT', 'SELL',  parseFloat(sellPrice.toFixed(4)), orderQuantity);
        }
    }
}

// 오더북을 채우는 함수
async function fillOrderBook(client: MainClient, config: StrategyConfig) {
    const { symbol, orderQuantity, orderLevels, orderSpacing } = config;

    // 최신 시세 데이터 가져오기
    const tickerData = await client.getTicker(symbol);
    const lastPrice = parseFloat(tickerData.ticker.last);

    // 기존 주문 취소
    const openOrders = await client.getOpenOrders();
    for (const order of openOrders.position) {
        await client.cancelOrder(symbol, order.id);
    }

    // 여러 레벨의 매수 및 매도 주문 배치
    for (let level = 1; level <= orderLevels; level++) {
        const priceOffset = lastPrice * orderSpacing * level;
        const buyPrice = lastPrice - priceOffset;
        const sellPrice = lastPrice + priceOffset;

        // 매수 주문 배치 (5% 이상)
        if (buyPrice < lastPrice * 0.95) {
            await client.placeOrder(symbol, 'LIMIT','BUY', parseFloat(buyPrice.toFixed(4)), orderQuantity);
        }

        // 매도 주문 배치 (5% 이상)
        if (sellPrice > lastPrice * 1.05) {
            await client.placeOrder(symbol, 'LIMIT', 'SELL',  parseFloat(sellPrice.toFixed(4)), orderQuantity);
        }
    }
}

// 전략 실행 함수
async function executeStrategy() {
    // 클라이언트 인스턴스 생성
    const client = new MainClient(accountInfo, RestAPIUrl.mainnet);

    // 전략 설정
    const config: StrategyConfig = {
        symbol: 'PERP_TON_USDC',
        orderQuantity: 2,
        tradePeriodMs: 60000,
        stdDevPeriod: 50,
        orderLevels: 10,
        orderSpacing: 0.005,
        takeProfitRatio: 0.02,
        stopLossRatio: 0.01
    };

    const { tradePeriodMs } = config;

    // 전략 실행 반복 함수
    const runStrategy = async () => {
        try {
            await spreadOrder(client, config);
            await fillOrderBook(client, config);
        } catch (error) {
            console.error(`Error during strategy execution: ${error.message}`);
        } finally {
            setTimeout(runStrategy, tradePeriodMs);
        }
    };

    // 전략 실행
    try {
        await runStrategy();
    } catch (error) {
        console.error(`Strategy execution failed: ${error.message}`);
    }
}

// 즉시 실행 함수
(async () => {
    try {
        await executeStrategy();
    } catch (error) {
        console.error(`Strategy execution failed: ${error.message}`);
    }
})();