import { describe, expect, it } from "vitest";
import {
  AdvancerCandidate,
  PRESENCE_TTL_MS,
  hasOtherGmRunning,
  hasPanelOpen,
  isAdvancer,
} from "./advancer";

const NOW = 1_700_000_000_000;

function member(
  id: string,
  role: "GM" | "PLAYER",
  presentAt: number | null = NOW,
  connectionId = id
): AdvancerCandidate {
  return { id, connectionId, role, presentAt };
}

describe("hasPanelOpen", () => {
  it("is false for a player who has never checked in", () => {
    expect(hasPanelOpen(member("a", "PLAYER", null), NOW)).toBe(false);
  });

  it("is true for a fresh heartbeat", () => {
    expect(hasPanelOpen(member("a", "PLAYER", NOW - 1000), NOW)).toBe(true);
  });

  it("is false once the heartbeat is older than the TTL", () => {
    expect(hasPanelOpen(member("a", "PLAYER", NOW - PRESENCE_TTL_MS - 1), NOW)).toBe(false);
  });

  it("tolerates a single missed beat", () => {
    // The interval is a third of the TTL, so one drop must not unseat anyone.
    expect(hasPanelOpen(member("a", "PLAYER", NOW - PRESENCE_TTL_MS / 2), NOW)).toBe(true);
  });
});

describe("hasOtherGmRunning", () => {
  it("spots another GM window with its panel open", () => {
    expect(hasOtherGmRunning([member("gm", "GM")], NOW)).toBe(true);
  });

  it("stays quiet for a GM window with its panel closed", () => {
    expect(hasOtherGmRunning([member("gm", "GM", null)], NOW)).toBe(false);
  });

  it("stays quiet for players", () => {
    expect(hasOtherGmRunning([member("p1", "PLAYER")], NOW)).toBe(false);
  });
});

