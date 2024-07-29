import { MainClient } from '../src/client/main.client';
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
    maxPosition: number; // 최대 포지션 한도
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

// 동적 주문 크기 조정 함수
function adjustPositionSize(baseSize: number, stdDev: number, stdDevThreshold: number): number {
    if (stdDev > stdDevThreshold) {
        // 변동성이 높으면 포지션 크기를 줄임
        return baseSize * 0.8;
    } else {
        return baseSize;
    }
}

// 동적 주문 간격 조정 함수
function adjustOrderSpacing(baseSpacing: number, stdDev: number, stdDevThreshold: number): number {
    if (stdDev > stdDevThreshold) {
        // 변동성이 높으면 주문 간격을 넓힘
        return baseSpacing * 1.2;
    } else {
        return baseSpacing;
    }
}

// 지수 감소 기반 주문 크기 계산 함수
function calculateOrderQuantityExponential(baseQuantity: number, level: number): number {
    const decayFactor = 0.8; // 감소 비율
    const quantity = baseQuantity * Math.pow(decayFactor, level - 1);
    return Math.round(quantity * 10) / 10; // 첫째 자리까지 반올림
}


// 매수 및 매도 주문을 배치하는 함수
async function spreadOrder(client: MainClient, config: StrategyConfig) {
    const { symbol, orderQuantity, stdDevPeriod, orderLevels, orderSpacing, takeProfitRatio, stopLossRatio, gamma, k, maxPosition } = config;

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
    // const T = 1;
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

    // 주문 간격 조정
    const dynamicOrderSpacing = adjustOrderSpacing(orderSpacing, stdDev, 0.003);
    // 주문 수량 조정
    const adjustedOrderQuantity = adjustPositionSize(orderQuantity, stdDev, 0.003);

    console.log('Placing orders...');
    let totalPosition = openPosition; // 현재 포지션 크기
   
    for (let level = 1; level <= orderLevels; level++) {
        const priceOffset = dynamicOrderSpacing * optimalSpread * level;
        let bidPrice = lastPrice - priceOffset;
        let askPrice = lastPrice + priceOffset;
        bidPrice = fixPrecision(bidPrice, 4);
        askPrice = fixPrecision(askPrice, 4);
        const takeProfitPrice = lastPrice * (1 + takeProfitRatio);
        const stopLossPrice = lastPrice * (1 - stopLossRatio);

        const levelOrderQuantity = calculateOrderQuantityExponential(adjustedOrderQuantity, level);
        console.log(`Level ${level} - Bid Price: ${bidPrice}, Ask Price: ${askPrice}, Order Quantity: ${levelOrderQuantity}`);

        if (bidPrice > stopLossPrice && bidPrice < takeProfitPrice && totalPosition + levelOrderQuantity <= maxPosition) {
            if (bidPrice * levelOrderQuantity > 10) {
                console.log(`Placing BUY order - Price: ${bidPrice}, Quantity: ${levelOrderQuantity}`);
                await client.placeOrder(symbol, 'LIMIT', 'BUY', bidPrice, levelOrderQuantity);
                totalPosition += levelOrderQuantity;
            }
        }

        if (askPrice < takeProfitPrice && askPrice > stopLossPrice && totalPosition - levelOrderQuantity >= -maxPosition) {
            if (askPrice * levelOrderQuantity > 10) {
                console.log(`Placing SELL order - Price: ${askPrice}, Quantity: ${levelOrderQuantity}`);
                await client.placeOrder(symbol, 'LIMIT', 'SELL', askPrice, levelOrderQuantity);
                totalPosition -= levelOrderQuantity;
            }
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
        orderQuantity: 8,
        tradePeriodMs: 60000, //1분
        stdDevPeriod: 20,
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