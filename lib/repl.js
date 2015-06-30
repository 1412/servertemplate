var repl = require('repl'),    
    net = require('net'),
    fs = require('fs'),
    path = require('path'),
    chokidar = require('chokidar'),
    LOGGER = require('./logger.js'),
    vm = require('vm');

function REPL(context){
    this._context = context
    this.Client = {};
    this.binpath = __dirname + '/replbin/';
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
            if (obj[method] !== undefined) {
                if (obj[method] instanceof Function) {
                    return obj[method].apply(obj, params);
                } else {
                    return 'Try to call non-function';
                }                
            } else {
                return 'Try to call non-exsist function';
            }            
        } else {
            return obj[property]
        }        
    }
    this.__proto__.createClient = function(prompt, socket){
        var client = repl.start({
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
                    var firstword;
                    if (cmdarray.length > 1) {
                        firstword = cmdarray.shift();
                        cmdargs = cmdarray;
                    } else {
                        firstword = cmd
                    }
                    if (context[firstword] === undefined) {
                        try {
                            result = vm.runInThisContext(cmd);
                        } catch (e) {
                            result = e.toString();
                        }
                    } else if (typeof(context[firstword]) == 'function') {
                        try {
                            result = context[firstword].apply(context, [cmdargs, cmdargs.join(' ')]);
                        } catch (e) {                        
                            result = {error: e, stack: e.stack};
                        }
                        if (result === undefined) {
                            result = 'Command success with no return value';
                        }
                    } else if (typeof(context[firstword]) == 'object') {
                        if (context[firstword].action !== undefined) {
                            if (typeof(context[firstword].action) == 'function') {
                                try {
                                    result = context[firstword].action.apply(context, [cmdargs, cmdargs.join(' ')]);
                                } catch (e) {                        
                                    result = {error: e, stack: e.stack};
                                }
                                if (result === undefined) {
                                    result = 'Command success with no return value';
                                }
                            } else {
                                result = context[firstword];
                            }
                        } else {
                            result = context[firstword];
                        }
                    } else {
                        result = context[firstword];
                    }
                }
                if (!this.rli.closed) {
                    callback(null, result);
                }                
            }
        });
        return 
    }
    this.__proto__.startFileWatcher = function(){
        this.fwatcher = chokidar.watch(this.binpath, {ignored: /[\/\\]\./, persistent: true});
        this.fwatcher
            .on('add', function(path) {
                this.loadbin(path);
            }.bind(this))
            .on('addDir', function(path) {
            }.bind(this))
            .on('change', function(path) {
                this.loadbin(path);
            }.bind(this))
            .on('unlink', function(path) {
                this.unloadbin(path);
            }.bind(this))
            .on('unlinkDir', function(path) {
            }.bind(this))
            .on('error', function(error) {
                this.Log.error('Watcher Error ' + JSON.stringify(error.stack.split('\n'). null, 4));
            }.bind(this));
    }
    this.__proto__.reloadbin = function(){        
        // reserved command
        this._context['this'] = this._context['self'] = function(){
            return this;
        }
        this._context['global'] = function() {
            return global;
        }
        this._context['require_repl'] = function(binname) {
            this.REPL.loadbin(this.REPL.binpath + binname + ".js");
        }.bind(this._context)
        this.startFileWatcher();
    }
    this.__proto__.loadbin = function(_path) {
        var ext = path.extname(_path);
        var bin = path.basename(_path, ext);
        if (ext == '.js') {
            try {
                var is_replacing = false
                if (require.cache[_path]){
                    is_replacing = true;
                    if (require.cache[_path]){
                        delete require.cache[_path];
                    }
                }
                var command = require(this.binpath + bin)
                if (command.action !== undefined) {
                    if (typeof(command.action) == 'function') {
                        command.action.bind(this._context);
                    }
                }                
                this._context.__proto__[bin] = command
                if (is_replacing) {                   
                    this.Log.info('Updating bin \'' + bin + '\'');
                } else {
                    this.Log.info('Add new bin: \'' + bin + '\'');
                }
                this.onchange.apply(this._context, []);
            } catch (e){
                this.Log.warn('Ignoring error bin: ' + bin + ' ~ >' + _path, e.stack);
            }
            return bin;
        } else {
            return '';
        }        
    }
    this.__proto__.unloadbin = function(_path){
        var ext = path.extname(_path);
        var bin = path.basename(_path, ext);
        if (ext == '.js') {
            this._context.__proto__[bin] = undefined;
            delete this._context.__proto__[bin];
        }
        if (require.cache[_path]){
            delete require.cache[_path];
        }
        this.Log.info('Remove bin: \'' + bin + '\'');
        this.onchange.apply(this._context, []);
    }
    this.__proto__.init = function(){
        this.onchange = function(){};
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
        this.reloadbin();
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