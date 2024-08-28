import winston from 'winston'; 
import { MainClient } from "../../client/main.client";
import { PositionResponse } from '../../interfaces';

export class MonitorPosition {
    private client: MainClient;
    private symbol: string;
    private logger: winston.Logger;
    private monitorIntervalId: NodeJS.Timeout | null = null;

    constructor(client: MainClient, symbol: string, logger: winston.Logger) {
        this.client = client;
        this.symbol = symbol;
        this.logger = logger;
    }

    // 인터벌 간격마다 symbol에 대한 포지션 확인
    public async monitor(callback: (updatedPosition: PositionResponse, stopMonitoring: () => void) => Promise<void>): Promise<void> {
        await new Promise<void>((resolve) => {
            this.monitorIntervalId = setInterval(async () => {
                const updatedPosition = await this.client.getOnePosition(this.symbol);

                if (updatedPosition.data.position_qty === 0 ||
                    Math.abs(updatedPosition.data.position_qty * updatedPosition.data.average_open_price) < 10
                ){
                    this.logger.info("All positions closed, stopping monitoring.");
                    this.client.cancelAllOrders(this.symbol);
                    this.stopMonitoring();
                    resolve();
                } else {
                    this.logger.info("Position still open, performing callback...");
                    const stopMonitoring = () => {
                        this.stopMonitoring();
                        resolve();
                    };
                    await callback(updatedPosition, stopMonitoring);
                }
            }, 2000); // N초 간격으로 모니터링
        });
    }

    // 모니터링 중지
    public stopMonitoring() {
        if (this.monitorIntervalId) {
            clearInterval(this.monitorIntervalId);
            this.monitorIntervalId = null;
            this.logger.info("Monitoring stopped.");
        }
    }
}