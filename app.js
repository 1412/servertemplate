// Require all required modules
var node_modules_path = './node_modules/',
    fs = require('fs'),
    events = require('events'),
    domain = require('domain'),
    path = require('path'),
    os = require('os'),
    net = require('net'),
    repl = require('repl'),
    child_process = require('child_process'),
    
    MarshalJSON = require(node_modules_path + 'marshaljson'),
    configreader = require(node_modules_path + 'config-reader'),
    wget = require(node_modules_path + 'jswget'),
    
    express = require(node_modules_path + 'express'),    
    cons = require(node_modules_path + 'consolidate'),
    ejslayout = require(node_modules_path + 'express-ejs-layouts'),
    cookieParser = require(node_modules_path + 'cookie-parser'),
    bodyParser = require(node_modules_path + 'body-parser'),
    serveStatic = require(node_modules_path + 'serve-static'),
    serveIndex = require(node_modules_path + 'serve-index'),
    favicon = require(node_modules_path + 'serve-favicon'),
    responseTime = require(node_modules_path + 'response-time'),
    morgan = require(node_modules_path + 'morgan'),
    methodOverride = require(node_modules_path + 'method-override'),
    csrf = require(node_modules_path + 'csurf'),
    session = require(node_modules_path + 'cookie-session'),
    compression = require(node_modules_path + 'compression'),
    timeout = require(node_modules_path + 'connect-timeout'),
    nodemailer = require(node_modules_path + 'nodemailer'),    
    chokidar = require(node_modules_path + 'chokidar');

var Main;

// Set starttime
process.starttime = new Date();

if (console.log === undefined) {
    console.log = function () {}
}
if (console.warn === undefined) {
    console.warn = function () {}
}
if (console.error === undefined) {
    console.error = function () {}
}

if (!(fs.existsSync(path.join(__dirname, 'logs')))) {
    fs.mkdirSync(path.join(__dirname, 'logs'));
}

function SaveState() {
    var State = {};    
    // Write to file
    fs.writeFileSync(path.join(__dirname, 'state'), MarshalJSON.serialize(State));
    fs.appendFileSync(path.join(__dirname, 'logs', 'process.log'), '[INFO] ' + (new Date()).toString() + ' +> ' + 'State saved!\n');
}

