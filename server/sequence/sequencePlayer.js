// Known limits: state is in-memory and per process. A restart loses running
// sequences, and several server instances would need shared coordination
// (e.g. Redis pub/sub for stop, or a job queue such as BullMQ).

const { setTimeout: sleep } = require("node:timers/promises");

// Plays a list of steps ({ action: async (signal) => {}, delayMs }) one after
// another without blocking the event loop. Cancellation is cooperative: it
// takes effect at await points, so long async work in an action must take the
// signal.
class SequencePlayer {
  #controller = null;

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
    for (const step of steps) {
      signal.throwIfAborted();
      await step.action(signal);
      await sleep(step.delayMs, undefined, { signal });
    }
  }
}

module.exports = SequencePlayer;
