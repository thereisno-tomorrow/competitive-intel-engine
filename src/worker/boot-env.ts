/**
 * Boot-time environment wiring for the worker. Imported FIRST (before any module
 * that touches the DB) so the shared Prisma singleton picks up the direct,
 * non-pooled Neon connection required by pg-boss and long-running jobs (KTD2/KTD3).
 *
 * The worker refuses to boot without a valid WORKER_DATABASE_URL_DIRECT.
 */
import "dotenv/config";

/**
 * Validate and return the worker's direct DB connection string. Throws a clear
 * error when missing or pointed at a pooler host. Pure — safe to unit test.
 */
export function resolveWorkerDatabaseUrl(env: NodeJS.ProcessEnv): string {
  const direct = env.WORKER_DATABASE_URL_DIRECT?.trim();
  if (!direct) {
    throw new Error(
      "WORKER_DATABASE_URL_DIRECT is required to start the worker but is not set. " +
        "It must be a DIRECT (non-pooled) Postgres connection — derive it from the pooled " +
        'URL by removing "-pooler" from the host. The worker must not use the pooler endpoint.',
    );
  }
  if (direct.includes("-pooler")) {
    throw new Error(
      "WORKER_DATABASE_URL_DIRECT points at a pooler host (contains '-pooler'). " +
        "pg-boss and the worker require a direct connection; remove '-pooler' from the host.",
    );
  }
  return direct;
}

// Side effect on import: point the shared pipeline (src/lib/db.ts reads DATABASE_URL)
// at the direct connection for this process only.
const direct = resolveWorkerDatabaseUrl(process.env);
process.env.DATABASE_URL = direct;
