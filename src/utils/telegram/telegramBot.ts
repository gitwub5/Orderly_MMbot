import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import { accountInfo } from '../../utils/account';
import { getAllPositions, getDailyVolume } from '../../lib/api/account';
import { getUsersPoints } from '../../lib/api/builder';
import { strategies } from '../../strategy/strategies';

dotenv.config();

// Replace with your Telegram bot token
const botToken = process.env.TELEGRAM_TOKEN as string;
const chatId = process.env.TELEGRAM_CHAT_ID as string; 

if (!botToken || !chatId) {
    throw new Error('TELEGRAM_TOKEN and TELEGRAM_CHAT_ID must be set in your environment variables');
}

const bot = new TelegramBot(botToken, { polling: true });

bot.on('polling_error', (error) => console.log(`Polling error: ${error.message}`));

// Log all received messages to the console
bot.on('message', (msg: TelegramBot.Message) => {
  console.log(`Received message: ${msg.text}`);
});

bot.onText(/\/start/, (msg) => {
  console.log('Received /start command');
  bot.sendMessage(msg.chat.id, "Welcome! Type 'Bot!' for help.");
});

bot.onText(/Bot!/, (msg) => {
  console.log('Received Bot! command');
  const helpMessage = `
      🤖 <b>Orderly MMBot Help</b> 🤖
      ---------------------------------
      <b>Available Commands:</b>
      /stop - Stop the bot and close all positions.
      /restart - Restart the bot & Cancel all orders and close all positions.
      ---------------------------------
  `;
  bot.sendMessage(msg.chat.id, helpMessage, { parse_mode: 'HTML' });
});

// Send Telegram Message
export async function sendTelegramMessage(): Promise<void> {
    try {
        const address = accountInfo.walletAddress; // Use the appropriate address
        const now = new Date();
        const start_date = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 24 hours ago
        const end_date = now.toISOString().split('T')[0]; // Today

        const userPoints = await getUsersPoints(address);
        const dailyVolume = await getDailyVolume(start_date, end_date);
        //TODO: 토큰 별 pnl 가져오는 함수도 구현
        const positions = await getAllPositions();
        // Filter positions to include only those in strategies
        const filteredPositions = positions.data.rows.filter((position: any) => strategies.hasOwnProperty(position.symbol));

      
        // Extract only the required fields
        const { total_points, global_rank, tier, current_epoch_points, current_epoch_rank } = userPoints.data;
        const dailyVolumeData = dailyVolume.data.map((entry: any) => `Date: ${entry.date}, Volume: ${entry.perp_volume}`).join('\n');
        const { total_pnl_24_h } = positions.data;
        const positionsData = filteredPositions.map((position: any) => `
<b>Symbol:</b> ${position.symbol}
  <b>Fee (24h):</b> ${position.fee_24_h}
  <b>PnL (24h):</b> ${position.pnl_24_h}
  <b>Position Qty:</b> ${position.position_qty}`).join('\n---------------------------------\n');


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
  ---------------------------------
  <b>Positions:</b> 
  ${positionsData}
          `;

        bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
    } catch (error) {
        console.error('Error sending Telegram message:', error);
    }
}

// Schedule to run every 30 minutes
setInterval(sendTelegramMessage, 30 * 60 * 1000);

// For initial execution
sendTelegramMessage();