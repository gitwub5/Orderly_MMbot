// import axios, { AxiosInstance, AxiosResponse } from 'axios';
// import { RestAPIUrl } from './enums';

// interface OrderResponse {
//     success: boolean;
//     id: string;
//     [key: string]: any;
// }

// interface BalanceResponse {
//     success: boolean;
//     balances: {
//         [currency: string]: {
//             available: string;
//             total: string;
//         };
//     };
// }

// interface TickerResponse {
//     success: boolean;
//     ticker: {
//         bid: string;
//         ask: string;
//         last: string;
//         [key: string]: any;
//     };
// }

// interface TradeHistoryResponse {
//     success: boolean;
//     trades: {
//         id: string;
//         symbol: string;
//         price: string;
//         quantity: string;
//         side: 'buy' | 'sell';
//         timestamp: string;
//         [key: string]: any;
//     }[];
// }

// interface OrderBookResponse {
//     success: boolean;
//     orderBook: {
//         bids: {
//             price: string;
//             quantity: string;
//         }[];
//         asks: {
//             price: string;
//             quantity: string;
//         }[];
//     };
// }

// interface PositionResponse {
//     success: boolean;
//     position: {
//         id: string;
//         symbol: string;
//         type: string;
//         status: string;
//         amount: number;
//         price: number;
//     };
// }
// class Client {
//     private client: AxiosInstance;

//     constructor(baseURL: RestAPIUrl, apiKey: string, apiSecret: string) {
//         //make client
//     }

    // public async placeOrder(symbol: string, side: 'buy' | 'sell', quantity: string, price: string): Promise<OrderResponse> {
    //     try {
    //         const response: AxiosResponse<OrderResponse> = await this.client.post('/order', {
    //             symbol,
    //             side,
    //             quantity,
    //             price,
    //         });
    //         return response.data;
    //     } catch (error) {
    //         throw new Error(`Failed to place order: ${error}`);
    //     }
    // }

    // public async getBalances(): Promise<BalanceResponse> {
    //     try {
    //         const response: AxiosResponse<BalanceResponse> = await this.client.get('/balance');
    //         return response.data;
    //     } catch (error) {
    //         throw new Error(`Failed to fetch balances: ${error}`);
    //     }
    // }

    // public async getTicker(symbol: string): Promise<TickerResponse> {
    //     try {
    //         const response: AxiosResponse<TickerResponse> = await this.client.get(`/ticker/${symbol}`);
    //         return response.data;
    //     } catch (error) {
    //         throw new Error(`Failed to fetch ticker: ${error}`);
    //     }
    // }

    // public async cancelOrder(orderId: string): Promise<OrderResponse> {
    //     try {
    //         const response: AxiosResponse<OrderResponse> = await this.client.delete(`/order/${orderId}`);
    //         return response.data;
    //     } catch (error) {
    //         throw new Error(`Failed to cancel order: ${error}`);
    //     }
    // }

    // public async getOrderStatus(orderId: string): Promise<OrderResponse> {
    //     try {
    //         const response: AxiosResponse<OrderResponse> = await this.client.get(`/order/${orderId}`);
    //         return response.data;
    //     } catch (error) {
    //         throw new Error(`Failed to fetch order status: ${error}`);
    //     }
    // }

    // public async getTradeHistory(symbol: string): Promise<TradeHistoryResponse> {
    //     try {
    //         const response: AxiosResponse<TradeHistoryResponse> = await this.client.get(`/trades/${symbol}`);
    //         return response.data;
    //     } catch (error) {
    //         throw new Error(`Failed to fetch trade history: ${error}`);
    //     }
    // }

    // public async getOrderBook(symbol: string): Promise<OrderBookResponse> {
    //     try {
    //         const response: AxiosResponse<OrderBookResponse> = await this.client.get(`/orderbook/${symbol}`);
    //         return response.data;
    //     } catch (error) {
    //         throw new Error(`Failed to fetch order book: ${error}`);
    //     }
    // }

    // public async getOpenPosition(): Promise<PositionResponse> {
    //     try {
    //         const response: AxiosResponse<PositionResponse> = await this.client.get(`/position/`);
    //         return response.data;
    //     } catch (error) {
    //         throw new Error(`Failed to fetch open position: ${error}`);
    //     }
    // }

    // public async getOpenOrders(): Promise<OrderResponse> {
    //     try {
    //         const response: AxiosResponse<OrderResponse> = await this.client.get(`/openOrder/`);
    //         return response.data;
    //     } catch (error) {
    //         throw new Error(`Failed to fetch open order: ${error}`);
    //     }
    // }

    // public async getStandardDeviation(symbol: string, period: number): Promise<number> {
    //     try {
    //         const trades = await this.getTradeHistory(symbol);
    //         const prices = trades.trades.slice(0, period).map(trade => parseFloat(trade.price));
    //         const mean = prices.reduce((acc, price) => acc + price, 0) / prices.length;
    //         const variance = prices.reduce((acc, price) => acc + Math.pow(price - mean, 2), 0) / prices.length;
    //         return Math.sqrt(variance);
    //     } catch (error) {
    //         throw new Error(`Failed to fetch standard deviation: ${error}`);
    //     }
    // }

    // public async getOrderBookSpread(symbol: string): Promise<{ bid: string, ask: string }> {
    //     try {
    //         const orderBook = await this.getOrderBook(symbol);
    //         const bestBid = orderBook.orderBook.bids[0].price;
    //         const bestAsk = orderBook.orderBook.asks[0].price;
    //         return { bid: bestBid, ask: bestAsk };
    //     } catch (error) {
    //         throw new Error(`Failed to fetch order book spread: ${error}`);
    //     }
    // }
// }

// export default cexClient;
