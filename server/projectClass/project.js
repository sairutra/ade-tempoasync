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

	setMidi(MidiAccess, Port){
		this.MidiAccess = MidiAccess;
		this.Port = Port;
	}

	addChannel(name, id, BPMvalues) {
		if (this.channels.size >= 4) {
			console.error("Max channel capacity of 4 already reached");
			return ;
		}
		this.channels.set(name, new Channel(id, BPMvalue, this.MidiAccess, this.Port));
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