var log4js = require('log4js'),
    path = require('path');

function LOGGER(context, category){
    this._category = (category === undefined)? "MAIN":category;
    this._context = (context === null)? {
        CONFIG:{
            _program_path:require('path').dirname(require.main.filename).replace(/\\/gi, "/")
        }
    }:context;
    this.__proto__.log = function(){
        this.Logger.log.apply(this.Logger, arguments);
    }
    this.__proto__.info = function(){
        this.Logger.info.apply(this.Logger, arguments);
    }
    this.__proto__.warn = function(){
        this.Logger.warn.apply(this.Logger, arguments);
    }
    this.__proto__.error = function(){
        this.Logger.error.apply(this.Logger, arguments);
    }
    this.__proto__.formatInput = function(arg){
        var result = [];
        var i = 0;
        for (var key in arg) {
            result[i] = arg[key];
            i++;
        }
        return result;
    }
    this.__proto__.init = function(){
        var logpath = path.join(this._context.CONFIG._program_path, 'logs', 'process.log');
        var errorpath = path.join(this._context.CONFIG._program_path, 'logs', 'error.log');        
        log4js.configure({
            appenders: [
                { type: 'console' },
                { type: 'file', filename: logpath, category: this._category }
            ],
            replaceConsole: true
        });
        this.Logger = log4js.getLogger(this._category);
        this.Logger.setLevel('DEBUG');
    }
    this.init();
}

module.exports = LOGGER;