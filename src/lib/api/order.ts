import { Account } from "../../interfaces/account";
import { signAndSendRequest } from './signer'
import { accountInfo } from "../../utils/account";
import { RestAPIUrl } from "../../enums";

async function testPlaceOrder(
  symbol: string,
  orderType: string,
  side: string,
  price: number | null,
  amount: number,
  option?: RequestInit | undefined
) {
  try {
    // Base body with required properties
    const body: Record<string, any> = {
      symbol: symbol,
      order_type: orderType,
      side: side,
      order_quantity: amount,
    };

    if (orderType !== "MARKET" && orderType !== "ASK" && orderType !== "BID") {
      body.order_price = price;
    }

    // Add additional properties from init body if they exist
    if (option?.body) {
      const additionalProps = JSON.parse(option.body as string);
      Object.assign(body, additionalProps);
    }

    const response = await signAndSendRequest(
      accountInfo.accountId,
      accountInfo.privateKey,
      `${RestAPIUrl.mainnet}/v1/order`,
      {
        method: "POST",
        body: JSON.stringify(body)
      }
    );

    const json = await response.json();
    console.log('Orderly Order Response:', JSON.stringify(json, undefined, 2));
    return json;
  } catch (error) {
    throw new Error(`Error - Place Order: ${error}`);
  }
}


// async function main() {
//     try {
//       const init: RequestInit = {
//         body: JSON.stringify({
//           visible_quantity: 0,
//         })}
//       testPlaceOrder('PERP_LINK_USDC', 'BID', 'BUY', null , 1.5 ,init);
//     } catch (error) {
//         console.error('Error in main function:', error);
//     }
// }
// main().catch(error => {
//   console.error('Unhandled error in main function:', error);
// });


export class placeOrder {
  private static async placeOrder(
    account: Account,
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
    account: Account,
    url: string,
    symbol: string,
    side: string,
    price: number,
    amount: number
  ){
    return await this.placeOrder(account, url, symbol, "LIMIT", side, price, amount);
  }

  public static async marketOrder(
    account: Account,
    url: string,
    symbol: string,
    side: string,
    amount: number
  ){
    return await this.placeOrder(account, url, symbol, "MARKET", side, null, amount);
  }
}

export async function editOrder(
  account: Account,
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
  account: Account,
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
  account: Account,
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
  account: Account,
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
  account: Account,
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