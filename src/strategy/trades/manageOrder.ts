//현재 걸려있는 주문들 관리
import { MainClient } from '../../client/main.client';
import { OrderResponse } from '../../interfaces';

export class OrderManager {
    private client: MainClient;

    constructor(client: MainClient) {
        this.client = client;
    }

    public async monitorOrder(orderId: number, timeoutMs: number = 60000): Promise<OrderResponse | null> {
        const startTime = Date.now();
        let orderStatus: OrderResponse | null = null;

        while (Date.now() - startTime < timeoutMs) {
            orderStatus = await this.client.getOrderStatus(orderId);
            
            if (orderStatus.data.status === 'FILLED') {
                console.log(`Order ${orderId} has been filled.`);
                return orderStatus; // 주문이 체결됨
            }

            if (orderStatus.data.status === 'CANCELED') {
                console.log(`Order ${orderId} has been canceled.`);
                return null; // 주문이 취소됨
            }

            // 주문이 체결되지 않았으면 일정 시간 대기
            await this.delay(5000); // 5초 간격으로 확인
        }

        // 타임아웃이 발생한 경우
        console.log(`Order ${orderId} did not fill within the timeout period.`);
        return null;
    }

    private async delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}