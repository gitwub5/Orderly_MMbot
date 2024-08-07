import { StrategyConfig } from "./strategyConfig";

//Maker로 들어가면 0.02% rebate
//Taker는 0.03%로 수수료 발생

export const strategies: Record<string, StrategyConfig> = {
    // 'PERP_TON_USDC': {
    //     symbol: 'PERP_TON_USDC',
    //     precision: 4,
    //     orderQuantity: 10,
    //     tradePeriodMs: 15000,
    //     stdDevPeriod: 5,
    //     orderLevels: 1,
    //     orderSpacing: 0.015, // (0.01~0.1)
    //     takeProfitRatio: 0.02,
    //     stopLossRatio: 0.01,
    //     gamma: 0.5, // 낮은 값은 더 많은 리스크를 감수하고, 높은 값은 리스크를 줄이는 경향 (0.01~0.5)
    //     k: 5,  // 시장의 변동성과 거래 빈도에 따라 조정 (1~10)
    //     stdDevThreshold: 0.002,
    // },

    // 'PERP_ARB_USDC': {
    //     symbol: 'PERP_ARB_USDC',
    //     precision: 4,
    //     orderQuantity: 50,
    //     tradePeriodMs: 20000,
    //     stdDevPeriod: 5,
    //     orderLevels: 3,
    //     orderSpacing: 0.015, // (0.01~0.1)
    //     takeProfitRatio: 0.02,
    //     stopLossRatio: 0.01,
    //     gamma: 0.5, // 낮은 값은 더 많은 리스크를 감수하고, 높은 값은 리스크를 줄이는 경향 (0.01~0.5)
    //     k: 5,  // 시장의 변동성과 거래 빈도에 따라 조정 (1~10)
    //     stdDevThreshold: 0.002,
    // },
    
    'PERP_LINK_USDC': {
        symbol: 'PERP_LINK_USDC',
        precision: 3,
        orderQuantity: 5,
        tradePeriodMs: 20000,
        stdDevPeriod: 40,
        orderLevels: 3,
        orderSpacing: 0.05,
        takeProfitRatio: 0.01,
        stopLossRatio: 0.01,
        gamma: 0.5,
        k: 1.6,
        stdDevThreshold: 0.002,
    },

    'PERP_SOL_USDC': {
        symbol: 'PERP_SOL_USDC',
        precision: 3,
        orderQuantity: 0.4,
        tradePeriodMs: 20000,
        stdDevPeriod: 50,
        orderLevels: 3,
        orderSpacing: 0.05,
        takeProfitRatio: 0.01,
        stopLossRatio: 0.01,
        gamma: 0.4,
        k: 0.025,
        stdDevThreshold: 0.05,
    },

    'PERP_DOGE_USDC': {
        symbol: 'PERP_DOGE_USDC',
        precision: 5,
        orderQuantity: 600,
        tradePeriodMs: 20000,
        stdDevPeriod: 50,
        orderLevels: 3,
        orderSpacing: 0.02,
        takeProfitRatio: 0.01,
        stopLossRatio: 0.01,
        gamma: 0.4,
        k: 150,
        stdDevThreshold: 0.00003,
    },

    // 'PERP_ETH_USDC': {
    //     symbol: 'PERP_ETH_USDC',
    //     precision: 2,
    //     orderQuantity: 0.02,
    //     tradePeriodMs: 20000,
    //     stdDevPeriod: 50,
    //     orderLevels: 3,
    //     orderSpacing: 0.05,
    //     takeProfitRatio: 0.01,
    //     stopLossRatio: 0.01,
    //     gamma: 0.4,
    //     k: 0.025,
    //     stdDevThreshold: 0.05,
    // },

};