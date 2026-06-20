import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { HistoryEntry } from "./types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const HISTORY_FILE = join(DATA_DIR, "history.json");

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

export function loadHistory(): HistoryEntry[] {
  if (!existsSync(HISTORY_FILE)) return [];
  try {
    return JSON.parse(readFileSync(HISTORY_FILE, "utf8")) as HistoryEntry[];
  } catch {
    return [];
  }
}

// 同時書き込みによるエントリ消失を防ぐシリアライズキュー
let writeQueue: Promise<void> = Promise.resolve();

export function appendHistory(entry: HistoryEntry): Promise<void> {
  writeQueue = writeQueue.then(() => {
    ensureDataDir();
    const history = loadHistory();
    history.unshift(entry);
    writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), "utf8");
  });
  return writeQueue;
}
