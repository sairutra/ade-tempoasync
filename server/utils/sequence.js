var DoublyLinkedList = require('./linked_list.js');

/* 
createSequence() takes an array of integers, and creates a DoublyLinkedList with a node for every value.
*/
function createSequence(list) {
    const dll = new DoublyLinkedList;
    list.forEach((note) => dll.append(note));
    return dll;
}

module.exports = createSequence;