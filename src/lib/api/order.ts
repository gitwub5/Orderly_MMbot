import { account } from "../../interfaces/account";
import { signAndSendRequest } from './signer'

export class placeOrder {
  private static async placeOrder(
    account: account,
    url: string,
    symbol: string,
    orderType: string,
    side: string,
    price: number | null,
    amount: number
  ){
    const body: Record<string, any> = {
      symbol: symbol,
      order_type: orderType,
      side: side,
      order_quantity: amount,
    };

    if (orderType === "LIMIT") {
      body.order_price = price;
    }

    try {
      const response = await signAndSendRequest(
        account.accountId,
        account.privateKey,
        `${url}/v1/order`,
        {
          method: "POST",
          body: JSON.stringify(body),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const json = await response.json();
      // console.log('Orderly Order Response:', JSON.stringify(json, undefined, 2));
      return json;
    } catch (error) {
      console.error("Error creating order:", error);
      return null;
    }
  }

  public static async limitOrder(
    account: account,
    url: string,
    symbol: string,
    side: string,
    price: number,
    amount: number
  ){
    return await this.placeOrder(account, url, symbol, "LIMIT", side, price, amount);
  }

  public static async marketOrder(
    account: account,
    url: string,
    symbol: string,
    side: string,
    amount: number
  ){
    return await this.placeOrder(account, url, symbol, "MARKET", side, null, amount);
  }
}

export async function editOrder(
  account: account,
  url: string,
  orderId: string,
  symbol: string,
  orderType: string,
  side: string,
  price: number | null,
  amount: number
) {
  const body: Record<string, any> = {
    order_id: orderId,
    symbol: symbol,
    order_type: orderType,
    order_price: price,
    order_quantity: amount,
    side: side,
  };

  try {
    const response = await signAndSendRequest(
      account.accountId,
      account.privateKey,
      `${url}/v1/order`,
      {
        method: "PUT",
        body: JSON.stringify(body),
      }
    );
    const json = await response.json();
    console.log("editOrder:", JSON.stringify(json, undefined, 2));
  } catch (error) {
    console.error("Error:", error);
    return null;
  }
}

export async function cancelOrder(
  account: account,
  url: string,
  symbol: string,
  orderId: number
) {
  try {
    const response = await signAndSendRequest(
      account.accountId,
      account.privateKey,
      `${url}/v1/order?order_id=${orderId}&symbol=${symbol}`,
      {
        method: "DELETE",
      }
    );
    const json = await response.json();
    //console.log('cancelOrder:', JSON.stringify(json, undefined, 2));
  } catch (error) {
    console.error("Error:", error);
    return null;
  }
}

export async function cancelBatchOrders(
  account: account,
  url: string,
  order_ids: number[]
) {
  const orderIdsString = order_ids.join(",");

  try {
    const response = await signAndSendRequest(
      account.accountId,
      account.privateKey,
      `${url}/v1/batch-order?order_ids=${orderIdsString}`,
      {
        method: "DELETE",
      }
    );
    const json = await response.json();
    //console.log('cancelBatchOrder:', JSON.stringify(json, undefined, 2));
  } catch (error) {
    console.error("Error:", error);
    return null;
  }
}

export async function cancelAllOrders(
  account: account,
  url: string,
  symbol: string
) {
  try {
    const response = await signAndSendRequest(
      account.accountId,
      account.privateKey,
      `${url}/v1/orders?symbol=${symbol}`,
      {
        method: "DELETE",
      }
    );
    const json = await response.json();
    //console.log('cancelAllOrder:', JSON.stringify(json, undefined, 2));
  } catch (error) {
    console.error("Error:", error);
    return null;
  }
}

export async function getOrderById(
  account: account,
  url: string,
  order_id: string
) {
  try {
    const response = await signAndSendRequest(
      account.accountId,
      account.privateKey,
      `${url}/v1/order/${order_id}`,
      {
        method: "GET",
      }
    );
    const json = await response.json();
    return json.data;
  } catch (error) {
    console.error("Error:", error);
    return null;
  }
}

// async function main() {
//     try {
//      
//     } catch (error) {
//         console.error('Error in main function:', error);
//     }
// }
// main().catch(error => {
//   console.error('Unhandled error in main function:', error);
// });