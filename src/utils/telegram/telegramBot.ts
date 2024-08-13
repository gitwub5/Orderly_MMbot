import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import { accountInfo } from '../../utils/account';
import { getAllPositions, getCurrentHolding, getDailyVolume } from '../../lib/api/account';
import { getUsersPoints } from '../../lib/api/builder';
import { strategies } from '../../strategy/strategies';
import { RestAPIUrl } from '../../enums';
import { MainClient } from '../../client/main.client';
import { cancelAllOrdersAndClosePositions } from '../../strategy/trades/closePosition';
import { setStopFlag } from '../../globals';

dotenv.config();

const botToken = process.env.TELEGRAM_TOKEN as string;
const chatId = process.env.TELEGRAM_CHAT_ID as string;

if (!botToken || !chatId) {
    throw new Error('TELEGRAM_TOKEN and TELEGRAM_CHAT_ID must be set in your environment variables');
}

const bot = new TelegramBot(botToken, { polling: true });

bot.on('polling_error', (error) => console.log(`Polling error: ${error.message}`));

bot.on('message', (msg: TelegramBot.Message) => {
    console.log(`Received message: ${msg.text}`);
});

bot.onText(/\/start/, (msg) => {
    console.log('Received /start command');
    bot.sendMessage(msg.chat.id, "Welcome! Type 'Bot!' for help.");
});

bot.onText(/\/report/, async (msg) => {
    console.log('Received /report command');
    await sendReportMessage();
});

bot.onText(/\/stop/, async (msg) => {
    console.log('Received /stop command');
    setStopFlag(true);

    const client = new MainClient(accountInfo, RestAPIUrl.mainnet);
    const symbols = Object.keys(strategies).map(key => strategies[key].symbol);
    
    for (const symbol of symbols) {
        await cancelAllOrdersAndClosePositions(client, symbol);
    }

    bot.sendMessage(msg.chat.id, 'Bot stopped and all positions closed for all symbols. No further orders will be placed.');
});

bot.onText(/\/restart/, async (msg) => {
    console.log('Received /restart command');
    setStopFlag(true);

    const client = new MainClient(accountInfo, RestAPIUrl.mainnet);
    const symbols = Object.keys(strategies).map(key => strategies[key].symbol);
    
    for (const symbol of symbols) {
        await cancelAllOrdersAndClosePositions(client, symbol);
    }
    
    bot.sendMessage(msg.chat.id, 'Bot stopped and all positions closed for all symbols. Restarting...');

    // Exit process to trigger a restart
    process.exit(1);
});

bot.onText(/Bot!/, (msg) => {
    console.log('Received Bot! command');
    const helpMessage = `
        🤖 <b>Orderly MMBot Help</b> 🤖
        ---------------------------------
        <b>Available Commands:</b>
        /report - Check out trading report
        /stop - Stop the bot and close all positions.
        /restart - Restart the bot & Cancel all orders and close all positions.
        ---------------------------------
    `;
    bot.sendMessage(msg.chat.id, helpMessage, { parse_mode: 'HTML' });
});

export async function sendReportMessage(): Promise<void> {
    try {
        const address = accountInfo.walletAddress;
        const now = new Date();
        const start_date = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const end_date = now.toISOString().split('T')[0];

        const userPoints = await getUsersPoints(address);
        const dailyVolume = await getDailyVolume(start_date, end_date);
        const positions = await getAllPositions();
        const filteredPositions = positions.data.rows.filter((position: any) => strategies.hasOwnProperty(position.symbol));
        const currentHolding = await getCurrentHolding();
        const holding = currentHolding.data.holding[0].holding.toFixed(2);
        const token = currentHolding.data.holding[0].token;

        const { total_points, global_rank, tier, current_epoch_points, current_epoch_rank } = userPoints.data;
        const dailyVolumeData = dailyVolume.data.map((entry: any) => `
    ${entry.date}: ${entry.perp_volume.toFixed(2)} USDC`).join('');
        const { total_pnl_24_h } = positions.data;
        const positionsData = filteredPositions.map((position: any) => `
    <b>Symbol:</b> ${position.symbol}
    <b>Fee (24h):</b> ${position.fee_24_h}
    <b>PnL (24h):</b> ${position.pnl_24_h}
    <b>Unsettled PnL:</b> ${position.unsettled_pnl}`).join('\n');

        const message = `
    📊 <b>Orderly MMBot Report</b> 📊
    ---------------------------------
    <b>Total Points:</b> ${total_points}
    <b>Global Rank:</b> ${global_rank}
    <b>Tier:</b> ${tier}
    <b>Current Epoch Points:</b> ${current_epoch_points}
    <b>Current Epoch Rank:</b> ${current_epoch_rank}
    ---------------------------------
    <b>Daily Volume:</b> 
    ${dailyVolumeData}
    ---------------------------------
    <b>Total PnL (24h):</b> ${total_pnl_24_h}
    <b>Positions Info:</b> 
    <b>Current Holding:</b> ${holding} ${token} 
    ${positionsData}
        `;

        bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
    } catch (error) {
        console.error('Error sending Telegram message:', error);
    }
}

export function startPeriodicMessages() {
    setInterval(sendReportMessage, 3600000);
}