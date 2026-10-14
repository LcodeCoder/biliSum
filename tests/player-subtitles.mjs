import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import ts from 'typescript';
import { chromium } from 'playwright';

test('player subtitles install, replace, escape, reattach and clear on navigation', async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(existsSync(chromium.executablePath()) ? {} : { channel: 'chrome' }),
  });
  try {
    const page = await browser.newPage();
    await page.route('https://www.bilibili.com/**', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<video controls></video>',
      }),
    );
    await page.goto('https://www.bilibili.com/video/BV1gA411j7Ta?p=3');
    const source = ts
      .transpileModule(await readFile('src/lib/player-subtitles.ts', 'utf8'), {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ES2022,
        },
      })
      .outputText.replace('export function', 'function');
    await page.addScriptTag({ content: source });
    const identity = { bvid: 'BV1gA411j7Ta', aid: 1, page: 3 };
    const install = (cues) =>
      page.evaluate(
        ({ identity, cues }) => renderPlayerSubtitles(identity, cues),
        { identity, cues },
      );
    const state = () =>
      page.evaluate(() => {
        const tracks = document.querySelector('video').textTracks;
        const track = tracks[0];
        return {
          count: tracks.length,
          mode: track?.mode,
          cues: Array.from(track?.cues || []).map((c) => [
            c.startTime,
            c.endTime,
            c.getCueAsHTML().textContent,
          ]),
        };
      });
    assert.equal(
      await install([
        { from: 1, to: 3, content: '<b>文字</b> & 测试' },
        { from: 4, to: 2, content: 'invalid' },
      ]),
      true,
    );
    assert.deepEqual(await state(), {
      count: 1,
      mode: 'showing',
      cues: [[1, 3, '<b>文字</b> & 测试']],
    });
    await install([{ from: 5, to: 7, content: '新字幕' }]);
    assert.deepEqual(await state(), {
      count: 1,
      mode: 'showing',
      cues: [[5, 7, '新字幕']],
    });
    await page.evaluate(() =>
      document
        .querySelector('video')
        .replaceWith(document.createElement('video')),
    );
    await page.waitForFunction(
      () => document.querySelector('video').textTracks[0]?.mode === 'showing',
    );
    assert.deepEqual((await state()).cues, [[5, 7, '新字幕']]);
    await page.evaluate(() => history.pushState(null, '', '?p=4'));
    await page.waitForFunction(
      () => document.querySelector('video').textTracks[0]?.mode === 'disabled',
    );
    assert.deepEqual((await state()).cues, []);
    assert.equal(await install([{ from: 0, to: 2, content: '旧视频' }]), false);
    await page.evaluate(() => history.pushState(null, '', '?p=3'));
    await install([{ from: 0, to: 2, content: '字幕' }]);
    await page.evaluate(() => renderPlayerSubtitles(null, []));
    assert.equal((await state()).mode, 'disabled');
    // A real media timeline verifies browser synchronization, including seeking while paused.
    await page.evaluate(async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 360;
      const context = canvas.getContext('2d');
      const stream = canvas.captureStream(10);
      const chunks = [];
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      recorder.ondataavailable = (event) => chunks.push(event.data);
      const stopped = new Promise((resolve) => (recorder.onstop = resolve));
      recorder.start();
      const timer = setInterval(() => {
        context.fillStyle = '#222';
        context.fillRect(0, 0, 640, 360);
      }, 50);
      await new Promise((resolve) => setTimeout(resolve, 1300));
      recorder.stop();
      await stopped;
      clearInterval(timer);
      stream.getTracks().forEach((track) => track.stop());
      const video = document.querySelector('video');
      video.src = URL.createObjectURL(new Blob(chunks, { type: 'video/webm' }));
      await new Promise((resolve) => (video.onloadeddata = resolve));
    });
    await install([{ from: 0.2, to: 0.8, content: '同步字幕' }]);
    await page.evaluate(() => {
      document.querySelector('video').currentTime = 0.4;
    });
    await page.waitForFunction(
      () =>
        document.querySelector('video').textTracks[0].activeCues?.[0]?.text ===
        '同步字幕',
    );
    await page.evaluate(() => {
      document.querySelector('video').currentTime = 1;
    });
    await page.waitForFunction(
      () =>
        document.querySelector('video').textTracks[0].activeCues?.length === 0,
    );
  } finally {
    await browser.close();
  }
});
