var os = require('os');
module.exports = {
	help: 'Display running time',
	action: function(args, argtext){
	    return 'Application has been run for: ' + os.uptime() + ' second(s)';
	}
}