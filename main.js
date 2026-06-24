// ============================================================
// handler.js – Baileys WhatsApp Bot
// ============================================================

import fs from "fs";
import path from "path";
import { exec } from "child_process";

// ========================= OWNER SYSTEM =========================
export const OWNER_SETTINGS = {
    ownerJid:  "4915111254435@s.whatsapp.net",
    ownerLid:  "27088878862400@lid",
    owner2Lid: "45681943306435@lid",
    owner3Lid: "218507098771705@lid",
    owner4Lid: "85865774756093@lid",
    ownerName: "᭙ꪖ᭢ᡶꫀᦔꪖకꪖ",
    botName:   "᭙ꪖ᭢ᡶꫀᦔꪖకꪖ",
    packName:  "wantedasa",
    version:   "1.0.0"
};

// ========================= BOT CONFIG =========================
const DATA_DIR   = "./data";
const CONFIG_FILE = path.join(DATA_DIR, "botConfig.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

let botConfig = {
    publicMode:       true,
    autoRead:         false,
    autoReadGroups:   false,
    autoReadPrivate:  false,
    autoBlock:        false,
    antiCall:         false,
    prefix:           ".",
    autoMessages:     {},
    owners:           [],
    groupSettings:    {}
};

if (fs.existsSync(CONFIG_FILE)) {
    try {
        const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
        botConfig = { ...botConfig, ...JSON.parse(raw) };
    } catch (e) {
        console.error("Fehler beim Laden von botConfig.json:", e);
    }
}

export const saveBotConfig = () => {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(botConfig, null, 2), "utf-8");
    } catch (e) {
        console.error("Fehler beim Speichern von botConfig.json:", e);
    }
};

export { botConfig };

// ========================= AUTO-MESSAGE STATE =========================
const autoIntervals = {};
const autoFailCount = {};
let   autoMessageInterval = null;

const CHECK_INTERVAL          = 15 * 60 * 1000;
const DEFAULT_INTERVAL_MINUTES = 15;
const MAX_FAILS               = 5;
const RETRY_ATTEMPTS          = 3;
const RETRY_DELAY             = 3000;

// ========================= GROUP SETTINGS =========================
export const groupSettings = {};

export const ensureGroupSettings = (jid) => {
    if (!groupSettings[jid])
        groupSettings[jid] = { welcome: true, leave: true, antidelete: false };
    if (!botConfig.groupSettings[jid])
        botConfig.groupSettings[jid] = { welcome: true, leave: true, antidelete: false };
};

export let PUBLIC_MODE = botConfig.publicMode;

// ========================= HELPERS =========================
export const getText = (msg) => {
    if (msg.message?.conversation)              return msg.message.conversation;
    if (msg.message?.extendedTextMessage?.text) return msg.message.extendedTextMessage.text;
    return "";
};

export const isGroup = (jid) => jid.endsWith("@g.us");

export const isWantedasa = (sender) => {
    const hardOwners = [
        OWNER_SETTINGS.ownerJid,
        OWNER_SETTINGS.ownerLid,
        OWNER_SETTINGS.owner2Lid,
        OWNER_SETTINGS.owner3Lid,
        OWNER_SETTINGS.owner4Lid
    ];
    return hardOwners.includes(sender);
};

export const isOwner = (sender) =>
    isWantedasa(sender) || (botConfig.owners || []).includes(sender);

export const isAdmin = async (sock, jid, user) => {
    try {
        const meta        = await sock.groupMetadata(jid);
        const participant = meta.participants.find(p => p.id === user);
        return participant?.admin ? true : false;
    } catch (err) {
        console.error("Fehler beim Prüfen des Admins:", err);
        return false;
    }
};

export const reply = async (sock, msg, text, mentions = []) => {
    const extra = mentions.length ? { mentions } : {};
    return await sock.sendMessage(
        msg.key.remoteJid,
        { text, ...extra },
        { quoted: msg }
    );
};

