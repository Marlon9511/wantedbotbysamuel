import { makeWASocket, useMultiFileAuthState } from "@angstvorfrauen/baileys";
import pino from "pino";
import readline from "readline";
import chalk from "chalk";
import gradient from "gradient-string";

import * as mainModule from "./main.js";
const { handleCommands, handleGroupParticipants, botConfig, loadAutoMessages, isOwner } = mainModule;


let isGroup = (jid) => jid.endsWith("@g.us");
const messageCache = {};

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

const MAX_LOG = 99;
const messageLog = [];


const jidToPhone = (jid) => jid?.includes("@s.whatsapp.net") ? `+${jid.split("@")[0]}` : jid || "";

const jidToGroupName = async (sock, jid) => {
    if (!jid) return "Unbekannte Gruppe";
    try {
        const metadata = await sock.groupMetadata(jid);
        return metadata.subject || "Gruppe";
    } catch {
        return jid;
    }
};

const renderDashboard = () => {
    console.clear();
    console.log(chalk.bold(gradient.rainbow("📱 ᭙ꪖ᭢ᡶꫀᦔꪖకꪖ WhatsApp Bot Dashboard")));
    console.log(chalk.gray("──────────────────────────────────────────"));

    if (!messageLog.length) console.log(chalk.gray("Keine Nachrichten"));
    else messageLog.forEach(line => console.log(line));

    console.log(chalk.gray("──────────────────────────────────────────"));
};

const logMessage = async (sock, groupJid, senderJid, text, type = "msg") => {
    const senderDisplay = jidToPhone(senderJid);
    const time = new Date().toLocaleTimeString("de-DE", { hour12: false });
    const groupName = isGroup(groupJid) ? await jidToGroupName(sock, groupJid) : "Privatchat";

    const typeIcons = {
        msg: "🔹",
        sticker: "🎴",
        media: "🖼️",
        afk: "⛔",
        command: "⚡"
    };

    const typeColors = {
        msg: chalk.white,
        sticker: chalk.magenta,
        media: chalk.cyan,
        afk: chalk.red,
        command: chalk.yellowBright
    };

    const typeLabels = {
        msg: "",
        sticker: "[Sticker]",
        media: "[Media]",
        afk: "[AFK]",
        command: "[Befehl]"
    };

    const icon = isGroup(groupJid) ? "👥" : typeIcons[type];

    const line = typeColors[type](`${icon} [${time}] ${senderDisplay} @ ${groupName} ${typeLabels[type]} » ${text}`);

    messageLog.push(line);

    if (messageLog.length > MAX_LOG) messageLog.shift();

    renderDashboard();
};

//=========================//
// Connect Bot + Pairing-Code
//=========================//
async function connectBot() {
    const { state, saveCreds } = await useMultiFileAuthState("./auth");

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: "silent" })
    });

    if (!sock.authState.creds.registered) {
        let phoneNumber = await question(gradient("#ff0000", "#C00000")("📲 Deine Nummer (inkl. Ländervorwahl, z.B. +49123456789): "));
        phoneNumber = phoneNumber.replace(/[^0-9]/g, "");

        let code = await sock.requestPairingCode(phoneNumber, "AAAAAAAA");
        code = code?.match(/.{1,4}/g)?.join("-") || code;
        console.log(gradient("#ff0000", "#C00000")("🔑 Pairing Code: " + code));
    }

    sock.ev.on("connection.update", (update) => {
        const { connection } = update;
        if (connection === "close") {
            console.log(chalk.red("❌ Verbindung geschlossen, reconnect..."));
            setTimeout(connectBot, 5000);
        } else if (connection === "open") {
            console.log(chalk.green("✅ ᭙ꪖ᭢ᡶꫀᦔꪖకꪖ Verbunden mit WhatsApp!"));
            console.log(chalk.green("-----------------------------------------"));
            console.log(chalk.yellowBright("⚡᭙ꪖ᭢ᡶꫀᦔꪖకꪖ Bot-Prefix: " + botConfig.prefix));

            loadAutoMessages(sock);
        }
    });

    sock.ev.on("creds.update", saveCreds);


const callCounts = new Map();

sock.ev.on('call', async (call) => {
    if (!botConfig.antiCall) return;

    const callData = call[0];
    if (!callData) return;

    const { id, from, status } = callData;

    if (status === 'offer') {
        try {
            const current = callCounts.get(from) || 0;
            const newCount = current + 1;
            callCounts.set(from, newCount);

            await sock.rejectCall(id, from);

            if (newCount >= 6){
                return;
        }

            if (newCount >= 5) {
                await sock.sendMessage(from, {
                    text: "🚫 Du hast zu oft angerufen. Du wirst jetzt blockiert."
                });

                await sock.updateBlockStatus(from, "block");
                callCounts.delete(from);
                return;
            }

            await sock.sendMessage(from, {
                text: `🚫 Anruf automatisch abgelehnt.\nBitte schreibe stattdessen eine Nachricht sonst kannst du meine eier lecken und lass mich inruhe.`
            });

        } catch (err) {
            console.log('AntiCall Fehler:', err);
        }
    }
});


sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== "notify") return;

    try {
        const msg = messages[0];
        if (!msg.message) return;

        const from = msg.key.remoteJid;
        const sender = msg.key.participant || from;
        const id = msg.key.id;

        if (isGroup(from)) {
            if (!messageCache[from]) messageCache[from] = {};
            messageCache[from][id] = {
                msg,
                sender,
            };

            if (Object.keys(messageCache[from]).length > 999) {
                const oldest = Object.keys(messageCache[from])[0];
                delete messageCache[from][oldest];
            }
        }

        await handleCommands(sock, msg);


const isGroupChat = from.endsWith("@g.us");
const isPrivateChat = !isGroupChat;

if (isGroupChat && botConfig.autoReadGroups) {
    try {
        await sock.readMessages([msg.key]);
    } catch (err) {
        console.error("Fehler beim Lesen (Gruppe):", err);
    }
}

    if (isPrivateChat && botConfig.autoReadPrivate) {
        try {
            await sock.readMessages([msg.key]);
        } catch (err) {
            console.error("Fehler beim Lesen (Privat):", err);
        }
    }

    if (isPrivateChat && botConfig.autoBlock) {
        const senderId = msg.key.remoteJid;

        if (isOwner(senderId)) return;
        if (msg.key.fromMe) return;
        try {
            await sock.updateBlockStatus(senderId, "block");
        } catch (e) {
            console.error(e);
        }
    }

        let text = "";
        if (msg.message?.conversation) text = msg.message.conversation;
        else if (msg.message?.extendedTextMessage?.text) text = msg.message.extendedTextMessage.text;
        else if (msg.message?.imageMessage?.caption) text = msg.message.imageMessage.caption;
        else if (msg.message?.videoMessage?.caption) text = msg.message.videoMessage.caption;
        else if (msg.message?.stickerMessage) text = "[Sticker]";
        else if (msg.message?.documentMessage) text = `[Dokument] ${msg.message.documentMessage.fileName || ""}`;
        else if (msg.message?.buttonsResponseMessage) text = `[Button Antwort] ${msg.message.buttonsResponseMessage.selectedDisplayText || ""}`;
        await logMessage(sock, from, sender, text);

        // Antidelete
        if (msg.message.protocolMessage?.type === 0) {

const groupSetting = botConfig.groupSettings[from];
if (!groupSetting?.antidelete) return;

const deletedMsgKey = msg.message.protocolMessage?.key;
if (!deletedMsgKey) return;

const deletedMsg = msg.message.protocolMessage;
const deletedId = deletedMsg.key.id;

            const cached = messageCache[from]?.[deletedId];
            if (!cached) return;

            const originalMsg = cached.msg;
            const originalSender = cached.sender;

            let deletedContent = "[Nicht darstellbare Nachricht]";
            if (originalMsg) {
                if (originalMsg.message?.conversation) deletedContent = originalMsg.message.conversation;
                else if (originalMsg.message?.extendedTextMessage?.text) deletedContent = originalMsg.message.extendedTextMessage.text;
                else if (originalMsg.message?.imageMessage?.caption) deletedContent = "[Bild] " + originalMsg.message.imageMessage.caption;
                else if (originalMsg.message?.videoMessage?.caption) deletedContent = "[Video] " + originalMsg.message.videoMessage.caption;
                else if (originalMsg.message?.stickerMessage) deletedContent = "[Sticker]";
                else if (originalMsg.message?.documentMessage) deletedContent = `[Dokument] ${originalMsg.message.documentMessage.fileName || ""}`;
                else if (originalMsg.message?.buttonsResponseMessage) deletedContent = `[Button Antwort] ${originalMsg.message.buttonsResponseMessage.selectedDisplayText || ""}`;
            }

            // Nachrichtentyp-Emoji
            const typeEmoji = originalMsg.message?.conversation ? "Text 📝 🟢" :
                              originalMsg.message?.imageMessage ? "Bild 🖼️ 🟡" :
                              originalMsg.message?.videoMessage ? "Video 🎥 🔴" :
                              originalMsg.message?.stickerMessage ? "Sticker 🌟 🔵" :
                              originalMsg.message?.documentMessage ? "Dokument 📄 ⚪️" :
                              originalMsg.message?.buttonsResponseMessage ? "Button Antwort 🔘" :
                              "Unbekannt ❔";

            // Zeitstempel
            const timestamp = new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });

            await sock.sendMessage(from, {
                text: `╔═════════════════════╗
║ 🛡️  ANTI-DELETE ALERT
╠═════════════════════╣
║ ⏰ Zeit: ${timestamp}
║ 🔹 Absender: @${originalSender.split("@")[0]}
║ 🔹 Typ: ${typeEmoji}
╠═════════════════════╣
║ 🔹 Inhalt:
║   ${deletedContent.split("\n").join("\n║   ")}
╚═════════════════════╝`,
                mentions: [originalSender]
            });
        }

    } catch (err) {
        console.error("Fehler im messages.upsert Event:", err);
    }
});

return sock;
}
connectBot();