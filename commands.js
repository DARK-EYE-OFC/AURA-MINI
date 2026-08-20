/*
 * AURA-MINI command registry.
 *
 * Handlers accept a context object and return a string (or an object with a
 * `text` property). A bot adapter can pass its own `reply`, `send`, and
 * `isOwner` functions without this module depending on a messaging library.
 */
'use strict';

const startedAt = Date.now();
const commandState = new Map();
const economy = new Map();

const getArgs = (ctx = {}) => Array.isArray(ctx.args)
	? ctx.args.map(String)
	: String(ctx.text || '').trim().split(/\s+/).filter(Boolean);
const textOf = (ctx) => getArgs(ctx).join(' ');
const senderOf = (ctx) => String(ctx.sender || ctx.from || 'user');
const reply = (ctx, text) => typeof ctx.reply === 'function' ? ctx.reply(String(text)) : String(text);
const pick = (items) => items[Math.floor(Math.random() * items.length)];
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const userAccount = (id) => {
	if (!economy.has(id)) economy.set(id, { balance: 250, xp: 0, inventory: [], lastDaily: 0 });
	return economy.get(id);
};

function localHandler(fn) {
	return (ctx = {}) => reply(ctx, fn(ctx));
}

function externalHandler(service) {
	return localHandler((ctx) => {
		const query = textOf(ctx);
		return query
			? `I can't access ${service} from the built-in handler yet. Query received: ${query}`
			: `Send a query after the command to use ${service}.`;
	});
}

const commands = {};
const add = (names, handler, description = '') => names.forEach((name) => {
	commands[name] = { name, description, execute: handler, handler };
});

add(['ping'], localHandler(() => `Pong! ${Date.now() - startedAt}ms`), 'Check whether the bot is alive');
add(['runtime'], localHandler(() => {
	const seconds = Math.floor((Date.now() - startedAt) / 1000);
	return `Runtime: ${Math.floor(seconds / 3600)}h ${Math.floor(seconds / 60) % 60}m ${seconds % 60}s`;
}), 'Show bot runtime');
add(['date'], localHandler(() => new Date().toLocaleDateString()), 'Show today\'s date');
add(['time'], localHandler(() => new Date().toLocaleTimeString()), 'Show the current time');
add(['version'], localHandler(() => 'AURA-MINI v1.0.0'), 'Show bot version');
add(['about'], localHandler(() => 'AURA-MINI: a lightweight, extensible assistant bot.'), 'About the bot');
add(['owner'], localHandler((ctx) => ctx.ownerName ? `Owner: ${ctx.ownerName}` : 'Owner information is not configured.'), 'Show the bot owner');
add(['status'], localHandler(() => `Online. ${Object.keys(commands).length} commands loaded.`), 'Show bot status');
add(['menu', 'help'], localHandler(() => `AURA-MINI commands (${Object.keys(commands).length})\nUse your prefix followed by a command. Try: ping, joke, calculator, balance.`), 'Show command help');
add(['rules'], localHandler(() => 'Be respectful, avoid spam, and follow the group or community rules.'), 'Show rules');
add(['donate'], localHandler(() => 'Donation details are not configured.'), 'Donation information');
add(['stats'], localHandler(() => `Commands loaded: ${Object.keys(commands).length}\nAccounts: ${economy.size}`), 'Show statistics');
add(['github'], externalHandler('GitHub'), 'Search GitHub or show the configured repository');
add(['report', 'suggest', 'feedback'], localHandler((ctx) => textOf(ctx) ? 'Thanks, your message was received.' : 'Please include your message after the command.'), 'Send feedback');
add(['language', 'prefix', 'blocklist', 'invite'], localHandler(() => 'This setting is not configured yet.'), 'Bot configuration');
add(['speed'], localHandler(() => `Speed: ${Date.now() - startedAt}ms`), 'Measure response speed');

add(['joke'], localHandler(() => pick(['Why do programmers prefer dark mode? Because light attracts bugs.', 'There are 10 kinds of people: those who understand binary and those who do not.'])), 'Tell a joke');
add(['meme', 'quote', 'fact', 'truth', 'dare', 'roast', 'compliment', 'pickup', 'wouldyou', 'riddle'], localHandler((ctx) => {
	const values = {
		meme: 'When the code works on the first try: suspicious.', quote: 'Make it work, make it right, make it fast.', fact: 'A group of flamingos is called a flamboyance.',
		truth: 'What is one small thing you have been putting off?', dare: 'Send your last used emoji.', roast: 'Your code has potential. It is currently expressing it very quietly.',
		compliment: 'You have excellent taste in bots.', pickup: 'Are you a semicolon? You complete me.', wouldyou: 'Would you rather always have perfect Wi-Fi or perfect battery?', riddle: 'What has keys but cannot open locks? A keyboard.'
	};
	return values[ctx.command] || values[ctx.args?.[0]] || values.fact;
}), 'Fun conversation prompt');
add(['8ball'], localHandler((ctx) => textOf(ctx) ? pick(['Yes.', 'No.', 'Probably.', 'Ask again later.', 'Absolutely.']) : 'Ask a yes/no question.'), 'Ask the magic 8-ball');
add(['roll'], localHandler((ctx) => { const sides = clamp(Number(getArgs(ctx)[0]) || 6, 2, 1000); return `You rolled ${1 + Math.floor(Math.random() * sides)} (d${sides}).`; }), 'Roll dice');
add(['flip'], localHandler(() => pick(['Heads', 'Tails'])), 'Flip a coin');
add(['rate', 'howgay', 'howcute', 'howdumb'], localHandler((ctx) => `${textOf(ctx) || 'That'} is rated ${Math.floor(Math.random() * 101)}%.`), 'Give a playful rating');
add(['ship'], localHandler((ctx) => { const people = getArgs(ctx); return people.length >= 2 ? `${people[0]} + ${people[1]} = ${Math.floor(Math.random() * 101)}% compatibility.` : 'Mention two names to ship.'; }), 'Rate compatibility');
add(['kill', 'hug', 'slap', 'pat', 'kiss', 'cuddle'], localHandler((ctx) => `${pick(['You', 'AURA-MINI'])} ${ctx.command || getArgs(ctx)[0]} ${textOf(ctx) || 'everyone'}!`), 'Playful action');
add(['tictactoe', 'hangman', 'trivia', 'guessnum', 'emojigame'], localHandler(() => 'Game started. Game sessions need a messaging adapter to receive the next move.'), 'Start a game');

