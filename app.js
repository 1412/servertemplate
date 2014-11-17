// Require all required modules
var node_modules_path = './node_modules/',
    fs = require('fs'),
    events = require('events'),
    domain = require('domain'),
    path = require('path'),
    net = require('net'),
    
    _ = require(node_modules_path + 'underscore'),
    MarshalJSON = require(node_modules_path + 'marshaljson'),
    configreader = require(node_modules_path + 'config-reader'),
    wget = require(node_modules_path + 'jswget'),
    nodemailer = require(node_modules_path + 'nodemailer'),    
    
    LOGGER = require('./lib/logger.js'),
    REPL = require('./lib/repl.js'),
    EXPRESS = require('./lib/express.js');
var Main;

// Set starttime
process.starttime = new Date();

if (!(fs.existsSync(path.join(__dirname, 'logs')))) {
    fs.mkdirSync(path.join(__dirname, 'logs'));
}

var loger = new LOGGER(null, "TERMINAL");
if (typeof(console) != "object") {
    console = {};
}
console.log = function () {
    loger.info.apply(loger, arguments);
}
console.warn = function () {
    loger.warn.apply(loger, arguments);
}
console.error = function () {
    loger.error.apply(loger, arguments);
}

function SaveState() {
    var State = {};    
    // Write to file
    fs.writeFileSync(path.join(__dirname, 'state'), MarshalJSON.serialize(State));
    loger.info("State saved!");
}

var Application = function () {
    /* Do Not Modify This Part */
    this.CONFIG = (new configreader()).parseSync(path.join(__dirname, 'config.json'));
    this.__proto__.InitLoger = function () {
        this.Log = new LOGGER(this);
    }
    this.__proto__.ClearLog = function () {
        fs.open(this.CONFIG._program_path + '/logs/error.log', 'w+', function(err, fd){
            fs.close(fd, function(){})
        });
        fs.open(this.CONFIG._program_path + '/logs/warn.log', 'w+', function(err, fd){
            fs.close(fd, function(){})
        });
        fs.open(this.CONFIG._program_path + '/logs/info.log', 'w+', function(err, fd){
            fs.close(fd, function(){})
        });
    }    
    this.__proto__.ClearState = function () {
        fs.writeFileSync(path.join(__dirname, 'state'), '{}');
        this.Log.info('>> State: cleared!');
    }
    this.__proto__.LoadState = function () {
        var State = {};
        try {
            State = MarshalJSON.deserialize(fs.readFileSync(path.join(__dirname, 'state')));
        } catch (e) {}        
        //(State.OUTBOXINDEX !== undefined) ? (this.OUTBOXINDEX = State.OUTBOXINDEX) : void(0);        
        this.Log.info('>> State: loaded!');
    },
    this.__proto__.InitREPL = function(){
        if (this.REPL !== undefined) {
            if (this.REPL.suicide !== undefined) {
                this.REPL.suicide();
            }            
        }
        this.REPL = new REPL(this);
        _.extend(this, this.REPL._context);
    }
    this.__proto__.InitDB = function(){
        switch (this.CONFIG.db.enggine) {
            case "mysql": {
                var DB = require(path.join(__dirname, 'db'));
                this.DB = new DB(this.CONFIG);
                this.DB.Log = new LOGGER(this, "DB");
                this.DB.init({
                    onbegin: function(){
                        this.DB.Log.info('Connecting...');
                    },
                    onconnected: function(){
                        this.DB.Log.info('Connected');
                    },
                    onbegindata: function(){
                        this.DB.Log.info('Insert initial data...');
                    },
                    onenddata: function(worker){
                        this.DB.Log.info('Finish insert initial data...', ((worker.error.length > 0)? ' with errors:\n':''), ((worker.error.length > 0)? worker.error:''));
                    },
                    onfaildata: function(worker){
                        this.DB.Log.info('Failed to insert initial data with errors:'+'\n' + worker.error);
                    },
                    onsuccess: function(){
                        this.DB.Log.info('Finish synch');
                    },
                    onerror: function(e){
                        this.DB.Log.error('Error initializing: ', e);
                    },
                    scope: this
                })
            } break;
            default: {
            } break;
        };        
    }
    this.__proto__.InitExpress = function(callback){
        if (this.Express !== undefined) {
            if (this.Express.suicide !== undefined) {
                this.Express.suicide();
            }            
        }
        this.Express = new EXPRESS(this);
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
        this.InitLoger();
        this.ParseCommandSwitches();
        // this.ClearLog();
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
    console.error(er.stack);
    fs.appendFileSync(path.join(__dirname, 'logs', 'process.log'), '[FATAL ERROR] ' + (new Date()).toString() + ' +> ' + JSON.stringify(er.stack.split('\n'), null, 4) + '\n');
});
process.on('SIGABRT', function () {
    console.warn('Got Process abort signal. Try to exit');
    fs.appendFileSync(path.join(__dirname, 'logs', 'process.log'), '[WARN] ' + (new Date()).toString() + ' +> ' + 'Got Process abort signal. Try to exit' + '\n');
    process.exit(1);
});
process.on('SIGINT', function () {
    console.warn('Got Terminal interrupt signal. Try to exit');
    fs.appendFileSync(path.join(__dirname, 'logs', 'process.log'), '[WARN] ' + (new Date()).toString() + ' +> ' + 'Got Process abort signal. Try to exit' + '\n');
    process.exit(0);
});
process.on('SIGTERM', function () {
    console.warn('Got Termination signal. Try to exit');
    fs.appendFileSync(path.join(__dirname, 'logs', 'process.log'), '[WARN] ' + (new Date()).toString() + ' +> ' + 'Got Process abort signal. Try to exit' + '\n');
    process.exit(0);
});
process.on('exit', function () {
    console.warn('Program is terminated');    
    fs.appendFileSync(path.join(__dirname, 'logs', 'process.log'), '[WARN] ' + (new Date()).toString() + ' +> ' + 'Program is terminated' + '\n');
    if (Main !== undefined) {
        if (Main.RUNMODE == 'default') {
            SaveState();
        }
    }
});

