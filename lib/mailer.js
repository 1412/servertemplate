var LOGGER = require('./logger.js');
var nodemailer = require('nodemailer');

function MailerTransport(context, config){
    this._context = context;    
    this.name = config.name;
    this.config = config;
    this.Log = new LOGGER(this._context, 'MailTransport['+this.name+']');
    this.__proto__.send = function (options) {
        if (options === undefined) {
            return false;
        }
        options.scope = (options.scope === undefined) ? this : options.scope;
        options.onsuccess = (options.onsuccess === undefined) ? function () {} : options.onsuccess;
        options.onerror = (options.onerror === undefined) ? function () {} : options.onerror;
        options.recipients = (options.recipients === undefined) ? [] : options.recipients;
        if (options.recipients.length > 0) {
            var mailOptions = {
                from: options.from,
                to: options.recipients,
                subject: options.subject,
                text: options.text,
                html: options.html
            }
            this.Transport.sendMail(mailOptions, function (error, response) {
                if (error) {
                    this.Log.info('Mailer \"' + this.name + '\" failed to send message!');
                    options.onerror.apply(options.scope, [error]);
                } else {
                    this.Log.info('Mailer \"' + this.name + '\" success to send message!');
                    options.onsuccess.apply(options.scope, [response]);
                }
            }.bind(this));
        }
    };
    this.__proto__.close = function () {
        this.Transport.close();
    };
    this.__proto__.init = function () {
        var config = this.config;
        this.Transport = nodemailer.createTransport(config.type, {
            service: config.service,
            host: config.host,
            secureConnection: config.secureConnection,
            port: config.port,
            auth: {
                user: config.username,
                pass: config.password,
            }
        });
        if (!config.listening) {
            this.close();
        }
    };
    this.init();
}

function MAILER(context){
    this._context = context;
    this.Log = new LOGGER(this._context, 'MAILER');
    this.Client = {};    
    this.__proto__.init = function(){
        for (var i = 0; i < this._context.CONFIG.mailer.transports.length; i++) {
            this.Client[this._context.CONFIG.mailer.transports[i].name] = new MailerTransport(this._context, this._context.CONFIG.mailer.transports[i]);
        }
    }    
    this.init();
}
module.exports = MAILER;