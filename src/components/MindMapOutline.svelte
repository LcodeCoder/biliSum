<script lang="ts">
  import { untrack } from 'svelte';
  import Icon from './Icon.svelte';
  import { mindMapStats, searchMindMap } from '../lib/mindmap';
  import type { MindMapNode } from '../lib/types';

  let { tree }: { tree: MindMapNode } = $props();
  let query = $state('');
  let collapsed = $state(new Set<string>());
  const searching = $derived(!!query.trim());
  const filtered = $derived(searchMindMap(tree, query));
  const count = $derived(filtered ? mindMapStats(filtered).total : 0);

  function branchPaths(
    node: MindMapNode,
    minDepth: number,
    depth = 0,
    path = '0',
  ): string[] {
    return [
      ...(node.children.length && depth >= minDepth ? [path] : []),
      ...node.children.flatMap((child, index) =>
        branchPaths(child, minDepth, depth + 1, path + '.' + index),
      ),
    ];
  }
  function toggle(path: string) {
    const next = new Set(collapsed);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    collapsed = next;
  }
  $effect(() => {
    const current = tree;
    untrack(() => {
      query = '';
      collapsed = new Set(branchPaths(current, 2));
    });
  });
</script>

{#snippet entry(node: MindMapNode, path: string)}
  {@const expanded = searching || !collapsed.has(path)}
  <li>
    {#if node.children.length}
      <button
        class="outline-node"
        aria-expanded={expanded}
        aria-label={(expanded ? '收起：' : '展开：') + node.title}
        disabled={searching}
        title={searching ? '搜索时自动展开，清空搜索后可折叠' : node.title}
        onclick={() => toggle(path)}
      >
        <span class="outline-chevron" class:closed={!expanded}
          ><Icon name="chevron" size={14} /></span
        >
        <span>{node.title}</span>
        <small>{node.children.length}</small>
      </button>
      {#if expanded}
        <ul>
          {#each node.children as child, index}
            {@render entry(child, path + '.' + index)}
          {/each}
        </ul>
      {/if}
    {:else}
      <div class="outline-leaf">
        <span class="outline-dot"></span><span>{node.title}</span>
      </div>
    {/if}
  </li>
{/snippet}

<div class="outline-view">
  <label class="outline-search control-field compact-control">
    <Icon name="search" size={15} />
    <input
      class="form-control"
      type="search"
      aria-label="搜索导图内容"
      placeholder="搜索主题和要点"
      bind:value={query}
    />
  </label>
  <div class="outline-actions">
    <span
      >{searching ? '筛选后' : '共'}
      {count} 条{searching ? '（含上级主题）' : ''}</span
    >
    <div>
      <button
        class="plain-button"
        disabled={searching}
        onclick={() => (collapsed = new Set())}>展开全部</button
      >
      <button
        class="plain-button"
        disabled={searching}
        onclick={() => (collapsed = new Set(branchPaths(tree, 1)))}
        >收起分支</button
      >
    </div>
  </div>
  {#if filtered}
    <h2 class="outline-title">{filtered.title}</h2>
    <ul class="outline-tree">
      {#each filtered.children as child, index}
        {@render entry(child, '0.' + index)}
      {/each}
    </ul>
    {#if !filtered.children.length}<p class="chart-note">
        当前主题没有子条目。
      </p>{/if}
  {:else}
    <div class="outline-no-match">
      <p>没有找到匹配的主题或要点。</p>
      <button class="text-button" onclick={() => (query = '')}>清空搜索</button>
    </div>
  {/if}
</div>
