import bs58 from 'bs58';
import dotenv from 'dotenv';
import { Account } from '../interfaces/account';

dotenv.config();

const edorderlyKey = process.env.ORDERLY_API_KEY as string;
const orderlyKey = edorderlyKey.replace("ed25519:", "");
const privateKeyBase58 = (process.env.ORDERLY_SECRET as string).replace("ed25519:", "");
const privateKey = bs58.decode(privateKeyBase58);

export const accountInfo : Account = {
  orderlyKey: orderlyKey,
  privateKeyBase58: privateKeyBase58,
  privateKey : privateKey,
  accountId: process.env.ORDERLY_ACCOUNT_ID as string,
  walletAddress: process.env.WALLET_ADDRESS as string,
  walletPrivateKey: process.env.WALLET_PRIVATE_KEY as string,
};