/*
process.on('SIGALRM', function() {
    loger.warn('Got Alarm clock. Try to exit');
    process.exit(1);
});
process.on('SIGFPE', function() {
    loger.warn('Got Erroneous arithmetic operation. Try to exit');
    process.exit(1);
});
process.on('SIGHUP', function() {
    loger.warn('Got Hangup. Try to exit');
    process.exit(1);
});
process.on('SIGILL', function() {
    loger.warn('Got Illegal instruction. Try to exit');
    process.exit(1);
});
process.on('SIGKILL', function() {
    loger.warn('Got Killed. Try to exit');
    process.exit(0);
});
process.on('SIGPIPE', function() {
    loger.warn('Write on a pipe with no one to read it. Try to exit');
    process.exit(0);
});
process.on('SIGQUIT', function() {
    loger.warn('Got Terminal quit signal. Try to exit');
    process.exit(0);
});
process.on('SIGSEGV', function() {
    loger.warn('Invalid memory reference. Try to exit');
    process.exit(0);
});
process.on('SIGUSR1', function() {
    loger.warn('Got User-defined signal 1. Try to exit');
    process.exit(0);
});
process.on('SIGUSR2', function() {
    loger.warn('Got User-defined signal 2. Try to exit');
    process.exit(0);
});
process.on('SIGCHLD', function() {
    loger.warn('Child process terminated or stopped. Try to exit');
    process.exit(0);
});
process.on('SIGCONT', function() {
    loger.warn('Continue executing, if stopped. Try to exit');
    process.exit(0);
});
process.on('SIGCONT', function() {
    loger.warn('Got Stop executing signal. Try to exit');
    process.exit(0);
});
process.on('SIGTSTP', function() {
    loger.warn('Got Terminal stop signal. Try to exit');
    process.exit(0);
});
process.on('SIGTTIN', function() {
    loger.warn('Background process attempting read. Try to exit');
    process.exit(0);
});
process.on('SIGTTOU', function() {
    loger.warn('Background process attempting write. Try to exit');
    process.exit(0);
});
process.on('SIGBUS', function() {
    loger.warn('Bus error. Try to exit');
    process.exit(0);
});
process.on('SIGPOLL', function() {
    loger.warn('Pollable event. Try to exit');
    process.exit(0);
});
process.on('SIGPROF', function() {
    loger.warn('Profiling timer expired. Try to exit');
    process.exit(0);
});
process.on('SIGSYS', function() {
    loger.warn('Bad system call. Try to exit');
    process.exit(0);
});
process.on('SIGTRAP', function() {
    loger.warn('Trace/breakpoint trap. Try to exit');
    process.exit(0);
});
process.on('SIGURG', function() {
    loger.warn('High bandwidth data is available at a socket. Try to exit');
    process.exit(0);
});
process.on('SIGVTALRM', function() {
    loger.warn('Virtual timer expired. Try to exit');
    process.exit(0);
});
process.on('SIGXCPU', function() {
    loger.warn('CPU time limit exceeded. Try to exit');
    process.exit(0);
});
process.on('SIGXFSZ', function() {
    loger.warn('File size limit exceeded. Try to exit');
    process.exit(0);
});
*/

var Domain = domain.create();
Domain.on('error', function (er) {
    console.error('Domain Error: ', er.stack);
    fs.appendFileSync(path.join(__dirname, 'logs', 'process.log'), '[FATAL ERROR] ' + (new Date()).toString() + ' +> ' + JSON.stringify(er.stack.split('\n'), null, 4) + '\n');
});
Domain.run(function () {
    Main = new Application();
    Main.init();
});
