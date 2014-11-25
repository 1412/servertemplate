module.exports = function(args, argtext){
    this.Express.suicide();
    this.REPL.suicide();
    process.exit(0);
}