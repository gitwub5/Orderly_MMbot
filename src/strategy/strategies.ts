import { StrategyConfig } from "./strategyConfig";

//Maker로 들어가면 0.02% rebate
//Taker는 0.03%로 수수료 발생

export const strategies: Record<string, StrategyConfig> = {
    'PERP_TON_USDC': {
        symbol: 'PERP_TON_USDC',
        precision: 4,
        orderQuantity: 8,
        tradePeriodMs: 10000,
        stdDevPeriod: 10,
        orderLevels: 3,
        orderSpacing: 0.02, // (0.01~0.1)
        takeProfitRatio: 0.03,
        stopLossRatio: 0.003,
        gamma: 0.1, // 낮은 값은 더 많은 리스크를 감수하고, 높은 값은 리스크를 줄이는 경향 (0.01~0.5)
        k: 7,  // 시장의 변동성과 거래 빈도에 따라 조정 (1~10)
        stdDevThreshold: 0.002,
    },
    
    'PERP_LINK_USDC': {
        symbol: 'PERP_LINK_USDC',
        precision: 3,
        orderQuantity: 8,
        tradePeriodMs: 10000,
        stdDevPeriod: 40,
        orderLevels: 3,
        orderSpacing: 0.03,
        takeProfitRatio: 0.03,
        stopLossRatio: 0.003,
        gamma: 0.35,
        k: 6,
        stdDevThreshold: 0.002,
    },

    'PERP_ARB_USDC': {
        symbol: 'PERP_ARB_USDC',
        precision: 4,
        orderQuantity: 30,
        tradePeriodMs: 10000,
        stdDevPeriod: 30,
        orderLevels: 3,
        orderSpacing: 0.03,
        takeProfitRatio: 0.03,
        stopLossRatio: 0.003,
        gamma: 0.3,
        k: 6,
        stdDevThreshold: 0.002,
    },

};