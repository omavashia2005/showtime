/** Small mulberry32 PRNG so sim runs are reproducible per seed within a session. */
export function makeRng(seed = 1): () => number {
  let a = seed >>> 0 || 1;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function exponential(rng: () => number, rate: number): number {
  if (rate <= 0) return Infinity;
  const u = Math.max(rng(), 1e-12);
  return -Math.log(u) / rate;
}

export function lognormal(rng: () => number, mean: number, sigma: number): number {
  // Box-Muller for a standard normal, then shift so the lognormal's mean equals `mean`.
  const u1 = Math.max(rng(), 1e-12);
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const mu = Math.log(mean) - (sigma * sigma) / 2;
  return Math.exp(mu + sigma * z);
}

export function uniform(rng: () => number, a: number, b: number): number {
  return a + rng() * (b - a);
}

export function fullJitterBackoff(rng: () => number, baseMs: number, factor: number, attempt: number): number {
  const cap = baseMs * Math.pow(factor, attempt);
  return rng() * cap;
}

const zipfWeightCache = new Map<string, { weights: number[]; total: number }>();

function zipfWeights(buckets: number, s: number): { weights: number[]; total: number } {
  const key = `${buckets}:${s}`;
  const cached = zipfWeightCache.get(key);
  if (cached) return cached;
  let total = 0;
  const weights: number[] = [];
  for (let k = 1; k <= buckets; k++) {
    const w = 1 / Math.pow(k, s);
    weights.push(w);
    total += w;
  }
  const entry = { weights, total };
  zipfWeightCache.set(key, entry);
  return entry;
}

/** Zipf-ish key sampling over `buckets` ranked buckets, then a uniform point inside the chosen bucket. */
export function zipfBucket(rng: () => number, buckets: number, s: number): number {
  const { weights, total } = zipfWeights(buckets, s);
  const r = rng() * total;
  let acc = 0;
  for (let i = 0; i < buckets; i++) {
    acc += weights[i]!;
    if (r <= acc) return i;
  }
  return buckets - 1;
}
