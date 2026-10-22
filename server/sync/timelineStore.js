const { EventEmitter } = require("events");
const { ProtocolError } = require("./messages");

/**
 * The server's copy of the timeline: the project BPM and, per track, `bpms` (bpms[i] is the BPM of
 * step i) and its `channel` (1–16) when the client sent one. The client is the source of truth, so this only applies what it is sent.
 *
 * Emits after every applied message:
 *   'snapshot'   (store)
 *   'track'      (trackId, bpms, { from, to }, channel) — a track was added or edited; [from, to) changed.
 *                A patch may also have cut the line short: bpms.length is the new length.
 *   'projectBpm' (bpm)
 * Playback can subscribe to these instead of reading WebSocket messages itself.
 */
class TimelineStore extends EventEmitter {
  constructor() {
    super();
    this.projectBpm = null;
    /** @type {Map<string, number[]>} */
    this.tracks = new Map();
    /** @type {Map<string, number>} Channel per track id; tracks sent without one are absent. */
    this.channels = new Map();
  }

  /** Applies a message validated by parseMessage(). Throws ProtocolError if it doesn't fit the state. */
  apply(msg) {
    switch (msg.type) {
      case "snapshot":
        this.projectBpm = msg.projectBpm;
        this.tracks = new Map(msg.tracks.map((t) => [t.id, t.bpms.slice()]));
        this.channels = new Map(msg.tracks.filter((t) => t.channel !== undefined).map((t) => [t.id, t.channel]));
        this.emit("snapshot", this);
        return;
      case "addTrack":
        // Re-adding an id replaces it: a reconnect race can't leave a stale line behind.
        this.tracks.set(msg.id, msg.bpms.slice());
        if (msg.channel === undefined) this.channels.delete(msg.id);
        else this.channels.set(msg.id, msg.channel);
        this.emit("track", msg.id, this.tracks.get(msg.id), { from: 0, to: msg.bpms.length }, this.channels.get(msg.id));
        return;
      case "patch":
        this.applyPatch(msg);
        return;
      case "projectBpm":
        this.projectBpm = msg.bpm;
        this.emit("projectBpm", msg.bpm);
        return;
      case "start":
      case "stop":
        // Transport commands change playback, not the timeline (see wsServer.js).
        return;
    }
  }

  /**
   * Replaces steps [from, to) with `values`, then cuts the line to `lineLength` steps. A patch
   * never leaves a gap: `from` is at most the current length, and a patch that changes the length
   * must run to the new end (to === lineLength), so every step below lineLength is defined.
   */
  applyPatch({ trackId, from, to, bpms: values, lineLength }) {
    const bpms = this.tracks.get(trackId);
    if (!bpms) throw new ProtocolError(`patch: unknown track ${trackId}`);
    if (from > bpms.length) {
      throw new ProtocolError(`patch: from ${from} is past the end of track ${trackId} (${bpms.length} steps)`);
    }
    if (lineLength !== bpms.length && to !== lineLength) {
      throw new ProtocolError(
        `patch: track ${trackId} changes length ${bpms.length} -> ${lineLength}, so to must be ${lineLength} (got ${to})`,
      );
    }
    for (let i = 0; i < values.length; i++) bpms[from + i] = values[i];
    bpms.length = lineLength;
    this.emit("track", trackId, bpms, { from, to }, this.channels.get(trackId));
  }

  toJSON() {
    return {
      projectBpm: this.projectBpm,
      tracks: [...this.tracks].map(([id, bpms]) =>
        this.channels.has(id) ? { id, bpms, channel: this.channels.get(id) } : { id, bpms },
      ),
    };
  }
}

module.exports = { TimelineStore };
