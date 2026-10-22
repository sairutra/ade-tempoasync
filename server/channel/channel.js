var Message = require("../utils/message.js");
var SequencePlayer = require("../sequence/sequencePlayer.js");

class Channel {
  constructor(channel, BPMvalues, midiAccess, Port) {
    this.id = channel;
    this.BPMvalues = BPMvalues; //array van ints -> BPM per step
    this.sequence = [
      50, -1, -1, -1, 50, -1, -1, -1, 50, -1, -1, -1, 50, -1, -1, -1,
    ]; // array van ints -> noten
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
      console.error(
        "setBPMvalues method called for channel " +
          this.id +
          " with empty array",
      );
    }
  }

  updateBPMvalues(start, end, values) {
    let range = end - start;
    console.log("Original BPMvalues: " + this.BPMvalues);
    for (var i = 0; i < range; i++) {
      this.BPMvalues[i + start] = values[i];
    }
    console.log("New BPMvalues: " + this.BPMvalues);
  }

  // One step per BPM value (a single pass); notes cycle through this.sequence,
  // -1 is a rest. Each step lasts one 16th note at its own BPM.
  // The player places each step on an absolute timeline and passes its
  // scheduled time `at`; the note is sent stamped with that timestamp.
  // Steps are produced lazily: the player pulls step i right after step i-1
  // has been scheduled, and that is when step i's BPM is read. So BPM changes
  // made during playback (updateBPMvalues / setBPMvalues) apply to every step
  // not yet scheduled, i.e. roughly one step plus the player's lookahead after
  // the change. Steps already scheduled keep their timing. The length is
  // re-read each step too, so growing or shrinking BPMvalues extends or ends
  // the running pass.
  *buildSteps() {
    for (let i = 0; i < this.BPMvalues.length; i++) {
      const bpm = this.BPMvalues[i];
      const note = this.sequence[i % this.sequence.length];
      yield {
        delayMs: 60000 / bpm / 4,
        action: async (signal, at) => {
          if (note === -1) return;
          new Message(
            this.id,
            note,
            bpm,
            this.midiAccess,
            this.Port,
            at,
          ).sendMessage();
        },
      };
    }
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
    this.message = new Message(this.id, note, BPM, this.midiAccess, this.Port);
  }
}

module.exports = Channel;
