const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const { once } = require("events");
const { setTimeout: sleep } = require("node:timers/promises");

const SequencePlayer = require("../sequence/sequencePlayer");
const Channel = require("../channel/channel");
const Message = require("../utils/message");

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
  // The first step's action runs after an (awaited) wake-up sleep, so stopping
  // synchronously right after start() aborts the first run before "a" plays.
  assert.deepEqual(ran, ["b"]);
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
  const steps = [...channel.buildSteps()];

  assert.equal(steps.length, 5);
  assert.deepEqual(steps.map((s) => s.delayMs), [120, 60, 120, 240, 90].map((b) => 60000 / b / 4));

  const notesPerStep = [];
  const timesPerStep = [];
  const ats = [1000, 1125, 1375, 1500, 1562.5];
  for (const [i, step] of steps.entries()) {
    const before = sent.length;
    await step.action(new AbortController().signal, ats[i]);
    notesPerStep.push(sent.slice(before).map((s) => s.msg[1]));
    timesPerStep.push(sent.slice(before).map((s) => s.time));
  }
  // sequence [50, -1, 60] cycles over 5 steps: 50, rest, 60, 50, rest
  assert.deepEqual(notesPerStep, [[50, 50], [], [60, 60], [50, 50], []]);
  // note-on at the step's `at`, note-off one 16th note (at that step's BPM) later
  assert.deepEqual(timesPerStep, [
    [1000, 1000 + 60000 / 120 / 4],
    [],
    [1375, 1375 + 60000 / 120 / 4],
    [1500, 1500 + 60000 / 240 / 4],
    [],
  ]);
});

test("Channel: BPM changes during playback apply to steps not yet scheduled", async () => {
  // 1500 BPM = 10 ms per 16th note, 750 BPM = 20 ms.
  const noteOns = [];
  let channel;
  const output = {
    send: (msg, time) => {
      if ((msg[0] & 0xf0) !== 0x90) return;
      noteOns.push(time);
      // While step 1 is playing, slow down steps 2..5 and append two extra steps.
      if (noteOns.length === 2) {
        channel.updateBPMvalues(2, 6, [750, 750, 750, 750]);
        channel.BPMvalues.push(1500, 1500);
      }
    },
  };
  const midiAccess = { outputs: { get: () => output } };
  channel = new Channel(1, Array(6).fill(1500), midiAccess, "fake-port");
  channel.setSequence([60]);

  const log = console.log;
  console.log = () => {};
  try {
    channel.play();
    await waitUntilIdle(channel.player, 2000);
  } finally {
    console.log = log;
  }

  assert.equal(noteOns.length, 8, "steps appended during playback are played");
  const gaps = noteOns.slice(1).map((t, i) => t - noteOns[i]);
  // Steps 0 and 1 were already scheduled at 10 ms; steps 2..5 now last 20 ms.
  const expected = [10, 10, 20, 20, 20, 20, 10];
  for (let i = 0; i < gaps.length; i++) {
    assert.ok(Math.abs(gaps[i] - expected[i]) < 1e-6, `gap ${i}: ${gaps[i]} ms, expected ${expected[i]}`);
  }
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

// --- Absolute timeline ---

test("timeline is exact and doesn't drift", async () => {
  const lookaheadMs = 25;
  const player = new SequencePlayer({ lookaheadMs });
  const at = [];
  const calledAt = [];
  const steps = Array.from({ length: 50 }, () => ({
    action: async (_signal, t) => { calledAt.push(performance.now()); at.push(t); },
    delayMs: 10,
  }));

  player.start(steps);
  await waitUntilIdle(player, 2000);

  assert.equal(at.length, 50);
  for (let i = 0; i < at.length; i++) {
    assert.ok(Math.abs(at[i] - at[0] - i * 10) < 1e-6, `step ${i}: at offset ${at[i] - at[0]}`);
  }

  // Lateness of each wake-up relative to its target (at - lookahead).
  const lateness = at.map((t, i) => calledAt[i] - (t - lookaheadMs));
  const last = lateness[lateness.length - 1];
  const max = Math.max(...lateness);
  assert.ok(last - lateness[0] <= 10, `drift ${(last - lateness[0]).toFixed(2)} ms`);
  assert.ok(max < 15, `max lateness ${max.toFixed(2)} ms`);
});

test("a slow action doesn't shift the timeline; later steps catch up", async () => {
  const player = new SequencePlayer({ lookaheadMs: 5 });
  const at = [];
  const steps = Array.from({ length: 8 }, (_, i) => ({
    action: async (_signal, t) => {
      at.push(t);
      if (i === 2) {
        const end = performance.now() + 30;
        while (performance.now() < end); // busy-wait: blocks the event loop
      }
    },
    delayMs: 10,
  }));

  player.start(steps);
  await waitUntilIdle(player);

  assert.equal(at.length, 8, "every step ran");
  for (let i = 0; i < at.length; i++) {
    assert.ok(Math.abs(at[i] - at[0] - i * 10) < 1e-6, `step ${i}: at offset ${at[i] - at[0]}`);
  }
});

test("isPlaying stays true until the last step has finished", async () => {
  const player = new SequencePlayer({ lookaheadMs: 10 });
  const delays = [10, 10, 20];
  let lastAt = null;
  let playingAfterLastAction = null;
  const steps = delays.map((delayMs, i) => ({
    action: async (_signal, t) => {
      if (i === delays.length - 1) {
        lastAt = t;
        setTimeout(() => { playingAfterLastAction = player.isPlaying; }, 5);
      }
    },
    delayMs,
  }));

  player.start(steps);
  await waitUntilIdle(player);
  const idleAt = performance.now();
  const end = lastAt + delays[delays.length - 1];

  assert.equal(playingAfterLastAction, true);
  assert.ok(idleAt >= end - 1, `went idle ${(end - idleAt).toFixed(2)} ms before the end`);
  assert.ok(idleAt < end + 20, `went idle ${(idleAt - end).toFixed(2)} ms after the end`);
});

// --- Message timestamps ---

function fakeMidi() {
  const sent = [];
  const output = { send: (msg, timestamp) => sent.push({ msg, timestamp }) };
  return { sent, midiAccess: { outputs: { get: () => output } } };
}

test("Message: note-on at `when`, note-off a 16th note later", () => {
  const { sent, midiAccess } = fakeMidi();
  new Message(60, 120, midiAccess, "p", 1000).sendMessage();
  assert.deepEqual(sent, [
    { msg: [0x96, 60, 0x7f], timestamp: 1000 },
    { msg: [0x86, 60, 0x7f], timestamp: 1000 + 60000 / 120 / 4 },
  ]);
});

test("Message: without `when` it still sends, note-on stamped now", () => {
  const { sent, midiAccess } = fakeMidi();
  const before = performance.now();
  new Message(60, 120, midiAccess, "p").sendMessage();
  const after = performance.now();

  assert.equal(sent.length, 2);
  assert.ok(sent[0].timestamp >= before && sent[0].timestamp <= after);
  assert.ok(Math.abs(sent[1].timestamp - sent[0].timestamp - 125) < 1e-6);
});