var Application = function () {
    /* Do Not Modify This Part */
    this.CONFIG = (new configreader()).parseSync(path.join(__dirname, 'config.json'));
    this.__proto__.ClearLog = function () {
        /*
        fs.open(this.CONFIG.ProgramPath + '/logs/error.log', 'w+', function(err, fd){
            fs.close(fd, function(){})
        });
        fs.open(this.CONFIG.ProgramPath + '/logs/warn.log', 'w+', function(err, fd){
            fs.close(fd, function(){})
        });
        fs.open(this.CONFIG.ProgramPath + '/logs/info.log', 'w+', function(err, fd){
            fs.close(fd, function(){})
        });
        */
    }
    this.__proto__.Log = function () {
        var logpath = path.join(this.CONFIG._program_path, 'logs', 'process.log');
        var argvs = [];
        for (var i in arguments) {
            argvs.push(arguments[i]);
        }
        if (argvs.length == 0) {
            return;
        }
        var type = arguments[0];
        argvs.shift();
        switch (type) {
            case 'error':
                console.error.apply(this, argvs)
            break;
            case 'warn':
                console.warn.apply(this, argvs)
            break;
            case 'inbox':
                console.log.apply(this, argvs)
            break;
            default:
                console.log.apply(this, argvs)
            break;
        }    
        fs.appendFileSync(logpath, '[' + type.toUpperCase() + '] ' + (new Date()).toString() + ' +> ');
        for (var i = 0; i < argvs.length; i++) {
            fs.appendFileSync(logpath, argvs[i] + '\n');
        }
    }        
    this.__proto__.ClearState = function () {
        fs.writeFileSync(path.join(__dirname, 'state'), '{}');
        this.Log('info', '>> State: cleared!');
    }
    this.__proto__.LoadState = function () {
        var State = {};
        try {
            State = MarshalJSON.deserialize(fs.readFileSync(path.join(__dirname, 'state')));
        } catch (e) {}        
        //(State.OUTBOXINDEX !== undefined) ? (this.OUTBOXINDEX = State.OUTBOXINDEX) : void(0);        
        this.Log('info', '>> State: loaded!');
    },
    this.__proto__.InitREPL = function(){
        if (this.REPL !== undefined) {
            if (this.REPL.suicide !== undefined) {
                this.REPL.suicide();
            }            
        }
        this.REPL = new(function REPL(context) {
            this._context = context
            this.Client = {};
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
                    this._context.Log('info', '>> REPL: Remote REPL ready to listen on port: ' + this._context.CONFIG.repl.telnet.port);
                }
            }
            this.__proto__.suicide = function(){
                if (this.Client.remoteserver !== undefined) {
                    this.Client.remoteserver.close(function(){
                        this._context.Log('info', '>> REPL: Close REPL Telnet Server');
                        this.Client.remoteserver = null;
                        delete this.Client.remoteserver;
                    }.bind(this));
                }
                if (this.Client.remote !== undefined) {            
                    this.Client.remote.on('exit', function () {
                        this._context.Log('info', '>> REPL: Remote REPL interface is terminated');
                        this.Client.remote = null;
                        delete this.REPL.remote;
                    }.bind(this));
                    this.remoterepl.rli.close();
                }
                if (this.Client.local !== undefined) {            
                    this.Client.local.on('exit', function () {
                        this._context.Log('info', '>> REPL: Local REPL interface is terminated');
                        this.Client.local = null;
                        delete this.Client.local;
                    }.bind(this));
                    this.Client.local.rli.close();
                }
            }
            this.init();
        })(this);
        // Define command for REPL here
        this['this'] = function() {
            return this;
        }
        this['self'] = function() {
            return this;
        }
        this['global'] = function() {
            return global;
        }
        this['uptime'] = function() {
            return 'Application has been run for: ' + os.uptime() + ' second(s)';
        }
        this['suicide'] = function() {
            this.Express.suicide();
            this.REPL.suicide();
        }
        this['restart'] = function() {
            this.suicide();
            child_process.fork(__filename);
            process.exit(0);
        }
        this['help'] = function(args, argtext){
            this.ApendLog('info', 'Print Help');
        }
        this['eval'] = function(args, argtext){
            eval(argtext)
        }
    }
    this.__proto__.InitDB = function(){
        var DB = require(path.join(__dirname, 'db'));
        this.DB = new DB(this.CONFIG);
        this.DB.init({
            onbegin: function(){
                this.Log('info', '>> DB: Connecting...');
            },
            onconnected: function(){
                this.Log('info', '>> DB: Connected');
            },
            onbegindata: function(){
                this.Log('info', '>> DB: Insert initial data...');
            },
            onenddata: function(worker){
                this.Log('info', '>> DB: Finish insert initial data...' + ((worker.error.length > 0)? ' with errors:\n':'') + ((worker.error.length > 0)? JSON.stringify(worker.error,null,4):''));
            },
            onfaildata: function(worker){
                this.Log('info', '>> DB: Failed to insert initial data with errors:'+'\n' + JSON.stringify(worker.error, null, 4));
            },
            onsuccess: function(){
                this.Log('info', '>> DB: Finish synch');
            },
            onerror: function(e){
                this.Log('error', '>> DB: Error initializing: ' + JSON.stringify(e.stack.split('\n'), null, 4));
            },
            scope: this
        })
    }
    this.__proto__.InitExpress = function(callback){
        if (this.Express !== undefined) {
            if (this.Express.suicide !== undefined) {
                this.Express.suicide();
            }            
        }
        this.Express = new(function Express(context) {
            this._context = context
            
            this.__proto__.startFileWatcher = function(){
                this.fwatcher = chokidar.watch(this._routedir, {ignored: /[\/\\]\./, persistent: true});
                this.fwatcher
                    .on('add', function(path) {
                        this.route(path);
                    }.bind(this))
                    .on('addDir', function(path) {
                    }.bind(this))
                    .on('change', function(path) {
                        this.route(path);
                    }.bind(this))
                    .on('unlink', function(path) {
                        this.route(path, true);
                    }.bind(this))
                    .on('unlinkDir', function(path) {
                    }.bind(this))
                    .on('error', function(error) {
                        this._context.Log('error', '>> Express: Watcher Error ' + JSON.stringify(error.stack.split('\n'). null, 4));
                    }.bind(this));
            }
            this.__proto__.route = function(scriptpath, isremoving){
                if (scriptpath === undefined) {
                    scriptpath = this._routedir;
                }
                if (this.isWindow) {
                    scriptpath = scriptpath.replace(/\\/gi, '/');
                }
                if (isremoving) {
                    var route = scriptpath.replace(this._routedir, '').replace(/\.js$/, '');
                    var layer_index = this.app._router.layer_map["route:" + route];
                    this.app._router.stack[layer_index].handle = function (req, res, next) {
                        var err = new Error('Not Found');
                        err.status = 404;
                        next(err);
                    };
                    this._context.Log('info', '>> Express: Remove Route Stack \'' + route + '\'');
                    return;
                }
                var stat = fs.lstatSync(scriptpath);
                if (stat.isDirectory()) {
                    //TODO: should handle new/rename/remove route dir
                    var files = fs.readdirSync(scriptpath);
                    for (var i = 0; i < files.length; i++) {
                        this.SetExpressRoute(scriptpath + path.sep + files[i])
                    }
                } else if (stat.isFile()) {
                    if (path.extname(scriptpath) == '.js') {
                        var route = scriptpath.replace(this._routedir, '').replace(/\.js$/, '');
                        if (route == '/_root') {
                            route = '/';
                        }            
                        delete require.cache[require.resolve(scriptpath)];
                        var isrouter = false;
                        var routescript = {};
                        try {
                            routescript = require(scriptpath);
                        } catch (e){
                            this._context.Log('warn', '>> Express: Ignoring error route: ' + route + ' ~ >' + scriptpath);
                            this._context.Log('warn', JSON.stringify(e.stack.split('\n'), null, 4));
                        }
                        if (routescript.__proto__ == express.Router().__proto__) {
                            isrouter = true;
                            var layer_index = this.app._router.layer_map["route:" + route];
                            var stack = this.app._router.stack[layer_index];
                            if (stack) {
                                this.app._router.stack[layer_index].handle = routescript;
                                this._context.Log('info', '>> Express: Replace Route Stack \'' + route + '\'');
                            } else {
                                this.setErrorHandlers();
                                this.app.use(route, routescript);
                                this.app._router.layer_map["route:" + route] = (this.app._router.stack.length - 1);
                                this._context.Log('info', '>> Express: Add Route Stack \'' + route + '\'');   
                                this.setErrorHandlers();
                            }
                        }
                    }
                }
            }            
            this.__proto__.setErrorHandlers = function(){
                var notfound_stack_id = this.app._router.layer_map["errhandler:NotFoundErrorHandler"];
                var servererror_stack_id = this.app._router.layer_map["errhandler:ServerErrorHandler"];
                if (notfound_stack_id === undefined) {
                    function NotFoundErrorHandler (req, res, next) {
                        var err = new Error('Not Found');
                        err.status = 404;
                        next(err);
                    }
                    this.app.use(NotFoundErrorHandler);
                    this.app._router.layer_map["errhandler:NotFoundErrorHandler"] = this.app._router.stack.length - 1;
                } else {
                    this.app._router.stack.splice(notfound_stack_id, 1);
                    delete this.app._router.layer_map["errhandler:NotFoundErrorHandler"];
                }
                if (servererror_stack_id === undefined) {
                    function ServerErrorHandler (err, req, res, next) {
                        res.status(err.status || 500);
                        res.render('error', {
                            message: err.message,
                            error: err
                        });
                    }
                    this.app.use(ServerErrorHandler);
                    this.app._router.layer_map["errhandler:ServerErrorHandler"] = this.app._router.stack.length - 1;
                } else {
                    this.app._router.stack.splice(notfound_stack_id, 1);
                    delete this.app._router.layer_map["errhandler:ServerErrorHandler"];
                }
            }
            this.__proto__.suicide = function(){
                if (this.fwatcher !== undefined) {
                    this.fwatcher.close();
                    delete this.fwatcher;
                    delete this.fwatcher;
                }
                if (this.server !== undefined) {
                    this.server.close();
                    this._context.Log('info', '>> Express: Stop listening');
                    delete this.server;
                }
            }
            this.__proto__.init = function(){
                this.app = express();
                this.isWindow = /^win/.test(process.platform);
                this._publicdir = path.join(__dirname, 'public');
                this._routedir = path.join(__dirname, 'routes');
                this._viewdir = path.join(__dirname, 'views');    
                if (this.isWindow) {
                    this._publicdir = path.join(__dirname, 'public').replace(/\\/gi, '/');
                    this._routedir = path.join(__dirname, 'routes').replace(/\\/gi, '/');
                    this._viewdir = path.join(__dirname, 'views').replace(/\\/gi, '/');
                }        
                // view engine setup
                this.app.set('title', this._context.CONFIG.site.title);
                this.app.set('x-powered-by', this._context.CONFIG.site['powered-by']);
                this.app.set('views', this._viewdir);
                this.app.engine('ejs', cons.ejs);
                // this.app.set('view engine', 'jade');
                this.app.set('view engine', 'ejs');
                this.app.set('layout', 'layout');
                this.app.use(ejslayout);
                this.app.use(timeout());
                this.app.use(session({
                    keys: [this._context.CONFIG.site.session_secret]
                }));
                this.app.use(bodyParser.json());
                this.app.use(bodyParser.urlencoded());
                this.app.use(cookieParser());
                this.app.use(serveStatic(this._publicdir, {'index': ['default.html', 'default.htm', 'index.htm', 'index.html']}));
                if (this._context.CONFIG.site.serve_index) {
                    this.app.use(serveIndex(this._publicdir, {'icons': true}));
                }
                this.app.use(favicon(path.join(this._publicdir, 'favicon.ico')));
                this.app.use(responseTime());
                this.app.use(morgan('dev'));
                this.app.use(methodOverride('X-HTTP-Method'))          // Microsoft
                this.app.use(methodOverride('X-HTTP-Method-Override')) // Google/GData
                this.app.use(methodOverride('X-Method-Override'))      // IBM
                this.app.use(methodOverride(function(req, res){
                    if (req.body && typeof req.body === 'object' && '_method' in req.body) {
                        // look in urlencoded POST bodies and delete it
                        var method = req.body._method
                        delete req.body._method
                        return method
                    }
                }));
                // app.use(csrf());
                this.app.use(compression({
                    threshold: 512
                }));
                this.app.use(function (req, res, next){
                    if (!req.timedout) next();
                });

                this.app._router.layer_map = {};
                for (var i in this.app._router.stack) {
                    var name = this.app._router.stack[i].handle.name;
                    if (name.length == 0) {
                        name = "unamed" + Math.random().toFixed(3) * 1000;
                    }
                    name = "config:" + name;
                    this.app._router.layer_map[name] = i;
                }
                this.setErrorHandlers();
                this.server = this.app.listen(this._context.CONFIG.site.listen_port);                
                this._context.Log('info', '>> Express: listening to port: ' + this._context.CONFIG.site.listen_port);
                this.startFileWatcher();
            }
            this.init();
        })(this);
    }
    this.__proto__.ParseCommandSwitches = function () {
        this.SWITCHARGV = {};
        for (var i in this.CONFIG.switches) {
            this.SWITCHARGV[i] = false;
            for (var n = 0; n < this.CONFIG.switches[i].commands.length; n++) {
                if (process.argv.indexOf(this.CONFIG.switches[i].commands[n]) > -1) {
                    if (this.CONFIG.switches[i].needvalue) {
                        this.SWITCHARGV[i] = process.argv.splice(process.argv.indexOf(this.CONFIG.switches[i].commands[n]) + 1, 1);
                    } else {
                        this.SWITCHARGV[i] = true;
                    }
                    process.argv.splice(process.argv.indexOf(this.CONFIG.switches[i].commands[n]), 1);
                }
            }
        }
        // Declare RUNMODE Here 
        this.RUNMODE = 'default';
        if (this.SWITCHARGV.resetstate != false) {
            this.RUNMODE = "resetstate";
        }
    };
    // End of Do not Modify this Part 
    
    this.__proto__.init = function () {
        this.ParseCommandSwitches();
        this.ClearLog();
        this.LoadState();
        // Declare RUNMODE Here 
        switch (this.RUNMODE) {
            case "resetstate": {
                this.ClearState();
            } break;
            default: {
                this.InitREPL();
                this.InitDB();
                this.InitExpress();
            } break;
        }
    }
    return this;
};

