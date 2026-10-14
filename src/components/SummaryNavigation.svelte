<script lang="ts">
  import Icon from './Icon.svelte';
  let {
    html,
    onjump,
    ontop,
  }: {
    html: string;
    onjump: (index: number) => void;
    ontop: () => void;
  } = $props();
  let query = $state('');
  let selected = $state('');
  $effect(() => {
    html;
    query = '';
    selected = '';
  });
  const headings = $derived.by(() => {
    const document = new DOMParser().parseFromString(html, 'text/html');
    return [...document.querySelectorAll('h1, h2, h3')].map(
      (element, index) => ({
        index,
        title: element.textContent?.trim() || '未命名章节',
      }),
    );
  });
  const matches = $derived(
    headings.filter((heading) =>
      heading.title
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()),
    ),
  );
</script>

{#if headings.length}
  <div class="reading-navigation" aria-label="笔记章节定位">
    <div class="control-field compact-control">
      <Icon name="search" size={15} />
      <input
        class="form-control"
        type="search"
        bind:value={query}
        placeholder="查找章节"
        aria-label="查找笔记章节"
        oninput={() => (selected = '')}
      />
      {#if query}<button
          class="icon-button tiny"
          onclick={() => {
            query = '';
            selected = '';
          }}
          aria-label="清空章节搜索"><Icon name="x" size={13} /></button
        >{/if}
    </div>
    <select
      class="form-control compact-control"
      aria-label="跳转笔记章节"
      bind:value={selected}
      disabled={!matches.length}
      onchange={(event) => {
        if (event.currentTarget.value !== '')
          onjump(Number(event.currentTarget.value));
      }}
    >
      <option value=""
        >{matches.length ? `章节 · ${matches.length}` : '没有匹配章节'}</option
      >
      {#each matches as heading (heading.index)}<option
          value={String(heading.index)}>{heading.title}</option
        >{/each}
    </select>
    <button
      class="icon-button small"
      onclick={ontop}
      aria-label="返回笔记顶部"
      title="返回顶部"><Icon name="up" size={16} /></button
    >
  </div>
{/if}
