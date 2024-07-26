import { MainClient } from '../src/client/main.client.ts';
import { RestAPIUrl } from '../src/enums';
import { accountInfo } from '../src/utils/account';

// 전략 설정을 위한 인터페이스
interface StrategyConfig {
    symbol: string; // 거래할 암호화폐 페어 (예: 'BTC-USD')
    precision: number; // 가격 소수점 자리 수
    orderQuantity: number; // 각 주문의 수량
    tradePeriodMs: number; // 거래 주기, 밀리초 단위 (예: 1분 = 60000 밀리초)
    stdDevPeriod: number; // 표준 편차를 계산할 최근 거래 수 (예: 최근 50번의 거래)
    orderLevels: number; // 주문 레벨 수
    orderSpacing: number; // 주문 간격 비율
    takeProfitRatio: number; // 이익 실현 비율
    stopLossRatio: number; // 손절매 비율
    gamma: number; // 리스크 회피 계수
    k: number; // 시장 조건 관련 상수
}

let startTime: Date;

// 최적 스프레드 계산 함수
function calculateOptimalSpread(stdDev: number, T: number, t: number, gamma: number, k: number): number {
    return gamma * Math.pow(stdDev, 2) * (T - t) + (gamma / k) * Math.log(1 + (gamma / k));
}

// 중립 평균 가격 조정 함수
function adjustMidPrice(lastPrice: number, Q: number, stdDev: number, T: number, t: number, gamma: number): number {
    return lastPrice - Q * gamma * Math.pow(stdDev, 2) * (T - t);
}

// 비드 및 애스크 가격 설정 함수
function setBidAskPrices(neutralPrice: number, priceOffset: number, A: number, B: number): { bidPrice: number, askPrice: number } {
    const askPrice = Math.max(A, neutralPrice + priceOffset);
    const bidPrice = Math.min(B, neutralPrice - priceOffset);
    return { bidPrice, askPrice };
}

// 매수 및 매도 주문을 배치하는 함수
async function spreadOrder(client: MainClient, config: StrategyConfig) {
    const { symbol, orderQuantity, stdDevPeriod, orderLevels, orderSpacing, takeProfitRatio, stopLossRatio, gamma, k } = config;

    console.log('Retrieving market trades...');
    const tickerData = await client.getMarketTrades(symbol);
    console.log('Market trades data:', tickerData);

    console.log('Retrieving open position...');
    const openPosition = (await client.getOnePosition(config.symbol)).data.position_qty;
    console.log('Open position:', openPosition);

    const lastPrice = tickerData.data.rows[0].executed_price;
    console.log('Last executed price:', lastPrice);

    console.log('Calculating standard deviation...');
    const stdDev = await client.getStandardDeviation(symbol, stdDevPeriod);
    console.log('Standard deviation:', stdDev);

    // 방법 #1
    // const T = 1; // 총 거래 시간 (예: 하루를 1로 설정)
    // const t = 0;

    // 방법 #2
    // const T = 1; // 총 거래 시간 (예: 하루를 1로 설정)

    // function getCurrentTimeFraction(): number {
    //     const currentTime = new Date();
    //     const elapsed = (currentTime.getTime() - startTime.getTime()) / 1000; // 경과 시간을 초 단위로 계산
    //     const elapsedDays = elapsed / (24 * 60 * 60); // 경과 시간을 일 단위로 변환
    //     return elapsedDays; // 경과 일수를 반환
    // }
    // const t = getCurrentTimeFraction(); // 현재 시간을 소수점 형태로 설정
    // console.log('Current time fraction:', t);

    // 방법 #3
    const T = 1; // 총 거래 시간 (예: 1시간을 1로 설정)

    function getCurrentTimeFraction(): number {
        const currentTime = new Date();
        const elapsed = (currentTime.getTime() - startTime.getTime()) / 1000; // 경과 시간을 초 단위로 계산
        const elapsedHours = elapsed / (60 * 60); // 경과 시간을 시간 단위로 변환
        return elapsedHours / T; // 경과 시간을 T의 비율로 변환
    }

    function resetStartTime() {
        startTime = new Date();
    }

    let t = getCurrentTimeFraction(); // 현재 시간을 소수점 형태로 설정
    console.log('Current time fraction:', t);

    // 1시간이 지나면 startTime을 재설정
    if (t >= 1) {
        console.log('1시간이 경과했습니다. 거래 시작 시간을 초기화합니다.');
        resetStartTime();
        t = getCurrentTimeFraction();
    }

    console.log('Calculating optimal spread...');
    const optimalSpread = calculateOptimalSpread(stdDev, T, t, gamma, k);
    console.log('Optimal spread:', optimalSpread);

    console.log('Adjusting mid price...');
    const neutralPrice = adjustMidPrice(lastPrice, openPosition, stdDev, T, t, gamma);
    console.log('Neutral price:', neutralPrice);

    console.log('Canceling all existing orders...');
    await client.cancelAllOrders(symbol);

    console.log('Placing orders...');
    for (let level = 1; level <= orderLevels; level++) {
        const priceOffset = optimalSpread * level;
        let { bidPrice, askPrice } = setBidAskPrices(neutralPrice, priceOffset, lastPrice * 0.95, lastPrice * 1.05);

        bidPrice = fixPrecision(bidPrice, 4);
        askPrice = fixPrecision(askPrice, 4);

        console.log(`Level ${level} - Bid Price: ${bidPrice}, Ask Price: ${askPrice}`);

        if (bidPrice > lastPrice * (1 - stopLossRatio) && bidPrice < lastPrice * (1 + takeProfitRatio)) {
            console.log(`Placing BUY order - Price: ${bidPrice}, Quantity: ${orderQuantity}`);
            await client.placeOrder(symbol, 'LIMIT', 'BUY', bidPrice, orderQuantity);
        }

        if (askPrice < lastPrice * (1 + takeProfitRatio) && askPrice > lastPrice * (1 - stopLossRatio)) {
            console.log(`Placing SELL order - Price: ${askPrice}, Quantity: ${orderQuantity}`);
            await client.placeOrder(symbol, 'LIMIT', 'SELL', askPrice, orderQuantity);
        }
    }
}

