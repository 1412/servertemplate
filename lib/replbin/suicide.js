module.exports = {
	help: 'Terminate Application',
	action: function(args, argtext){
		if (this.Express !== undefined) {
			if (this.Express.suicide !== undefined) {
				this.Express.suicide();
			}
		}
	    if (this.REPL !== undefined) {
			if (this.REPL.suicide !== undefined) {
				this.REPL.suicide();
			}
		} 
	    process.exit(0);
	}
}
