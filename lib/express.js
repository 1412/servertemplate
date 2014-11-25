var express = require('express'),
    fs = require('fs'),    
    path = require('path'),
    cons = require('consolidate'),
    ejslayout = require('express-ejs-layouts'),
    cookieParser = require('cookie-parser'),
    bodyParser = require('body-parser'),
    serveStatic = require('serve-static'),
    serveIndex = require('serve-index'),
    favicon = require('serve-favicon'),
    responseTime = require('response-time'),
    morgan = require('morgan'),
    methodOverride = require('method-override'),
    csrf = require('csurf'),
    session = require('cookie-session'),
    compression = require('compression'),
    timeout = require('connect-timeout'),
    chokidar = require('chokidar'),
    
    LOGGER = require('./logger.js');
function EXPRESS(context){
    this._context = context
    this.Log = new LOGGER(this._context, 'EXPRESS');
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
                this.Log.error('Watcher Error ' + JSON.stringify(error.stack.split('\n'). null, 4));
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
            if (require.cache[scriptpath]){
                delete require.cache[scriptpath];
            }
            this.Log.info('Remove Route Stack \'' + route + '\'');
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
                var root_path = "_root";
                if (route.indexOf(root_path, route.length - root_path.length) !== -1) {
                    route = route.replace(new RegExp(root_path + '$'), '');
                }
                delete require.cache[require.resolve(scriptpath)];
                var isrouter = false;
                var routescript = {};
                try {
                    routescript = require(scriptpath);
                } catch (e){
                    this.Log.warn('Ignoring error route: \'' + route + '\' ~ >' + scriptpath, e.stack);
                }
                if (routescript.__proto__ == express.Router().__proto__) {
                    isrouter = true;
                    var layer_index = this.app._router.layer_map["route:" + route];
                    var stack = this.app._router.stack[layer_index];
                    if (stack) {
                        this.app._router.stack[layer_index].handle = routescript;
                        this.Log.info('Replace Route Stack \'' + route + '\'');
                    } else {
                        this.setErrorHandlers();
                        this.app.use(route, routescript);
                        this.app._router.layer_map["route:" + route] = (this.app._router.stack.length - 1);
                        this.Log.info('Add Route Stack \'' + route + '\'');   
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
            this.Log.info('Stop listening');
            delete this.server;
        }
    }
    this.__proto__.init = function(){
        this.app = express();
        this.isWindow = /^win/.test(process.platform);
        this._publicdir = path.join(this._context.CONFIG._program_path, 'public');
        this._routedir = path.join(this._context.CONFIG._program_path, 'routes');
        this._viewdir = path.join(this._context.CONFIG._program_path, 'views');    
        if (this.isWindow) {
            this._publicdir = path.join(this._context.CONFIG._program_path, 'public').replace(/\\/gi, '/');
            this._routedir = path.join(this._context.CONFIG._program_path, 'routes').replace(/\\/gi, '/');
            this._viewdir = path.join(this._context.CONFIG._program_path, 'views').replace(/\\/gi, '/');
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
        this.app.use(timeout(this._context.CONFIG.site.timeout));
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
                name = 'unamed' + Math.random().toFixed(3) * 1000;
            }
            name = 'config:' + name;
            this.app._router.layer_map[name] = i;
        }
        this.setErrorHandlers();
        this.server = this.app.listen(this._context.CONFIG.site.listen_port);                
        this.Log.info('listening to port: ' + this._context.CONFIG.site.listen_port);
        this.startFileWatcher();
    }
    this.init();
}
module.exports = EXPRESS;