import { generateWalletSignature, signAndSendRequest } from "./signer";
import { BalanceResponse, OrderResponse } from "../../interfaces";
import { formatDate } from "../../utils/formatDate";
import { RestAPIUrl } from "../../enums";
import { account } from "../../interfaces/account";
import { accountInfo } from "../../utils/account";


//Get the current summary of user token holdings.
//https://orderly.network/docs/build-on-evm/evm-api/restful-api/private/get-current-holding
export async function getCurrentHolding(account: account, url: string): Promise<BalanceResponse>{
    try{
        const response = await signAndSendRequest(
            account.accountId,
            account.privateKey,
            `${url}/v1/client/holding`
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
//         const res = await getCurrentHolding(accountInfo, RestAPIUrl.mainnet);
//         console.log (res.data);
//         console.log(res.data.holding[0].holding);
//     } catch (error) {
//         console.error('Error in main function:', error);
//     }
// }
// main().catch(error => {
//   console.error('Unhandled error in main function:', error);
// });

//https://orderly.network/docs/build-on-evm/evm-api/restful-api/private/get-one-position-info
export async function getOnePosition(account: account, url: string, symbol: string){
    try {
        const response = await signAndSendRequest(
            account.accountId,
            account.privateKey,
            `${url}/v1/position/${symbol}`
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
//         const res = await getOnePosition(accountInfo, RestAPIUrl.mainnet, 'PERP_TON_USDC');
//         console.log(res.data);
//     } catch (error) {
//         console.error('Error in main function:', error);
//     }
// }
// main().catch(error => {
//   console.error('Unhandled error in main function:', error);
// });

//모든 Open Orders(의 orderId) 가져오기
//https://orderly.network/docs/build-on-evm/evm-api/restful-api/private/get-orders
export async function getOpenOrders(account: account, url: string): Promise<OrderResponse> {
    try{
        const res = await signAndSendRequest(
            account.accountId,
            account.privateKey,
        `${url}/v1/orders?status=INCOMPLETE`,
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

async function main() {
    try {
    //   console.log(await getSettlePnLNonce());
    //   console.log(await getPnLSettleLHis());
        console.log(await reqPnLSettlement());
    //  console.log(await getOrderlyPositions('PERP_TON_USDC'))
    } catch (error) {
        console.error('Error in main function:', error);
    }
}
main().catch(error => {
  console.error('Unhandled error in main function:', error);
});

