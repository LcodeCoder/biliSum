// Production bundle + local mock APIs. No live Bilibili account or paid model calls.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
let server, browser, base;
const appearances = [
  {
    value: 'light',
    label: '浅色模式',
    background: '#f5f2ea',
    surface: '#fdfbf6',
    text: '#1f1c17',
    tableLine: '#bbae9b',
  },
  {
    value: 'eye',
    label: '护眼模式',
    background: '#eee7d9',
    surface: '#f5efdf',
    text: '#302c24',
    tableLine: '#b4a68d',
  },
  {
    value: 'dark',
    label: '深色模式',
    background: '#15130f',
    surface: '#1c1a15',
    text: '#ebe5d8',
    tableLine: '#665d4f',
  },
];
const rgb = (hex) =>
  'rgb(' +
  [1, 3, 5]
    .map((index) => parseInt(hex.slice(index, index + 2), 16))
    .join(', ') +
  ')';

before(async () => {
  server = spawn(process.execPath, ['scripts/preview.mjs'], {
    env: { ...process.env, BILISUM_PREVIEW_PORT: '0' },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  base = await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Preview server did not start')),
      10000,
    );
    server.stdout.on('data', (data) => {
      const match = String(data).match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) {
        clearTimeout(timer);
        resolve(match[0]);
      }
    });
    server.once('error', reject);
    server.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error('Preview exited: ' + code));
    });
  });
  browser = await chromium.launch({
    headless: true,
    ...(process.env.BILISUM_CHROME_PATH
      ? { executablePath: process.env.BILISUM_CHROME_PATH }
      : existsSync(chromium.executablePath())
        ? {}
        : { channel: 'chrome' }),
  });
});
after(async () => {
  await browser?.close();
  server?.kill();
});
async function scenario(
  run,
  query = '',
  viewport = { width: 320, height: 850 },
  contextOptions = {},
) {
  const context = await browser.newContext({
    viewport,
    acceptDownloads: true,
    ...contextOptions,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [],
    external = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (!request.url().startsWith(base) && !request.url().startsWith('blob:'))
      external.push(request.url());
  });
  try {
    await page.goto(base + '/?width=' + viewport.width + query);
    await page
      .getByRole('button', { name: '生成 Markdown 总结', exact: true })
      .waitFor();
    await page.waitForFunction(
      () =>
        !document.querySelector('[aria-label="生成 Markdown 总结"]').disabled,
    );
    await run(page, context);
    assert.deepEqual(errors, [], 'no unhandled browser errors');
    assert.deepEqual(
      external,
      [],
      'no external requests from fixture or model HTML',
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      'no horizontal overflow at ' + viewport.width + 'px',
    );
  } finally {
    await context.close();
  }
}
const generate = async (page) => {
  await page
    .getByRole('button', { name: '生成 Markdown 总结', exact: true })
    .click();
  await page.waitForFunction(
    () => !document.querySelector('[aria-label="下载 Markdown 总结"]').disabled,
  );
};
const fault = (page, changes) =>
  page.evaluate(
    (changes) => Object.assign(window.__biliSumFixture.faults, changes),
    changes,
  );
const ready = (page) =>
  page.waitForFunction(
    () => !document.querySelector('[aria-label="刷新当前视频和字幕"]').disabled,
  );

test('language failure rolls back selection and keeps subtitles and completed summary', async () =>
  scenario(async (page) => {
    await generate(page);
    const summary = await page.locator('.markdown-body').innerText();
    await page.getByRole('button', { name: '字幕页面', exact: true }).click();
    const original = await page.locator('.cue-list').innerText();
    await fault(page, { language: true });
    await page.getByLabel('字幕语言').selectOption('en');
    await page
      .getByRole('alert')
      .filter({ hasText: '已保留原字幕和结果' })
      .waitFor();
    assert.equal(await page.getByLabel('字幕语言').inputValue(), 'zh');
    assert.equal(await page.locator('.cue-list').innerText(), original);
    await page
      .getByRole('button', { name: 'Markdown 总结页面', exact: true })
      .click();
    assert.equal(await page.locator('.markdown-body').innerText(), summary);
    await page.getByRole('button', { name: '字幕页面', exact: true }).click();
    await fault(page, { language: false });
    await page.getByLabel('字幕语言').selectOption('en');
    await page
      .locator('.cue-list')
      .getByText(/English:/)
      .first()
      .waitFor();
  }));

test('refresh failure preserves a complete result and retry recovers', async () =>
  scenario(async (page) => {
    await generate(page);
    const summary = await page.locator('.markdown-body').innerText();
    await fault(page, { subtitles: true });
    await page.getByRole('button', { name: '刷新当前视频和字幕' }).click();
    await page
      .locator('.source-notice')
      .filter({ hasText: '已保留原字幕和结果' })
      .waitFor();
    assert.equal(await page.locator('.markdown-body').innerText(), summary);
    await fault(page, { subtitles: false });
    await page.getByRole('button', { name: '刷新当前视频和字幕' }).click();
    await ready(page);
    assert.equal(await page.locator('.markdown-body').innerText(), summary);
  }));

test('truncated summary remains downloadable as an incomplete draft without overwriting full cache', async () =>
  scenario(async (page) => {
    await generate(page);
    const full = await page.locator('.markdown-body').innerText();
    await fault(page, { stream: 'truncate' });
    await generate(page);
    await page.locator('.draft-notice').waitFor();
    assert.ok(
      (await page.locator('.error-banner').innerText()).includes('提前中断'),
    );
    const downloadEvent = page.waitForEvent('download');
    await page
      .getByRole('button', { name: '下载 Markdown 总结', exact: true })
      .click();
    const download = await downloadEvent;
    assert.ok(download.suggestedFilename().includes('未完成草稿'));
    assert.ok(
      (await readFile(await download.path(), 'utf8')).includes(
        '未完成草稿：生成已中断',
      ),
    );
    await page.getByRole('button', { name: '显示上次完整总结' }).click();
    assert.equal(await page.locator('.markdown-body').innerText(), full);
    await page.reload();
    await ready(page);
    await page
      .getByRole('button', { name: 'Markdown 总结页面', exact: true })
      .click();
    assert.equal(await page.locator('.markdown-body').innerText(), full);
  }));

test('stop retains partial text and switching parts never shows a stale result', async () =>
  scenario(async (page) => {
    await fault(page, { stream: 'slow' });
    await page
      .getByRole('button', { name: '生成 Markdown 总结', exact: true })
      .click();
    await page.locator('.summary-document.drafting').waitFor();
    await page.getByRole('button', { name: '停止生成' }).click();
    await page.locator('.draft-notice').waitFor();
    assert.equal(
      await page
        .getByRole('button', { name: '下载 Markdown 总结', exact: true })
        .isEnabled(),
      true,
    );
    await page
      .getByRole('button', { name: '生成 Markdown 总结', exact: true })
      .click();
    await page.waitForFunction(() => window.__biliSumFixture.stats.ai === 2);
    await page.locator('.summary-document.drafting').waitFor();
    await page.evaluate(() => window.__biliSumFixture.switchPage(2));
    await page.locator('.part-label').filter({ hasText: 'P2' }).waitFor();
    await ready(page);
    assert.equal(await page.locator('.draft-notice').count(), 0);
    assert.equal(
      await page
        .getByRole('button', { name: '下载 Markdown 总结', exact: true })
        .isEnabled(),
      false,
    );
    assert.ok(
      await page.evaluate(() => window.__biliSumFixture.stats.aborted >= 2),
    );
  }));

test('storage failure keeps generated content downloadable and a later generation can save', async () =>
  scenario(async (page) => {
    await fault(page, { storage: true });
    await generate(page);
    await page.getByText('内容已生成；本地缓存未保存，请及时下载').waitFor();
    assert.equal(
      await page
        .getByRole('button', { name: '下载 Markdown 总结', exact: true })
        .isEnabled(),
      true,
    );
    await fault(page, { storage: false });
    await generate(page);
    await page.getByText('Markdown 总结已生成').waitFor();
  }));

test('HTTP error redacts credentials and explicit retry recovers', async () =>
  scenario(async (page) => {
    await fault(page, { stream: 'http' });
    await page
      .getByRole('button', { name: '生成 Markdown 总结', exact: true })
      .click();
    await page.getByRole('alert').filter({ hasText: '429' }).waitFor();
    assert.ok(
      !(await page.locator('.error-banner').innerText()).includes(
        'fixture-key',
      ),
    );
    await fault(page, { stream: '' });
    await page.getByRole('button', { name: '重新生成', exact: true }).click();
    await page.waitForFunction(
      () =>
        !document.querySelector('[aria-label="下载 Markdown 总结"]').disabled,
    );
  }));

test('cancelled permission prompt cannot start a model request or save settings', async () =>
  scenario(async (page) => {
    await page.getByRole('button', { name: '打开 API 设置' }).click();
    await fault(page, { permission: true });
    await page.getByRole('button', { name: '测试 API 连接' }).click();
    await page.waitForFunction(
      () => !!window.__biliSumFixture.resolvePermission,
    );
    await page.getByRole('button', { name: '取消测试' }).click();
    await page.waitForFunction(
      () => !document.querySelector('[aria-label="测试 API 连接"]').disabled,
    );
    await page.evaluate(() => window.__biliSumFixture.resolvePermission(true));
    assert.equal(
      await page.evaluate(() => window.__biliSumFixture.stats.ai),
      0,
    );
    await fault(page, { permission: false });
    await page.getByRole('button', { name: '测试 API 连接' }).click();
    await page.getByText('连接成功。请保存配置。').waitFor();
    await page.getByLabel('模型名称', { exact: true }).fill('new-model');
    assert.equal(await page.getByText('连接成功。请保存配置。').count(), 0);
    await page.getByRole('button', { name: '保存 API 设置' }).click();
    await page.getByText('API 设置已保存').waitFor();
  }));

