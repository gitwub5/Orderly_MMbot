import { MainClient } from "../../client/main.client";
import { calculateOptimalSpread  } from "../functions/optimalSpread";
import { StrategyConfig } from "../../interfaces/strategy";
import { fixPrecision } from "../../utils/fixPrecision";
import { RiskManagement } from "./riskManagement";
import { delay, delayWithCountdown } from "../../utils/delay";
import { collectOrderBookData, predictPriceMovement } from "../data/orderBook.data";
import { collectTradeData, calculateStandardDeviation, predictMarketDirection } from "../data/trade.data";
import winston from 'winston';
import { OrderManager } from "./manageOrder";

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

    // 가격 상승을 예측한 경우
    private async handleUpPrediction(midPrice: number, stdDev: number, config: StrategyConfig) {
        const { symbol, orderQuantity, orderLevels, orderSpacing, gamma, k, precision, tradePeriodMs } = config;

        this.logger.info('Prediction indicates price is likely to go up.');
        // T와 t는 시작한 시간을 기준으로 시간대별 전략을 넣기 위해 존재하는 변수 (사용하지 않고 있어 T=1,t=0으로 처리하고 계산 중)
        const T = 1;
        const t = 0;
        // 최적 스프레드 값 구하기
        const optimalSpread = await calculateOptimalSpread(stdDev, T, t, gamma, k);
        this.logger.info(`Optimal spread: ${optimalSpread}`);
        

        for (let level = 0; level < orderLevels; level++) {
            // level이 0일 때는 오더북 level 0과 1에 매수(BID) 주문 
            if (level === 0) {
                await this.client.placeOrder(symbol, 'BID', 'BUY', null, orderQuantity, {
                    body: JSON.stringify({ level: level })
                });
                await this.client.placeOrder(symbol, 'BID', 'BUY', null, orderQuantity, {
                    body: JSON.stringify({ level: level + 1 })
                });
            } 
            // level이 0이 아닌 경우 최적 스프레드 값만큼 멀리 매수 매도 주문
            else {
                const priceOffset = (optimalSpread / 2) * level * orderSpacing;

                const buyPrice = fixPrecision(midPrice - priceOffset, precision);
                const sellPrice = fixPrecision(midPrice + priceOffset, precision);
                
                await this.client.placeOrder(symbol, 'POST_ONLY', 'BUY', buyPrice, orderQuantity, {
                    body: JSON.stringify({ post_only_adjust: false }) //post_only_adjust - false인 경우: 지정가 주문이 시장가로 체결되는 가격일 시에 주문 x
                });

                await this.client.placeOrder(symbol, 'POST_ONLY', 'SELL', sellPrice, orderQuantity, {
                    body: JSON.stringify({ post_only_adjust: false })
                });
            }
        }
        // tradePeriodMs 인터벌만큼 주문 체결 대기
        // 카운트다운 로그 없는 delay 함수로 변경 가능 -> await delay(tradePeriodMs)
        await delayWithCountdown(tradePeriodMs, this.logger);
    }

    // 가격 하락을 예측한 경우
    private async handleDownPrediction(midPrice: number, stdDev: number, config: StrategyConfig) {
        const { symbol, orderQuantity, orderLevels, orderSpacing, gamma, k, precision, tradePeriodMs } = config;

        this.logger.info('Prediction indicates price is likely to go down.');
        const T = 1;
        const t = 0;
        const optimalSpread = await calculateOptimalSpread(stdDev, T, t, gamma, k);
        this.logger.info(`Optimal spread: ${optimalSpread}`);

        for (let level = 0; level < orderLevels; level++) {
            // level이 0일 때는 오더북 level 0과 1에 매도(ASK) 주문 
            if (level === 0) {
                await this.client.placeOrder(symbol, 'ASK', 'SELL', null, orderQuantity, {
                    body: JSON.stringify({ level: level })
                });
                await this.client.placeOrder(symbol, 'ASK', 'SELL', null, orderQuantity, {
                    body: JSON.stringify({ level: level + 1})
                });
            } 
            // level이 0이 아닌 경우 최적 스프레드 값만큼 멀리 매수 매도 주문
            else {
                const priceOffset = (optimalSpread / 2) * level * orderSpacing;

                const buyPrice = fixPrecision(midPrice - priceOffset, precision);
                const sellPrice = fixPrecision(midPrice + priceOffset, precision);

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

    // 가격 예측이 확실하지 않은 경우, 또는 가격 변화가 크지 않을 경우
    private async handleStablePrediction(midPrice: number, stdDev: number, config: StrategyConfig) {
        this.logger.info('Prediction indicates price is likely to remain stable.');

        const { symbol, orderQuantity, orderLevels, orderSpacing, gamma, k, precision, tradePeriodMs } = config;
        const T = 1;
        const t = 0;
        const optimalSpread = await calculateOptimalSpread(stdDev, T, t, gamma, k);
        this.logger.info(`Optimal spread: ${optimalSpread}`);

        // 최적의 스프레드만큼 지정가 주문 (POST_ONLY)
        for (let level = 0; level < orderLevels; level++) {
            const priceOffset = (optimalSpread / 2) * level * orderSpacing;

            let buyPrice = fixPrecision(midPrice - priceOffset, precision);
            let sellPrice = fixPrecision(midPrice + priceOffset, precision);

            await this.client.placeOrder(symbol, 'POST_ONLY', 'BUY', buyPrice, orderQuantity, {
                body: JSON.stringify({ post_only_adjust: false })
            });

            await this.client.placeOrder(symbol, 'POST_ONLY', 'SELL', sellPrice, orderQuantity, {
                body: JSON.stringify({ post_only_adjust: false })
            });
        }
        await delayWithCountdown(tradePeriodMs, this.logger);
    }

    public async executeSpreadOrder() {
        const orderManager = new OrderManager(this.client, this.config);
        const openPosition = await this.client.getOnePosition(this.config.symbol);

        if (openPosition.data.position_qty === 0 || Math.abs(openPosition.data.position_qty * openPosition.data.average_open_price) < 10) {
            // 데이터 수집 주기는 예측 범위에 따라 상이하게 설정
            const duration = 15000; // 데이터 수집 주기 (현재 15초 동안 수집) 
            const orderBookInterval = 200; // 오더북 데이터 수집 주기 (0.2초 간격으로 15초 동안 수집 -> 75개의 오더북 스냅샷)
            const tradeInterval = 1000; // 거래 기록 수집 주기 (1초 간격으로 15초 동안 수집)
            let elapsed = 0; // 경과 시간 카운트 변수

            // 오더북 데이터 및 거래 데이터를 백그라운드에서 수집 시작
            const orderBookData = collectOrderBookData(this.client, this.config.symbol, duration, orderBookInterval);
            const tradeData = collectTradeData(this.client, this.config.symbol, duration, tradeInterval);

            while (elapsed < duration) {
                this.logger.info(`Elapsed Time: ${elapsed / 1000} seconds`);
                await delay(5000);
                elapsed += 5000;
            }

            // 백그라운드 데이터 수집 중 다른 작업 수행
            const orderBookSnapshots = await orderBookData;
            const tradeSnapshots = await tradeData;

            // 표준 편차 계산
            const stdDev = calculateStandardDeviation(tradeSnapshots);
            // 거래 기록 기반 예측 
            const marketDirectionPrediction = predictMarketDirection(tradeSnapshots);
            this.logger.info(`Market Direction Prediction: ${marketDirectionPrediction > 0 ? 'UP' : marketDirectionPrediction < 0 ? 'DOWN' : 'STABLE'}`);

            // 가장 최근의 오더북 기준으로 중립값 도출
            const bestBid = orderBookSnapshots[orderBookSnapshots.length - 1].orderBook.bids[0].price;
            const bestAsk = orderBookSnapshots[orderBookSnapshots.length - 1].orderBook.asks[0].price;
            const midPrice = (bestAsk + bestBid) / 2;

            // 오더북 기록 기반 예측
            const orderBookPrediction = predictPriceMovement(orderBookSnapshots);
            this.logger.info(`Order Book Prediction: ${orderBookPrediction > 0 ? 'UP' : orderBookPrediction < 0 ? 'DOWN' : 'STABLE'}`);

            // 두 예측을 결합하여 최종 예측 결정 
            // 거래 기록 예측이 오더북 기록 예측보다 항상 우선순위가 높음 (거래 기록 예측과 오더북 기록 예측이 반대가 되지 않는다면 항상 거래 기록 예측이 우선)
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
        await orderManager.monitorOrder();
        await this.riskManagement.executeRiskManagement();
    }
}

// body 값에 visible_quantity, reduce_only 추가하면 수수료 rebate가 안됨 -> WHY???????
