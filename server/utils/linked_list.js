
// Doubly Linked list Node
class Node {
    // Constructor to create a new node
    // next and prev is by default initialized as null
    constructor(val) {
        // To store the value
        this.data = val;

        // To link the next Node
        this.next = null;

        // To link the previous Node
        this.prev = null;
    }
}

// Doubly Linked List
class DoublyLinkedList {
    // Constructor to create a new linked list
    constructor() {
        // To contain the first item of the list
        this.head = null;

        // To contain the last item of the list
        this.tail = null;
    }

    // To check if the list is empty
    isEmpty() {
        if (this.head == null) return true;
        return false;
    }

    // Method to add item at the last of doubly linked list
    append(val) {
        
        // Create a temporary variable
        let temp = new Node(val);

        // If the list is empty link assign
        // new node to both head and tail
        if (this.head == null) {
            this.head = temp;
            this.tail = temp;
        }

        // else add item to the tail and shift tail
        else {
            temp.prev = this.tail;
            this.tail.next = temp;
            this.tail = this.tail.next;
        }
    }

    // To traverse and display the list
    display() {

        // Check if the List is empty
        if (!this.isEmpty()) {

            // traverse the list using new current pointer
            let curr = this.head;
            while (curr !== null) {

                // Display element
                console.log(curr.data);

                // Shift the current pointer
                curr = curr.next;
            }
        }
    }
}

module.exports = DoublyLinkedList;