import { MainClient } from "../../client/main.client";
import { MarketTradeResponse } from "../../interfaces/response";
import { delay } from "../../utils/delay";

interface TradeSnapshot {
    timestamp: number;
    buyOrders: { price: number; quantity: number }[];
    sellOrders: { price: number; quantity: number }[];
}

export function collectTradeData(client: MainClient, symbol: string, duration: number, interval: number): Promise<TradeSnapshot[]> {
    return new Promise(async (resolve, reject) => {
        try {
            const snapshots: TradeSnapshot[] = [];
            const startTime = Date.now();  // 데이터 수집 시작 시점의 타임스탬프
            const endTime = startTime + duration;
            const seenTimestamps = new Set<number>(); // 이미 처리된 거래의 timestamp를 추적

            while (Date.now() < endTime) {
                const trades: MarketTradeResponse = await client.getMarketTrades(symbol, 15); // 15개의 거래 기록을 가져옴

                trades.data.rows.forEach(trade => {
                    const { executed_timestamp, executed_price, executed_quantity, side } = trade;

                    // 수집 시작 시점 이후의 거래만 처리
                    if (executed_timestamp >= startTime && !seenTimestamps.has(executed_timestamp)) {
                        seenTimestamps.add(executed_timestamp);

                        let snapshot = snapshots.find(snap => snap.timestamp === executed_timestamp);
                        if (!snapshot) {
                            snapshot = { timestamp: executed_timestamp, buyOrders: [], sellOrders: [] };
                            snapshots.push(snapshot);
                        }

                        if (side === "BUY") {
                            snapshot.buyOrders.push({ price: executed_price, quantity: executed_quantity });
                        } else if (side === "SELL") {
                            snapshot.sellOrders.push({ price: executed_price, quantity: executed_quantity });
                        }
                    }
                });

                await delay(interval);
            }

            resolve(snapshots);
        } catch (error) {
            reject(error);
        }
    });
}

// 표준 편차 계산 함수 (전체 거래 데이터를 사용)
export function calculateStandardDeviation(snapshots: TradeSnapshot[]): number {
    const prices = snapshots.flatMap(snapshot => [...snapshot.buyOrders, ...snapshot.sellOrders].map(order => order.price));

    if (prices.length === 0) {
        throw new Error("No valid prices available to calculate standard deviation.");
    }

    const mean = prices.reduce((acc, price) => acc + price, 0) / prices.length;
    const variance = prices.reduce((acc, price) => acc + Math.pow(price - mean, 2), 0) / prices.length;
    return Math.sqrt(variance);
}

// 시장 방향 예측 함수 (매수/매도 데이터를 구분하여 사용)
export function predictMarketDirection(snapshots: TradeSnapshot[]): number {
    let totalBuyVolume = 0;
    let totalSellVolume = 0;
    let totalBuyValue = 0;
    let totalSellValue = 0;

    snapshots.forEach(snapshot => {
        snapshot.buyOrders.forEach(order => {
            totalBuyVolume += order.quantity;
            totalBuyValue += order.price * order.quantity;
        });

        snapshot.sellOrders.forEach(order => {
            totalSellVolume += order.quantity;
            totalSellValue += order.price * order.quantity;
        });
    });

    const averageBuyPrice = totalBuyValue / totalBuyVolume;
    const averageSellPrice = totalSellValue / totalSellVolume;

    console.log(`Total Buy Volume: ${totalBuyVolume}, Total Sell Volume: ${totalSellVolume}`);
    console.log(`Average Buy Price: ${averageBuyPrice}, Average Sell Price: ${averageSellPrice}`);

    if (totalBuyVolume > totalSellVolume && averageBuyPrice > averageSellPrice) {
        return 1;  // 시장 상승 예측
    } else if (totalSellVolume > totalBuyVolume && averageSellPrice > averageBuyPrice) {
        return -1;  // 시장 하락 예측
    } else {
        return 0;  // 시장 안정 또는 변동 없음
    }
}