import { MainClient } from '../../client/main.client';
import { StrategyConfig } from '../../interfaces/strategy';


export class MonitorMarket {
    private client: MainClient;
    private config: StrategyConfig;

    constructor(client: MainClient, config: StrategyConfig) {
        this.client = client;
        this.config = config;
    }
}