var SEQUELIZE = require('sequelize'),
    plural = require('plural'),
    fs = require('fs'),
    LOGGER = require('../lib/logger.js');
var DB = function(context){
    this._context = context;
    this.config = this._context.CONFIG;
    this.Log = new LOGGER(this._context, 'DB');
    this.basepath = __dirname;
	this.schema = require('./schema.js');
	this.task = require('./initial.js');	
	this.__version = this.schema.__version;
    this.__proto__.dbrev = function(options){
        options = (options === undefined || typeof(options) != "object")? {}:options;
        options.onerror = (options.onerror === undefined)? function(){}:options.onerror;
		options.onsuccess = (options.onsuccess === undefined)? function(){}:options.onsuccess;
        options.scope = (options.scope === undefined)? this:options.scope;
        options.taskset = (options.taskset === undefined)? []:options.taskset;
        this.schema["_app_"].find(1).success(function(appinfo) {
            var unshift_initial_task = [];
            var dbrev_reference = appinfo;
            if (appinfo == null) {
                unshift_initial_task.push({
                    ref: "_app_init_",
                    task: "create",
                    table: "_app_",
                    continueOnError: false,
                    data: {
                        name: this.config.application.name,
                        version: this.config.application.version,
                        schemaVersion: this.schema.__version,
                        dbRev: 0, 
                        owner: this.config.application.owner,
                        address: this.config.application.address
                    }
                });                        
                dbrev_reference = "_app_init_";
            }                    
            unshift_initial_task.push({
                ref: "_dbrev_init_",
                task: "dbrev",
                use: dbrev_reference,
                continueOnError: false
            });
            options.taskset.splice.apply(options.taskset, [0, 0].concat(unshift_initial_task));
            this.starttaskworker(options.taskset);
            options.onsuccess.apply(options.scope, [this])
        }.bind(this)).error(function(e){
            options.onerror.apply(options.scope, [e, this])
            return;
        }.bind(this));
    }
    this.__proto__.preinit = function() {
		/* Modify Task Config */        
        this.schema._app_ = {
            name: SEQUELIZE.STRING(100),
            version: SEQUELIZE.STRING(10),
            schemaVersion: SEQUELIZE.STRING(10),
            dbRev: SEQUELIZE.INTEGER(100), 
            owner: SEQUELIZE.STRING(100),
            address: SEQUELIZE.STRING,
            note: SEQUELIZE.STRING(100),
            __proto__: { freezeTableName: true }
        }
	}
	/* Do Not Modify Anything Bellow Here */
    this.__proto__.taskdone = function(task, record, error){        
        this.taskworker.isrun = false;        
        this.taskreference[task.ref] = record;        
        if (error != null || error !== undefined) {
            this.taskworker.success = false;
            switch (error) {
                case 0: {
                    error = "Try to process non object config for task: " + JSON.stringify(task).replace(/\"/gm, " ");
                } break; 
                case 1: {
                    error = "Non table referenced or insufficient config for task: " + JSON.stringify(task).replace(/\"/gm, " ");
                } break; 
                case 2: {
                    error = "Non record referenced or insufficient config for task: " + JSON.stringify(task).replace(/\"/gm, " ");
                } break; 
                case 3: {
                    error = "Try to reference to non appinfo schema for task: " + JSON.stringify(task).replace(/\"/gm, " ");
                } break; 
                case 4: {
                    error = "Skiped non-exsist sql file for task: " + JSON.stringify(task).replace(/\"/gm, " ");                    
                    this.taskworker.success = true;
                    task.continueOnError = true;
                } break; 
            }
            this.taskworker.error.push(error);
            if (!task.continueOnError) {
                this.taskworker.task = [];
                return;
            }
        } else {
            this.taskworker.success = true;
        }
        this.taskworker.task.shift();        
    }
    this.__proto__.runtask = function(){
        if (this.taskworker.isrun) {
            return;
        }
        this.taskworker.error = (this.taskworker.error === undefined)? []:this.taskworker.error;
        if (this.taskworker.task.length == 0) {
            clearInterval(this.taskworker._looper);
            if (this.taskworker.success) {
                this.Log.info('Success execute db tasks runner, with errors: ' + JSON.stringify(this.taskworker.error, undefined, 4));
                return;
            } else {
                this.Log.warn('Failed execute db tasks runner, with errors: ' + JSON.stringify(this.taskworker.error, undefined, 4));
                return;
            }								
        } else {
            var task = this.taskworker.task[0];
            var taskreference = undefined;
            var tablereference = this.schema[task.table];
            if (typeof(task.use) == "string") {
                taskreference = this.taskreference[task.use]
            } else if (typeof(task.use) == "object") {
                taskreference = task.use;
            }
            task.continueOnError = (task.continueOnError===undefined)? true:task.continueOnError;
            this.taskworker.isrun = true;
            switch (task.task) {
                case "create":
                    if (tablereference && task.data) {                        
                        tablereference.create(task.data).success(function(record){
                            this.taskdone(task, record);
                            return;
                        }.bind(this)).error(function(e){
                            this.taskdone(task, null, e);
                            return;	
                        }.bind(this))
                    } else {
                        this.taskdone(task, null, 1);
                        return;	
                    }
                break;
                case "build":
                    if (tablereference && task.data) {                        
                        this.taskdone(task, tablereference.build(task.data));
                        return;
                    } else {
                        this.taskdone(task, null, 1);
                        return;	
                    }
                break;
                case "save":
                    if (taskreference) {
                        taskreference.save().success(function(record){                            
                            this.taskdone(task, record);
                            return;
                        }.bind(this)).error(function(e){
                            this.taskdone(task, null, e);
                            return;	
                        }.bind(this))
                    } else {
                        this.taskdone(task, null, 2);
                        return;	
                    }
                break;
                case "relate":
                    if (taskreference && task.set && task.dataref) {
                        var f = (task.dataref instanceof Array)? plural(task.set):task.set;
                        f = "set" + f.charAt(0).toUpperCase() + f.slice(1);
                        if (task.dataref instanceof Array) {
                            for (var i in task.dataref) {
                                task.dataref[i] = this.taskreference[task.dataref[i]];
                            }
                        } else {
                            task.dataref = this.taskreference[task.dataref];
                        }
                        taskreference[f](task.dataref).success(function(record){
                            this.taskdone(task, record);
                            return;
                        }.bind(this)).error(function(e){
                            this.taskdone(task, null, e);
                            return;	
                        }.bind(this))
                    } else {
                        this.taskdone(task, null, 2);
                        return;	
                    }
                break;
                case "update":
                break;
                case "delete":
                break;
                // experimental:
                case "dbrev":
                    if (taskreference) {
                        if (taskreference.dbRev !== undefined) {
                            var ordertexts = fs.readFileSync(this.basepath + '/sqls/order').toString();
                            var orders = ordertexts.split("\n");
                            var order_file = orders[taskreference.dbRev];
                            if (order_file !== undefined) {
                                var order_file_path = this.basepath + '/sqls/' + order_file;
                                if (fs.existsSync(order_file_path)) {                                                    
                                    var sql_text = fs.readFileSync(order_file_path).toString();
                                    this.Client.query(sql_text, null, { raw: true }).success(function(objects) {
                                        taskreference.dbRev += 1;
                                        taskreference.save().success(function(record) {                                                            
                                            this.Log.info('dbrev success executing ' + order_file + ', upgraded to ' + record.dbRev);
                                            if (orders[record.dbRev] !== undefined) {
                                                this.task.push({
                                                    ref: "_dbrev_" + record.dbRev,
                                                    task: "dbrev",                                                                
                                                    use: task.ref,
                                                    continueOnError: false
                                                });
                                            }
                                            this.taskdone(task, record);
                                            return;
                                        }.bind(this)).error(function(e){
                                            this.taskdone(task, null, e);
                                            return;	
                                        }.bind(this));
                                    }.bind(this)).error(function(e){
                                        this.taskdone(task, null, e);
                                        return;	
                                    }.bind(this));
                                } else {
                                    this.taskdone(task, null, 4);
                                }
                            } else {
                                this.taskdone(task, {});
                            }
                        } else {
                            this.taskdone(task, null, 3);
                            return;	
                        }
                    } else {
                        this.taskdone(task, null, 2);
                        return;	
                    }
                break;
                default:
                    this.taskdone(task, null, 0);
                    return;
                break;
            }
        }
    }
    this.__proto__.starttaskworker = function(taskset){
        this.taskreference = {};
        this.taskworker = {
            task: taskset
        };
        this.taskworker._looper = setInterval(function(){
            this.runtask();
        }.bind(this), 10);
    }
	this.__proto__.init = function(options){
		options.onerror = (options.onerror === undefined)? function(){}:options.onerror;
		options.onsuccess = (options.onsuccess === undefined)? function(){}:options.onsuccess;
		options.scope = (options.scope === undefined)? this:options.scope;
        options.onbegin  = (options.onbegin === undefined)? function(){}:options.onbegin;
        options.onconnected  = (options.onbegin === undefined)? function(){}:options.onconnected;
		try {
			this.preinit();
            options.onbegin.apply(options.scope, []);
            var forcesync = (this.config.db.forcesync === undefined)? false:this.config.db.forcesync;
			this.Client = new SEQUELIZE(this.config.db.database, this.config.db.username, this.config.db.password, {
				host: this.config.db.host,
				port: this.config.db.port,
				protocol: 'tcp',
			  
				// disable logging; default: console.log
				logging: false,
			 
				// the sql dialect of the database
				// - default is 'mysql'
				// - currently supported: 'mysql', 'sqlite', 'postgres', 'mariadb'
				dialect: this.config.db.enggine,
			 
				// disable inserting undefined values as NULL
				// - default: false
				omitNull: true,
			  
				// Specify options, which are used when sequelize.define is called.
				// The following example:
				//   define: {timestamps: false}
				// is basically the same as:
				//   sequelize.define(name, attributes, { timestamps: false })
				// so defining the timestamps for each model will be not necessary
				// Below you can see the possible keys for settings. All of them are explained on this page
				define: {
					// underscored: false
					// freezeTableName: false,
					syncOnAssociation: true,
					charset: 'utf8',
					collate: 'utf8_general_ci',
					timestamps: true
				},
			 
				// similiar for sync: you can define this to always force sync for models                
				sync: { force: forcesync },
			 
				// sync after each association (see below). If set to false, you need to sync manually after setting all associations. Default: true
				syncOnAssociation: true,
                
                dialectOptions: {
                    // support multiple mysql query using client.query()
                    multipleStatements: true
                },
			 
				// language is used to determine how to translate words into singular or plural form based on the [lingo project](https://github.com/visionmedia/lingo)
				// options are: en [default], es
				language: 'en'
			});
			// Start define sequelize schema
			var relation_config = this.schema["__relation__"];
			delete this.schema["__relation__"];
			delete this.schema.__version;
			for (var key in this.schema) {
				var table = this.schema[key];
				var option = this.schema[key].__proto__;
				delete table.__proto__;
				this[key] = this.schema[key] = this.Client.define(key, table, option);		 
			}
			for (var i in relation_config) {
				var relation = relation_config[i];
				var o = relation.options;
				var a = this.schema[relation.from];
				var b = this.schema[relation.to];
				if (a && b) {
					switch (relation.rel.toLowerCase()) {
						case "hasmany" :
							a.hasMany(b, o);
						break;
						case "hasone":
							a.hasOne(b, o);
						break;
						case "belongsto":
							a.belongsTo(b, o);
						break;
						default:
						break;
					}
				}				
			}
			this.Client.sync().success(function() {
                options.onconnected.apply(options.scope, []);
                options.taskset = this.task;
				this.dbrev(options);
			}.bind(this)).error(function(e){
				options.onerror.apply(options.scope, [e, this])
				return;
			}.bind(this));
		} catch (e) {
			options.onerror.apply(options.scope, [e, this])
			return;
		}
	}
}
module.exports = DB;
