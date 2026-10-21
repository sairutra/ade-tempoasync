class Message {
	constructor(note, BPM) {
		this.noteOnMessage = [0x9n, note];
		this.noteOffMessage = [0x8n, note, performance.now() + (60000/BPM)/4];
	}

	sendMessage(midiAcces, portID) {
		const output = midiAcces.outputs.get(portID);
		output.send(this.noteOnMessage);
		output.send(this.noteOffMessage);
	}

}


module.exports = { Message };