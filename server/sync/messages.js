/**
 * Validation for client → server timeline messages. Mirrors ClientMessage in
 * client/src/timeline/sync/protocol.ts:
 *
 *   { type: 'snapshot', projectBpm, tracks: [{ id, bpms }] }
 *   { type: 'addTrack', id, bpms }
 *   { type: 'patch', trackId, from, bpms, length? } // replaces bpms[from .. from + bpms.length), then sets the line to `length` steps
 *   { type: 'projectBpm', bpm }
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
      }
      return msg;
    }
    case "addTrack":
      if (!isId(msg.id)) throw new ProtocolError("addTrack: id must be a non-empty string");
      checkBpms(msg.bpms, `addTrack ${msg.id}`);
      return msg;
    case "patch":
      if (!isId(msg.trackId)) throw new ProtocolError("patch: trackId must be a non-empty string");
      if (!isIndex(msg.from)) throw new ProtocolError("patch: from must be a non-negative integer");
      checkBpms(msg.bpms, `patch ${msg.trackId}`, { allowEmpty: true });
      if (msg.length !== undefined && !(isIndex(msg.length) && msg.length > 0)) {
        throw new ProtocolError("patch: length must be a positive integer");
      }
      return msg;
    case "projectBpm":
      if (!isBpm(msg.bpm)) throw new ProtocolError("projectBpm: bpm must be a positive number");
      return msg;
    default:
      throw new ProtocolError(`unknown message type ${JSON.stringify(msg.type)}`);
  }
}

module.exports = { parseMessage, ProtocolError };
