/**
 * Validation for client → server timeline messages. Mirrors ClientMessage in
 * client/src/timeline/sync/protocol.ts:
 *
 *   { type: 'snapshot', projectBpm, tracks: [{ id, bpms, channel?, sequence? }] }
 *   { type: 'addTrack', id, bpms, channel?, sequence? }  // channel: integer 1–16
 *       // sequence: 1–16 integers, each a MIDI note 0–127 or -1 for a rest
 *   { type: 'sequence', trackId, sequence }   // the track's MIDI sequence was edited
 *   { type: 'patch', trackId, from, to, bpms, lineLength }
 *       // steps [from, to) changed to `bpms` (bpms.length === to - from); the line is then
 *       // `lineLength` steps long. If lineLength differs from the current length, to === lineLength.
 *   { type: 'projectBpm', bpm }
 *   { type: 'start' }      // transport started (play button or Space): start every channel's player
 *   { type: 'stop' }       // transport paused or stopped: stop every channel's player
 *
 * parseMessage() returns the validated message or throws a ProtocolError. It checks shape only;
 * whether a patch fits the current track is the store's job.
 */

class ProtocolError extends Error {
  constructor(message) {
    super(message);
    this.name = "ProtocolError";
  }
}

function isBpm(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isIndex(value) {
  return Number.isInteger(value) && value >= 0;
}

function isId(value) {
  return typeof value === "string" && value.length > 0;
}

const CHANNEL_MIN = 1;
const CHANNEL_MAX = 16;

function checkChannel(channel, where) {
  if (channel === undefined) return;
  if (!Number.isInteger(channel) || channel < CHANNEL_MIN || channel > CHANNEL_MAX) {
    throw new ProtocolError(`${where}: channel must be an integer between ${CHANNEL_MIN} and ${CHANNEL_MAX}`);
  }
}

const SEQUENCE_MAX_LENGTH = 16;
const MIDI_NOTE_MIN = 0;
const MIDI_NOTE_MAX = 127;
const REST = -1;

function isStep(value) {
  return Number.isInteger(value) && (value === REST || (value >= MIDI_NOTE_MIN && value <= MIDI_NOTE_MAX));
}

function checkSequence(sequence, where, { optional = true } = {}) {
  if (sequence === undefined && optional) return;
  if (!Array.isArray(sequence)) throw new ProtocolError(`${where}: sequence must be an array`);
  if (sequence.length < 1 || sequence.length > SEQUENCE_MAX_LENGTH) {
    throw new ProtocolError(`${where}: sequence must have 1 to ${SEQUENCE_MAX_LENGTH} steps`);
  }
  for (let i = 0; i < sequence.length; i++) {
    if (!isStep(sequence[i])) {
      throw new ProtocolError(
        `${where}: sequence[${i}] must be an integer between ${MIDI_NOTE_MIN} and ${MIDI_NOTE_MAX}, or ${REST} for a rest`,
      );
    }
  }
}

function checkBpms(bpms, where, { allowEmpty = false } = {}) {
  if (!Array.isArray(bpms)) throw new ProtocolError(`${where}: bpms must be an array`);
  if (!allowEmpty && bpms.length === 0) throw new ProtocolError(`${where}: bpms must not be empty`);
  for (let i = 0; i < bpms.length; i++) {
    if (!isBpm(bpms[i])) throw new ProtocolError(`${where}: bpms[${i}] is not a positive finite number`);
  }
}

/** Parses one raw WebSocket frame (string or Buffer) into a validated message. */
function parseMessage(raw) {
  let msg;
  try {
    msg = JSON.parse(typeof raw === "string" ? raw : raw.toString("utf8"));
  } catch {
    throw new ProtocolError("message is not valid JSON");
  }
  if (msg === null || typeof msg !== "object" || Array.isArray(msg)) {
    throw new ProtocolError("message must be a JSON object");
  }

  switch (msg.type) {
    case "snapshot": {
      if (!isBpm(msg.projectBpm)) throw new ProtocolError("snapshot: projectBpm must be a positive number");
      if (!Array.isArray(msg.tracks)) throw new ProtocolError("snapshot: tracks must be an array");
      const seen = new Set();
      for (const track of msg.tracks) {
        if (track === null || typeof track !== "object") throw new ProtocolError("snapshot: track must be an object");
        if (!isId(track.id)) throw new ProtocolError("snapshot: track id must be a non-empty string");
        if (seen.has(track.id)) throw new ProtocolError(`snapshot: duplicate track id ${track.id}`);
        seen.add(track.id);
        checkBpms(track.bpms, `snapshot track ${track.id}`);
        checkChannel(track.channel, `snapshot track ${track.id}`);
        checkSequence(track.sequence, `snapshot track ${track.id}`);
      }
      return msg;
    }
    case "addTrack":
      if (!isId(msg.id)) throw new ProtocolError("addTrack: id must be a non-empty string");
      checkBpms(msg.bpms, `addTrack ${msg.id}`);
      checkChannel(msg.channel, `addTrack ${msg.id}`);
      checkSequence(msg.sequence, `addTrack ${msg.id}`);
      return msg;
    case "sequence":
      if (!isId(msg.trackId)) throw new ProtocolError("sequence: trackId must be a non-empty string");
      checkSequence(msg.sequence, `sequence ${msg.trackId}`, { optional: false });
      return msg;
    case "patch":
      if (!isId(msg.trackId)) throw new ProtocolError("patch: trackId must be a non-empty string");
      if (!isIndex(msg.from)) throw new ProtocolError("patch: from must be a non-negative integer");
      if (!isIndex(msg.to) || msg.to < msg.from) throw new ProtocolError("patch: to must be an integer >= from");
      checkBpms(msg.bpms, `patch ${msg.trackId}`, { allowEmpty: true });
      if (msg.bpms.length !== msg.to - msg.from) {
        throw new ProtocolError(`patch: bpms has ${msg.bpms.length} values for range [${msg.from}, ${msg.to})`);
      }
      if (!(isIndex(msg.lineLength) && msg.lineLength > 0)) {
        throw new ProtocolError("patch: lineLength must be a positive integer");
      }
      if (msg.to > msg.lineLength) throw new ProtocolError("patch: to must not be past lineLength");
      return msg;
    case "projectBpm":
      if (!isBpm(msg.bpm)) throw new ProtocolError("projectBpm: bpm must be a positive number");
      return msg;
    case "start":
    case "stop":
      return msg;
    default:
      throw new ProtocolError(`unknown message type ${JSON.stringify(msg.type)}`);
  }
}

module.exports = {
  parseMessage,
  ProtocolError,
  CHANNEL_MIN,
  CHANNEL_MAX,
  SEQUENCE_MAX_LENGTH,
  MIDI_NOTE_MIN,
  MIDI_NOTE_MAX,
  REST,
};
