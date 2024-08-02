import { BaseClient } from './base.client';
import { account, OrderResponse } from '../interfaces';
import { OrderStatus } from "../enums";

export class OrderClient extends BaseClient {
  constructor(account: account, apiUrl: string) {
    super(account, apiUrl);
  }

  public async placeOrder(
    symbol: string,
    orderType: string,
    side: string,
    price: number | null,
    amount: number,
    option?: RequestInit | undefined
  ): Promise<OrderResponse> {
    try {
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

      const response = await this.signAndSendRequest(
        this.account.accountId,
        this.account.privateKey,
        `${this.apiUrl}/v1/order`,
        {
          method: "POST",
          body: JSON.stringify(body)
        }
      );

      const json = await response.json();
      // console.log('Orderly Order Response:', JSON.stringify(json, undefined, 2));
      return json;
    } catch (error) {
      throw new Error(`Error - Place Order: ${error}`);
    }
  }

  public async cancelOrder(
    symbol: string,
    orderId: number
  ): Promise<OrderResponse> {
    try {
      const response = await this.signAndSendRequest(
        this.account.accountId,
        this.account.privateKey,
        `${this.apiUrl}/v1/order?order_id=${orderId}&symbol=${symbol}`,
        {
          method: "DELETE",
        }
      );
      const json = await response.json();
      //console.log('cancelOrder:', JSON.stringify(json, undefined, 2));
      return json;
    } catch (error) {
      throw new Error(`Error - Cancel Order: ${error}`);
    }
  }

  public async cancelBatchOrders(orderIds: number[]): Promise<OrderResponse> {
    try {
      const orderIdsString = orderIds.join(",");
      const response = await this.signAndSendRequest(
        this.account.accountId,
        this.account.privateKey,
        `${this.apiUrl}/v1/batch-order?order_ids=${orderIdsString}`,
        {
          method: "DELETE",
        }
      );
      const json = await response.json();
      // console.log('cancelBatchOrder:', JSON.stringify(json, undefined, 2));
      return json;
    } catch (error) {
      throw new Error(`Error - Cancel Batch Order: ${error}`);
    }
  }

  public async cancelAllOrders(symbol: string): Promise<OrderResponse> {
    try {
      const response = await this.signAndSendRequest(
        this.account.accountId,
        this.account.privateKey,
        `${this.apiUrl}/v1/orders?symbol=${symbol}`,
        {
          method: "DELETE",
        }
      );
      const json = await response.json();
      // console.log('cancelAllOrder:', JSON.stringify(json, undefined, 2));
      return json;
    } catch (error) {
      throw new Error(`Error - Cancel All Order: ${error}`);
    }
  }

  public async getOrderStatus(orderId: number): Promise<OrderResponse> {
    try {
      const response = await this.signAndSendRequest(
        this.account.accountId,
        this.account.privateKey,
        `${this.apiUrl}/v1/order/${orderId}`,
        {
          method: "GET",
        }
      );
      const json = await response.json();
      //console.log('cancelOrder:', JSON.stringify(json, undefined, 2));
      return json;
    } catch (error) {
      throw new Error(`Error - Get Order Status: ${error}`);
    }
  }

  public async getOpenOrders(): Promise<OrderResponse> {
    try {
      const response = await this.signAndSendRequest(
        this.account.accountId,
        this.account.privateKey,
        `${this.apiUrl}/v1/orders?status=INCOMPLETE`,
        {
          method: "GET",
        }
      );
      const json = await response.json();
      //console.log('cancelOrder:', JSON.stringify(json, undefined, 2));
      return json;
    } catch (error) {
      console.error("Error checking orders info:", error);
      throw new Error(`Error - Get Open Orders: ${error}`);
    }
  }
}