class Channel {
	constructor(channel, BPMvalues) {
		this.id = channel;
		this.BPMvalues = BPMvalues; //array van ints -> BPM per step
		this.sequence = []; // array van ints -> noten
	}

	setSequence(sequence) {
		console.log(sequence);
		this.sequence = sequence;
	}

	setBPMvalues(values) {
		if (values) {
			this.BPMvalues = values;
		} else {
			console.error("setBPMvalues method called for channel " + this.id + " with empty array");
		};
	}

	updateBPMvalues(start, end, values) {
		let range = end - start;
		console.log("Original BPMvalues: " + this.BPMvalues);
		for (var i = 0; i < range; i++) {
			this.BPMvalues[i + start] = values[i];
		};
		console.log("New BPMvalues: " + this.BPMvalues);
	}

	sayHi() {
		console.log("hi from channel " + this.id);
	}
}

module.exports = Channel;

/**
 * 
 * const Message = require('./message');

class Channel {
	constructor(channel, BPMvalues) {
		this.id = channel;           // MIDI channel 0-15
		this.BPMvalues = BPMvalues;  // BPM per step
		this.sequence = [];          // e.g. [52, 24, -1, 101, -1]

		this.running = false;
		this.step = 0;
		this.nextTime = 0;
		this.timer = null;
	}

	// ...setSequence, setBPMvalues, updateBPMvalues as before...

	createMessage(note, BPM, startTime) {
		return new Message(this.id, note, BPM, startTime);
	}

	start(midiAccess, portID, startTime = performance.now()) {
		if (this.running) return;
		this.midiAccess = midiAccess;
		this.portID = portID;
		this.running = true;
		this.step = 0;
		this.nextTime = startTime;
		this._schedule();
	}

	stop() {
		this.running = false;
		clearTimeout(this.timer);
	}

	_schedule() {
		const delay = Math.max(0, this.nextTime - performance.now());
		this.timer = setTimeout(() => this._tick(), delay);
	}

	_tick() {
		if (!this.running || this.sequence.length === 0) return;

		const note = this.sequence[this.step];
		const bpm = this.BPMvalues[this.step % this.BPMvalues.length];

		if (note >= 0) {  // -1 = no note
			this.createMessage(note, bpm, this.nextTime)
				.sendMessage(this.midiAccess, this.portID);
		}

		this.nextTime += 60000 / bpm / 4;               // absolute time -> no drift
		this.step = (this.step + 1) % this.sequence.length;
		this._schedule();
	}
}

module.exports = Channel;
 */

/**
 * 
 * class Message {
	constructor(id, note, BPM, startTime = performance.now()) {
		this.noteOnMessage  = [0x90 | id, note, 0x7f];
		this.noteOffMessage = [0x80 | id, note, 0x40];
		const stepMs = 60000 / BPM / 4;            // one 16th note
		this.time = startTime + stepMs * 0.9;      // note-off at 90% of the step
	}

	sendMessage(midiAccess, portID) {
		const output = midiAccess.outputs.get(portID);
		output.send(this.noteOnMessage);
		output.send(this.noteOffMessage, this.time);
	}
}

module.exports = Message;
 */

/**
 * 
 * Node runs your JavaScript on a single thread, and each callback (a timer tick, a websocket message, an HTTP request) runs to completion before the next one starts. A BPM update can never interleave with _tick halfway through, so you don’t need locks or any other synchronization.

When updates take effect: _tick reads BPMvalues[step] fresh on every step, so an update applies to the next step that hasn’t played yet. The step currently in flight keeps the duration it was scheduled with.
Timing jitter: if a websocket handler does heavy synchronous work, it delays every channel’s timers. Parsing a small JSON message and writing a few array entries takes microseconds, so this is fine. Just don’t put anything slow in the handler.
One real problem: bad input can break the loop

If an update leaves undefined in BPMvalues, then 60000 / undefined is NaN, so nextTime becomes NaN and stays NaN forever. setTimeout treats a NaN delay as ~1ms, so that channel starts firing in a hot loop. Your current updateBPMvalues can cause this: if values is shorter than end - start, it writes undefined, and if start or end are past the array’s length, it creates holes. The route also throws if the channel name doesn’t exist.

Validate in the channel, so it doesn’t matter whether the update comes from HTTP or a websocket:

js
updateBPMvalues(start, end, values) {
	if (!Array.isArray(values) ||
		!Number.isInteger(start) || !Number.isInteger(end) ||
		start < 0 || end > this.BPMvalues.length || start >= end ||
		values.length !== end - start ||
		!values.every(v => Number.isFinite(v) && v > 0)) {
		console.error("Invalid BPM update for channel " + this.id);
		return false;
	}
	for (let i = 0; i < end - start; i++) {
		this.BPMvalues[start + i] = values[i];
	}
	return true;
}

As a safety net, _tick can also refuse a bad BPM:

js
let bpm = this.BPMvalues[this.step % this.BPMvalues.length];
if (!Number.isFinite(bpm) || bpm <= 0) bpm = 120; // fallback

Apply the same idea to setBPMvalues and setSequence (validate before assigning), since they’re likely to be driven by messages too.

Websocket setup

Use the ws package and attach it to the same HTTP server in www.js. You’ll need to create the project there or share it via app.locals:

js
const { WebSocketServer } = require('ws');

const wss = new WebSocketServer({ server });

wss.on('connection', (socket) => {
	socket.on('message', (data) => {
		let msg;
		try {
			msg = JSON.parse(data);
		} catch {
			return socket.send(JSON.stringify({ error: "invalid JSON" }));
		}

		if (msg.type === 'updateBPMvalues') {
			const channel = app.locals.project.channels.get(msg.name);
			if (!channel) {
				return socket.send(JSON.stringify({ error: "unknown channel" }));
			}
			const ok = channel.updateBPMvalues(msg.start, msg.end, msg.bpms);
			socket.send(JSON.stringify({ type: 'ack', ok }));
		}
	});
});

Put server.listen/wss after server is created, and make sure app.locals.project is set in app.js before any messages arrive.

Two smaller things
Mutating in place vs. replacing: updateBPMvalues mutates in place, which is ideal. If you replace the whole array with setBPMvalues, the loop still works because it indexes with % length, so a shorter array can’t cause an out-of-range read.
Changing the sequence while running: if the new sequence is shorter than the current step, this.sequence[this.step] is undefined. That is skipped by note >= 0 and step wraps on the next tick, so it won’t crash. It will just play one silent step. Resetting this.step = 0 inside setSequence avoids that.

I can also add a type: 'setSequence' message to the websocket handler if you want sequences editable live as well.                                 ==8
\ 
 */