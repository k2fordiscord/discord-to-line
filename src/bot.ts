import * as line from '@line/bot-sdk';
import { Client, GatewayIntentBits, Partials } from 'discord.js';
require('dotenv').config();

const TOKEN = process.env.DISCORD_BOT_TOKEN as string;
const LINE_TOKEN = process.env.LINE_BOT_TOKEN as string;
const TARGET_GROUP_ID = process.env.TARGET_GROUP_ID as string;

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildBans,
		GatewayIntentBits.GuildEmojisAndStickers,
		GatewayIntentBits.GuildIntegrations,
		GatewayIntentBits.GuildWebhooks,
		GatewayIntentBits.GuildInvites,
		GatewayIntentBits.GuildVoiceStates,
		GatewayIntentBits.GuildPresences,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.GuildMessageReactions,
		GatewayIntentBits.GuildMessageTyping,
		GatewayIntentBits.DirectMessages,
		GatewayIntentBits.DirectMessageReactions,
		GatewayIntentBits.DirectMessageTyping,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildScheduledEvents,
	],
	partials: [
		Partials.User,
		Partials.Channel,
		Partials.GuildMember,
		Partials.Message,
		Partials.Reaction,
		Partials.GuildScheduledEvent,
		Partials.ThreadMember,
	],
}); //clientインスタンスを作成する

const line_client = new line.Client({
    channelAccessToken: LINE_TOKEN,
  });

client.on('ready', () => {
  console.log(`Logged in as ${client?.user?.tag}!`);
});

client.on('messageCreate', message => {
    if (message.author.bot) {
        return;
    }

    console.log(message.thread);

    console.log(message.thread?.messageCount);
    
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

// client.on('threadCreate', message => {
//     console.log(message.messages);
//     const line_message: line.TextMessage = {
//         text: `${message.name}\n${message.messages}`,
//         type: 'text',
//       };

//       line_client
//         .pushMessage(TARGET_GROUP_ID, line_message)
//         .then(() => {
//           console.log('Replied to the message!');
//         })
//         .catch((err) => {
//             console.log(err);
//         });
// });

client.login(TOKEN);