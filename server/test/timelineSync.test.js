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
    JSON.stringify({ type: "patch", trackId: "a", from: -1, to: 0, bpms: [100], lineLength: 1 }),
    JSON.stringify({ type: "patch", trackId: "a", from: 0, to: 2, bpms: [100, "x"], lineLength: 2 }),
    JSON.stringify({ type: "patch", trackId: "a", from: 0, bpms: [100], lineLength: 1 }), // no to
    JSON.stringify({ type: "patch", trackId: "a", from: 0, to: 1, bpms: [100] }), // no lineLength
    JSON.stringify({ type: "patch", trackId: "a", from: 2, to: 1, bpms: [], lineLength: 3 }), // to < from
    JSON.stringify({ type: "patch", trackId: "a", from: 0, to: 2, bpms: [100], lineLength: 3 }), // bpms vs range
    JSON.stringify({ type: "patch", trackId: "a", from: 0, to: 3, bpms: [1, 1, 1], lineLength: 2 }), // past the end
    JSON.stringify({ type: "patch", trackId: "", from: 0, to: 1, bpms: [100], lineLength: 1 }),
    JSON.stringify({ type: "projectBpm", bpm: 0 }),
    JSON.stringify({ type: "addTrack", id: "a", bpms: [100], channel: 0 }),
    JSON.stringify({ type: "addTrack", id: "a", bpms: [100], channel: 17 }),
    JSON.stringify({ type: "addTrack", id: "a", bpms: [100], channel: 2.5 }),
    JSON.stringify({ type: "addTrack", id: "a", bpms: [100], channel: "3" }),
    JSON.stringify({ type: "snapshot", projectBpm: 120, tracks: [{ id: "a", bpms: [1], channel: 99 }] }),
    JSON.stringify({ type: "snapshot", projectBpm: 120, tracks: [{ id: "a", bpms: [1] }, { id: "a", bpms: [1] }] }),
    JSON.stringify({ type: "Start" }),
  ]) {
    assert.throws(() => parseMessage(raw), ProtocolError, raw);
  }
});

test("patch replaces steps [from, to) and reports that range", () => {
  const store = storeWith({ a: [100, 100, 100, 100, 100] });
  const events = [];
  store.on("track", (id, bpms, range) => events.push([id, bpms.slice(), range]));
  apply(store, { type: "patch", trackId: "a", from: 1, to: 4, bpms: [110, 120, 110], lineLength: 5 });
  assert.deepEqual(store.tracks.get("a"), [100, 110, 120, 110, 100]);
  assert.deepEqual(events, [["a", [100, 110, 120, 110, 100], { from: 1, to: 4 }]]);
});

test("patch can lengthen a line from its end", () => {
  const store = storeWith({ a: [100, 100] });
  apply(store, { type: "patch", trackId: "a", from: 2, to: 4, bpms: [105, 110], lineLength: 4 });
  assert.deepEqual(store.tracks.get("a"), [100, 100, 105, 110]);
});

test("patch with a smaller lineLength cuts the line, reporting only the changed segment", () => {
  const store = storeWith({ a: [100, 105, 110, 115, 120] });
  const events = [];
  store.on("track", (id, bpms, range) => events.push([bpms.slice(), range]));
  // Last node moved from step 4 back to step 3: only the segment after the previous node (step 1) changes.
  apply(store, { type: "patch", trackId: "a", from: 2, to: 4, bpms: [113, 120], lineLength: 4 });
  assert.deepEqual(store.tracks.get("a"), [100, 105, 113, 120]);
  assert.deepEqual(events, [[[100, 105, 113, 120], { from: 2, to: 4 }]]);
  // Cut only (empty range).
  apply(store, { type: "patch", trackId: "a", from: 2, to: 2, bpms: [], lineLength: 2 });
  assert.deepEqual(store.tracks.get("a"), [100, 105]);
});

test("patch errors leave the store unchanged", () => {
  const store = storeWith({ a: [100, 100] });
  assert.throws(() => apply(store, { type: "patch", trackId: "b", from: 0, to: 1, bpms: [1], lineLength: 2 }), ProtocolError);
  assert.throws(() => apply(store, { type: "patch", trackId: "a", from: 3, to: 4, bpms: [1], lineLength: 4 }), ProtocolError);
  // Changes the length but stops short of the new end: steps 1..3 would be undefined.
  assert.throws(() => apply(store, { type: "patch", trackId: "a", from: 0, to: 1, bpms: [1], lineLength: 4 }), ProtocolError);
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
  apply(store, { type: "patch", trackId: "b", from: 0, to: 1, bpms: [95], lineLength: 2 });
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
  ws.send(JSON.stringify({ type: "patch", trackId: "a", from: 2, to: 3, bpms: [130], lineLength: 3 }));
  const [id, bpms, range] = await patched;
  assert.equal(id, "a");
  assert.deepEqual(bpms, [100, 100, 130]);
  assert.deepEqual(range, { from: 2, to: 3 });

  ws.send(JSON.stringify({ type: "patch", trackId: "missing", from: 0, to: 1, bpms: [1], lineLength: 1 }));
  const [reply] = await once(ws, "message");
  assert.equal(JSON.parse(reply.toString()).type, "error");
  assert.deepEqual(store.tracks.get("a"), [100, 100, 130]);
});

