import { BaseClient } from './base.client';
import { account, BalanceResponse, PositionResponse, PositionsResponse, TradeHistoryResponse } from '../interfaces';

export class AccountClient extends BaseClient {
  constructor(account: account, apiUrl: string) {
    super(account, apiUrl);
  }

  private async getCurrentHolding(): Promise<BalanceResponse> {
    try {
      const response = await this.signAndSendRequest(
        this.account.accountId,
        this.account.privateKey,
        `${this.apiUrl}/v1/client/holding`
      );
      const json = await response.json();
      return json;
    } catch (error) {
      throw new Error(`Error - Get Current Holding: ${error}`);
    }
  }

  private async getSettlePnLNonce() {
    try {
      const res = await this.signAndSendRequest(
        this.account.accountId,
        this.account.privateKey,
        `${this.apiUrl}/v1/settle_nonce`,
        {
          method: "GET",
        }
      );
      const json = await res.json();
      return json.data.settle_nonce;
    } catch (error) {
      throw new Error(`Error - Get Settle PnL Nonce: ${error}`);
    }
  }
 
  //TODO: PnL Settlement 함수 구현!
  // export async function reqPnLSettlement(){
//     try {
//         const settle_nonce = await getSettlePnLNonce();
//         const message = {
//             brokerId: "orderly",
//             chainId: 42161,
//             settleNonce: settle_nonce,
//             timestamp: Date.now(),
//         };

//         const [walletAddress, signature] = await signEIP712Message(orderlyAccountInfo.privateKey, message);
        
//         const body: Record<string, any> = {
//             signature: signature,
//             userAddress: walletAddress,
//             verifyingContract: '0x6F7a338F2aA472838dEFD3283eB360d4Dff5D203',
//             message: message
//         };

//         const res = await signAndSendRequest(
//             orderlyAccountInfo.accountId,
//             orderlyAccountInfo.privateKey,
//             `${ORDERLY_API_URL}/v1/settle_pnl`,
//             {
//                 method: 'POST',
//                 body: JSON.stringify(body)
//             }
//         );

//         const json = await res.json();
//         return json;
//     } catch (error) {
//         console.error('Error request PnL settlement:', error);
//         return null;
//     }
// }

  //TODO: 위에 함수들로 Balance값 가져오는 함수 구현
  public async getBalances(): Promise<BalanceResponse> {
    try {
      await this.getSettlePnLNonce();
      await this.reqPnLSettlement();
      return await this.getCurrentHolding();
    } catch (error) {
      throw new Error(`Error - Get Balances: ${error}`);
    }
  }

  //심볼 하나에 대한 포지션 정보
  public async getOnePosition(
    symbol: string
  ): Promise<PositionResponse> {
    try {
      const response = await this.signAndSendRequest(
        this.account.accountId,
        this.account.privateKey,
        `${this.apiUrl}/v1/position/${symbol}`
      );
      const json = await response.json();
       //console.log('cancelOrder:', JSON.stringify(json, undefined, 2));
      return json;
    } catch (error) {
      throw new Error(`Error - Get One Position: ${error}`);
    }
  }

  //계정 전체의 포지션 정보
  public async getAllPositions()
  : Promise<PositionsResponse> {
    try {
      const response = await this.signAndSendRequest(
        this.account.accountId,
        this.account.privateKey,
        `${this.apiUrl}/v1/position/`
      );
      const json = await response.json();
       //console.log('cancelOrder:', JSON.stringify(json, undefined, 2));
      return json;
    } catch (error) {
      throw new Error(`Error - Get All Positions: ${error}`);
    }
  }

  //거래 내역 가져오는 함수
  public async getTradeHistory(
    symbol?: string,
    start_t?: number,
    end_t?: number,
    page?: number,
    size?: number
  ): Promise<TradeHistoryResponse> {
    try {
      const query: Record<string, any> = {};
  
      if (symbol) query.symbol = symbol;
      if (start_t) query.start_t = start_t;
      if (end_t) query.end_t = end_t;
      if (page) query.page = page;
      if (size) query.size = size;
  
      const queryString = new URLSearchParams(query).toString();
      const url = `${this.apiUrl}/v1/trades${queryString ? '?' + queryString : ''}`;
  
      const response = await this.signAndSendRequest(
        this.account.accountId,
        this.account.privateKey,
        url
      );
  
      const json = await response.json();
      // console.log('getTradeHistory:', JSON.stringify(json, undefined, 2));
      return json;
    } catch (error) {
      throw new Error(`Error - Get Trade History: ${error}`);
    }
  }
}