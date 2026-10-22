var Channel = require('../channel/channel.js');

class Project {

	constructor() {
		this.channels = new Map;
		this.masterBPM = 120;
		this.stepLength = 16;
	}


	setMasterBPM(BPM) {
		this.masterBPM = BPM;
	}

	setStepLength(len) {
		this.stepLength = len;
	}

	addChannel(name, id, BPMvalues) {
		if (this.channels.size >= 4) {
			console.error("Max channel capacity of 4 already reached");
			return ;
		}
		this.channels.set(name, new Channel(id, BPMvalues));
	}

	printChannels() {
		this.channels.forEach((value, key) => {
			console.log("\nChannel " + key + ": ");
			console.log("id: " + value.id);
			console.log("BPMvalues: " + value.BPMvalues);
			console.log("Sequence: " + value.sequence);
		});
	}
}

module.exports = Project;

/**
 * 
 * startAll(midiAccess, portID) {
	const startTime = performance.now() + 100;  // shared start so channels align
	this.channels.forEach(ch => ch.start(midiAccess, portID, startTime));
}

stopAll() {
	this.channels.forEach(ch => ch.stop());
}

Things to know
Per-channel tempo: each tick reads BPMvalues[step] and advances only that channel’s nextTime. Channels with different tempos will drift in and out of phase, which is what you want.
Timestamp support: the note-off relies on output.send(msg, timestamp). Your sendMiddleC already uses this pattern, but I’m not certain JZZ honors timestamps in Node. Test it. If notes hang, replace the second send with setTimeout(() => output.send(this.noteOffMessage), this.time - performance.now()).
Stuck notes: in stop(), consider sending an “all notes off” message ([0xB0 | id, 123, 0]) so nothing keeps sounding.
-1 handling: note >= 0 also guards against invalid values. MIDI notes must be 0 to 127, so you may want to clamp or validate in setSequence.
 */