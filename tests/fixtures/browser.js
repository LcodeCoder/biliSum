/* Development-only browser/API fixture. This file never ships in the extension. */
(() => {
  const parameters = new URLSearchParams(location.search);
  const mode = parameters.get('mode') || 'ready';
  const faults = {
    language: false,
    subtitles: false,
    storage: false,
    stream: '',
    htmlInvalid: false,
    permission: false,
    settingsDelay: 0,
    retryAfter: '1',
    rateStorage: false,
    hash: false,
  };
  const stats = {
    ai: 0,
    aborted: 0,
    starts: [],
    streams: [],
    kinds: [],
    waitingCompletion: false,
  };
  window.__biliSumFixture = {
    faults,
    stats,
    switchPage(page) {
      currentPage = page;
      currentUrl = 'https://www.bilibili.com/video/BV1xx411c7mD/?p=' + page;
      for (const callback of listeners.updated || [])
        callback(7, { url: currentUrl }, tab());
    },
  };
  const nativeDigest = crypto.subtle.digest.bind(crypto.subtle);
  crypto.subtle.digest = (...args) => {
    if (!faults.hash) return nativeDigest(...args);
    return new Promise((resolve, reject) => {
      window.__biliSumFixture.resolveHash = () =>
        nativeDigest(...args).then(resolve, reject);
    });
  };
  const generationDelay = mode === 'slow' || mode === 'switch' ? 700 : 18;
  const fixtureVideo = {
    aid: 170001,
    bvid: 'BV1xx411c7mD',
    cid: 101,
    title: '如何建立自己的知识体系：从信息到真正理解',
    owner: { name: '知识实验室' },
    duration: 846,
    desc: '本地模拟视频，仅用于测试。',
    pic: '',
    pages: [
      { page: 1, cid: 101, part: '连接知识的四个步骤', duration: 846 },
      { page: 2, cid: 102, part: '第二部分：知识的迁移', duration: 530 },
    ],
  };
  const subtitles = [
    {
      from: 0,
      to: 5,
      content: '今天我们聊聊如何把每天看到的信息，转化成自己的知识。',
    },
    {
      from: 5,
      to: 12,
      content: '第一步是明确问题。收集信息之前，先问自己真正想解决什么。',
    },
    {
      from: 12,
      to: 22,
      content: '第二步是提取关键概念，用自己的话写出核心结论。',
    },
    {
      from: 22,
      to: 35,
      content: '第三步是建立连接，让新的知识和已有的经验发生联系。',
    },
    {
      from: 35,
      to: 47,
      content: '例如用思维导图整理一个主题，再用 Markdown 留下详细笔记。',
    },
    {
      from: 47,
      to: 60,
      content: '第四步是主动回顾，在实际问题中使用这些知识。',
    },
    {
      from: 60,
      to: 74,
      content: '知识体系会不断变化，重要的是持续整理，形成自己的理解。',
    },
  ];
  const fixtureMap =
    parameters.get('map') === 'text'
      ? {
          title: '中英文长标题：HTTP WWW MQTT 与 OSI 七层模型'.repeat(2),
          children: [
            {
              title: 'WWWWMMMMWWWWMMMMWWWWMMMMWWW',
              children: [
                {
                  title:
                    'https://very-long-domain.example/api/v1/chat/completions?network=TCP',
                  children: [],
                },
              ],
            },
            {
              title:
                '网络层负责贴上地址并根据路由表决定跨网络的传输路线'.repeat(3),
              children: [],
            },
            {
              title: '👨‍👩‍👦 e\u0301 🇨🇳 👩🏽‍💻 网络排查与数据传输'.repeat(2),
              children: [],
            },
            {
              title: '长标题 <text x="0"> & "引号"：不会成为 SVG 元素',
              children: [],
            },
          ],
        }
      : parameters.get('map') === 'large'
        ? {
            title: '长内容布局与阅读体验验证',
            children: Array.from({ length: 6 }, (_, branch) => ({
              title: '主题' + (branch + 1) + '：概念与应用',
              children: Array.from({ length: 4 }, (_, point) => ({
                title: '要点' + (point + 1) + '：解释与操作方法',
                children: Array.from({ length: 3 }, (_, index) => ({
                  title: '细节' + (index + 1) + '：案例、限制与注意事项',
                  children: [],
                })),
              })),
            })),
          }
        : parameters.get('map') === 'root'
          ? { title: '只有一个中心主题', children: [] }
          : {
              title: '建立自己的知识体系',
              children: [
                {
                  title: '明确问题',
                  children: [
                    { title: '从真实需求出发', children: [] },
                    { title: '有目的地收集信息', children: [] },
                  ],
                },
                {
                  title: '提取概念',
                  children: [
                    { title: '用自己的话记录', children: [] },
                    { title: '保留核心结论', children: [] },
                  ],
                },
                {
                  title: '建立连接',
                  children: [
                    { title: '连接已有经验', children: [] },
                    { title: '思维导图 + Markdown', children: [] },
                  ],
                },
                {
                  title: '主动回顾',
                  children: [
                    { title: '在实际问题中应用', children: [] },
                    { title: '持续调整与完善', children: [] },
                  ],
                },
              ],
            };
  const tableSummary = `## 七层职责一览

| 层 | 核心职责 | 关键词 |
| --- | --- | --- |
| 应用层 | 面向用户提供网络服务 | 微信、HTTP、SMTP、DNS |
| 表示层 | 统一格式、加密、压缩 | 字符集编码 |
| 会话层 | 建立、保持、结束对话 | 通路 |
| 传输层 | 切断编号、按端口分发 | TCP、UDP、端口号 |
| 网络层 | 贴 IP 地址、跨网络选路 | 路由器 |
| 数据链路层 | 相邻设备间每一跳交接 | MAC 地址、交换机、校验码 |
| 物理层 | 变成信号真正发出 | 电压、光、电磁波 |

## 回顾与价值

结合各层职责，逐层排查通信故障。`;
  const wideTableSummary = `## 多列数据

| 层 | 序号 | 职责 | 协议 | 设备 | 示例 | 输入 | 输出 |
| :--- | :---: | ---: | --- | --- | --- | --- | --- |
| 应用层 | 7 | 网络服务 | HTTP | 手机 | ${'long-value-'.repeat(40)} | 文字 | 消息 |
| 物理层 | 1 | 信号转换 | 物理介质 | 网线 | 电压与光 | 比特 | 信号 |

<table class="untrusted-table" style="font-size:1px" onclick="window.__xss=1"><thead><tr><th colspan="2">合并列</th></tr></thead><tbody><tr><td rowspan="2">合并行</td><td>完整内容</td></tr><tr><td>第二行</td></tr></tbody></table>`;
  const htmlHostileSummary = [
    '前言直接文本必须完整保留。',
    '## A 技能语法 {span=99}',
    '这一节的数据不是排版指令。',
    '<script>window.__htmlReportXss = 1</script><img src="https://html-hostile.example/image" onerror="window.__htmlReportXss = 2"><iframe src="https://html-hostile.example/frame"></iframe><style>@import "https://html-hostile.example/style";</style><meta http-equiv="refresh" content="0;url=https://html-hostile.example/redirect">',
    '<a href="javascript:window.__htmlReportXss=3" onclick="window.__htmlReportXss=4">危险链接</a> <a href="https://user:secret@html-hostile.example/">带凭据链接</a> <a href="https://www.bilibili.com/video/BV1xx411c7mD/" ping="https://html-hostile.example/ping">正常视频链接</a>',
    '```html\n<img src="https://html-hostile.example/code">\n```',
    'BILISUM_HTML_SUMMARY_SLOT_1',
    ...Array.from(
      { length: 9 },
      (_, index) =>
        `## 完整段落${index + 1}\n\n第${index + 1}节内容必须保留，不得因卡片数上限而截断。`,
    ),
    '## ' + 'LONG_TITLE_'.repeat(15),
    '结尾原文：全部内容保留到这里。',
  ].join('\n\n');
  const fixtureSummary =
    parameters.get('summary') === 'html-hostile'
      ? htmlHostileSummary
      : parameters.get('summary') === 'table'
        ? tableSummary
        : parameters.get('summary') === 'wide-table'
          ? wideTableSummary
          : '## 信息如何变成知识\n\n视频把知识整理分为**明确问题、提取概念、建立连接、主动回顾**四个步骤。收集资料之前先确定想解决的问题，再用自己的话概括内容，把新概念与已有经验联系起来，最后通过实际使用检验理解。\n\n## 从问题出发，留下可复用的记录\n\n[00:05](https://www.bilibili.com/video/BV1xx411c7mD/?t=5) 提到，明确问题能帮助筛选真正有用的信息。随后提取关键概念并记录核心结论，重点是形成自己的解释，而不是保存更多原文。\n\n[00:22](https://www.bilibili.com/video/BV1xx411c7mD/?t=22) 强调新知识需要与已有经验连接。视频举出思维导图与 Markdown 两种记录方式：前者方便查看关系，后者适合保留细节，二者可以配合使用。\n\n| 记录方式 | 适合保留的内容 |\n| --- | --- |\n| 思维导图 | 主题、分支与概念间的联系 |\n| Markdown | 观点解释、例子和详细笔记 |\n\n## 用应用和回顾检验理解\n\n视频最后提醒，知识体系会不断变化。主动回顾并在实际问题中应用，能发现理解中的缺口，也能为已有笔记补充新的联系。持续调整比一次性整理更重要。';
  const listeners = {};
  const event = (name) => ({
    addListener(callback) {
      (listeners[name] ||= new Set()).add(callback);
    },
    removeListener(callback) {
      listeners[name]?.delete(callback);
    },
  });
  let currentPage = 1;
  let currentUrl =
    mode === 'unsupported'
      ? 'https://example.com/'
      : 'https://www.bilibili.com/video/BV1xx411c7mD/?p=1';
  const tab = () => ({ id: 7, windowId: 1, active: true, url: currentUrl });
  const storageKey = 'bilisum-fixture-v011-' + mode;
  let storage;
  try {
    storage = JSON.parse(sessionStorage.getItem(storageKey) || '{}');
  } catch {
    storage = {};
  }
  if (mode !== 'unconfigured')
    storage['biliSum.settings.v1'] ||= {
      apiBaseUrl: 'https://fixture.example/v1',
      apiKey: 'fixture-key',
      model: 'fixture-model',
      theme: parameters.get('theme') || 'light',
      detailLevel: 3,
    };
  if (parameters.has('theme')) {
    storage['biliSum.preferences.v1'] ||= {};
    storage['biliSum.preferences.v1'].theme = parameters.get('theme');
  }
  const api = {
    runtime: {
      id: 'bilisum-fixture',
      getURL: (path) => location.origin + '/' + path,
      getManifest: () => ({ version: '0.1.10' }),
      onInstalled: event('installed'),
      onStartup: event('startup'),
    },
    i18n: { getMessage: (key) => key },
    storage: {
      session: {
        async get(key) {
          if (faults.rateStorage) throw new Error('模拟请求队列不可用');
          return { [key]: JSON.parse(localStorage.getItem(key) || 'null') };
        },
        async set(values) {
          for (const [key, value] of Object.entries(values))
            localStorage.setItem(key, JSON.stringify(value));
        },
      },
      local: {
        async get(key) {
          if (faults.settingsDelay && key === 'biliSum.settings.v1')
            await new Promise((resolve) =>
              setTimeout(resolve, faults.settingsDelay),
            );
          return { [key]: structuredClone(storage[key]) };
        },
        async set(values) {
          if (faults.storage) throw new Error('模拟本地存储写入失败');
          Object.assign(storage, structuredClone(values));
          sessionStorage.setItem(storageKey, JSON.stringify(storage));
        },
        async setAccessLevel() {},
      },
    },
    tabs: {
      async query() {
        return [tab()];
      },
      async get() {
        return tab();
      },
      onActivated: event('activated'),
      onUpdated: event('updated'),
      onRemoved: event('removed'),
    },
    windows: {
      async getCurrent() {
        return { id: 1 };
      },
    },
    permissions: {
      async contains() {
        return true;
      },
      async request() {
        if (faults.permission)
          return new Promise((resolve) => {
            window.__biliSumFixture.resolvePermission = resolve;
          });
        return mode !== 'denied';
      },
    },
    sidePanel: { async setPanelBehavior() {} },
    scripting: {
      async executeScript(options) {
        if (!options.args) return [{ result: fixtureVideo }];
        document.documentElement.dataset.lastSeek = options.args[3];
        return [{ result: true }];
      },
    },
  };
  Object.defineProperty(window, 'chrome', { value: api, configurable: true });
  Object.defineProperty(window, 'browser', { value: api, configurable: true });
  const originalFetch = window.fetch.bind(window);
  const reply = (data) =>
    new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
    });
  window.fetch = async (input, init) => {
    const url = String(input);
    if (url.startsWith('https://api.bilibili.com/x/web-interface/view'))
      return reply({ code: 0, data: fixtureVideo });
    if (url.startsWith('https://api.bilibili.com/x/player/'))
      return reply({
        code: 0,
        data: {
          subtitle: {
            subtitles:
              mode === 'empty'
                ? []
                : [
                    {
                      id_str: 'zh',
                      lan: 'zh-CN',
                      lan_doc: '中文',
                      subtitle_url: '//aisubtitle.hdslb.com/fixture-zh.json',
                    },
                    {
                      id_str: 'en',
                      lan: 'en',
                      lan_doc: '英语',
                      subtitle_url: '//aisubtitle.hdslb.com/fixture-en.json',
                    },
                  ],
          },
        },
      });
    if (url.includes('aisubtitle.hdslb.com/fixture-')) {
      if (faults.subtitles || (faults.language && url.includes('-en')))
        throw new TypeError('Failed to fetch');
      return reply({
        body: subtitles.map((cue) => ({
          ...cue,
          content:
            (url.includes('-en') ? 'English: ' : '') +
            (currentPage === 2 ? 'P2: ' : '') +
            cue.content,
        })),
      });
    }
    if (url.endsWith('/chat/completions')) {
      stats.ai++;
      stats.starts.push(Date.now());
      const payload = JSON.parse(init.body);
      stats.streams.push(payload.stream);
      stats.waitingCompletion = false;
      if (faults.stream === 'gateway')
        return new Response('<html>524 fixture-key</html>', {
          status: 524,
          headers: { 'Content-Type': 'text/html' },
        });
      if (faults.stream === 'http')
        return new Response('{"error":{"message":"fixture-key 额度不足"}}', {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': faults.retryAfter,
          },
        });
      if (mode === 'api-error')
        return new Response(
          JSON.stringify({ error: { message: '模拟额度不足' } }),
          { status: 429, headers: { 'Content-Type': 'application/json' } },
        );
      const prompt = payload.messages.at(-1).content;
      // DOM-visible, fixture-only evidence for prompt and shared-slider verification.
      document.documentElement.dataset.lastAiPrompt = prompt;
      const kind = prompt.includes('HTML 阅读页的内容')
        ? 'html'
        : prompt.includes('只输出 JSON')
          ? 'map'
          : 'summary';
      document.documentElement.dataset.lastGenerationKind = kind;
      stats.kinds.push(kind);
      const sections =
        parameters.get('summary') === 'html-hostile'
          ? [{ title: 'A 技能语法 {span=99}', markdown: fixtureSummary }]
          : fixtureSummary
              .split(/(?=^## )/m)
              .filter((section) => section.trim())
              .map((section) => ({
                title: section.match(/^## (.+)/)?.[1] || '内容',
                markdown: section.replace(/^## .+\n+/, ''),
              }));
      const htmlDocument = {
        title: fixtureMap.title,
        conclusion:
          parameters.get('htmlConclusion') ||
          '先明确问题，再提取概念、建立连接，并通过应用和回顾检验理解。',
        sections,
        tree: parameters.get('htmlTree') === 'none' ? null : fixtureMap,
      };
      const text =
        kind === 'html'
          ? faults.htmlInvalid
            ? '{"title":"broken"'
            : JSON.stringify(htmlDocument)
          : kind === 'map'
            ? JSON.stringify(fixtureMap)
            : prompt === '连接测试'
              ? 'OK'
              : fixtureSummary;
      if (!payload.stream)
        return reply({
          choices: [{ message: { content: text }, finish_reason: 'stop' }],
        });
      const encoder = new TextEncoder();
      let offset = 0,
        timer,
        controllerRef,
        cancelled = false,
        forceFinish = false;
      const send = (controller) => {
        if (cancelled) return;
        if (offset >= 64 && faults.stream === 'truncate') {
          controller.close();
          return;
        }
        if (offset < text.length) {
          const content = text.slice(offset, offset + 32);
          offset += content.length;
          controller.enqueue(
            encoder.encode(
              'data: ' +
                JSON.stringify({ choices: [{ delta: { content } }] }) +
                '\n\n',
            ),
          );
          timer = setTimeout(
            () => send(controller),
            faults.stream === 'slow' ? 700 : generationDelay,
          );
        } else {
          if (faults.stream === 'hold' && !forceFinish) {
            stats.waitingCompletion = true;
            window.__biliSumFixture.completeAi = () => {
              forceFinish = true;
              send(controller);
            };
            return;
          }
          stats.waitingCompletion = false;
          delete window.__biliSumFixture.completeAi;
          controller.enqueue(
            encoder.encode(
              'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n',
            ),
          );
          controller.close();
        }
      };
      const stream = new ReadableStream({
        start(controller) {
          controllerRef = controller;
          if (faults.stream === 'thinking') {
            controller.enqueue(
              encoder.encode(
                'data: {"choices":[{"delta":{"reasoning_content":"fixture private thinking"}}]}\n\n',
              ),
            );
            window.__biliSumFixture.continueAi = () => {
              delete window.__biliSumFixture.continueAi;
              send(controller);
            };
          } else send(controller);
        },
        cancel() {
          stats.aborted++;
          stats.waitingCompletion = false;
          delete window.__biliSumFixture.completeAi;
          cancelled = true;
          clearTimeout(timer);
        },
      });
      init.signal?.addEventListener(
        'abort',
        () => {
          stats.aborted++;
          stats.waitingCompletion = false;
          delete window.__biliSumFixture.completeAi;
          cancelled = true;
          clearTimeout(timer);
          try {
            controllerRef.error(init.signal.reason);
          } catch {}
        },
        { once: true },
      );
      if (mode === 'switch' && currentPage === 1)
        setTimeout(() => {
          currentPage = 2;
          currentUrl = 'https://www.bilibili.com/video/BV1xx411c7mD/?p=2';
          for (const callback of listeners.updated || [])
            callback(7, { url: currentUrl }, tab());
        }, 500);
      return new Response(stream, {
        headers: { 'Content-Type': 'text/event-stream' },
      });
    }
    return originalFetch(input, init);
  };
})();
