var express = require('express');
var router = express.Router();
var DoublyLinkedList = require('../utils/linked_list.js');

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
})
