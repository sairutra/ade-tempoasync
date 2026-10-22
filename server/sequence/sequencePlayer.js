// Known limits: state is in-memory and per process. A restart loses running
// sequences, and several server instances would need shared coordination
// (e.g. Redis pub/sub for stop, or a job queue such as BullMQ).
// Notes already sent with a future timestamp (up to lookaheadMs ahead) can
// still sound after stop(). A larger lookahead tolerates longer event-loop
// stalls without late notes, but makes stop less immediate.

const { setTimeout: sleep } = require("node:timers/promises");

// Plays a list of steps ({ action: async (signal, at) => {}, delayMs }) on an
// absolute timeline (performance.now() milliseconds) without blocking the event
// loop. Each step's scheduled time `at` is fixed from the start, so action time
// and timer lateness don't accumulate; the player wakes up lookaheadMs early and
// passes `at` to the action, which can stamp outgoing MIDI with it.
// Cancellation is cooperative: it takes effect at await points, so long async
// work in an action must take the signal.
class SequencePlayer {
  #controller = null;
  #lookaheadMs;

  constructor({ lookaheadMs = 25 } = {}) {
    this.#lookaheadMs = lookaheadMs;
  }

  start(steps) {
    if (this.#controller) throw new Error("SequencePlayer is already playing");
    const controller = new AbortController();
    this.#controller = controller;

    // Fire-and-forget: the caller gets control back immediately.
    this.#run(steps, controller.signal)
      .catch((err) => {
        if (err?.name !== "AbortError") console.error("Sequence playback failed:", err);
      })
      .finally(() => {
        // A stop() followed by a fresh start() replaces the controller; don't clear the new one.
        if (this.#controller === controller) this.#controller = null;
      });
  }

  // Aborts the current run and frees the player right away, so start() can be
  // called again immediately; the aborted run's .finally sees a different (or
  // no) controller and leaves it alone.
  stop() {
    this.#controller?.abort();
    this.#controller = null;
  }

  get isPlaying() {
    return this.#controller !== null;
  }

  async #run(steps, signal) {
    const lookahead = this.#lookaheadMs;
    // The first note is scheduled one lookahead ahead of now.
    let next = performance.now() + lookahead;
    for (const step of steps) {
      signal.throwIfAborted();
      // Always await, even for 0 ms, so a run that has fallen behind still
      // yields to the event loop (awaiting the action only yields to microtasks).
      await sleep(Math.max(0, next - lookahead - performance.now()), undefined, { signal });
      // If we're late, `next` may already be in the past: the action still gets
      // the original time and the timeline is not shifted.
      await step.action(signal, next);
      next += step.delayMs;
    }
    // Stay playing until the last step has finished sounding.
    await sleep(Math.max(0, next - performance.now()), undefined, { signal });
  }
}

module.exports = SequencePlayer;