test('invalid imports preserve subtitles; switching source resets a stale search', async () =>
  scenario(async (page) => {
    await page.getByRole('button', { name: '字幕页面', exact: true }).click();
    const original = await page.locator('.cue-list').innerText();
    await page.getByLabel('选择字幕文件').setInputFiles({
      name: 'bad.json',
      mimeType: 'application/json',
      buffer: Buffer.from('null'),
    });
    await page.getByRole('alert').filter({ hasText: 'body 数组' }).waitFor();
    assert.equal(await page.locator('.cue-list').innerText(), original);
    await page.getByLabel('搜索字幕内容').fill('no-match');
    await page.getByLabel('字幕语言').selectOption('en');
    await ready(page);
    assert.equal(await page.getByLabel('搜索字幕内容').inputValue(), '');
    await page.getByLabel('选择字幕文件').setInputFiles({
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('A --> B\n纯文本资料'),
    });
    await page.getByText('已导入 2 条字幕').waitFor();
    assert.equal(
      await page
        .getByRole('button', { name: '下载 SRT 字幕', exact: true })
        .isEnabled(),
      false,
    );
  }));

test('summary tables fill the document with readable cells and visible grids in both themes', async () => {
  for (const theme of ['light', 'dark']) {
    for (const width of [280, 320, 380, 720]) {
      await scenario(
        async (page) => {
          await generate(page);
          const table = page.locator('.markdown-body table');
          assert.equal(await table.locator('tbody tr').count(), 7);
          assert.equal(await table.locator('thead th').count(), 3);
          assert.equal(
            await table.locator('tbody tr').last().innerText(),
            '物理层\t变成信号真正发出\t电压、光、电磁波',
          );
          const metrics = await table.evaluate((table) => {
            const wrapper = table.parentElement;
            const cell = table.querySelector('td');
            const style = getComputedStyle(cell);
            return {
              tableWidth: table.getBoundingClientRect().width,
              wrapperWidth: wrapper.getBoundingClientRect().width,
              bodyWidth: wrapper.parentElement.getBoundingClientRect().width,
              bodyFont: parseFloat(
                getComputedStyle(wrapper.parentElement).fontSize,
              ),
              cellFont: parseFloat(style.fontSize),
              paddingX: parseFloat(style.paddingLeft),
              paddingY: parseFloat(style.paddingTop),
              borders: ['Top', 'Right', 'Bottom', 'Left'].map((side) => ({
                width: parseFloat(style['border' + side + 'Width']),
                style: style['border' + side + 'Style'],
                color: style['border' + side + 'Color'],
              })),
              headerBackground: getComputedStyle(table.querySelector('th'))
                .backgroundColor,
              tableBackground: getComputedStyle(table).backgroundColor,
              alternateBackground: getComputedStyle(
                table.querySelectorAll('tbody tr')[1],
              ).backgroundColor,
              bodyScrollWidth: wrapper.parentElement.scrollWidth,
              bodyClientWidth: wrapper.parentElement.clientWidth,
            };
          });
          assert.ok(
            metrics.tableWidth >= metrics.wrapperWidth - 1,
            'table fills the available width',
          );
          assert.ok(
            Math.abs(metrics.wrapperWidth - metrics.bodyWidth) < 1,
            'scroll container fills the document',
          );
          assert.ok(
            metrics.cellFont >= 13 && metrics.cellFont === metrics.bodyFont,
            'table text matches readable body text',
          );
          assert.ok(
            metrics.paddingX >= 10 && metrics.paddingY >= 8,
            'cells have breathing room',
          );
          for (const border of metrics.borders) {
            assert.ok(
              border.width >= 1 && border.style === 'solid',
              'each row and column has a visible separator',
            );
            assert.notEqual(border.color, 'rgba(0, 0, 0, 0)');
            assert.notEqual(border.color, metrics.tableBackground);
          }
          assert.notEqual(metrics.headerBackground, metrics.tableBackground);
          assert.notEqual(metrics.alternateBackground, metrics.tableBackground);
          assert.ok(
            metrics.bodyScrollWidth <= metrics.bodyClientWidth + 1,
            'table overflow stays inside its own container',
          );
        },
        '&summary=table&theme=' + theme,
        { width, height: 1000 },
      );
    }
  }
});

test('wide and merged tables keep alignment, keyboard scrolling, safe markup, and original Markdown downloads', async () => {
  for (const width of [280, 720]) {
    await scenario(
      async (page) => {
        await generate(page);
        const region = page.getByRole('region', {
          name: '表格 1，宽表可左右滚动',
          exact: true,
        });
        const table = region.locator('table');
        assert.equal(await page.locator('.markdown-table-scroll').count(), 2);
        const sizing = await region.evaluate((node) => ({
          client: node.clientWidth,
          scroll: node.scrollWidth,
        }));
        assert.ok(
          sizing.scroll > sizing.client + 20,
          'many columns scroll instead of shrinking text',
        );
        await region.focus();
        await region.press('ArrowRight');
        await page.waitForFunction(
          () => document.querySelector('.markdown-table-scroll').scrollLeft > 0,
        );
        const alignment = await table
          .locator('thead th')
          .evaluateAll((cells) =>
            cells.slice(0, 3).map((cell) => getComputedStyle(cell).textAlign),
          );
        assert.deepEqual(alignment, ['left', 'center', 'right']);
        await region.evaluate((node) => {
          node.scrollLeft = node.scrollWidth;
        });
        const lastCell = await table
          .locator('tbody tr')
          .first()
          .locator('td')
          .last()
          .boundingBox();
        const bounds = await region.boundingBox();
        assert.ok(
          lastCell.x >= bounds.x &&
            lastCell.x + lastCell.width <= bounds.x + bounds.width + 1,
          'last column can be read',
        );
        const merged = page.locator('.markdown-body table').nth(1);
        assert.equal(await merged.locator('th').getAttribute('colspan'), '2');
        assert.equal(
          await merged.locator('td').first().getAttribute('rowspan'),
          '2',
        );
        assert.equal(
          await page
            .locator(
              '.markdown-body [style], .markdown-body [onclick], .markdown-body .untrusted-table',
            )
            .count(),
          0,
        );
        assert.equal(await page.evaluate(() => window.__xss), undefined);
        await page
          .getByRole('button', { name: '切换 Markdown 源码', exact: true })
          .click();
        const raw = await page.locator('.markdown-source').innerText();
        assert.ok(raw.includes('| :--- | :---: | ---: |'));
        assert.ok(
          !raw.includes('markdown-table-scroll'),
          'generated wrapper is preview-only',
        );
        const downloadEvent = page.waitForEvent('download');
        await page
          .getByRole('button', { name: '下载 Markdown 总结', exact: true })
          .click();
        const downloaded = await downloadEvent;
        const file = await readFile(await downloaded.path(), 'utf8');
        assert.ok(
          file.includes(raw.trim()),
          'download keeps the complete original table source',
        );
        assert.ok(!file.includes('markdown-table-scroll'));
        await page
          .getByRole('button', { name: '切换 Markdown 源码', exact: true })
          .click();
        assert.equal(await page.locator('.markdown-table-scroll').count(), 2);
      },
      '&summary=wide-table&theme=' + (width === 280 ? 'dark' : 'light'),
      { width, height: 1000 },
    );
  }
});

test('hostile model HTML cannot execute scripts, load remote resources, or attach link pings', async () =>
  scenario(async (page) => {
    await page.evaluate(() => {
      const original = window.fetch;
      window.fetch = async (input, init) =>
        String(input).endsWith('/chat/completions')
          ? new Response(
              JSON.stringify({
                choices: [
                  {
                    message: {
                      content:
                        '## 安全测试\n\n<img src="https://evil.example/x" onerror="window.__xss=1"><iframe src="https://evil.example"></iframe><link rel="stylesheet" href="https://evil.example/x"><svg onload="window.__xss=1"></svg><a href="javascript:alert(1)" ping="https://evil.example/p">坏链接</a>\n\n[安全链接](https://www.bilibili.com)',
                    },
                    finish_reason: 'stop',
                  },
                ],
              }),
              { headers: { 'Content-Type': 'application/json' } },
            )
          : original(input, init);
    });
    await generate(page);
    assert.equal(
      await page
        .locator(
          '.markdown-body img, .markdown-body iframe, .markdown-body link, .markdown-body svg, .markdown-body [ping]',
        )
        .count(),
      0,
    );
    assert.equal(
      await page.locator('.markdown-body a[href^="javascript:"]').count(),
      0,
    );
    assert.equal(await page.evaluate(() => window.__xss), undefined);
    assert.equal(
      await page
        .locator('.markdown-body a[href^="https:"]')
        .getAttribute('rel'),
      'noopener noreferrer',
    );
  }));

