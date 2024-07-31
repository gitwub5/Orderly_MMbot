import { BaseClient } from './base.client';
import { account, MarketInfoResponse, MarketTradeResponse, OrderBookResponse, KlineResponse } from '../interfaces';

export class MarketClient extends BaseClient {
  constructor(account: account, apiUrl: string) {
    super(account, apiUrl);
  }

  //Get basic market information for one trading pair.
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

  //Get the latest market trades.
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

  public async getKline(
    symbol: string,
    type: string,
    limit?: number
  ): Promise<KlineResponse> {
    //type: 1m/5m/15m/30m/1h/4h/12h/1d/1w/1mon/1y
    try {
      const query: Record<string, any> = {
        symbol: symbol,
        type: type,
      };
  
      if (limit) {
        query.limit = limit;
      }
  
      const queryString = new URLSearchParams(query).toString();
      const url = `${this.apiUrl}/v1/kline/${queryString ? '?' + queryString : ''}`;
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


// import { accountInfo } from "../utils/account";
// import { RestAPIUrl } from "../enums";
// async function main() {
//   const client = new MarketClient(accountInfo, RestAPIUrl.mainnet);
//   const trades = await client.getKline('PERP_TON_USDC','1m');
//   const prices = trades.data.rows
//         .slice(0, 10)
//         .map((trade) => trade.close);
//   console.log(trades.data);
//   console.log(prices);
// }
// main();