<script lang="ts">
  import Icon from './Icon.svelte';
  import { formatTime } from '../lib/transcript';
  import type { SubtitleTrack, Transcript } from '../lib/types';

  let {
    transcript,
    tracks,
    selected,
    loading,
    notice,
    onselect,
    onimport,
    ondownload,
    oncopy,
    onseek,
  }: {
    transcript: Transcript | null;
    tracks: SubtitleTrack[];
    selected: string;
    loading: boolean;
    notice: string;
    onselect: (id: string) => void;
    onimport: (file: File) => void;
    ondownload: (format: 'txt' | 'srt') => void;
    oncopy: () => void;
    onseek: (seconds: number) => void;
  } = $props();
  let query = $state('');
  let limit = $state(150);
  let fileInput: HTMLInputElement;
  $effect(() => {
    transcript;
    query = '';
    limit = 150;
  });
  const searchTerm = $derived(query.trim().toLocaleLowerCase());
  const matches = $derived(
    (transcript?.cues || [])
      .map((cue, index) => ({ cue, index }))
      .filter(
        ({ cue }) =>
          !searchTerm || cue.content.toLocaleLowerCase().includes(searchTerm),
      ),
  );
  const visible = $derived(matches.slice(0, limit));

  function search(value: string) {
    query = value;
    limit = 150;
  }
  function chooseFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (file) onimport(file);
    input.value = '';
  }
  function segments(text: string): { text: string; hit: boolean }[] {
    const term = query.trim().toLocaleLowerCase();
    if (!term) return [{ text, hit: false }];
    const lower = text.toLocaleLowerCase();
    const parts: { text: string; hit: boolean }[] = [];
    let start = 0,
      index = lower.indexOf(term);
    while (index >= 0) {
      if (index > start)
        parts.push({ text: text.slice(start, index), hit: false });
      parts.push({ text: text.slice(index, index + term.length), hit: true });
      start = index + term.length;
      index = lower.indexOf(term, start);
    }
    if (start < text.length)
      parts.push({ text: text.slice(start), hit: false });
    return parts;
  }
</script>

<section class="subtitle-pane" aria-label="视频字幕">
  <div class="pane-heading">
    <div>
      <h1>视频字幕</h1>
      <p>
        {transcript
          ? transcript.cues.length +
            ' 条字幕 · ' +
            (transcript.timed ? '带时间轴' : '纯文本')
          : '暂无字幕'}
      </p>
    </div>
    <div class="toolbar">
      <button
        class="icon-button"
        onclick={oncopy}
        disabled={!transcript || loading}
        aria-label="复制全部字幕"
        title="复制全部字幕"><Icon name="copy" size={17} /></button
      >
      <button
        class="icon-button"
        onclick={() => ondownload('txt')}
        disabled={!transcript || loading}
        aria-label="下载 TXT 字幕"
        title="下载 TXT 字幕"><Icon name="file" size={17} /></button
      >
      <button
        class="icon-button"
        onclick={() => ondownload('srt')}
        disabled={!transcript?.timed || loading}
        aria-label="下载 SRT 字幕"
        title="下载 SRT 字幕（需要时间轴）"
        ><Icon name="download" size={17} /></button
      >
      <button
        class="icon-button"
        onclick={() => fileInput.click()}
        disabled={loading}
        aria-label="导入字幕文件"
        title="导入 SRT、VTT、TXT 或 B 站 JSON 字幕"
        ><Icon name="upload" size={17} /></button
      >
    </div>
  </div>
  <input
    class="visually-hidden"
    type="file"
    accept=".srt,.vtt,.txt,.json,text/plain,application/json"
    bind:this={fileInput}
    onchange={chooseFile}
    aria-label="选择字幕文件"
    tabindex="-1"
  />
  {#if tracks.length}
    <div class="language-row">
      <label for="subtitle-language">字幕语言</label>
      <select
        class="form-control compact-control"
        id="subtitle-language"
        value={selected}
        disabled={loading}
        onchange={(event) => onselect(event.currentTarget.value)}
      >
        {#if selected === 'imported'}<option value="imported"
            >已导入的字幕</option
          >{/if}
        {#each tracks as track (track.id)}<option value={track.id}
            >{track.label}</option
          >{/each}
      </select>
    </div>
  {/if}
  <div class="search-field control-field compact-control">
    <Icon name="search" size={17} />
    <input
      class="form-control"
      type="search"
      value={query}
      oninput={(event) => search(event.currentTarget.value)}
      placeholder="搜索字幕内容…"
      aria-label="搜索字幕内容"
      disabled={!transcript}
    />
    {#if query}<button
        class="icon-button tiny"
        onclick={() => search('')}
        aria-label="清空搜索"
        title="清空搜索"><Icon name="x" size={14} /></button
      >{/if}
  </div>
  {#if notice && transcript}<p class="form-message error" role="alert">
      {notice}
    </p>{/if}
  {#if loading}
    <div class="empty-state compact">
      <span class="empty-icon"><Icon name="loader" size={25} /></span>
      <h2>正在读取字幕</h2>
    </div>
  {:else if !transcript}
    <div class="empty-state compact">
      <span class="empty-icon"><Icon name="subtitles" size={27} /></span>
      <h2>还没有字幕内容</h2>
      <p>
        {notice || '请在 B 站登录后刷新，或点击右上角的导入图标选择字幕文件。'}
      </p>
      <small>支持 SRT · VTT · TXT · JSON</small>
    </div>
  {:else}
    <div class="subtitle-source">
      <span>{transcript.source}</span><span
        >{query ? matches.length + ' 条匹配' : '完整字幕'}</span
      >
    </div>
    {#if !matches.length}
      <div class="empty-state compact">
        <Icon name="search" size={28} />
        <h2>没有找到匹配内容</h2>
      </div>
    {:else}
      <div class="cue-list">
        {#each visible as { cue, index } (index)}
          <div class="cue-row">
            <span class="cue-time"
              >{transcript.timed
                ? formatTime(cue.from)
                : String(index + 1).padStart(2, '0')}</span
            >
            <p>
              {#each segments(cue.content) as segment, partIndex (partIndex)}{#if segment.hit}<mark
                    >{segment.text}</mark
                  >{:else}{segment.text}{/if}{/each}
            </p>
            {#if transcript.timed}<button
                class="icon-button tiny cue-play"
                onclick={() => onseek(cue.from)}
                aria-label={'跳转到 ' + formatTime(cue.from)}
                title={'跳转到 ' + formatTime(cue.from)}
                ><Icon name="play" size={13} /></button
              >{/if}
          </div>
        {/each}
      </div>
      {#if matches.length > limit}
        <div class="load-more">
          <span>已显示 {visible.length} / {matches.length} 条</span><button
            class="icon-button"
            onclick={() => (limit += 150)}
            aria-label="显示更多字幕"
            title="显示更多字幕"><Icon name="chevron" size={18} /></button
          >
        </div>
      {/if}
    {/if}
  {/if}
</section>
