// Production bundle + local mock APIs. No live Bilibili account or paid model calls.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
let server, browser, base;
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
) {
  const context = await browser.newContext({
    viewport,
    acceptDownloads: true,
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
      (await page.locator('.map-drawing').innerHTML()).includes('#162230'),
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
