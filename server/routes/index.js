var express = require('express');
var router = express.Router();
var DoublyLinkedList = require('../utils/linked_list.js');
var Message = require('../utils/message.js');

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

module.exports = router;

// testing nonsense
router.get('/test', (req, res) => {
	const ll = new DoublyLinkedList;
	for (i = 0; i < 10; i++) {
		ll.append(i)
	} ;
	ll.display();
	res.render('test', {message: [1, 2, 3]});

})

// testing nonsense
router.post('/seq', (req, res) => {
	console.log(req.body.sequence)
	res.send("yo");
})

router.post('/createChannel', (req, res) => {
	let name = req.body.name;
	let id = req.body.id;
	let BPMvalues = req.body.BPMvalues;

	req.app.locals.project.addChannel(name, id, BPMvalues);
	// req.app.locals.project.channels.get(name).sayHi();
	res.send("ok");
})

router.post('/updateBPMvalues', (req, res) => {
	let start = req.body.start;
	let end = req.body.end;
	let values = req.body.bpms;
	let channelName = req.body.name;

	let channel = req.app.locals.project.channels.get(channelName);
	channel.updateBPMvalues(start, end, values);
	res.send("ok");
})

router.post('/message', (req, res) => {
  let note = req.body.note;
  let bpm = req.body.bpm;

  req.app.locals.project.addChannel("momo", 1, [0, 1, 1]);
  const msg = req.app.locals.project.channels.get("momo").createMessage(note, bpm);
  const midi = req.app.locals.midiAccess;
  console.log(msg);
  console.log(midi);

  msg.sendMessage(midi, 'Renoise MIDI-In');
  res.send(":)");
})
