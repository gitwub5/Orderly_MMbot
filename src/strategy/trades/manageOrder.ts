//현재 걸려있는 주문들 관리
import { MainClient } from '../../client/main.client';
import { OrderResponse } from '../../interfaces';
import { StrategyConfig } from '../../interfaces/strategy';

export class OrderManager {
    private client: MainClient;
    private config: StrategyConfig;
    private buyOrders: OrderResponse[];
    private sellOrders: OrderResponse[];

    constructor(client: MainClient, config: StrategyConfig) {
        this.client = client;
        this.config = config;
        this.buyOrders = [];
        this.sellOrders = [];
    }

    public async saveBuyOrder(orderResponse: OrderResponse) {
        this.buyOrders.push(orderResponse);
    }

    public async saveSellOrder(orderResponse: OrderResponse) {
        this.sellOrders.push(orderResponse);
    }

    public async monitorOrder() {
       this.client.setMessageCallback(async (message) => {
              if(message.topic === 'executionreport' && message.data.symbol){
                const data = message.data;
                if(data.status === 'FILLED'){
                    await this.orderFilled(data.side, data.orderId);
                }
                // else if(data.status == 'PARTIAL_FILLED'){

                // }
              }
          });
    }

    private async orderFilled(side: 'BUY' | 'SELL', orderId: number): Promise <void>{
        if (side === 'BUY') {
            await this.removeOrder(orderId, this.buyOrders);
        } else if (side === 'SELL') {
            await this.removeOrder(orderId, this.sellOrders);
        }
    }

    private async removeOrder(orderId: number, orders: OrderResponse[]): Promise<void> {
        const index = orders.findIndex(order => order.data.order_id === orderId);
        if (index !== -1) {
            orders.splice(index, 1);
            console.log(`${orderId} has been removed.`);
        }
    }

    public async getCurrentOrders():Promise< {buyOrders: OrderResponse[], sellOrders: OrderResponse[] }> {
        return {
            buyOrders: this.buyOrders,
            sellOrders: this.sellOrders
        };
    }
}