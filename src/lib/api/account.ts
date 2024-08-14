import { generateWalletSignature, signAndSendRequest } from "./signer";
import { BalanceResponse, OrderResponse } from "../../interfaces";
import { formatDate } from "../../utils/formatDate";
import { RestAPIUrl } from "../../enums";
import { account } from "../../interfaces/account";
import { accountInfo } from "../../utils/account";


//Get the current summary of user token holdings.
//https://orderly.network/docs/build-on-evm/evm-api/restful-api/private/get-current-holding
export async function getCurrentHolding(): Promise<BalanceResponse>{
    try{
        const response = await signAndSendRequest(
            accountInfo.accountId,
            accountInfo.privateKey,
            `${RestAPIUrl.mainnet}/v1/client/holding`
        );
        const json = await response.json();
        return json;
    } catch(error){
        console.error('Error - Get Current Holding :', error);
        throw error;
    }
}

// async function main() {
//     try {
//         const res = await getCurrentHolding();
//         //console.log (res.data);
//         console.log(res.data.holding[0].holding.toFixed(2));
//         console.log(res.data.holding[0].token);
//     } catch (error) {
//         console.error('Error in main function:', error);
//     }
// }
// main().catch(error => {
//   console.error('Unhandled error in main function:', error);
// });

//https://orderly.network/docs/build-on-evm/evm-api/restful-api/private/get-one-position-info
export async function getOnePosition(symbol: string){
    try {
        const response = await signAndSendRequest(
            accountInfo.accountId,
            accountInfo.privateKey,
            `${RestAPIUrl.mainnet}/v1/position/${symbol}`
        );
        const json = await response.json();
        return json;
    } catch(error){
        console.error('Error - Get One Position :', error);
        throw error;
    }
}

// async function main() {
//     try {
//         const res = await getOnePosition('PERP_TON_USDC');
//         console.log(res.data);
//     } catch (error) {
//         console.error('Error in main function:', error);
//     }
// }
// main().catch(error => {
//   console.error('Unhandled error in main function:', error);
// });

//https://orderly.network/docs/build-on-evm/evm-api/restful-api/private/get-one-position-info
export async function getAllPositions(){
    try {
        const response = await signAndSendRequest(
            accountInfo.accountId,
            accountInfo.privateKey,
            `${RestAPIUrl.mainnet}/v1/positions`
        );
        const json = await response.json();
        return json;
    } catch(error){
        console.error('Error - Get One Position :', error);
        throw error;
    }
}

// async function main() {
//     try {
//         const res = await getAllPositions();
//         console.log(res.data.rows);
//     } catch (error) {
//         console.error('Error in main function:', error);
//     }
// }
// main().catch(error => {
//   console.error('Unhandled error in main function:', error);
// });

//모든 Open Orders(의 orderId) 가져오기
//https://orderly.network/docs/build-on-evm/evm-api/restful-api/private/get-orders
export async function getOpenOrders(): Promise<OrderResponse> {
    try{
        const res = await signAndSendRequest(
            accountInfo.accountId,
            accountInfo.privateKey,
        `${RestAPIUrl.mainnet}/v1/orders?status=INCOMPLETE`,
        {
            method : 'GET',
        }
        );
        const json = await res.json();
        return json;
    } catch(error){
        console.error('Error checking orders info:', error);
        throw error;
    }
}

// async function main() {
//     try {
//         const res = await getOpenOrders(accountInfo, RestAPIUrl.mainnet);
//         console.log(res.data);
//     } catch (error) {
//         console.error('Error in main function:', error);
//     }
// }
// main().catch(error => {
//   console.error('Unhandled error in main function:', error);
// });

//Retrieve the historical PnL settlement history of the account.
//PnL 정산 내역 불러오기: 발생한 손익(PnL, Profit and Loss)을 정산한 기록
//문제: PnL settlement를 해야지 됨
export async function getPnLSettleLHis(start_t?: number, end_t?: number) {
    const query: Record<string, any> = {};

    if (start_t !== undefined) {
        query.start_t = start_t;
    }

    if (end_t !== undefined) {
        query.end_t = end_t;
    }

    // Query string 생성
    const queryString = new URLSearchParams(query).toString();
    const url = queryString ? `${RestAPIUrl.mainnet}/v1/pnl_settlement/history/?${queryString}` : `${RestAPIUrl.mainnet}/v1/pnl_settlement/history/`;

    try {
        const res = await signAndSendRequest(
            accountInfo.accountId,
            accountInfo.privateKey,
            url,
            {
                method: 'GET',
            }
        );
        const json = await res.json();
        return json.data;
    } catch (error) {
        console.error('Error checking daily status:', error);
        return null;
    }
}

