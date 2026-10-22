import { deriveNodes, isValidNodes } from "./nodes";
import { DEFAULT_BPM, stepToTime } from "./tempo";
import type { Track, TrackInput, TimelineState } from "./types";

/** Empty space kept after the furthest point so it isn't flush with the right edge. */
export const END_PADDING_SECONDS = 2;

export const DEFAULT_BPM_MIN = 0;
export const DEFAULT_BPM_MAX = 240;

/** Hard limits for the editable BPM range: every BPM must stay positive (playback divides by it). */
export const BPM_RANGE_FLOOR = 1;
export const BPM_RANGE_CEIL = 999;
/** Smallest allowed bpmMax - bpmMin. */
export const MIN_BPM_SPAN = 10;

/**
 * Makes a requested BPM range valid: rounds to whole BPM, keeps it inside
 * [BPM_RANGE_FLOOR, BPM_RANGE_CEIL] and at least MIN_BPM_SPAN wide. `edited` says which end the
 * user changed, so that end wins and the other one moves to keep the span (e.g. raising min past
 * max pushes max up). Returns null for non-finite input.
 */
export function normalizeBpmRange(
  bpmMin: number,
  bpmMax: number,
  edited: "min" | "max" = "max",
): { bpmMin: number; bpmMax: number } | null {
  if (!Number.isFinite(bpmMin) || !Number.isFinite(bpmMax)) return null;
  const clampTo = (n: number, lo: number, hi: number) =>
    Math.min(hi, Math.max(lo, Math.round(n)));
  if (edited === "min") {
    const min = clampTo(bpmMin, BPM_RANGE_FLOOR, BPM_RANGE_CEIL - MIN_BPM_SPAN);
    return {
      bpmMin: min,
      bpmMax: clampTo(
        Math.max(bpmMax, min + MIN_BPM_SPAN),
        min + MIN_BPM_SPAN,
        BPM_RANGE_CEIL,
      ),
    };
  }
  const max = clampTo(bpmMax, BPM_RANGE_FLOOR + MIN_BPM_SPAN, BPM_RANGE_CEIL);
  return {
    bpmMin: clampTo(
      Math.min(bpmMin, max - MIN_BPM_SPAN),
      BPM_RANGE_FLOOR,
      max - MIN_BPM_SPAN,
    ),
    bpmMax: max,
  };
}

/** Step of the track's last point (every line starts at step 0). */
export function trackLastStep(track: Pick<Track, "bpms">): number {
  return track.bpms.length - 1;
}

/** Header order: alphabetically by name, then id so it's total. Every line starts at step 0. */
export function compareTracks(a: Track, b: Track): number {
  return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
}

export function getOrderedTracks(state: TimelineState): Track[] {
  return Object.values(state.tracks).sort(compareTracks);
}

/** Step of the furthest last point over all tracks (0 for an empty timeline). */
export function getContentEndStep(state: TimelineState): number {
  let end = 0;
  for (const track of Object.values(state.tracks))
    end = Math.max(end, trackLastStep(track));
  return end;
}

/** Scrollable length of the timeline, in seconds: furthest last point plus padding. */
export function getTimelineDuration(state: TimelineState): number {
  return (
    stepToTime(getContentEndStep(state), state.projectBpm) + END_PADDING_SECONDS
  );
}

/** Clamps a BPM into the drawable range. Only the renderer clamps; the model keeps raw values. */
export function clampBpm(bpm: number, bpmMin: number, bpmMax: number): number {
  return Math.min(bpmMax, Math.max(bpmMin, bpm));
}

/** Vertical position as a 0–1 fraction of the lane area (0 = top = bpmMax), clamped. */
export function bpmToFraction(
  bpm: number,
  bpmMin: number,
  bpmMax: number,
): number {
  return (bpmMax - clampBpm(bpm, bpmMin, bpmMax)) / (bpmMax - bpmMin);
}

export type TimelineOptions = {
  projectBpm?: number;
  bpmMin?: number;
  bpmMax?: number;
};

/**
 * Builds normalized, validated state from a flat list. BPM values are not clamped here.
 * Tracks without `nodes` get them derived from their points (see deriveNodes).
 */
export function createTimelineState(
  tracks: TrackInput[],
  options: TimelineOptions = {},
): TimelineState {
  const {
    projectBpm = DEFAULT_BPM,
    bpmMin = DEFAULT_BPM_MIN,
    bpmMax = DEFAULT_BPM_MAX,
  } = options;
  if (!(projectBpm > 0) || !Number.isFinite(projectBpm))
    throw new Error(`Invalid BPM ${projectBpm}`);
  if (
    !Number.isFinite(bpmMin) ||
    !Number.isFinite(bpmMax) ||
    !(bpmMin < bpmMax)
  ) {
    throw new Error(`Invalid BPM range [${bpmMin}, ${bpmMax}]`);
  }
  const state: TimelineState = { tracks: {}, projectBpm, bpmMin, bpmMax };
  for (const t of tracks) {
    if (state.tracks[t.id]) throw new Error(`Duplicate track id ${t.id}`);
    if (t.bpms.length === 0) throw new Error(`Track ${t.id} has no points`);
    if (!t.bpms.every(Number.isFinite))
      throw new Error(`Non-finite BPM on ${t.id}`);
    const nodes = t.nodes ?? deriveNodes(t.bpms);
    if (!isValidNodes(nodes, t.bpms.length))
      throw new Error(`Invalid nodes on ${t.id}`);
    state.tracks[t.id] = { ...t, nodes };
  }
  return state;
}

/** A model with no tracks and the default project BPM and BPM range. */
export function createEmptyTimelineState(): TimelineState {
  return createTimelineState([]);
}
