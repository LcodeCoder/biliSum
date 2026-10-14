import type { SubtitleCue, Transcript } from './types';

export function formatTime(value: number, forceHours = false): string {
  const seconds = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = String(seconds % 60).padStart(2, '0');
  return hours || forceHours
    ? String(hours).padStart(2, '0') +
        ':' +
        String(minutes).padStart(2, '0') +
        ':' +
        rest
    : String(minutes).padStart(2, '0') + ':' + rest;
}

export function normalizeCues(items: unknown[]): SubtitleCue[] {
  return items
    .flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const cue = item as Record<string, unknown>;
      if (
        ![cue.from, cue.to].every(
          (value) =>
            (typeof value === 'number' ||
              (typeof value === 'string' && value.trim() !== '')) &&
            Number.isFinite(Number(value)),
        )
      )
        return [];
      const from = Number(cue.from),
        to = Number(cue.to);
      const content =
        typeof cue.content === 'string'
          ? cue.content.replace(/\r/g, '').trim()
          : '';
      if (
        !Number.isFinite(from) ||
        !Number.isFinite(to) ||
        from < 0 ||
        to <= from ||
        !content
      )
        return [];
      return [{ from, to, content }];
    })
    .sort((a, b) => a.from - b.from);
}

export function transcriptText(transcript: Transcript): string {
  return transcript.cues
    .map(
      (cue) =>
        (transcript.timed ? '[' + formatTime(cue.from, true) + '] ' : '') +
        cue.content,
    )
    .join('\n');
}

function srtTime(seconds: number): string {
  const milliseconds = Math.round(Math.max(0, seconds) * 1000);
  return (
    formatTime(Math.floor(milliseconds / 1000), true) +
    ',' +
    String(milliseconds % 1000).padStart(3, '0')
  );
}

export function exportSrt(transcript: Transcript): string {
  if (!transcript.timed)
    throw new Error('这份纯文本字幕没有时间轴，请下载 TXT 格式。');
  return transcript.cues
    .map(
      (cue, index) =>
        String(index + 1) +
        '\n' +
        srtTime(cue.from) +
        ' --> ' +
        srtTime(cue.to) +
        '\n' +
        cue.content +
        '\n',
    )
    .join('\n');
}

function parseTimestamp(input: string): number {
  if (!/^(?:\d{1,3}:)?[0-5]\d:[0-5]\d[.,]\d{1,3}$/.test(input)) return NaN;
  const parts = input.replace(',', '.').split(':').map(Number);
  return parts.length === 3
    ? parts[0]! * 3600 + parts[1]! * 60 + parts[2]!
    : parts[0]! * 60 + parts[1]!;
}

export function importTranscript(text: string, filename: string): Transcript {
  const raw = text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .trim();
  if (!raw) throw new Error('所选文件为空。');
  if (raw.length > 2_000_000)
    throw new Error('字幕文件较大，请选择 2 MB 以内的文本文件。');
  const source = '导入：' + filename;
  if (/\.json$/i.test(filename)) {
    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error('JSON 字幕格式有误。');
    }
    const body = Array.isArray(data) ? data : data?.body;
    if (!Array.isArray(body))
      throw new Error('JSON 中需要 body 数组，每条包含 from、to、content。');
    const cues = normalizeCues(body);
    if (!cues.length)
      throw new Error('JSON 中需要 body 数组，每条包含 from、to、content。');
    return { cues, source, timed: true };
  }
  const timedFile = /\.(srt|vtt)$/i.test(filename);
  if (timedFile || (!/\.txt$/i.test(filename) && /-->/u.test(raw))) {
    const cues: SubtitleCue[] = [];
    const pattern =
      /^((?:\d{1,3}:)?\d{2}:\d{2}[.,]\d{1,3})\s*-->\s*((?:\d{1,3}:)?\d{2}:\d{2}[.,]\d{1,3})[^\n]*\n([\s\S]*?)(?=\n\s*\n|(?![\s\S]))/gm;
    for (const match of raw.matchAll(pattern)) {
      cues.push({
        from: parseTimestamp(match[1]!),
        to: parseTimestamp(match[2]!),
        content: match[3]!.replace(/<[^>]*>/g, '').trim(),
      });
    }
    const normalized = normalizeCues(cues);
    if (!normalized.length)
      throw new Error('未识别到时间轴，请使用标准 SRT 或 VTT 文件。');
    return { cues: normalized, source, timed: true };
  }
  const cues = raw
    .split(/\n+/)
    .filter((line) => line.trim())
    .map((content) => ({ from: 0, to: 0, content: content.trim() }));
  return { cues, source, timed: false };
}

// Split without discarding any subtitle text, even when one cue exceeds the budget.
export function chunkTranscript(
  transcript: Transcript,
  budget = 14000,
): string[] {
  if (!Number.isSafeInteger(budget) || budget < 100)
    throw new Error('字幕分段长度过小。');
  const chunks: string[] = [];
  let current = '';
  for (const cue of transcript.cues) {
    const prefix = transcript.timed
      ? '[' + formatTime(cue.from, true) + '] '
      : '';
    let remaining = cue.content;
    do {
      let space = budget - prefix.length - 1;
      // Keep Unicode surrogate pairs together at the request boundary.
      const last = remaining.charCodeAt(space - 1);
      const next = remaining.charCodeAt(space);
      if (last >= 0xd800 && last <= 0xdbff && next >= 0xdc00 && next <= 0xdfff)
        space--;
      const part = remaining.slice(0, space);
      remaining = remaining.slice(part.length);
      const line = prefix + part;
      if (current && current.length + line.length + 1 > budget) {
        chunks.push(current);
        current = '';
      }
      current += (current ? '\n' : '') + line;
    } while (remaining);
  }
  if (current) chunks.push(current);
  return chunks;
}

export async function transcriptHash(transcript: Transcript): Promise<string> {
  const input = JSON.stringify([
    transcript.timed,
    transcript.source,
    transcript.cues.map(({ from, to, content }) => [from, to, content]),
  ]);
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(input),
  );
  return (
    'sha256:' +
    Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('')
  );
}
