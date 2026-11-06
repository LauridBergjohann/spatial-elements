import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

// Synthetic, silent public fixture: no third-party footage or network dependency.
const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome', args: ['--disable-gpu'] });
try {
	const page = await browser.newPage();
	const bytes = await page.evaluate(async () => {
		const canvas = document.createElement('canvas');
		canvas.width = 480; canvas.height = 270;
		document.body.appendChild(canvas);
		const context = canvas.getContext('2d', { willReadFrequently: true });
		const stream = canvas.captureStream(0);
		const track = stream.getVideoTracks()[0];
		const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8', videoBitsPerSecond: 200000 });
		const chunks = [];
		const finished = new Promise(resolve => { recorder.onstop = resolve; });
		recorder.ondataavailable = event => chunks.push(event.data);
		recorder.start(100);
		for (let frame = 0; frame < 44; frame++) {
				const elapsed = frame * 50;
				context.fillStyle = '#e9f1fa'; context.fillRect(0, 0, 480, 270);
				context.save(); context.translate(240, 120); context.rotate(elapsed * Math.PI / 4000);
				context.fillStyle = '#3277bd'; context.fillRect(-60, -60, 120, 120);
				context.strokeStyle = '#173d66'; context.lineWidth = 5; context.strokeRect(-60, -60, 120, 120);
				context.restore(); context.fillStyle = '#173d66'; context.font = '20px sans-serif';
				context.textAlign = 'center'; context.fillText('Spatial Elements · media study', 240, 240);
				context.getImageData(0, 0, 1, 1);
				track.requestFrame();
				await new Promise(resolve => setTimeout(resolve, 50));
		}
		await new Promise(resolve => setTimeout(resolve, 200));
		recorder.stop(); await finished;
		return [...new Uint8Array(await new Blob(chunks, { type: 'video/webm' }).arrayBuffer())];
	});
	if (bytes.length < 1000) throw new Error('Recording contains no usable video frames');
	const playable = await page.evaluate(async data => {
		const video = document.createElement('video'); video.muted = true;
		video.src = URL.createObjectURL(new Blob([new Uint8Array(data)], { type: 'video/webm' }));
		document.body.appendChild(video);
		await new Promise((resolve, reject) => { video.onloadeddata = resolve; video.onerror = reject; });
		await video.play(); await new Promise(resolve => setTimeout(resolve, 200));
		return video.videoWidth === 480 && video.videoHeight === 270 && video.currentTime > 0;
	}, bytes);
	if (!playable) throw new Error('Recorded fixture could not play');
	writeFileSync(new URL('../fixtures/demo-assets/media-study.webm', import.meta.url), Buffer.from(bytes));
	console.log(`Wrote silent demo video (${bytes.length} bytes)`);
} finally { await browser.close(); }
