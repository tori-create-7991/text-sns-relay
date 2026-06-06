/**
 * 送信履歴の読み書き（data/history.json）
 * エントリ形式: { sent_at, text, x, bluesky, threads }
 *   各プラットフォーム: { url, ok } | null
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const HISTORY_FILE = join(DATA_DIR, "history.json");

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

/** @returns {Array} */
export function loadHistory() {
  ensureDataDir();
  if (!existsSync(HISTORY_FILE)) return [];
  try {
    return JSON.parse(readFileSync(HISTORY_FILE, "utf8"));
  } catch {
    return [];
  }
}

/**
 * @param {{ sent_at: string, text: string, x: object|null, bluesky: object|null, threads: object|null }} entry
 */
export function appendHistory(entry) {
  ensureDataDir();
  const history = loadHistory();
  history.unshift(entry); // 新しいものを先頭に
  writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), "utf8");
}
