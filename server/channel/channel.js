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


	createMessage(note, BPM) {
	var msg = new Message(note, BPM);
	return msg;
	}
}

module.exports = Channel;