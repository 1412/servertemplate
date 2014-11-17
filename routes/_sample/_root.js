var router = require('express').Router();

/* GET users listing. */
router.get('/', function(req, res) {
	res.send("Sample Page");
});

module.exports = router;
