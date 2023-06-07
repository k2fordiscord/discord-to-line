import express from "express";
import { Client as LineClient, middleware } from "@line/bot-sdk";
import {
	Client as DiscordClient,
	GatewayIntentBits,
} from "discord.js";

require("dotenv").config();

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN as string;
const LINE_BOT_TOKEN = process.env.LINE_BOT_TOKEN as string;
const TARGET_GROUP_ID = process.env.TARGET_GROUP_ID as string;

// パラメータ設定
const LINE_CONFIG = {
	channelAccessToken: LINE_BOT_TOKEN, // 環境変数からアクセストークンをセットしています
	channelSecret: process.env.LINE_CHANNEL_SECRET as string, // 環境変数からChannel Secretをセットしています
};

const discord_client = new DiscordClient({
	intents: [
		GatewayIntentBits.Guilds, // ThreadCreateのために必要
		GatewayIntentBits.MessageContent, // fetchStarterMessage()でmessageの中身を読むのに必要（特権のため管理画面からの許可がないとエラー）
	],
	partials: [],
});

const line_client = new LineClient({
	channelAccessToken: LINE_BOT_TOKEN,
});

function line_send_message(text: string) {
	line_client
		.pushMessage(TARGET_GROUP_ID, { text, type: "text" })
		.then(() => {
			console.log(`Message sent to ${TARGET_GROUP_ID} completed.`);
		})
		.catch((err) => {
			console.error(err);
		});
}

function thread_create_text(title: string, username?: string, content?: string) {
	const text = (!username || !content) ? title : `${title}\n投稿者: ${username}\n\n${content}`;

	return `新しい同行者募集が登録されました！\n\n${text}\n\n気になる方はdiscordへ！`;
}

function thread_reopen_text(title: string) {
	return `下記の同行者募集が再開されました！\n\n${title}\n\n気になる方はdiscordへ！`;
}

function thread_close_text(title: string) {
	return `下記の同行者募集が〆切られました！\n\n${title}`;
}

discord_client.on("ready", () => {
	console.log(`Logged in as ${discord_client?.user?.tag}!`);
});

discord_client.on("threadCreate", (thread) => {
	console.log("Thread created.");

	thread
		.fetchStarterMessage()
		.then((message) => {
			if (message) {
				console.log("title: ", thread.name, ", username: ", message.author.username, ", message: ", message.content);
			} else {
				console.log("title: ", thread.name);
			}

			line_send_message(thread_create_text(thread.name, message?.author.username, message?.content));
		})
		.catch((err) => {
			console.error(err);
		});
});

discord_client.on("threadUpdate", (oldThread, newThread) => {
	if (oldThread.name.charAt(0) === '〆' && newThread.name.charAt(0) !== '〆') {
		line_send_message(thread_reopen_text(newThread.name));
	} else if (oldThread.name.charAt(0) !== '〆' && newThread.name.charAt(0) === '〆') {
		line_send_message(thread_close_text(oldThread.name));
	}
});

discord_client.login(DISCORD_BOT_TOKEN);

const app: express.Express = express();

app.listen(process.env.PORT || 3000, () => {
	console.log(`Start on port ${process.env.PORT || 3000}.`);
});

// サーバーを落とさないためのダミーリクエストを送る場所
app.get("/dummy", (req, res, next) => {
	res.sendStatus(200);
	console.log(`Dummy request received. time=`, new Date().toISOString());
});

// LINEのWebhookを受け取る場所
app.post("/webhook", middleware(LINE_CONFIG), (req, res) => {
	Promise.all(req.body.events.map(handleEvent)).then((result) =>
		res.json(result)
	);
});

async function handleEvent(event: any) {
	if (event.type !== "message" || event.message.type !== "text") {
		return Promise.resolve(null);
	}

	// 応答用Token
	const replyToken = event.replyToken;

	// typeを取得 
	const type = event.source.type;

	// typeを判定して、idを取得
	let id = getIdFromType(type, event);
	if (id === null) return Promise.resolve(null);

	const text = type + '_id = ' + id;
	console.log("receive message from " + text);

	if (event.message.text !== ':get_id') return Promise.resolve(null);

	return line_client.replyMessage(replyToken, { text, type: "text" });
}

function getIdFromType(type: string, event: any) {
	switch (type) {
		case 'user':
			return event.source.userId;
		case 'group':
			return event.source.groupId;
		case 'room':
			return event.source.roomId;
		default:
			return null;
	}
}