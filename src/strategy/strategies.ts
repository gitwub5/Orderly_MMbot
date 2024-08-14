import { StrategyConfig } from "./strategyConfig";

//Maker로 들어가면 0.02% rebate
//Taker는 0.03%로 수수료 발생

export const strategies: Record<string, StrategyConfig> = {
    // 'PERP_LINK_USDC': {
    //     symbol: 'PERP_LINK_USDC',
    //     precision: 3,
    //     orderQuantity: 1.5,
    //     tradePeriodMs: 20000,
    //     stdDevPeriod: 10,
    //     orderLevels: 3,
    //     orderSpacing: 0.05,
    //     takeProfitRatio: 0.01,
    //     stopLossRatio: 0.01,
    //     gamma: 0.4,
    //     k: 7,
    //     threshold: 60,
    // },

    'PERP_SOL_USDC': {
        symbol: 'PERP_SOL_USDC',
        precision: 3,
        orderQuantity: 0.1,
        tradePeriodMs: 20000,
        stdDevPeriod: 20,
        orderLevels: 3,
        orderSpacing: 0.05,
        takeProfitRatio: 0.01,
        stopLossRatio: 0.01,
        gamma: 0.4,
        k: 0.2,
        threshold: 55,
    },

    'PERP_DOGE_USDC': {
        symbol: 'PERP_DOGE_USDC',
        precision: 5,
        orderQuantity: 150,
        tradePeriodMs: 20000,
        stdDevPeriod: 50,
        orderLevels: 3,
        orderSpacing: 0.02,
        takeProfitRatio: 0.01,
        stopLossRatio: 0.01,
        gamma: 0.2,
        k: 200,
        threshold: 55,
    },
};