test('all appearances fit narrow headers, persist and match Markdown, map and downloaded HTML without AI calls', async () => {
  for (const width of [280, 720]) {
    await scenario(
      async (page) => {
        await generateMap(page);
        await page.getByLabel('视频与生成设置', { exact: true }).click();
        await generate(page);
        const markdown = await page.locator('.markdown-body').innerText();
        await generateHtml(page);
        const chapters = await reportFrame(page)
          .locator('.am-panel')
          .allTextContents();
        for (const appearance of appearances) {
          const toggle = page.getByRole('button', {
            name: appearance.label,
            exact: true,
          });
          await toggle.click();
          assert.equal(await toggle.getAttribute('aria-pressed'), 'true');
          assert.equal(
            await page
              .locator('body')
              .evaluate((el) => getComputedStyle(el).backgroundColor),
            rgb(appearance.background),
          );
          for (const button of await page
            .locator('.header-tools a, .header-tools button')
            .all()) {
            const bounds = await button.boundingBox();
            assert.ok(
              bounds.x >= 0 && bounds.x + bounds.width <= width,
              'header controls remain visible at ' + width,
            );
          }
          await openHtml(page);
          await waitReportAttribute(page, 'data-appearance', appearance.value);
          const frame = reportFrame(page);
          assert.equal(
            await frame
              .locator('body')
              .evaluate((el) => getComputedStyle(el).backgroundColor),
            rgb(appearance.background),
          );
          assert.equal(
            await frame
              .locator('.am-panel')
              .first()
              .evaluate((el) => getComputedStyle(el).backgroundColor),
            rgb(appearance.surface),
          );
          assert.equal(
            await frame
              .locator('body')
              .evaluate((el) => getComputedStyle(el).color),
            rgb(appearance.text),
          );
          assert.deepEqual(
            await frame.locator('.am-panel').allTextContents(),
            chapters,
          );
          const preview = await previewHtml(page);
          const { text } = await downloadHtml(page);
          assert.equal(text, preview);
          await page
            .getByRole('button', { name: 'Markdown 总结页面', exact: true })
            .click();
          assert.equal(
            await page.locator('.markdown-body').innerText(),
            markdown,
          );
          assert.equal(
            await page
              .locator('.summary-document')
              .evaluate((el) => getComputedStyle(el).backgroundColor),
            rgb(appearance.surface),
          );
          const cell = page.locator('.markdown-body tbody td').first();
          assert.equal(
            await cell.evaluate((el) => getComputedStyle(el).color),
            rgb(appearance.text),
          );
          assert.equal(
            await cell.evaluate((el) => getComputedStyle(el).borderColor),
            rgb(appearance.tableLine),
          );
          await page
            .getByRole('button', { name: '思维导图页面', exact: true })
            .click();
          assert.equal(
            await page.locator('.map-drawing svg > rect').getAttribute('fill'),
            appearance.background,
          );
          if (width === 280) {
            for (const format of ['SVG', 'PNG']) {
              const event = page.waitForEvent('download');
              await page
                .getByRole('button', {
                  name: '下载 ' + format + ' 思维导图',
                  exact: true,
                })
                .click();
              const bytes = await readFile(await (await event).path());
              if (format === 'SVG')
                assert.ok(
                  bytes
                    .toString()
                    .includes('fill="' + appearance.background + '"'),
                );
              else {
                const pixel = await page.evaluate(
                  async (bytes) => {
                    const url = URL.createObjectURL(
                      new Blob([new Uint8Array(bytes)], { type: 'image/png' }),
                    );
                    try {
                      const image = new Image();
                      image.src = url;
                      await image.decode();
                      const canvas = document.createElement('canvas');
                      canvas.width = canvas.height = 1;
                      const context = canvas.getContext('2d');
                      context.drawImage(image, 0, 0);
                      return [...context.getImageData(0, 0, 1, 1).data];
                    } finally {
                      URL.revokeObjectURL(url);
                    }
                  },
                  [...bytes],
                );
                assert.deepEqual(
                  pixel,
                  [1, 3, 5]
                    .map((index) =>
                      parseInt(
                        appearance.background.slice(index, index + 2),
                        16,
                      ),
                    )
                    .concat(255),
                );
              }
            }
          }
        }
        assert.equal(
          await page.evaluate(() => window.__biliSumFixture.stats.ai),
          3,
        );
        await page
          .getByRole('button', { name: '护眼模式', exact: true })
          .click();
        await page.waitForFunction(
          async () =>
            (await chrome.storage.local.get('biliSum.preferences.v1'))[
              'biliSum.preferences.v1'
            ]?.theme === 'eye',
        );
        await page.reload();
        await ready(page);
        assert.equal(
          await page.locator('html').getAttribute('data-theme'),
          'eye',
        );
        assert.equal(
          await page
            .getByRole('button', { name: '护眼模式', exact: true })
            .getAttribute('aria-pressed'),
          'true',
        );
        await openHtml(page);
        await waitReportAttribute(page, 'data-appearance', 'eye');
        assert.deepEqual(
          await reportFrame(page).locator('.am-panel').allTextContents(),
          chapters,
        );
        assert.equal(
          await page.evaluate(() => window.__biliSumFixture.stats.ai),
          0,
        );
      },
      '&summary=table',
      { width, height: 900 },
    );
  }
});

test('map generation, dark theme, SVG and PNG downloads remain usable', async () =>
  scenario(async (page) => {
    await page
      .getByRole('button', { name: '生成思维导图', exact: true })
      .click();
    await page.waitForFunction(
      () =>
        !document.querySelector('[aria-label="下载 SVG 思维导图"]').disabled,
    );
    await page.getByRole('button', { name: '深色模式', exact: true }).click();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    for (const format of ['SVG', 'PNG']) {
      const event = page.waitForEvent('download');
      await page
        .getByRole('button', {
          name: '下载 ' + format + ' 思维导图',
          exact: true,
        })
        .click();
      const download = await event;
      const bytes = await readFile(await download.path());
      if (format === 'PNG')
        assert.deepEqual(
          [...bytes.subarray(0, 8)],
          [137, 80, 78, 71, 13, 10, 26, 10],
        );
      else assert.ok(bytes.toString().includes('<svg'));
    }
  }));

test('closing settings while a permission prompt is pending cannot send a late test request', async () =>
  scenario(async (page) => {
    await page.getByRole('button', { name: '打开 API 设置' }).click();
    await fault(page, { permission: true });
    await page.getByRole('button', { name: '测试 API 连接' }).click();
    await page.waitForFunction(
      () => !!window.__biliSumFixture.resolvePermission,
    );
    await page.getByRole('button', { name: '返回工作空间' }).click();
    await page.evaluate(async () => {
      window.__biliSumFixture.resolvePermission(true);
      await Promise.resolve();
      await Promise.resolve();
    });
    assert.equal(
      await page.evaluate(() => window.__biliSumFixture.stats.ai),
      0,
    );
  }));

test('startup settings load disables both settings entry points until saved configuration is ready', async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await page.route('**/fixture.js', async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        body:
          (await response.text()) +
          '\nwindow.__biliSumFixture.faults.settingsDelay = 800;',
      });
    });
    await page.goto(base);
    const open = page.getByRole('button', { name: '打开 API 设置' });
    await open.waitFor();
    assert.equal(await open.isDisabled(), true);
    assert.equal(
      await page.getByRole('button', { name: '配置 API Key' }).count(),
      0,
    );
    await page.waitForFunction(
      () => !document.querySelector('[aria-label="打开 API 设置"]').disabled,
    );
    await open.click();
    assert.equal(
      await page.getByLabel('API Key', { exact: true }).inputValue(),
      'fixture-key',
    );
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
});

const generateMap = async (page) => {
  await page.getByRole('button', { name: '生成思维导图', exact: true }).click();
  await page.locator('.map-viewport').waitFor();
  await page.waitForFunction(() => {
    const transform = document.querySelector('.map-drawing')?.style.transform;
    return transform && transform !== 'translate(0px, 0px) scale(1)';
  });
};

test('long maps gain reading space, focus by topic, preserve the camera and export the whole result', async () =>
  scenario(
    async (page) => {
      await generateMap(page);
      assert.equal(
        await page.locator('.setup-section').getAttribute('open'),
        null,
      );
      assert.equal(
        await page.locator('.map-drawing svg g').count(),
        7,
        'start with the six topics',
      );
      assert.equal(await page.getByLabel('显示层级').inputValue(), '1');
      const normal = await page.locator('.map-viewport').boundingBox();
      assert.ok(normal.height > 400);
      assert.ok(await page.locator('.map-drawing').getAttribute('style'));
      await page
        .getByRole('button', { name: '专注阅读导图', exact: true })
        .click();
      const focused = await page.locator('.map-viewport').boundingBox();
      assert.ok(
        focused.height > normal.height + 100,
        'focus mode frees the header and navigation area',
      );
      assert.equal(await page.locator('.app-header').isVisible(), false);
      await page.getByLabel('查看主题', { exact: true }).selectOption('1');
      assert.equal(await page.locator('.map-drawing svg g').count(), 17);
      assert.equal(await page.getByLabel('显示层级').inputValue(), '2');
      await page
        .getByRole('button', { name: '原始大小阅读', exact: true })
        .click();
      assert.equal(await page.locator('.zoom-value').innerText(), '100%');
      const camera = await page.locator('.map-drawing').getAttribute('style');
      await page.getByRole('button', { name: '大纲视图', exact: true }).click();
      assert.match(await page.locator('.outline-title').innerText(), /主题2/);
      await page.getByRole('button', { name: '导图视图', exact: true }).click();
      assert.equal(
        await page.locator('.map-drawing').getAttribute('style'),
        camera,
      );
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('.app-header').isVisible(), true);
      assert.equal(
        await page
          .getByRole('button', { name: '专注阅读导图' })
          .evaluate((el) => document.activeElement === el),
        true,
      );
      await page.getByLabel('查看主题', { exact: true }).selectOption('all');
      await page.getByLabel('显示层级').selectOption('6');
      assert.equal(await page.locator('.map-drawing svg g').count(), 103);
      const rightHeight = Number(
        await page.locator('.map-drawing svg').getAttribute('height'),
      );
      await page.getByLabel('导图布局').selectOption('compact');
      const compactHeight = Number(
        await page.locator('.map-drawing svg').getAttribute('height'),
      );
      assert.ok(compactHeight < rightHeight * 0.55);
      await page.getByLabel('显示层级').selectOption('1');
      const event = page.waitForEvent('download');
      await page
        .getByRole('button', { name: '下载 SVG 思维导图', exact: true })
        .click();
      const downloaded = (
        await readFile(await (await event).path())
      ).toString();
      assert.equal(
        downloaded.match(/<g>/g)?.length,
        103,
        'collapsed notes remain in exports',
      );
      assert.ok(downloaded.includes('细节3'));
      assert.equal(
        await page.evaluate(() => window.__biliSumFixture.stats.ai),
        1,
      );
    },
    '&map=large',
    { width: 380, height: 850 },
  ));

const mapNode = (page, path) =>
  page.locator(`.map-node[data-map-path="${path}"]`);
const mapCount = async (page, count) => {
  await page.waitForFunction(
    (count) => document.querySelectorAll('.map-node').length === count,
    count,
  );
  assert.equal(await page.locator('.map-node').count(), count);
};

