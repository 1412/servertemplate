module.exports = {
	help: 'Restarting Application',
	action: function(args, argtext){
	    this.require_repl('suicide');
	    child_process.fork(this.app_script);
	    this.suicide.action();
	}
}