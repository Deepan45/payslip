/**
 * Runs `fn` over `items` with at most `limit` in flight at once. Used for
 * per-row DB + PDF work during upload — a sequential loop over a few
 * hundred rows against a remote database is dramatically slower than the
 * same work done with modest concurrency (network round-trip latency
 * dominates, and it's mostly hidden once requests overlap).
 */
export async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