// 오더북을 채우는 함수
async function fillOrderBook(client: MainClient, config: StrategyConfig) {
    const { symbol, orderQuantity, orderLevels, orderSpacing } = config;

    console.log('Retrieving market trades...');
    const tickerData = await client.getMarketTrades(symbol);
    console.log('Market trades data:', tickerData);

    const lastPrice = tickerData.data.rows[0].executed_price;
    console.log('Last executed price:', lastPrice);

    console.log('Canceling all existing orders...');
    await client.cancelAllOrders(symbol);

    console.log('Placing orders...');
    for (let level = 1; level <= orderLevels; level++) {
        const priceOffset = lastPrice * orderSpacing * level;
        let buyPrice = lastPrice - priceOffset;
        let sellPrice = lastPrice + priceOffset;

        buyPrice = fixPrecision(buyPrice, 4);
        sellPrice = fixPrecision(sellPrice, 4);

        console.log(`Level ${level} - Buy Price: ${buyPrice}, Sell Price: ${sellPrice}`);

        if (buyPrice < lastPrice * 0.95) {
            console.log(`Placing BUY order - Price: ${buyPrice}, Quantity: ${orderQuantity}`);
            await client.placeOrder(symbol, 'LIMIT', 'BUY', buyPrice, orderQuantity);
        }

        if (sellPrice > lastPrice * 1.05) {
            console.log(`Placing SELL order - Price: ${sellPrice}, Quantity: ${orderQuantity}`);
            await client.placeOrder(symbol, 'LIMIT', 'SELL', sellPrice, orderQuantity);
        }
    }
}

function fixPrecision(value: number, precision: number): number {
    const factor = Math.pow(10, precision);
    return Math.round(value * factor) / factor;
}

// 모든 주문 취소 및 포지션 청산 함수
async function cancelAllOrdersAndClosePositions(client: MainClient, symbol: string) {
    try {
        console.log('Canceling all orders...');
        await client.cancelAllOrders(symbol);

        console.log('Closing all positions...');
        const position = (await client.getOnePosition(symbol)).data;
        if (position.position_qty !== 0) {
            const side = position.position_qty > 0 ? 'SELL' : 'BUY';
            console.log(`Closing position - Side: ${side}, Quantity: ${Math.abs(position.position_qty)}`);
            await client.placeOrder(symbol, 'MARKET', side, null, Math.abs(position.position_qty));
        }

        console.log('All orders cancelled and positions closed.');
    } catch (error) {
        console.error('Failed to cancel orders and close positions:', error);
    }
}

// 지연 시간을 주기 위한 함수
function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 전략 실행 함수
async function executeStrategy() {
    // 클라이언트 인스턴스 생성
    const client = new MainClient(accountInfo, RestAPIUrl.mainnet);

    // 전략 설정
    const config: StrategyConfig = {
        symbol: 'PERP_TON_USDC',
        precision: 4,
        orderQuantity: 2,
        tradePeriodMs: 45000, //45초
        stdDevPeriod: 20,
        orderLevels: 5,
        orderSpacing: 0.01,
        takeProfitRatio: 0.03,
        stopLossRatio: 0.01,
        gamma: 0.08,
        k: 2
    };

    const { tradePeriodMs, symbol } = config;

     // 프로그램 실행 시간을 거래 시작 시간으로 설정
     startTime = new Date();

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