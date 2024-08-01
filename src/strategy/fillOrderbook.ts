import { MainClient } from "../client/main.client";
import { fixPrecision } from "../utils/fixPrecision";
import { StrategyConfig } from "./strategyConfig";
import winston from 'winston';

// 오더북을 채우는 함수
export async function fillOrderBook(client: MainClient, config: StrategyConfig, logger: winston.Logger ) {
    const { symbol, orderQuantity, orderLevels, orderSpacing } = config;

    console.log('Retrieving market trades...');
    const tickerData = await client.getMarketTrades(symbol);
    console.log('Market trades data:', tickerData);

    const lastPrice = tickerData.data.rows[0].executed_price;
    console.log('Last executed price:', lastPrice);

    console.log('Canceling all existing orders...');
    await client.cancelAllOrders(symbol);

    console.log('Placing orders...');
    for (let level = 1; level <= orderLevels; level++) {
        const priceOffset = lastPrice * orderSpacing * level;
        let buyPrice = lastPrice - priceOffset;
        let sellPrice = lastPrice + priceOffset;

        buyPrice = fixPrecision(buyPrice, 4);
        sellPrice = fixPrecision(sellPrice, 4);

        console.log(`Level ${level} - Buy Price: ${buyPrice}, Sell Price: ${sellPrice}`);

        if (buyPrice < lastPrice * 0.95) {
            console.log(`Placing BUY order - Price: ${buyPrice}, Quantity: ${orderQuantity}`);
            await client.placeOrder(symbol, 'LIMIT', 'BUY', buyPrice, orderQuantity);
        }

        if (sellPrice > lastPrice * 1.05) {
            console.log(`Placing SELL order - Price: ${sellPrice}, Quantity: ${orderQuantity}`);
            await client.placeOrder(symbol, 'LIMIT', 'SELL', sellPrice, orderQuantity);
        }
    }
}