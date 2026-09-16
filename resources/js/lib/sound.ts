/**
 * Small self-contained notification/call sounds via the Web Audio API — no
 * external audio files to fetch, license, or keep in sync with the app's
 * theme. Every function here is decorative and defensive: browsers can (and
 * do) refuse to start audio before the user has interacted with the page at
 * all (autoplay policy), so failures are swallowed everywhere — a sound that
 * can't play must never throw or break the feature it's attached to.
 */

let sharedCtx: AudioContext | null = null;

function getContext(): AudioContext | null {
  try {
    if (!sharedCtx) {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctor) return null;
      sharedCtx = new Ctor();
    }
    if (sharedCtx.state === "suspended") {
      // Fire-and-forget — a rejection here just means there's still been no
      // user gesture on the page yet, which is expected and not an error.
      sharedCtx.resume().catch(() => {});
    }
    return sharedCtx;
  } catch {
    return null;
  }
}

/** One sine tone, `durationMs` long, fading out at the end to avoid a click/pop. */
function tone(ctx: AudioContext, freq: number, startAt: number, durationMs: number, volume = 0.15) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, startAt);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + durationMs / 1000);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + durationMs / 1000 + 0.02);
}

/** A short two-note "ding" — a new chat message arrived. */
export function playNotificationSound() {
  const ctx = getContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    tone(ctx, 880, now, 90, 0.12);
    tone(ctx, 1320, now + 0.09, 140, 0.1);
  } catch {
    // Decorative — never let a sound failure surface to the user.
  }
}

/** A short descending two-note tone — a call ended, was declined, or was missed. */
export function playCallEndSound() {
  const ctx = getContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    tone(ctx, 660, now, 130, 0.12);
    tone(ctx, 440, now + 0.12, 180, 0.1);
  } catch {
    // Decorative.
  }
}

type LoopHandle = { stop: () => void };

/**
 * Shared machinery for the two looping sounds below: schedules `playOnce` on
 * a fixed interval until `stop()` is called. Deliberately `setInterval`-driven
 * rather than one long chain of Web-Audio-scheduled tones, so `stop()` takes
 * effect immediately — a fully pre-scheduled loop would keep sounding for up
 * to one more cycle after `stop()` fires (e.g. one extra ring persisting
 * right after Accept/Decline, which would feel like a bug).
 */
function startLoop(playOnce: (ctx: AudioContext) => void, intervalMs: number): LoopHandle {
  let stopped = false;
  const fire = () => {
    if (stopped) return;
    const ctx = getContext();
    if (!ctx) return;
    try {
      playOnce(ctx);
    } catch {
      // Decorative — keep the loop's timer running regardless.
    }
  };
  fire();
  const id = window.setInterval(fire, intervalMs);
  return {
    stop() {
      stopped = true;
      window.clearInterval(id);
    },
  };
}

/** Classic two-pip phone-ring pattern, repeating every ~2s — for the callee's IncomingCallModal. */
export function startRingtone(): LoopHandle {
  return startLoop((ctx) => {
    const now = ctx.currentTime;
    tone(ctx, 950, now, 350, 0.16);
    tone(ctx, 950, now + 0.45, 350, 0.16);
  }, 2000);
}

/** Softer single-pip ringback — the "calling…" tone the caller hears while
 * the other side's phone is ringing. Deliberately a different pattern from
 * startRingtone() above so the two sides of a call don't sound identical. */
export function startRingback(): LoopHandle {
  return startLoop((ctx) => {
    tone(ctx, 480, ctx.currentTime, 900, 0.08);
  }, 3000);
}
