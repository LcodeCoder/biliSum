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
