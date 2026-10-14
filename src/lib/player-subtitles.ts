import type { SubtitleCue } from './types';

// Self-contained: Chrome serializes this function into the video's isolated world.
export function renderPlayerSubtitles(
  identity: { bvid: string; aid: number; page: number } | null,
  cues: SubtitleCue[],
) {
  const scope = window as typeof window & {
    __biliSumSubtitles?: { dispose: () => void };
  };
  scope.__biliSumSubtitles?.dispose();
  delete scope.__biliSumSubtitles;
  if (!identity) return true;
  const matches = () => {
    const id = /\/video\/(BV[a-zA-Z0-9]{10}|av[0-9]+)/.exec(
      location.pathname,
    )?.[1];
    return (
      !!id &&
      [identity.bvid, 'av' + identity.aid].includes(id) &&
      Number(new URL(location.href).searchParams.get('p') || 1) ===
        identity.page
    );
  };
  if (!matches()) return false;
  let player: HTMLVideoElement | null = null;
  let track: TextTrack | null = null;
  let timer: ReturnType<typeof setInterval>;
  const clear = () => {
    if (track) {
      track.mode = 'hidden';
      for (const cue of Array.from(track.cues || [])) track.removeCue(cue);
      track.mode = 'disabled';
    }
    track = null;
    player = null;
  };
  const dispose = () => {
    clearInterval(timer);
    clear();
    window.removeEventListener('pagehide', dispose);
  };
  const update = () => {
    if (!matches()) {
      dispose();
      return;
    }
    const next = document.querySelector('video');
    if (next === player) return;
    clear();
    if (!next) return;
    player = next;
    track =
      Array.from(player.textTracks).find((item) => item.label === 'biliSum') ||
      player.addTextTrack('subtitles', 'biliSum', 'zh');
    for (const cue of cues) {
      if (
        !Number.isFinite(cue.from) ||
        !Number.isFinite(cue.to) ||
        cue.from < 0 ||
        cue.to <= cue.from ||
        !cue.content.trim()
      )
        continue;
      // Escape WebVTT markup so imported text remains literal.
      const text = cue.content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      track.addCue(new VTTCue(cue.from, cue.to, text));
    }
    track.mode = 'showing';
  };
  update();
  timer = setInterval(update, 250);
  window.addEventListener('pagehide', dispose);
  scope.__biliSumSubtitles = { dispose };
  return true;
}
