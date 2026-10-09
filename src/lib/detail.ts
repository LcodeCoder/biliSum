export type DetailLevel = 1 | 2 | 3 | 4 | 5;

export const DETAIL_PROFILES = {
  1: {
    label: '精简',
    summaryLength: '约 150–400 字',
    mapNodes: 25,
    mapLayers: 3,
    noteLength: 500,
    focus: '只保留核心结论、主要逻辑和必要定义，省略重复说明与次要例子。',
  },
  2: {
    label: '简要',
    summaryLength: '约 400–700 字',
    mapNodes: 40,
    mapLayers: 3,
    noteLength: 750,
    focus: '覆盖主要主题、关键解释和少量代表性例子。',
  },
  3: {
    label: '标准',
    summaryLength: '约 700–1300 字',
    mapNodes: 65,
    mapLayers: 4,
    noteLength: 1100,
    focus: '保留完整主线、重要概念、因果关系及代表性案例。',
  },
  4: {
    label: '细致',
    summaryLength: '约 1300–2200 字',
    mapNodes: 85,
    mapLayers: 5,
    noteLength: 1500,
    focus: '展开主要论证、操作步骤、案例、条件与限制，保留有用细节。',
  },
  5: {
    label: '详尽',
    summaryLength: '约 2200–3500 字',
    mapNodes: 110,
    mapLayers: 6,
    noteLength: 1900,
    focus:
      '尽量保留有信息价值的细节、数据、案例、推理过程、边界条件和前后关联。',
  },
} as const;

export function normalizeDetailLevel(value: unknown): DetailLevel {
  return typeof value === 'number' && Number.isFinite(value)
    ? (Math.max(1, Math.min(5, Math.round(value))) as DetailLevel)
    : 3;
}

export function detailProfile(value: unknown) {
  const level = normalizeDetailLevel(value);
  return { level, ...DETAIL_PROFILES[level] };
}

export function detailInstruction(value: unknown): string {
  const profile = detailProfile(value);
  return (
    '总结细腻程度：' +
    profile.label +
    '（' +
    profile.level +
    '/5）。' +
    profile.focus +
    '所有档位都要覆盖视频的核心主线和最终结论。信息量以实际字幕为准；短视频可以明显短于参考字数，不凑字数、不添加字幕之外的事实，也不写泛泛的评价。'
  );
}
