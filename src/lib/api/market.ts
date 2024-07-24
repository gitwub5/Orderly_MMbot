import { account } from "../../interfaces/account";
import { signAndSendRequest } from './signer';

export async function getOrderlyPrice(account: account, url: string, symbol:string) {
    const response = await signAndSendRequest(
      account.accountId,
      account.privateKey,
      `${url}/v1/public/futures/${symbol}`
    );
    const json = await response.json();
    const price = json.data.mark_price;
    //console.log(`Orderly ${symbol} price: `, parseFloat(price));
    return parseFloat(price);
}

//Snapshot of the current orderbook. Price of asks/bids are in descending order.
type Level = { price: number; quantity: number };
export type OrderbookSnapshot = { data: { asks: Level[]; bids: Level[] } };

//TODO: 수정필요 & maxLevel은 몇으로 잡아야하는가?
export async function getOrderlyOrderbook(account: account, url: string, symbol: string, maxLevel: number): Promise<OrderbookSnapshot> {
  const res = await signAndSendRequest(
    account.accountId,
    account.privateKey,
    `${url}/v1/orderbook/${symbol}${maxLevel != null ? `?max_level=${maxLevel}` : ''}`
  );
  const json = await res.json();
  console.log('getOrderbook:', JSON.stringify(json, undefined, 2));
  return json;
}