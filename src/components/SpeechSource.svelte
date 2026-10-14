<script lang="ts">
  import { onMount } from 'svelte';
  import Icon from './Icon.svelte';
  import {
    nativeSpeechStatus,
    installNativeSpeech,
  } from '../lib/speech-native';
  import type { NativeSpeechStatus } from '../lib/speech-native';
  import type { SpeechPreferences, SpeechProgress } from '../lib/speech-types';
  import { errorMessage, requestSignal } from '../lib/request';
  let {
    preferences,
    open = $bindable(false),
    online = true,
    busy,
    disabled,
    hasTranscript,
    progress,
    onchange,
    onstart,
    onstop,
  }: {
    online?: boolean;
    preferences: SpeechPreferences;
    open?: boolean;
    busy: boolean;
    disabled: boolean;
    hasTranscript: boolean;
    progress: SpeechProgress | null;
    onchange(value: SpeechPreferences): void;
    onstart(file?: File): void;
    onstop(): void;
  } = $props();
  let native = $state<NativeSpeechStatus>('unsupported');
  let installing = $state(false);
  let installNotice = $state('');
  let fileInput: HTMLInputElement;
  let installController: AbortController | null = null;
  let probeController: AbortController | null = null;
  let mounted = $state(false);
  let probeSerial = 0;
  onMount(() => {
    mounted = true;
    return () => {
      mounted = false;
      probeController?.abort();
      installController?.abort();
      installController = null;
    };
  });
  $effect(() => {
    const language = preferences.language;
    if (!mounted) return;
    probeController?.abort();
    probeController = new AbortController();
    const serial = ++probeSerial;
    void nativeSpeechStatus(language, probeController.signal)
      .then((value) => {
        if (mounted && serial === probeSerial) native = value;
      })
      .catch(() => {});
  });
  function change(key: keyof SpeechPreferences, value: string) {
    installNotice = '';
    onchange({ ...preferences, [key]: value } as SpeechPreferences);
  }
  async function install() {
    if (installing || busy || disabled) return;
    const language = preferences.language;
    const controller = new AbortController();
    installController = controller;
    const request = requestSignal(controller.signal, 15 * 60_000);
    installing = true;
    installNotice = '';
    try {
      const installed = await installNativeSpeech(language, request.signal);
      if (mounted && language === preferences.language) {
        native = await nativeSpeechStatus(language, request.signal);
        installNotice =
          installed && native === 'available'
            ? '语言包已就绪。'
            : '语言包未就绪，请重试。';
      }
    } catch (error) {
      if (mounted) installNotice = errorMessage(error);
    } finally {
      request.dispose();
      if (installController === controller) installController = null;
      if (mounted) installing = false;
    }
  }
  $effect(() => {
    open = !hasTranscript || busy;
  });
  function chooseAudio(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) onstart(file);
  }
</script>

<details class="speech-source" bind:open>
  <summary
    ><Icon name="subtitles" size={15} /><span>从音频生成字幕</span><Icon
      name="chevron"
      size={14}
    /></summary
  >
  <div class="speech-controls">
    <label
      >识别方式
      <select
        class="form-control compact-control"
        value={preferences.engine}
        aria-label="识别方式"
        title="本机识别；内置识别中断时自动使用本地模型，首次需下载约 150 MB"
        disabled={disabled || busy || installing}
        onchange={(event) => change('engine', event.currentTarget.value)}
      >
        <option value="auto">自动</option>
        <option value="whisper">本地模型</option>
        <option value="native">浏览器内置</option>
      </select>
    </label>
    <label
      >音频语言
      <select
        class="form-control compact-control"
        value={preferences.language}
        aria-label="音频语言"
        disabled={disabled || busy || installing}
        onchange={(event) => change('language', event.currentTarget.value)}
      >
        <option value="zh-CN">中文</option><option value="en-US">英语</option
        ><option value="ja-JP">日语</option><option value="ko-KR">韩语</option
        ><option value="auto">自动检测</option>
      </select>
    </label>
    {#if preferences.engine === 'native' && native !== 'available'}
      <p class="speech-capability">
        {native === 'downloadable'
          ? '语言包待安装'
          : native === 'downloading'
            ? '语言包下载中…'
            : '将使用本地模型'}
      </p>
    {/if}
    {#if preferences.engine !== 'whisper' && (native === 'downloadable' || installing)}
      <button
        class="text-button"
        onclick={install}
        disabled={disabled || busy || installing}
        >{installing ? '安装中…' : '安装语言包'}</button
      >
    {/if}
    {#if installNotice}<p role="status">{installNotice}</p>{/if}
    <div class="speech-actions">
      {#if busy}<button class="text-button" onclick={onstop}
          ><Icon name="stop" size={15} />停止识别</button
        >
      {:else}<button
          class="text-button primary-button"
          onclick={() => onstart()}
          disabled={disabled || installing || !online}
          ><Icon name="sparkles" size={15} />{hasTranscript
            ? '重新识别音频'
            : '识别视频音频'}</button
        >
        <button
          class="text-button"
          onclick={() => fileInput.click()}
          disabled={disabled || installing}
          title="最多 4 小时、128 MB，时长需与当前分 P 一致">导入音频</button
        >{/if}
    </div>
    <input
      class="visually-hidden"
      type="file"
      accept=".m4a,.mp3,.wav,.aac,.mp4,.webm,.ogg,.flac,audio/*"
      bind:this={fileInput}
      onchange={chooseAudio}
      aria-label="选择音频文件"
      tabindex="-1"
    />
    {#if !online && !busy}<p class="speech-capability">
        离线时请导入音频。
      </p>{/if}
    {#if progress && busy}<div class="speech-progress" role="status">
        <Icon name="loader" size={14} /><span
          >{progress.message}{#if progress.percent !== undefined}
            · {progress.percent}%{/if}</span
        >
      </div>
      {#if progress.percent !== undefined}<progress
          class="speech-progress-track"
          value={progress.percent}
          max="100"
          aria-label="当前识别阶段进度">{progress.percent}%</progress
        >{/if}
    {/if}
  </div>
</details>
