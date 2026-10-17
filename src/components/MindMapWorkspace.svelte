<script lang="ts">
  import Icon from './Icon.svelte';
  import MindMap from './MindMap.svelte';
  import MindMapOutline from './MindMapOutline.svelte';
  import MindMapOverview from './MindMapOverview.svelte';
  import type { Appearance, MindMapNode } from '../lib/types';

  let {
    tree,
    theme = 'light',
    ondownloadoutline,
  }: {
    tree: MindMapNode;
    theme?: Appearance;
    ondownloadoutline: () => void;
  } = $props();
  let view = $state<'map' | 'outline' | 'overview'>('map');
  let branch = $state('all');
  let depth = $state(1);
  const selected = $derived(
    branch === 'all' ? null : (tree.children[Number(branch)] ?? null),
  );
  const shownTree = $derived(selected ?? tree);

  function focusBranch(index: number) {
    branch = String(index);
    depth = 2;
    view = 'map';
  }
  function changeBranch(value: string) {
    branch = value;
    depth = value === 'all' ? 1 : 2;
  }
</script>

<div class="mindmap-workspace">
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
          title="切换显示层级会重置展开状态；点击父节点可逐层展开或收起。"
          bind:value={depth}
        >
          <option value={1}>{selected ? '一级要点' : '主题概览'}</option>
          <option value={2}>两级要点</option>
          <option value={6}>全部层级</option>
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
      <MindMap tree={shownTree} {theme} mode="right" maxDepth={depth} />
    </div>
    <div class="analysis-scroll" hidden={view !== 'outline'}>
      {#key shownTree}<MindMapOutline tree={shownTree} />{/key}
    </div>
    <div class="analysis-scroll" hidden={view !== 'overview'}>
      <MindMapOverview {tree} onfocus={focusBranch} />
    </div>
  </div>
  {#if view === 'map' && !shownTree.children.length}
    <p class="analysis-caption">暂无下级主题。</p>
  {/if}
</div>
