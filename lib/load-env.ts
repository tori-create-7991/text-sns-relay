import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const SECRET_MANAGER_PROJECT = process.env.GCP_SECRETS_PROJECT ?? "tori-dev-secrets";

// GCP Secret Manager (tori-dev-secrets) で管理する対象キー。
// シークレット名は `text-sns-relay-` + キーを kebab-case にしたもの
// （例: X_API_KEY -> text-sns-relay-x-api-key）。
const SECRET_KEYS = [
  "X_API_KEY",
  "X_API_SECRET",
  "X_ACCESS_TOKEN",
  "X_ACCESS_TOKEN_SECRET",
  "X_BEARER_TOKEN",
  "BSKY_HANDLE",
  "BSKY_APP_PASSWORD",
  "THREADS_ACCESS_TOKEN",
  "NOTION_TOKEN",
  "SLACK_WEBHOOK_URL",
  "DISCORD_WEBHOOK_URL",
  "RELAY_UI_PASSWORD",
] as const;

function toSecretName(key: string): string {
  return `text-sns-relay-${key.toLowerCase().replace(/_/g, "-")}`;
}

function parseDotEnv(raw: string): Map<string, string> {
  const values = new Map<string, string>();
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    values.set(key, val);
  }
  return values;
}

function loadDotEnv(): Map<string, string> {
  const envPath = join(ROOT, ".env");
  if (!existsSync(envPath)) return new Map();
  return parseDotEnv(readFileSync(envPath, "utf8"));
}

// Secret Manager 未設定（ADC無し・権限無し・シークレット未作成）は
// 個々に握りつぶして .env フォールバックへ委ねる。ローカル開発で
// GCP 環境が無くても既存の .env 運用が壊れないようにするため。
async function loadFromSecretManager(): Promise<Map<string, string>> {
  const values = new Map<string, string>();
  if (process.env.SKIP_SECRET_MANAGER === "1") return values;

  let client: SecretManagerServiceClient;
  try {
    client = new SecretManagerServiceClient();
  } catch {
    return values;
  }

  await Promise.all(
    SECRET_KEYS.map(async (key) => {
      const name = `projects/${SECRET_MANAGER_PROJECT}/secrets/${toSecretName(key)}/versions/latest`;
      try {
        const [version] = await client.accessSecretVersion({ name });
        const data = version.payload?.data?.toString("utf8");
        if (data) values.set(key, data);
      } catch {
        // 未作成 or 権限なし → スキップ（.env へフォールバック）
      }
    })
  );
  return values;
}

// 優先順位: シェルの既存 process.env > Secret Manager > .env ファイル
export async function loadEnv(): Promise<void> {
  const shellEnv = new Map(Object.entries(process.env).filter(([, v]) => v !== undefined)) as Map<
    string,
    string
  >;
  const [secretValues, dotEnvValues] = await Promise.all([
    loadFromSecretManager(),
    Promise.resolve(loadDotEnv()),
  ]);

  const allKeys = new Set<string>([...secretValues.keys(), ...dotEnvValues.keys()]);
  for (const key of allKeys) {
    const value = shellEnv.get(key) ?? secretValues.get(key) ?? dotEnvValues.get(key);
    if (value !== undefined) process.env[key] = value;
  }
}
