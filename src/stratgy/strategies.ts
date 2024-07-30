import { StrategyConfig } from "./strategyConfig";

export const strategies: Record<string, StrategyConfig> = {
    'PERP_TON_USDC': {
        symbol: 'PERP_TON_USDC',
        precision: 4,
        orderQuantity: 8,
        tradePeriodMs: 15000,
        stdDevPeriod: 10,
        orderLevels: 5,
        orderSpacing: 0.01,
        takeProfitRatio: 0.03,
        stopLossRatio: 0.01,
        gamma: 0.03,
        k: 8,
        maxPosition: 30,
    },
    // 'PERP_BTC_USDC': {
    //     symbol: 'PERP_BTC_USDC',
    //     precision: 4,
    //     orderQuantity: 5,
    //     tradePeriodMs: 20000,
    //     stdDevPeriod: 15,
    //     orderLevels: 7,
    //     orderSpacing: 0.02,
    //     takeProfitRatio: 0.04,
    //     stopLossRatio: 0.02,
    //     gamma: 0.04,
    //     k: 7,
    //     maxPosition: 20,
    // },
    // Add more configurations for other symbols as needed
};