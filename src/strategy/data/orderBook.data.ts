import { OrderBookResponse } from "../../interfaces/response";
import { delay } from "../../utils/delay";
import { MainClient } from "../../client/main.client";

interface OrderBookSnapshot {
    timestamp: number;
    orderBook: OrderBookResponse['data'];
}

export async function collectOrderBookData(client: MainClient, symbol: string, duration: number, interval: number): Promise<OrderBookSnapshot[]> {
    return new Promise(async (resolve, reject) => {
        try {
            const snapshots: OrderBookSnapshot[] = [];
            const endTime = Date.now() + duration;

            while (Date.now() < endTime) {
                //오더북 양쪽 10개 레벨 데이터 수집
                const orderBook = await client.getOrderBook(symbol, 15);
                snapshots.push({ timestamp: orderBook.data.timestamp, orderBook: orderBook.data });
                await delay(interval);
            }

            resolve(snapshots);
        } catch (error) {
            reject(error);
        }
    });
}

export function predictPriceMovement(orderBooks: OrderBookSnapshot[]): number {
    let totalBidQuantity = 0;
    let totalAskQuantity = 0;
    let totalWeight = 0;
    const weightDecay = 0.85; // 각 이전 데이터에 대해 가중치를 줄이는 비율

    // 가중치를 고려한 bid와 ask 수량 합계 계산
    orderBooks.forEach((snapshot, index) => {
        const weight = Math.pow(weightDecay, orderBooks.length - index - 1); // 최근 데이터일수록 더 높은 가중치를 부여
        totalBidQuantity += snapshot.orderBook.bids.reduce((total, bid) => total + bid.quantity, 0) * weight;
        totalAskQuantity += snapshot.orderBook.asks.reduce((total, ask) => total + ask.quantity, 0) * weight;
        totalWeight += weight;
    });

    // 가중 평균 계산
    const averageBidQuantity = totalBidQuantity / totalWeight;
    const averageAskQuantity = totalAskQuantity / totalWeight;

    // 총 수량과 각 비율 계산
    const totalQuantity = averageBidQuantity + averageAskQuantity;
    const bidPercentage = (averageBidQuantity / totalQuantity) * 100;
    const askPercentage = (averageAskQuantity / totalQuantity) * 100;

    // 변동성 기준으로 판단하기 위한 차이값 계산
    const bidAskDifference = Math.abs(bidPercentage - askPercentage);

    // 변동성 계산 (예: 표준 편차 기반)
    const volatilityThreshold = calculateVolatilityThreshold(orderBooks);

    console.log(`Weighted Moving Average bid: ${bidPercentage}, ask: ${askPercentage}`);
    console.log(`Bid-Ask Difference: ${bidAskDifference}, Volatility Threshold: ${volatilityThreshold}`);

    // 기준치 이상이면 가격 변동을 예측
    if (bidAskDifference > volatilityThreshold) {
        if (bidPercentage > askPercentage) {
            return 1;  // 가격 상승 가능성
        } else if (askPercentage > bidPercentage) {
            return -1;  // 가격 하락 가능성
        }
    }

    // 기준치 이하이면 변동 없음으로 예측
    return 0;  // 변동 없음 또는 예측 불확실
}

// 변동성 기준치를 계산하는 함수
function calculateVolatilityThreshold(orderBooks: OrderBookSnapshot[]): number {
    const bidAskDifferences = orderBooks.map(snapshot => {
        const totalBid = snapshot.orderBook.bids.reduce((total, bid) => total + bid.quantity, 0);
        const totalAsk = snapshot.orderBook.asks.reduce((total, ask) => total + ask.quantity, 0);
        const total = totalBid + totalAsk;
        const bidPercentage = (totalBid / total) * 100;
        const askPercentage = (totalAsk / total) * 100;
        return Math.abs(bidPercentage - askPercentage);
    });

    // 예를 들어, 표준 편차를 기준으로 변동성 판단
    const mean = bidAskDifferences.reduce((acc, diff) => acc + diff, 0) / bidAskDifferences.length;
    const variance = bidAskDifferences.reduce((acc, diff) => acc + Math.pow(diff - mean, 2), 0) / bidAskDifferences.length;
    return Math.sqrt(variance);
}

