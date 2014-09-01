var router = require('express').Router();

/* GET users listing. */
router.get('/', function(req, res) {
	res.render('_root', { 
	  	layout: '_root_layout',
	  	title: 'Some Title Lol'
	});
});

module.exports = router;
