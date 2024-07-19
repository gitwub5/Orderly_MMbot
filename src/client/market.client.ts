import { BaseClient } from './base.client';
import { account, MarketInfoResponse, MarketTradeResponse, OrderBookResponse } from '../interfaces';

export class MarketClient extends BaseClient {
  constructor(account: account, apiUrl: string) {
    super(account, apiUrl);
  }

  public async getMarketInfo(symbol: string): Promise<MarketInfoResponse> {
    try {
      const response = await this.signAndSendRequest(
        this.account.accountId,
        this.account.privateKey,
        `${this.apiUrl}/v1/public/futures/${symbol}`
      );
      const json = await response.json();
      // console.log('getMarketTrades:', JSON.stringify(json, undefined, 2));
      return json;
    } catch (error) {
      throw new Error(`Error - Get Market Info: ${error}`);
    }
  }

  //public async getTicker(symbol: string): Promise<TickerResponse> => getMarketTrades로 구현
  //Problem: 실시간 ticker 구현하려면 ws 이용해야함
  public async getMarketTrades(
    symbol: string,
    limit?: number
  ): Promise<MarketTradeResponse> {
    try {
      const query: Record<string, any> = {
        symbol: symbol,
      };

      if (limit) query.limit = limit;

      const queryString = new URLSearchParams(query).toString();
      const response = await this.signAndSendRequest(
        this.account.accountId,
        this.account.privateKey,
        `${this.apiUrl}/v1/public/market_trades?${queryString}`
      );

      const json = await response.json();
      // console.log('getMarketTrades:', JSON.stringify(json, undefined, 2));
      return json;
    } catch (error) {
      throw new Error(`Error - Get Market Trades: ${error}`);
    }
  }

  public async getOrderBook(
    symbol: string,
    max_level?: number
  ): Promise<OrderBookResponse> {
    try {
      const query: Record<string, any> = {};
  
      if (max_level) {
        query.max_level = max_level;
      }
  
      const queryString = new URLSearchParams(query).toString();
      const url = `${this.apiUrl}/v1/orderbook/${symbol}${queryString ? '?' + queryString : ''}`;
      const response = await this.signAndSendRequest(
        this.account.accountId,
        this.account.privateKey,
        url
      );
  
      const json = await response.json();
      // console.log('getOrderBook:', JSON.stringify(json, undefined, 2));
      return json;
    } catch (error) {
      throw new Error(`Error - Get OrderBook: ${error}`);
    }
  }
}