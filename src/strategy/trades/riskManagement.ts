import winston from 'winston';
import { PositionResponse } from "../../interfaces/response";
import { MainClient } from "../../client/main.client";
import { StrategyConfig } from "../../interfaces/strategy";
import { fixPrecision } from '../../utils/fixPrecision';
import { MonitorPosition } from './monitorPosition';

export class RiskManagement {
    private client: MainClient;
    private config: StrategyConfig;
    private logger: winston.Logger;
    private monitorPosition: MonitorPosition;

    constructor(client: MainClient, config: StrategyConfig, logger: winston.Logger) {
        this.client = client;
        this.config = config;
        this.logger = logger;
        this.monitorPosition = new MonitorPosition(client, config.symbol, logger); // 모니터링 클래스 인스턴스 생성
    }

    private async calculatePnLPercentage(openPosition: PositionResponse): Promise<number> {
        const { position_qty, mark_price, average_open_price } = openPosition.data;

        let pnlPercentage = 0;
        if (position_qty > 0) { // Long position
            pnlPercentage = ((mark_price - average_open_price) / average_open_price) * 100;
        } else if (position_qty < 0) { // Short position
            pnlPercentage = ((average_open_price - mark_price) / average_open_price) * 100;
        }

        return pnlPercentage;
    }

    public async executeRiskManagement(): Promise<void> {
        const openPosition = await this.client.getOnePosition(this.config.symbol);
        const positionQty = openPosition.data.position_qty;

        if(positionQty === 0){
            await this.client.cancelAllOrders(this.config.symbol);
            return;
        }

        const pnlPercentage = await this.calculatePnLPercentage(openPosition);

        // 열려있는 포지션이 10달러미만인 경우
        if (Math.abs(openPosition.data.position_qty * openPosition.data.average_open_price) < 10) {
            if (pnlPercentage > 0.0003) {
                await this.placeMarketOrder(positionQty);
                return;
            }
        }
        else {
            // 손실관리 및 이익실현 관리 단계 수행
            if (pnlPercentage < 0) {
                // 손실관리 - 표준 (0.1% 미만 손실)
                if (Math.abs(pnlPercentage) < this.config.stopLossRatio) {
                    this.logger.info(`Executing Standard Loss Management`);
                    await this.client.cancelAllOrders(this.config.symbol);
                    await this.placeLimitOrderToClose(openPosition);

                    // 모니터링 시작 (손실관리 후 추가 단계 수행)
                    await this.monitorPosition.monitor(async (updatedPosition, stopMonitoring) => {
                        const updatedPnlPercentage = await this.calculatePnLPercentage(updatedPosition);
                        // 손실 관리 또는 이익 실현 조건에 따라 추가 단계 수행
                        if (Math.abs(updatedPnlPercentage) >= this.config.stopLossRatio || updatedPnlPercentage >= 0) {
                            stopMonitoring();  // 모니터링을 종료하고 리스크 관리 재실행
                            await this.executeRiskManagement();
                        }
                    });
                // 손실관리 - 공격적 (0.1% 이상 손실) 
                } else if (Math.abs(pnlPercentage) >= this.config.stopLossRatio) {
                    this.logger.info(`Executing Aggressive Loss Management`);
                    await this.client.cancelAllOrders(this.config.symbol);
                    await this.placeMarketOrder(positionQty);
                }
            } else if (pnlPercentage >= 0) {
                // 이익실현 관리 - 표준
                if (Math.abs(pnlPercentage) < this.config.takeProfitRatio) {
                    this.logger.info(`Executing Standard Profit Taking`);
                    await this.client.cancelAllOrders(this.config.symbol);
                    await this.placeLimitOrderToTake(openPosition);

                    // 모니터링 시작 (이익실현 후 추가 단계 수행)
                    await this.monitorPosition.monitor(async (updatedPosition, stopMonitoring) => {
                        const updatedPnlPercentage = await this.calculatePnLPercentage(updatedPosition);
                        if (Math.abs(updatedPnlPercentage) >= this.config.takeProfitRatio || updatedPnlPercentage < 0) {
                            stopMonitoring();  // 모니터링을 종료하고 리스크 관리 재실행
                            await this.executeRiskManagement();
                        }
                    });
                // 이익실현 관리 - 공격적 (1% 이상 이익) 
                } else if (Math.abs(pnlPercentage) >= this.config.takeProfitRatio) {
                    this.logger.info(`Executing Aggressive Profit Taking`);
                    await this.client.cancelAllOrders(this.config.symbol);
                    await this.placeMarketOrder(positionQty);
                }
            }
        }
    }

