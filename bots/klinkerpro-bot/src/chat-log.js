'use strict';

/**
 * Сохранение всех диалогов на диск (независимо от заявки).
 *
 * Структура:
 *   data/chats/YYYY-MM-DD.jsonl     — по одной строке на реплику (удобно смотреть за день)
 *   data/chats/sessions/<id>.json — полная сессия (удобно смотреть один диалог)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'data', 'chats');
const SESSIONS = path.join(ROOT, 'sessions');

function ensureDirs() {
  fs.mkdirSync(SESSIONS, { recursive: true });
}

function todayStamp(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function safeSessionId(id) {
  const raw = String(id || 'unknown').slice(0, 64);
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_') || 'unknown';
}

/**
 * @param {{
 *   sessionId?: string,
 *   source?: string,
 *   username?: string,
 *   userText?: string,
 *   reply?: string,
 *   provider?: string,
 *   leadSent?: boolean,
 *   history?: { role: string, content: string }[],
 * }} turn
 */
function logChatTurn(turn) {
  try {
    ensureDirs();
    const now = new Date();
    const sessionId = safeSessionId(turn.sessionId);
    const entry = {
      at: now.toISOString(),
      sessionId,
      source: turn.source || 'unknown',
      username: turn.username || null,
      user: turn.userText || '',
      reply: turn.reply || '',
      provider: turn.provider || null,
      leadSent: Boolean(turn.leadSent),
    };

    // Дневной журнал (append-only)
    const dayFile = path.join(ROOT, `${todayStamp(now)}.jsonl`);
    fs.appendFileSync(dayFile, JSON.stringify(entry) + '\n', 'utf8');

    // Файл сессии (полная история)
    const sessionFile = path.join(SESSIONS, `${sessionId}.json`);
    let session = {
      sessionId,
      source: entry.source,
      username: entry.username,
      createdAt: entry.at,
      updatedAt: entry.at,
      turns: [],
      messages: [],
    };
    try {
      session = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
    } catch {
      // new session
    }

    session.updatedAt = entry.at;
    session.source = entry.source;
    if (entry.username) session.username = entry.username;
    session.turns = Array.isArray(session.turns) ? session.turns : [];
    session.turns.push({
      at: entry.at,
      user: entry.user,
      reply: entry.reply,
      provider: entry.provider,
      leadSent: entry.leadSent,
    });
    if (Array.isArray(turn.history) && turn.history.length) {
      session.messages = turn.history.concat(
        entry.reply ? [{ role: 'assistant', content: entry.reply }] : []
      );
    }
    fs.writeFileSync(sessionFile, JSON.stringify(session, null, 2), 'utf8');
  } catch (err) {
    console.error('[chat-log] save failed:', err.message);
  }
}

module.exports = { logChatTurn, ROOT, SESSIONS };
