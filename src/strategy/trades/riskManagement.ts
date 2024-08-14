import winston from 'winston';
import { PositionResponse } from "../../interfaces/response";
import { MainClient } from "../../client/main.client";
import { StrategyConfig } from "../../interfaces/strategy";
import { fixPrecision } from '../../utils/fixPrecision';

async function calculatePnLPercentage(openPosition : PositionResponse) {
    const { position_qty, mark_price, average_open_price } = openPosition.data;

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
    //만약 포지션이 음수이면 bidOrder
    if(position_qty < 0){
        await client.placeOrder(symbol, 'BID', 'BUY', null, -position_qty,
            //{ body: JSON.stringify({ reduce_only: true })}
        );
        console.log(`Placing BID BUY order`);
    }
    //만약 포지션이 양수이면 askOrder
    else if(position_qty > 0){
        await client.placeOrder(symbol, 'ASK', 'SELL', null, position_qty, 
           // { body: JSON.stringify({reduce_only: true })}
        );
        console.log(`Placing ASK SELL order`);
    }

    return true;
}

async function placeMarketOrder(client: MainClient, symbol: string, position_qty: number){
    //만약 포지션이 음수이면 bidOrder
    if(position_qty < 0){
        await client.placeOrder(symbol, 'MARKET', 'BUY', null, -position_qty, {
            body: JSON.stringify({ reduce_only: true })});
        console.log(`Placing MARKET BUY order`);
    }
    //만약 포지션이 양수이면 askOrder
    else if(position_qty > 0){
        await client.placeOrder(symbol, 'MARKET', 'SELL', null, position_qty, {
            body: JSON.stringify({ reduce_only: true })});
        console.log(`Placing MARKET SELL order`);
    }

    return true;
}

async function placeLimitOrderToClose(client: MainClient, config: StrategyConfig, openPosition: PositionResponse){
    const position_qty = openPosition.data.position_qty;
    const average_open_price = openPosition.data.average_open_price;
    const maxDeviation = average_open_price * 0.0002;

    let orderPrice = average_open_price;
    if (position_qty < 0) {
        orderPrice += maxDeviation; // Increase the price for limit buy
        orderPrice = fixPrecision(orderPrice, config.precision);
        await client.placeOrder(config.symbol, 'LIMIT', 'BUY', orderPrice, -position_qty, {
            body: JSON.stringify({ reduce_only: true,  visible_quantity: 0 })});
        console.log(`Placing LIMIT BUY order at ${orderPrice}`);
    } else if (position_qty > 0) {
        orderPrice -= maxDeviation; // Decrease the price for limit sell
        orderPrice = fixPrecision(orderPrice, config.precision);
        await client.placeOrder(config.symbol, 'LIMIT', 'SELL', orderPrice, position_qty, {
            body: JSON.stringify({ reduce_only: true,  visible_quantity: 0 })});
        console.log(`Placing LIMIT SELL order at ${orderPrice}`);
    }

    return true;
}


async function placeLimitOrderToTake(client: MainClient, config: StrategyConfig, openPosition: PositionResponse){
    const position_qty = openPosition.data.position_qty;
    const average_open_price = openPosition.data.average_open_price;
    const maxDeviation = average_open_price * 0.0006;

    let orderPrice = average_open_price;
    if (position_qty < 0) {
        orderPrice += maxDeviation; // Increase the price for limit buy
        orderPrice = fixPrecision(orderPrice, config.precision);
        await client.placeOrder(config.symbol, 'LIMIT', 'BUY', orderPrice, -position_qty );
        console.log(`Placing LIMIT BUY order at ${orderPrice}`);
    } else if (position_qty > 0) {
        orderPrice -= maxDeviation; // Decrease the price for limit sell
        orderPrice = fixPrecision(orderPrice, config.precision);
        await client.placeOrder(config.symbol, 'LIMIT', 'SELL', orderPrice, position_qty );
        console.log(`Placing LIMIT SELL order at ${orderPrice}`);
    }

    return true;
}

export async function riskManagement(client: MainClient, config: StrategyConfig, logger: winston.Logger, openPosition: PositionResponse){
    const position_qty = openPosition.data.position_qty;

    // 열려있는 포지션이 10달러미만인 경우
    if( position_qty !== 0 || Math.abs(openPosition.data.position_qty * openPosition.data.average_open_price) < 10 ){
        const pnlPercentage = await calculatePnLPercentage(openPosition);
        if( pnlPercentage > 0.0003 ){
            return await placeMarketOrder(client, config.symbol, position_qty);
        }
    }

    if (position_qty !== 0 || Math.abs(openPosition.data.position_qty * openPosition.data.average_open_price) > 10) {
        // 현재 포지션 PnL 계산
        const pnlPercentage = await calculatePnLPercentage(openPosition);
        logger.info(`Current Position PnL Percentage: ${pnlPercentage.toFixed(4)}%`);

        // 손실관리 - 표준 (0.1% 미만 손실)
        if (pnlPercentage < 0 
            && Math.abs(pnlPercentage) < config.stopLossRatio) {
            logger.info(`Executing Standard Loss Management`);
            await client.cancelAllOrders(config.symbol);
            return await placeLimitOrderToClose(client, config, openPosition);
            //return await placeMarketOrder(client, config.symbol, position_qty);
            //return await placeAskBidOrder(client, config.symbol, position_qty);
        }

        // 손실관리 - 공격적 (0.1% 이상 손실)
        if (pnlPercentage < 0 && Math.abs(pnlPercentage) >= config.stopLossRatio) {
            logger.info(`Executing Aggressive Loss Management - MARKET Orders`);
            await client.cancelAllOrders(config.symbol);
            return await placeMarketOrder(client, config.symbol, position_qty);
        }

        // 이익실현 관리
        if (pnlPercentage >= 0 && Math.abs(pnlPercentage) < config.takeProfitRatio) {
            logger.info(`TAKE Risk Management execute`);
            await client.cancelAllOrders(config.symbol);
            await placeLimitOrderToTake(client, config, openPosition);
            return await placeAskBidOrder(client, config.symbol, position_qty);
            
        }

        // 이익실현 관리 1% 이상
        if (pnlPercentage >= 0 && Math.abs(pnlPercentage) >= config.takeProfitRatio){
            logger.info(`TAKE Risk Management execute`);
            await client.cancelAllOrders(config.symbol);
            return await placeMarketOrder(client, config.symbol, position_qty);
        }
    }
}
