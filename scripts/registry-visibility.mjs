import assert from 'node:assert/strict';

/** npm may acknowledge publication before the exact version is readable. */
export async function waitForRegistryVersion(pkg, {
  fetchVersion = (url, timeout) => fetch(url, { signal: AbortSignal.timeout(timeout), cache: 'no-store' }),
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
  now = Date.now,
  log = console.log,
  timeoutMs = 15 * 60 * 1000,
  intervalMs = 15000
} = {}) {
  const started = now();
  const label = `${pkg.name}@${pkg.version}`;
  const url = `https://registry.npmjs.org/${encodeURIComponent(pkg.name)}/${pkg.version}`;
  let lastStatus;
  for (;;) {
    const remaining = timeoutMs - (now() - started);
    if (remaining <= 0) throw Error(
      `Registry verification timed out after ${Math.round(timeoutMs / 1000)}s: ${label} (${lastStatus}). ` +
      'Publication may already have succeeded. Check npm and rerun Release; published versions are skipped.'
    );
    let response;
    try {
      response = await fetchVersion(url, Math.min(15000, remaining));
    } catch (error) {
      if (!(error instanceof TypeError) && error?.name !== 'TimeoutError') throw error;
      lastStatus = error.name;
    }
    if (response?.ok) {
      assert.equal((await response.json()).version, pkg.version, `Unexpected registry version for ${label}`);
      log(`Registry available: ${label} (after ${Math.round((now() - started) / 1000)}s)`);
      return;
    }
    if (response) {
      lastStatus = response.status;
      if (![404, 429, 500, 502, 503, 504].includes(response.status)) {
        throw Error(`Registry verification failed: ${label} (${response.status})`);
      }
    }
    const delay = Math.min(intervalMs, Math.max(0, timeoutMs - (now() - started)));
    if (delay > 0) {
      log(`Waiting for registry: ${label} (${lastStatus}, ${Math.round((now() - started) / 1000)}s elapsed; retry in ${delay / 1000}s)`);
      await sleep(delay);
    }
  }
}
