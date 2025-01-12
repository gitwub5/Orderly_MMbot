import { AccountClient } from './account.client';
import { MarketClient } from './market.client';
import { OrderClient } from './order.client';
import { PrivateWsClient } from './ws.client';
import * as Interfaces from '../interfaces/response';
import { Account } from '../interfaces';

export class MainClient {
  private accountClient: AccountClient;
  private marketClient: MarketClient;
  private orderClient: OrderClient;
  private privateWsClient? : PrivateWsClient;

  constructor(account: Account, apiUrl: string, wsUrl?: string) {
    this.accountClient = new AccountClient(account, apiUrl);
    this.marketClient = new MarketClient(account, apiUrl);
    this.orderClient = new OrderClient(account, apiUrl);
    if(wsUrl){
      this.privateWsClient = new PrivateWsClient(account, wsUrl);
      this.privateWsClient.connect();
    }
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

  public async getClientTradeHistory(
    symbol?: string,
    size?: number,
    start_t?: number,
    end_t?: number,
    page?: number,
  ): Promise<Interfaces.TradeHistoryResponse> {
    return this.accountClient.getClientTradeHistory(symbol, size, start_t, end_t, page);
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

  public async getKline(
    symbol: string,
    type: string,
    limit?: number
  ): Promise<Interfaces.KlineResponse> {
    return this.marketClient.getKline(symbol, type, limit);
  }

  // Exposing OrderClient methods
  public async placeOrder(
    symbol: string,
    orderType: string,
    side: string,
    price: number | null,
    amount: number,
    option?: RequestInit | undefined
  ): Promise<Interfaces.OrderResponse> {
    return this.orderClient.placeOrder(symbol, orderType, side, price, amount, option);
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

  //Exposing Private Websocket methods
  public async connect() : Promise <void> {
    if(this.privateWsClient){
       return this.privateWsClient?.connect();
    }
  }

  public async disconnect() : Promise <void> {
    if(this.privateWsClient){
      return this.privateWsClient?.disconnect();
    }
  }

  public async setMessageCallback(callback: (message: any) => void){
    if(this.privateWsClient){
      return this.privateWsClient?.setMessageCallback(callback); 
    }
  }

  public async subExecutionReport(): Promise<void> {
    if(this.privateWsClient){
      return this.privateWsClient.subExecutionReport();
    }
  }

  public async unsubExecutionReport(): Promise<void> {
    if(this.privateWsClient){
      return this.privateWsClient.unsubExecutionReport();
    }
  }

  //Main Class methods
  public async getStandardDeviation(
    symbol: string,
    size: number
  ): Promise<number> {
    try {
      // 최근 거래 기록 가져오기 (size 크기만큼)
      const trades = await this.getMarketTrades(symbol, size);

      // 각 거래의 가격들 불러오기 (length: size가 prices.length보다 클 수 있으므로)
      const length = Math.min(size, trades.data.rows.length);
      const prices = trades.data.rows.slice(0, length).map((trade) => trade.executed_price);
      // 각 가격의 평균을 계산
      const mean = prices.reduce((acc, price) => acc + price, 0) / prices.length;
      // 분산 계산
      const variance = prices.reduce((acc, price) => acc + Math.pow(price - mean, 2), 0) / prices.length;
      // 표준편차 계산
      return Math.sqrt(variance);
    } catch (error) {
      throw new Error(`Failed to fetch standard deviation: ${error}`);
    }
  }

  public async getOrderBookSpread(
    symbol: string
  ): Promise<number> {
    try {
      const orderBook = await this.getOrderBook(symbol);
      const bestBid = orderBook.data.bids[0].price;
      const bestAsk = orderBook.data.asks[0].price;
      const spread = bestAsk - bestBid;
      return spread;
    } catch (error) {
      throw new Error(`Failed to fetch order book spread: ${error}`);
    }
  }

  public async getOrderBookMidPrice(
    symbol: string
  ): Promise<number> {
    try {
      const orderBook = await this.getOrderBook(symbol);
      const bestBid = orderBook.data.bids[0].price;
      const bestAsk = orderBook.data.asks[0].price;
      const midPrice = (bestAsk + bestBid) / 2;
      return midPrice;
    } catch (error) {
      throw new Error(`Failed to fetch order book spread: ${error}`);
    }
  }

}
