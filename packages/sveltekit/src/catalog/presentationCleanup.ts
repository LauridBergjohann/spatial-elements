/** Release independent presentation owners even if another owner fails to clean up.
 * DOM/registry release stays synchronous; asynchronous component teardown is observed.
 */
export function releasePresentationResources(message: string, cleanups: readonly (() => unknown)[]): void {
	const failures: unknown[] = [];
	for (const cleanup of cleanups) {
		try {
			const pending = cleanup();
			if (pending && typeof (pending as PromiseLike<unknown>).then === 'function') {
				void Promise.resolve(pending).catch(error => { console.error(message, error); });
			}
		} catch (error) { failures.push(error); }
	}
	// A diagnostic must not precede release of the remaining synchronous owners.
	for (const error of failures) console.error(message, error);
}
