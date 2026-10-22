const { WebSocketServer } = require("ws");
const debug = require("debug")("server:ws");
const { parseMessage, ProtocolError } = require("./messages");
var app = require("../app");

/**
 * Accepts the timeline sync socket on `path` of an existing HTTP server and applies every client
 * message to `store`. Upgrades on other paths are left alone (destroyed), so this can share the
 * Express server's port.
 *
 * A message that fails validation or doesn't fit the store is logged and answered with
 * { type: 'error', message } on that socket; the connection stays open and the store is unchanged.
 * The client sends a fresh snapshot whenever it reconnects, which repairs any drift.
 *
 * Returns the WebSocketServer (close it to stop accepting connections).
 */
function attachTimelineSocket(httpServer, { store, path = "/ws" } = {}) {
  if (!store) throw new Error("attachTimelineSocket: store is required");
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (req, socket, head) => {
    const { pathname } = new URL(req.url, "http://localhost");
    if (pathname !== path) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) =>
      wss.emit("connection", ws, req),
    );
  });

  wss.on("connection", (ws, req) => {
    const who = req.socket.remoteAddress;
    debug("timeline client connected (%s)", who);

    ws.on("message", (data, isBinary) => {
      if (isBinary)
        return reject(ws, new ProtocolError("binary frames are not supported"));
      let msg;
      try {
        msg = parseMessage(data);
        store.apply(msg);
      } catch (err) {
        if (!(err instanceof ProtocolError))
          console.error("timeline socket: failed to apply message", err);
        return reject(
          ws,
          err instanceof ProtocolError ? err : new Error("internal error"),
        );
      }
      if (msg.type === "addTrack") {
        app.locals.project.addChannel(msg.id, msg.channel, msg.bpms);
      }
      if (msg.type === "patch") {
        // Tracks from a snapshot have no project channel yet; skip instead of throwing
        // (an exception here is uncaught and takes the whole server down).
        const channel = app.locals.project.channels.get(msg.trackId);
        if (channel) channel.updateBPMvalues(msg.from, msg.to, msg.bpms);
      }
      if (msg.type === "start") {
        // Every channel starts together; one already playing is left alone
        // (SequencePlayer.start throws if it is, and an exception here is uncaught).
        for (const channel of app.locals.project.channels.values()) {
          if (!channel.isPlaying) channel.play();
        }
      }
      if (msg.type === "stop") {
        for (const channel of app.locals.project.channels.values()) {
          channel.stop();
        }
      }
      debug("%s %s", msg.type, describe(msg));
    });

    ws.on("close", () => debug("timeline client disconnected (%s)", who));
    ws.on("error", (err) => debug("socket error (%s): %s", who, err.message));
  });

  return wss;
}

function reject(ws, err) {
  debug("rejected message: %s", err.message);
  ws.send(JSON.stringify({ type: "error", message: err.message }));
}

function describe(msg) {
  switch (msg.type) {
    case "snapshot":
      return `${msg.tracks.length} track(s) @ ${msg.projectBpm} BPM`;
    case "addTrack":
      return `${msg.id} (${msg.bpms.length} steps${msg.channel === undefined ? "" : `, channel ${msg.channel}`})`;
    case "patch":
      return `${msg.trackId} [${msg.from}, ${msg.to}) of ${msg.lineLength} steps`;
    case "projectBpm":
      return String(msg.bpm);
    case "start":
    case "stop":
      return `${app.locals.project.channels.size} channel(s)`;
  }
}

module.exports = { attachTimelineSocket };
