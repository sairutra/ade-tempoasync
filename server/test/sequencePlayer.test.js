const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const { once } = require("events");
const { setTimeout: sleep } = require("node:timers/promises");

const SequencePlayer = require("../sequence/sequencePlayer");
const Channel = require("../channel/channel");

// Resolves once the player has stopped (polls; delays in these tests are short).
async function waitUntilIdle(player, timeoutMs = 1000) {
  const start = Date.now();
  while (player.isPlaying) {
    if (Date.now() - start > timeoutMs) throw new Error("player never went idle");
    await sleep(1);
  }
}

test("runs every step in order, then isPlaying is false", async () => {
  const player = new SequencePlayer();
  const ran = [];
  const steps = [1, 2, 3].map((n) => ({ action: async () => ran.push(n), delayMs: 10 }));

  player.start(steps);
  assert.equal(player.isPlaying, true);
  await waitUntilIdle(player);

  assert.deepEqual(ran, [1, 2, 3]);
  assert.equal(player.isPlaying, false);
});

test("start() while playing throws", async () => {
  const player = new SequencePlayer();
  player.start([{ action: async () => {}, delayMs: 50 }]);
  assert.throws(() => player.start([]), /already playing/);
  player.stop();
  await waitUntilIdle(player);
});

test("stop() during a long delay ends playback quickly and skips later steps", async () => {
  const player = new SequencePlayer();
  const ran = [];
  player.start([
    { action: async () => ran.push("first"), delayMs: 10_000 },
    { action: async () => ran.push("second"), delayMs: 0 },
  ]);
  await sleep(5);

  const t0 = performance.now();
  player.stop();
  await waitUntilIdle(player);
  const elapsed = performance.now() - t0;

  assert.ok(elapsed < 50, `stopped after ${elapsed.toFixed(1)} ms`);
  assert.deepEqual(ran, ["first"]);
});

test("stop() with nothing playing doesn't throw", () => {
  const player = new SequencePlayer();
  assert.doesNotThrow(() => player.stop());
  assert.doesNotThrow(() => player.stop());
  assert.equal(player.isPlaying, false);
});

test("start → stop → start: the first run's cleanup doesn't clear the second run", async () => {
  const player = new SequencePlayer();
  const ran = [];
  player.start([{ action: async () => ran.push("a"), delayMs: 10_000 }]);
  player.stop();
  player.start([{ action: async () => ran.push("b"), delayMs: 40 }]);

  await sleep(15); // the first run has settled and its .finally has run by now
  assert.equal(player.isPlaying, true);

  await waitUntilIdle(player);
  assert.deepEqual(ran, ["a", "b"]);
});

test("an action that throws ends playback and logs the error", async (t) => {
  const logged = [];
  t.mock.method(console, "error", (...args) => logged.push(args));

  const player = new SequencePlayer();
  const ran = [];
  player.start([
    { action: async () => { throw new Error("boom"); }, delayMs: 10 },
    { action: async () => ran.push("after"), delayMs: 10 },
  ]);
  await waitUntilIdle(player);

  assert.equal(player.isPlaying, false);
  assert.deepEqual(ran, []);
  assert.equal(logged.length, 1);
  assert.ok(logged[0].some((a) => a instanceof Error && a.message === "boom"));
});

test("Channel.buildSteps: rests send nothing, notes cycle, delay is a 16th note", async () => {
  const sent = [];
  const output = { send: (msg, time) => sent.push({ msg, time }) };
  const midiAccess = { outputs: { get: (port) => (port === "fake-port" ? output : undefined) } };

  const channel = new Channel(1, [120, 60, 120, 240, 90], midiAccess, "fake-port");
  channel.setSequence([50, -1, 60]);
  const steps = channel.buildSteps();

  assert.equal(steps.length, 5);
  assert.deepEqual(steps.map((s) => s.delayMs), [120, 60, 120, 240, 90].map((b) => 60000 / b / 4));

  const notesPerStep = [];
  for (const step of steps) {
    const before = sent.length;
    await step.action(new AbortController().signal);
    notesPerStep.push(sent.slice(before).map((s) => s.msg[1]));
  }
  // sequence [50, -1, 60] cycles over 5 steps: 50, rest, 60, 50, rest
  assert.deepEqual(notesPerStep, [[50, 50], [], [60, 60], [50, 50], []]);
});

test("routes: /sequence/start and /sequence/stop", async (t) => {
  const app = require("../app");
  const channels = app.locals.project.channels;

  // Fake channel with a real player and fake steps, so no MIDI device is needed.
  const player = new SequencePlayer();
  const fake = {
    play: () => player.start([{ action: async () => {}, delayMs: 10_000 }]),
    stop: () => player.stop(),
    get isPlaying() { return player.isPlaying; },
  };
  channels.set("fake", fake);
  t.after(() => { player.stop(); channels.delete("fake"); });

  const server = http.createServer(app).listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}/sequence`;
  const post = (path, body) =>
    fetch(base + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

  const t0 = performance.now();
  assert.equal((await post("/start", { name: "fake" })).status, 202);
  assert.ok(performance.now() - t0 < 1000, "start responded without waiting for the sequence");
  assert.equal(fake.isPlaying, true);

  assert.equal((await post("/start", { name: "fake" })).status, 409);
  assert.equal((await post("/stop", { name: "fake" })).status, 200);
  await waitUntilIdle(player);
  assert.equal((await post("/stop", { name: "fake" })).status, 200); // not playing: still 200

  assert.equal((await post("/start", { name: "nope" })).status, 404);
  assert.equal((await post("/stop", { name: "nope" })).status, 404);
  assert.equal((await post("/start", {})).status, 400);
  assert.equal((await post("/stop", {})).status, 400);
});
