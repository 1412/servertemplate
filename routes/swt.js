var router = require('express').Router();

/* GET users listing. */
router.get('/', function(req, res) {
	res.send(req.query);
});

module.exports = router;
