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

/** Bring a newly revealed parent/child group into view without zooming in. */
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
  const scale = clampMapScale(
    Math.min(
      camera.scale,
      (viewport.width - margin * 2) / region.width,
      (viewport.height - margin * 2) / region.height,
    ),
  );
  const next =
    scale === camera.scale
      ? { ...camera }
      : zoomMap(camera, scale / camera.scale, {
          x: camera.x + (region.x + region.width / 2) * camera.scale,
          y: camera.y + (region.y + region.height / 2) * camera.scale,
        });
  const left = next.x + region.x * scale;
  const top = next.y + region.y * scale;
  next.x +=
    Math.max(0, margin - left) -
    Math.max(0, left + region.width * scale - viewport.width + margin);
  next.y +=
    Math.max(0, margin - top) -
    Math.max(0, top + region.height * scale - viewport.height + margin);
  return next;
}
