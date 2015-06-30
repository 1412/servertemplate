module.exports = {
	help: 'Evaluate command line',
	action: function(args, argtext){
	    eval(argtext)
	}
}