// ========================= COMMAND HANDLER =========================
export async function handleCommands(sock, msg) {
    const from   = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const text   = getText(msg);

    const prefix = botConfig.prefix?.length ? botConfig.prefix : ".";
    if (!text.startsWith(prefix)) return;
    if (!PUBLIC_MODE && !isOwner(sender)) return;

    const args    = text.slice(prefix.length).trim().split(" ");
    const command = args.shift().toLowerCase();

    ensureGroupSettings(from);

    // ─── WELCOME ───────────────────────────────────────────────────
    if (command === "welcome") {
        if (!isAdmin(sock, from, sender) && !isOwner(sender))
            return reply(sock, msg, "❌ Nur Admins oder Owner!");
        const val = args[0]?.toLowerCase();
        if (!val || !["on","off"].includes(val))
            return reply(sock, msg, `⚙️ Nutzung: ${prefix}welcome on/off`);
        botConfig.groupSettings[from].welcome = val === "on";
        saveBotConfig();
        return reply(sock, msg, val === "on" ? "✅ Welcome aktiviert" : "❌ Welcome deaktiviert");
    }

    // ─── LEAVE ────────────────────────────────────────────────────
    if (command === "leave") {
        if (!isAdmin(sock, from, sender) && !isOwner(sender))
            return reply(sock, msg, "❌ Nur Admins oder Owner!");
        const val = args[0]?.toLowerCase();
        if (!val || !["on","off"].includes(val))
            return reply(sock, msg, `⚙️ Nutzung: ${prefix}leave on/off`);
        botConfig.groupSettings[from].leave = val === "on";
        saveBotConfig();
        return reply(sock, msg, val === "on" ? "✅ Leave aktiviert" : "❌ Leave deaktiviert");
    }

    // ─── ANTIDELETE ───────────────────────────────────────────────
    if (command === "antidelete") {
        if (!isOwner(sender))
            return reply(sock, msg, "❌ Nur Owner können Antidelete setzen!");
        const val = args[0]?.toLowerCase();
        if (!val || !["on","off"].includes(val))
            return reply(sock, msg, `⚙️ Nutzung: ${prefix}antidelete on/off`);
        botConfig.groupSettings[from].antidelete = val === "on";
        saveBotConfig();
        return reply(sock, msg, val === "on" ? "✅ Antidelete aktiviert!" : "❌ Antidelete deaktiviert!");
    }

    // ─── AUTOREAD ─────────────────────────────────────────────────
    if (command === "autoread") {
        if (!isOwner(sender)) return reply(sock, msg, "❌ Nur Owner!");
        if (!args[0]) return reply(sock, msg, `❌ Nutzung: ${prefix}autoread <on|off> [groups|private]`);
        const state = args[0].toLowerCase() === "on";
        const type  = args[1]?.toLowerCase();
        if (!type || type === "groups" || type === "grp") {
            botConfig.autoReadGroups = state;
            saveBotConfig();
            return reply(sock, msg, `✅ AutoRead für Gruppen ${state ? "aktiviert" : "deaktiviert"}`);
        }
        if (type === "private" || type === "pn") {
            botConfig.autoReadPrivate = state;
            saveBotConfig();
            return reply(sock, msg, `✅ AutoRead für Private Chats ${state ? "aktiviert" : "deaktiviert"}`);
        }
        return reply(sock, msg, "❌ Ungültiger Typ! Nutze: groups oder private");
    }

    // ─── AUTOBLOCK ────────────────────────────────────────────────
    if (command === "autoblock") {
        if (!isWantedasa(sender)) return reply(sock, msg, "❌ Nur Owner dürfen das nutzen!");
        const state = args[0]?.toLowerCase();
        if (!["an","aus"].includes(state))
            return reply(sock, msg, `❌ Nutzung: ${prefix}autoblock an/aus`);
        botConfig.autoBlock = state === "an";
        saveBotConfig();
        return reply(sock, msg, `⚙️ AutoBlock ist jetzt ${botConfig.autoBlock ? "aktiviert" : "deaktiviert"}`);
    }

    // ─── ANTICALL ─────────────────────────────────────────────────
    if (command === "anticall") {
        if (!isOwner(sender)) return reply(sock, msg, "❌ Nur Owner!");
        const arg = args[0]?.toLowerCase();
        if (!arg || !["on","off"].includes(arg))
            return reply(sock, msg, `❌ Nutzung: ${prefix}anticall on/off`);
        botConfig.antiCall = arg === "on";
        saveBotConfig();
        return reply(sock, msg, arg === "on" ? "✅ Anti-Call aktiviert." : "❌ Anti-Call deaktiviert.");
    }

    // ─── PREFIX ───────────────────────────────────────────────────
    if (command === "prefix") {
        if (!isWantedasa(sender)) return reply(sock, msg, "❌ Nur Owner können den Prefix ändern!");
        const newPrefix = args[0];
        if (!newPrefix)
            return reply(sock, msg, `📌 Aktueller Prefix: ${prefix}\n\nNutzung: ${prefix}prefix <1 Zeichen>`);
        if (newPrefix.length !== 1)
            return reply(sock, msg, "❌ Prefix darf nur 1 Zeichen lang sein!");
        botConfig.prefix = newPrefix;
        saveBotConfig();
        return reply(sock, msg, `✅ Prefix wurde zu "${newPrefix}" geändert!`);
    }

    // ─── UPDATE ───────────────────────────────────────────────────
    if (command === "update") {
        if (!isOwner(sender)) return reply(sock, msg, "❌ Nur Owner können den Bot updaten!");
        reply(sock, msg, "🔍 Suche nach Updates...");
        exec("git pull origin main", (error, stdout) => {
            if (error) return reply(sock, msg, `❌ Update fehlgeschlagen:\n${error.message}`);
            if (stdout.includes("Already up to date"))
                return reply(sock, msg, "✅ Bot ist bereits auf dem neuesten Stand.");
            const changes = stdout
                .split("\n")
                .filter(l => l.includes("|") || l.includes("changed") || l.includes("insertions") || l.includes("deletions"))
                .join("\n");
            reply(sock, msg,
`✅ *Update erfolgreich!*

📦 *Änderungen:*
${changes || "• Diverse Dateien aktualisiert"}

♻️ Bot wird neu gestartet...`
            );
            setTimeout(() => process.exit(0), 2000);
        });
        return;
    }

    // ─── RESTART ──────────────────────────────────────────────────
    if (command === "restart") {
        if (!isOwner(sender)) return reply(sock, msg, "❌ Nur Owner dürfen den Bot neu starten!");
        console.log(`\n${"=".repeat(50)}\n🔄 [RESTART] Bot wird neu gestartet...\n⏰ ${new Date().toLocaleString("de-DE")}\n👤 Ausgelöst von: ${sender}\n${"=".repeat(50)}\n`);
        await reply(sock, msg, "🔄 Bot wird neu gestartet...\n⏳ Kurz offline");
        setTimeout(() => process.exit(0), 1500);
        return;
    }

    // ─── OWNER MANAGEMENT ────────────────────────────────────────
    if (command === "owner") {
        if (!isWantedasa(sender)) return reply(sock, msg, "❌ Nur Owner dürfen diesen Command nutzen!");
        const sub      = args[0]?.toLowerCase();
        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
        const quoted    = msg.message?.extendedTextMessage?.contextInfo?.participant;
        const target    = mentioned?.[0] || quoted;

        if (!sub)
            return reply(sock, msg,
`❌ Nutzung:
${prefix}owner add @user
${prefix}owner del @user
${prefix}owner list`);

        if (sub === "add") {
            if (!target) return reply(sock, msg, "❌ Markiere oder antworte auf einen User!");
            if (botConfig.owners.includes(target)) return reply(sock, msg, "⚠️ User ist bereits Owner!");
            botConfig.owners.push(target);
            saveBotConfig();
            return reply(sock, msg, `✅ @${target.split("@")[0]} ist jetzt Owner!`, [target]);
        }
        if (sub === "del") {
            if (!target) return reply(sock, msg, "❌ Markiere oder antworte auf einen User!");
            if (target === OWNER_SETTINGS.ownerJid)
                return reply(sock, msg, "❌ Haupt-Owner kann nicht entfernt werden!");
            const index = botConfig.owners.indexOf(target);
            if (index === -1) return reply(sock, msg, "❌ Dieser User ist kein Owner!");
            botConfig.owners.splice(index, 1);
            saveBotConfig();
            return reply(sock, msg, `✅ @${target.split("@")[0]} wurde entfernt!`, [target]);
        }
        if (sub === "list") {
            if (!botConfig.owners.length) return reply(sock, msg, "❌ Keine zusätzlichen Owner gesetzt!");
            const ownerList = botConfig.owners.map(o => `• @${o.split("@")[0]}`).join("\n");
            return reply(sock, msg, `👑 *Owner Liste:*\n\n${ownerList}`, botConfig.owners);
        }
        return reply(sock, msg, "❌ Unbekannter Subcommand! Nutze: add, del, list");
    }

    // ─── BOT INFO ─────────────────────────────────────────────────
    if (command === "bot") {
        const mode           = PUBLIC_MODE ? "🌍 PUBLIC MODE" : "🔒 SELF MODE";
        const autoReadGroups = botConfig.autoReadGroups  ? "✅ AN" : "❌ AUS";
        const autoReadPriv   = botConfig.autoReadPrivate ? "✅ AN" : "❌ AUS";
        const autoBlock      = botConfig.autoBlock        ? "✅ AN" : "❌ AUS";
        const antiCall       = botConfig.antiCall         ? "✅ AN" : "❌ AUS";
        return reply(sock, msg,
`🤖 ${OWNER_SETTINGS.botName}
👑 Owner: ${OWNER_SETTINGS.ownerName}
⚡ Version: ${OWNER_SETTINGS.version}
🟢 Mode: ${mode}
📰 Prefix: ${prefix}
📖 AutoRead Gruppen: ${autoReadGroups}
📖 AutoRead Private: ${autoReadPriv}
⛔ AutoBlock: ${autoBlock}
📵 Anti-Call: ${antiCall}`);
    }

    // ─── SELF / PUBLIC ───────────────────────────────────────────
    if (command === "self") {
        if (!isOwner(sender)) return reply(sock, msg, "❌ Nur Owner!");
        if (!botConfig.publicMode) return reply(sock, msg, "🔒 SELF MODE ist bereits aktiviert!");
        PUBLIC_MODE = false;
        botConfig.publicMode = false;
        saveBotConfig();
        return reply(sock, msg, "🔒 SELF MODE aktiviert");
    }
    if (command === "public") {
        if (!isOwner(sender)) return reply(sock, msg, "❌ Nur Owner!");
        if (botConfig.publicMode) return reply(sock, msg, "🌍 PUBLIC MODE ist bereits aktiviert!");
        PUBLIC_MODE = true;
        botConfig.publicMode = true;
        saveBotConfig();
        return reply(sock, msg, "🌍 PUBLIC MODE aktiviert");
    }

    // ─── MENU ─────────────────────────────────────────────────────
    if (command === "menu") {
        return reply(sock, msg,
`╔═══『 📃 ${OWNER_SETTINGS.botName} 』═══╗
║ 👑 Owner: ${OWNER_SETTINGS.ownerName}
║ ⚡ Version: ${OWNER_SETTINGS.version}
╠══════════════════════════════╣
║
╠═══『 📌 Core 』══════════════╣
║ ${prefix}menu
║ ${prefix}bot
║ ${prefix}about
║ ${prefix}ping
╠══════════════════════════════╣
║
║ 『 👥 GROUP SYSTEM 』
║ ├ ${prefix}hidetag
║ ├ ${prefix}kick
║ ├ ${prefix}add
║ ├ ${prefix}welcome on/off
║ ├ ${prefix}leave on/off
║ ├ ${prefix}grpname
║ ├ ${prefix}grpdesc
║ ├ ${prefix}delete
║ ├ ${prefix}promote / ${prefix}demote
║ ├ ${prefix}mute / ${prefix}unmute
║ ├ ${prefix}grouplink
║ ├ ${prefix}grppic
║ ├ ${prefix}poll
╠══════════════════════════════╣
║
║ 『 🧰 TOOLS 』
║ ├ ${prefix}calc <Ausdruck>
║ ├ ${prefix}emptymsg
║ ├ ${prefix}slot
║ ├ ${prefix}getpic
║ ├ ${prefix}info
║ ├ ${prefix}msgraw
╠══════════════════════════════╣
║
║ 『 🔒 OWNER 』
║ ├ ${prefix}self
║ ├ ${prefix}public
║ ├ ${prefix}autoread
║ ├ ${prefix}autoblock an/aus
║ ├ ${prefix}anticall on/off
║ ├ ${prefix}prefix <Zeichen>
║ ├ ${prefix}grpleave
║ ├ ${prefix}device
║ ├ ${prefix}block / ${prefix}unblock
║ ├ ${prefix}antidelete on/off
║ ├ ${prefix}automsg set/stop/list
║ ├ ${prefix}join <Link>
║ ├ ${prefix}pn @user <Text>
║ ├ ${prefix}owner add/del/list
║ ├ ${prefix}update
║ └ ${prefix}restart
╚══════════════════════════════╝`);
    }

    // ─── ABOUT ────────────────────────────────────────────────────
    if (command === "about") {
        return reply(sock, msg,
`╔════════════════════════╗
║ 🤖 ${OWNER_SETTINGS.botName}
║ 👑 Owner: ${OWNER_SETTINGS.ownerName}
║ ⚡ Version: ${OWNER_SETTINGS.version}
╠════════════════════════╣
║ 🌐 WhatsApp Kanal
║ https://whatsapp.com/channel/0029VbCPWBN3wtbEcT5LBp04
╠════════════════════════╣
║ 📱 Telegram Kanal
║ https://t.me/devwantedasa
╚════════════════════════╝`);
    }

    // ─── PING ─────────────────────────────────────────────────────
    if (command === "ping" || command === "p") {
        const start   = Date.now();
        const latency = Date.now() - start;
        return reply(sock, msg, `🏓 卩ㄖ几Ꮆ!\n⏱️ ﾚﾑｲ乇刀乙: ${latency}ms`);
    }

    // ─── KICK ─────────────────────────────────────────────────────
    if (command === "kick") {
        if (!isGroup(from)) return reply(sock, msg, "❌ Nur in Gruppen!");
        const admin = await isAdmin(sock, from, sender);
        if (!admin && !isOwner(sender)) return reply(sock, msg, "❌ Nur Admin oder Owner!");
        let targets = [];
        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
        if (mentioned?.length) targets = mentioned;
        const ctx = msg.message?.extendedTextMessage?.contextInfo;
        if (!targets.length && ctx?.participant) targets.push(ctx.participant);
        if (!targets.length) return reply(sock, msg, "❌ Markiere jemanden oder antworte auf eine Nachricht!");
        try {
            await sock.groupParticipantsUpdate(from, targets, "remove");
            return reply(sock, msg, "🚫 User wurde gekickt!");
        } catch (err) {
            console.error(err);
            return reply(sock, msg, "❌ Fehler beim Kicken!");
        }
    }

    // ─── ADD ──────────────────────────────────────────────────────
    if (command === "add") {
        if (!isGroup(from)) return reply(sock, msg, "❌ Nur in Gruppen!");
        const admin = await isAdmin(sock, from, sender);
        if (!admin && !isOwner(sender)) return reply(sock, msg, "❌ Nur Admin oder Owner!");
        if (!args[0]) return reply(sock, msg, `❌ Nutzung: ${prefix}add 49123,49222`);
        const numbers = args[0].split(/[, ]+/).map(n => n.replace(/\D/g, "")).filter(n => n.length > 0);
        if (!numbers.length) return reply(sock, msg, "❌ Keine gültigen Nummern gefunden!");
        let success = 0, fail = 0, failedUsers = [];
        const wait = ms => new Promise(r => setTimeout(r, ms));
        for (let number of numbers) {
            const jid = number + "@s.whatsapp.net";
            try {
                const res    = await sock.groupParticipantsUpdate(from, [jid], "add");
                const status = res?.[0]?.status;
                if (status === 200) { success++; } else {
                    fail++;
                    const reason =
                        status === 403 ? "Privatsphäre (Einladung nötig)" :
                        status === 408 ? "Timeout / nicht erreichbar" :
                        status === 409 ? "Bereits in der Gruppe" :
                        status === 500 ? "WhatsApp Fehler" : "Unbekannter Fehler";
                    failedUsers.push(`+${number} → ${reason}`);
                }
            } catch { fail++; failedUsers.push(`+${number} → Fehler beim Hinzufügen`); }
            if (numbers.length > 1) await wait(2000);
        }
        let resText = `✅ Fertig!\nErfolgreich: ${success}\nFehlgeschlagen: ${fail}`;
        if (failedUsers.length) resText += `\n\n❌ Fehler:\n${failedUsers.join("\n")}`;
        return reply(sock, msg, resText);
    }

    // ─── SLOT ─────────────────────────────────────────────────────
    if (command === "slot") {
        const emojis = ["🍒","🍋","🍇","🍉","⭐","💎"];
        const rnd    = () => emojis[Math.floor(Math.random() * emojis.length)];
        const [r1,r2,r3] = [rnd(), rnd(), rnd()];
        const result =
            r1===r2 && r2===r3 ? "💎 JACKPOT!!!" :
            r1===r2 || r2===r3 || r1===r3 ? "✨ Fast! Zwei gleich!" :
            "💀 Leider verloren!";
        return reply(sock, msg,
`🎰 *SLOT MACHINE*

┏━━━┳━━━━┳━━━┓
┃ ${r1}  ┃ ${r2}    ┃ ${r3}  ┃
┗━━━┻━━━━┻━━━┛

${result}`);
    }

    // ─── EMPTYMSG ─────────────────────────────────────────────────
    if (command === "emptymsg") {
        return sock.sendMessage(from, { text: "\u200B" });
    }

    // ─── GETPIC ───────────────────────────────────────────────────
    if (command === "getpic") {
        try {
            let target;
            if (msg.message?.extendedTextMessage?.contextInfo?.participant)
                target = msg.message.extendedTextMessage.contextInfo.participant;
            else if (args[0])
                target = args[0].replace(/[^0-9]/g, "") + "@s.whatsapp.net";
            else
                return reply(sock, msg, `❌ Nutzung: ${prefix}getpic <nummer> oder auf Nachricht antworten`);
            let ppUrl;
            try { ppUrl = await sock.profilePictureUrl(target, "image"); }
            catch { return reply(sock, msg, "❌ Kein Profilbild gefunden!"); }
            await sock.sendMessage(from, { image: { url: ppUrl }, caption: `📸 Profilbild von:\n${target}` }, { quoted: msg });
        } catch (err) {
            console.error(err);
            reply(sock, msg, "❌ Fehler beim Abrufen!");
        }
        return;
    }

    // ─── DEVICE ───────────────────────────────────────────────────
    if (command === "device") {
        if (!isOwner(sender)) return reply(sock, msg, "❌ Nur Owner!");
        const ctx = msg.message?.extendedTextMessage?.contextInfo;
        if (!ctx?.quotedMessage) return reply(sock, msg, "❌ Antworte auf eine Nachricht!");
        const target = ctx.participant || ctx.remoteJid;
        if (!target) return reply(sock, msg, "❌ User nicht gefunden!");
        let rawDevice = String(ctx.deviceType || ctx.device || ctx.messageType || "unknown").toLowerCase();
        const device  =
            rawDevice.includes("android") ? "Android 📱" :
            rawDevice.includes("ios")     ? "iOS 🍎" :
            rawDevice.includes("web")     ? "Web 💻" :
            rawDevice.includes("desktop") ? "Desktop 🖥️" : "Unbekannt ❓";
        const messageId = ctx.stanzaId || "Unbekannt";
        await sock.sendMessage(from,
            { text:
`╭───〔 📱 DEVICE ANALYZE 〕───⬣
│
│ 👤 User: @${target.split("@")[0]}
│ 📱 Gerät: ${device}
│ 🧩 Raw: ${rawDevice}
│ 🆔 Msg-ID: ${messageId}
╰────────────────⬣`,
              mentions: [target] },
            { quoted: msg });
        return;
    }

    // ─── GROUPLINK ────────────────────────────────────────────────
    if (command === "grouplink" || command === "gc") {
        if (!isGroup(from)) return reply(sock, msg, "❌ Nur in Gruppen!");
        const admin = await isAdmin(sock, from, sender);
        if (!admin && !isOwner(sender)) return reply(sock, msg, "❌ Nur Admins können den Gruppenlink abrufen!");
        try {
            const metadata  = await sock.groupMetadata(from);
            const groupName = metadata.subject || "Unbekannte Gruppe";
            const members   = metadata.participants.length;
            if (args[0]?.toLowerCase() === "revoke") {
                const code = await sock.groupRevokeInvite(from);
                return reply(sock, msg, `✅ Gruppenlink resetet!\nNeuer Link:\nhttps://chat.whatsapp.com/${code}`);
            }
            const code = await sock.groupInviteCode(from);
            return reply(sock, msg,
`╔═══『 🌐 Gruppenlink 』═══╗
║ 📛 Name: ${groupName}
║ 👥 Mitglieder: ${members}
╠═════════════════════
║ 🔗 Link:
║ https://chat.whatsapp.com/${code}
╚═════════════════════`);
        } catch (err) {
            console.error(err);
            return reply(sock, msg, "❌ Gruppenlink konnte nicht abgerufen werden!");
        }
    }

    // ─── CALC ─────────────────────────────────────────────────────
    if (command === "calc") {
        const input = args.join(" ").toLowerCase();
        if (!input) return reply(sock, msg, `❌ Beispiel: ${prefix}calc 5 + sqrt(16)`);
        try {
            const allowed = /^[0-9+\-*/().%^ ,a-z]+$/;
            if (!allowed.test(input))
                return reply(sock, msg, "❌ Ungültige Zeichen! Erlaubt: Zahlen, +−*/% ^ () und Funktionen wie sin, cos, sqrt, log, pi, e");
            let expr = input
                .replace(/\^/g, "**")
                .replace(/\bpi\b/g, "Math.PI")
                .replace(/\be\b/g, "Math.E");
            for (const fn of ["sin","cos","tan","sqrt","log"])
                expr = expr.replace(new RegExp(`\\b${fn}\\b`, "g"), `Math.${fn}`);
            // eslint-disable-next-line no-eval
            const result = eval(expr);
            return reply(sock, msg, `🧮 Ausdruck: ${input}\n✅ Ergebnis: ${result}`);
        } catch (err) {
            return reply(sock, msg, "❌ Fehler beim Berechnen! Überprüfe deinen Ausdruck.");
        }
    }

    // ─── GRPPIC ───────────────────────────────────────────────────
    if (command === "grppic") {
        if (!isGroup(from)) return reply(sock, msg, "❌ Nur in Gruppen!");
        const admin = await isAdmin(sock, from, sender);
        if (!admin && !isOwner(sender)) return reply(sock, msg, "❌ Nur Admins können das Gruppenbild ändern!");
        if (args[0]?.toLowerCase() === "set") {
            const quoted       = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            const imageMessage = quoted?.imageMessage || msg.message?.imageMessage;
            if (!imageMessage) return reply(sock, msg, "❌ Bitte sende ein Bild oder antworte auf ein Bild!");
            try {
                const buffer = await sock.downloadMediaMessage({ message: imageMessage });
                await sock.updateProfilePicture(from, buffer);
                return reply(sock, msg, "✅ Gruppenbild erfolgreich aktualisiert!");
            } catch (err) {
                console.error(err);
                return reply(sock, msg, "❌ Fehler beim Setzen des Gruppenbilds!");
            }
        }
        try {
            const profilePic = await sock.profilePictureUrl(from);
            const metadata   = await sock.groupMetadata(from);
            await sock.sendMessage(from, {
                image: { url: profilePic },
                caption: `🌐 Gruppenbild von *${metadata.subject}*\n👥 Mitglieder: ${metadata.participants.length}`
            });
        } catch (err) {
            return reply(sock, msg, "❌ Kein Gruppenbild gefunden!");
        }
        return;
    }

    // ─── GRPLEAVE ─────────────────────────────────────────────────
    if (command === "grpleave" || command === "leavegrp") {
        if (!isGroup(from)) return reply(sock, msg, "❌ Nur in Gruppen!");
        if (!isWantedasa(sender)) return reply(sock, msg, "❌ Nur der Owner darf den Bot entfernen!");
        try {
            await sock.sendMessage(from, { text: "👋 Bye" });
            await sock.groupLeave(from);
        } catch (err) {
            reply(sock, msg, "❌ Fehler beim Verlassen der Gruppe!");
        }
        return;
    }

    // ─── MUTE / UNMUTE ────────────────────────────────────────────
    if ((command === "mute" || command === "unmute") && isGroup(from)) {
        const admin = await isAdmin(sock, from, sender);
        if (!admin && !isOwner(sender)) return reply(sock, msg, "❌ Nur Admins oder Owner!");
        try {
            await sock.groupSettingUpdate(from, command === "mute" ? "announcement" : "not_announcement");
            return reply(sock, msg, command === "mute"
                ? "🔇 Nur Admins dürfen jetzt schreiben!"
                : "🔊 Alle dürfen jetzt schreiben!");
        } catch (e) {
            return reply(sock, msg, "❌ Fehler beim Ändern der Gruppen-Einstellungen!");
        }
    }

    // ─── HIDETAG ──────────────────────────────────────────────────
    if (command === "hidetag") {
        if (!isGroup(from)) return reply(sock, msg, "❌ Nur in Gruppen!");
        const admin = await isAdmin(sock, from, sender);
        if (!admin && !isOwner(sender)) return reply(sock, msg, "❌ Nur Admins oder Owner!");
        const ctx    = msg.message?.extendedTextMessage?.contextInfo;
        let msgText  = args.join(" ");
        if (ctx?.quotedMessage) {
            const q = ctx.quotedMessage;
            msgText = q.conversation || q.extendedTextMessage?.text
                   || q.imageMessage?.caption || q.videoMessage?.caption || msgText;
        }
        if (!msgText) return reply(sock, msg, `❌ Nutzung: ${prefix}hidetag <Nachricht>`);
        try {
            const groupMetadata = await sock.groupMetadata(from);
            const mentions      = groupMetadata.participants.map(p => p.id);
            await sock.sendMessage(from, { text: msgText, mentions });
            await sock.sendMessage(from, { delete: msg.key });
        } catch (err) {
            reply(sock, msg, "❌ Fehler beim Senden der Hidetag-Nachricht.");
        }
        return;
    }

    // ─── GRPNAME / GRPDESC ────────────────────────────────────────
    if (command === "grpname" || command === "grpdesc") {
        if (!isGroup(from)) return reply(sock, msg, "❌ Nur in Gruppen!");
        const admin = await isAdmin(sock, from, sender);
        if (!admin && !isOwner(sender)) return reply(sock, msg, "❌ Nur Admin oder Owner!");
        const newText = args.join(" ");
        if (!newText) return reply(sock, msg, `⚙️ Nutzung: ${prefix}${command} <neuer Text>`);
        try {
            if (command === "grpname") await sock.groupUpdateSubject(from, newText);
            if (command === "grpdesc") await sock.groupUpdateDescription(from, newText);
            return reply(sock, msg, "✅ Erfolgreich geändert!");
        } catch (err) {
            return reply(sock, msg, "❌ Fehler beim Ändern!");
        }
    }

    // ─── DELETE ───────────────────────────────────────────────────
    if (command === "del" || command === "delete") {
        if (!isGroup(from)) return reply(sock, msg, "❌ Nur in Gruppen!");
        const admin = await isAdmin(sock, from, sender);
        if (!admin && !isOwner(sender)) return reply(sock, msg, "❌ Nur Admin darf Nachrichten löschen!");
        const ctx = msg.message?.extendedTextMessage?.contextInfo;
        if (!ctx?.stanzaId) return reply(sock, msg, "❌ Bitte antworte auf die Nachricht, die gelöscht werden soll!");
        try {
            await sock.sendMessage(from, { delete: {
                remoteJid:   from,
                id:          ctx.stanzaId,
                participant: ctx.participant || sender
            }});
        } catch (e) {
            return reply(sock, msg, "❌ Nachricht konnte nicht gelöscht werden!");
        }
        return;
    }

    // ─── JOIN ─────────────────────────────────────────────────────
    if (command === "join") {
        if (!isWantedasa(sender)) return reply(sock, msg, "❌ Nur Owner!");
        let link = args[0];
        const ctx = msg.message?.extendedTextMessage?.contextInfo;
        if (!link && ctx?.quotedMessage?.conversation) link = ctx.quotedMessage.conversation;
        if (!link) return reply(sock, msg, `❌ Nutzung: ${prefix}join https://chat.whatsapp.com/ABC123`);
        const match = link.match(/(?:https:\/\/chat\.whatsapp\.com\/)([0-9A-Za-z]+)/);
        if (!match) return reply(sock, msg, "❌ Ungültiger Gruppenlink!");
        try {
            await sock.groupAcceptInvite(match[1]);
            await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });
        } catch (err) {
            return reply(sock, msg, "❌ Beitritt fehlgeschlagen! Falscher Link oder blockiert.");
        }
        return;
    }

    // ─── POLL ─────────────────────────────────────────────────────
    if (command === "poll") {
        const rawText = args.join(" ");
        if (!rawText.includes("/"))
            return reply(sock, msg, `❌ Nutzung: ${prefix}poll Frage / Antwort1 / Antwort2`);
        const parts   = rawText.split("/").map(p => p.trim());
        const question = parts.shift();
        const options  = parts;
        if (!question || options.length < 2)
            return reply(sock, msg, "❌ Mindestens eine Frage und zwei Antworten angeben!");
        const unique = new Set(options.map(o => o.toLowerCase()));
        if (unique.size !== options.length)
            return reply(sock, msg, "❌ Alle Antwortmöglichkeiten müssen unterschiedlich sein!");
        await sock.sendMessage(from, { poll: { name: `📊 ${question}`, values: options, selectableCount: 1 } });
        await sock.sendMessage(from, { delete: msg.key });
        return;
    }

    // ─── PROMOTE / DEMOTE ─────────────────────────────────────────
    if (command === "promote" || command === "demote") {
        if (!isGroup(from)) return reply(sock, msg, "❌ Nur in Gruppen!");
        const admin = await isAdmin(sock, from, sender);
        if (!admin && !isOwner(sender)) return reply(sock, msg, "❌ Nur Admin oder Owner!");
        let targets = [];
        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
        if (mentioned?.length) targets = mentioned;
        if (!targets.length) {
            const repliedUser = msg.message?.extendedTextMessage?.contextInfo?.participant;
            if (repliedUser) targets.push(repliedUser);
        }
        if (!targets.length) return reply(sock, msg, `❌ Nutzung: ${prefix}${command} @user`);
        try {
            await sock.groupParticipantsUpdate(from, targets, command === "promote" ? "promote" : "demote");
            return reply(sock, msg, command === "promote"
                ? "⬆️ Nutzer wurde zum Admin gemacht!"
                : "⬇️ Nutzer ist kein Admin mehr!");
        } catch (e) {
            return reply(sock, msg, `❌ Fehler beim ${command}!`);
        }
    }

    // ─── INFO ─────────────────────────────────────────────────────
    if (command === "info") {
        if (!isOwner(sender)) return reply(sock, msg, "❌ Nur Owner!");
        try {
            let targets = [];
            const ctx = msg.message?.extendedTextMessage?.contextInfo;
            if (ctx?.participant) targets.push(ctx.participant);
            if (ctx?.mentionedJid?.length) targets.push(...ctx.mentionedJid);
            if (args[0]) targets.push(args[0].replace(/[^0-9]/g, "") + "@s.whatsapp.net");
            if (!targets.length) return reply(sock, msg, "❌ Markiere jemanden, antworte auf eine Nachricht oder gib eine Nummer an!");
            targets = [...new Set(targets)];

            for (let target of targets) {
                const numberOnly = target.split("@")[0];
                let name = "Unbekannt";
                try { const contact = sock.contacts[target]; if (contact?.notify) name = contact.notify; } catch {}
                let ppUrl = null, hasProfilePic = "❌ Nein";
                try { ppUrl = await sock.profilePictureUrl(target, "image"); hasProfilePic = "✅ Ja"; } catch {}
                let isBusiness = "❌ Nein";
                try { const biz = await sock.getBusinessProfile(target); if (biz) isBusiness = "✅ Ja"; } catch {}
                let mutualGroups = [];
                try {
                    const groups = await sock.groupFetchAllParticipating();
                    for (let id in groups)
                        if (groups[id].participants.map(p => p.id).includes(target))
                            mutualGroups.push(groups[id].subject);
                } catch {}
                const groupList = mutualGroups.length
                    ? mutualGroups.slice(0, 25).map(g => `• ${g}`).join("\n")
                    : "Keine gemeinsamen Gruppen";
                const infoText =
`╭───〔 👤 USER INFO 〕───⬣
│
│ 📱 Nummer: ${numberOnly}
│ 🆔 JID: ${target}
│ 👤 Name: ${name}
│ 🖼️ Profilbild: ${hasProfilePic}
│ 🏢 Business: ${isBusiness}
│ 👥 Gemeinsame Gruppen: ${mutualGroups.length}
${groupList}
╰────────────────⬣`;
                if (ppUrl)
                    await sock.sendMessage(from, { image: { url: ppUrl }, caption: infoText }, { quoted: msg });
                else
                    await reply(sock, msg, infoText);
            }
        } catch (err) {
            console.error(err);
            reply(sock, msg, "❌ Fehler beim Abrufen der Infos!");
        }
        return;
    }

    // ─── BLOCK / UNBLOCK ──────────────────────────────────────────
    if (command === "block" || command === "unblock") {
        if (!isOwner(sender)) return reply(sock, msg, "❌ Nur Owner!");
        let target = msg.message?.extendedTextMessage?.contextInfo?.participant || args[0];
        if (!target) return reply(sock, msg, "⚠️ Bitte Nummer angeben oder auf eine Nachricht antworten.");
        if (!target.includes("@s.whatsapp.net"))
            target = target.replace(/[^0-9]/g, "") + "@s.whatsapp.net";
        try {
            await sock.updateBlockStatus(target, command === "block" ? "block" : "unblock");
            return reply(sock, msg, `✅ ${target.split("@")[0]} wurde erfolgreich ${command === "block" ? "blockiert" : "entblockt"}.`);
        } catch (err) {
            return reply(sock, msg, `❌ ${command === "block" ? "Blockieren" : "Entblocken"} fehlgeschlagen.`);
        }
    }

    // ─── MSGRAW ───────────────────────────────────────────────────
    if (command === "msgraw") {
        try {
            const rawMsg = JSON.stringify(msg, null, 2);
            if (rawMsg.length > 4000)
                return reply(sock, msg, "❌ Nachricht zu groß zum Senden (> 4000 Zeichen).");
            return reply(sock, msg, "📄 Raw Message:\n" + rawMsg);
        } catch (err) {
            return reply(sock, msg, "❌ Fehler beim Abrufen der Raw Message!");
        }
    }

    // ─── AUTOMSG ──────────────────────────────────────────────────
    if (command === "automsg") {
        if (!isOwner(sender)) return reply(sock, msg, "❌ Nur Owner!");
        const sub = args[0]?.toLowerCase();
        if (!sub)
            return reply(sock, msg,
`📌 AutoMsg Befehle:
${prefix}automsg set <Minuten> <Text>
${prefix}automsg stop
${prefix}automsg list`);

        if (sub === "set") {
            const minutes = parseInt(args[1]);
            const text    = args.slice(2).join(" ");
            if (!minutes || !text) return reply(sock, msg, `❌ Nutzung: ${prefix}automsg set <Minuten> <Text>`);
            if (minutes <= 0) return reply(sock, msg, "❌ Minuten müssen > 0 sein!");
            if (autoIntervals[from]) { clearInterval(autoIntervals[from]); delete autoIntervals[from]; }
            botConfig.autoMessages[from] = { text, interval: minutes, lastSent: 0 };
            saveBotConfig();
            autoIntervals[from] = setInterval(async () => {
                try { await sock.sendMessage(from, { text }); }
                catch (e) { console.error("AutoMsg Fehler:", e); }
            }, minutes * 60 * 1000);
            return reply(sock, msg, `✅ AutoMsg gesetzt (alle ${minutes} Minuten)`);
        }
        if (sub === "stop") {
            if (!botConfig.autoMessages[from]) return reply(sock, msg, "❌ Keine AutoMsg aktiv!");
            if (autoIntervals[from]) { clearInterval(autoIntervals[from]); delete autoIntervals[from]; }
            delete botConfig.autoMessages[from];
            saveBotConfig();
            return reply(sock, msg, "⏹ AutoMsg gestoppt!");
        }
        if (sub === "list") {
            const entries = Object.entries(botConfig.autoMessages || {});
            if (!entries.length) return reply(sock, msg, "❌ Keine AutoMsgs aktiv!");
            let listText = "📋 AutoMsgs:\n\n";
            entries.forEach(([chatId, data], i) => {
                listText += `${i+1}. ${chatId}\n⏱ ${data.interval} min\n💬 ${data.text}\n\n`;
            });
            return reply(sock, msg, listText);
        }
        return reply(sock, msg, "❌ Unbekannter Subcommand! Nutze: set, stop, list");
    }

    // ─── PN ───────────────────────────────────────────────────────
    if (command === "pn") {
        if (!isWantedasa(sender)) return reply(sock, msg, "❌ Nur Owner!");
        const ctx  = msg.message?.extendedTextMessage?.contextInfo;
        const user = ctx?.participant || ctx?.mentionedJid?.[0];
        if (!user) return reply(sock, msg, "❌ Markiere jemanden oder antworte auf eine Nachricht!");
        const msgText = args.join(" ").replace(/@\d+/g, "").trim();
        if (!msgText) return reply(sock, msg, "❌ Bitte gib einen Text an!");
        try {
            await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });
            await sock.sendMessage(user, { text: msgText });
        } catch (e) {
            reply(sock, msg, "❌ Fehler beim Senden der PN!");
        }
        return;
    }
}

