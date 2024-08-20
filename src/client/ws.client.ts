import WebSocket from 'ws';
import { Buffer } from 'buffer';
import { KeyPair } from 'near-api-js';
import { Account } from "../interfaces";

export class PrivateWsClient{
    private account: Account;
    private wsUrl: string;
    private websocket: WebSocket | null = null;
    private subscriptions: Set<any>;
    private messageCallback: ((message: any) => void) | null;
    private pingIntervalMs: number = 10000; // 10 seconds
    private pingTimer: NodeJS.Timeout | null = null;

  constructor(account: Account, wsUrl: string) {
    this.account = account;
    this.wsUrl = `${wsUrl}${account.accountId}`;
    this.subscriptions = new Set();
    this.messageCallback = null;
  }

  public async connect(): Promise<void> {
    this.websocket = new WebSocket(this.wsUrl);

    this.websocket.on('open', async () => {
      console.log('WebSocket connection established.');
      await this.authenticate();

      this.subscriptions.forEach(async (subscription: any) => {
        await this.sendSubscription(subscription);
      });

      this.startPing();
    });

    this.websocket.on('message', (data) => {
      const message = JSON.parse(data.toString());
      if (this.messageCallback) {
        this.messageCallback(message);
      }
    });

    this.websocket.on('close', (code, reason) => {
      console.log(`WebSocket connection closed: ${code} - ${reason}`);
      this.stopPing();
      this.websocket = null;
    });

    this.websocket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  }

  private async authenticate(): Promise<void> {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      console.error('WebSocket is not open.');
      return;
    }

    const timestamp = new Date().getTime();
    const messageStr = [timestamp].join("");

    const messageBytes = new TextEncoder().encode(messageStr);
    const keyPair = await this.getOrderlyKeyPair(this.account.privateKeyBase58);

    const orderlySign = await this.signMessage(keyPair, messageBytes);

    const payload = {
        id: "123r",
        event: "auth",
        params: {
          orderly_key: this.account.orderlyKey,
          sign: orderlySign,
          timestamp: timestamp,
        },
    };

    //console.log(JSON.stringify(payload));
    this.websocket.send(JSON.stringify(payload));
    console.log('Authentication message sent.');
  }

  private async getOrderlyKeyPair (orderlyKeyPrivateKey: string): Promise<KeyPair>{
    return KeyPair.fromString(orderlyKeyPrivateKey);
  }

  private async signMessage(keyPair : KeyPair , messageString: Uint8Array): Promise<string> {
    const u8 = Buffer.from(messageString);
    const signStr = keyPair.sign(u8);
    return Buffer.from(signStr.signature).toString('base64');
  } 
  

  public async disconnectPrivate() {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
      console.log("WebSocket private connection disconnected.");
      this.stopPing();
    }
  }

  public async sendSubscription(subscription: any) {
    if (
      this.websocket &&
      this.websocket.readyState === WebSocket.OPEN
    ) {
      this.websocket.send(JSON.stringify(subscription));
      console.log("Sent subscription private:", subscription);
      this.subscriptions.add(subscription);
    } else {
      console.warn(
        "Private WebSocket connection not open. Subscription not sent."
      );
      this.subscriptions.add(subscription);
    }
  }

  public async unsubscribe(subscription: any) {
    this.subscriptions.delete(subscription);
    console.log("Sent unsubscription private:", subscription);
    // Unsubscribe from the server if needed
  }

  public async setMessageCallback(callback: (message: any) => void) {
    this.messageCallback = callback;
  }

  private startPing(): void {
    this.pingTimer = setInterval(() => {
      if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
        this.websocket.send(JSON.stringify({ event: 'ping' }));
        console.log('Ping sent.');
      }
    }, this.pingIntervalMs);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
      console.log('Ping stopped.');
    }
  }

  public async disconnect(): Promise<void> {
    if (this.websocket) {
      this.websocket.close();
      console.log('WebSocket connection closed by the client.');
    }
  }

  public async subExecutionReport(): Promise<void> {
    const submessage = {
      id: `id-execution-report`,
      topic: "executionreport",
      event: "subscribe",
    };

    await this.sendSubscription(submessage);
  }

  public async unsubExecutionReport(): Promise<void> {
    const submessage = {
      id: `id-execution-report`,
      topic: "executionreport",
      event: "unsubscribe",
    };

    await this.unsubscribe(submessage);
  }

  async subPositionPush(): Promise<void> {
    const submessage = {
      id: `id-position-push`,
      topic: "position",
      event: "subscribe",
    };

    await this.sendSubscription(submessage);
  }
}


// //TEST 
// import { accountInfo } from '../utils/account';
// import { WsPrivateUrl } from '../enums';

// async function main() {
//   const privateClient = new PrivateWsClient(accountInfo, WsPrivateUrl.mainnet);
//   console.log("1");
//   await privateClient.connect();

//   console.log("2");
//   await privateClient.subExecutionReport();
//   console.log("3");
//   privateClient.setMessageCallback((message) => {
//       if(message.topic === 'executionreport'){
//         const data = message.data;
//         console.log(data);
//         if(data.status === 'FILLED'){
//           console.log(data.executedPrice);
//         }
//       }
//   });
// }

// main().catch(error => {
//   console.error('Error in main function:', error);
// });