test('parent clicks reveal only the next layer, keep siblings independent and reset with depth presets', async () =>
  scenario(
    async (page) => {
      await generateMap(page);
      await mapNode(page, '0.0').click();
      await mapCount(page, 11);
      assert.equal(
        await mapNode(page, '0.0').getAttribute('aria-expanded'),
        'true',
      );
      assert.equal(
        await mapNode(page, '0.0.0').getAttribute('aria-expanded'),
        'false',
      );
      assert.equal(await mapNode(page, '0.0.0.0').count(), 0);
      await mapNode(page, '0.0.0').click();
      await mapCount(page, 14);
      assert.equal(
        await mapNode(page, '0.0.0.0').getAttribute('role'),
        null,
        'leaves are not expansion buttons',
      );
      assert.ok(
        await page.evaluate(() => {
          const viewport = document
            .querySelector('.map-viewport')
            .getBoundingClientRect();
          return Array.from(
            document.querySelectorAll(
              '[data-map-path="0.0.0"], [data-map-path^="0.0.0."]',
            ),
          ).every((node) => {
            const box = node.getBoundingClientRect();
            return (
              box.left >= viewport.left &&
              box.right <= viewport.right &&
              box.top >= viewport.top &&
              box.bottom <= viewport.bottom
            );
          });
        }),
        'the clicked node and its newly revealed children remain visible',
      );
      await mapNode(page, '0.0.0.0').click();
      await mapCount(page, 14);
      const camera = await page.locator('.map-drawing').getAttribute('style');
      await page.getByRole('button', { name: '深色模式', exact: true }).click();
      assert.equal(
        await page.locator('.map-drawing').getAttribute('style'),
        camera,
      );
      await page.getByRole('button', { name: '大纲视图', exact: true }).click();
      await page.getByRole('button', { name: '导图视图', exact: true }).click();
      await mapCount(page, 14);
      assert.equal(
        await page.locator('.map-drawing').getAttribute('style'),
        camera,
      );
      await page.getByLabel('导图布局').selectOption('compact');
      await mapCount(page, 14);
      await page.getByRole('button', { name: '适应画布', exact: true }).click();
      await mapNode(page, '0.1').click();
      await mapCount(page, 18);
      assert.equal(
        await mapNode(page, '0.1.0').getAttribute('aria-expanded'),
        'false',
        'duplicate point titles do not share state',
      );
      await mapNode(page, '0.0').focus();
      await page.keyboard.press('Enter');
      await mapCount(page, 11);
      assert.equal(
        await mapNode(page, '0.1').getAttribute('aria-expanded'),
        'true',
      );
      await page.keyboard.press('Space');
      await mapCount(page, 15);
      assert.equal(
        await mapNode(page, '0.0.0').getAttribute('aria-expanded'),
        'false',
        'reopening does not expand grandchildren',
      );
      const event = page.waitForEvent('download');
      await page
        .getByRole('button', { name: '下载 SVG 思维导图', exact: true })
        .click();
      const downloaded = (
        await readFile(await (await event).path())
      ).toString();
      assert.equal(downloaded.match(/<g>/g)?.length, 103);
      assert.ok(!downloaded.includes('role="button"'));
      await page.getByLabel('显示层级').selectOption('2');
      await mapCount(page, 31);
      await page.getByLabel('显示层级').selectOption('1');
      await mapCount(page, 7);
      assert.equal(
        await mapNode(page, '0.0').getAttribute('aria-expanded'),
        'false',
      );
      await page.getByLabel('查看主题', { exact: true }).selectOption('2');
      await mapCount(page, 17);
      await page.getByLabel('查看主题', { exact: true }).selectOption('all');
      await mapCount(page, 7);
      assert.equal(
        await page.evaluate(() => window.__biliSumFixture.stats.ai),
        1,
      );
    },
    '&map=large',
    { width: 380, height: 850 },
  ));

test('dragging a parent never toggles it and keyboard focus survives SVG replacement', async () =>
  scenario(
    async (page) => {
      await generateMap(page);
      const before = await page.locator('.map-drawing').getAttribute('style');
      const box = await mapNode(page, '0.0').boundingBox();
      const x = box.x + box.width / 2,
        y = box.y + box.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + 30, y + 20, { steps: 5 });
      await page.mouse.move(x, y, { steps: 5 });
      await page.mouse.up();
      await mapCount(page, 7);
      assert.equal(
        await mapNode(page, '0.0').getAttribute('aria-expanded'),
        'false',
      );
      assert.equal(
        await page.locator('.map-drawing').getAttribute('style'),
        before,
        'returning a drag to its start still does not count as a click',
      );
      await mapNode(page, '0.0').focus();
      await page.keyboard.press('Enter');
      await mapCount(page, 11);
      assert.equal(
        await page.evaluate(() =>
          document.activeElement?.getAttribute('data-map-path'),
        ),
        '0.0',
      );
      await mapNode(page, '0.5').focus();
      await page.waitForFunction(() => {
        const viewport = document.querySelector('.map-viewport');
        const bounds = viewport.getBoundingClientRect();
        const node = document.activeElement.getBoundingClientRect();
        return (
          viewport.scrollLeft === 0 &&
          viewport.scrollTop === 0 &&
          node.left >= bounds.left &&
          node.right <= bounds.right &&
          node.top >= bounds.top &&
          node.bottom <= bounds.bottom
        );
      });
      await mapNode(page, '0.0').focus();
      await page.keyboard.press('Space');
      await mapCount(page, 7);
      assert.equal(
        await page.evaluate(() =>
          document.activeElement?.getAttribute('data-map-path'),
        ),
        '0.0',
      );
      await mapNode(page, '0.0').dispatchEvent('keydown', {
        key: 'Enter',
        repeat: true,
      });
      await mapCount(page, 7);
      await page.getByRole('button', { name: '适应画布', exact: true }).click();
      await mapNode(page, '0').click();
      await mapCount(page, 1);
      await mapNode(page, '0').click();
      await mapCount(page, 7);
      assert.equal(
        await mapNode(page, '0.0').getAttribute('aria-expanded'),
        'false',
      );
      await page.getByLabel('显示层级').selectOption('6');
      await mapCount(page, 103);
      await mapNode(page, '0').focus();
      await page.keyboard.press('Enter');
      await mapCount(page, 1);
      await page.keyboard.press('Enter');
      await mapCount(
        page,
        7,
        'the full-depth preset still allows one-level reopening',
      );
    },
    '&map=large',
    { width: 380, height: 850 },
  ));

test('touch taps expand once and cancelled touches leave the tree unchanged', async () =>
  scenario(
    async (page, context) => {
      await generateMap(page);
      let box = await mapNode(page, '0.0').boundingBox();
      const session = await context.newCDPSession(page);
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }],
      });
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchCancel',
        touchPoints: [],
      });
      await mapCount(page, 7);
      assert.equal(
        await page.locator('.map-viewport').getAttribute('class'),
        'map-viewport',
      );
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      await mapCount(page, 11);
      box = await mapNode(page, '0.0').boundingBox();
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      await mapCount(page, 7);
      await session.detach();
    },
    '&map=large',
    { width: 320, height: 850 },
    { hasTouch: true },
  ));

test('node backgrounds contain all real glyphs and hints in both themes and full SVG exports', async () =>
  scenario(
    async (page) => {
      await generateMap(page);
      const overflow = () =>
        Array.from(document.querySelectorAll('.map-drawing .map-node')).flatMap(
          (node) => {
            const rect = node.querySelector('rect').getBBox();
            return Array.from(node.querySelectorAll('text')).flatMap((text) => {
              const box = text.getBBox();
              return box.x >= rect.x + 5 &&
                box.y >= rect.y + 5 &&
                box.x + box.width <= rect.x + rect.width - 5 &&
                box.y + box.height <= rect.y + rect.height - 5
                ? []
                : [
                    {
                      title: node.querySelector('title').textContent,
                      text: box,
                      background: rect,
                    },
                  ];
            });
          },
        );
      await page.evaluate(() => document.fonts.ready);
      for (const theme of ['light', 'dark']) {
        if (theme === 'dark')
          await page
            .getByRole('button', { name: '深色模式', exact: true })
            .click();
        for (const depth of ['1', '6']) {
          await page.getByLabel('显示层级').selectOption(depth);
          assert.deepEqual(
            await page.evaluate(overflow),
            [],
            theme + ': all titles and fold hints stay inside their backgrounds',
          );
        }
      }
      const event = page.waitForEvent('download');
      await page
        .getByRole('button', { name: '下载 SVG 思维导图', exact: true })
        .click();
      const downloaded = (
        await readFile(await (await event).path())
      ).toString();
      assert.ok(downloaded.includes('WWWW') && downloaded.includes('&lt;text'));
      assert.deepEqual(
        await page.evaluate((svg) => {
          const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
          const node = document.importNode(parsed.documentElement, true);
          node.style.cssText = 'position:fixed;left:-10000px;top:0;';
          document.body.append(node);
          try {
            return Array.from(node.querySelectorAll('g')).flatMap((group) => {
              const rect = group.querySelector('rect').getBBox();
              const text = group.querySelector('text').getBBox();
              return text.x >= rect.x + 5 &&
                text.y >= rect.y + 5 &&
                text.x + text.width <= rect.x + rect.width - 5 &&
                text.y + text.height <= rect.y + rect.height - 5
                ? []
                : [group.querySelector('title').textContent];
            });
          } finally {
            node.remove();
          }
        }, downloaded),
        [],
        'downloaded SVG uses the same measured wrapping',
      );
      const pngEvent = page.waitForEvent('download');
      await page
        .getByRole('button', { name: '下载 PNG 思维导图', exact: true })
        .click();
      const png = await readFile(await (await pngEvent).path());
      assert.deepEqual(
        [...png.subarray(0, 8)],
        [137, 80, 78, 71, 13, 10, 26, 10],
      );
      assert.ok(png.readUInt32BE(16) > 0 && png.readUInt32BE(20) > 0);
    },
    '&map=text',
    { width: 380, height: 850 },
  ));

test('outline folds, searches safely, keeps state between views and downloads all topics', async () =>
  scenario(async (page) => {
    await generateMap(page);
    await page.getByRole('button', { name: '大纲视图', exact: true }).click();
    assert.equal(await page.locator('.outline-tree > li').count(), 6);
    assert.equal(
      await page.locator('.outline-tree .outline-leaf').count(),
      0,
      'deep details start collapsed',
    );
    await page.getByRole('button', { name: '展开全部', exact: true }).click();
    assert.equal(await page.locator('.outline-tree .outline-leaf').count(), 72);
    await page.getByRole('button', { name: '收起分支', exact: true }).click();
    assert.equal(
      await page
        .locator('.outline-tree .outline-node[aria-expanded="false"]')
        .count(),
      6,
    );
    await page.getByLabel('搜索导图内容').fill('主题2');
    assert.equal(await page.locator('.outline-tree > li').count(), 1);
    assert.equal(
      await page.locator('.outline-tree .outline-leaf').count(),
      12,
      'a matching topic keeps all context',
    );
    await page.getByRole('button', { name: '分布视图', exact: true }).click();
    await page.getByRole('button', { name: '大纲视图', exact: true }).click();
    assert.equal(await page.getByLabel('搜索导图内容').inputValue(), '主题2');
    await page.getByLabel('搜索导图内容').fill('<img src=x onerror=alert(1)>');
    await page
      .getByText('没有找到匹配的主题或要点。', { exact: true })
      .waitFor();
    assert.equal(
      await page.locator('.outline-view img, .outline-view script').count(),
      0,
    );
    await page.getByRole('button', { name: '清空搜索', exact: true }).click();
    assert.equal(await page.locator('.outline-tree > li').count(), 6);
    await page.getByLabel('查看主题', { exact: true }).selectOption('2');
    const event = page.waitForEvent('download');
    await page
      .getByRole('button', { name: '下载完整 Markdown 大纲', exact: true })
      .click();
    const text = (await readFile(await (await event).path())).toString();
    assert.equal(text.match(/^\s*- /gm)?.length, 102);
    assert.ok(
      text.includes('主题1') &&
        text.includes('主题6') &&
        text.includes('细节3'),
    );
    assert.equal(
      await page.evaluate(() => window.__biliSumFixture.stats.ai),
      1,
    );
  }, '&map=large'));