//Retrieve a nonce used for requesting a withdrawal on Orderly Network. Each nonce can only be used once.
//https://orderly.network/docs/build-on-evm/evm-api/restful-api/private/get-settle-pnl-nonce
//Limit: 10 requests per 1 second
export async function getSettlePnLNonce(){
    try {
        const res = await signAndSendRequest(
            accountInfo.accountId,
            accountInfo.privateKey,
            `${RestAPIUrl.mainnet}/v1/settle_nonce`,
            {
                method: 'GET',
            }
        );
        const json = await res.json();
        return json.data.settle_nonce;
    } catch (error) {
        console.error('Error checking Settle PnL Nonce:', error);
        return null;
    }
}

// verifyingContract should use: 0x6F7a338F2aA472838dEFD3283eB360d4Dff5D203.
// https://orderly.network/docs/build-on-evm/evm-api/restful-api/private/request-pnl-settlement
export async function reqPnLSettlement(){
    try {
        const settle_nonce = await getSettlePnLNonce();
        const message = {
            brokerId: "orderly",
            chainId: 42161,
            timestamp: Date.now(),
            settleNonce: settle_nonce,
        };

        const [walletAddress, signature] = await generateWalletSignature(
            accountInfo.walletPrivateKey,
            message
          );
    
        const body: Record<string, any> = {
            signature: signature,
            userAddress: walletAddress,
            verifyingContract: '0x6F7a338F2aA472838dEFD3283eB360d4Dff5D203',
            message: message
        };

        const response = await signAndSendRequest(
            accountInfo.accountId,
            accountInfo.privateKey,
            `${RestAPIUrl.mainnet}/v1/settle_pnl`,
            {
                method: 'POST',
                body: JSON.stringify(body),
            }
        );

        const json = await response.json();
        return json;
    } catch (error) {
        console.error('Error request PnL settlement:', error);
        return null;
    }
}

// async function main() {
//     try {
//     //   console.log(await getSettlePnLNonce());
//     //   console.log(await getPnLSettleLHis());
//         console.log(await reqPnLSettlement());
//     //  console.log(await getOrderlyPositions('PERP_TON_USDC'))
//     } catch (error) {
//         console.error('Error in main function:', error);
//     }
// }
// main().catch(error => {
//   console.error('Unhandled error in main function:', error);
// });

// https://orderly.network/docs/build-on-evm/evm-api/restful-api/private/get-funding-fee-history
export async function getFundingFeeHis(
    symbol?: string,
    start_t?: number,
    end_t?: number,
    page?: number,
    size?: number
): Promise<any> {
    try {
        // 쿼리 파라미터 객체 생성
        const query: Record<string, string> = {};

        if (symbol !== undefined) {
            query.symbol = symbol;
        }
        if (start_t !== undefined) {
            query.start_t = start_t.toString();
        }
        if (end_t !== undefined) {
            query.end_t = end_t.toString();
        }
        if (page !== undefined) {
            query.page = page.toString();
        }
        if (size !== undefined) {
            query.size = size.toString();
        }

        // Query string 생성
        const queryString = new URLSearchParams(query).toString();
        const url = `${RestAPIUrl.mainnet}/v1/funding_fee/history${queryString ? `?${queryString}` : ''}`;

        const res = await signAndSendRequest(
            accountInfo.accountId,
            accountInfo.privateKey,
            url,
            {
                method: 'GET',
            }
        );
        const json = await res.json();
        return json;
    } catch (error) {
        console.error('Error checking orders info:', error);
        throw error;
    }
}

// https://orderly.network/docs/build-on-evm/evm-api/restful-api/private/get-user-daily-volume
export async function getDailyVolume(
    start_date: string,
    end_date: string
): Promise<any> {
    try {
        // 쿼리 파라미터 객체 생성 (Date Format YYYY-MM-DD)
        const query: Record<string, string> = {
            start_date: start_date,
            end_date: end_date
        };

        // Query string 생성
        const queryString = new URLSearchParams(query).toString();
        const url = `${RestAPIUrl.mainnet}/v1/volume/user/daily${queryString ? `?${queryString}` : ''}`;

        const res = await signAndSendRequest(
            accountInfo.accountId,
            accountInfo.privateKey,
            url,
            {
                method: 'GET',
            }
        );
        const json = await res.json();
        //console.log(json)
        return json;
    } catch (error) {
        console.error('Error checking orders info:', error);
        throw error;
    }
}

