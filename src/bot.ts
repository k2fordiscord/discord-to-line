import express from "express";
import { Client as LineClient, middleware } from "@line/bot-sdk";
import {
	AnyThreadChannel,
	Client as DiscordClient,
	GatewayIntentBits,
	Message,
	Options,
} from "discord.js";
import axios from 'axios';
import qs from 'querystring';

require("dotenv").config();

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN as string;
const LINE_BOT_TOKEN = process.env.LINE_BOT_TOKEN as string;
const TARGET_THREAD_NAME = process.env.TARGET_THREAD_NAME as string;
const LINE_NOTIFY_TOKENS = (process.env.LINE_NOTIFY_TOKENS as string).split(/[ ,]+/);
const LINE_NOTIFY_API_URL = 'https://notify-api.line.me/api/notify';

const WAIT_SEC = 1; // discordのスレッド作成時にstarterMessageの作成を待つ時間
const MAX_RETRY_COUNT = 3;

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
	makeCache: Options.cacheWithLimits({
		...Options.DefaultMakeCacheSettings,
		GuildMemberManager: 0, // ユーザーの「サーバーニックネーム」が変更されたときにすぐ反映するためキャッシュをオフにしている
	}),
});

const line_client = new LineClient({
	channelAccessToken: LINE_BOT_TOKEN,
});

function line_send_message(message: string) {
	LINE_NOTIFY_TOKENS.map((token) => {
		const notify_config = {
			url: LINE_NOTIFY_API_URL,
			method: 'post',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				'Authorization': 'Bearer ' + token
			},
			data: qs.stringify({
				message: message,
			})
		}

		axios.request(notify_config).then((responseLINENotify) => {
			console.log("line notify status: " + responseLINENotify.data.status);
		}).catch((error) => {
			console.error(error);
		})
	})
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

async function fetch_thread_starter_message(thread: AnyThreadChannel<boolean>, retryCount: number = 0): Promise<Message<true> | null> {
	if (retryCount >= MAX_RETRY_COUNT) return null;

	await new Promise((resolve) => setTimeout(resolve, WAIT_SEC * 1000)); // {WAIT_SEC}秒待機

	return await thread.fetchStarterMessage().catch(() => fetch_thread_starter_message(thread, retryCount + 1)); // 失敗したら再帰
}

discord_client.on("ready", () => {
	console.log(`Logged in as ${discord_client?.user?.tag}!`);
});

discord_client.on("threadCreate", async (thread) => {
	console.log("Thread created.");
	if (thread.parent?.name !== TARGET_THREAD_NAME) {
		console.log("This thread is not a target. name=", thread.parent?.name);
		return;
	}

	const message = await fetch_thread_starter_message(thread);
	if (!message) {
		console.error("starter messageが取得できませんでした。");
		return;
	}

	const member = await message.guild.members.fetch(message.author);
	console.log("title: ", thread.name, ", username: ", member.displayName, ", message: ", message?.content);

	line_send_message(thread_create_text(thread.name, member.displayName, message?.content));
});

discord_client.on("threadUpdate", (oldThread, newThread) => {
	console.log("Thread updated.");
	if (newThread.parent?.name !== TARGET_THREAD_NAME) {
		console.log("This thread is not a target. name=", newThread.parent?.name);
		return;
	}

	if (oldThread.name.charAt(0) === '〆' && newThread.name.charAt(0) !== '〆') {
		console.log("thread closed! name: ", newThread.name);
		line_send_message(thread_reopen_text(newThread.name));
	} else if (oldThread.name.charAt(0) !== '〆' && newThread.name.charAt(0) === '〆') {
		console.log("thread reopen! name: ", oldThread.name);
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