var Message = require('../utils/message.js');

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

	sayHi() {
		console.log("hi from channel " + this.id);
	}

	createMessage(node) {
		msg = new Message();
		msg.noteOnMessage = [0x90 + this.id, 60, 0x7f];
		msg.noteOnMessage = [0x80 + this.id, 60, 0x7f];
		return msg;
	}
}

module.exports = Channel;