import { MainClient } from "../../client/main.client";
import { calculateOptimalSpread  } from "../functions/optimalSpread";
import { StrategyConfig } from "../../interfaces/strategy";
import { fixPrecision } from "../../utils/fixPrecision";
import { RiskManagement } from "./riskManagement";
import { delay, delayWithCountdown } from "../../utils/delay";
import { collectOrderBookData, predictPriceMovement } from "../data/orderBook.data";
import { collectTradeData, calculateStandardDeviation, predictMarketDirection } from "../data/trade.data";
import winston from 'winston';

export class SpreadOrder {
    private client: MainClient;
    private config: StrategyConfig;
    private logger: winston.Logger;
    private riskManagement: RiskManagement;

    constructor(client: MainClient, config: StrategyConfig, logger: winston.Logger) {
        this.client = client;
        this.config = config;
        this.logger = logger;
        this.riskManagement = new RiskManagement(client, config, logger);
    }

    private async handleUpPrediction(midPrice: number, stdDev: number, config: StrategyConfig) {
        const { symbol, orderQuantity, orderLevels, orderSpacing, gamma, k, precision, tradePeriodMs } = config;

        this.logger.info('Prediction indicates price is likely to go up.');
        const T = 1;
        const t = 0;
        const optimalSpread = await calculateOptimalSpread(stdDev, T, t, gamma, k);
        this.logger.info(`Optimal spread: ${optimalSpread}`);

        for (let level = 0; level < orderLevels; level++) {
            if (level === 0) {
                const buyPrice = fixPrecision(midPrice, precision);
                await this.client.placeOrder(symbol, 'LIMIT', 'BUY', buyPrice, orderQuantity);
                await this.client.placeOrder(symbol, 'BID', 'BUY', null, orderQuantity, {
                    body: JSON.stringify({ level: level })
                });
            } else {
                const buyPriceOffset = (optimalSpread / 2) * level * orderSpacing;
                const sellPriceOffset = (optimalSpread / 2) * level * orderSpacing;

                const buyPrice = fixPrecision(midPrice - buyPriceOffset, precision);
                const sellPrice = fixPrecision(midPrice + sellPriceOffset, precision);
                
                await this.client.placeOrder(symbol, 'POST_ONLY', 'BUY', buyPrice, orderQuantity, {
                    body: JSON.stringify({ post_only_adjust: false })
                });

                await this.client.placeOrder(symbol, 'POST_ONLY', 'SELL', sellPrice, orderQuantity, {
                    body: JSON.stringify({ post_only_adjust: false })
                });
            }
        }
        await delayWithCountdown(tradePeriodMs, this.logger);
    }

    private async handleDownPrediction(midPrice: number, stdDev: number, config: StrategyConfig) {
        const { symbol, orderQuantity, orderLevels, orderSpacing, gamma, k, precision, tradePeriodMs } = config;

        this.logger.info('Prediction indicates price is likely to go down.');
        const T = 1;
        const t = 0;
        const optimalSpread = await calculateOptimalSpread(stdDev, T, t, gamma, k);
        this.logger.info(`Optimal spread: ${optimalSpread}`);

        for (let level = 0; level < orderLevels; level++) {
            if (level === 0) {
                const sellPrice = fixPrecision(midPrice, precision);
                await this.client.placeOrder(symbol, 'LIMIT', 'SELL', sellPrice, orderQuantity);
                await this.client.placeOrder(symbol, 'ASK', 'SELL', null, orderQuantity, {
                    body: JSON.stringify({ level: level })
                });
            } else {
                const buyPriceOffset = (optimalSpread / 2) * level * orderSpacing;
                const sellPriceOffset = (optimalSpread / 2) * level * orderSpacing;

                const buyPrice = fixPrecision(midPrice - buyPriceOffset, precision);
                const sellPrice = fixPrecision(midPrice + sellPriceOffset, precision);

                await this.client.placeOrder(symbol, 'POST_ONLY', 'BUY', buyPrice, orderQuantity, {
                    body: JSON.stringify({ post_only_adjust: false })
                });

                await this.client.placeOrder(symbol, 'POST_ONLY', 'SELL', sellPrice, orderQuantity, {
                    body: JSON.stringify({ post_only_adjust: false })
                });
            }
        }
        await delayWithCountdown(tradePeriodMs, this.logger);
    }