    private async placeAskBidOrder(positionQty: number): Promise<void> {
        if (positionQty < 0) {
            await this.client.placeOrder(this.config.symbol, 'BID', 'BUY', null, -positionQty);
            this.logger.info(`Placing BID BUY order`);
        } else if (positionQty > 0) {
            await this.client.placeOrder(this.config.symbol, 'ASK', 'SELL', null, positionQty);
            this.logger.info(`Placing ASK SELL order`);
        }
    }

    private async placeMarketOrder(positionQty: number): Promise<void> {
        if (positionQty < 0) {
            await this.client.placeOrder(this.config.symbol, 'MARKET', 'BUY', null, -positionQty, {
                body: JSON.stringify({ reduce_only: true })
            });
            this.logger.info(`Placing MARKET BUY order`);
        } else if (positionQty > 0) {
            await this.client.placeOrder(this.config.symbol, 'MARKET', 'SELL', null, positionQty, {
                body: JSON.stringify({ reduce_only: true })
            });
            this.logger.info(`Placing MARKET SELL order`);
        }
    }

    private async placeLimitOrderToClose(openPosition: PositionResponse): Promise<void> {
        const positionQty = openPosition.data.position_qty;
        const averageOpenPrice = openPosition.data.average_open_price;
        const maxDeviation = averageOpenPrice * 0.0003;

        let orderPrice = averageOpenPrice;
        if (positionQty < 0) {
            orderPrice += maxDeviation; // Increase the price for limit buy
            orderPrice = fixPrecision(orderPrice, this.config.precision);
            await this.client.placeOrder(this.config.symbol, 'LIMIT', 'BUY', orderPrice, -positionQty, {
                body: JSON.stringify({ reduce_only: true, visible_quantity: 0 })
            });
            this.logger.info(`Placing LIMIT BUY order at ${orderPrice}`);
        } else if (positionQty > 0) {
            orderPrice -= maxDeviation; // Decrease the price for limit sell
            orderPrice = fixPrecision(orderPrice, this.config.precision);
            await this.client.placeOrder(this.config.symbol, 'LIMIT', 'SELL', orderPrice, positionQty, {
                body: JSON.stringify({ reduce_only: true, visible_quantity: 0 })
            });
            this.logger.info(`Placing LIMIT SELL order at ${orderPrice}`);
        }
    }

    private async placeLimitOrderToTake(openPosition: PositionResponse): Promise<void> {
        const positionQty = openPosition.data.position_qty;
        const averageOpenPrice = openPosition.data.average_open_price;
        const maxDeviation = averageOpenPrice * 0.0006;

        let orderPrice = averageOpenPrice;
        if (positionQty < 0) {
            orderPrice += maxDeviation; // Increase the price for limit buy
            orderPrice = fixPrecision(orderPrice, this.config.precision);
            await this.client.placeOrder(this.config.symbol, 'LIMIT', 'BUY', orderPrice, -positionQty);
            this.logger.info(`Placing LIMIT BUY order at ${orderPrice}`);
        } else if (positionQty > 0) {
            orderPrice -= maxDeviation; // Decrease the price for limit sell
            orderPrice = fixPrecision(orderPrice, this.config.precision);
            await this.client.placeOrder(this.config.symbol, 'LIMIT', 'SELL', orderPrice, positionQty);
            this.logger.info(`Placing LIMIT SELL order at ${orderPrice}`);
        }
    }
}
