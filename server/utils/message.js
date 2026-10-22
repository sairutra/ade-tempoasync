// Note-on at `when`, note-off one 16th note later (both performance.now() ms).
// Omitting `when` sends the note-on now.
class Message {
  constructor(id, note, BPM, midiAccess, Port, when = performance.now()) {
    this.noteOnMessage = [0x90 | id, note, 0x7f];
    this.noteOffMessage = [0x80 | id, note, 0x7f];
    this.noteOnTime = when;
    this.time = when + 60000 / BPM / 4; // note-off time
    this.midiAccess = midiAccess;
    this.Port = Port;
  }

  sendMessage() {
    const output = this.midiAccess.outputs.get(this.Port);
    console.log(this.midiAccess);
    console.log(this.Port);
    console.log(output);
    output.send(this.noteOnMessage, this.noteOnTime);
    output.send(this.noteOffMessage, this.time);
  }
}

module.exports = Message;
