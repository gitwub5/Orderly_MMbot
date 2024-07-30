// import TelegramBot from 'node-telegram-bot-api';
// import dotenv from 'dotenv';

// dotenv.config();

// // Replace with your Telegram bot token
// const botToken = process.env.TELEGRAM_TOKEN as string;
// const chatId = process.env.TELEGRAM_CHAT_ID as string; // Replace with the chat ID where you want to send messages

// if (!botToken || !chatId) {
//     throw new Error('TELEGRAM_TOKEN and TELEGRAM_CHAT_ID must be set in your environment variables');
// }

// const bot = new TelegramBot(botToken, { polling: true });

// bot.on('polling_error', (error) => console.log(`Polling error: ${error.message}`));

// export async function sendTelegramMessage(
    
//   ) {
// }

// // Log all received messages to the console
// bot.on('message', (msg: TelegramBot.Message) => {
//   console.log(`Received message: ${msg.text}`);
// });

// bot.onText(/\/start/, (msg) => {
//   console.log('Received /start command');
//   bot.sendMessage(msg.chat.id, "Welcome! Type 'Bot!' for help.");
// });

// bot.onText(/Bot!/, (msg) => {
//   console.log('Received Bot! command');
//   const helpMessage = `
//       🤖 <b>Orderly MMBot Help</b> 🤖
//       ---------------------------------
//       <b>Available Commands:</b>
//       /stop - Stop the bot and close all positions.
//       /restart - Restart the bot & Cancel all orders and close all positions.
//       ---------------------------------
//   `;
//   bot.sendMessage(msg.chat.id, helpMessage, { parse_mode: 'HTML' });
// });
