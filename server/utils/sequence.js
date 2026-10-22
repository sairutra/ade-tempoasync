var DoublyLinkedList = require('./linked_list.js');
var Message = require('./message.js');

/* 
createSequence() takes an array of integers, and creates a DoublyLinkedList with a node for every value.
*/
function arrayToList(list) {
    const dll = new DoublyLinkedList;
    
    list.forEach((val) => dll.append(val));
    return dll;
}

function playSequence(midiAccess, channel, notes, BPMs) {
    const noteList = arrayToList(notes);
    const headNode = noteList;
    var i = 0;
    var run = true;

    while (run)
    {
        channel.createMessage(noteList.data, BPMs[i]);
        channel.sendMessage(midiAccess, 
        )
        noteList = noteList.next;
        i++;
        if (!noteList.next)
        {
            noteList = headNode;
        }
        if (i > BPMs.length())
        {
            run = false;
            i = 0;
            noteList = headNode;
        }
    }
    

}

module.exports = arrayToList;