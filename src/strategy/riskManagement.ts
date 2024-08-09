import winston from 'winston';
import { PositionResponse } from "../interfaces";
import { MainClient } from "../client/main.client";
import { StrategyConfig } from "./strategyConfig";
import { fixPrecision } from "../utils/fixPrecision";

async function calculatePnLPercentage(openPosition : PositionResponse) {
    const { position_qty, mark_price, average_open_price } = openPosition.data;

    // const currentValue = position_qty * mark_price;
    // const initialCost = position_qty * average_open_price;
    // const pnl = currentValue - initialCost;

    let pnlPercentage = 0;
    if (position_qty > 0) { // Long position
        pnlPercentage = ((mark_price - average_open_price) / average_open_price) * 100;
    } else if (position_qty < 0) { // Short position
        pnlPercentage = ((average_open_price - mark_price) / average_open_price) * 100;
    } else {
        pnlPercentage = 0; // No position
    }

    return pnlPercentage;
}

async function placeAskBidOrder(client: MainClient, symbol: string, position_qty: number){
    await client.cancelAllOrders(symbol);
    
    //만약 포지션이 음수이면 bidOrder
    if(position_qty < 0){
        await client.placeOrder(symbol, 'BID', 'BUY', null, -position_qty);
        console.log(`Placing BID BUY order`);
    }
    //만약 포지션이 양수이면 askOrder
    else if(position_qty > 0){
        await client.placeOrder(symbol, 'ASK', 'SELL', null, position_qty);
        console.log(`Placing ASK SELL order`);
    }

    return true;
}

async function placeMarketOrder(client: MainClient, symbol: string, position_qty: number){
    await client.cancelAllOrders(symbol);
    
    //만약 포지션이 음수이면 bidOrder
    if(position_qty < 0){
        await client.placeOrder(symbol, 'MARKET', 'BUY', null, -position_qty);
        console.log(`Placing MARKET BUY order`);
    }
    //만약 포지션이 양수이면 askOrder
    else if(position_qty > 0){
        await client.placeOrder(symbol, 'MARKET', 'SELL', null, position_qty);
        console.log(`Placing MARKET SELL order`);
    }

    return true;
}

async function placeLimitOrder(client: MainClient, config: StrategyConfig, openPosition: PositionResponse){
    await client.cancelAllOrders(config.symbol);

    const position_qty = openPosition.data.position_qty;
    const average_open_price = openPosition.data.average_open_price;
    const maxDeviation = average_open_price * 0.0002;

    let orderPrice = average_open_price;
    if (position_qty < 0) {
        orderPrice += maxDeviation; // Increase the price for limit buy
        orderPrice = fixPrecision(orderPrice, config.precision);
        await client.placeOrder(config.symbol, 'LIMIT', 'BUY', orderPrice, -position_qty);
        console.log(`Placing LIMIT BUY order at ${orderPrice}`);
    } else if (position_qty > 0) {
        orderPrice -= maxDeviation; // Decrease the price for limit sell
        orderPrice = fixPrecision(orderPrice, config.precision);
        await client.placeOrder(config.symbol, 'LIMIT', 'SELL', orderPrice, position_qty);
        console.log(`Placing LIMIT SELL order at ${orderPrice}`);
    }

    return true;
}

export async function riskManagement(client: MainClient, config: StrategyConfig, logger: winston.Logger, openPosition: PositionResponse){
    const position_qty = openPosition.data.position_qty;
    // const average_open_price = openPosition.data.average_open_price;
    // const mark_price = openPosition.data.mark_price;

    if (position_qty !== 0) {
        // 현재 포지션 PnL 계산
        const pnlPercentage = await calculatePnLPercentage(openPosition);
        logger.info(`Current Position PnL Percentage: ${pnlPercentage.toFixed(4)}%`);

        // 손실관리 추가 (매우 보수적인 방법)
        // average_open_price 가격에 지정가 주문
        // 대부분 한 쪽에만 걸리고 반대편 주문 체결은 잘 안됨 -> 평균가에 주문을 걸면 수수료 + 현재가와 평균가 차이만큼의 이득을 먹고 나옴.

        // 손실관리 - 표준 (0.5 ~ 1% 손실)
        if (pnlPercentage < 0 
            && config.stopLossRatio * 5 < Math.abs(pnlPercentage) 
            && Math.abs(pnlPercentage) <= config.stopLossRatio * 10) {
            logger.info(`Executing Standard Loss Management`);
            return await placeLimitOrder(client, config, openPosition);
        }

        // 손실관리 - 공격적 (1% ~ 1.5% 손실)
        if (pnlPercentage < 0 && Math.abs(pnlPercentage) > config.stopLossRatio * 10 && Math.abs(pnlPercentage) <= config.stopLossRatio * 15) {
            logger.info(`Executing Aggressive Loss Management - Limit Orders`);
            return await placeAskBidOrder(client, config.symbol, position_qty);
        }

        // 손실관리 - 극단적 (1.5% 초과 손실)
        if (pnlPercentage < 0 && Math.abs(pnlPercentage) > config.stopLossRatio * 15) {
            logger.info(`Executing Extreme Loss Management - Market Orders`);
            return await placeMarketOrder(client, config.symbol, position_qty);
        }

        // 이익실현 관리 (0.3% 이상 이익)
        if (pnlPercentage > 0 && Math.abs(pnlPercentage) >= config.takeProfitRatio) {
            logger.info(`TAKE Risk Management execute`);
            return await placeAskBidOrder(client, config.symbol, position_qty);
        }
    }
}
