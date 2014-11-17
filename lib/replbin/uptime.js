var os = require('os');
module.exports = function(args, argtext){
    return 'Application has been run for: ' + os.uptime() + ' second(s)';
}