<script lang="ts">
  import Icon from './Icon.svelte';
  import { mindMapStats } from '../lib/mindmap';
  import type { MindMapNode } from '../lib/types';

  let {
    tree,
    onfocus,
  }: { tree: MindMapNode; onfocus: (index: number) => void } = $props();
  const stats = $derived(mindMapStats(tree));
  const maxBranch = $derived(
    Math.max(1, ...stats.branches.map((branch) => branch.count)),
  );
  const maxLevel = $derived(Math.max(...stats.levels));
</script>

<div class="overview-view">
  <div class="map-metrics" aria-label="导图结构统计">
    <div><strong>{stats.branches.length}</strong><span>主题</span></div>
    <div><strong>{stats.total}</strong><span>结构条目</span></div>
    <div><strong>{stats.depth}</strong><span>层级</span></div>
  </div>
  <section class="structure-chart" aria-label="主题条目分布">
    <h2>主题条目分布</h2>
    <p class="chart-note">
      每个主题及其下级条目的数量。点击主题，可查看对应导图。
    </p>
    {#if stats.branches.length}
      <ol class="branch-chart">
        {#each stats.branches as branch}
          <li>
            <button
              class="branch-bar"
              aria-label={'查看主题：' + branch.title}
              onclick={() => onfocus(branch.index)}
            >
              <span class="branch-bar-heading"
                ><span>{branch.title}</span><strong
                  >{branch.count} 条 <Icon name="back" size={12} /></strong
                ></span
              >
              <span class="branch-track" aria-hidden="true"
                ><span style:width={(branch.count / maxBranch) * 100 + '%'}
                ></span></span
              >
            </button>
          </li>
        {/each}
      </ol>
    {:else}
      <p class="chart-note">当前结果只有中心主题，没有可比较的主题分支。</p>
    {/if}
  </section>
  <section class="structure-chart" aria-label="层级分布">
    <h2>层级分布</h2>
    <ol class="level-chart">
      {#each stats.levels as count, depth}
        <li>
          <span
            >{depth === 0
              ? '中心'
              : depth === 1
                ? '主题'
                : '第 ' + (depth + 1) + ' 层'}</span
          >
          <span class="level-track" aria-hidden="true"
            ><span style:width={(count / maxLevel) * 100 + '%'}></span></span
          >
          <strong>{count}</strong>
        </li>
      {/each}
    </ol>
  </section>
  <p class="chart-note chart-disclaimer">
    统计来自当前导图，条目包含中心和主题节点；数量不代表视频时长、重要性或观点正确性。切换视图无需重新生成。
  </p>
</div>
