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
  <div class="empty-path" aria-hidden="true">
    <span class="empty-origin"><Icon name="play" size={16} /></span>
    <span class="empty-connector"></span>
    <span class="empty-destination"
      ><Icon name={busy ? 'loader' : icon} size={25} /></span
    >
    <span class="empty-lines"><i></i><i></i><i></i></span>
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
