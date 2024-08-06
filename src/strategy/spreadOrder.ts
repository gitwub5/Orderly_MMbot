import { MainClient } from "../client/main.client";
import { calculateOptimalSpread, adjustMidPrice, adjustPositionSize, adjustOrderSpacing, calculateOrderQuantity, setBidAskPrices } from "./functions";
import { StrategyConfig } from "./strategyConfig";
import { fixPrecision } from "../utils/fixPrecision";
import { riskManagement } from "./riskManagement";
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
    const {bid, ask} = await client.getOrderBookSpread(symbol);
    const lastPrice = (bid + ask) / 2;
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

// OrderType: ask, bid이랑 level값으로 주문하는 함수
// ASK type order behavior: the order price is guranteed to be the best ask price of the orderbook at the time it gets accepted.
// BID type order behavior: the order price is guranteed to be the best bid price of the orderbook at the time it gets accepted.
// level: Integer value from 0 to 4. This parameter controls wether to present the price of bid0 to bid4 or ask0 to ask4. Only allowed when order_type is BID or ASK.
// https://orderly.network/docs/build-on-evm/evm-api/restful-api/private/create-order
export async function spreadAskBidOrder(client: MainClient, config: StrategyConfig, logger: winston.Logger) {
    const { symbol, orderQuantity, orderLevels, tradePeriodMs } = config;

    logger.info('Canceling all existing orders...');
    await client.cancelAllOrders(symbol);

    const { bid, ask } = await client.getOrderBookSpread(symbol);
    const lastPrice = (bid + ask) / 2;
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

    await delay(10000);

    const interval = setInterval(async () => {
        try {
            const openPosition = await client.getOnePosition(symbol);
            await riskManagement(client, config, logger, openPosition);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
            logger.error(`Error during risk management for ${symbol}: ${errorMessage}`);
        }
    }, 2000);

    // Ensure the interval is cleared after the trade period ends
    setTimeout(() => clearInterval(interval), tradePeriodMs);
}

// 지연 시간을 주기 위한 함수
function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}