Application.prototype.__proto__ = events.EventEmitter.prototype;
process.on('uncaughtException', function (er) {
    console.error(JSON.stringify(er.stack.split('\n'), null, 4));    
    fs.appendFileSync(path.join(__dirname, 'logs', 'process.log'), '[FATAL ERROR] ' + (new Date()).toString() + ' +> ' + JSON.stringify(er.stack.split('\n'), null, 4) + '\n');
});
process.on('SIGABRT', function () {
    console.log('Got Process abort signal. Try to exit');
    fs.appendFileSync(path.join(__dirname, 'logs', 'process.log'), '[FATAL ERROR] ' + 'SIGABRT');
    process.exit(1);
});
process.on('SIGINT', function () {
    console.log('Got Terminal interrupt signal. Try to exit');
    fs.appendFileSync(path.join(__dirname, 'logs', 'process.log'), '[FATAL ERROR] ' + 'SIGINT');
    process.exit(0);
});
process.on('SIGTERM', function () {
    console.log('Got Termination signal. Try to exit');
    fs.appendFileSync(path.join(__dirname, 'logs', 'process.log'), '[FATAL ERROR] ' + 'SIGTERM');
    process.exit(0);
});
process.on('exit', function () {
    console.error('Program is terminated');
    fs.appendFileSync(path.join(__dirname, 'logs', 'process.log'), '[EXIT] ' + (new Date()).toString() + ' +> ' + 'Program is terminated!\n');
    if (Main !== undefined) {
        if (Main.RUNMODE == 'default') {
            SaveState();
        }
    }
});

