var child_process = require('child_process');
module.exports = function(args, argtext){
    this.suicide();
    child_process.fork(__filename);
    process.exit(0);
}