test('distribution uses actual node counts, topic navigation and theme changes preserve the camera', async () =>
  scenario(async (page) => {
    await generateMap(page);
    await page.getByRole('button', { name: '分布视图', exact: true }).click();
    assert.deepEqual(
      await page.locator('.map-metrics strong').allTextContents(),
      ['6', '103', '4'],
    );
    assert.deepEqual(
      await page.locator('.level-chart strong').allTextContents(),
      ['1', '6', '24', '72'],
    );
    assert.equal(await page.locator('.branch-chart li').count(), 6);
    assert.ok(
      (
        await page.locator('.branch-bar-heading strong').allTextContents()
      ).every((text) => text.trim() === '17 条'),
    );
    assert.equal(
      await page.getByLabel('查看主题', { exact: true }).isVisible(),
      false,
      'full-tree chart is not mislabeled as a topic filter',
    );
    await page
      .getByRole('button', { name: '查看主题：主题3：概念与应用', exact: true })
      .click();
    assert.equal(
      await page.getByLabel('查看主题', { exact: true }).inputValue(),
      '2',
    );
    assert.equal(await page.locator('.map-drawing svg g').count(), 17);
    await page
      .getByRole('button', { name: '原始大小阅读', exact: true })
      .click();
    const camera = await page.locator('.map-drawing').getAttribute('style');
    await page.getByRole('button', { name: '深色模式', exact: true }).click();
    assert.equal(
      await page.locator('.map-drawing').getAttribute('style'),
      camera,
    );
    assert.ok(
      (await page.locator('.map-drawing').innerHTML()).includes('#15130f'),
    );
    await page.getByRole('button', { name: '护眼模式', exact: true }).click();
    assert.equal(
      await page.locator('.map-drawing').getAttribute('style'),
      camera,
    );
    assert.ok(
      (await page.locator('.map-drawing').innerHTML()).includes('#eee7d9'),
    );
    await page.getByRole('button', { name: '分布视图', exact: true }).click();
    assert.deepEqual(
      await page.locator('.map-metrics strong').allTextContents(),
      ['6', '103', '4'],
    );
    assert.equal(
      await page.evaluate(() => window.__biliSumFixture.stats.ai),
      1,
    );
  }, '&map=large'));

test('short narrow windows keep reading controls reachable and video changes leave no stale analysis', async () =>
  scenario(
    async (page) => {
      await generateMap(page);
      const bounds = await page.locator('.map-viewport').boundingBox();
      assert.ok(bounds.height >= 110);
      await page
        .getByRole('button', { name: '专注阅读导图', exact: true })
        .click();
      assert.ok(
        (await page.locator('.map-viewport').boundingBox()).height >
          bounds.height + 80,
      );
      await page.getByRole('button', { name: '大纲视图', exact: true }).click();
      await page.getByLabel('搜索导图内容').fill('主题');
      await page.evaluate(() => window.__biliSumFixture.switchPage(2));
      await page.waitForFunction(
        () => !document.querySelector('.mindmap-workspace'),
      );
      assert.equal(await page.locator('.app-header').isVisible(), true);
      assert.equal(await page.locator('.app-shell.focus-mode').count(), 0);
      assert.equal(
        await page.locator('.setup-section').getAttribute('open'),
        '',
      );
      await ready(page);
      await page.waitForFunction(
        () => !document.querySelector('[aria-label="生成思维导图"]').disabled,
      );
      await generateMap(page);
      assert.equal(
        await page.getByLabel('查看主题', { exact: true }).inputValue(),
        'all',
      );
      assert.equal(await page.getByLabel('显示层级').inputValue(), '1');
      await page.getByRole('button', { name: '大纲视图', exact: true }).click();
      assert.equal(await page.getByLabel('搜索导图内容').inputValue(), '');
    },
    '&map=large',
    { width: 320, height: 600 },
  ));

test('root-only analysis has useful empty states in all three views', async () =>
  scenario(async (page) => {
    await generateMap(page);
    assert.equal(await page.locator('.map-drawing svg g').count(), 1);
    assert.match(
      await page.locator('.analysis-caption').innerText(),
      /只有中心主题/,
    );
    await page.getByRole('button', { name: '大纲视图', exact: true }).click();
    assert.match(
      await page.locator('.outline-title').innerText(),
      /只有一个中心主题/,
    );
    await page.getByLabel('搜索导图内容').fill('不存在');
    await page.getByText('没有找到匹配的主题或要点。').waitFor();
    await page.getByRole('button', { name: '分布视图', exact: true }).click();
    assert.deepEqual(
      await page.locator('.map-metrics strong').allTextContents(),
      ['0', '1', '1'],
    );
    assert.deepEqual(
      await page.locator('.level-chart strong').allTextContents(),
      ['1'],
    );
    assert.equal(await page.locator('.branch-chart li').count(), 0);
    await page
      .getByText('当前结果只有中心主题，没有可比较的主题分支。')
      .waitFor();
  }, '&map=root'));

test('dropdowns and compound inputs share styles without clipping in narrow, wide, light and dark views', async () => {
  for (const theme of ['light', 'dark']) {
    for (const width of [280, 320, 380, 720]) {
      await scenario(
        async (page) => {
          const metrics = (locator) =>
            locator.evaluateAll((elements) =>
              elements.map((element) => {
                const style = getComputedStyle(element),
                  rect = element.getBoundingClientRect();
                return {
                  radius: style.borderRadius,
                  font: style.fontSize,
                  height: rect.height,
                  border: style.borderTopStyle,
                  appearance: style.appearance,
                  arrow: style.backgroundImage,
                  left: rect.left,
                  right: rect.right,
                  color: style.color,
                  background: style.backgroundColor,
                };
              }),
            );
          const check = (controls, height) => {
            assert.ok(controls.length);
            for (const control of controls) {
              assert.equal(control.radius, '8px');
              assert.equal(control.font, '12px');
              assert.equal(control.height, height);
              assert.equal(control.border, 'solid');
              assert.ok(control.left >= 0 && control.right <= width);
            }
          };
          await generateMap(page);
          const mapControls = await metrics(
            page.locator('.analysis-filters select'),
          );
          check(mapControls, 32);
          assert.ok(
            mapControls.every(
              (control) =>
                control.appearance === 'none' &&
                control.arrow.includes('linear-gradient'),
            ),
          );
          await page
            .getByRole('button', { name: '字幕页面', exact: true })
            .click();
          const subtitleControls = await metrics(page.getByLabel('字幕语言'));
          check(subtitleControls, 32);
          assert.equal(subtitleControls[0].color, mapControls[0].color);
          assert.equal(
            subtitleControls[0].background,
            mapControls[0].background,
          );
          check(await metrics(page.locator('.search-field')), 32);
          await page
            .getByRole('button', { name: '打开 API 设置', exact: true })
            .click();
          const settingsControls = await metrics(
            page.locator(
              '.settings-pane select, .settings-pane input:not(.key-field input), .key-field',
            ),
          );
          check(settingsControls, 36);
          await page.getByLabel('API 地址', { exact: true }).focus();
          await page.keyboard.press('Tab');
          assert.equal(
            await page
              .locator('.key-field')
              .evaluate((element) => getComputedStyle(element).outlineWidth),
            '2px',
          );
          if (width === 280) {
            await fault(page, { permission: true });
            await page
              .getByRole('button', { name: '测试 API 连接', exact: true })
              .click();
            await page.waitForFunction(
              () => !!window.__biliSumFixture.resolvePermission,
            );
            assert.equal(
              await page.getByLabel('服务预设', { exact: false }).isDisabled(),
              true,
            );
            await page
              .getByRole('button', { name: '取消测试', exact: true })
              .click();
            await page.waitForFunction(
              () =>
                !document.querySelector('[aria-label="测试 API 连接"]')
                  .disabled,
            );
            await page.evaluate(() =>
              window.__biliSumFixture.resolvePermission(true),
            );
            assert.equal(
              await page.evaluate(() => window.__biliSumFixture.stats.ai),
              1,
            );
          }
        },
        '&map=large&theme=' + theme,
        { width, height: 850 },
      );
    }
  }
});

test('two actual browser panels share a request queue and cancelling a waiter sends no model call', async () =>
  scenario(async (page, context) => {
    const second = await context.newPage();
    const errors = [],
      external = [];
    second.on('pageerror', (error) => errors.push(error.message));
    second.on('request', (request) => {
      if (!request.url().startsWith(base) && !request.url().startsWith('blob:'))
        external.push(request.url());
    });
    await second.goto(base + '/?width=320');
    await second.waitForFunction(
      () =>
        !document.querySelector('[aria-label="生成 Markdown 总结"]')?.disabled,
    );
    await fault(page, { stream: 'slow' });
    await page
      .getByRole('button', { name: '生成 Markdown 总结', exact: true })
      .click();
    await page.locator('.summary-document.drafting').waitFor();
    const firstStart = await page.evaluate(
      () => window.__biliSumFixture.stats.starts[0],
    );
    await second
      .getByRole('button', { name: '生成 Markdown 总结', exact: true })
      .click();
    await second
      .getByText('正在等待 AI 请求队列，可随时停止', { exact: true })
      .waitFor();
    assert.equal(
      await second.evaluate(() => window.__biliSumFixture.stats.ai),
      0,
    );
    await second.getByRole('button', { name: '停止生成', exact: true }).click();
    await second.waitForFunction(
      () =>
        !document.querySelector('[aria-label="生成 Markdown 总结"]').disabled,
    );
    assert.equal(
      await second.evaluate(() => window.__biliSumFixture.stats.ai),
      0,
    );
    await page.getByRole('button', { name: '停止生成', exact: true }).click();
    await generate(second);
    const starts = await second.evaluate(
      () => window.__biliSumFixture.stats.starts,
    );
    assert.equal(starts.length, 1);
    assert.ok(
      starts[0] - firstStart >= 2900,
      'shared service respects the three-second start interval',
    );
    assert.equal(
      await page.evaluate(() => window.__biliSumFixture.stats.ai),
      1,
    );
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    await second.close();
  }));

