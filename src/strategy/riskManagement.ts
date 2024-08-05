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
        await client.placeOrder(symbol, 'LIMIT', 'BUY', null, -position_qty);
        console.log(`Placing MARKET BUY order`);
    }
    //만약 포지션이 양수이면 askOrder
    else if(position_qty > 0){
        await client.placeOrder(symbol, 'LIMIT', 'SELL', null, position_qty);
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

// 추가 전략 (보류): 먹을만큼의 갭이 되면 ASK또는 BID 주문 넣는 방법 (포지션 손절이랑 반대) -> 대신 한번에 얻는 이득 한정
export async function riskManagement(client: MainClient, config: StrategyConfig, logger: winston.Logger, openPosition: PositionResponse){
    const position_qty = openPosition.data.position_qty;

    if(position_qty !== 0){
        // logger.info(`Risk Management execute`);
        // await placeAskBidOrder(client, config.symbol, position_qty);

        //현재 포지션 pnl 계산
        const pnlPercentage = await calculatePnLPercentage(openPosition);
        logger.info(`Current Position PnL Percentage: ${pnlPercentage.toFixed(4)}%`);

        //만약 pnl이 음수이고, stopLossRatio보다 같거나 커지면 탈출
        if( pnlPercentage < 0 
            && config.stopLossRatio * 5  <= Math.abs(pnlPercentage) 
            && Math.abs(pnlPercentage) < config.stopLossRatio * 10
        ){
            logger.info(`LOSS Risk Management execute - Standard`);
            return await placeLimitOrder(client, config, openPosition);
        }

        if(pnlPercentage < 0 && Math.abs(pnlPercentage) >= config.stopLossRatio * 10){
            logger.info(`LOSS Risk Management execute - Aggressive`);
            return await placeAskBidOrder(client, config.symbol, position_qty);
            //return await placeMarketOrder(client, config.symbol, position_qty);
        }

        //만약 pnl이 양수이고, takeProfitRatio보다 같거나 커지면 탈출
        if(pnlPercentage > 0 && Math.abs(pnlPercentage) >= config.takeProfitRatio){
            logger.info(`TAKE Risk Management execute`);
            return await placeAskBidOrder(client, config.symbol, position_qty);
        }
    }
}
