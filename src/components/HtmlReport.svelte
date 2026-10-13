<script lang="ts">
  import Icon from './Icon.svelte';
  import WorkspaceEmpty from './WorkspaceEmpty.svelte';
  import {
    createHtmlReport,
    type HtmlReportLayout,
    type HtmlReportTheme,
  } from '../lib/html-report';
  import { downloadText } from '../lib/files';
  import { errorMessage } from '../lib/request';
  import type { Appearance, HtmlResult, VideoInfo } from '../lib/types';

  let {
    video,
    result,
    appearance,
    layout,
    theme,
    filename,
    busy,
    canGenerate,
    focusMode,
    ontogglefocus,
    onlayout,
    ontheme,
    onnotify,
    ongenerate,
  }: {
    video: VideoInfo | null;
    result: HtmlResult | null;
    appearance: Appearance;
    layout: HtmlReportLayout;
    theme: HtmlReportTheme;
    filename: string;
    busy: boolean;
    canGenerate: boolean;
    focusMode: boolean;
    ontogglefocus: (button: HTMLButtonElement) => void;
    onlayout: (value: HtmlReportLayout) => void;
    ontheme: (value: HtmlReportTheme) => void;
    onnotify: (message: string) => void;
    ongenerate: () => void;
  } = $props();
  let revision = $state(0);
  let downloadError = $state('');
  let previewUrl = $state('');
  let previewError = $state('');
  const rendered = $derived.by(() => {
    revision;
    if (!video || !result) return { html: '', error: '' };
    try {
      return {
        html: createHtmlReport({
          video,
          result,
          layout,
          theme,
          appearance,
        }),
        error: '',
      };
    } catch (cause) {
      return { html: '', error: errorMessage(cause) };
    }
  });
  // A Blob URL gives fragment links their own document base. With srcdoc,
  // #panel links resolve against the extension page and navigate out of the report.
  $effect(() => {
    const html = rendered.html;
    previewUrl = '';
    previewError = '';
    downloadError = '';
    if (!html) return;
    let url: string;
    try {
      url = URL.createObjectURL(
        new Blob([html], { type: 'text/html;charset=utf-8' }),
      );
      previewUrl = url;
    } catch (cause) {
      previewError = errorMessage(cause);
      return;
    }
    return () => URL.revokeObjectURL(url);
  });
  const problem = $derived(rendered.error || previewError || downloadError);

  function download() {
    if (!rendered.html) return;
    downloadError = '';
    try {
      downloadText(rendered.html, filename, 'text/html;charset=utf-8');
      onnotify('已开始下载 HTML 阅读页');
    } catch (cause) {
      downloadError = errorMessage(cause);
    }
  }
</script>

<section class="html-pane" aria-label="HTML 阅读页">
  <div class="pane-heading">
    <div>
      <span class="pane-eyebrow">整理与阅读</span>
      <h1>{focusMode ? '专注阅读' : 'HTML 阅读页'}</h1>
    </div>
    <div class="toolbar">
      {#if result}
        <button
          class="icon-button"
          disabled={!canGenerate}
          onclick={ongenerate}
          aria-label="重新生成 HTML 阅读页"
          title="重新请求 AI 生成阅读页"
          ><Icon name={busy ? 'loader' : 'refresh'} size={18} /></button
        >
      {/if}
      <button
        class="icon-button"
        class:active={focusMode}
        onclick={(event) => ontogglefocus(event.currentTarget)}
        disabled={!previewUrl}
        aria-pressed={focusMode}
        aria-label={focusMode ? '退出专注阅读' : '专注阅读 HTML'}
        title={focusMode ? '退出专注阅读' : '专注阅读，隐藏上方信息'}
        ><Icon name={focusMode ? 'collapse' : 'expand'} size={18} /></button
      >
      <button
        class="icon-button"
        onclick={download}
        disabled={!rendered.html}
        aria-label="下载 HTML 阅读页"
        title="下载离线 HTML 阅读页 (.html)"
        ><Icon name="download" size={18} /></button
      >
    </div>
  </div>
  {#if result}<div class="html-options">
      <label class="html-option">
        <span>版式</span>
        <select
          class="form-control"
          aria-label="HTML 版式"
          value={layout}
          onchange={(event) =>
            onlayout(event.currentTarget.value as HtmlReportLayout)}
        >
          <option value="sheet">卡片概览</option>
          <option value="doc">长文阅读</option>
        </select>
      </label>
      <label class="html-option">
        <span>样式</span>
        <select
          class="form-control"
          aria-label="HTML 主题"
          value={theme}
          onchange={(event) =>
            ontheme(event.currentTarget.value as HtmlReportTheme)}
        >
          <option value="shadcn">简洁</option>
          <option value="paper">纸张</option>
          <option value="blueprint">蓝图</option>
        </select>
      </label>
    </div>
    <p class="html-note">
      AI
      根据当前字幕独立生成阅读页；切换版式、样式和外观只在本地重排。下载后可离线阅读。
    </p>{/if}
  {#if problem}
    <div class="html-error" role="alert">
      <Icon name="alert" size={17} />
      <p>{problem}</p>
      <button
        class="text-button"
        onclick={() => {
          if (rendered.error || previewError) {
            downloadError = '';
            revision++;
          } else download();
        }}>{rendered.error || previewError ? '重新排版' : '重试下载'}</button
      >
    </div>
  {/if}
  {#if previewUrl}
    {#if busy}
      <p class="html-draft-note" role="status">
        正在重新生成，当前保留上次完整阅读页。
      </p>
    {/if}
    <iframe
      class="html-preview"
      title="HTML 阅读页预览"
      src={previewUrl}
      sandbox="allow-popups allow-popups-to-escape-sandbox"
      referrerpolicy="no-referrer"
    ></iframe>
  {:else if !result}
    <WorkspaceEmpty
      icon="code"
      title={busy
        ? '正在整理阅读页'
        : !video
          ? '从一个视频开始'
          : '把视频变成一篇阅读页'}
      description={busy
        ? '完成后可在这里阅读，也可以下载到本机离线使用。'
        : !video
          ? '打开 B 站视频，准备字幕后即可开始。'
          : '独立整理视频内容，支持章节导航和本地切换版式，下载后可离线阅读。'}
      {busy}
      action={video && !busy ? '用 AI 生成阅读页' : ''}
      disabled={!canGenerate}
      onaction={ongenerate}
    />
  {/if}
</section>
