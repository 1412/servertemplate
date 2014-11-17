var router = require('express').Router();
var jswget = require('jswget');

/* GET users listing. */
router.get('/', function(req, res, next) {
    jswget({
        cookiefile: "./locatr_cookies.txt",
        url : "http://locatr.co/login",
        method : "post",
        formdata : {
            username: "admin",
            password:12345
        },
        onsend: function(request, opt){
            console.log("Login");
        },
        onerror: function(err, request, opt){
            console.log(err)
        },
        onsuccess: function(restext, request, response, opt){
            res.end(restext);
        },
        onend: function(request, opt){
        }
    });	
});

module.exports = router;