describe("isAdvancer", () => {
  it("elects the GM", () => {
    expect(
      isAdvancer({ isGM: true, isDJ: false, connectionId: "gm", djIds: [], party: [], now: NOW })
    ).toBe(true);
  });

  it("stands a DJ down for a GM who is running the panel", () => {
    expect(
      isAdvancer({
        isGM: false,
        isDJ: true,
        connectionId: "dj1",
        djIds: ["dj1"],
        party: [member("gm", "GM")],
        now: NOW,
      })
    ).toBe(false);
  });

  // The bug this whole mechanism exists for: a GM sitting in the room with the
  // popover closed cannot advance anything, and used to block every DJ too.
  it("promotes a DJ when the GM is present but has the panel closed", () => {
    expect(
      isAdvancer({
        isGM: false,
        isDJ: true,
        connectionId: "dj1",
        djIds: ["dj1"],
        party: [member("gm", "GM", NOW - PRESENCE_TTL_MS - 1)],
        now: NOW,
      })
    ).toBe(true);
  });

  it("promotes a DJ when the GM has never opened the panel", () => {
    expect(
      isAdvancer({
        isGM: false,
        isDJ: true,
        connectionId: "dj1",
        djIds: ["dj1"],
        party: [member("gm", "GM", null)],
        now: NOW,
      })
    ).toBe(true);
  });

  it("refuses a listener who holds no DJ grant", () => {
    expect(
      isAdvancer({
        isGM: false,
        isDJ: false,
        connectionId: "p1",
        djIds: ["dj1"],
        party: [member("dj1", "PLAYER")],
        now: NOW,
      })
    ).toBe(false);
  });

  describe("with several DJs and no GM running", () => {
    const djIds = ["dj-a", "dj-b", "dj-c"];

    it("elects exactly one — the lowest-sorted id", () => {
      // Run the election from each DJ's own point of view; a client never
      // sees itself in `party`. Exactly one must answer yes, or the queue
      // skips several tracks on a single "ended" event.
      const elected = djIds.filter((id) =>
        isAdvancer({
          isGM: false,
          isDJ: true,
          connectionId: id,
          djIds,
          party: djIds.filter((other) => other !== id).map((other) => member(other, "PLAYER")),
          now: NOW,
        })
      );
      expect(elected).toEqual(["dj-a"]);
    });

    it("hands over when the lowest-sorted DJ closes their panel", () => {
      expect(
        isAdvancer({
          isGM: false,
          isDJ: true,
          connectionId: "dj-b",
          djIds,
          party: [member("dj-a", "PLAYER", NOW - PRESENCE_TTL_MS - 1), member("dj-c", "PLAYER")],
          now: NOW,
        })
      ).toBe(true);
    });
  });

  it("ignores a running player whose DJ grant was revoked", () => {
    expect(
      isAdvancer({
        isGM: false,
        isDJ: true,
        connectionId: "dj-z",
        djIds: ["dj-z"],
        // "dj-a" sorts first but is no longer in djIds, so must not win.
        party: [member("dj-a", "PLAYER")],
        now: NOW,
      })
    ).toBe(true);
  });

  it("refuses when this client has no id yet", () => {
    expect(
      isAdvancer({ isGM: true, isDJ: true, connectionId: null, djIds: [], party: [], now: NOW })
    ).toBe(false);
  });

  describe("with one account open in several windows", () => {
    const windows = ["conn-a", "conn-b", "conn-c"];

    function electedAmong(role: "GM" | "PLAYER", presentAt: (window: string) => number | null) {
      return windows.filter((window) =>
        isAdvancer({
          isGM: role === "GM",
          isDJ: role === "PLAYER",
          connectionId: window,
          djIds: ["me"],
          party: windows
            .filter((other) => other !== window)
            .map((other) => member("me", role, presentAt(other), other)),
          now: NOW,
        })
      );
    }

    // The bug: every GM window elected itself, so each published its own
    // position over the others' and the whole room chased them.
    it("elects exactly one of a GM's windows", () => {
      expect(electedAmong("GM", () => NOW)).toEqual(["conn-a"]);
    });

    it("elects exactly one of a DJ's windows", () => {
      expect(electedAmong("PLAYER", () => NOW)).toEqual(["conn-a"]);
    });

    it("passes over a window whose panel is closed", () => {
      const presentAt = (window: string) => (window === "conn-a" ? null : NOW);
      // conn-a isn't running, so its own answer is moot; what matters is that
      // the running windows agree on one successor between them.
      expect(electedAmong("GM", presentAt).filter((w) => w !== "conn-a")).toEqual(["conn-b"]);
    });
  });

  describe("with a window picked as primary", () => {
    const windows = ["conn-a", "conn-b"];

    function elected(primaryConnectionId: string, presentAt: number | null = NOW) {
      return windows.filter((window) =>
        isAdvancer({
          isGM: true,
          isDJ: false,
          connectionId: window,
          djIds: [],
          primaryConnectionId,
          party: windows
            .filter((other) => other !== window)
            .map((other) => member("gm", "GM", presentAt, other)),
          now: NOW,
        })
      );
    }

    it("hands the job to the picked window over the one that sorts first", () => {
      expect(elected("conn-b")).toEqual(["conn-b"]);
    });

    it("falls back to the automatic choice when the pick has gone", () => {
      expect(elected("conn-gone")).toEqual(["conn-a"]);
    });

    it("lapses once the picked window's panel closes", () => {
      expect(
        isAdvancer({
          isGM: true,
          isDJ: false,
          connectionId: "conn-a",
          djIds: [],
          primaryConnectionId: "conn-b",
          party: [member("gm", "GM", NOW - PRESENCE_TTL_MS - 1, "conn-b")],
          now: NOW,
        })
      ).toBe(true);
    });

    it("ignores a pick that points at a window no longer held by a GM", () => {
      expect(
        isAdvancer({
          isGM: false,
          isDJ: true,
          connectionId: "dj1",
          djIds: ["dj1"],
          primaryConnectionId: "dj1",
          party: [member("gm", "GM")],
          now: NOW,
        })
      ).toBe(false);
    });
  });

  it("elects exactly one of two GMs", () => {
    const elected = ["gm-a", "gm-b"].filter((id) =>
      isAdvancer({
        isGM: true,
        isDJ: false,
        connectionId: id,
        djIds: [],
        party: [member(id === "gm-a" ? "gm-b" : "gm-a", "GM")],
        now: NOW,
      })
    );
    expect(elected).toEqual(["gm-a"]);
  });
});
