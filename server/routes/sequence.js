var express = require('express');
var router = express.Router();

// Channels are keyed by name in the shared project (max 4), and each channel
// owns its player for its whole lifetime, so no separate id/cleanup map is needed.
function findChannel(req, res) {
	const name = req.body && req.body.name;
	if (!name) {
		res.status(400).json({ error: 'name is required' });
		return null;
	}
	const channel = req.app.locals.project.channels.get(name);
	if (!channel) {
		res.status(404).json({ error: `no channel named "${name}"` });
		return null;
	}
	return channel;
}

router.post('/start', (req, res) => {
	const channel = findChannel(req, res);
	if (!channel) return;
	if (channel.isPlaying) {
		return res.status(409).json({ error: 'channel is already playing' });
	}
	channel.play(); // not awaited: playback runs in the background
	res.status(202).json({ name: req.body.name, playing: true });
});

router.post('/stop', (req, res) => {
	const channel = findChannel(req, res);
	if (!channel) return;
	channel.stop();
	res.status(200).json({ name: req.body.name, playing: false });
});

module.exports = router;
