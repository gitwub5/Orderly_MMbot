import bs58 from 'bs58';
import dotenv from 'dotenv';
import { account } from '../interfaces/account';

dotenv.config();

const privateKeyBase58 = (process.env.ORDERLY_SECRET as string).replace("ed25519:", "");
const privateKey = bs58.decode(privateKeyBase58);

export const accountInfo : account = {
  orderlyKey: process.env.ORDERLY_API_KEY as string,
  privateKeyBase58: privateKeyBase58,
  privateKey : privateKey,
  accountId: process.env.ORDERLY_ACCOUNT_ID as string,
};