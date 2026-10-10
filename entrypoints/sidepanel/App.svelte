<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { browser } from 'wxt/browser';
  import Icon from '../../src/components/Icon.svelte';
  import MindMapWorkspace from '../../src/components/MindMapWorkspace.svelte';
  import Subtitles from '../../src/components/Subtitles.svelte';
  import HtmlReport from '../../src/components/HtmlReport.svelte';
  import type {
    HtmlReportLayout,
    HtmlReportTheme,
  } from '../../src/lib/html-report';
  import SettingsPane from '../../src/components/Settings.svelte';
  import { DEFAULT_SETTINGS } from '../../src/lib/config';
  import { detailProfile, normalizeDetailLevel } from '../../src/lib/detail';
  import {
    getSubtitleCues,
    getSubtitleTracks,
    parseVideoUrl,
    resolveVideo,
    selectSubtitle,
  } from '../../src/lib/bilibili';
  import {
    generateHtmlDocument,
    generateMindMap,
    generateSummary,
  } from '../../src/lib/ai';
  import {
    aiRuntime,
    loadSettings,
    savePreferences,
    hasApiPermission,
    loadResults,
    saveResults,
    readPageVideo,
    seekVideo,
  } from '../../src/lib/extension';
  import {
    formatTime,
    chunkTranscript,
    importTranscript,
    exportSrt,
    transcriptHash,
    transcriptText,
  } from '../../src/lib/transcript';
  import {
    downloadText,
    downloadMapPng,
    safeFilename,
  } from '../../src/lib/files';
  import { mindMapMarkdown, renderMindMapSvg } from '../../src/lib/mindmap';
  import { renderMarkdown, summaryDocument } from '../../src/lib/markdown';
  import { errorMessage } from '../../src/lib/request';
  import type {
    Appearance,
    GenerationKind,
    HtmlResult,
    MapResult,
    Settings,
    SubtitleTrack,
    SummaryResult,
    Transcript,
    VideoInfo,
  } from '../../src/lib/types';

  let page = $state<'map' | 'summary' | 'html' | 'subtitles'>('map');
  let htmlLayout = $state<HtmlReportLayout>('sheet');
  let htmlTheme = $state<HtmlReportTheme>('paper');
  let settings = $state<Settings>({ ...DEFAULT_SETTINGS });
  let showSettings = $state(false);
  let setupOpen = $state(true);
  let focusMode = $state(false);
  let focusButton = $state<HTMLButtonElement>();
  let settingsReady = $state(false);
  let settingsSaving = $state(false);
  let systemTheme = $state<'light' | 'dark'>('light');
  const appearance = $derived(
    settings.theme === 'system' ? systemTheme : settings.theme,
  );
  const detail = $derived(detailProfile(settings.detailLevel));
  const version = browser.runtime.getManifest().version;
  let preferencesTouched = false;
  let preferenceSave = Promise.resolve();
  let settingsButton: HTMLButtonElement;
  let video = $state<VideoInfo | null>(null);
  let tracks = $state<SubtitleTrack[]>([]);
  let selectedTrack = $state('');
  let transcript = $state<Transcript | null>(null);
  let loading = $state(true);
  let sourceNotice = $state('');
  let error = $state('');
  let toast = $state('');
  let busy = $state<GenerationKind | null>(null);
  let progress = $state('');
  let streamDraft = $state('');
  let summary = $state<SummaryResult | null>(null);
  let draft = $state<SummaryResult | null>(null);
  let activeSummaryMeta: Omit<SummaryResult, 'markdown'> | null = null;
  let latestDraft = '';
  let retryKind = $state<GenerationKind | null>(null);
  const shownSummary = $derived(draft ?? summary);
  let map = $state<MapResult | null>(null);
  let htmlResult = $state<HtmlResult | null>(null);
  let rawMarkdown = $state(false);
  const sourceChunks = $derived(
    transcript ? chunkTranscript(transcript).length : 0,
  );
  let importSerial = 0;
  let tabId: number | undefined;
  let requestKey = '';
  let sourceSerial = 0,
    generationSerial = 0,
    tabQuerySerial = 0;
  let sourceController: AbortController | null = null;
  let generationController: AbortController | null = null;
  let toastTimer: ReturnType<typeof setTimeout>;
  let disposed = false;
  const canGenerate = $derived(
    settingsReady && !!video && !!transcript?.cues.length && !loading && !busy,
  );
  const displayMarkdown = $derived(
    busy === 'summary' && streamDraft
      ? streamDraft
      : shownSummary?.markdown || '',
  );
  const renderedMarkdown = $derived(
    displayMarkdown ? renderMarkdown(displayMarkdown) : '',
  );

  $effect(() => {
    document.documentElement.dataset.theme = appearance;
  });

  $effect(() => {
    if (
      showSettings ||
      !((page === 'map' && map) || (page === 'html' && htmlResult))
    )
      focusMode = false;
  });

  function exitFocus(event: KeyboardEvent) {
    if (event.key === 'Escape' && focusMode) {
      event.preventDefault();
      focusMode = false;
      focusButton?.focus({ preventScroll: true });
    }
  }

  function persistPreferences() {
    preferencesTouched = true;
    const preferences = {
      theme: settings.theme,
      detailLevel: settings.detailLevel,
    };
    preferenceSave = preferenceSave
      .catch(() => {})
      .then(() => savePreferences(preferences))
      .catch(() => {
        if (!disposed) error = '保存外观或细腻程度失败，请重试。';
      });
  }
  function changeTheme(theme: Appearance) {
    settings.theme = theme;
    persistPreferences();
  }
  function changeDetail(value: string) {
    preferencesTouched = true;
    settings.detailLevel = normalizeDetailLevel(Number(value));
  }

  function notify(message: string) {
    clearTimeout(toastTimer);
    toast = message;
    toastTimer = setTimeout(() => (toast = ''), 3200);
  }
  function preserveDraft() {
    if (busy === 'summary' && latestDraft.trim() && activeSummaryMeta)
      draft = { ...activeSummaryMeta, markdown: latestDraft, incomplete: true };
  }
  function stopGeneration(announce = true) {
    if (announce) preserveDraft();
    const stoppedKind = busy;
    const wasBusy = !!busy;
    generationSerial++;
    generationController?.abort();
    generationController = null;
    busy = null;
    progress = '';
    streamDraft = '';
    latestDraft = '';
    if (announce && wasBusy)
      notify(
        stoppedKind === 'summary' && draft
          ? '生成已停止，未完成草稿可复制或下载'
          : '生成已停止',
      );
  }
  function startSource(preserve = false) {
    stopGeneration(preserve);
    sourceController?.abort();
    sourceController = new AbortController();
    sourceSerial++;
    loading = true;
    error = '';
    sourceNotice = '';
    retryKind = null;
    if (!preserve) {
      transcript = null;
      summary = null;
      map = null;
      htmlResult = null;
      draft = null;
      setupOpen = true;
    }
    streamDraft = '';
    return { serial: sourceSerial, signal: sourceController.signal };
  }
  const isCurrent = (serial: number) => serial === sourceSerial && !disposed;

  async function acceptTranscript(
    next: Transcript,
    serial: number,
  ): Promise<boolean> {
    const previous = transcript;
    const [oldHash, newHash] = await Promise.all([
      previous ? transcriptHash(previous) : null,
      transcriptHash(next),
    ]);
    if (!isCurrent(serial)) return false;
    if (oldHash !== newHash) {
      summary = null;
      map = null;
      htmlResult = null;
      draft = null;
      setupOpen = true;
    }
    transcript = next;
    return true;
  }

  async function restoreResults(
    currentVideo: VideoInfo,
    currentTranscript: Transcript,
    serial: number,
  ) {
    try {
      const [saved, hash] = await Promise.all([
        loadResults(currentVideo),
        transcriptHash(currentTranscript),
      ]);
      if (isCurrent(serial) && saved?.sourceHash === hash) {
        summary ??= saved.summary;
        map ??= saved.map;
        htmlResult ??= saved.html ?? null;
        if ((map && page === 'map') || (htmlResult && page === 'html'))
          setupOpen = false;
      }
    } catch {
      /* A cache read does not block subtitle use. */
    }
  }

  async function syncCurrent(force = false) {
    const querySerial = ++tabQuerySerial;
    let capturedSource: number | undefined;
    try {
      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (querySerial !== tabQuerySerial || disposed) return;
      const locator = parseVideoUrl(tab?.url || '');
      const nextKey =
        locator && tab?.id !== undefined
          ? tab.id + ':' + locator.key
          : 'unsupported';
      if (!force && nextKey === requestKey) return;
      const preserve = nextKey === requestKey && !!video;
      requestKey = nextKey;
      tabId = tab?.id;
      const source = startSource(preserve);
      capturedSource = source.serial;
      if (!preserve) {
        video = null;
        tracks = [];
        selectedTrack = '';
      }
      if (!locator || tabId === undefined) {
        loading = false;
        sourceNotice = '打开一个 B 站视频，biliSum 会自动读取它的内容。';
        return;
      }
      const pageData = await readPageVideo(tabId, source.signal);
      if (!isCurrent(source.serial)) return;
      const currentVideo = await resolveVideo(locator, pageData, {
        signal: source.signal,
      });
      if (!isCurrent(source.serial)) return;
      if (video && video.cid !== currentVideo.cid) {
        setupOpen = true;
        transcript = null;
        summary = null;
        map = null;
        draft = null;
        tracks = [];
        selectedTrack = '';
      }
      video = currentVideo;
      try {
        const list = await getSubtitleTracks(currentVideo, {
          signal: source.signal,
        });
        if (!isCurrent(source.serial)) return;
        const track = selectSubtitle(
          list,
          tracks.find((item) => item.id === selectedTrack)?.language,
        );
        if (!transcript) tracks = list;
        if (!track) {
          sourceNotice = transcript
            ? '未获取到新字幕，已保留原字幕和结果。可稍后刷新。'
            : '当前视频没有返回可用字幕。可先登录 B 站再刷新，或导入已有字幕。';
          return;
        }
        const cues = await getSubtitleCues(track, { signal: source.signal });
        if (!isCurrent(source.serial)) return;
        const nextTranscript: Transcript = {
          cues,
          timed: true,
          source: track.label,
        };
        tracks = list;
        selectedTrack = track.id;
        if (!(await acceptTranscript(nextTranscript, source.serial))) return;
        await restoreResults(currentVideo, nextTranscript, source.serial);
      } catch (cause) {
        if (isCurrent(source.serial) && !source.signal.aborted)
          sourceNotice =
            errorMessage(cause) +
            (transcript
              ? ' 已保留原字幕和结果。'
              : ' 可刷新重试，或导入已有字幕。');
      } finally {
        if (isCurrent(source.serial)) loading = false;
      }
    } catch (cause) {
      if (
        !disposed &&
        (capturedSource === undefined
          ? querySerial === tabQuerySerial
          : isCurrent(capturedSource)) &&
        !sourceController?.signal.aborted
      ) {
        error = errorMessage(cause);
        sourceNotice = error;
        loading = false;
      }
    }
  }

  async function changeLanguage(id: string) {
    const track = tracks.find((item) => item.id === id);
    if (!track || !video || loading || (selectedTrack === id && transcript))
      return;
    const currentVideo = video;
    const previousTrack = selectedTrack;
    const source = startSource(true);
    selectedTrack = id;
    try {
      const cues = await getSubtitleCues(track, { signal: source.signal });
      if (!isCurrent(source.serial)) return;
      const next: Transcript = { cues, timed: true, source: track.label };
      if (!(await acceptTranscript(next, source.serial))) return;
      await restoreResults(currentVideo, next, source.serial);
    } catch (cause) {
      if (isCurrent(source.serial) && !source.signal.aborted) {
        selectedTrack = previousTrack;
        sourceNotice =
          errorMessage(cause) +
          (transcript
            ? ' 已保留原字幕和结果，可重新选择语言重试。'
            : ' 可重新选择语言重试。');
      }
    } finally {
      if (isCurrent(source.serial)) loading = false;
    }
  }

  async function importFile(file: File) {
    if (!video || loading) {
      error = '请先打开 B 站视频并等待读取完成，再导入字幕。';
      return;
    }
    if (file.size > 2_000_000) {
      error = '请选择 2 MB 以内的字幕文件。';
      return;
    }
    const captured = sourceSerial;
    const attempt = ++importSerial;
    try {
      const next = importTranscript(await file.text(), file.name);
      if (!isCurrent(captured) || attempt !== importSerial || !video) return;
      const currentVideo = video;
      const source = startSource();
      transcript = next;
      selectedTrack = 'imported';
      await restoreResults(currentVideo, next, source.serial);
      if (isCurrent(source.serial)) loading = false;
      if (isCurrent(source.serial))
        notify('已导入 ' + next.cues.length + ' 条字幕');
    } catch (cause) {
      if (isCurrent(captured) && attempt === importSerial)
        error = errorMessage(cause);
    }
  }

  async function generate(kind: GenerationKind) {
    if (!canGenerate || !video || !transcript) return;
    if (!settings.apiKey.trim() || !settings.model.trim()) {
      showSettings = true;
      notify('先保存 API 配置，再开始生成');
      return;
    }
    const serial = ++generationSerial;
    const source = sourceSerial;
    const controller = new AbortController();
    generationController = controller;
    const currentVideo = $state.snapshot(video);
    const currentTranscript = $state.snapshot(transcript);
    const currentSettings = $state.snapshot(settings);
    page = kind;
    busy = kind;
    progress = '正在准备视频资料';
    error = '';
    streamDraft = '';
    latestDraft = '';
    retryKind = null;
    const current = () =>
      serial === generationSerial &&
      isCurrent(source) &&
      !controller.signal.aborted;
    let lastPaint = 0;
    try {
      const sourceHash = await transcriptHash(currentTranscript);
      if (!current()) return;
      if (!(await hasApiPermission(currentSettings))) {
        if (current()) showSettings = true;
        throw new Error('API 服务访问权限已变化，请在设置中重新保存。');
      }
      controller.signal.throwIfAborted();
      const options = {
        runtime: aiRuntime,
        signal: controller.signal,
        onProgress: (message: string) => {
          if (current()) progress = message;
        },
        onToken: (text: string) => {
          if (current()) latestDraft = text;
          if (current() && Date.now() - lastPaint > 80) {
            streamDraft = text;
            lastPaint = Date.now();
          }
        },
      };
      const meta = {
        model: currentSettings.model,
        createdAt: new Date().toISOString(),
        source: currentTranscript.source,
        detailLevel: currentSettings.detailLevel,
      };
      activeSummaryMeta = kind === 'summary' ? meta : null;
      if (kind === 'map') {
        const tree = await generateMindMap(
          currentVideo,
          currentTranscript,
          currentSettings,
          options,
        );
        if (!current()) return;
        map = { ...meta, tree };
        setupOpen = false;
      } else if (kind === 'html') {
        const document = await generateHtmlDocument(
          currentVideo,
          currentTranscript,
          currentSettings,
          options,
        );
        if (!current()) return;
        htmlResult = { ...meta, document };
        setupOpen = false;
      } else {
        const markdown = await generateSummary(
          currentVideo,
          currentTranscript,
          currentSettings,
          options,
        );
        if (!current()) return;
        summary = { ...meta, markdown };
        draft = null;
      }
      try {
        await saveResults(
          currentVideo,
          {
            sourceHash,
            summary: $state.snapshot(summary),
            map: $state.snapshot(map),
            html: $state.snapshot(htmlResult),
          },
          kind,
        );
      } catch {
        if (current()) notify('内容已生成；本地缓存未保存，请及时下载');
        return;
      }
      if (current())
        notify(
          kind === 'map'
            ? '思维导图已生成'
            : kind === 'html'
              ? 'HTML 阅读页已生成'
              : 'Markdown 总结已生成',
        );
    } catch (cause) {
      if (current()) {
        preserveDraft();
        retryKind = kind;
        error =
          errorMessage(cause) +
          (kind === 'summary' && draft
            ? ' 已保留未完成草稿，可复制或下载。'
            : kind === 'html' && htmlResult
              ? ' 已保留上次完整阅读页。'
              : '');
      }
    } finally {
      if (serial === generationSerial && !disposed) {
        busy = null;
        progress = '';
        streamDraft = '';
        generationController = null;
      }
    }
  }

  async function perform(
    operation: () => void | Promise<void>,
    message: string,
  ) {
    try {
      await operation();
      if (!disposed) notify(message);
    } catch (cause) {
      if (!disposed) error = errorMessage(cause);
    }
  }
  const filename = (suffix: string) =>
    safeFilename(
      (video?.title || 'biliSum') +
        (video && video.page > 1 ? '-P' + video.page : ''),
    ) + suffix;
  function downloadSummary() {
    if (video && shownSummary)
      void perform(
        () =>
          downloadText(
            summaryDocument(video!, shownSummary!),
            filename(shownSummary?.incomplete ? '-未完成草稿.md' : '-总结.md'),
            'text/markdown;charset=utf-8',
          ),
        '已开始下载 Markdown 文件',
      );
  }
  function copySummary() {
    if (video && shownSummary)
      void perform(
        () =>
          navigator.clipboard.writeText(summaryDocument(video!, shownSummary!)),
        'Markdown 已复制',
      );
  }
  function downloadMap(format: 'svg' | 'png') {
    if (!map) return;
    const tree = $state.snapshot(map.tree);
    void perform(
      () =>
        format === 'svg'
          ? downloadText(
              renderMindMapSvg(tree, appearance),
              filename('-思维导图.svg'),
              'image/svg+xml;charset=utf-8',
            )
          : downloadMapPng(tree, filename('-思维导图.png'), appearance),
      '已开始下载思维导图',
    );
  }
  function downloadOutline() {
    if (!map) return;
    const tree = $state.snapshot(map.tree);
    void perform(
      () =>
        downloadText(
          mindMapMarkdown(tree),
          filename('-导图大纲.md'),
          'text/markdown;charset=utf-8',
        ),
      '已开始下载完整导图大纲',
    );
  }
  function downloadSubtitles(format: 'txt' | 'srt') {
    if (!transcript) return;
    void perform(
      () =>
        downloadText(
          format === 'srt'
            ? exportSrt(transcript!)
            : transcriptText(transcript!),
          filename('-字幕.' + format),
        ),
      '已开始下载 ' + format.toUpperCase() + ' 字幕',
    );
  }
  function copySubtitles() {
    if (transcript)
      void perform(
        () => navigator.clipboard.writeText(transcriptText(transcript!)),
        '完整字幕已复制',
      );
  }
  function seek(seconds: number) {
    if (video && tabId !== undefined)
      void perform(
        () => seekVideo(tabId!, video!, seconds),
        '已跳转到 ' + formatTime(seconds),
      );
  }
  async function closeSettings() {
    showSettings = false;
    await tick();
    settingsButton?.focus();
  }
  function savedSettings(next: Settings) {
    stopGeneration();
    settings = {
      ...next,
      theme: settings.theme,
      detailLevel: settings.detailLevel,
    };
    void closeSettings();
    notify('API 设置已保存');
  }

  onMount(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const syncTheme = () => {
      systemTheme = media.matches ? 'dark' : 'light';
    };
    syncTheme();
    media.addEventListener('change', syncTheme);
    let windowId: number | undefined;
    let debounce: ReturnType<typeof setTimeout>;
    const schedule = (force = false) => {
      clearTimeout(debounce);
      debounce = setTimeout(() => void syncCurrent(force), 180);
    };
    // Cancel immediately on navigation; only fetching is debounced. Otherwise a
    // queued/preparing request could start against the old video during the delay.
    const invalidateSource = () => {
      tabQuerySerial++;
      requestKey = '';
      startSource();
      video = null;
      tracks = [];
      selectedTrack = '';
    };
    const activated = (info: { windowId: number; tabId: number }) => {
      if (windowId === undefined || info.windowId === windowId) {
        if (info.tabId !== tabId) invalidateSource();
        schedule();
      }
    };
    const updated = (
      id: number,
      change: { url?: string; status?: string },
      tab: { active: boolean; windowId: number },
    ) => {
      if (
        tab.active &&
        (windowId === undefined || tab.windowId === windowId) &&
        (change.url || change.status === 'complete')
      ) {
        const locator = change.url ? parseVideoUrl(change.url) : null;
        const nextKey = locator ? id + ':' + locator.key : 'unsupported';
        if ((change.url && nextKey !== requestKey) || id !== tabId)
          invalidateSource();
        schedule(change.status === 'complete' && !loading && !transcript);
      }
    };
    const removed = (id: number) => {
      if (id === tabId) {
        invalidateSource();
        schedule();
      }
    };
    browser.tabs.onActivated.addListener(activated);
    browser.tabs.onUpdated.addListener(updated);
    browser.tabs.onRemoved.addListener(removed);
    void browser.windows
      .getCurrent()
      .then((window) => {
        windowId = window.id;
      })
      .catch(() => {});
    void loadSettings()
      .then((value) => {
        if (!disposed)
          settings = preferencesTouched
            ? {
                ...value,
                theme: settings.theme,
                detailLevel: settings.detailLevel,
              }
            : value;
      })
      .catch(() => {
        if (!disposed) error = '读取 API 设置失败，请重新保存设置。';
      })
      .finally(() => {
        if (!disposed) settingsReady = true;
      });
    void syncCurrent();
    return () => {
      disposed = true;
      media.removeEventListener('change', syncTheme);
      sourceController?.abort();
      generationController?.abort();
      clearTimeout(debounce);
      clearTimeout(toastTimer);
      browser.tabs.onActivated.removeListener(activated);
      browser.tabs.onUpdated.removeListener(updated);
      browser.tabs.onRemoved.removeListener(removed);
    };
  });
