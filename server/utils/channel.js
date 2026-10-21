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
			console.log("Tried to set BPM to negative value for channel " + this.channel);
			this.BPMvalues = values;
		};
	}
}