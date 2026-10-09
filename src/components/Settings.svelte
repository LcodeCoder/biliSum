<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import Icon from './Icon.svelte';
  import { aiRuntime, permitApi, saveSettings } from '../lib/extension';
  import { testConnection } from '../lib/ai';
  import { errorMessage } from '../lib/request';
  import type { Settings } from '../lib/types';

  let {
    settings,
    onsave,
    onclose,
    onsaving,
  }: {
    settings: Settings;
    onsave: (settings: Settings) => void;
    onclose: () => void;
    onsaving: (value: boolean) => void;
  } = $props();
  let form = $state<Settings>(untrack(() => ({ ...settings })));
  let visible = $state(false);
  let busy = $state<'save' | 'test' | null>(null);
  let error = $state('');
  let status = $state('');
  let controller: AbortController | null = null;
  let disposed = false;

  function preset(event: Event) {
    const value = (event.currentTarget as HTMLSelectElement).value;
    const providers: Record<string, [string, string]> = {
      openai: ['https://api.openai.com/v1', 'gpt-4o-mini'],
      deepseek: ['https://api.deepseek.com', 'deepseek-chat'],
      local: ['http://localhost:11434/v1', ''],
    };
    const provider = providers[value];
    if (provider) {
      form.apiBaseUrl = provider[0];
      form.model = provider[1];
      form.apiKey = '';
    }
    status = '';
    error = '';
  }
  async function save() {
    if (busy) return;
    busy = 'save';
    onsaving(true);
    error = '';
    status = '';
    controller = new AbortController();
    try {
      const saved = await saveSettings({ ...form }, controller.signal);
      if (!disposed) onsave(saved);
    } catch (cause) {
      if (!disposed && !controller?.signal.aborted) error = errorMessage(cause);
    } finally {
      onsaving(false);
      if (!disposed) busy = null;
    }
  }
  async function test() {
    if (busy) return;
    busy = 'test';
    error = '';
    status = '';
    const active = new AbortController();
    controller = active;
    try {
      const next = await permitApi({ ...form }, active.signal);
      active.signal.throwIfAborted();
      await testConnection(next, {
        runtime: aiRuntime,
        signal: active.signal,
        onProgress: (message) => {
          if (!disposed) status = message;
        },
      });
      if (!disposed) status = '连接成功。请保存配置。';
    } catch (cause) {
      if (!disposed && !active.signal.aborted) {
        status = '';
        error = errorMessage(cause);
      }
    } finally {
      if (!disposed) busy = null;
    }
  }
  onDestroy(() => {
    disposed = true;
    controller?.abort();
  });
</script>

<section class="settings-pane" aria-label="API 设置">
  <div class="settings-title">
    <button
      class="icon-button"
      onclick={onclose}
      disabled={busy === 'save'}
      aria-label="返回工作空间"
      title="返回工作空间"><Icon name="back" size={19} /></button
    >
    <div>
      <h1>API 设置</h1>
    </div>
  </div>
  <form
    oninput={() => {
      error = '';
      status = '';
    }}
    onsubmit={(event) => {
      event.preventDefault();
      void save();
    }}
  >
    <fieldset disabled={!!busy}>
      <label for="provider">服务预设<span>可选</span></label>
      <select class="form-control" id="provider" onchange={preset}
        ><option value="custom">使用自定义配置</option><option value="openai"
          >OpenAI</option
        ><option value="deepseek">DeepSeek</option><option value="local"
          >本地 OpenAI 兼容服务</option
        ></select
      >
      <label for="api-url">API 地址</label>
      <input
        class="form-control"
        id="api-url"
        type="url"
        bind:value={form.apiBaseUrl}
        placeholder="https://your-api.com/v1"
        required
        spellcheck="false"
        autocomplete="off"
      />
      <p class="field-hint">支持基础地址，或完整的 /chat/completions 地址。</p>
      <label for="api-key">API Key</label>
      <div class="key-field control-field">
        <Icon name="key" size={17} /><input
          class="form-control"
          id="api-key"
          type={visible ? 'text' : 'password'}
          bind:value={form.apiKey}
          placeholder="填写你的 API Key"
          required
          spellcheck="false"
          autocomplete="off"
        /><button
          type="button"
          class="icon-button small"
          onclick={() => (visible = !visible)}
          aria-label={visible ? '隐藏 API Key' : '显示 API Key'}
          title={visible ? '隐藏 API Key' : '显示 API Key'}
          ><Icon name={visible ? 'eye-off' : 'eye'} size={18} /></button
        >
      </div>
      <p class="field-hint">本地服务若不校验密钥，可填写 local。</p>
      <label for="model">模型名称</label>
      <input
        class="form-control"
        id="model"
        type="text"
        bind:value={form.model}
        placeholder="例如 deepseek-chat"
        required
        spellcheck="false"
        autocomplete="off"
      />
      <p class="field-hint">填写服务商提供的准确模型 ID。</p>
    </fieldset>
    <div class="privacy-note">
      <Icon name="info" size={17} />
      <p>
        密钥保存在本机浏览器。生成时，当前视频信息与字幕会发送到你填写的 API
        服务。
      </p>
    </div>
    {#if busy === 'test'}<button
        type="button"
        class="text-button"
        onclick={() => {
          controller?.abort();
          status = '测试已取消，可修改配置后重试。';
        }}>取消测试</button
      >{/if}
    {#if error}<p class="form-message error" role="alert">{error}</p>{/if}
    {#if status}<p class="form-message success" role="status">{status}</p>{/if}
    <div class="settings-actions">
      <span
        >{busy === 'test'
          ? '正在测试连接…'
          : busy === 'save'
            ? '正在保存…'
            : '保存配置'}</span
      ><button
        type="button"
        class="icon-button outlined"
        onclick={test}
        disabled={!!busy}
        aria-label="测试 API 连接"
        title="测试 API 连接（发送一次简短请求）"
        ><Icon name={busy === 'test' ? 'loader' : 'plug'} size={20} /></button
      ><button
        type="submit"
        class="icon-button primary"
        disabled={!!busy}
        aria-label="保存 API 设置"
        title="保存 API 设置"
        ><Icon name={busy === 'save' ? 'loader' : 'save'} size={20} /></button
      >
    </div>
  </form>
</section>