</script>

<svelte:window onkeydown={exitFocus} />

<div class="app-shell" class:focus-mode={focusMode}>
  <header class="app-header">
    <div class="brand">
      <img
        class="brand-mark"
        src="/icons/128.png"
        width="30"
        height="30"
        alt=""
      />
      <span>biliSum</span>
      <span class="version">{version}</span>
    </div>
    <div class="header-tools">
      <a
        class="icon-button"
        href="https://github.com/LcodeCoder/biliSum"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="GitHub · 给 biliSum 点个 Star（新标签页打开）"
        title="GitHub · 求 Star（新标签页打开）"
        ><Icon name="github" size={19} /></a
      >
      <div class="theme-switch" role="group" aria-label="外观">
        <button
          class="icon-button small"
          class:active={appearance === 'light'}
          onclick={() => changeTheme('light')}
          aria-pressed={appearance === 'light'}
          aria-label="浅色模式"
          title="浅色模式 · 暖纸色"><Icon name="sun" size={17} /></button
        >
        <button
          class="icon-button small"
          class:active={appearance === 'eye'}
          onclick={() => changeTheme('eye')}
          aria-pressed={appearance === 'eye'}
          aria-label="护眼模式"
          title="护眼模式 · 柔和暖色"><Icon name="eye" size={17} /></button
        >
        <button
          class="icon-button small"
          class:active={appearance === 'dark'}
          onclick={() => changeTheme('dark')}
          aria-pressed={appearance === 'dark'}
          aria-label="深色模式"
          title="深色模式 · 暖棕灰"><Icon name="moon" size={17} /></button
        >
      </div>
      <button
        class="icon-button"
        class:active={showSettings}
        bind:this={settingsButton}
        disabled={!settingsReady || settingsSaving}
        onclick={() => (showSettings = !showSettings)}
        aria-label="打开 API 设置"
        aria-expanded={showSettings}
        title="API 设置"><Icon name="settings" size={19} /></button
      >
    </div>
  </header>
  {#if showSettings}
    <main class="panel-content settings-content">
      <SettingsPane
        {settings}
        onsave={savedSettings}
        onclose={closeSettings}
        onsaving={(value) => (settingsSaving = value)}
      />
    </main>
  {:else}
    <details class="setup-section" bind:open={setupOpen}>
      <summary class="setup-summary" aria-label="视频与生成设置">
        <span class="setup-summary-text"
          ><strong>{video ? video.title : '视频与生成设置'}</strong><span
            >{setupOpen
              ? '收起设置，留出阅读空间'
              : '展开视频信息与生成设置'}{video && video.page > 1
              ? ' · P' + video.page
              : ''}</span
          ></span
        >
        <Icon name="chevron" size={16} />
      </summary>
      <div class="source-section">
        <div class="section-eyebrow">
          <span>当前视频</span><button
            class="icon-button tiny"
            onclick={() => syncCurrent(true)}
            disabled={loading}
            aria-label="刷新当前视频和字幕"
            title="刷新当前视频和字幕"
            ><Icon name={loading ? 'loader' : 'refresh'} size={15} /></button
          >
        </div>
        {#if video}
          <div class="video-card">
            <div class="video-cover">
              {#if video.cover}<img
                  src={video.cover}
                  alt=""
                  referrerpolicy="no-referrer"
                  onerror={(event) => {
                    if (
                      video &&
                      video.cover === event.currentTarget.getAttribute('src')
                    )
                      video.cover = '';
                  }}
                />{:else}<Icon name="play" size={23} />{/if}<span
                >{formatTime(video.duration)}</span
              >
            </div>
            <div class="video-details">
              <h2 title={video.title}>{video.title}</h2>
              <p>
                {video.owner || video.bvid}{#if video.part}<span>
                    · P{video.page}</span
                  >{/if}
              </p>
            </div>
          </div>
          {#if video.part}<p class="part-label" title={video.part}>
              P{video.page} · {video.part}
            </p>{/if}
        {:else}
          <div class="video-placeholder">
            <Icon name={loading ? 'loader' : 'play'} size={23} />
            <div>
              <strong>{loading ? '正在识别视频…' : '未识别到视频'}</strong>
              <p>{loading ? '读取当前标签页' : '请打开 B 站视频页'}</p>
            </div>
          </div>
        {/if}
        <div class="source-status" class:ready={!!transcript}>
          <span class="status-dot"></span><span
            >{loading
              ? '正在获取视频字幕…'
              : transcript
                ? transcript.source + ' · ' + transcript.cues.length + ' 条字幕'
                : video
                  ? '尚未获取字幕，可前往字幕页导入'
                  : '在 B 站视频页使用'}</span
          >
        </div>
      </div>
      {#if sourceChunks > 1}<p class="source-notice">
          字幕较长，将分 {sourceChunks} 段阅读后合并，首次至少需要 {sourceChunks +
            1} 次请求。相同配置下可复用本次侧栏中已完成的笔记；每次最终生成仍按服务商规则计费，可随时停止。
        </p>{/if}
      <div class="detail-control">
        <div class="detail-heading">
          <label for="summary-detail">总结细腻程度</label>
          <output for="summary-detail">{detail.label}</output>
        </div>
        <input
          id="summary-detail"
          type="range"
          min="1"
          max="5"
          step="1"
          value={settings.detailLevel}
          disabled={!!busy}
          aria-valuetext={detail.label}
          title="用于下一次生成的思维导图、Markdown 总结和 HTML 阅读页"
          style:--range-progress={(settings.detailLevel - 1) * 25 + '%'}
          oninput={(event) => changeDetail(event.currentTarget.value)}
          onchange={persistPreferences}
        />
        <div class="detail-range"><span>精简</span><span>详尽</span></div>
      </div>
      <div class="generation-actions" aria-label="生成操作">
        <div class="generation-card">
          <strong>思维导图</strong>
          <button
            class="generate-button"
            onclick={() => generate('map')}
            disabled={!canGenerate}
            aria-label="生成思维导图"
            title="生成思维导图"><Icon name="map" size={21} /></button
          >
        </div>
        <div class="generation-card">
          <strong>Markdown</strong>
          <button
            class="generate-button"
            onclick={() => generate('summary')}
            disabled={!canGenerate}
            aria-label="生成 Markdown 总结"
            title="生成 Markdown 总结"><Icon name="file" size={21} /></button
          >
        </div>
        <div class="generation-card">
          <strong>HTML</strong>
          <button
            class="generate-button"
            onclick={() => generate('html')}
            disabled={!canGenerate}
            aria-label="生成 HTML 阅读页"
            title="AI 生成 HTML 阅读页"><Icon name="code" size={21} /></button
          >
        </div>
      </div>
      {#if settingsReady && !settings.apiKey && video && transcript && !busy}<div
          class="setup-hint"
        >
          <Icon name="key" size={15} /><span>请先配置 API</span><button
            class="icon-button tiny"
            onclick={() => (showSettings = true)}
            aria-label="配置 API Key"
            title="配置 API Key"><Icon name="settings" size={16} /></button
          >
        </div>{/if}
    </details>
    {#if busy}<div class="generation-progress" role="status">
        <Icon name="loader" size={17} /><span>{progress}</span><button
          class="icon-button small"
          onclick={() => stopGeneration()}
          aria-label="停止生成"
          title="停止生成"><Icon name="stop" size={15} /></button
        >
      </div>{/if}
    {#if sourceNotice && page !== 'subtitles'}<div
        class="source-notice"
        role="status"
      >
        {sourceNotice}<button
          class="text-button"
          onclick={() => (page = 'subtitles')}>查看字幕</button
        >
      </div>{/if}
    <nav class="page-nav" aria-label="工作空间页面">
      <div class="nav-item" class:selected={page === 'map'}>
        <button
          class="nav-button"
          aria-label="思维导图页面"
          aria-pressed={page === 'map'}
          title="思维导图"
          onclick={() => (page = 'map')}
          ><Icon name="map" size={20} /><span>思维导图</span></button
        >
      </div>
      <div class="nav-item" class:selected={page === 'summary'}>
        <button
          class="nav-button"
          aria-label="Markdown 总结页面"
          aria-pressed={page === 'summary'}
          title="Markdown 总结"
          onclick={() => (page = 'summary')}
          ><Icon name="file" size={20} /><span>Markdown</span></button
        >
      </div>
      <div class="nav-item" class:selected={page === 'html'}>
        <button
          class="nav-button"
          aria-label="HTML 阅读页页面"
          aria-pressed={page === 'html'}
          title="HTML 阅读页，可离线下载"
          onclick={() => {
            page = 'html';
            if (htmlResult) setupOpen = false;
          }}><Icon name="code" size={20} /><span>HTML</span></button
        >
      </div>
      <div class="nav-item" class:selected={page === 'subtitles'}>
        <button
          class="nav-button"
          aria-label="字幕页面"
          aria-pressed={page === 'subtitles'}
          title="视频字幕"
          onclick={() => (page = 'subtitles')}
          ><Icon name="subtitles" size={20} /><span>字幕</span></button
        >
      </div>
    </nav>
    {#if error}<div class="error-banner" role="alert">
        <Icon name="alert" size={17} />
        <p>{error}</p>
        {#if retryKind}<button
            class="text-button"
            disabled={!canGenerate}
            onclick={() => generate(retryKind!)}>重新生成</button
          >{/if}
        <button
          class="icon-button tiny"
          onclick={() => (error = '')}
          aria-label="关闭错误提示"
          title="关闭提示"><Icon name="x" size={14} /></button
        >
      </div>{/if}
    <main
      class="panel-content"
      class:map-content={page === 'map'}
      class:html-content={page === 'html'}
    >
      {#if page === 'map'}
        <section class="map-pane" aria-label="思维导图">
          <div class="pane-heading">
            <h1>{focusMode ? '专注阅读' : '思维导图'}</h1>
            <div class="toolbar">
              <button
                class="icon-button"
                class:active={focusMode}
                bind:this={focusButton}
                onclick={() => (focusMode = !focusMode)}
                disabled={!map}
                aria-pressed={focusMode}
                aria-label={focusMode ? '退出专注阅读' : '专注阅读导图'}
                title={focusMode
                  ? '退出专注阅读（Esc）'
                  : '专注阅读，隐藏上方信息'}
                ><Icon
                  name={focusMode ? 'collapse' : 'expand'}
                  size={18}
                /></button
              >
              <button
                class="icon-button"
                onclick={() => downloadMap('svg')}
                disabled={!map}
                aria-label="下载 SVG 思维导图"
                title="下载完整 SVG 思维导图（含未展开条目）"
                ><Icon name="download" size={18} /></button
              ><button
                class="icon-button"
                onclick={() => downloadMap('png')}
                disabled={!map}
                aria-label="下载 PNG 思维导图"
                title="下载完整 PNG 思维导图（含未展开条目）"
                ><Icon name="image" size={18} /></button
              >
            </div>
          </div>
          {#if map}
            {#key map.tree}
              <MindMapWorkspace
                tree={map.tree}
                theme={appearance}
                ondownloadoutline={downloadOutline}
              />
            {/key}
            <p class="result-meta">
              {map.source} · {detailProfile(map.detailLevel).label}
            </p>
          {:else}
            <div class="empty-state map-empty">
              <span class="empty-icon"
                ><Icon
                  name={busy === 'map' ? 'loader' : 'map'}
                  size={28}
                /></span
              >
              <p>
                {busy === 'map'
                  ? '正在生成思维导图…'
                  : !video
                    ? '请先打开 B 站视频'
                    : !transcript
                      ? '请先获取或导入字幕'
                      : '尚未生成思维导图'}
              </p>
            </div>
          {/if}
        </section>
      {:else if page === 'summary'}
        <section class="summary-pane" aria-label="Markdown 总结">
          <div class="pane-heading">
            <h1>Markdown</h1>
            <div class="toolbar">
              <button
                class="icon-button"
                class:active={rawMarkdown}
                onclick={() => (rawMarkdown = !rawMarkdown)}
                disabled={!displayMarkdown}
                aria-pressed={rawMarkdown}
                aria-label="切换 Markdown 源码"
                title="切换预览 / Markdown 源码"
                ><Icon name="code" size={17} /></button
              ><button
                class="icon-button"
                onclick={copySummary}
                disabled={!shownSummary || busy === 'summary'}
                aria-label="复制 Markdown 总结"
                title="复制 Markdown 总结"
                ><Icon name="copy" size={17} /></button
              ><button
                class="icon-button"
                onclick={downloadSummary}
                disabled={!shownSummary || busy === 'summary'}
                aria-label="下载 Markdown 总结"
                title="下载 Markdown 总结 (.md)"
                ><Icon name="download" size={18} /></button
              >
            </div>
          </div>
          {#if draft && busy !== 'summary'}<div
              class="draft-notice"
              role="status"
            >
              <p>
                未完成草稿：生成已中断，以下内容不完整。可复制、下载或重新生成。
              </p>
              {#if summary}<button
                  class="text-button"
                  onclick={() => (draft = null)}>显示上次完整总结</button
                >{/if}
            </div>{/if}
          {#if displayMarkdown}<article
              class="summary-document"
              class:drafting={busy === 'summary'}
            >
              {#if rawMarkdown}<pre
                  class="markdown-source">{displayMarkdown}</pre>{:else}<div
                  class="markdown-body"
                >
                  {@html renderedMarkdown}
                </div>{/if}
            </article>
            {#if shownSummary && busy !== 'summary'}
              <p class="result-meta">
                {shownSummary.source} · {detailProfile(shownSummary.detailLevel)
                  .label}
              </p>
            {/if}
          {:else}
            <div class="empty-state">
              <span class="empty-icon"
                ><Icon
                  name={busy === 'summary' ? 'loader' : 'file'}
                  size={28}
                /></span
              >
              <p>
                {busy === 'summary'
                  ? '正在生成总结…'
                  : !video
                    ? '请先打开 B 站视频'
                    : !transcript
                      ? '请先获取或导入字幕'
                      : '尚未生成总结'}
              </p>
            </div>
          {/if}
        </section>
      {:else if page === 'html'}
        <HtmlReport
          {video}
          result={htmlResult}
          {appearance}
          layout={htmlLayout}
          theme={htmlTheme}
          filename={filename('-阅读页.html')}
          busy={busy === 'html'}
          {canGenerate}
          {focusMode}
          ontogglefocus={(button) => {
            focusButton = button;
            focusMode = !focusMode;
          }}
          onlayout={(value) => (htmlLayout = value)}
          ontheme={(value) => (htmlTheme = value)}
          onnotify={notify}
          ongenerate={() => generate('html')}
        />
      {:else}
        <Subtitles
          {transcript}
          {tracks}
          selected={selectedTrack}
          {loading}
          notice={sourceNotice}
          onselect={changeLanguage}
          onimport={importFile}
          ondownload={downloadSubtitles}
          oncopy={copySubtitles}
          onseek={seek}
        />
      {/if}
    </main>
    <footer class="app-footer">
      <span
        ><span class="status-dot" class:connected={!!settings.apiKey}
        ></span>{settings.apiKey ? settings.model : '未配置 API'}</span
      >
    </footer>
  {/if}
  {#if toast}<div class="toast" role="status">
      <Icon name="check" size={16} /><span>{toast}</span>
    </div>{/if}
</div>
