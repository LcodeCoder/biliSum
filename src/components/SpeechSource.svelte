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
    busy,
    disabled,
    hasTranscript,
    progress,
    onchange,
    onstart,
    onstop,
  }: {
    preferences: SpeechPreferences;
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
            ? '本地语言包已准备好，可开始识别。'
            : '语言包尚未准备好，可稍后重试或使用本地模型。';
      }
    } catch (error) {
      if (mounted) installNotice = errorMessage(error);
    } finally {
      request.dispose();
      if (installController === controller) installController = null;
      if (mounted) installing = false;
    }
  }
  function chooseAudio(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) onstart(file);
  }
</script>

<details class="speech-source" open={!hasTranscript || busy}>
  <summary
    ><Icon name="subtitles" size={15} /><span>从音频生成字幕</span><Icon
      name="chevron"
      size={14}
    /></summary
  >
  <div class="speech-controls">
    <p>
      没有字幕也可在本机识别，再生成导图和阅读页。首次使用本地模型需下载约 150
      MB；音频不会上传到识别服务。
    </p>
    <label
      >识别方式
      <select
        class="form-control compact-control"
        value={preferences.engine}
        aria-label="识别方式"
        disabled={disabled || busy || installing}
        onchange={(event) => change('engine', event.currentTarget.value)}
      >
        <option value="auto">自动 · 内置可用时优先</option>
        <option value="whisper">本地模型 · 支持时间轴</option>
        <option value="native">浏览器内置 · 无精确时间轴</option>
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
        ><option value="auto">自动检测 · 使用本地模型</option>
      </select>
    </label>
    {#if preferences.engine !== 'whisper'}
      <p class="speech-capability">
        {native === 'available'
          ? '内置本地识别可用，处理时间至少与音频时长相当。'
          : native === 'downloadable'
            ? '内置语言包可下载；自动模式也可使用本地模型。'
            : native === 'downloading'
              ? '浏览器正在下载语言包，可稍后重试。'
              : '此浏览器未提供所选语言的内置本地识别，自动模式使用本地模型。'}
      </p>
      {#if native === 'downloadable' || installing}<button
          class="text-button"
          onclick={install}
          disabled={disabled || busy || installing}
          >{installing ? '正在安装语言包…' : '安装浏览器本地语言包'}</button
        >{/if}
    {/if}
    {#if installNotice}<p role="status">{installNotice}</p>{/if}
    <div class="speech-actions">
      {#if busy}<button class="outlined" onclick={onstop}
          ><Icon name="stop" size={15} />停止识别</button
        >
      {:else}<button
          class="outlined"
          onclick={() => onstart()}
          disabled={disabled || installing}
          ><Icon name="sparkles" size={15} />{hasTranscript
            ? '重新识别音频'
            : '识别视频音频'}</button
        >
        <button
          class="text-button"
          onclick={() => fileInput.click()}
          disabled={disabled || installing}>导入音频</button
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
    {#if progress && busy}<div class="speech-progress" role="status">
        <Icon name="loader" size={14} /><span
          >{progress.message}{#if progress.percent !== undefined}
            · {progress.percent}%{/if}</span
        >
      </div>{/if}
    <p class="speech-limit">
      仅完整识别后启用生成。支持最多 4 小时、128 MB 音频；导入音频需与当前分 P
      时长一致。生成资源沿用现有 AI 配置。
    </p>
  </div>
</details>