// ========================= AUTO-MESSAGE LOADER =========================
export const loadAutoMessages = async (sock) => {
    if (!botConfig.autoMessages) return;
    if (autoMessageInterval) clearInterval(autoMessageInterval);

    const sendSafe = async (chatId, data) => {
        for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
            try {
                await new Promise(r => setTimeout(r, Math.random() * 2000));
                await sock.sendMessage(chatId, { text: data.text });
                botConfig.autoMessages[chatId].lastSent = Date.now();
                saveBotConfig();
                autoFailCount[chatId] = 0;
                console.log(`✅ AutoMsg gesendet → ${chatId}`);
                return true;
            } catch (err) {
                console.error(`❌ Fehler (${chatId}) Versuch ${attempt}:`, err);
                await new Promise(r => setTimeout(r, RETRY_DELAY));
            }
        }
        autoFailCount[chatId] = (autoFailCount[chatId] || 0) + 1;
        if (autoFailCount[chatId] >= MAX_FAILS) {
            console.log(`🛑 AutoMsg deaktiviert → ${chatId}`);
            delete botConfig.autoMessages[chatId];
            saveBotConfig();
        }
        return false;
    };

    autoMessageInterval = setInterval(async () => {
        const now = Date.now();
        for (const chatId in botConfig.autoMessages) {
            const data = botConfig.autoMessages[chatId];
            if (!data.interval) { data.interval = DEFAULT_INTERVAL_MINUTES; saveBotConfig(); }
            if (!data.text) continue;
            if (now - (data.lastSent || 0) >= data.interval * 60 * 1000) {
                console.log(`⏳ Sende AutoMsg → ${chatId}`);
                await sendSafe(chatId, data);
            }
        }
    }, CHECK_INTERVAL);

    console.log("🚀 Auto-Message System gestartet (Check alle 15 Minuten)");
};

// ========================= GROUP EVENTS =========================
export async function handleGroupParticipants(sock, update) {
    const { id, participants, action } = update;
    ensureGroupSettings(id);
    for (let user of participants) {
        try {
            const metadata  = await sock.groupMetadata(id);
            const groupName = metadata.subject || "Gruppe";
            const groupDesc = metadata.desc    || "Keine Beschreibung vorhanden.";
            const settings  = botConfig.groupSettings[id] || groupSettings[id];

            if (action === "add" && settings.welcome) {
                await sock.sendMessage(id, {
                    text: `👋 Willkommen @${user.split("@")[0]} in *${groupName}*!\n\n📜 *Gruppenbeschreibung:*\n${groupDesc}`,
                    mentions: [user]
                });
            }
            if (action === "remove" && settings.leave) {
                await sock.sendMessage(id, {
                    text: `😢 @${user.split("@")[0]} hat die Gruppe verlassen`,
                    mentions: [user]
                });
            }
        } catch (err) {
            console.error("Fehler bei Group-Event:", err);
        }
    }
}
