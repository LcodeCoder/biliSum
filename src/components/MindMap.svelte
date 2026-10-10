<script lang="ts">
  import { tick, untrack } from 'svelte';
  import { on } from 'svelte/events';
  import Icon from './Icon.svelte';
  import {
    expandedMindMapPaths,
    layoutMindMap,
    renderMindMapLayout,
    type MapLayoutMode,
  } from '../lib/mindmap';
  import {
    fitMap,
    panMap,
    revealMapRegion,
    zoomMap,
    type MapCamera,
  } from '../lib/map-view';
  import type { Appearance, MindMapNode } from '../lib/types';

  let {
    tree,
    theme = 'light',
    mode = 'right',
    maxDepth = 1,
  }: {
    tree: MindMapNode;
    theme?: Appearance;
    mode?: MapLayoutMode;
    maxDepth?: number;
  } = $props();
  const initialExpansion = $derived(expandedMindMapPaths(tree, maxDepth));
  let customExpansion = $state<{ basis: Set<string>; paths: Set<string> }>();
  const expandedPaths = $derived(
    customExpansion?.basis === initialExpansion
      ? customExpansion.paths
      : initialExpansion,
  );
  const layout = $derived(layoutMindMap(tree, { mode, expandedPaths }));
  const svg = $derived(
    renderMindMapLayout(layout, tree.title, theme, { interactive: true }),
  );
  let viewport = $state<HTMLDivElement>();
  let camera = $state<MapCamera>({ x: 0, y: 0, scale: 1 });
  let moving = $state(false);
  let fitMode = true;
  let drag: {
    id: number;
    x: number;
    y: number;
    camera: MapCamera;
    moved: boolean;
    path?: string;
  } | null = null;
  let previousBasis: Set<string> | undefined;
  let previousMode: MapLayoutMode | undefined;
  let pendingAnchor: { path: string; x: number; y: number } | null = null;

  function nodeElement(target: EventTarget | null): SVGElement | null {
    if (!(target instanceof Element)) return null;
    const element = target.closest<SVGElement>('.map-node[role="button"]');
    return element && viewport?.contains(element) ? element : null;
  }

  function toggleNode(path: string) {
    const box = layout.nodes.find((node) => node.path === path);
    if (!box?.childCount) return;
    pendingAnchor = {
      path,
      x: camera.x + (box.x + box.width / 2) * camera.scale,
      y: camera.y + (box.y + box.height / 2) * camera.scale,
    };
    const paths = new Set(expandedPaths);
    if (box.expanded) {
      // Reopening always reveals just the next layer, not an old expanded subtree.
      for (const candidate of paths)
        if (candidate === path || candidate.startsWith(path + '.'))
          paths.delete(candidate);
    } else paths.add(path);
    fitMode = false;
    customExpansion = { basis: initialExpansion, paths };
  }

  function fit() {
    if (!viewport || !viewport.clientWidth || !viewport.clientHeight) return;
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
    if (event.button !== 0 || !event.isPrimary || !viewport || drag) return;
    event.preventDefault();
    const node = nodeElement(event.target);
    (node ?? viewport).focus({ preventScroll: true });
    drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      camera: { ...camera },
      moved: false,
      path: node?.dataset.mapPath,
    };
    viewport.setPointerCapture(event.pointerId);
  }

  function move(event: PointerEvent) {
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (Math.hypot(dx, dy) > 6) drag.moved = true;
    if (!drag.moved) return;
    moving = true;
    fitMode = false;
    camera = panMap(drag.camera, dx, dy);
  }

  function end(event?: PointerEvent) {
    if (event && drag && drag.id !== event.pointerId) return;
    const id = drag?.id;
    drag = null;
    moving = false;
    if (id !== undefined && viewport?.hasPointerCapture(id))
      viewport.releasePointerCapture(id);
  }

  function finish(event: PointerEvent) {
    if (!drag || drag.id !== event.pointerId) return;
    const path = drag.path;
    const tapped =
      !drag.moved &&
      Math.hypot(event.clientX - drag.x, event.clientY - drag.y) <= 6;
    end(event);
    if (tapped && path) toggleNode(path);
  }

  function activate(event: MouseEvent) {
    // Physical pointers are handled on pointerup. Assistive technology can
    // activate a focused SVG button with a synthetic click instead.
    if (event.detail !== 0 || drag) return;
    const path = nodeElement(event.target)?.dataset.mapPath;
    if (path) toggleNode(path);
  }

  function focusNode(event: FocusEvent) {
    if (!viewport) return;
    // Browser focus scrolling must not compete with the map camera.
    viewport.scrollLeft = 0;
    viewport.scrollTop = 0;
    const path = nodeElement(event.target)?.dataset.mapPath;
    const box = layout.nodes.find((node) => node.path === path);
    if (!box) return;
    const next = revealMapRegion(camera, box, {
      width: viewport.clientWidth,
      height: viewport.clientHeight,
    });
    if (
      next.x !== camera.x ||
      next.y !== camera.y ||
      next.scale !== camera.scale
    ) {
      fitMode = false;
      camera = next;
    }
  }

  function keyboard(event: KeyboardEvent) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const path = nodeElement(event.target)?.dataset.mapPath;
    if (path && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      if (!event.repeat) toggleNode(path);
      return;
    }
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
    const basis = initialExpansion;
    const currentMode = mode;
    if (!element) return;
    let frame: number | undefined;
    untrack(() => {
      end();
      const anchor = pendingAnchor;
      pendingAnchor = null;
      const box =
        anchor && currentLayout.nodes.find((node) => node.path === anchor.path);
      if (
        anchor &&
        box &&
        previousBasis === basis &&
        previousMode === currentMode
      ) {
        camera = {
          scale: camera.scale,
          x: anchor.x - (box.x + box.width / 2) * camera.scale,
          y: anchor.y - (box.y + box.height / 2) * camera.scale,
        };
        const group = [
          box,
          ...currentLayout.edges
            .filter((edge) => edge.from === box)
            .map((edge) => edge.to),
        ];
        const x = Math.min(...group.map((node) => node.x));
        const y = Math.min(...group.map((node) => node.y));
        camera = revealMapRegion(
          camera,
          {
            x,
            y,
            width: Math.max(...group.map((node) => node.x + node.width)) - x,
            height: Math.max(...group.map((node) => node.y + node.height)) - y,
          },
          { width: element.clientWidth, height: element.clientHeight },
        );
        // Replacing the SVG must not lose the keyboard user's node focus.
        void tick().then(() => {
          if (initialExpansion === basis && viewport === element)
            element
              .querySelector<SVGElement>(`[data-map-path="${box.path}"]`)
              ?.focus({ preventScroll: true });
        });
      } else {
        fitMode = true;
        frame = requestAnimationFrame(fit);
      }
      previousBasis = basis;
      previousMode = currentMode;
    });
    return () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  });

  $effect(() => {
    const element = viewport;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      if (fitMode) fit();
    });
    observer.observe(element);
    return () => observer.disconnect();
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
    onpointerup={finish}
    onclick={activate}
    onpointercancel={end}
    onlostpointercapture={end}
    onkeydown={keyboard}
    onfocusin={focusNode}
    role="application"
    aria-roledescription="思维导图"
    aria-label="思维导图画布，点击父节点或按回车、空格展开收起；滚轮缩放，拖动平移；方向键移动，加减键缩放，Home 复位，1 原始大小"
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
    <span class="map-hint">点击展开 · 滚轮缩放 · 拖动平移</span>
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