add(['calculator'], localHandler((ctx) => {
	const expression = textOf(ctx);
	if (!expression || !/^[0-9+\-*/%().\s]+$/.test(expression)) return 'Use calculator with a numeric expression, for example: calculator 2 + 2';
	try { return `Result: ${Function(`"use strict"; return (${expression})`)()}`; } catch { return 'That expression could not be calculated.'; }
}), 'Calculate a numeric expression');
add(['qr', 'shorturl', 'ip', 'font', 'weather', 'translate', 'lyrics', 'currency', 'ssweb', 'readqr'], externalHandler('the requested service'), 'Use an external utility service');
add(['timer'], localHandler((ctx) => { const seconds = clamp(Number(getArgs(ctx)[0]) || 0, 1, 86400); return `Timer set for ${seconds} seconds. Your adapter should schedule the notification.`; }), 'Set a timer');

add(['balance', 'daily', 'work', 'rob', 'slot', 'bet', 'fish', 'hunt', 'weekly', 'beg', 'pay', 'shop', 'buy', 'sell', 'inventory', 'level', 'rank', 'xp', 'claim', 'gift'], localHandler((ctx) => {
	const account = userAccount(senderOf(ctx));
	if (ctx.command === 'balance') return `Balance: ${account.balance} coins | XP: ${account.xp}`;
	if (ctx.command === 'inventory') return account.inventory.length ? `Inventory: ${account.inventory.join(', ')}` : 'Inventory is empty.';
	if (ctx.command === 'level' || ctx.command === 'xp') return `XP: ${account.xp} | Level: ${Math.floor(account.xp / 100) + 1}`;
	if (ctx.command === 'rank') return `Rank: ${Math.floor(account.xp / 100) + 1}`;
	if (ctx.command === 'daily') { if (Date.now() - account.lastDaily < 86400000) return 'Daily reward already claimed.'; account.lastDaily = Date.now(); account.balance += 100; account.xp += 20; return 'Daily reward: +100 coins and +20 XP.'; }
	const amount = clamp(Number(getArgs(ctx)[0]) || 25, 1, 10000); account.balance += ctx.command === 'rob' ? (Math.random() > .5 ? amount : -amount) : amount; account.xp += 5;
	return `${ctx.command}: ${account.balance} coins available.`;
}), 'Economy command');

const externalNames = 's sticker simage svid sgif attp ttp toimg tovideo tomp3 togif removebg blur bright invert grayscale circle logo quoteimg picedit yt ytmp3 tiktok insta fb twitter play song movie series video apk pinterest google img wallpaper news tovid'.split(' ');
add(externalNames, externalHandler('the media service'), 'Process or fetch media');
const groupNames = 'kick ban unban mute unmute promote demote add tagall hidetag groupinfo grouplink revoke setname setdesc setpp closegc opengc antilink antibadword welcome leave warn unwarn warnings kickall promoteall demoteall'.split(' ');
add(groupNames, localHandler((ctx) => ctx.isGroup === false ? 'This command can only be used in a group.' : `${ctx.command}: group permissions and messaging adapter are required.`), 'Group management command');
const ownerNames = 'eval exec broadcast banchat unbanchat setprefix clearchat restart shutdown join leavegc block unblock backup restore setbio setnamebot setbotpic autojoin autoleave pair'.split(' ');
add(ownerNames, localHandler((ctx) => ctx.isOwner === false ? 'Owner permission required.' : `${ctx.command}: owner action is ready for the bot adapter.`), 'Owner command');
const aiNames = 'ai chatgpt gpt3 gpt4 gpt5 gemini claude bard copilot beta grok grokbeta deepseek lovable base44 perplexity mistral dolly lumin kimi brain meta sora suno aisong aivideo story write essay code explain summarize rephrase grammar airoast girlfriend boyfriend character advice motivate therapist study'.split(' ');
add(aiNames, externalHandler('an AI provider'), 'Ask an AI provider');
add(['quran', 'bible', 'prayer'], externalHandler('the configured religious reference'), 'Religious reference');
add(['afk', 'poll', 'mode', 'darkeye'], localHandler((ctx) => textOf(ctx) ? `Saved: ${textOf(ctx)}` : `${ctx.command}: please provide a value.`), 'Miscellaneous command');

const commandList = Object.freeze(Object.keys(commands));
function resolveCommand(name) { return commands[String(name || '').toLowerCase().replace(/^[/!.#]/, '')]; }
async function runCommand(name, context = {}) {
	const command = resolveCommand(name) || resolveCommand(context.command);
	if (!command) return reply(context, `Unknown command: ${name}`);
	return command.execute({ ...context, command: command.name });
}

module.exports = { commands, commandList, resolveCommand, runCommand, state: { commandState, economy } };
