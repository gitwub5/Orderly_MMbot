import { getOnePosition } from "../lib/api/account";
import { PositionResponse } from "../interfaces";
import { MainClient } from "../client/main.client";
import { StrategyConfig } from "./strategyConfig";
import winston from 'winston';

async function calculatePnLPercentage(openPosition : PositionResponse) {
    const { position_qty, mark_price, average_open_price } = openPosition.data;

    // const currentValue = position_qty * mark_price;
    // const initialCost = position_qty * average_open_price;
    // const pnl = currentValue - initialCost;

    let pnlPercentage = 0;
    //10은 레버지리 값 (TODO: account 레버리지 값 불러오는 함수 구현)
    if (position_qty > 0) { // Long position
        pnlPercentage = ((mark_price - average_open_price) / average_open_price) * 100 * 10;
    } else if (position_qty < 0) { // Short position
        pnlPercentage = ((average_open_price - mark_price) / average_open_price) * 100 * 10;
    } else {
        pnlPercentage = 0; // No position
    }

    return pnlPercentage;
}

async function placeAskBidOrder(client: MainClient, symbol: string, position_qty: number){
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
}

export async function riskManagement(client: MainClient, config: StrategyConfig, logger: winston.Logger, openPosition: PositionResponse){
    const position_qty = openPosition.data.position_qty;

    if(position_qty !== 0){
        //현재 포지션 pnl 계산
        const pnlPercentage = await calculatePnLPercentage(openPosition);
        logger.info(`Current Position PnL Percentage: ${pnlPercentage.toFixed(2)}%`);

        //만약 pnl이 음수이고, stopLossRatio보다 커지면 탈출
        if(pnlPercentage < 0 && Math.abs(pnlPercentage) > config.stopLossRatio * 100){
            logger.info(`Risk Management execute`)
            await placeAskBidOrder(client, config.symbol, position_qty);
        }
    }
}
