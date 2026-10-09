import type { DetailLevel } from './detail';

export interface VideoLocator {
  bvid?: string;
  aid?: number;
  page: number;
  url: string;
  key: string;
}

export interface VideoInfo {
  aid: number;
  bvid: string;
  cid: number;
  page: number;
  title: string;
  part: string;
  owner: string;
  duration: number;
  cover: string;
  description: string;
  url: string;
}

export interface SubtitleTrack {
  id: string;
  language: string;
  label: string;
  url: string;
}
export interface SubtitleCue {
  from: number;
  to: number;
  content: string;
}
export interface Transcript {
  cues: SubtitleCue[];
  timed: boolean;
  source: string;
}
export interface MindMapNode {
  title: string;
  children: MindMapNode[];
}
export interface ResultMeta {
  detailLevel?: DetailLevel;
  model: string;
  createdAt: string;
  source: string;
}
export interface SummaryResult extends ResultMeta {
  incomplete?: boolean;
  markdown: string;
}
export interface MapResult extends ResultMeta {
  tree: MindMapNode;
}
export interface SavedResults {
  sourceHash: string;
  summary: SummaryResult | null;
  map: MapResult | null;
}
export type Theme = 'system' | 'light' | 'dark';
export interface Settings {
  apiBaseUrl: string;
  apiKey: string;
  model: string;
  theme: Theme;
  detailLevel: DetailLevel;
}
export type GenerationKind = 'map' | 'summary';
export interface ApiOptions {
  signal?: AbortSignal;
  fetcher?: typeof fetch;
}