/*
process.on('SIGALRM', function() {
    console.log('Got Alarm clock. Try to exit');
    fs.appendFileSync(__dirname + '/logs/process.log', '[FATAL ERROR] ' + 'SIGALRM');
    process.exit(1);
});
process.on('SIGFPE', function() {
    console.log('Got Erroneous arithmetic operation. Try to exit');
    fs.appendFileSync(__dirname + '/logs/process.log', '[FATAL ERROR] ' + 'SIGFPE');
    process.exit(1);
});
process.on('SIGHUP', function() {
    console.log('Got Hangup. Try to exit');
    fs.appendFileSync(__dirname + '/logs/process.log', '[FATAL ERROR] ' + 'SIGHUP');
    process.exit(1);
});
process.on('SIGILL', function() {
    console.log('Got Illegal instruction. Try to exit');
    fs.appendFileSync(__dirname + '/logs/process.log', '[FATAL ERROR] ' + 'SIGILL');
    process.exit(1);
});
process.on('SIGKILL', function() {
    console.log('Got Killed. Try to exit');
    fs.appendFileSync(__dirname + '/logs/process.log', '[FATAL ERROR] ' + 'SIGILL');
    process.exit(0);
});
process.on('SIGPIPE', function() {
    console.log('Write on a pipe with no one to read it. Try to exit');
    fs.appendFileSync(__dirname + '/logs/process.log', '[FATAL ERROR] ' + 'SIGPIPE');
    process.exit(0);
});
process.on('SIGQUIT', function() {
    console.log('Got Terminal quit signal. Try to exit');
    fs.appendFileSync(__dirname + '/logs/process.log', '[FATAL ERROR] ' + 'SIGQUIT');
    process.exit(0);
});
process.on('SIGSEGV', function() {
    console.log('Invalid memory reference. Try to exit');
    fs.appendFileSync(__dirname + '/logs/process.log', '[FATAL ERROR] ' + 'SIGSEGV');
    process.exit(0);
});
process.on('SIGUSR1', function() {
    console.log('Got User-defined signal 1. Try to exit');
    fs.appendFileSync(__dirname + '/logs/process.log', '[FATAL ERROR] ' + 'SIGUSR1');
    process.exit(0);
});
process.on('SIGUSR2', function() {
    console.log('Got User-defined signal 2. Try to exit');
    fs.appendFileSync(__dirname + '/logs/process.log', '[FATAL ERROR] ' + 'SIGUSR2');
    process.exit(0);
});
process.on('SIGCHLD', function() {
    console.log('Child process terminated or stopped. Try to exit');
    process.exit(0);
});
process.on('SIGCONT', function() {
    console.log('Continue executing, if stopped. Try to exit');
    fs.appendFileSync(__dirname + '/logs/process.log', '[FATAL ERROR] ' + 'SIGCONT');
    process.exit(0);
});
process.on('SIGCONT', function() {
    console.log('Got Stop executing signal. Try to exit');
    fs.appendFileSync(__dirname + '/logs/process.log', '[FATAL ERROR] ' + 'SIGCONT');
    process.exit(0);
});
process.on('SIGTSTP', function() {
    console.log('Got Terminal stop signal. Try to exit');
    fs.appendFileSync(__dirname + '/logs/process.log', '[FATAL ERROR] ' + 'SIGTSTP');
    process.exit(0);
});
process.on('SIGTTIN', function() {
    console.log('Background process attempting read. Try to exit');
    fs.appendFileSync(__dirname + '/logs/process.log', '[FATAL ERROR] ' + 'SIGTTIN');
    process.exit(0);
});
process.on('SIGTTOU', function() {
    console.log('Background process attempting write. Try to exit');
    fs.appendFileSync(__dirname + '/logs/process.log', '[FATAL ERROR] ' + 'SIGTTOU');
    process.exit(0);
});
process.on('SIGBUS', function() {
    console.log('Bus error. Try to exit');
    fs.appendFileSync(__dirname + '/logs/process.log', '[FATAL ERROR] ' + 'SIGBUS');
    process.exit(0);
});
process.on('SIGPOLL', function() {
    console.log('Pollable event. Try to exit');
    fs.appendFileSync(__dirname + '/logs/process.log', '[FATAL ERROR] ' + 'SIGPOLL');
    process.exit(0);
});
process.on('SIGPROF', function() {
    console.log('Profiling timer expired. Try to exit');
    fs.appendFileSync(__dirname + '/logs/process.log', '[FATAL ERROR] ' + 'SIGPROF');
    process.exit(0);
});
process.on('SIGSYS', function() {
    console.log('Bad system call. Try to exit');
    fs.appendFileSync(__dirname + '/logs/process.log', '[FATAL ERROR] ' + 'SIGSYS');
    process.exit(0);
});
process.on('SIGTRAP', function() {
    console.log('Trace/breakpoint trap. Try to exit');
    fs.appendFileSync(__dirname + '/logs/process.log', '[FATAL ERROR] ' + 'SIGTRAP');
    process.exit(0);
});
process.on('SIGURG', function() {
    console.log('High bandwidth data is available at a socket. Try to exit');
    fs.appendFileSync(__dirname + '/logs/process.log', '[FATAL ERROR] ' + 'SIGURG');
    process.exit(0);
});
process.on('SIGVTALRM', function() {
    console.log('Virtual timer expired. Try to exit');
    fs.appendFileSync(__dirname + '/logs/process.log', '[FATAL ERROR] ' + 'SIGVTALRM');
    process.exit(0);
});
process.on('SIGXCPU', function() {
    console.log('CPU time limit exceeded. Try to exit');
    fs.appendFileSync(__dirname + '/logs/process.log', '[FATAL ERROR] ' + 'SIGXCPU');
    process.exit(0);
});
process.on('SIGXFSZ', function() {
    console.log('File size limit exceeded. Try to exit');
    fs.appendFileSync(__dirname + '/logs/process.log', '[FATAL ERROR] ' + 'SIGXFSZ');
    process.exit(0);
});
*/

var Domain = domain.create();
Domain.on('error', function (er) {
    console.error('Domain Error: ', JSON.stringify(er.stack.split('\n'), null, 4));
    fs.appendFileSync(path.join(__dirname, 'logs', 'process.log'), '[FATAL ERROR] ' + (new Date()).toString() + ' +> ' + JSON.stringify(er.stack.split('\n'), null, 4) + '\n');
});
Domain.run(function () {
    Main = new Application();
    Main.init();
});