test('long rate-limit cooldown blocks explicit retries without replacing the completed result', async () =>
  scenario(async (page) => {
    await generate(page);
    const full = await page.locator('.markdown-body').innerText();
    await fault(page, { stream: 'http', retryAfter: '120' });
    await page
      .getByRole('button', { name: '生成 Markdown 总结', exact: true })
      .click();
    await page.getByRole('alert').filter({ hasText: '429' }).waitFor();
    await fault(page, { stream: '' });
    await page.getByRole('button', { name: '重新生成', exact: true }).click();
    await page
      .getByRole('alert')
      .filter({ hasText: '模型服务正在限流' })
      .waitFor();
    assert.equal(
      await page.evaluate(() => window.__biliSumFixture.stats.ai),
      2,
    );
    assert.equal(await page.locator('.markdown-body').innerText(), full);
    assert.equal(
      await page
        .getByRole('button', { name: '下载 Markdown 总结', exact: true })
        .isEnabled(),
      true,
    );
    assert.equal(
      await page
        .getByRole('button', { name: '生成 Markdown 总结', exact: true })
        .isEnabled(),
      true,
    );
    assert.ok(
      !(await page.getByRole('alert').innerText()).includes('fixture-key'),
    );
  }));

test('queue storage failure prevents billable calls and an explicit retry recovers', async () =>
  scenario(async (page) => {
    await fault(page, { rateStorage: true });
    await page
      .getByRole('button', { name: '生成 Markdown 总结', exact: true })
      .click();
    await page
      .getByRole('alert')
      .filter({ hasText: '读取 AI 请求队列失败' })
      .waitFor();
    assert.equal(
      await page.evaluate(() => window.__biliSumFixture.stats.ai),
      0,
    );
    await fault(page, { rateStorage: false });
    await page.getByRole('button', { name: '重新生成', exact: true }).click();
    await page.waitForFunction(
      () =>
        !document.querySelector('[aria-label="下载 Markdown 总结"]').disabled,
    );
    assert.equal(
      await page.evaluate(() => window.__biliSumFixture.stats.ai),
      1,
    );
  }));

test('switching videos during an asynchronous source check cannot send a stale request or save stale results', async () =>
  scenario(async (page) => {
    await fault(page, { hash: true });
    await page
      .getByRole('button', { name: '生成 Markdown 总结', exact: true })
      .click();
    await page.waitForFunction(() => !!window.__biliSumFixture.resolveHash);
    await page.evaluate(() => {
      window.__biliSumFixture.heldHash = window.__biliSumFixture.resolveHash;
      window.__biliSumFixture.faults.hash = false;
      window.__biliSumFixture.switchPage(2);
    });
    await ready(page);
    await page.evaluate(() => window.__biliSumFixture.heldHash());
    assert.equal(
      await page.evaluate(() => window.__biliSumFixture.stats.ai),
      0,
    );
    assert.equal(await page.locator('.markdown-body').count(), 0);
    await generate(page);
    assert.equal(
      await page.evaluate(() => window.__biliSumFixture.stats.ai),
      1,
    );
    await page.evaluate(() => window.__biliSumFixture.switchPage(1));
    await ready(page);
    assert.equal(
      await page
        .getByRole('button', { name: '下载 Markdown 总结', exact: true })
        .isEnabled(),
      false,
    );
  }));

test('mind-map streaming distinguishes reasoning, keeps unfinished JSON hidden and enables exports only after validation', async () =>
  scenario(async (page) => {
    await fault(page, { stream: 'thinking' });
    await page
      .getByRole('button', { name: '生成思维导图', exact: true })
      .click();
    await page
      .locator('.generation-progress')
      .filter({ hasText: '模型正在思考' })
      .waitFor();
    assert.equal(await page.locator('.map-drawing').count(), 0);
    assert.equal(
      await page
        .getByRole('button', { name: '下载 SVG 思维导图', exact: true })
        .isEnabled(),
      false,
    );
    assert.deepEqual(
      await page.evaluate(() => window.__biliSumFixture.stats.streams),
      [true],
    );
    assert.ok(
      !(await page.locator('body').innerText()).includes(
        'fixture private thinking',
      ),
    );
    await fault(page, { stream: 'hold' });
    await page.evaluate(() => window.__biliSumFixture.continueAi());
    await page.waitForFunction(
      () => window.__biliSumFixture.stats.waitingCompletion,
    );
    await page
      .locator('.generation-progress')
      .filter({ hasText: '正在接收正文' })
      .waitFor();
    assert.equal(await page.locator('.map-drawing').count(), 0);
    assert.equal(
      await page
        .getByRole('button', { name: '下载 SVG 思维导图', exact: true })
        .isEnabled(),
      false,
    );
    assert.equal(await page.locator('.summary-document.drafting').count(), 0);
    await page.evaluate(() => window.__biliSumFixture.completeAi());
    await page.locator('.map-viewport').waitFor();
    await page.waitForFunction(
      () => !document.querySelector('[aria-label="生成思维导图"]').disabled,
    );
    assert.equal(
      await page
        .getByRole('button', { name: '下载 SVG 思维导图', exact: true })
        .isEnabled(),
      true,
    );
    assert.equal(
      await page.evaluate(() => window.__biliSumFixture.stats.ai),
      1,
    );
  }));

test('a cut-off streamed map preserves its prior complete tree and cache, then recovers with one explicit retry', async () =>
  scenario(async (page) => {
    await generateMap(page);
    const original = await page.locator('.map-drawing svg').innerHTML();
    await page.getByLabel('视频与生成设置', { exact: true }).click();
    await fault(page, { stream: 'truncate' });
    await page
      .getByRole('button', { name: '生成思维导图', exact: true })
      .click();
    await page.getByRole('alert').filter({ hasText: '提前中断' }).waitFor();
    assert.equal(await page.locator('.map-drawing svg').innerHTML(), original);
    assert.equal(
      await page
        .getByRole('button', { name: '下载 SVG 思维导图', exact: true })
        .isEnabled(),
      true,
    );
    assert.equal(await page.locator('.summary-document.drafting').count(), 0);
    assert.equal(
      await page.evaluate(() => window.__biliSumFixture.stats.ai),
      2,
    );
    await fault(page, { stream: '' });
    await page.getByRole('button', { name: '重新生成', exact: true }).click();
    await page.waitForFunction(
      () => !document.querySelector('[aria-label="生成思维导图"]').disabled,
    );
    assert.equal(
      await page.evaluate(() => window.__biliSumFixture.stats.ai),
      3,
    );
    assert.equal(await page.locator('.map-drawing svg').innerHTML(), original);
    assert.equal(await page.getByRole('alert').count(), 0);
    await page.reload();
    await page.locator('.map-viewport').waitFor();
    assert.equal(await page.locator('.map-drawing svg').innerHTML(), original);
    assert.equal(
      await page.evaluate(() => window.__biliSumFixture.stats.ai),
      0,
    );
  }));

test('524 communicates incomplete delivery and fee risk while retaining a downloadable complete summary without auto retry', async () =>
  scenario(async (page) => {
    await generate(page);
    const original = await page.locator('.markdown-body').innerText();
    await fault(page, { stream: 'gateway' });
    await page
      .getByRole('button', { name: '生成 Markdown 总结', exact: true })
      .click();
    await page.getByRole('alert').filter({ hasText: '524' }).waitFor();
    const message = await page.getByRole('alert').innerText();
    assert.match(message, /未收到完整结果/);
    assert.match(message, /可能已处理并计费/);
    assert.ok(!message.includes('fixture-key'));
    assert.equal(await page.locator('.markdown-body').innerText(), original);
    assert.equal(
      await page
        .getByRole('button', { name: '下载 Markdown 总结', exact: true })
        .isEnabled(),
      true,
    );
    assert.equal(
      await page.evaluate(() => window.__biliSumFixture.stats.ai),
      2,
    );
    await fault(page, { stream: '' });
    await page.getByRole('button', { name: '重新生成', exact: true }).click();
    await page.waitForFunction(
      () =>
        !document.querySelector('[aria-label="生成 Markdown 总结"]').disabled,
    );
    assert.equal(
      await page.evaluate(() => window.__biliSumFixture.stats.ai),
      3,
    );
    assert.equal(await page.getByRole('alert').count(), 0);
  }));

const openHtml = async (page) => {
  await page
    .getByRole('button', { name: 'HTML 阅读页页面', exact: true })
    .click();
};
const reportFrame = (page) => page.frameLocator('.html-preview');
const previewHtml = async (page) => {
  const url = await page.locator('.html-preview').getAttribute('src');
  return page.evaluate(async (url) => (await fetch(url)).text(), url);
};
const waitReportAttribute = async (page, name, value) => {
  await page.waitForFunction(
    async ({ name, value }) => {
      const url = document.querySelector('.html-preview')?.getAttribute('src');
      if (!url) return false;
      try {
        const html = await (await fetch(url)).text();
        return html.includes(`${name}="${value}"`);
      } catch {
        return false;
      }
    },
    { name, value },
  );
  await reportFrame(page).locator(`html[${name}="${value}"]`).waitFor();
};
const waitHtml = async (page) => {
  await reportFrame(page).locator('.am-panel').first().waitFor();
};
const generateHtml = async (page) => {
  await openHtml(page);
  await page
    .getByRole('button', {
      name: (await page.locator('.html-preview').count())
        ? '重新生成 HTML 阅读页'
        : '用 AI 生成阅读页',
      exact: true,
    })
    .click();
  await page.waitForFunction(
    () => !document.querySelector('.generation-progress'),
  );
  await waitHtml(page);
};
const downloadHtml = async (page) => {
  const event = page.waitForEvent('download');
  await page
    .getByRole('button', { name: '下载 HTML 阅读页', exact: true })
    .click();
  const download = await event;
  return { download, text: await readFile(await download.path(), 'utf8') };
};
const assertReportFits = async (page) => {
  assert.ok(
    await reportFrame(page)
      .locator('html')
      .evaluate((el) => el.scrollWidth <= innerWidth + 1),
    'report has no horizontal page overflow',
  );
};

