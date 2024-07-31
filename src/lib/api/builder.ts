import { generateWalletSignature, signAndSendRequest } from "./signer";
import { BalanceResponse, OrderResponse } from "../../interfaces";
import { formatDate } from "../../utils/formatDate";
import { RestAPIUrl } from "../../enums";
import { account } from "../../interfaces/account";
import { accountInfo } from "../../utils/account";

export async function getBuildersUsersVolume(
    start_date: string,
    end_date: string,
    page?: number,
    size?: number,
    address?: string,
    order_tag?: string,
    aggregateBy?: string,
    sort?: string
): Promise<any> {
    try {
        // 쿼리 파라미터 객체 생성 (Date Format YYYY-MM-DD)
        const query: Record<string, string> = {
            start_date: start_date,
            end_date: end_date
        };

        // Query string 생성
        const queryString = new URLSearchParams(query).toString();
        const url = `${RestAPIUrl.mainnet}/v1/volume/broker/daily${queryString ? `?${queryString}` : ''}`;

        const res = await signAndSendRequest(
            accountInfo.accountId,
            accountInfo.privateKey,
            url,
            {
                method: 'GET',
            }
        );
        const json = await res.json();
        console.log(json.data.rows)
        return json;
    } catch (error) {
        console.error('Error checking orders info:', error);
        throw error;
    }
}

//https://orderly.network/docs/build-on-evm/evm-api/restful-api/public/get-campaign-ranking
//https://orderly.network/docs/build-on-evm/evm-api/restful-api/private/get-referral-rebate-summary

//https://orderly.network/docs/build-on-evm/evm-api/restful-api/public/get-users-points
export async function getUsersPoints(
    address: string
): Promise<any> {
    try {
        // 쿼리 파라미터 객체 생성 (Date Format YYYY-MM-DD)
        const query: Record<string, string> = {
            address: address
        };

        // Query string 생성
        const queryString = new URLSearchParams(query).toString();
        const url = `${RestAPIUrl.mainnet}/v1/client/points${queryString ? `?${queryString}` : ''}`;

        const res = await signAndSendRequest(
            accountInfo.accountId,
            accountInfo.privateKey,
            url,
            {
                method: 'GET',
            }
        );
        const json = await res.json();
        //console.log(json.data);
        return json;
    } catch (error) {
        console.error('Error checking orders info:', error);
        throw error;
    }
}

// async function main() {
//     try {
//         //getBuildersUsersVolume('2024-07-29','2024-07-31');
//         getUsersPoints(accountInfo.walletAddress);
//     } catch (error) {
//         console.error('Error in main function:', error);
//     }
// }
// main().catch(error => {
//   console.error('Unhandled error in main function:', error);
// });