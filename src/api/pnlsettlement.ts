import fetch from 'node-fetch';
import {signAndSendRequest } from "./signer";
import { accountInfo } from '../utils/account';
import { RestAPIUrl } from '../enums';

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

async function requestPnlSettlement(accountId: string, privateKey: string, apiUrl: string, brokerId: string, chainId: number, userAddress: string) {

    const settleNonce = await getSettlePnLNonce();
    const timestamp = Date.now();

    // Step 2: Create EIP-712 message and sign it
    const message = {
        brokerId: brokerId,
        chainId: chainId,
        settleNonce: settleNonce,
        timestamp: timestamp
    };

    const signature = await signEIP712Message(privateKey, message); // Assuming you have a function to sign messages
    
    // Step 3: Request PnL settlement
    const settlementResponse = await fetch(`${apiUrl}/v1/settle_pnl`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'orderly-timestamp': timestamp.toString(),
            'orderly-account-id': accountId,
            'orderly-key': privateKey,
            'orderly-signature': signature,
        },
        body: JSON.stringify({
            signature: signature,
            userAddress: userAddress,
            verifyingContract: "0x6F7a338F2aA472838dEFD3283eB360d4Dff5D203",
            message: message
        })
    });

    const settlementData = await settlementResponse.json();
    return settlementData;
}

// Function to sign EIP-712 message (implementation depends on your setup)
async function signEIP712Message(privateKey: string, message: any) {
    // Implement your signing logic here
    return "signed_message";
}