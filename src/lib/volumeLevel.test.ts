import { describe, expect, it } from "vitest";
import {
  VOLUME_MAX,
  VOLUME_MIN,
  VOLUME_STEP,
  clampVolume,
  parseVolumeInput,
  stepVolume,
} from "./volumeLevel";

describe("clampVolume", () => {
  it("passes every whole percent through untouched", () => {
    // The point of the plain track: what the slider says is what the player
    // gets, at every one of the hundred positions.
    for (let v = VOLUME_MIN; v <= VOLUME_MAX; v += 1) expect(clampVolume(v)).toBe(v);
  });

  it("rounds to a whole percent", () => {
    expect(clampVolume(64.4)).toBe(64);
    expect(clampVolume(64.6)).toBe(65);
  });

  it("clamps anything out of range", () => {
    expect(clampVolume(-20)).toBe(0);
    expect(clampVolume(500)).toBe(100);
    expect(clampVolume(Number.NaN)).toBe(0);
  });
});

describe("stepVolume", () => {
  it("moves up and back down to where it started", () => {
    const up = stepVolume(40, VOLUME_STEP);
    expect(up).toBe(45);
    expect(stepVolume(up, -VOLUME_STEP)).toBe(40);
  });

  it("stops at the ends rather than running off them", () => {
    expect(stepVolume(0, -VOLUME_STEP)).toBe(0);
    expect(stepVolume(100, VOLUME_STEP)).toBe(100);
    expect(stepVolume(2, -VOLUME_STEP)).toBe(0);
    expect(stepVolume(98, VOLUME_STEP)).toBe(100);
  });
});

describe("parseVolumeInput", () => {
  it("takes a number", () => {
    expect(parseVolumeInput("65")).toBe(65);
    expect(parseVolumeInput("0")).toBe(0);
    expect(parseVolumeInput("100")).toBe(100);
  });

  it("takes what someone would actually type or paste", () => {
    expect(parseVolumeInput(" 65 ")).toBe(65);
    expect(parseVolumeInput("65%")).toBe(65);
    expect(parseVolumeInput("64.6")).toBe(65);
  });

  it("clamps a number past either end", () => {
    expect(parseVolumeInput("140")).toBe(100);
    expect(parseVolumeInput("-5")).toBe(0);
  });

  it("leaves the volume alone for anything that isn't a number yet", () => {
    // Half-typed states. Reading these as zero would silence the room between
    // keystrokes.
    expect(parseVolumeInput("")).toBeNull();
    expect(parseVolumeInput("  ")).toBeNull();
    expect(parseVolumeInput("-")).toBeNull();
    expect(parseVolumeInput("%")).toBeNull();
    expect(parseVolumeInput("loud")).toBeNull();
  });
});
