import { browser } from 'wxt/browser';
import { audioHeaderRule } from '../src/lib/speech-audio';

export default defineBackground(() => {
  const configure = () => {
    void browser.declarativeNetRequest
      .updateSessionRules({
        removeRuleIds: [8101],
        addRules: [audioHeaderRule(browser.runtime.id)],
      })
      .catch((error) => console.error('biliSum audio headers:', error));
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
