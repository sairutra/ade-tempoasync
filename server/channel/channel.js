var Message = require('../utils/message.js');
var SequencePlayer = require('../sequence/sequencePlayer.js');

class Channel {
	constructor(channel, BPMvalues, midiAccess, Port) {
		this.id = channel;
		this.BPMvalues = BPMvalues; //array van ints -> BPM per step
		this.sequence = [50, 51, -1, -1, -1, 60, 65]; // array van ints -> noten
		this.midiAccess = midiAccess;
		this.Port = Port;
		this.message = null;
		this.player = new SequencePlayer();
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

	// One step per BPM value (a single pass); notes cycle through this.sequence,
	// -1 is a rest. Each step lasts one 16th note at its own BPM.
	// Steps are built when playback starts, so BPM changes made during playback
	// apply to the next play(), not the one already running.
	buildSteps() {
		return this.BPMvalues.map((bpm, i) => {
			const note = this.sequence[i % this.sequence.length];
			return {
				delayMs: 60000 / bpm / 4,
				action: async () => {
					if (note === -1) return;
					new Message(note, bpm, this.midiAccess, this.Port).sendMessage();
				},
			};
		});
	}

	play() {
		this.player.start(this.buildSteps());
	}

	stop() {
		this.player.stop();
	}

	get isPlaying() {
		return this.player.isPlaying;
	}

	createMessage(note, BPM) {
		this.message = new Message(note, BPM, this.midiAccess, this.Port);
	}
}

module.exports = Channel;
