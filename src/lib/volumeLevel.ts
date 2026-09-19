/**
 * The slider's travel is the player's volume, one step per percent.
 *
 * It used to be a curve: perceived loudness is closer to logarithmic than
 * linear, so a squared taper spent most of the track on the quiet levels a
 * session actually wants. What that cost was the ability to say a number. The
 * rungs were the only levels the control could reach, so the readout skipped —
 * 63, 66, 69 — and there was no way to ask for 65. A listener setting music
 * under a conversation is matching it against a room, and wants the level they
 * landed on last week, not the nearest rung to it.
 *
 * So the track is plain now, and the two controls beside it do the work the
 * taper used to. The steppers move in whole percent, which lands exactly. And
 * the readout is an input: type 65 and the volume is 65.
 */

/** The quietest and loudest the player goes. */
export const VOLUME_MIN = 0;
export const VOLUME_MAX = 100;

/**
 * How far one press of the quieter/louder buttons moves, in percent. Small
 * enough to be a fine adjustment, large enough that crossing the range is a
 * handful of presses rather than a hundred.
 */
export const VOLUME_STEP = 5;

/** Any number to a volume the player will take: a whole percent, 0-100. */
export function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return VOLUME_MIN;
  return Math.min(VOLUME_MAX, Math.max(VOLUME_MIN, Math.round(value)));
}

/** The volume `delta` percent away from this one, held inside the range. */
export function stepVolume(volume: number, delta: number): number {
  return clampVolume(clampVolume(volume) + delta);
}

/**
 * What someone typed into the readout, as a volume — or null if it isn't one
 * yet. Null covers the half-finished states a field passes through while it is
 * being typed into (empty, a lone minus sign), which must leave the volume
 * alone rather than dropping it to silence mid-keystroke.
 */
export function parseVolumeInput(raw: string): number | null {
  // A pasted "65%" is obviously a volume, and so is a stray space.
  const text = raw.trim().replace(/%$/, "").trim();
  if (!text) return null;
  const value = Number(text);
  if (!Number.isFinite(value)) return null;
  return clampVolume(value);
}