test("start and stop messages start and stop every project channel's player", async (t) => {
  const { locals } = require("../app");
  const calls = [];
  const fakeChannel = (name, playing = false) => ({
    isPlaying: playing,
    play() {
      calls.push(["play", name]);
      this.isPlaying = true;
    },
    stop() {
      calls.push(["stop", name]);
      this.isPlaying = false;
    },
  });
  locals.project.channels.set("a", fakeChannel("a"));
  locals.project.channels.set("b", fakeChannel("b", true)); // already playing: not started twice
  t.after(() => locals.project.channels.clear());

  const store = new TimelineStore();
  const server = http.createServer();
  attachTimelineSocket(server, { store });
  server.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const ws = new WebSocket(`ws://localhost:${server.address().port}/ws`);
  await once(ws, "open");
  t.after(() => ws.close());

  // Messages on one socket are handled in order, so the error reply to a bad message
  // means everything sent before it has been applied.
  const settled = async () => {
    ws.send("not json");
    await once(ws, "message");
  };

  ws.send(JSON.stringify({ type: "start" }));
  await settled();
  assert.deepEqual(calls, [["play", "a"]]);

  ws.send(JSON.stringify({ type: "stop" }));
  await settled();
  assert.deepEqual(calls.slice(1), [["stop", "a"], ["stop", "b"]]);
  assert.deepEqual(store.toJSON(), { projectBpm: null, tracks: [] }); // timeline untouched
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

test("MIDI sequences: validated, stored from snapshot/addTrack/sequence, and checked against the track", () => {
  for (const sequence of [[], Array(17).fill(60), [128], [-2], [60.5], ["60"], "60"]) {
    assert.throws(() => parseMessage(JSON.stringify({ type: "addTrack", id: "a", bpms: [100], sequence })), ProtocolError);
    assert.throws(() => parseMessage(JSON.stringify({ type: "sequence", trackId: "a", sequence })), ProtocolError);
  }
  assert.throws(() => parseMessage(JSON.stringify({ type: "sequence", trackId: "a" })), ProtocolError);
  assert.throws(() => parseMessage(JSON.stringify({ type: "sequence", trackId: "", sequence: [60] })), ProtocolError);

  const store = new TimelineStore();
  apply(store, { type: "snapshot", projectBpm: 120, tracks: [{ id: "a", bpms: [100], sequence: [60, -1] }, { id: "b", bpms: [90] }] });
  apply(store, { type: "addTrack", id: "c", bpms: [80], channel: 2, sequence: [0, 127, -1] });
  const events = [];
  store.on("sequence", (id, seq) => events.push([id, seq]));
  apply(store, { type: "sequence", trackId: "b", sequence: [64] });
  assert.deepEqual(events, [["b", [64]]]);
  assert.deepEqual(store.toJSON().tracks, [
    { id: "a", bpms: [100], sequence: [60, -1] },
    { id: "b", bpms: [90], sequence: [64] },
    { id: "c", bpms: [80], channel: 2, sequence: [0, 127, -1] },
  ]);
  assert.throws(() => apply(store, { type: "sequence", trackId: "zzz", sequence: [60] }), ProtocolError);
});

test("addTrack and sequence messages set the project channel's sequence", async (t) => {
  const { locals } = require("../app");
  t.after(() => locals.project.channels.clear());

  const store = new TimelineStore();
  const server = http.createServer();
  attachTimelineSocket(server, { store });
  server.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const ws = new WebSocket(`ws://localhost:${server.address().port}/ws`);
  await once(ws, "open");
  t.after(() => ws.close());
  const settled = async () => {
    ws.send("not json");
    await once(ws, "message");
  };

  ws.send(JSON.stringify({ type: "addTrack", id: "lead", bpms: [120, 120], channel: 3, sequence: [60, -1, 62, -1] }));
  await settled();
  const channel = locals.project.channels.get("lead");
  assert.equal(channel.id, 2);
  assert.deepEqual(channel.sequence, [60, -1, 62, -1]);

  ws.send(JSON.stringify({ type: "sequence", trackId: "lead", sequence: [72] }));
  await settled();
  assert.deepEqual(channel.sequence, [72]);

  // An invalid edit is answered with an error and leaves the channel alone.
  ws.send(JSON.stringify({ type: "sequence", trackId: "lead", sequence: [128] }));
  const [reply] = await once(ws, "message");
  assert.equal(JSON.parse(reply.toString()).type, "error");
  assert.deepEqual(channel.sequence, [72]);
});
