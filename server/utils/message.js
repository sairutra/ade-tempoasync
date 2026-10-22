class Message {
	constructor(note, BPM, midiAccess, Port) {
		this.noteOnMessage = [0x96, note, 0x7f];
		this.noteOffMessage = [0x86, note, 0x7f];
		this.time =  performance.now() + (60000/BPM)/4;
		this.midiAccess = midiAccess;
		this.Port = Port;
	}

	sendMessage() {
		const output = this.midiAccess.outputs.get(this.Port);
		output.send(this.noteOnMessage);
		output.send(this.noteOffMessage, this.time);
	}

}


module.exports = Message;