// async function main() {
//     try {
//         getDailyVolume('2024-07-31','2024-08-01');
//     } catch (error) {
//         console.error('Error in main function:', error);
//     }
// }
// main().catch(error => {
//   console.error('Unhandled error in main function:', error);
// });

//Get user daily statistics of assets/pnl/volume.
//당일날 데이터는 못 가져옴(입력값 없으면 전날 데이터만 가져옴)
export async function getUserStatics(
    startDate: Date = new Date(new Date().setDate(new Date().getDate() - 1)), 
    endDate: Date = new Date(new Date().setDate(new Date().getDate() - 1))
){
    const query: Record<string, any> = {
        start_date: formatDate(startDate),
        end_date: formatDate(endDate),
    };

    // Query string 생성
    const queryString = new URLSearchParams(query).toString();

    try {
        const res = await signAndSendRequest(
            accountInfo.accountId,
            accountInfo.privateKey,
            `${RestAPIUrl.mainnet}/v1/client/statistics/daily?${queryString}`,
            {
                method: 'GET',
            }
        );
        const json = await res.json();
        return json;
    } catch (error) {
        console.error('Error checking daily status:', error);
        return null;
    }
}

export async function getAccountInfo(): Promise<any> {
    try {
        const url = `${RestAPIUrl.mainnet}/v1/client/info`;

        const res = await signAndSendRequest(
            accountInfo.accountId,
            accountInfo.privateKey,
            url,
            {
                method: 'GET',
            }
        );
        const json = await res.json();
        //console.log(json)
        return json;
    } catch (error) {
        console.error('Error checking orders info:', error);
        throw error;
    }
}

// async function main() {
//     try {
//         const response = await getAccountInfo();
//         console.log(response.data)
//     } catch (error) {
//         console.error('Error in main function:', error);
//     }
// }
// main().catch(error => {
//   console.error('Unhandled error in main function:', error);
// });


//거래 내역 가져오는 함수
async function getClientTradeHistory(
    symbol?: string,
    size?: number,
    start_t?: number,
    end_t?: number,
    page?: number,
  ): Promise<any> {
    try {
      const query: Record<string, any> = {};

      if (symbol) query.symbol = symbol;
      if (start_t) query.start_t = start_t;
      if (end_t) query.end_t = end_t;
      if (page) query.page = page;
      if (size) query.size = size;

      const queryString = new URLSearchParams(query).toString();
      const url = `${RestAPIUrl.mainnet}/v1/trades${
        queryString ? "?" + queryString : ""
      }`;

      const response = await signAndSendRequest(
        accountInfo.accountId,
        accountInfo.privateKey,
        url
      );

      const json = await response.json();
      //console.log('getTradeHistory:', JSON.stringify(json, undefined, 2));
      return json;
    } catch (error) {
      throw new Error(`Error - Get Trade History: ${error}`);
    }
}

// async function calculateTotals(tradeHistory: any[]) {
//     let totalProfitLoss = 0;
//     let totalVolume = 0;
//     const numRows = tradeHistory.length;

//     tradeHistory.forEach(trade => {
//         totalProfitLoss += trade.realized_pnl;
//         totalVolume += trade.executed_quantity * trade.executed_price;
//     });

//     return {
//         totalProfitLoss,
//         totalVolume,
//         numRows
//     };
// }

// async function main() {
//     try {
//         const response = await getClientTradeHistory('PERP_TON_USDC', 150, 1719154800000, 1723086000000);
//         const { totalProfitLoss, totalVolume, numRows } = await calculateTotals(response.data.rows);
//         console.log(`Total Profit/Loss: ${totalProfitLoss}`);
//         console.log(`Total Volume: ${totalVolume}`);
//         console.log(`Number of Rows Processed: ${numRows}`);
//     } catch (error) {
//         console.error('Error in main function:', error);
//     }
// }

// main().catch(error => {
//     console.error('Unhandled error in main function:', error);
// });