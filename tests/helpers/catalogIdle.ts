import { expect, type Page, type TestInfo } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import type {} from '@spatial-elements/core/stage/stageVisualTest';

/** The idle counter assertion starts after real animation/loading/preparation owners finish.
 * Unlike settle(), this observes normal RAF/idle work and never drives extra renderer frames. */
export async function waitForCatalogIdle(page: Page, info: TestInfo) {
	const samples: unknown[] = [];
	try {
		await expect.poll(async () => {
			const snapshot = await page.evaluate(() => ({
				activity: window.__stageVisualTest!.getRenderActivity(),
				stats: window.__stageVisualTest!.getCarouselStats()
			}));
			samples.push(snapshot);
			const a = snapshot.activity, c = a?.catalog, p = a?.preparation;
			return Boolean(a && c && p && !a.animationActive && !a.catalogAnimating &&
				!a.renderInvalidated && !a.pendingRenderFrame && !a.pendingScrollFrame && !a.scrollActive &&
				!a.transitionActive && !c.preparing && !c.layoutDirty && !c.queueDirty && c.loadingActors === 0 &&
				!p.stagedIdlePending && !p.zoomFramePending && p.gate.waiting === 0 && p.detailGate.waiting === 0 && p.assetLoads === 0);
		}, { message: 'catalog animation, loads and queued idle preparation must finish before measuring stillness' }).toBe(true);
	} finally {
		await writeFile(info.outputPath('catalog-idle-precondition.json'), JSON.stringify(samples, null, 2));
	}
}
