class Channel {
	constructor(channel) {
		this.id = channel;
		this.BPMvalues = []; //array van ints -> BPM per step
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
}

module.exports = Channel;