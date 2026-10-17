export interface MapCamera {
  x: number;
  y: number;
  scale: number;
}

export const MIN_MAP_SCALE = 0.01;
export const MAX_MAP_SCALE = 4;

export function clampMapScale(scale: number): number {
  return Math.min(MAX_MAP_SCALE, Math.max(MIN_MAP_SCALE, scale));
}

export function fitMap(
  content: { width: number; height: number },
  viewport: { width: number; height: number },
  margin = 24,
): MapCamera {
  const scale = clampMapScale(
    Math.min(
      1,
      Math.max(1, viewport.width - margin * 2) / content.width,
      Math.max(1, viewport.height - margin * 2) / content.height,
    ),
  );
  return {
    x: (viewport.width - content.width * scale) / 2,
    y: (viewport.height - content.height * scale) / 2,
    scale,
  };
}

/** Start at reading size, keeping the root visible while branches continue right. */
export function readableMap(
  content: { width: number; height: number },
  root: { x: number; y: number; width: number; height: number },
  viewport: { width: number; height: number },
  margin = 20,
): MapCamera {
  const fitted = fitMap(content, viewport, margin);
  if (fitted.scale === 1) return fitted;
  // An unusually long root must still fit inside a narrow side panel.
  const scale = clampMapScale(
    Math.min(
      1,
      Math.max(1, viewport.width - margin * 2) / root.width,
      Math.max(1, viewport.height - margin * 2) / root.height,
    ),
  );
  return {
    x: margin - root.x * scale,
    y: viewport.height / 2 - (root.y + root.height / 2) * scale,
    scale,
  };
}

export function zoomMap(
  camera: MapCamera,
  factor: number,
  anchor: { x: number; y: number },
): MapCamera {
  const scale = clampMapScale(camera.scale * factor);
  const ratio = scale / camera.scale;
  return {
    x: anchor.x - (anchor.x - camera.x) * ratio,
    y: anchor.y - (anchor.y - camera.y) * ratio,
    scale,
  };
}

export function panMap(camera: MapCamera, dx: number, dy: number): MapCamera {
  return { ...camera, x: camera.x + dx, y: camera.y + dy };
}

/** Reveal by panning; opening or focusing nodes never changes the text size. */
export function revealMapRegion(
  camera: MapCamera,
  region: { x: number; y: number; width: number; height: number },
  viewport: { width: number; height: number },
  margin = 16,
): MapCamera {
  if (viewport.width <= 0 || viewport.height <= 0) return camera;
  margin = Math.min(
    margin,
    (viewport.width - 1) / 2,
    (viewport.height - 1) / 2,
  );
  const revealAxis = (
    offset: number,
    start: number,
    size: number,
    space: number,
  ) => {
    const leading = offset + start * camera.scale;
    const extent = size * camera.scale;
    if (extent > space - margin * 2) return margin - start * camera.scale;
    if (leading < margin) return offset + margin - leading;
    if (leading + extent > space - margin)
      return offset + space - margin - leading - extent;
    return offset;
  };
  return {
    x: revealAxis(camera.x, region.x, region.width, viewport.width),
    y: revealAxis(camera.y, region.y, region.height, viewport.height),
    scale: camera.scale,
  };
}
