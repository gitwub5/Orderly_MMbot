import { getOnePosition } from "../lib/api/account";
import { PositionResponse } from "../interfaces";
import { MainClient } from "../client/main.client";
import { StrategyConfig } from "./strategyConfig";

async function calculatePnLPercentage(openPosition : PositionResponse) {
    const { position_qty, mark_price, average_open_price } = openPosition.data;

    // const currentValue = position_qty * mark_price;
    // const initialCost = position_qty * average_open_price;
    // const pnl = currentValue - initialCost;

    //10은 레버지리 값 (account 레버리지 값 불러오는 함수 구현)
    const pnlPercentage = (mark_price - average_open_price) / average_open_price * 100 * 10;
    console.log(`Current Position PnL Percentage: ${pnlPercentage.toFixed(2)}%`);

    return pnlPercentage;
}

// //TEST
// async function main(){
//     calculatePnLPercentage(await getOnePosition('PERP_TON_USDC'));
//     }
//     main();

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

export async function riskManagement(client: MainClient, config: StrategyConfig, openPosition: PositionResponse){
    let position_qty = openPosition.data.position_qty;

    if(position_qty !== 0){
        //현재 포지션 pnl 계산
        const pnlPercentage = await calculatePnLPercentage(openPosition);

        //만약 pnl이 음수이고, stopLossRatio보다 커지면 탈출
        if(pnlPercentage < 0 && Math.abs(pnlPercentage) > config.stopLossRatio * 100){
            console.log(`Risk Management execute`)
            await placeAskBidOrder(client, config.symbol, position_qty);
            position_qty = 0;
        }
    }

    return position_qty;
}
