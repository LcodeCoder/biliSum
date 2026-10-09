import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-svelte'],
  manifest: {
    name: 'biliSum',
    description:
      '在 B 站旁边整理视频：AI 思维导图、Markdown 总结与完整字幕，支持本地下载。',
    minimum_chrome_version: '120',
    permissions: ['storage', 'sidePanel', 'scripting'],
    host_permissions: ['https://*.bilibili.com/*', 'https://*.hdslb.com/*'],
    optional_host_permissions: [
      'https://*/*',
      'http://localhost/*',
      'http://127.0.0.1/*',
    ],
    icons: {
      16: 'icons/16.png',
      32: 'icons/32.png',
      48: 'icons/48.png',
      128: 'icons/128.png',
    },
    action: {
      default_title: '打开 biliSum',
      default_icon: {
        16: 'icons/16.png',
        32: 'icons/32.png',
        48: 'icons/48.png',
      },
    },
  },
});
