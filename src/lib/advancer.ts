/**
 * Who drives the queue forward.
 *
 * Exactly one client may act on a track ending, or every controller skips on
 * the same event and the queue jumps several tracks at once. Kept pure and
 * apart from React so the election can be tested directly — it is difficult to
 * exercise for real, needing several clients in a live room.
 *
 * The election runs between connections, not players: one account with the room
 * open in several windows is one player id with several running clients.
 */

export interface AdvancerCandidate {
  id: string;
  /** One per open window, where `id` is shared by all of an account's windows. */
  connectionId: string;
  role: "GM" | "PLAYER";
  /** Epoch ms this player's panel last checked in, or null if it never has. */
  presentAt: number | null;
}

/** Three missed 15s beats before a client counts as gone. */
export const PRESENCE_TTL_MS = 50_000;

/**
 * Whether a player's panel is open and running right now.
 *
 * Being in the room and running the panel are different things: Owlbear
 * destroys the extension's iframe whenever its popover is closed.
 */
export function hasPanelOpen(member: AdvancerCandidate, now = Date.now()): boolean {
  return member.presentAt !== null && now - member.presentAt < PRESENCE_TTL_MS;
}

/** Whether another GM window is running, which is when a choice between them matters. */
export function hasOtherGmRunning(party: AdvancerCandidate[], now = Date.now()): boolean {
  return party.some((p) => p.role === "GM" && hasPanelOpen(p, now));
}

export interface ElectionInput {
  /** Whether *this* client is a GM. It is running, by definition. */
  isGM: boolean;
  isDJ: boolean;
  connectionId: string | null;
  djIds: string[];
  /** The GM window used most recently, if one has been used while others ran. */
  primaryConnectionId?: string | null;
  /** Every other connection in the room, including this player's other windows. */
  party: AdvancerCandidate[];
  now?: number;
}

/**
 * The GM owns the job. If no GM is *running the panel*, a DJ who is takes over,
 * so the queue keeps playing rather than stalling. Ties at either rank go to the
 * lowest-sorted connection, which is what keeps a GM with two windows open from
 * being two advancers. The window a GM last used outranks that default, but only
 * while it is running, so a closed primary hands over rather than stalling the
 * queue.
 *
 * Deferring to a GM who is merely present — rather than one who is running —
 * is what used to stop the queue dead: a GM with the popover closed cannot
 * advance anything, yet every DJ stood down for them.
 */
export function isAdvancer({
  isGM,
  isDJ,
  connectionId,
  djIds,
  primaryConnectionId = null,
  party,
  now = Date.now(),
}: ElectionInput): boolean {
  if (!connectionId) return false;
  const running = party.filter((p) => hasPanelOpen(p, now));
  const runningGms = running.filter((p) => p.role === "GM");
  if (isGM && connectionId === primaryConnectionId) return true;
  if (runningGms.some((p) => p.connectionId === primaryConnectionId)) return false;
  if (!isGM && (runningGms.length > 0 || !isDJ)) return false;

  const rivals = isGM ? runningGms : running.filter((p) => djIds.includes(p.id));
  return rivals.every((p) => connectionId < p.connectionId);
}
