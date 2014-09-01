var SEQUELIZE = require('sequelize');
var plural = require('plural');
var DB = function(config){
	this.__proto__.schema = require('./schema.js');
	this.__proto__.task = require('./initial.js');
	this.__proto__.preinit = function() {
		/* Modify Task Config */
		this.task.splice(this.task.indexOf("%"), 1, {
			ref: "application_info",
			task: "create",
			table: "ApplicationInfo",
			continueOnError: false,
			data: {
				name: this.config.application.name,
				version: this.config.application.version,
				schemaVersion: this.schema.__version,
				owner: this.config.application.owner,
				address: this.config.application.address
			}
		});
		this.task.splice(this.task.indexOf("&"), 1, {
			ref: "admin_user",
			task: "build",
			table: "User",
			data: {
				username: this.config.application.admin_username,
				password: require('crypto').createHash('md5').update(this.config.application.admin_password).digest('hex'),
				enabled: true,
				email: this.config.application.admin_email
			}
		});
	}	
	/* Do Not Modify Anything Bellow Here */
	
	this.__version = this.schema.__version;
	this.__proto__.config = config;
	this.__proto__.init = function(options){
		options.onerror = (options.onerror === undefined)? function(){}:options.onerror;
		options.onsuccess = (options.onsuccess === undefined)? function(){}:options.onsuccess;
		options.scope = (options.scope === undefined)? this:options.scope;
        options.onbegin  = (options.onbegin === undefined)? function(){}:options.onbegin;
        options.onconnected  = (options.onbegin === undefined)? function(){}:options.onconnected;
        options.onbegindata  = (options.onbegin === undefined)? function(){}:options.onbegindata;
        options.onenddata  = (options.onbegin === undefined)? function(){}:options.onenddata;
        options.onfaildata  = (options.onbegin === undefined)? function(){}:options.onfaildata;
		try {
			this.preinit();
            options.onbegin.apply(options.scope, []);
			this.Client = new SEQUELIZE(config.db.database, config.db.username, config.db.password, {
				host: config.db.host,
				port: config.db.port,
				protocol: 'tcp',
			  
				// disable logging; default: console.log
				logging: false,
			 
				// the sql dialect of the database
				// - default is 'mysql'
				// - currently supported: 'mysql', 'sqlite', 'postgres', 'mariadb'
				dialect: 'mysql',
			 
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
				sync: { force: false },
			 
				// sync after each association (see below). If set to false, you need to sync manually after setting all associations. Default: true
				syncOnAssociation: true,
			 
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
			for (i in relation_config) {
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
				this.task_object = {};
				this.schema["ApplicationInfo"].count().success(function(c) {
					if (c == 0) {
                        options.onbegindata.apply(options.scope, []);
						this.taskreference = {};
						this.taskworker = setInterval(function(){
							if (this.taskworker.isrun) {
								return;
							}
							this.taskworker.error = (this.taskworker.error === undefined)? []:this.taskworker.error;
							if (this.task.length == 0) {
								clearInterval(this.taskworker);
								if (this.taskworker.success) {
                                    options.onenddata.apply(options.scope, [this.taskworker]);
									return;
								} else {
                                    options.onenddata.apply(options.scope, [this.taskworker]);
									options.onerror.apply(options.scope, [this.taskworker.error, this]);
									return;
								}								
							} else {
								var task = this.task[0];
								task.continueOnError = (task.continueOnError===undefined)? true:task.continueOnError;
								switch (task.task) {
									case "create":
										if (this.schema[task.table] && task.data) {
											this.taskworker.isrun = true;
											this.taskworker.task = task;
											this.schema[task.table].create(task.data).success(function(record){
												this.taskworker.isrun = false;
												this.taskworker.success = true;
												this.taskreference[this.taskworker.task.ref] = record;
												this.task.shift();
												return;
											}.bind(this)).error(function(e){
												this.taskworker.isrun = false;
												this.taskworker.error.push(e);
												if (!this.taskworker.task.continueOnError) {
													this.taskworker.success = false;
													this.task = [];
												}
												return;	
											}.bind(this))
										} else {
											this.task.shift();
											this.taskworker.isrun = false;
											var e = "Non table or insufficient config " + JSON.stringify(task, undefined, 4);
											this.taskworker.error.push(e);
											return;	
										}
									break;
									case "build":
										if (this.schema[task.table] && task.data) {
											this.taskworker.isrun = true;
											this.taskworker.task = task;
											var record = this.schema[task.table].build(task.data);
											this.taskworker.isrun = false;
											this.taskworker.success = true;
											this.taskreference[this.taskworker.task.ref] = record;
											this.task.shift();
											return;
										} else {
											this.task.shift();
											this.taskworker.isrun = false;
											var e = "Non exist table, or insufficient config " + JSON.stringify(task, undefined, 4);
											this.taskworker.error.push(e);
											return;	
										}
									break;
									case "save":
										if (this.taskreference[task.use]) {
											this.taskworker.isrun = true;
											this.taskworker.task = task;
											this.taskreference[task.use].save().success(function(record){
												this.taskworker.isrun = false;
												this.taskworker.success = true;
												this.taskreference[this.taskworker.task.ref] = record;
												this.task.shift();
												return;
											}.bind(this)).error(function(e){
												this.taskworker.isrun = false;
												this.taskworker.error.push(e);
												if (!this.taskworker.task.continueOnError) {
													this.taskworker.success = false;
													this.task = [];
												}
												return;	
											}.bind(this))
										} else {
											this.task.shift();
											this.taskworker.isrun = false;
											var e = "Non exist record, or insufficient config " + JSON.stringify(task, undefined, 4);
											this.taskworker.error.push(e);
											return;	
										}
									break;
									case "relate":
										if (this.taskreference[task.use] && task.set && task.dataref) {
											this.taskworker.isrun = true;
											this.taskworker.task = task;
											var f = (task.dataref instanceof Array)? plural(task.set):task.set;
											f = "set" + f.charAt(0).toUpperCase() + f.slice(1);
											if (task.dataref instanceof Array) {
												for (i in task.dataref) {
													task.dataref[i] = this.taskreference[task.dataref[i]];
												}
											} else {
												task.dataref = this.taskreference[task.dataref];
											}
											this.taskreference[task.use][f](task.dataref).success(function(record){
												this.taskworker.isrun = false;
												this.taskworker.success = true;
												this.taskreference[this.taskworker.task.ref] = record;
												this.task.shift();
												return;
											}.bind(this)).error(function(e){
												this.taskworker.isrun = false;
												this.taskworker.error.push(e);
												if (!this.taskworker.task.continueOnError) {
													this.taskworker.success = false;
													this.task = [];
												}
												return;	
											}.bind(this))
										} else {
											this.task.shift();
											this.taskworker.isrun = false;
											var e = "Non exist record, or insufficient config " + JSON.stringify(task, undefined, 4);
											this.taskworker.error.push(e);
											return;	
										}
									break;
									case "update":
									break;
									case "delete":
									break;
									default:
										this.task.shift();
										this.taskworker.isrun = false;
										var e = "Try to process non object config " + JSON.stringify(task, undefined, 4);
										this.taskworker.error.push(e);
										return;	
									break;
								}
							}
						}.bind(this), 10);
					} else {
						options.onsuccess.apply(options.scope, [this])
						return;
					}
				}.bind(this)).error(function(e){
					options.onerror.apply(options.scope, [e, this])
					return;
				}.bind(this));
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
