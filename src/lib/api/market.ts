import { accountInfo } from "../../utils/account";
import { account } from "../../interfaces/account";
import { signAndSendRequest } from './signer';
import { RestAPIUrl } from "../../enums";

export async function getPrice(symbol:string) {
    const response = await signAndSendRequest(
      accountInfo.accountId,
      accountInfo.privateKey,
      `${RestAPIUrl.mainnet}/v1/public/futures/${symbol}`
    );
    const json = await response.json();
    const price = json.data.mark_price;
    //console.log(`Orderly ${symbol} price: `, parseFloat(price));
    return parseFloat(price);
}

export interface OrderBookResponse {
  success: boolean;
  timestamp: number;
  data: {
    asks: {
      price: number;
      quantity: number;
    }[];
    bids: {
      price: number;
      quantity: number;
    }[];
    timestamp: number;
  };
}

export async function getOrderbook(symbol: string, max_level: number = 10): Promise<OrderBookResponse> {
  const query: Record<string, any> = {};
  if (max_level) query.max_level = max_level;

  const queryString = new URLSearchParams(query).toString();
  const url = `${RestAPIUrl.mainnet}/v1/orderbook/${symbol}${
    queryString ? "?" + queryString : ""
  }`;

  const response = await signAndSendRequest(
    accountInfo.accountId,
    accountInfo.privateKey,
    url
  );

  const json = await response.json();
  return json;
}
