/* Development-only browser/API fixture. This file never ships in the extension. */
(() => {
  const parameters = new URLSearchParams(location.search);
  const mode = parameters.get('mode') || 'ready';
  const speechMode = parameters.get('speech');
  const faults = {
    language: false,
    subtitleIdentity: parameters.get('subtitleIdentity') || '',
    networkSubtitles: parameters.get('subtitles') === 'available',
    subtitleContent: parameters.get('subtitleContent') || '',
    subtitles: false,
    storage: false,
    stream: '',
    htmlInvalid: false,
    permission: false,
    settingsDelay: 0,
    retryAfter: '1',
    rateStorage: false,
    hash: false,
    speech: '',
    nativeStatus: 'available',
  };
  const stats = {
    ai: 0,
    aborted: 0,
    starts: [],
    streams: [],
    urls: [],
    kinds: [],
    waitingCompletion: false,
    subtitleDownloads: 0,
    speechStarts: 0,
    speechTerminated: 0,
    nativeStarts: 0,
    nativeAborted: 0,
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
  if (speechMode) {
    const speechDuration = Number(parameters.get('speechDuration')) || 2;
    fixtureVideo.duration = speechDuration;
    fixtureVideo.pages[0].duration = speechDuration;
    fixtureVideo.pages[1].duration = 3;
  }
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
  const denseMap = {
    title: '基本逻辑与常用思路',
    children: [
      {
        title: '常见命题及其形式',
        children: [
          {
            title: '特称命题：存在性与反例',
            points: [
              [
                '存在一个对象满足条件，即可证明特称命题成立',
                '例如取实数一作为具体见证，即可证明存在正实数平方为一',
                '证明存在满足条件的整数时，应同时检查整数范围与全部限制',
              ],
              [
                '否定存在性命题，需要说明任意对象均不满足条件',
                '否定存在一个最小正实数，须证明每个正实数都还有更小者',
                '找到某个对象不满足条件，不能直接否定另有对象满足条件',
              ],
              [
                '反驳全称命题，只需要给出一个满足前提的反例',
                '命题所有素数均为奇数不成立，因为整数二是一个偶素数',
                '选取反例之前应先确认它属于论域，并且确实满足命题前提',
              ],
            ],
          },
          {
            title: '蕴含命题：前提与结论',
            points: [
              [
                '只有前提为真而结论为假时，原蕴含命题才为假',
                '若声称整数能被四整除就为偶数，应先选择能被四整除的数',
                '仅找到一个不能被四整除的整数，无法反驳原来的蕴含命题',
              ],
              [
                '原命题与逆否命题等价，可依据条件选择证明方向',
                '证明平方为偶数则原数为偶数，可以改证奇数的平方仍为奇数',
                '将结论的否定作为新前提时，也必须把原来的前提同时否定',
              ],
              [
                '逆命题与否命题互相等价，但一般不等价于原命题',
                '若整数能被四整除则为偶数成立，其逆命题可用整数二反驳',
                '判断两个命题是否等价时，需要检查两个方向都能成立',
              ],
            ],
          },
          {
            title: '多元命题：量词的顺序',
            points: [
              [
                '对每一个对象都存在对应见证，见证可以依赖该对象',
                '对于每个实数都存在更大的实数，可以根据原数再加一构造',
                '写出见证的具体表达式后，还应逐项验证它确实满足要求',
              ],
              [
                '存在统一见证适用于全部对象，是一个更强的要求',
                '存在一个实数比所有实数都大不成立，因为总能再构造更大者',
                '交换存在量词与全称量词的顺序，通常会改变原命题的含义',
              ],
              [
                '否定多重量词命题时，应逐层交换量词并否定条件',
                '否定每个人都有喜欢的课程，表示存在一个人没有喜欢的课程',
                '只修改最后的判断而保留全部量词，会得到不同的逻辑陈述',
              ],
            ],
          },
          {
            title: '本段小结：形式与含义对应',
            points: [
              [
                '先明确讨论对象与取值范围，再把自然语言写成命题',
                '同一句关于平方根的陈述，在实数域和复数域中可能真假不同',
                '出现任意或者存在等词语时，应显式记录量词及其作用范围',
              ],
              [
                '区分命题的真假判断与命题之间的等价变形关系',
                '两个命题可以同时为真，但这不足以证明它们在逻辑上等价',
                '验证等价变形时，应检查每一步是否保留原命题的全部条件',
              ],
              [
                '用具体例子理解形式，但最终结论仍需覆盖完整论域',
                '连续检查许多个偶数平方都是偶数，只能提供观察而不能代替证明',
                '在归纳猜想之后，应选择直接证明或者寻找反例来完成判断',
              ],
            ],
          },
        ],
      },
      {
        title: '基本逻辑与证明',
        children: [
          {
            title: '常规正向思路 P11：直接证明',
            points: [
              [
                '从已知条件出发，利用定义逐步推导所需结论',
                '证明两个偶数之和为偶数，先分别把它们表示成某个整数的两倍',
                '将两式相加并提取公共因子，再依据偶数的定义结束证明',
              ],
              [
                '遇到抽象条件时，先展开定义寻找可操作的表达式',
                '已知一个整数能被三整除，可以先设它等于三乘以某个整数',
                '使用整除定义得到新的等式之后，须说明引入的参数属于整数',
              ],
              [
                '推导链条中每一步都应有根据，避免直接跳到目标',
                '证明集合包含关系时，先任取左侧集合元素并逐条使用所属条件',
                '完成元素的归属推导后，再说明由于任取而得到整体包含关系',
              ],
            ],
          },
          {
            title: '分类讨论与反例：穷尽全部情况',
            points: [
              [
                '按条件分类时，各种情况应当合在一起覆盖全部对象',
                '讨论整数的奇偶性时，可分为偶数和奇数两类分别完成论证',
                '若按符号分类讨论实数，除了正数和负数之外还需要检查零',
              ],
              [
                '寻找反例应保留所有前提，只使需要否定的结论失败',
                '反驳任意非零实数平方大于一，可以选择绝对值小于一的实数',
                '若原命题只讨论正整数，选取负数或者分数就不是有效反例',
              ],
              [
                '通过边界值检查遗漏条件，再整理出完整的分类证明',
                '含有分母的式子需要先排除分母为零，再讨论剩余取值的性质',
                '乘以含未知数的不等式两边时，应先区分该乘数的正负与零',
              ],
            ],
          },
          {
            title: '反向思路 P12：逆否与反证',
            points: [
              [
                '直接使用前提较困难时，可尝试从结论的否定出发',
                '证明乘积为奇数则两个因子均为奇数，可改证任一因子偶则积偶',
                '逆否证明建立的是等价命题，因此完成之后即可得到原结论',
              ],
              [
                '反证法假设结论不成立，并与已知条件推出矛盾',
                '证明不存在最大的整数，可以假设已有最大整数再把它加一',
                '得到的新整数仍然属于讨论范围，却比假设的最大整数更大',
              ],
              [
                '明确矛盾出现的位置，并指出具体违背了哪一条条件',
                '假设两个互素整数都有公因子二，会直接违反它们互素的前提',
                '不能仅以结果看起来不合理结束反证，应写清逻辑冲突的两端',
              ],
            ],
          },
          {
            title: '必要与充分条件：双向证明',
            points: [
              [
                '充分条件保证结论成立，必要条件则是成立所必须满足的',
                '整数能被四整除是它为偶数的充分条件，但通常不是必要条件',
                '整数为偶数是它能被四整除的必要条件，但通常不是充分条件',
              ],
              [
                '证明当且仅当时，必须分别证明正向与反向两个蕴含',
                '证明整数平方为偶数当且仅当原数为偶数，需要独立完成两个方向',
                '一个方向可以使用直接证明，另一个方向也可以选择逆否证明',
              ],
              [
                '依据反例判断某个条件缺少必要性还是缺少充分性',
                '若条件成立而结论失败，说明这个条件尚不足以保证结论成立',
                '若结论成立而条件失败，说明这个条件不是结论成立所必需的',
              ],
            ],
          },
        ],
      },
    ].map((branch) => ({
      title: branch.title,
      children: branch.children.map((topic) => ({
        title: topic.title,
        children: topic.points.map(([title, ...examples]) => ({
          title,
          children: examples.map((example) => ({
            title: example,
            children: [],
          })),
        })),
      })),
    })),
  };
  const fixtureMap =
    parameters.get('map') === 'dense'
      ? denseMap
      : parameters.get('map') === 'reference'
        ? {
            title: '思维导图软件',
            children: [
              {
                title: '电脑客户端',
                children: [
                  '亿图脑图 MindMaster',
                  'FreeMind',
                  'MindManager',
                  'XMind',
                ].map((title) => ({ title, children: [] })),
              },
              {
                title: '手机客户端',
                children: ['MindVector', 'MindNode', 'Mindly'].map((title) => ({
                  title,
                  children: [],
                })),
              },
              {
                title: '在线版',
                children: ['百度脑图', '幕布', 'Coggle'].map((title) => ({
                  title,
                  children: [],
                })),
              },
            ],
          }
        : parameters.get('map') === 'text'
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
                    '网络层负责贴上地址并根据路由表决定跨网络的传输路线'.repeat(
                      3,
                    ),
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
  const mathSummary = String.raw`## 基本逻辑：常见命题及其形式

00:00:02 全称命题：任给 (X\in\mathbb{R})，均有 (X^2\ge 0)。量词 (\forall) 与任意相关，(\exists) 与存在相关。

蕴含命题 (A\to B) 的否定是 (A\land\neg B)。例如 (AB\ne 0\Rightarrow A\ne 0)，其否定为 $(AB\ne 0)\land(A=0)$。

现代行内语法：\(\forall x\in\mathbb{R},\;x^2\ge0\)，以及 $\varepsilon>0$。价格 $5 和 $10，普通括号 (这是补充说明) 保持原样。

## 数学推导

$$
\begin{aligned}
a_n &= a_{n-1}+1\\
\sum_{k=1}^{n}k &= \frac{n(n+1)}{2}
\end{aligned}
$$

\[\lim_{n\to\infty}\left(1+\frac1n\right)^n=e\]

$$\underbrace{x_1+x_2+x_3+x_4+x_5+x_6+x_7+x_8+x_9+x_{10}+x_{11}+x_{12}}_{\text{宽公式在本地滚动}}=\sum_{i=1}^{12}x_i$$

| 量词 | 含义 |
| --- | --- |
| $\forall$ | 所有 |
| $\exists$ | 存在 |

代码示例：\`$x^2$\`。

\`\`\`tex
\(X\in\mathbb{R}\)
\`\`\`

无效公式 $\unknown{x}$ 保留原文。

<span class="katex" style="font-size:100px" onclick="window.__mathXss=1">模型伪造样式</span>
<img src="https://math-hostile.example/image"><a href="javascript:window.__mathXss=2">危险链接</a>
$\href{https://math-hostile.example/}{不能创建链接}$`;
  const logicSummary = String.raw`## 基本逻辑：命题与否定

命题 $A$ 为真时，否定命题 $\neg A$ 为假。已有上划线 $\overline{A}$ 与中文在同一行；字母 $R$ 表示实数集。逆否命题为 $\neg B\to\neg A$。

带下标的命题 $\lnot P_i$ 也使用上划线。不等式 $AB\ne 0\Rightarrow A\ne 0$ 保留不等号。分式 $\frac{a}{b}$ 和平方 $X^2\ge 0$ 随正文基线排列。

复合命题 $\neg(A\land B)$ 保留其逻辑结构。代码示例：\`$\neg A$\`，金额 $5 和 $10。

$$\overline{B}\to\overline{A}$$

| 命题 | 否定 |
| --- | --- |
| $A$ | $\neg A$ |
| $B$ | $\lnot B$ |`;
  const fixtureSummary =
    parameters.get('summary') === 'logic'
      ? logicSummary.replaceAll('\\`', '`')
      : parameters.get('summary') === 'math'
        ? mathSummary.replaceAll('\\`', '`')
        : parameters.get('summary') === 'html-hostile'
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
      getManifest: () => ({ version: '0.1.19' }),
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
        if (options.args.length === 2) {
          window.__playerSubtitleArgs = options.args;
          return [{ result: true }];
        }
        document.documentElement.dataset.lastSeek = options.args[3];
        return [{ result: true }];
      },
    },
  };
  // Extension pages expose a writable, non-configurable chrome global.
  // Keep that descriptor while replacing its API for the fixture.
  Object.defineProperty(window, 'chrome', { value: api });
  Object.defineProperty(window, 'browser', { value: api, configurable: true });
  // Deterministic recognition workers; the decoder below still processes real WAV bytes.
  if (speechMode !== 'real') {
    const RealWorker = window.Worker;
    window.Worker = class SpeechWorker extends EventTarget {
      constructor(url, options) {
        super();
        if (!String(url).includes('speech.worker-'))
          return new RealWorker(url, options);
        this.dead = false;
      }
      terminate() {
        if (!this.dead) stats.speechTerminated++;
        this.dead = true;
      }
      postMessage(message) {
        if (message.type === 'transcribe') stats.speechStarts++;
        const fail = faults.speech;
        const part = currentPage;
        if (fail === 'hang') return;
        setTimeout(
          () => {
            if (this.dead) return;
            const result =
              message.type === 'init'
                ? true
                : {
                    text: 'P' + part + ': 从音频识别的完整知识内容。',
                    chunks: [
                      {
                        text: 'P' + part + ': 从音频识别的完整知识内容。',
                        timestamp: [
                          0,
                          message.samples.length / 16000 +
                            (fail === 'padding' ? 0.32 : 0),
                        ],
                      },
                    ],
                  };
            this.dispatchEvent(
              new MessageEvent('message', {
                data:
                  fail === 'error'
                    ? {
                        id: message.id,
                        type: 'error',
                        message: '模拟模型处理失败',
                      }
                    : { id: message.id, type: 'result', result },
              }),
            );
          },
          fail === 'slow' ? 800 : 20,
        );
      }
    };
    class Recognition {
      processLocally = true;
      static async available(options) {
        if (!options.processLocally)
          throw new Error('Cloud recognition forbidden');
        return speechMode === 'native' ? faults.nativeStatus : 'unavailable';
      }
      static async install(options) {
        if (!options.processLocally)
          throw new Error('Cloud recognition forbidden');
        return true;
      }
      start(track) {
        if (!track || track.kind !== 'audio' || !this.processLocally)
          throw new Error('Only explicit local audio permitted');
        stats.nativeStarts++;
        setTimeout(() => {
          if (['native-error', 'native-aborted'].includes(faults.speech))
            this.onerror?.({
              error:
                faults.speech === 'native-aborted'
                  ? 'aborted'
                  : 'audio-capture',
            });
          else this.onstart?.();
        }, 10);
      }
      stop() {
        const result = [{ transcript: '从浏览器本地识别的完整内容' }];
        result.isFinal = true;
        this.onresult?.({ resultIndex: 0, results: [result] });
        this.onend?.();
      }
      abort() {
        stats.nativeAborted++;
      }
    }
    Object.defineProperty(Recognition.prototype, 'processLocally', {
      value: true,
      writable: true,
    });
    window.SpeechRecognition = Recognition;
  }
  function wav(seconds) {
    const count = 16000 * seconds,
      data = new ArrayBuffer(44 + count * 2),
      view = new DataView(data);
    const text = (offset, value) =>
      [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
    text(0, 'RIFF');
    view.setUint32(4, data.byteLength - 8, true);
    text(8, 'WAVE');
    text(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, 16000, true);
    view.setUint32(28, 32000, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    text(36, 'data');
    view.setUint32(40, count * 2, true);
    for (let i = 0; i < count; i++)
      view.setInt16(
        44 + i * 2,
        Math.sin((i * Math.PI * 2 * 220) / 16000) * 5000,
        true,
      );
    return data;
  }
  window.__biliSumFixture.wav = wav;
  const originalFetch = window.fetch.bind(window);
  const reply = (data) =>
    new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
    });
  window.fetch = async (input, init) => {
    const url = String(input);
    if (url.startsWith('https://api.bilibili.com/x/web-interface/view'))
      return reply({ code: 0, data: fixtureVideo });
    if (url.includes('/x/player/') && url.includes('playurl?'))
      return reply({
        code: 0,
        data: {
          timelength: fixtureVideo.pages[currentPage - 1].duration * 1000,
          dash: {
            audio: [
              {
                codecs: 'mp4a.40.2',
                bandwidth: 32000,
                baseUrl: 'https://a.bilivideo.com/fixture.wav',
              },
            ],
          },
        },
      });
    if (url.startsWith('https://a.bilivideo.com/fixture.wav'))
      return new Response(
        wav(
          currentPage === 1
            ? Number(parameters.get('audioDuration')) ||
                fixtureVideo.pages[0].duration
            : fixtureVideo.pages[1].duration,
        ),
      );
    if (url.startsWith('https://api.bilibili.com/x/player/'))
      return reply({
        code: 0,
        data: {
          aid: fixtureVideo.aid,
          bvid:
            faults.subtitleIdentity === 'video'
              ? 'BV2xx411c7mD'
              : fixtureVideo.bvid,
          cid:
            faults.subtitleIdentity === 'part'
              ? 999
              : fixtureVideo.pages[currentPage - 1].cid,
          page_no: currentPage,
          subtitle: {
            subtitles:
              mode === 'empty' ||
              (!faults.networkSubtitles &&
                (speechMode === 'whisper' ||
                  speechMode === 'native' ||
                  speechMode === 'real'))
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
      stats.subtitleDownloads++;
      if (faults.subtitles || (faults.language && url.includes('-en')))
        throw new TypeError('Failed to fetch');
      return reply({
        body: subtitles.map((cue) => ({
          ...cue,
          ...(speechMode
            ? {
                from:
                  (cue.from / 74) *
                  fixtureVideo.pages[currentPage - 1].duration,
                to:
                  (cue.to / 74) * fixtureVideo.pages[currentPage - 1].duration,
              }
            : {}),
          content:
            (url.includes('-en') ? 'English: ' : '') +
            (currentPage === 2 ? 'P2: ' : '') +
            (faults.subtitleContent || cue.content),
        })),
      });
    }
    if (url.endsWith('/chat/completions')) {
      stats.ai++;
      stats.urls.push(url);
      stats.starts.push(Date.now());
      const payload = JSON.parse(init.body);
      stats.streams.push(payload.stream);
      stats.waitingCompletion = false;
      if (
        faults.stream === 'html' ||
        (parameters.get('api') === 'v1-only' &&
          new URL(url).pathname !== '/v1/chat/completions')
      )
        return new Response('<html>fixture-key private-page</html>', {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
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
