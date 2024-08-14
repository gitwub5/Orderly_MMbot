import winston from 'winston';
import { PositionResponse } from "../../interfaces/response";
import { MainClient } from "../../client/main.client";
import { StrategyConfig } from "../../interfaces/strategy";
import { fixPrecision } from '../../utils/fixPrecision';
import { MonitorPosition } from './monitorPosition';
import { OrderResponse } from '../../interfaces/response';

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
            await this.client.cancelAllOrders(this.config.symbol);
            if (pnlPercentage > 0.0003) {
                await this.placeMarketOrder(positionQty);
                return;
            }
        }
        else {
            await this.client.cancelAllOrders(this.config.symbol);
            // 손실관리 및 이익실현 관리 단계 수행
            if (pnlPercentage < 0) {
                // 손실관리 - 표준 (0.1% 미만 손실)
                if (Math.abs(pnlPercentage) < 0.01 ) {
                    this.logger.info(`Executing Standard Loss Management`);

                    // 모니터링 시작 (손실관리 후 추가 단계 수행)
                    await this.monitorPosition.monitor(async (updatedPosition, stopMonitoring) => {
                        await this.client.cancelAllOrders(this.config.symbol);
                        await this.placeAskBidOrder(openPosition.data.position_qty);

                        const updatedPnlPercentage = await this.calculatePnLPercentage(updatedPosition);
                        
                        // 손실 관리 또는 이익 실현 조건에 따라 추가 단계 수행
                        if (Math.abs(updatedPnlPercentage) >= 0.01 || updatedPnlPercentage >= 0) {
                            stopMonitoring();  // 모니터링을 종료하고 리스크 관리 재실행
                            await this.executeRiskManagement();
                        }
                    });
                // 손실관리 - 공격적 (0.1% 이상 손실) 
                } else if (Math.abs(pnlPercentage) >= 0.01) {
                    this.logger.info(`Executing Aggressive Loss Management`);
                    //ASKBID 주문을 손실 용으로 따로 만들어서 -> ex> ASK BUY / BID SELL 
                    await this.placeMarketOrder(positionQty);
                }

            } else if (pnlPercentage >= 0) {
                // 이익실현 관리 - 표준  (1% 미만 이익) 
                if (pnlPercentage < 0.1) {
                    this.logger.info(`Executing Standard Profit Taking`);
                    await this.placeLimitOrderToTake(openPosition);

                    // 모니터링 시작 (이익실현 후 추가 단계 수행)
                    let pastPnlPercentage = 0;
                    let pastOrderId = 0;
                    await this.monitorPosition.monitor(async (updatedPosition, stopMonitoring) => {
                        const updatedPnlPercentage = await this.calculatePnLPercentage(updatedPosition);
                        if( pastPnlPercentage < updatedPnlPercentage ){
                            if(pastOrderId !== 0){
                                await this.client.cancelOrder(this.config.symbol, pastOrderId);
                            }
                            const orderResponse = await this.placeAskBidOrder(openPosition.data.position_qty);
                            if(orderResponse){
                                pastOrderId = orderResponse.data.order_id;
                            }
                           
                        }
                        pastPnlPercentage = updatedPnlPercentage;

                        if (updatedPnlPercentage >= 0.1 || updatedPnlPercentage < 0) {
                            stopMonitoring();  // 모니터링을 종료하고 리스크 관리 재실행
                            await this.executeRiskManagement();
                        }
                    });
                // 이익실현 관리 - 공격적 (1% 이상 이익) 
                } else if (pnlPercentage >= 0.1) {
                    this.logger.info(`Executing Aggressive Profit Taking`);
                    await this.placeMarketOrder(positionQty);
                }
            }
        }
    }

    private async placeAskBidOrder(positionQty: number): Promise<OrderResponse | undefined> {
        if (positionQty < 0) {
            this.logger.info(`Placing BID BUY order`);
            return await this.client.placeOrder(this.config.symbol, 'BID', 'BUY', null, -positionQty);
        } else if (positionQty > 0) {
            this.logger.info(`Placing ASK SELL order`);
            return await this.client.placeOrder(this.config.symbol, 'ASK', 'SELL', null, positionQty);
        }
    }

    private async placeMarketOrder(positionQty: number): Promise<OrderResponse | undefined> {
        if (positionQty < 0) {
            this.logger.info(`Placing MARKET BUY order`);
            return await this.client.placeOrder(this.config.symbol, 'MARKET', 'BUY', null, -positionQty, {
                body: JSON.stringify({ reduce_only: true })
            });
            
        } else if (positionQty > 0) {
            this.logger.info(`Placing MARKET SELL order`);
            return await this.client.placeOrder(this.config.symbol, 'MARKET', 'SELL', null, positionQty, {
                body: JSON.stringify({ reduce_only: true })
            });
        }
    }

    private async placeLimitOrderToClose(openPosition: PositionResponse): Promise<OrderResponse | undefined> {
        const positionQty = openPosition.data.position_qty;
        const averageOpenPrice = openPosition.data.average_open_price;
        const maxDeviation = averageOpenPrice * 0.0002;
        //무손실을 위해 MAKER로 들어갔다는 가정하에 수수료만큼의 손실만

        let orderPrice = averageOpenPrice;
        if (positionQty < 0) {
            this.logger.info(`Placing LIMIT BUY order at ${orderPrice}`);
            orderPrice += maxDeviation; // 비싸게 매수해서 탈출
            orderPrice = fixPrecision(orderPrice, this.config.precision);
            return await this.client.placeOrder(this.config.symbol, 'LIMIT', 'BUY', orderPrice, -positionQty);
        } else if (positionQty > 0) {
            this.logger.info(`Placing LIMIT SELL order at ${orderPrice}`);
            orderPrice -= maxDeviation; // 싸게 매도해서 탈출
            orderPrice = fixPrecision(orderPrice, this.config.precision);
            return await this.client.placeOrder(this.config.symbol, 'LIMIT', 'SELL', orderPrice, positionQty);
        }
    }

    private async placeLimitOrderToTake(openPosition: PositionResponse): Promise<OrderResponse | undefined> {
        const positionQty = openPosition.data.position_qty;
        const averageOpenPrice = openPosition.data.average_open_price;
        const maxDeviation = averageOpenPrice * 0.0006;
        //들어갈 때 나올 때 TAKER인 경우 수수료 0.03% + 0.03% 

        let orderPrice = averageOpenPrice;
        if (positionQty < 0) {
            this.logger.info(`Placing LIMIT BUY order at ${orderPrice}`);
            orderPrice -= maxDeviation; // 싸게 매수해서 탈출
            if(orderPrice < openPosition.data.mark_price){
                orderPrice = fixPrecision(orderPrice, this.config.precision);
                return await this.client.placeOrder(this.config.symbol, 'LIMIT', 'BUY', orderPrice, -positionQty);
            }
        } else if (positionQty > 0) {
            this.logger.info(`Placing LIMIT SELL order at ${orderPrice}`);
            orderPrice += maxDeviation; // 비싸게 매도해서 탈출
            if(orderPrice > openPosition.data.mark_price){
                orderPrice = fixPrecision(orderPrice, this.config.precision);
                return await this.client.placeOrder(this.config.symbol, 'LIMIT', 'SELL', orderPrice, positionQty);
            }
        }
    }
}
