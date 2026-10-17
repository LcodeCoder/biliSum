<script lang="ts">
  import Icon from './Icon.svelte';
  let {
    icon,
    title,
    description,
    busy = false,
    action = '',
    disabled = false,
    onaction,
  }: {
    icon: string;
    title: string;
    description: string;
    busy?: boolean;
    action?: string;
    disabled?: boolean;
    onaction?: () => void;
  } = $props();
</script>

<div class="empty-state workspace-empty" aria-busy={busy}>
  <div class="empty-illustration" aria-hidden="true">
    <svg class="empty-doodle" viewBox="0 0 196 106" fill="none">
      <path d="m101 18 58 3-4 69-59-3Z" class="doodle-paper" />
      <path d="m111 17 2-8 32 3-1 10Z" class="doodle-tape" />
      <path d="m19 40 45-3 3 33-45 4Z" class="doodle-teal" />
      <path d="m36 46 14 9-13 9Z" class="doodle-ink" />
      <path d="M73 51q11-8 20-1m-5-6 6 6-7 5" class="doodle-ink" />
      <path d="m110 68 30 2m-31 7 24 2m-23 7 18 1" class="doodle-ink" />
      <path
        d="m174 24 3 7 8 1-6 5 1 8-7-4-7 3 2-8-5-6 8 1Z"
        class="doodle-star"
      />
      <path
        d="m19 20 2 8m-6-3 10-2M168 75l6-3m-2 10 8 3M37 88q17 6 30-1"
        class="doodle-ink"
      />
    </svg>
    <span class="empty-doodle-icon"
      ><Icon name={busy ? 'loader' : icon} size={24} /></span
    >
  </div>
  <h2>{title}</h2>
  {#if description}<p>{description}</p>{/if}
  {#if action && onaction}
    <button class="text-button primary-button" onclick={onaction} {disabled}
      >{action}<Icon name="arrow" size={15} /></button
    >
  {/if}
  {#if busy}<div class="loading-lines" aria-hidden="true">
      <i></i><i></i><i></i>
    </div>{/if}
</div>
