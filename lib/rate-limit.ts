import "server-only";

/**
 * Rate limiter simples em memória (janela deslizante) para tentativas de login.
 * O Supabase Auth já aplica seus próprios limites; isto é uma camada extra.
 *
 * TODO(security): em deploys com múltiplas instâncias/serverless a memória não
 * é compartilhada. Para um limite global, troque por Upstash Redis/KV.
 */
type Bucket = { hits: number[] };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 5_000;

export function rateLimit(key: string, limit: number, windowMs: number): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);

  if (bucket.hits.length >= limit) {
    const retryAfterSec = Math.ceil((windowMs - (now - bucket.hits[0])) / 1000);
    buckets.set(key, bucket);
    return { allowed: false, retryAfterSec };
  }

  bucket.hits.push(now);
  if (buckets.size >= MAX_BUCKETS && !buckets.has(key)) {
    // Evita crescimento ilimitado de memória: descarta o bucket mais antigo.
    const oldestKey = buckets.keys().next().value;
    if (oldestKey !== undefined) buckets.delete(oldestKey);
  }
  buckets.set(key, bucket);
  return { allowed: true, retryAfterSec: 0 };
}

export function resetRateLimit(key: string) {
  buckets.delete(key);
}
