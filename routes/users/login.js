var router = require('express').Router();

/* GET users listing. */
router.post('/', function(req, res) {
    console.log(req.headers);
    console.log(req.body)
	res.send(req.query);
});

module.exports = router;
