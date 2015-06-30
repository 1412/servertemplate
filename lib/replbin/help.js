module.exports = {
	help: 'Show help',
	action: function(args, argtext){
	    var self = this;
		Object.keys(self.__proto__).sort().forEach(function(name) {
			var cmd = self.__proto__[name];
			for (var i in self.REPL.Client) {
				if (self.REPL.Client[i] !== undefined) {
					if (self.REPL.Client[i].outputStream !== undefined) {
						self.REPL.Client[i].outputStream.write(name + '\t - \t' + (cmd.help || '') + '\n');
					}
				}			
			}		
		});
		for (var i in self.REPL.Client) {
			if (self.REPL.Client[i] !== undefined) {
				if (self.REPL.Client[i].displayPrompt !== undefined) {
					self.REPL.Client[i].displayPrompt();
				}
			}
		}
	    return '';
	}
}