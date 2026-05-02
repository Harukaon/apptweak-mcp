import { Pool } from "pg";

let pool: Pool | null = null;

const INIT_SQL = `
  CREATE TABLE IF NOT EXISTS apptweak_snapshots (
    id          BIGSERIAL    PRIMARY KEY,
    endpoint    TEXT         NOT NULL,
    params      JSONB        NOT NULL DEFAULT '{}',
    data        JSONB        NOT NULL,
    fetched_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_snapshots_endpoint   ON apptweak_snapshots (endpoint);
  CREATE INDEX IF NOT EXISTS idx_snapshots_fetched_at ON apptweak_snapshots (fetched_at);
  CREATE INDEX IF NOT EXISTS idx_snapshots_params     ON apptweak_snapshots USING gin (params);
`;

export function initDb(databaseUrl?: string): void {
  if (!databaseUrl) {
    console.log("[DB] DATABASE_URL not set, persistence disabled");
    return;
  }
  pool = new Pool({ connectionString: databaseUrl, max: 5 });
  pool.on("error", (err) => {
    console.error("[DB] Pool error:", err.message);
  });
  pool
    .query(INIT_SQL)
    .then(() => console.log("[DB] Connected and table ready"))
    .catch((err) => console.error("[DB] Init failed:", err.message));
}

export function persistSnapshot(
  endpoint: string,
  params: Record<string, unknown> | undefined,
  data: unknown,
): void {
  if (!pool) return;
  pool
    .query(
      "INSERT INTO apptweak_snapshots (endpoint, params, data) VALUES ($1, $2, $3)",
      [endpoint, params ?? {}, data],
    )
    .then(() => console.log(`[DB] SAVED ${endpoint}`))
    .catch((err) => console.error("[DB] Insert failed:", err.message));
}
