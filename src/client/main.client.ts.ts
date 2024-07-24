import { AccountClient } from './user.client';
import { MarketClient } from './market.client';
import { OrderClient } from './order.client';
import * as Interfaces from '../interfaces';

export class MainClient {
  public accountClient: AccountClient;
  public marketClient: MarketClient;
  public orderClient: OrderClient;

  constructor(account: Interfaces.account, apiUrl: string, wsUrl?: string) {
    this.accountClient = new AccountClient(account, apiUrl);
    this.marketClient = new MarketClient(account, apiUrl);
    this.orderClient = new OrderClient(account, apiUrl);
  }

  // Exposing AccountClient methods
  public async getBalances(): Promise<Interfaces.BalanceResponse> {
    return this.accountClient.getBalances();
  }

  public async getOnePosition(
    symbol: string
  ): Promise<Interfaces.PositionResponse> {
    return this.accountClient.getOnePosition(symbol);
  }

  public async getAllPositions(): Promise<Interfaces.PositionsResponse> {
    return this.accountClient.getAllPositions();
  }

  public async getTradeHistory(
    symbol?: string,
    size?: number,
    start_t?: number,
    end_t?: number,
    page?: number,
  ): Promise<Interfaces.TradeHistoryResponse> {
    return this.accountClient.getTradeHistory(symbol, size, start_t, end_t, page);
  }

  // Exposing MarketClient methods
  public async getMarketInfo(
    symbol: string
  ): Promise<Interfaces.MarketInfoResponse> {
    return this.marketClient.getMarketInfo(symbol);
  }

  public async getMarketTrades(
    symbol: string,
    limit?: number
  ): Promise<Interfaces.MarketTradeResponse> {
    return this.marketClient.getMarketTrades(symbol, limit);
  }

  public async getOrderBook(
    symbol: string,
    max_level?: number
  ): Promise<Interfaces.OrderBookResponse> {
    return this.marketClient.getOrderBook(symbol, max_level);
  }

  // Exposing OrderClient methods
  public async placeOrder(
    symbol: string,
    orderType: string,
    side: string,
    price: number,
    amount: number
  ): Promise<Interfaces.OrderResponse> {
    return this.orderClient.placeOrder(symbol, orderType, side, price, amount);
  }

  public async cancelOrder(
    symbol: string,
    orderId: number
  ): Promise<Interfaces.OrderResponse> {
    return this.orderClient.cancelOrder(symbol, orderId);
  }

  public async cancelBatchOrders(
    orderIds: number[]
  ): Promise<Interfaces.OrderResponse> {
    return this.orderClient.cancelBatchOrders(orderIds);
  }

  public async cancelAllOrders(
    symbol: string
  ): Promise<Interfaces.OrderResponse> {
    return this.orderClient.cancelAllOrders(symbol);
  }

  public async getOrderStatus(
    orderId: number
  ): Promise<Interfaces.OrderResponse> {
    return this.orderClient.getOrderStatus(orderId);
  }

  public async getOpenOrders(): Promise<Interfaces.OrderResponse> {
    return this.orderClient.getOpenOrders();
  }

  //Main Class methods
  public async getStandardDeviation(
    symbol: string,
    size: number
  ): Promise<number> {
    try {
      const trades = await this.getTradeHistory(symbol, size);
      const prices = trades.data.rows
        .slice(0, size)
        .map((trade) => trade.executed_price);
      const mean =
        prices.reduce((acc, price) => acc + price, 0) / prices.length;
      const variance =
        prices.reduce((acc, price) => acc + Math.pow(price - mean, 2), 0) /
        prices.length;
      return Math.sqrt(variance);
    } catch (error) {
      throw new Error(`Failed to fetch standard deviation: ${error}`);
    }
  }

  public async getOrderBookSpread(
    symbol: string
  ): Promise<{ bid: number ; ask: number }> {
    try {
      const orderBook = await this.getOrderBook(symbol);
      const bestBid = orderBook.data.bids[0].price;
      const bestAsk = orderBook.data.asks[0].price;
      return { bid: bestBid, ask: bestAsk };
    } catch (error) {
      throw new Error(`Failed to fetch order book spread: ${error}`);
    }
  }
}