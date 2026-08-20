'use strict';

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const pino = require('pino');
const qrTerminal = require('qrcode-terminal');
const { commands, commandList, resolveCommand, runCommand } = require('./commands');

const ROOT = __dirname;
const AUTH_DIR = path.join(ROOT, 'auth');
const DATABASE_DIR = path.join(ROOT, 'database');
const CUSTOM_COMMANDS_FILE = path.join(DATABASE_DIR, 'customcmd.json');
const MENU_IMAGE = path.join(ROOT, 'menu.jpg');
const PREFIX = process.env.PREFIX || '!';
const OWNER = process.env.OWNER_NUMBER || '';

function ensureStorage() {
	fs.mkdirSync(AUTH_DIR, { recursive: true });
	fs.mkdirSync(DATABASE_DIR, { recursive: true });
	if (!fs.existsSync(CUSTOM_COMMANDS_FILE)) fs.writeFileSync(CUSTOM_COMMANDS_FILE, '{}\n');
}

function loadCustomCommands() {
	try {
		const data = JSON.parse(fs.readFileSync(CUSTOM_COMMANDS_FILE, 'utf8'));
		return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
	} catch (error) {
		console.error('Could not read database/customcmd.json:', error.message);
		return {};
	}
}

function saveCustomCommands(customCommands) {
	fs.writeFileSync(CUSTOM_COMMANDS_FILE, `${JSON.stringify(customCommands, null, 2)}\n`);
}

function normaliseJid(jid = '') {
	return String(jid).replace(/:.*(?=@)/, '');
}

function getMessageText(message) {
	const content = message.message || {};
	return content.conversation || content.extendedTextMessage?.text || content.imageMessage?.caption || content.videoMessage?.caption || '';
}

function getSender(message) {
	return normaliseJid(message.key.participant || message.key.remoteJid || '');
}

function hasJpegMenu() {
	if (!fs.existsSync(MENU_IMAGE)) return false;
	const header = Buffer.alloc(2);
	try {
		const file = fs.openSync(MENU_IMAGE, 'r');
		fs.readSync(file, header, 0, 2, 0);
		fs.closeSync(file);
		return header[0] === 0xff && header[1] === 0xd8;
	} catch { return false; }
}

function createPrompt() {
	return readline.createInterface({ input: process.stdin, output: process.stdout });
}

async function createBot() {
	ensureStorage();
	const baileys = require('@whiskeysockets/baileys');
	const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = baileys;
	const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
	let version;
	try { ({ version } = await fetchLatestBaileysVersion()); } catch { version = undefined; }

	const socket = makeWASocket({
		auth: state,
		version,
		logger: pino({ level: process.env.LOG_LEVEL || 'info' }),
		browser: baileys.Browsers?.ubuntu('AURA-MINI'),
		printQRInTerminal: false
	});

	socket.ev.on('creds.update', saveCreds);
	socket.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
		if (qr) {
			console.log('\nScan this QR code with WhatsApp > Linked devices:\n');
			qrTerminal.generate(qr, { small: true });
		}
		if (connection === 'open') console.log(`AURA-MINI online with ${commandList.length} built-in commands.`);
		if (connection === 'close') {
			const code = lastDisconnect?.error?.output?.statusCode;
			if (code !== DisconnectReason.loggedOut) {
				console.log('Connection closed; reconnecting...');
				setTimeout(() => createBot().catch(console.error), 3000);
			} else console.error('WhatsApp logged out. Remove auth/ and restart to pair again.');
		}
	});

	if (process.env.PAIRING_NUMBER && !state.creds.registered) {
		const number = process.env.PAIRING_NUMBER.replace(/\D/g, '');
		const prompt = createPrompt();
		await new Promise((resolve) => setTimeout(resolve, 1000));
		try {
			const code = await socket.requestPairingCode(number);
			console.log(`Pairing code for ${number}: ${code}`);
		} finally { prompt.close(); }
	}

	const customCommands = loadCustomCommands();
	socket.ev.on('messages.upsert', async ({ messages }) => {
		for (const message of messages) {
			if (!message.message || message.key.fromMe) continue;
			const body = getMessageText(message).trim();
			if (!body.startsWith(PREFIX)) continue;
			const [name, ...args] = body.slice(PREFIX.length).trim().split(/\s+/);
			if (!name) continue;
			const commandName = name.toLowerCase();
			const sender = getSender(message);
			const remoteJid = message.key.remoteJid;
			const isGroup = remoteJid?.endsWith('@g.us') || false;
			const isOwner = OWNER && sender.startsWith(OWNER.replace(/\D/g, ''));
			const send = (text, options = {}) => socket.sendMessage(remoteJid, { text: String(text), ...options }, { quoted: message });

			if (commandName === 'addcmd') {
				if (!isOwner) return send('Owner permission required.');
				const [customName, ...response] = args;
				if (!customName || !response.length) return send(`Usage: ${PREFIX}addcmd name response`);
				customCommands[customName.toLowerCase()] = response.join(' ');
				saveCustomCommands(customCommands);
				return send(`Custom command ${customName} saved.`);
			}
			if (commandName === 'delcmd') {
				if (!isOwner) return send('Owner permission required.');
				const customName = args[0]?.toLowerCase();
				if (!customName || !customCommands[customName]) return send('Custom command not found.');
				delete customCommands[customName]; saveCustomCommands(customCommands);
				return send(`Custom command ${customName} deleted.`);
			}
			if (customCommands[commandName]) return send(customCommands[commandName]);
			if (!resolveCommand(commandName)) continue;
			if (commandName === 'menu' && hasJpegMenu()) {
				await socket.sendMessage(remoteJid, { image: { url: MENU_IMAGE }, caption: 'AURA-MINI menu' }, { quoted: message });
				continue;
			}
			const result = await runCommand(commandName, {
				args, sender, from: sender, text: args.join(' '), command: commandName,
				isGroup, isOwner: Boolean(isOwner), ownerName: OWNER || undefined,
				reply: (text) => send(text)
			});
			if (typeof result === 'string') await send(result);
		}
	});

	return socket;
}

if (require.main === module) createBot().catch((error) => {
	console.error('AURA-MINI could not start:', error.message);
	process.exitCode = 1;
});

module.exports = { createBot, ensureStorage, loadCustomCommands, saveCustomCommands, paths: { AUTH_DIR, CUSTOM_COMMANDS_FILE, MENU_IMAGE } };
