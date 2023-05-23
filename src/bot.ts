import { Client as LineClient } from '@line/bot-sdk';
import { Client as DiscordClient, GatewayIntentBits, Partials } from 'discord.js';

require('dotenv').config();

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN as string;
const LINE_BOT_TOKEN = process.env.LINE_BOT_TOKEN as string;
const TARGET_GROUP_ID = process.env.TARGET_GROUP_ID as string;

const discord_client = new DiscordClient({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMembers,
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
});

const line_client = new LineClient({
	channelAccessToken: LINE_BOT_TOKEN,
});

discord_client.on('ready', () => {
	console.log(`Logged in as ${discord_client?.user?.tag}!`);
});

discord_client.on('threadCreate', thread =>
	thread.fetchStarterMessage().then((message) => {
		if (!message) return;

		const text = message ? `${thread.name}\n${message.content}` : thread.name;

		line_client
			.pushMessage(TARGET_GROUP_ID, { text, type: 'text' })
			.then(() => {
				console.log('send the message!');
			})
			.catch((err) => {
				console.log(err);
			});
	}).catch((err) => {
		console.log(err);
	})
);

discord_client.login(DISCORD_BOT_TOKEN);