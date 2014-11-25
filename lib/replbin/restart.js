var child_process = require('child_process');
module.exports = function(args, argtext){
    this.require_repl('suicide');
    child_process.fork(this.app_script);
    this.suicide();
}