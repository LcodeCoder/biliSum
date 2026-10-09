<script lang="ts">
  import { untrack } from 'svelte';
  import { on } from 'svelte/events';
  import Icon from './Icon.svelte';
  import {
    layoutMindMap,
    renderMindMapLayout,
    type MapLayoutMode,
  } from '../lib/mindmap';
  import { fitMap, panMap, zoomMap, type MapCamera } from '../lib/map-view';
  import type { MindMapNode } from '../lib/types';

  let {
    tree,
    theme = 'light',
    mode = 'right',
    maxDepth = 1,
  }: {
    tree: MindMapNode;
    theme?: 'light' | 'dark';
    mode?: MapLayoutMode;
    maxDepth?: number;
  } = $props();
  const layout = $derived(layoutMindMap(tree, { mode, maxDepth }));
  const svg = $derived(renderMindMapLayout(layout, tree.title, theme));
  let viewport = $state<HTMLDivElement>();
  let camera = $state<MapCamera>({ x: 0, y: 0, scale: 1 });
  let moving = $state(false);
  let fitMode = true;
  let drag: { id: number; x: number; y: number; camera: MapCamera } | null =
    null;

  function fit() {
    if (!viewport) return;
    camera = fitMap(layout, {
      width: viewport.clientWidth,
      height: viewport.clientHeight,
    });
    fitMode = true;
  }

  function readSize() {
    if (!viewport) return;
    const root = layout.nodes[0]!;
    camera = {
      x: viewport.clientWidth / 2 - root.x - root.width / 2,
      y: viewport.clientHeight / 2 - root.y - root.height / 2,
      scale: 1,
    };
    fitMode = false;
  }

  function zoom(factor: number, anchor?: { x: number; y: number }) {
    if (!viewport) return;
    fitMode = false;
    camera = zoomMap(
      camera,
      factor,
      anchor ?? {
        x: viewport.clientWidth / 2,
        y: viewport.clientHeight / 2,
      },
    );
  }

  function wheel(event: WheelEvent) {
    if (!viewport) return;
    event.preventDefault();
    const rect = viewport.getBoundingClientRect();
    const unit =
      event.deltaMode === 1
        ? 16
        : event.deltaMode === 2
          ? viewport.clientHeight
          : 1;
    const delta = Math.max(-240, Math.min(240, event.deltaY * unit));
    zoom(Math.exp(-delta * 0.0022), {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  }

  function start(event: PointerEvent) {
    if (event.button !== 0 || !viewport || drag) return;
    event.preventDefault();
    viewport.focus({ preventScroll: true });
    fitMode = false;
    drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      camera: { ...camera },
    };
    moving = true;
    viewport.setPointerCapture(event.pointerId);
  }

  function move(event: PointerEvent) {
    if (!drag || drag.id !== event.pointerId) return;
    camera = panMap(
      drag.camera,
      event.clientX - drag.x,
      event.clientY - drag.y,
    );
  }

  function end(event?: PointerEvent) {
    if (event && drag && drag.id !== event.pointerId) return;
    const id = drag?.id;
    drag = null;
    moving = false;
    if (id !== undefined && viewport?.hasPointerCapture(id))
      viewport.releasePointerCapture(id);
  }

  function keyboard(event: KeyboardEvent) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const step = event.shiftKey ? 80 : 32;
    const direction: Record<string, [number, number]> = {
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    };
    const movement = direction[event.key];
    if (movement) {
      event.preventDefault();
      fitMode = false;
      camera = panMap(camera, movement[0], movement[1]);
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      zoom(1.2);
    } else if (event.key === '-') {
      event.preventDefault();
      zoom(1 / 1.2);
    } else if (event.key === '1') {
      event.preventDefault();
      readSize();
    } else if (event.key === 'Home' || event.key === '0') {
      event.preventDefault();
      fit();
    }
  }

  $effect(() => {
    const element = viewport;
    const currentLayout = layout;
    if (!element || !currentLayout) return;
    untrack(() => {
      end();
      fitMode = true;
    });
    const observer = new ResizeObserver(() => {
      if (fitMode) fit();
    });
    observer.observe(element);
    const frame = requestAnimationFrame(fit);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  });

  $effect(() => {
    if (!viewport) return;
    return on(viewport, 'wheel', wheel, { passive: false });
  });
</script>

<div class="map-shell">
  <!-- The map implements pointer and keyboard camera controls. -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
  <div
    class="map-viewport"
    class:moving
    bind:this={viewport}
    onpointerdown={start}
    onpointermove={move}
    onpointerup={end}
    onpointercancel={end}
    onlostpointercapture={end}
    onkeydown={keyboard}
    role="application"
    aria-roledescription="思维导图"
    aria-label="思维导图画布，滚轮缩放，拖动平移；方向键移动，加减键缩放，Home 复位，1 原始大小"
    tabindex="0"
  >
    <div
      class="map-drawing"
      style:width={layout.width + 'px'}
      style:height={layout.height + 'px'}
      style:transform={'translate(' +
        camera.x +
        'px, ' +
        camera.y +
        'px) scale(' +
        camera.scale +
        ')'}
    >
      {@html svg}
    </div>
  </div>
  {#if camera.scale < 0.55}
    <p class="map-readability-hint">字太小？选择单个主题，或切换大纲阅读。</p>
  {/if}
  <div class="map-controls">
    <span class="map-hint">滚轮缩放 · 拖动平移</span>
    <div class="zoom-tools">
      <button
        class="icon-button small"
        onclick={() => zoom(1 / 1.2)}
        aria-label="缩小导图"
        title="缩小（−）"><Icon name="minus" size={15} /></button
      >
      <button
        class="zoom-value"
        onclick={readSize}
        aria-label="原始大小阅读"
        title="原始大小（1），拖动查看细节"
        >{Math.round(camera.scale * 100)}%</button
      >
      <button
        class="icon-button small"
        onclick={() => zoom(1.2)}
        aria-label="放大导图"
        title="放大（+）"><Icon name="plus" size={15} /></button
      >
      <button
        class="icon-button small"
        onclick={fit}
        aria-label="适应画布"
        title="适应画布（Home）"
      >
        <Icon name="fit" size={16} />
      </button>
    </div>
  </div>
</div>
