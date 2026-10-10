import type { Settings } from './types';
import { normalizeTheme } from './theme';
import { normalizeDetailLevel } from './detail';

export const DEFAULT_SETTINGS: Settings = {
  apiBaseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
  theme: 'light',
  detailLevel: 3,
};

export function completionUrl(input: string): string {
  const value = input.trim().replace(/\/+$/, '');
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('请填写完整的 API 地址。');
  }
  const local = ['localhost', '127.0.0.1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) {
    throw new Error(
      'API 地址请使用 HTTPS；本地服务支持 localhost 或 127.0.0.1 的 HTTP 地址。',
    );
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(
      'API 地址中请只填写服务地址与路径，密钥填写在 API Key 一栏。',
    );
  }
  url.pathname = url.pathname.replace(/\/+$/, '');
  if (!url.pathname.endsWith('/chat/completions'))
    url.pathname += '/chat/completions';
  return url.toString();
}

export function apiOriginPattern(input: string): string {
  const url = new URL(completionUrl(input));
  return url.protocol + '//' + url.hostname + '/*';
}

export function validateSettings(value: Settings): Settings {
  completionUrl(value.apiBaseUrl);
  if (!value.apiKey.trim()) throw new Error('请填写 API Key。');
  if (/[^\x21-\x7e]/.test(value.apiKey.trim()))
    throw new Error('API Key 中包含无效字符，请重新粘贴。');
  if (!value.model.trim()) throw new Error('请填写模型名称。');
  return {
    apiBaseUrl: value.apiBaseUrl.trim().replace(/\/+$/, ''),
    apiKey: value.apiKey.trim(),
    model: value.model.trim(),
    detailLevel: normalizeDetailLevel(value.detailLevel),
    theme: normalizeTheme(value.theme, 'system'),
  };
}