    private async handleStablePrediction(midPrice: number, stdDev: number, config: StrategyConfig) {
        this.logger.info('Prediction indicates price is likely to remain stable.');

        const { symbol, orderQuantity, orderLevels, orderSpacing, gamma, k, precision, tradePeriodMs } = config;
        const T = 1;
        const t = 0;
        const optimalSpread = await calculateOptimalSpread(stdDev, T, t, gamma, k);
        this.logger.info(`Optimal spread: ${optimalSpread}`);

        for (let level = 0; level < orderLevels; level++) {
            if (level === 0) {
                await this.client.placeOrder(symbol, 'BID', 'BUY', null, orderQuantity, {
                    body: JSON.stringify({ level: level })
                });
                await this.client.placeOrder(symbol, 'ASK', 'SELL', null, orderQuantity, {
                    body: JSON.stringify({ level: level })
                });
            } else {
                const buyPriceOffset = (optimalSpread / 2) * level * orderSpacing;
                const sellPriceOffset = (optimalSpread / 2) * level * orderSpacing;

                let buyPrice = fixPrecision(midPrice - buyPriceOffset, precision);
                let sellPrice = fixPrecision(midPrice + sellPriceOffset, precision);

                await this.client.placeOrder(this.config.symbol, 'POST_ONLY', 'BUY', buyPrice, orderQuantity, {
                    body: JSON.stringify({ post_only_adjust: false })
                });

                await this.client.placeOrder(this.config.symbol, 'POST_ONLY', 'SELL', sellPrice, orderQuantity, {
                    body: JSON.stringify({ post_only_adjust: false })
                });
            }
        }
        await delayWithCountdown(tradePeriodMs, this.logger);
    }

    public async executeSpreadOrder() {
        const openPosition = await this.client.getOnePosition(this.config.symbol);

        if (openPosition.data.position_qty === 0 || Math.abs(openPosition.data.position_qty * openPosition.data.average_open_price) < 10) {
            const duration = 15000;
            const orderBookInterval = 200;
            const tradeInterval = 1000;
            let elapsed = 0; // 경과 시간

            // 오더북 데이터 및 거래 데이터를 백그라운드에서 수집 시작
            const orderBookData = collectOrderBookData(this.client, this.config.symbol, duration, orderBookInterval);
            const tradeData = collectTradeData(this.client, this.config.symbol, duration, tradeInterval);

            while (elapsed < duration) {
                this.logger.info(`Elapsed Time: ${elapsed / 1000} seconds`);
                await delay(1000);
                elapsed += 1000;
            }

            // 백그라운드 데이터 수집 중 다른 작업 수행
            const orderBookSnapshots = await orderBookData;
            const tradeSnapshots = await tradeData;

            // 표준 편차 계산
            const stdDev = calculateStandardDeviation(tradeSnapshots);
            const marketDirectionPrediction = predictMarketDirection(tradeSnapshots);
            this.logger.info(`Market Direction Prediction: ${marketDirectionPrediction > 0 ? 'UP' : marketDirectionPrediction < 0 ? 'DOWN' : 'STABLE'}`);

            // 매수/매도 데이터를 기반으로 시장 방향 예측
            const bestBid = orderBookSnapshots[orderBookSnapshots.length - 1].orderBook.bids[0].price;
            const bestAsk = orderBookSnapshots[orderBookSnapshots.length - 1].orderBook.asks[0].price;
            const midPrice = (bestAsk + bestBid) / 2;

            // 예측 수행 (수집된 오더북 데이터를 기반으로)
            const orderBookPrediction = predictPriceMovement(orderBookSnapshots);
            this.logger.info(`Order Book Prediction: ${orderBookPrediction > 0 ? 'UP' : orderBookPrediction < 0 ? 'DOWN' : 'STABLE'}`);

            // 두 예측을 결합하여 최종 예측 결정
            let prediction;
            if (marketDirectionPrediction === 1) {
                prediction = orderBookPrediction === -1 ? 0 : 1;
            } else if (marketDirectionPrediction === -1) {
                prediction = orderBookPrediction === 1 ? 0 : -1;
            } else {
                prediction = orderBookPrediction;
            }

            this.logger.info(`Final Combined Prediction: ${prediction === 1 ? 'UP' : prediction === -1 ? 'DOWN' : 'STABLE'}`);

            // Prediction에 따라 처리할 함수 호출
            if (prediction === 1) {
                await this.handleUpPrediction(midPrice, stdDev, this.config);
            } else if (prediction === -1) {
                await this.handleDownPrediction(midPrice, stdDev, this.config);
            } else {
                await this.handleStablePrediction(midPrice, stdDev, this.config);
            }
        }

        await this.riskManagement.executeRiskManagement();
    }
}

// body 값에 visible_quantity, reduce_only 추가하면 수수료 rebate가 안됨 -> WHY???????
