<script lang="ts">
  import Icon from './Icon.svelte';
  import MindMap from './MindMap.svelte';
  import MindMapOutline from './MindMapOutline.svelte';
  import MindMapOverview from './MindMapOverview.svelte';
  import type { MindMapNode } from '../lib/types';
  import type { MapLayoutMode } from '../lib/mindmap';

  let {
    tree,
    theme = 'light',
    ondownloadoutline,
  }: {
    tree: MindMapNode;
    theme?: 'light' | 'dark';
    ondownloadoutline: () => void;
  } = $props();
  let view = $state<'map' | 'outline' | 'overview'>('map');
  let branch = $state('all');
  let depth = $state(1);
  let mode = $state<'auto' | MapLayoutMode>('auto');
  let workspace = $state<HTMLDivElement>();
  let width = $state(320);
  const selected = $derived(
    branch === 'all' ? null : (tree.children[Number(branch)] ?? null),
  );
  const shownTree = $derived(selected ?? tree);
  const layoutMode = $derived(
    mode === 'auto' ? (width >= 620 ? 'compact' : 'right') : mode,
  );

  function focusBranch(index: number) {
    branch = String(index);
    depth = 2;
    view = 'map';
  }
  function changeBranch(value: string) {
    branch = value;
    depth = value === 'all' ? 1 : 2;
  }
  $effect(() => {
    const element = workspace;
    if (!element) return;
    const observer = new ResizeObserver(() => (width = element.clientWidth));
    observer.observe(element);
    return () => observer.disconnect();
  });
</script>

<div class="mindmap-workspace" bind:this={workspace}>
  <div class="analysis-view-tabs" role="group" aria-label="分析展示方式">
    <button
      class:active={view === 'map'}
      aria-pressed={view === 'map'}
      aria-label="导图视图"
      onclick={() => (view = 'map')}><Icon name="map" size={15} />导图</button
    >
    <button
      class:active={view === 'outline'}
      aria-pressed={view === 'outline'}
      aria-label="大纲视图"
      onclick={() => (view = 'outline')}
      ><Icon name="list" size={15} />大纲</button
    >
    <button
      class:active={view === 'overview'}
      aria-pressed={view === 'overview'}
      aria-label="分布视图"
      onclick={() => (view = 'overview')}
      ><Icon name="chart" size={15} />分布</button
    >
  </div>
  <div class="analysis-filters">
    {#if view !== 'overview'}
      <label class="branch-select"
        ><span class="visually-hidden">查看主题</span>
        <select
          class="form-control compact-control"
          aria-label="查看主题"
          value={branch}
          onchange={(event) => changeBranch(event.currentTarget.value)}
        >
          <option value="all">全部主题</option>
          {#each tree.children as child, index}<option value={String(index)}
              >{index + 1}. {child.title}</option
            >{/each}
        </select>
      </label>
    {/if}
    {#if view === 'map'}
      <label
        ><span class="visually-hidden">显示层级</span>
        <select
          class="form-control compact-control"
          aria-label="显示层级"
          bind:value={depth}
        >
          <option value={1}>{selected ? '一级要点' : '主题概览'}</option>
          <option value={2}>两级要点</option>
          <option value={6}>全部层级</option>
        </select>
      </label>
      <label class="layout-select"
        ><span class="visually-hidden">导图布局</span>
        <select
          class="form-control compact-control"
          aria-label="导图布局"
          bind:value={mode}
        >
          <option value="auto">自动布局</option>
          <option value="compact">双向紧凑</option>
          <option value="right">向右展开</option>
        </select>
      </label>
    {:else if view === 'outline'}
      <button
        class="icon-button small"
        onclick={ondownloadoutline}
        aria-label="下载完整 Markdown 大纲"
        title="下载完整 Markdown 大纲（含全部主题）"
        ><Icon name="download" size={16} /></button
      >
    {:else}
      <span class="analysis-filter-label">完整导图结构 · 点击主题查看分支</span>
    {/if}
  </div>
  <div class="analysis-view-content" class:diagram-content={view === 'map'}>
    <!-- Keep the camera, search and folding state when switching display modes. -->
    <div class="diagram-view" hidden={view !== 'map'}>
      <MindMap tree={shownTree} {theme} mode={layoutMode} maxDepth={depth} />
    </div>
    <div class="analysis-scroll" hidden={view !== 'outline'}>
      {#key shownTree}<MindMapOutline tree={shownTree} />{/key}
    </div>
    <div class="analysis-scroll" hidden={view !== 'overview'}>
      <MindMapOverview {tree} onfocus={focusBranch} />
    </div>
  </div>
  {#if view === 'map'}
    <p class="analysis-caption">
      {selected
        ? '当前主题：' + selected.title
        : tree.children.length
          ? '先看主题，再从上方选择分支查看要点。'
          : '当前结果只有中心主题，没有下级条目。'}
      {depth < 6 && tree.children.length ? '“+” 表示未展开条目。' : ''}
    </p>
  {:else if view === 'outline'}
    <p class="analysis-caption">
      {selected
        ? '当前主题的大纲 · 切回“全部主题”查看完整内容'
        : '完整内容支持搜索与折叠 · 可下载 Markdown 大纲'}
    </p>
  {/if}
</div>
