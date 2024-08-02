import { StrategyConfig } from "./strategyConfig";

//Maker로 들어가면 0.02% rebate
//Taker는 0.03%로 수수료 발생

export const strategies: Record<string, StrategyConfig> = {
    'PERP_TON_USDC': {
        symbol: 'PERP_TON_USDC',
        precision: 4,
        orderQuantity: 16,
        tradePeriodMs: 5000,
        stdDevPeriod: 5,
        orderLevels: 3,
        orderSpacing: 0.01, // (0.01~0.1)
        takeProfitRatio: 0.02,
        stopLossRatio: 0.01,
        gamma: 0.5, // 낮은 값은 더 많은 리스크를 감수하고, 높은 값은 리스크를 줄이는 경향 (0.01~0.5)
        k: 5.8,  // 시장의 변동성과 거래 빈도에 따라 조정 (1~10)
        stdDevThreshold: 0.002,
    },
    
    'PERP_LINK_USDC': {
        symbol: 'PERP_LINK_USDC',
        precision: 3,
        orderQuantity: 20,
        tradePeriodMs: 5000,
        stdDevPeriod: 40,
        orderLevels: 3,
        orderSpacing: 0.035,
        takeProfitRatio: 0.02,
        stopLossRatio: 0.01,
        gamma: 0.5,
        k: 6,
        stdDevThreshold: 0.002,
    },

    'PERP_SOL_USDC': {
        symbol: 'PERP_SOL_USDC',
        precision: 3,
        orderQuantity: 1,
        tradePeriodMs: 5000,
        stdDevPeriod: 50,
        orderLevels: 3,
        orderSpacing: 0.1,
        takeProfitRatio: 0.02,
        stopLossRatio: 0.01,
        gamma: 0.5,
        k: 1,
        stdDevThreshold: 0.05,
    },

    'PERP_DOGE_USDC': {
        symbol: 'PERP_DOGE_USDC',
        precision: 5,
        orderQuantity: 1000,
        tradePeriodMs: 5000,
        stdDevPeriod: 50,
        orderLevels: 3,
        orderSpacing: 0.01,
        takeProfitRatio: 0.02,
        stopLossRatio: 0.01,
        gamma: 0.4,
        k: 150,
        stdDevThreshold: 0.00003,
    },

};