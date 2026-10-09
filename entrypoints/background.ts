import { browser } from 'wxt/browser';

export default defineBackground(() => {
  const configure = () => {
    void browser.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error) => console.error('biliSum side panel:', error));
    void browser.storage.local
      .setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' })
      .catch((error) => console.error('biliSum storage:', error));
  };
  configure();
  browser.runtime.onInstalled.addListener(configure);
  browser.runtime.onStartup.addListener(configure);
});
