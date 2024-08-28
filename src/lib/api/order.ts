import { Account } from "../../interfaces/account";
import { signAndSendRequest } from './signer'
import { accountInfo } from "../../utils/account";
import { RestAPIUrl } from "../../enums";

export class placeOrder {
  private static async placeOrder(
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

    if (orderType !== "MARKET" && orderType !== "ASK" && orderType !== "BID") {
      body.order_price = price;
    }

    try {
      const response = await signAndSendRequest(
        accountInfo.accountId,
        accountInfo.privateKey,
        `${RestAPIUrl.testnet}/v1/order`,
        {
          method: "POST",
          body: JSON.stringify(body),
        }
      );

      const json = await response.json();
      console.log('Orderly Order Response:', JSON.stringify(json, undefined, 2));
      return json;
    } catch (error) {
      console.error("Error creating order:", error);
      return null;
    }
  }

  public static async limitOrder(
    symbol: string,
    side: string,
    price: number,
    amount: number
  ){
    return await this.placeOrder(symbol, "LIMIT", side, price, amount);
  }

  public static async marketOrder(
    symbol: string,
    side: string,
    amount: number
  ){
    return await this.placeOrder(symbol, "MARKET", side, null, amount);
  }
}

async function main() {
    try {
      await placeOrder.limitOrder('PERP_LINK_USDC', 'BUY', 11.0, 1 )
    } catch (error) {
        console.error('Error in main function:', error);
    }
}
main().catch(error => {
  console.error('Unhandled error in main function:', error);
});

export async function editOrder(
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
      accountInfo.accountId,
      accountInfo.privateKey,
      `${RestAPIUrl.mainnet}/v1/order`,
      {
        method: "PUT",
        body: JSON.stringify(body),
      }
    );
    const json = await response.json();
    console.log("editOrder:", JSON.stringify(json, undefined, 2));
    return json;
  } catch (error) {
    console.error("Error:", error);
    return null;
  }
}

export async function cancelOrder(
  symbol: string,
  orderId: number
) {
  try {
    const response = await signAndSendRequest(
      accountInfo.accountId,
      accountInfo.privateKey,
      `${RestAPIUrl.mainnet}/v1/order?order_id=${orderId}&symbol=${symbol}`,
      {
        method: "DELETE",
      }
    );
    const json = await response.json();
    //console.log('cancelOrder:', JSON.stringify(json, undefined, 2));
    return json;
  } catch (error) {
    console.error("Error:", error);
    return null;
  }
}

export async function cancelBatchOrders(
  order_ids: number[]
) {
  const orderIdsString = order_ids.join(",");

  try {
    const response = await signAndSendRequest(
      accountInfo.accountId,
      accountInfo.privateKey,
      `${RestAPIUrl.mainnet}/v1/batch-order?order_ids=${orderIdsString}`,
      {
        method: "DELETE",
      }
    );
    const json = await response.json();
    //console.log('cancelBatchOrder:', JSON.stringify(json, undefined, 2));
    return json;
  } catch (error) {
    console.error("Error:", error);
    return null;
  }
}

export async function cancelAllOrders(
  symbol: string
) {
  try {
    const response = await signAndSendRequest(
      accountInfo.accountId,
      accountInfo.privateKey,
      `${RestAPIUrl.mainnet}/v1/orders?symbol=${symbol}`,
      {
        method: "DELETE",
      }
    );
    const json = await response.json();
    //console.log('cancelAllOrder:', JSON.stringify(json, undefined, 2));
    return json;
  } catch (error) {
    console.error("Error:", error);
    return null;
  }
}

export async function getOrderById(
  order_id: string
) {
  try {
    const response = await signAndSendRequest(
      accountInfo.accountId,
      accountInfo.privateKey,
      `${RestAPIUrl.mainnet}/v1/order/${order_id}`,
      {
        method: "GET",
      }
    );
    const json = await response.json();
    return json;
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