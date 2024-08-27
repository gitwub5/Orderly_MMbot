import WebSocket from 'ws';
import { Account } from '../../interfaces/account';
import { accountInfo } from '../../utils/account';
import { WsPublicUrl } from '../../enums';

export class WebSocketManager {
  public url: string;
  public websocket: WebSocket | null;
  public subscriptions: Set<any>;
  public messageCallback: ((message: any) => void) | null;
  public pingTimer: NodeJS.Timeout | null;
  public pingInterval: number;

  constructor(account: Account, url: string) {
    this.url = `${url}${account.accountId}`;
    this.websocket = null;
    this.subscriptions = new Set();
    this.pingInterval = 10000; // Ping interval in milliseconds (10 seconds)
    this.pingTimer = null;
    this.messageCallback = null;
  }

  async connect() {
    this.websocket = new WebSocket(this.url);

    this.websocket.onopen = () => {
        console.log('Orderly WebSocket connection established.');
        // Subscribe to existing subscriptions
        this.subscriptions.forEach((subscription) => {
            this.sendSubscription(subscription);
        });
        this.startPing();
    };

    this.websocket.onmessage = (event: WebSocket.MessageEvent) => {
      const message = JSON.parse(event.data.toString());
      //console.log('Received message:', message);
      if (this.messageCallback) {
          this.messageCallback(message);
      }
    };

    this.websocket.onclose = (event: WebSocket.CloseEvent) => {
      console.log('Orderly WebSocket connection closed:', event.reason);
      this.stopPing();
    };

    this.websocket.onerror = (error: WebSocket.ErrorEvent) => {
        console.error('Orderly WebSocket connection error:', error.message);
    };
  }

  async disconnect() {
    if (this.websocket) {
        this.websocket.close();
        this.websocket = null;
        console.log('Orderly WebSocket connection disconnected.');
        this.stopPing();
    }
  }

  async sendSubscription(subscription: any) {
      if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
          this.websocket.send(JSON.stringify(subscription));
          console.log('Sent subscription:', subscription);
          this.subscriptions.add(subscription);
      } else {
          console.warn('Orderly WebSocket connection not open. Subscription not sent.');
          this.subscriptions.add(subscription);
      }
  }


  async unsubscribe(subscription: any) {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify(subscription));
      console.log('Sent unsubscription:', subscription);
      this.subscriptions.delete(subscription);
  } else {
      console.warn('Orderly WebSocket connection not open. Subscription not sent.');
      this.subscriptions.delete(subscription);
  }


    // console.log('Sent subscription:', subscription);
    // this.subscriptions.delete(subscription);
    // Unsubscribe from the server if needed
  }

  async setMessageCallback(callback: (message: any) => void) {
    this.messageCallback = callback;
  }

  async startPing() {
    this.pingTimer = setInterval(() => {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            this.websocket.send(JSON.stringify({ event: 'pong' }));
            console.log('Orderly Sent ping request.');
        } else {
            console.warn('Orderly WebSocket connection not open. Ping request not sent.');
        }
    }, this.pingInterval);
  }
  
  async stopPing() {
    if (this.pingTimer) {
        clearInterval(this.pingTimer);
        this.pingTimer = null;
        console.log('Orderly Stopped ping requests.');
    }
  }

  //시장 가격 불러오기 (1s)
  async markPrice(symbol : string){
    const submessage = {
      id: `id-markPrice`,
      topic: `${symbol}@markprice`,
      event: "subscribe",
    };
    this.sendSubscription(submessage);
  }
  async unsubMarkPrice(symbol : string){
    const submessage = {
      id: `id-markPrice`,
      topic: `${symbol}@markprice`,
      event: "unsubscribe",
    };
    this.unsubscribe(submessage);
  }

  async ticker(symbol : string){
    const submessage = {
      id: `id-24h_ticker`,
      topic: `${symbol}@ticker`,
      event: "subscribe",
    };
    this.sendSubscription(submessage);
  }

  async indexPrice(symbol : string){
    const modifiedSymbol = symbol.replace('PERP', 'SPOT');
    const submessage = {
      id: `id-indexprice`,
      topic: `${modifiedSymbol}@indexprice`,
      event: "subscribe",
    };
    this.sendSubscription(submessage);
  }

  async trade(symbol : string){
    const submessage = {
      id: `id-trade`,
      topic: `${symbol}@trade`,
      event: "subscribe",
    };
    this.sendSubscription(submessage);
  }

  async bbo(symbol : string){
    const submessage = {
      id: `id-bbo`,
      topic: `${symbol}@bbo`,
      event: "subscribe",
    };
    this.sendSubscription(submessage);
  }
}

// // TEST
// async function main() {
//   const wsClient = new WebSocketManager(accountInfo, WsPublicUrl.testnet);

//   await wsClient.connect();

//   const symbol = 'PERP_LINK_USDC';
//   const modifiedSymbol = symbol.replace('PERP', 'SPOT');

//   await wsClient.ticker(symbol);
//   await wsClient.markPrice(symbol);
//   await wsClient.indexPrice(symbol);
//   // await wsClient.bbo(symbol);
//   // await wsClient.trade(symbol);

//   wsClient.setMessageCallback((message) => {
//     if (message.topic === `${symbol}@ticker`){
//       const data = message.data;
//       console.log('Received Mark price:', data);
//       }
//     if (message.topic === `${symbol}@markprice`){
//     const data = message.data;
//     const price = data.price;
//     console.log('Received Mark price:', price);
//     }
//     if (message.topic === `${modifiedSymbol}@indexprice`){
//       const data = message.data;
//       const price = data.price;
//       console.log('Received Index price:', price);
//     }
//     if (message.topic === `${symbol}@bbo`){
//       const data = message.data;
//       console.log('Received bbo:', data);
//     }
//     if (message.topic === `${symbol}@trade`){
//       const data = message.data;
//       console.log('Received trade:', data);
//     }

//   });

//   // Wait some time to ensure the subscription is processed before disconnecting
//   setTimeout(() => {
//     wsClient.disconnect();
//   }, 60 * 60 * 1000); 
// }

// main().catch(error => {
//   console.error('Error in main function:', error);
// });