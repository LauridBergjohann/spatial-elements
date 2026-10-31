import { expect, test } from '@playwright/test';
test('carousel island and nested scrolled content retain fractional projective corner coordinates', async ({page})=>{
 await page.goto('/proof/carousel-projection');
 await expect.poll(()=>page.evaluate(()=>typeof (window as any).__captureCarouselProjection)).toBe('function');
 for(const scroll of [false,true]){
  if(scroll)await page.evaluate(()=>(window as any).__scrollCarouselProjection());
  for(const selector of ['[data-projection-island]','[data-projection-nested]']){
   const result=await page.evaluate(selector=>(window as any).__captureCarouselProjection(selector),selector);
   expect(result.capture).toBeTruthy();
   expect(result.capture.width).toBeCloseTo(parseFloat(result.width),4);
   expect(result.capture.height).toBeCloseTo(parseFloat(result.height),4);
   for(let i=0;i<4;i++){
    expect(Math.abs(result.capture.corners[i].x-result.actual[i].x),selector+' x '+i).toBeLessThan(0.05);
    expect(Math.abs(result.capture.corners[i].y-result.actual[i].y),selector+' y '+i).toBeLessThan(0.05);
   }
  }
 }
});
