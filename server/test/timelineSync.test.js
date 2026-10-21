const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const { once } = require("events");
const { WebSocket } = require("ws");

const { parseMessage, ProtocolError } = require("../sync/messages");
const { TimelineStore } = require("../sync/timelineStore");
const { attachTimelineSocket } = require("../sync/wsServer");

const apply = (store, msg) => store.apply(parseMessage(JSON.stringify(msg)));

function storeWith(tracks, projectBpm = 120) {
  const store = new TimelineStore();
  apply(store, { type: "snapshot", projectBpm, tracks: Object.entries(tracks).map(([id, bpms]) => ({ id, bpms })) });
  return store;
}

test("parseMessage rejects malformed messages", () => {
  for (const raw of [
    "not json",
    "[]",
    JSON.stringify({ type: "nope" }),
    JSON.stringify({ type: "patch", trackId: "a", from: -1, bpms: [100] }),
    JSON.stringify({ type: "patch", trackId: "a", from: 0, bpms: [100, "x"] }),
    JSON.stringify({ type: "patch", trackId: "", from: 0, bpms: [100] }),
    JSON.stringify({ type: "projectBpm", bpm: 0 }),
    JSON.stringify({ type: "addTrack", id: "a", bpms: [100], channel: 0 }),
    JSON.stringify({ type: "addTrack", id: "a", bpms: [100], channel: 17 }),
    JSON.stringify({ type: "addTrack", id: "a", bpms: [100], channel: 2.5 }),
    JSON.stringify({ type: "addTrack", id: "a", bpms: [100], channel: "3" }),
    JSON.stringify({ type: "snapshot", projectBpm: 120, tracks: [{ id: "a", bpms: [1], channel: 99 }] }),
    JSON.stringify({ type: "snapshot", projectBpm: 120, tracks: [{ id: "a", bpms: [1] }, { id: "a", bpms: [1] }] }),
  ]) {
    assert.throws(() => parseMessage(raw), ProtocolError, raw);
  }
});

test("patch replaces bpms[from .. from + n) and reports the changed range", () => {
  const store = storeWith({ a: [100, 100, 100, 100, 100] });
  const events = [];
  store.on("track", (id, bpms, range) => events.push([id, bpms.slice(), range]));
  apply(store, { type: "patch", trackId: "a", from: 1, bpms: [110, 120, 110] });
  assert.deepEqual(store.tracks.get("a"), [100, 110, 120, 110, 100]);
  assert.deepEqual(events, [["a", [100, 110, 120, 110, 100], { from: 1, to: 4 }]]);
});

test("patch can lengthen a line from its end", () => {
  const store = storeWith({ a: [100, 100] });
  apply(store, { type: "patch", trackId: "a", from: 0, bpms: [100, 100, 105, 110] });
  assert.deepEqual(store.tracks.get("a"), [100, 100, 105, 110]);
});

test("patch with length shortens the line", () => {
  const store = storeWith({ a: [100, 105, 110, 115, 120] });
  apply(store, { type: "patch", trackId: "a", from: 0, bpms: [100, 110, 120], length: 3 });
  assert.deepEqual(store.tracks.get("a"), [100, 110, 120]);
});

test("patch errors leave the store unchanged", () => {
  const store = storeWith({ a: [100, 100] });
  assert.throws(() => apply(store, { type: "patch", trackId: "b", from: 0, bpms: [1] }), ProtocolError);
  assert.throws(() => apply(store, { type: "patch", trackId: "a", from: 3, bpms: [1] }), ProtocolError);
  assert.deepEqual(store.tracks.get("a"), [100, 100]);
});

test("snapshot replaces everything; addTrack and projectBpm update it", () => {
  const store = storeWith({ a: [100], b: [90] });
  apply(store, { type: "snapshot", projectBpm: 140, tracks: [{ id: "c", bpms: [80, 80] }] });
  apply(store, { type: "addTrack", id: "d", bpms: [70] });
  apply(store, { type: "projectBpm", bpm: 128 });
  assert.deepEqual(store.toJSON(), {
    projectBpm: 128,
    tracks: [
      { id: "c", bpms: [80, 80] },
      { id: "d", bpms: [70] },
    ],
  });
});

test("channel numbers are stored from addTrack and snapshot and survive patches", () => {
  const store = storeWith({ a: [100] });
  const events = [];
  store.on("track", (id, _bpms, _range, channel) => events.push([id, channel]));
  apply(store, { type: "addTrack", id: "b", bpms: [90, 90], channel: 16 });
  apply(store, { type: "patch", trackId: "b", from: 0, bpms: [95] });
  assert.deepEqual(events, [["b", 16], ["b", 16]]);
  assert.deepEqual(store.toJSON().tracks, [
    { id: "a", bpms: [100] },
    { id: "b", bpms: [95, 90], channel: 16 },
  ]);
  apply(store, { type: "snapshot", projectBpm: 120, tracks: [{ id: "c", bpms: [80], channel: 1 }] });
  assert.deepEqual(store.toJSON().tracks, [{ id: "c", bpms: [80], channel: 1 }]);
  // Re-adding without a channel clears it.
  apply(store, { type: "addTrack", id: "c", bpms: [80] });
  assert.deepEqual(store.toJSON().tracks, [{ id: "c", bpms: [80] }]);
});

test("WebSocket on /ws applies client messages and answers bad ones with an error", async (t) => {
  const store = new TimelineStore();
  const server = http.createServer();
  attachTimelineSocket(server, { store });
  server.listen(0);
  await once(server, "listening");
  t.after(() => server.close());

  const ws = new WebSocket(`ws://localhost:${server.address().port}/ws`);
  await once(ws, "open");
  t.after(() => ws.close());

  const patched = once(store, "track");
  ws.send(JSON.stringify({ type: "snapshot", projectBpm: 120, tracks: [{ id: "a", bpms: [100, 100, 100] }] }));
  ws.send(JSON.stringify({ type: "patch", trackId: "a", from: 2, bpms: [130] }));
  const [id, bpms, range] = await patched;
  assert.equal(id, "a");
  assert.deepEqual(bpms, [100, 100, 130]);
  assert.deepEqual(range, { from: 2, to: 3 });

  ws.send(JSON.stringify({ type: "patch", trackId: "missing", from: 0, bpms: [1] }));
  const [reply] = await once(ws, "message");
  assert.equal(JSON.parse(reply.toString()).type, "error");
  assert.deepEqual(store.tracks.get("a"), [100, 100, 130]);
});

test("upgrades on other paths are refused", async (t) => {
  const server = http.createServer();
  attachTimelineSocket(server, { store: new TimelineStore() });
  server.listen(0);
  await once(server, "listening");
  t.after(() => server.close());

  const ws = new WebSocket(`ws://localhost:${server.address().port}/other`);
  await once(ws, "error");
});
