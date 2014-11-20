var repl = require('repl'),    
    net = require('net'),
    fs = require('fs'),
    LOGGER = require('./logger.js');

function REPL(context){
    this._context = context
    this.Client = {};
    this.Log = new LOGGER(this._context, 'REPL');
    function parse_expression(expression){
        var splited_expression = expression.split(".");
        for (var i = 0; i < splited_expression.length; i++) {
            var brackets = splited_expression[i].replace(/(\[[\'\"])([^\'\"\]]+)([\'\"]\])+/gm, "#!@$%#\$2");
            brackets = brackets.split("#!@$%#");
            if (brackets.length > 0) {
                splited_expression.splice.apply(splited_expression, [i, 1].concat(brackets));
            }
        }     
        return splited_expression;       
    }
    function get_property(obj, property){
        var regx = /\(([^\)]*)\)$/gm.exec(property);
        if (regx != null) {
            var params = regx[1].split(",");
            var method = property.replace(/\(([^\)]*)\)$/gm, "");
            console.log(params)
            return obj[method].apply(obj, params)
        } else {
            return obj[property]
        }        
    }
    this.__proto__.createClient = function(prompt, socket){
        return repl.start({
            prompt: 'Server::'+prompt+'> ',
            input: (socket === undefined)? process.stdin:socket,
            output: (socket === undefined)? process.stdout:socket,
            useGlobal: true,
            eval: function (cmd, context, filename, callback) {  
                cmd = cmd.toString();
                cmd = cmd.substring(1, cmd.length-2);
                var result;
                if (cmd.length == 0) {
                    result = null;
                } else if (cmd.match(/^(self|this)\.?/gm) != null) {
                    var obj = context;
                    try {
                        var expressions = parse_expression(cmd);
                        for (var i = 0; i < expressions.length; i++) {
                            if (i == 0) {
                                continue;
                            } else {
                                obj = get_property(obj, expressions[i]);
                            }                            
                        }
                        result = obj;
                    } catch (e) {                        
                        result = {error: e, stack: e.stack};
                    }
                } else {
                    var cmdargs = [];
                    var cmdarray = cmd.split(' ');
                    if (cmdarray.length > 1) {
                        cmd = cmdarray.shift();
                        cmdargs = cmdarray;
                    }
                    if (context[cmd] === undefined) {
                        result = 'Unknown command'
                    } else if (typeof(context[cmd]) == 'function') {
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
        // reserved command
        this._context['this'] = this._context['self'] = function(){
            return this;
        }
        this._context['global'] = function() {
            return global;
        }
        var bins = fs.readdirSync(__dirname + '/replbin/');
        for (var i = 0; i < bins.length; i++) {
            var bin = bins[i].split(".").slice(0,-1).join(".");
            this._context.__proto__[bin] = require('./replbin/' + bins[i]).bind(this._context);
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