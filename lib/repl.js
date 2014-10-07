var repl = require('repl'),    
    net = require('net'),
    
    LOGGER = require('./logger.js');

function REPL(context){
    this._context = context
    this.Client = {};
    this.Log = new LOGGER(this._context, "REPL");
    this.__proto__.createClient = function(prompt, socket){
        return repl.start({
            prompt: 'Server::'+prompt+'> ',
            input: (socket === undefined)? process.stdin:socket,
            output: (socket === undefined)? process.stdout:socket,
            useGlobal: true,
            eval: function (cmd, context, filename, callback) {                
                cmd = cmd.toString();
                cmd = cmd.substring(1, cmd.length-2);
                var cmdargs = [];
                var cmdarray = cmd.split(' ');
                if (cmdarray.length > 1) {
                    cmd = cmdarray.shift();
                    cmdargs = cmdarray;
                }
                var result;
                if (cmd.length == 0) {
                    result = null;
                } else if (context[cmd] === undefined) {
                    result = 'Unknown command'
                } else {
                    if (typeof(context[cmd]) == 'function') {
                        try {
                            result = context[cmd].apply(context, [cmdargs, cmdargs.join(' ')]);
                        } catch (e) {                        
                            result = {error: e, stack: e.stack};
                        }
                        if (result === undefined) {
                            result = 'Command success with no return value';
                        }
                    } else if (typeof(context[cmd]) == 'object') {
                        result = context[cmd];
                    } else {
                        result = context[cmd];
                    }
                }
                if (!this.rli.closed) {
                    callback(null, result);
                }                
            }
        });
    }
    this.__proto__.init = function(){
        if (this._context.CONFIG.repl.local.enable) {
            this.Client.local = this.createClient('Local');
            this.Client.local.context = this._context;
        }
        if (this._context.CONFIG.repl.telnet.enable) {
            this.Client.remoteserver = net.createServer(function (socket) {
                this.Client.remote = this.createClient('Telnet', socket);
                this.Client.remote.context = this._context;
            }.bind(this)).listen(this._context.CONFIG.repl.telnet.port);
            this.Log.info('Remote REPL ready to listen on port: ' + this._context.CONFIG.repl.telnet.port);
        }
    }
    this.__proto__.suicide = function(){
        if (this.Client.remoteserver !== undefined) {
            this.Client.remoteserver.close(function(){
                this.Log.info('Close REPL Telnet Server');
                this.Client.remoteserver = null;
                delete this.Client.remoteserver;
            }.bind(this));
        }
        if (this.Client.remote !== undefined) {            
            this.Client.remote.on('exit', function () {
                this.Log.info('Remote REPL interface is terminated');
                this.Client.remote = null;
                delete this.REPL.remote;
            }.bind(this));
            this.remoterepl.rli.close();
        }
        if (this.Client.local !== undefined) {            
            this.Client.local.on('exit', function () {
                this.Log.info('Local REPL interface is terminated');
                this.Client.local = null;
                delete this.Client.local;
            }.bind(this));
            this.Client.local.rli.close();
        }
    }
    this.init();
}
module.exports = REPL;