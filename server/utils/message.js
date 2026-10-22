class Message {
	constructor(note, BPM) {
		this.noteOnMessage = [0x96, note, 0x7f];
		this.noteOffMessage = [0x86, note, 0x7f];
		this.time =  performance.now() + (60000/BPM)/4;
	}

	sendMessage(midiAccess, portID) {
		const output = midiAccess.outputs.get(portID);
		output.send(this.noteOnMessage);
		output.send(this.noteOffMessage, this.time);
	}

}


module.exports = Message;