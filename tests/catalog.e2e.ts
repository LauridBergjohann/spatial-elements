import {test,expect} from '@playwright/test';
import type {} from '@spatial-elements/core/stage/stageVisualTest';
for (const view of ['list','carousel','mixed']) test(view+' enhances and survives detail/history navigation',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/demo/categories/'+view+'?stage-test=1');
 await expect(page.locator('.stage')).toHaveAttribute('data-stage-state','enhanced');
 const target=view==='carousel'?page.locator('[data-carousel-item="column"] .information').first():page.locator('[data-catalog-card][data-spatial-element-id="column"]').first();
 await target.scrollIntoViewIfNeeded();
 await expect(page.locator('[data-catalog-model-ready]').first()).toBeAttached();
 await page.evaluate(()=>window.__stageVisualTest?.settle(24));
 await target.click();await expect(page).toHaveURL(/elements\/column/);
 await expect(page.locator('[data-catalog-transition]')).toHaveCount(0);
 await expect.poll(()=>page.evaluate(()=>window.__stageVisualTest?.getCatalogPresentation()?.representations.state)).toBe('high');
 await page.evaluate(()=>window.__stageVisualTest?.setView({azimuth:180,zoom:0.15}));
 await page.goBack();await expect(page).toHaveURL(new RegExp('categories/'+view));
 await expect(page.locator('[data-catalog-transition]')).toHaveCount(0);
 await page.goForward();await expect(page).toHaveURL(/elements\/column/);
 await expect(page.locator('[data-catalog-transition]')).toHaveCount(0);expect(errors).toEqual([]);
});
test('content anchor navigates into the detail section',async({page})=>{
 await page.goto('/demo/categories/mixed');await page.getByRole('link',{name:'Explore the orb features'}).click();
 await expect(page).toHaveURL(/elements\/orb#features/);await expect(page.locator('#features')).toBeInViewport();
});
test('HTML remains useful without JavaScript',async({browser})=>{
 const context=await browser.newContext({javaScriptEnabled:false});const page=await context.newPage();
 await page.goto('http://127.0.0.1:4174/demo/categories/list');await expect(page.getByRole('heading',{name:'A study of form'})).toBeVisible();
 await page.locator('[data-catalog-card][data-spatial-element-id="orb"]').click();await expect(page).toHaveURL(/elements\/orb/);await expect(page.getByRole('heading',{name:'Orb',exact:true}).first()).toBeVisible();await context.close();
});
test('GPU unavailable retains posters and native navigation',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(navigator,'gpu',{value:undefined,configurable:true}));await page.goto('/demo/categories/list');await expect(page.locator('.stage')).toHaveAttribute('data-stage-state','fallback');await page.locator('[data-catalog-card][data-spatial-element-id="ring"]').click();await expect(page).toHaveURL(/elements\/ring/);
});