const assertNoHtmlSource = async (document) => {
  assert.equal(await document.locator('#am-source, textarea').count(), 0);
  assert.deepEqual(
    await document.locator('body').evaluate((body) =>
      [...body.childNodes]
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent.trim())
        .filter(Boolean),
    ),
    [],
    'no renderer source left as visible text outside the reading page',
  );
};

test('HTML independently requests AI from subtitles, without generating Markdown or a map first', async () =>
  scenario(async (page) => {
    await openHtml(page);
    assert.equal(await page.locator('.html-preview').count(), 0);
    assert.equal(
      await page.getByRole('button', { name: '下载 HTML 阅读页' }).isEnabled(),
      false,
    );
    assert.equal(
      await page.evaluate(() => window.__biliSumFixture.stats.ai),
      0,
    );
    await generateHtml(page);
    assert.match(
      await reportFrame(page).locator('body').innerText(),
      /持续调整比一次性整理更重要/,
    );
    assert.deepEqual(
      await page.evaluate(() => window.__biliSumFixture.stats.kinds),
      ['html'],
    );
    assert.deepEqual(
      await page.evaluate(() => window.__biliSumFixture.stats.streams),
      [true],
    );
    const prompt = await page
      .locator('html')
      .getAttribute('data-last-ai-prompt');
    assert.match(prompt, /HTML 阅读页的内容/);
    assert.match(prompt, /今天我们聊聊如何把每天看到的信息/);
    assert.equal(
      await page.locator('.setup-section').getAttribute('open'),
      null,
    );
    await page
      .getByRole('button', { name: 'Markdown 总结页面', exact: true })
      .click();
    assert.equal(
      await page
        .getByRole('button', { name: '下载 Markdown 总结' })
        .isEnabled(),
      false,
    );
    await page
      .getByRole('button', { name: '思维导图页面', exact: true })
      .click();
    assert.equal(
      await page.getByRole('button', { name: '下载 SVG 思维导图' }).isEnabled(),
      false,
    );
    await openHtml(page);
    await waitHtml(page);
    assert.equal(
      await page.evaluate(() => window.__biliSumFixture.stats.ai),
      1,
    );
    await assertReportFits(page);
  }));

test('HTML hides renderer source in every layout, theme and appearance, including cached pages', async () =>
  scenario(async (page) => {
    await generateHtml(page);
    const chapters = await reportFrame(page)
      .locator('.am-panel')
      .allTextContents();
    for (const layout of ['sheet', 'doc']) {
      await page.getByLabel('HTML 版式', { exact: true }).selectOption(layout);
      await reportFrame(page)
        .locator('.am-' + layout)
        .waitFor();
      for (const theme of ['shadcn', 'paper', 'blueprint']) {
        await page.getByLabel('HTML 主题', { exact: true }).selectOption(theme);
        await waitReportAttribute(page, 'data-theme', theme);
        for (const appearance of ['light', 'eye', 'dark']) {
          await page
            .getByRole('button', {
              name:
                appearance === 'dark'
                  ? '深色模式'
                  : appearance === 'eye'
                    ? '护眼模式'
                    : '浅色模式',
              exact: true,
            })
            .click();
          await waitReportAttribute(page, 'data-appearance', appearance);
          const frame = reportFrame(page);
          const expected = appearances.find(
            (item) => item.value === appearance,
          );
          assert.equal(
            await frame
              .locator('body')
              .evaluate((el) => getComputedStyle(el).backgroundColor),
            rgb(expected.background),
          );
          assert.equal(
            await frame
              .locator('.am-panel')
              .first()
              .evaluate((el) => getComputedStyle(el).backgroundColor),
            rgb(expected.surface),
          );
          await frame.locator('.am-colophon').scrollIntoViewIfNeeded();
          await assertNoHtmlSource(frame);
          assert.deepEqual(
            await frame.locator('.am-panel').allTextContents(),
            chapters,
          );
          assert.match(
            await frame.locator('body').innerText(),
            /持续调整比一次性整理更重要/,
          );
          assert.equal(
            await frame
              .getByRole('link', { name: '打开原视频', exact: true })
              .count(),
            1,
          );
          assert.ok(
            !/BILISUM_HTML_(?:SUMMARY_SLOT_\d+|VIDEO_LINK_SLOT)|(?:^|\n)lang: zh(?:\r?\n)/.test(
              await previewHtml(page),
            ),
          );
        }
      }
    }
    assert.equal(
      await page.evaluate(() => window.__biliSumFixture.stats.ai),
      1,
    );
    await page.reload();
    await ready(page);
    await openHtml(page);
    await waitHtml(page);
    await assertNoHtmlSource(reportFrame(page));
    assert.deepEqual(
      await reportFrame(page).locator('.am-panel').allTextContents(),
      chapters,
    );
    assert.equal(
      await page.evaluate(() => window.__biliSumFixture.stats.ai),
      0,
    );
  }));

test('HTML download matches preview and reads offline with the complete structure and no scripts or credentials', async () =>
  scenario(
    async (page, context) => {
      await generateHtml(page);
      await page.getByLabel('HTML 版式', { exact: true }).selectOption('doc');
      const frame = reportFrame(page);
      await frame.locator('.am-doc').waitFor();
      assert.equal(await frame.locator('.am-panel').count(), 6);
      assert.equal(await frame.locator('.am-tree [data-key]').count(), 103);
      assert.equal(await frame.locator('.am-lim').count(), 6);
      assert.match(
        await frame.locator('.am-lim-val').first().innerText(),
        /17 \/ 102 条目/,
      );
      assert.equal(await frame.locator('table').count(), 1);
      const preview = await previewHtml(page);
      const { download, text } = await downloadHtml(page);
      assert.equal(text, preview);
      await assertNoHtmlSource(frame);
      assert.ok(
        !/BILISUM_HTML_(?:SUMMARY_SLOT_\d+|VIDEO_LINK_SLOT)|(?:^|\n)lang: zh(?:\r?\n)/.test(
          text,
        ),
      );
      assert.match(download.suggestedFilename(), /-阅读页\.html$/);
      assert.ok(
        !/fixture-key|fixture\.example|Authorization|<script\b|<textarea\b/.test(
          text,
        ),
      );
      assert.equal(
        await frame
          .locator(
            'script, img, iframe, object, embed, [src], [srcdoc], [onerror], [onclick], [ping]',
          )
          .count(),
        0,
      );
      assert.match(
        await frame
          .locator('meta[http-equiv="Content-Security-Policy"]')
          .getAttribute('content'),
        /script-src 'none'/,
      );
      const sandbox = await page
        .locator('.html-preview')
        .getAttribute('sandbox');
      assert.ok(
        !sandbox.includes('allow-scripts') &&
          !sandbox.includes('allow-same-origin'),
      );
      assert.equal(
        await frame.locator('a', { hasText: '打开原视频' }).getAttribute('rel'),
        'noopener noreferrer',
      );
      assert.equal(
        await page.evaluate(() => window.__biliSumFixture.stats.ai),
        1,
      );
      await assertReportFits(page);
      const offline = await context.newPage();
      const requests = [],
        errors = [];
      offline.on('request', (request) => {
        if (!request.url().startsWith('file:')) requests.push(request.url());
      });
      offline.on('pageerror', (error) => errors.push(error.message));
      const directory = await mkdtemp(join(tmpdir(), 'bilisum-offline-'));
      const file = join(directory, 'reading-page.html');
      await download.saveAs(file);
      await context.setOffline(true);
      try {
        await offline.goto(pathToFileURL(file).href);
        await offline.locator('.am-panel').first().waitFor();
        assert.equal(await offline.locator('.am-tree [data-key]').count(), 103);
        await offline.locator('.am-toc a').last().click();
        assert.ok(offline.url().endsWith('#panel-F'));
        assert.equal(await offline.locator('.am-panel').count(), 6);
        await assertNoHtmlSource(offline);
        assert.deepEqual(requests, []);
        assert.deepEqual(errors, []);
      } finally {
        await context.setOffline(false);
        await offline.close();
        await rm(directory, { recursive: true, force: true });
      }
    },
    '&map=large&summary=table',
    { width: 380, height: 900 },
  ));

test('HTML themes, long-form contents, table grids and focus reading work locally in narrow and wide panels', async () => {
  for (const width of [280, 720]) {
    await scenario(
      async (page) => {
        await generateHtml(page);
        for (const theme of ['shadcn', 'paper', 'blueprint']) {
          await page
            .getByLabel('HTML 主题', { exact: true })
            .selectOption(theme);
          await waitReportAttribute(page, 'data-theme', theme);
          assert.equal(
            await reportFrame(page).locator('html').getAttribute('data-theme'),
            theme,
          );
          for (const layout of ['sheet', 'doc']) {
            await page
              .getByLabel('HTML 版式', { exact: true })
              .selectOption(layout);
            await reportFrame(page)
              .locator('.am-' + layout)
              .waitFor();
            await assertReportFits(page);
            const table = reportFrame(page).locator('table').first();
            const style = await table
              .locator('tbody td')
              .first()
              .evaluate((el) => {
                const s = getComputedStyle(el);
                return {
                  font: parseFloat(s.fontSize),
                  border: parseFloat(s.borderBottomWidth),
                };
              });
            assert.ok(
              style.font >= 12 && style.border >= 1,
              'readable cells with visible grid',
            );
            if (layout === 'doc') {
              const anchor = reportFrame(page).locator('.am-toc a').last();
              const href = await anchor.getAttribute('href');
              assert.match(href, /^#panel-/);
              await anchor.click();
              assert.equal(await reportFrame(page).locator(href).count(), 1);
            }
          }
        }
        await page
          .getByRole('button', { name: '字幕页面', exact: true })
          .click();
        await openHtml(page);
        await waitHtml(page);
        assert.equal(
          await page.getByLabel('HTML 主题').inputValue(),
          'blueprint',
        );
        assert.equal(await page.getByLabel('HTML 版式').inputValue(), 'doc');
        await page
          .getByRole('button', { name: '深色模式', exact: true })
          .click();
        await waitReportAttribute(page, 'data-mode', 'dark');
        assert.equal(
          await reportFrame(page).locator('html').getAttribute('data-mode'),
          'dark',
        );
        const normal = await page.locator('.html-preview').boundingBox();
        await page
          .getByRole('button', { name: '专注阅读 HTML', exact: true })
          .click();
        const focused = await page.locator('.html-preview').boundingBox();
        assert.ok(focused.height > normal.height + 100);
        assert.equal(await page.locator('.app-header').isVisible(), false);
        assert.equal(await page.getByLabel('HTML 主题').isVisible(), false);
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('.app-header').isVisible(), true);
        assert.equal(
          await page
            .getByRole('button', { name: '专注阅读 HTML' })
            .evaluate((el) => document.activeElement === el),
          true,
        );
        assert.equal(
          await page.evaluate(() => window.__biliSumFixture.stats.ai),
          1,
        );
      },
      '&summary=wide-table',
      { width, height: 900 },
    );
  }
});

