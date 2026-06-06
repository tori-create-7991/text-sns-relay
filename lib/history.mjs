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
  if (!existsSync(HISTORY_FILE)) return [];
  try {
    return JSON.parse(readFileSync(HISTORY_FILE, "utf8"));
  } catch {
    return [];
  }
}

// 同時書き込みによるエントリ消失を防ぐシリアライズキュー
let writeQueue = Promise.resolve();

/**
 * @param {{ sent_at: string, text: string, x: object|null, bluesky: object|null, threads: object|null }} entry
 */
export function appendHistory(entry) {
  writeQueue = writeQueue.then(() => {
    ensureDataDir();
    const history = loadHistory();
    history.unshift(entry);
    writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), "utf8");
  });
  return writeQueue;
}
