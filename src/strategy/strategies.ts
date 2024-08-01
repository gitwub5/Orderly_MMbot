import { StrategyConfig } from "./strategyConfig";

//Maker로 들어가면 0.02% rebate
//Taker는 0.03%로 수수료 발생

export const strategies: Record<string, StrategyConfig> = {
    'PERP_TON_USDC': {
        symbol: 'PERP_TON_USDC',
        precision: 4,
        orderQuantity: 10,
        tradePeriodMs: 10000,
        stdDevPeriod: 15,
        orderLevels: 5,
        orderSpacing: 0.02, // (0.01~0.1)
        takeProfitRatio: 0.03,
        stopLossRatio: 0.003,
        gamma: 0.2, // 낮은 값은 더 많은 리스크를 감수하고, 높은 값은 리스크를 줄이는 경향 (0.01~0.5)
        k: 6,  // 시장의 변동성과 거래 빈도에 따라 조정 (1~10)
        stdDevThreshold: 0.002,
    },
    
    'PERP_LINK_USDC': {
        symbol: 'PERP_LINK_USDC',
        precision: 3,
        orderQuantity: 4,
        tradePeriodMs: 10000,
        stdDevPeriod: 40,
        orderLevels: 3,
        orderSpacing: 0.04,
        takeProfitRatio: 0.03,
        stopLossRatio: 0.003,
        gamma: 0.25,
        k: 6,
        stdDevThreshold: 0.002,
    },

};