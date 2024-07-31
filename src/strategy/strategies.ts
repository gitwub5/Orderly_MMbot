import { StrategyConfig } from "./strategyConfig";

//Maker로 들어가면 0.02% rebate
//Taker는 0.03%로 수수료 발생

export const strategies: Record<string, StrategyConfig> = {
    'PERP_TON_USDC': {
        symbol: 'PERP_TON_USDC',
        precision: 4,
        orderQuantity: 8,
        tradePeriodMs: 30000,
        stdDevPeriod: 20,
        orderLevels: 5,
        orderSpacing: 0.01, // (0.01~0.1)
        takeProfitRatio: 0.03,
        stopLossRatio: 0.01,
        gamma: 0.05, // 낮은 값은 더 많은 리스크를 감수하고, 높은 값은 리스크를 줄이는 경향 (0.01~0.5)
        k: 6,  // 시장의 변동성과 거래 빈도에 따라 조정 (1~10)
        stdDevThreshold: 0.012,
    },
    
    // 'PERP_ETH_USDC': {
    //     symbol: 'PERP_ETH_USDC',
    //     precision: 2,
    //     orderQuantity: 0.005,
    //     tradePeriodMs: 20000,
    //     stdDevPeriod: 50,
    //     orderLevels: 3,
    //     orderSpacing: 0.02,
    //     takeProfitRatio: 0.04,
    //     stopLossRatio: 0.02,
    //     gamma: 0.04,
    //     k: 7,
    //     stdDevThreshold: 0.02,
    // },

};