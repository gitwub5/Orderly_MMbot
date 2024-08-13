export interface Account {
    accountId: string;
    orderlyKey: string;
    privateKeyBase58: string;
    privateKey: Uint8Array;
    walletAddress : string;
    walletPrivateKey: string;
}