test('HTML failed or malformed AI regeneration preserves the full page and cache, then explicit retry recovers', async () =>
  scenario(async (page) => {
    await generateHtml(page);
    const full = await previewHtml(page);
    for (const changes of [
      { stream: 'truncate' },
      { stream: '', htmlInvalid: true },
      { stream: 'gateway', htmlInvalid: false },
    ]) {
      await fault(page, changes);
      await page
        .getByRole('button', { name: '重新生成 HTML 阅读页', exact: true })
        .click();
      await page
        .getByRole('alert')
        .filter({ hasText: '已保留上次完整阅读页' })
        .waitFor();
      assert.equal(await previewHtml(page), full);
      assert.equal(
        await page
          .getByRole('button', { name: '下载 HTML 阅读页' })
          .isEnabled(),
        true,
      );
      assert.equal(await page.locator('.html-draft-note').count(), 0);
    }
    await page.reload();
    await ready(page);
    await openHtml(page);
    await waitHtml(page);
    assert.equal(
      await page.evaluate(() => window.__biliSumFixture.stats.ai),
      0,
    );
    assert.match(
      await reportFrame(page).locator('body').innerText(),
      /持续调整比一次性整理更重要/,
    );
    await fault(page, { htmlInvalid: true });
    await page
      .getByRole('button', { name: '重新生成 HTML 阅读页', exact: true })
      .click();
    await page
      .getByRole('alert')
      .filter({ hasText: '有效的 HTML 阅读页数据' })
      .waitFor();
    await fault(page, { htmlInvalid: false });
    await page.getByRole('button', { name: '重新生成', exact: true }).click();
    await page.waitForFunction(
      () => !document.querySelector('.generation-progress'),
    );
    await waitHtml(page);
    assert.equal(await page.locator('.error-banner').count(), 0);
    assert.equal(
      await page.evaluate(() => window.__biliSumFixture.stats.ai),
      2,
    );
  }));

test('HTML treats model headings and skill-looking text as data, retains all content and blocks active markup', async () =>
  scenario(
    async (page) => {
      await generateHtml(page);
      const frame = reportFrame(page),
        body = await frame.locator('body').innerText();
      assert.match(body, /前言直接文本必须完整保留/);
      for (let index = 1; index <= 9; index++)
        assert.ok(body.includes(`第${index}节内容必须保留`));
      assert.match(body, /结尾原文：全部内容保留到这里/);
      assert.match(body, /BILISUM_HTML_SUMMARY_SLOT_1/);
      assert.ok((await frame.locator('.am-panel').count()) <= 8);
      assert.equal(
        await frame
          .locator(
            'body script, body img, body iframe, body object, body embed, body base, body style, [src], [onerror], [onclick], [ping]',
          )
          .count(),
        0,
      );
      assert.equal(await frame.locator('a[href^="javascript:"]').count(), 0);
      assert.equal(await frame.locator('a[href*="user:secret"]').count(), 0);
      assert.equal(
        await frame.locator('body').evaluate(() => window.__htmlReportXss),
        undefined,
      );
      assert.ok(
        body.includes('长标题 <text x="0"> & "引号"：不会成为 SVG 元素'),
      );
      assert.equal(await frame.locator('text[x]').count(), 0);
      await assertReportFits(page);
    },
    '&summary=html-hostile&map=text',
    { width: 320, height: 900 },
  ));

test('HTML literal model conclusions never capture chapter or original-video placeholders', async () => {
  for (const conclusion of [
    'BILISUM_HTML_SUMMARY_SLOT_0',
    'BILISUM_HTML_VIDEO_LINK_SLOT',
  ]) {
    await scenario(
      async (page) => {
        await generateHtml(page);
        const frame = reportFrame(page);
        assert.equal(
          await frame.locator('#panel-A .am-callout-body').innerText(),
          conclusion,
        );
        assert.match(
          await frame.locator('#panel-B .am-panel-body').innerText(),
          /明确问题、提取概念、建立连接、主动回顾/,
        );
        assert.equal(
          await frame.locator('a').filter({ hasText: '打开原视频' }).count(),
          1,
        );
        assert.equal(await frame.locator('#panel-A a').count(), 0);
        assert.equal(
          await page.evaluate(() => window.__biliSumFixture.stats.ai),
          1,
        );
      },
      '&htmlConclusion=' + encodeURIComponent(conclusion),
    );
  }
});

test('HTML layout and download errors recover locally without losing the AI result or charging another request', async () =>
  scenario(async (page) => {
    await generateHtml(page);
    await page.evaluate(() => {
      const original = DOMParser.prototype.parseFromString;
      DOMParser.prototype.parseFromString = function (...args) {
        DOMParser.prototype.parseFromString = original;
        throw new Error('模拟排版错误');
      };
    });
    await page.getByLabel('HTML 主题').selectOption('shadcn');
    await page.getByRole('alert').filter({ hasText: '模拟排版错误' }).waitFor();
    assert.equal(
      await page.getByRole('button', { name: '下载 HTML 阅读页' }).isEnabled(),
      false,
    );
    await page.getByRole('button', { name: '重新排版', exact: true }).click();
    await waitHtml(page);
    const preview = await previewHtml(page);
    await page.evaluate(() => {
      const original = URL.createObjectURL;
      URL.createObjectURL = function () {
        URL.createObjectURL = original;
        throw new Error('模拟下载错误');
      };
    });
    await page.getByRole('button', { name: '下载 HTML 阅读页' }).click();
    await page.getByRole('alert').filter({ hasText: '模拟下载错误' }).waitFor();
    assert.equal(await previewHtml(page), preview);
    const event = page.waitForEvent('download');
    await page.getByRole('button', { name: '重试下载', exact: true }).click();
    assert.equal(await readFile(await (await event).path(), 'utf8'), preview);
    assert.equal(await page.locator('.html-error').count(), 0);
    assert.equal(
      await page.evaluate(() => window.__biliSumFixture.stats.ai),
      1,
    );
  }));

test('HTML preview resources are released and a local preview failure recovers without another AI call', async () =>
  scenario(async (page) => {
    await generateHtml(page);
    assert.equal(
      await reportFrame(page).locator('.am-callout-title').innerText(),
      '先看结论',
    );
    const previousUrl = await page.locator('.html-preview').getAttribute('src');
    await page.getByLabel('HTML 主题', { exact: true }).selectOption('shadcn');
    await waitReportAttribute(page, 'data-theme', 'shadcn');
    assert.equal(
      await page.evaluate(async (url) => {
        try {
          await fetch(url);
          return false;
        } catch {
          return true;
        }
      }, previousUrl),
      true,
      'retired preview Blob is revoked',
    );
    await page.evaluate(() => {
      const original = URL.createObjectURL;
      URL.createObjectURL = function () {
        URL.createObjectURL = original;
        throw new Error('模拟预览资源错误');
      };
    });
    await page
      .getByLabel('HTML 主题', { exact: true })
      .selectOption('blueprint');
    await page
      .getByRole('alert')
      .filter({ hasText: '模拟预览资源错误' })
      .waitFor();
    assert.equal(await page.locator('.html-preview').count(), 0);
    assert.equal(
      await page.getByRole('button', { name: '下载 HTML 阅读页' }).isEnabled(),
      true,
      'the complete document remains downloadable',
    );
    await page.getByRole('button', { name: '重新排版', exact: true }).click();
    await waitReportAttribute(page, 'data-theme', 'blueprint');
    assert.equal(await page.locator('.html-error').count(), 0);
    const activeUrl = await page.locator('.html-preview').getAttribute('src');
    await page.getByRole('button', { name: '字幕页面', exact: true }).click();
    assert.equal(
      await page.evaluate(async (url) => {
        try {
          await fetch(url);
          return false;
        } catch {
          return true;
        }
      }, activeUrl),
      true,
      'unmount releases its preview Blob',
    );
    await openHtml(page);
    await waitHtml(page);
    assert.equal(
      await page.evaluate(() => window.__biliSumFixture.stats.ai),
      1,
    );
  }));

test('HTML cancellation stops requests, keeps complete results and never shows a stale page after video changes', async () =>
  scenario(async (page) => {
    await fault(page, { stream: 'hold' });
    await openHtml(page);
    await page.getByRole('button', { name: '用 AI 生成阅读页' }).click();
    await page.waitForFunction(
      () => window.__biliSumFixture.stats.waitingCompletion,
    );
    assert.equal(
      await page.getByRole('button', { name: '用 AI 生成阅读页' }).isEnabled(),
      false,
    );
    assert.equal(
      await page.locator('.html-preview').count(),
      0,
      'unsealed JSON is not a valid page',
    );
    await page.getByRole('button', { name: '停止生成' }).click();
    assert.equal(await page.locator('.html-preview').count(), 0);
    await fault(page, { stream: '' });
    await generateHtml(page);
    const full = await previewHtml(page);
    await fault(page, { stream: 'hold' });
    await page.getByRole('button', { name: '重新生成 HTML 阅读页' }).click();
    await page.waitForFunction(
      () => window.__biliSumFixture.stats.waitingCompletion,
    );
    await page.getByRole('button', { name: '停止生成' }).click();
    assert.equal(await previewHtml(page), full);
    await page.getByRole('button', { name: '专注阅读 HTML' }).click();
    await page.getByRole('button', { name: '重新生成 HTML 阅读页' }).click();
    await page.waitForFunction(
      () => window.__biliSumFixture.stats.waitingCompletion,
    );
    await page.evaluate(() => window.__biliSumFixture.switchPage(2));
    await ready(page);
    assert.equal(await page.locator('.app-shell.focus-mode').count(), 0);
    assert.equal(await page.locator('.html-preview').count(), 0);
    assert.equal(
      await page.getByRole('button', { name: '下载 HTML 阅读页' }).isEnabled(),
      false,
    );
    assert.ok(
      await page.evaluate(() => window.__biliSumFixture.stats.aborted >= 3),
    );
  }));
