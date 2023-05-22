import * as line from '@line/bot-sdk';
import { Client, GatewayIntentBits } from 'discord.js';
require('dotenv').config();

const TOKEN = process.env.DISCORD_BOT_TOKEN as string;
const LINE_TOKEN = process.env.LINE_BOT_TOKEN as string;
const TARGET_GROUP_ID = process.env.TARGET_GROUP_ID as string;

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

const line_client = new line.Client({
    channelAccessToken: LINE_TOKEN,
  });

client.on('ready', () => {
  console.log(`Logged in as ${client?.user?.tag}!`);
});

//返答
client.on('messageCreate', message => {
    if (message.author.bot) {
        return;
    }

    const line_message: line.TextMessage = {
        text: message.content,
        type: 'text',
      };

      line_client
        .pushMessage(TARGET_GROUP_ID, line_message)
        .then(() => {
          console.log('Replied to the message!');
        })
        .catch((err) => {
            console.log(err);
        });
});

client.login(TOKEN);