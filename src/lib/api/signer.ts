import { ed25519 } from '@noble/curves/ed25519';
import { encodeBase58, ethers } from 'ethers';
import { webcrypto } from 'node:crypto';
import { getMessage, encodeType } from 'eip-712';
import { accountInfo } from '../../utils/account';

export async function signAndSendRequest(
  orderlyAccountId: string,
  privateKey: Uint8Array | string,
  input: URL | string,
  init?: RequestInit | undefined
): Promise<Response> {
  const timestamp = Date.now();
  const encoder = new TextEncoder();

  const url = new URL(input);
  let message = `${String(timestamp)}${init?.method ?? 'GET'}${url.pathname}${url.search}`;
  if (init?.body) {
    message += init.body;
  }
  const orderlySignature = await ed25519.sign(encoder.encode(message), privateKey);

  return fetch(input, {
    headers: {
      'Content-Type':
        init?.method !== 'GET' && init?.method !== 'DELETE'
          ? 'application/json'
          : 'application/x-www-form-urlencoded',
      'orderly-timestamp': String(timestamp),
      'orderly-account-id': orderlyAccountId,
      'orderly-key': `ed25519:${encodeBase58(await ed25519.getPublicKey(privateKey))}`,
      'orderly-signature': Buffer.from(orderlySignature).toString('base64url'),
      ...(init?.headers ?? {})
    },
    ...(init ?? {})
  });
}

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (!globalThis.crypto) globalThis.crypto = webcrypto;

const MESSAGE_TYPES = {
  EIP712Domain: [
    { name: "name", type: "string" },
    { name: "version", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "verifyingContract", type: "address" },
  ],
  SettlePnl: [
    { name: "brokerId", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "settleNonce", type: "uint64" },
    { name: "timestamp", type: "uint64" },
  ],
};

const OFF_CHAIN_DOMAIN = {
  name: 'Orderly',
  version: '1',
  chainId: 421614,
  verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC'
};

const ON_CHAIN_DOMAIN = {
  name: 'Orderly',
  version: '1',
  chainId: 42161,
  verifyingContract: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'
};

export async function generateWalletSignature(
  privateKey: string,
  message: any
): Promise<[string, string]> {
  const wallet = new ethers.Wallet(privateKey);

  const signature = await wallet.signTypedData(
    ON_CHAIN_DOMAIN,
    { SettlePnl: MESSAGE_TYPES.SettlePnl },
    message
  );

  return [await wallet.getAddress(), signature];
}