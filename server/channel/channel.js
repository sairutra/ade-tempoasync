var Message = require('../utils/message.js');

class Channel {
	constructor(channel, BPMvalues, midiAccess, Port) {
		this.id = channel;
		this.BPMvalues = BPMvalues; //array van ints -> BPM per step
		this.sequence = [50, 51, -1, -1, -1, 60, 65]; // array van ints -> noten
		this.midiAccess = midiAccess;
		this.Port = Port;
		this.message = null;
		this.run = false;
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

	playSequence() {
		const noteList = arrayToList(this.sequence);
		const headNode = noteList;
		let i = 0;
		this.run = true;

		while (this.run)
		{
			this.createMessage(noteList.data, this.BPMvalues[i]);
			this.sendMessage()
			noteList = noteList.next;
			i++;
			if (!noteList.next)
			{
				noteList = headNode;
			}
			if (i > this.BPMvalues.length())
			{
				this.run = false;
				i = 0;
				noteList = headNode;
			}
		}
    

	}


	createMessage(note, BPM) {
		this.message = new Message(note, BPM, this.midiAccess, this.Port);
	}
}

module.exports = Channel;