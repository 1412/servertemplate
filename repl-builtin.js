eval:
function (code, context, file, cb) {
    var err, result;
    try {
        if (self.useGlobal) {
            result = vm.runInThisContext(code, file);
        } else {
            result = vm.runInContext(code, context, file);
        }
    } catch (e) {
        err = e;
    }
    if (err && process.domain) {
        process.domain.emit('error', err);
        process.domain.exit();
    } else {
        cb(err, result);
    }
}

defineCommand:
function (keyword, cmd) {
    if (typeof cmd === 'function') {
        cmd = {action: cmd};
    } else if (
        typeof cmd.action !== 'function') {
            throw new Error('bad argument, action must be a function');
    }
    this.commands['.' + keyword] = cmd;
}

parseREPLKeyword:
function (keyword, rest) {
    var cmd = this.commands[keyword];
    if (cmd) {
        cmd.action.call(this, rest);
        return true;
    }
    return false;
}

memory:
function memory(cmd) {
    var self = this;
    self.lines = self.lines || [];
    self.lines.level = self.lines.level || [];
    // save the line so I can do magic later
    if (cmd) {
        // TODO should I tab the level?
        self.lines.push(new Array(self.lines.level.length).join('  ') + cmd);
    } else {
        // I don\'t want to not change the format too much...
        self.lines.push('');
    }
    // I need to know "depth."
    // Because I can not tell the difference between a } that
    // closes an object literal and a } that closes a function
    if (cmd) {
        // going down is { and (   e.g. function() {
        // going up is } and )
        var dw = cmd.match(/{|\\(/g);
        var up = cmd.match(/}|\\)/g);
        up = up ? up.length : 0;
        dw = dw ? dw.length : 0;
        var depth = dw - up;
        if (depth) {
            (function workIt() {
                if (depth > 0) {
                    // going... down.
                    // push the line#, depth count, and if the line is a function.
                    // Since JS only has functional scope I only need to remove
                    // "function() {" lines, clearly this will not work for
                    // "function()
                    // {" but nothing should break, only tab completion for local
                    // scope will not work for this function.
                    self.lines.level.push({
                        line: self.lines.length - 1,
                        depth: depth,
                        isFunction: /\\s*function\\s*/.test(cmd)
                    });
                } else if (depth < 0) {
                    // going... up.
                    var curr = self.lines.level.pop();
                    if (curr) {
                        var tmp = curr.depth + depth;
                        if (tmp < 0) {
                            //more to go, recurse
                            depth += curr.depth;
                            workIt();
                        } else if (tmp > 0) {
                            //remove and push back
                            curr.depth += depth;
                            self.lines.level.push(curr);
                        }
                    }
                }
            }());
        }
        // it is possible to determine a syntax error at this point.
        // if the REPL still has a bufferedCommand and
        // self.lines.level.length === 0
        // TODO? keep a log of level so that any syntax breaking lines can
        // be cleared on .break and in the case of a syntax error?
        // TODO? if a log was kept, then I could clear the bufferedComand and
        // eval these lines and throw the syntax error
    } else {
        self.lines.level = [];
    }
}

convertToContex:
function (cmd) {
    var self = this, matches,
        scopeVar = /^\\s*var\\s*([_\\w\\$]+)(.*)$/m,
        scopeFunc = /^\\s*function\\s*([_\\w\\$]+)/;
        // Replaces: var foo = "bar";  with: self.context.foo = bar;
    matches = scopeVar.exec(cmd);
    if (matches && matches.length === 3) {
        return 'self.context.' + matches[1] + matches[2];
    }
    // Replaces: function foo() {};  with: foo = function foo() {};
    matches = scopeFunc.exec(self.bufferedCommand);
    if (matches && matches.length === 2) {
        return matches[1] + ' = ' + self.bufferedCommand;
    }
    return cmd;
}

complete:
function (line, callback) {
    // There may be local variables to evaluate, try a nested REPL
    if (this.bufferedCommand != undefined && this.bufferedCommand.length) {
        // Get a new array of inputed lines
        var tmp = this.lines.slice();
        // Kill off all function declarations to push all local variables into
        // global scope
        this.lines.level.forEach(function(kill) {
            if (kill.isFunction) {
                tmp[kill.line] = '';
            }
        });
        var flat = new ArrayStream();
        // make a new "input" stream
        var magic = new REPLServer('', flat); // make a nested REPL
        magic.context = magic.createContext();
        flat.run(tmp);                        // eval the flattened code
        // all this is only profitable if the nested REPL
        // does not have a bufferedCommand
        if (!magic.bufferedCommand) {
            return magic.complete(line, callback);
        }
    }
    var completions;
    // list of completion lists, one for each inheritance "level"
    var completionGroups = [];
    var completeOn, match, filter, i, j, group, c;
    // REPL commands (e.g. ".break").
    var match = null;
    match = line.match(/^\\s*(\\.\\w*)$/);
    if (match) {
        completionGroups.push(Object.keys(this.commands));
        completeOn = match[1];
        if (match[1].length > 1) {
            filter = match[1];
        }
        completionGroupsLoaded();
    } else if (match = line.match(requireRE)) {
        // require('...<Tab>')
        var exts = Object.keys(require.extensions);
        var indexRe = new RegExp('^index(' + exts.map(regexpEscape).join('|') + ')$');
        completeOn = match[1];
        var subdir = match[2] || '';
        var filter = match[1];
        var dir, files, f, name, base, ext, abs, subfiles, s;
        group = [];
        var paths = module.paths.concat(require('module').globalPaths);
        for (i = 0; i < paths.length; i++) {
            dir = path.resolve(paths[i], subdir);
            try {
                files = fs.readdirSync(dir);
            } catch (e) {
                continue;
            }
            for (f = 0; f < files.length; f++) {
                name = files[f];
                ext = path.extname(name);
                base = name.slice(0, -ext.length);
                if (base.match(/-\\d+\\.\\d+(\\.\\d+)?/) || name === '.npm') {
                    // Exclude versioned names that 'npm' installs.
                    continue;
                }
                if (exts.indexOf(ext) !== -1) {
                    if (!subdir || base !== 'index') {
                        group.push(subdir + base);
                    }
                } else {
                    abs = path.resolve(dir, name);
                    try {
                        if (fs.statSync(abs).isDirectory()) {
                            group.push(subdir + name + '/');
                            subfiles = fs.readdirSync(abs);
                            for (s = 0; s < subfiles.length; s++) {
                                if (indexRe.test(subfiles[s])) {
                                    group.push(subdir + name);
                                }
                            }
                        }
                    } catch (e) {}
                }
            }
        }
        if (group.length) {
            completionGroups.push(group);
        }
        if (!subdir) {
            completionGroups.push(exports._builtinLibs);
        }
        completionGroupsLoaded();
        // Handle variable member lookup.
        // We support simple chained expressions like the following (no function
        // calls, etc.). That is for simplicity and also because we *eval* that
        // leading expression so for safety (see WARNING above) don't want to
        // eval function calls.
        //
        //   foo.bar<|>     # completions for 'foo' with filter 'bar'
        //   spam.eggs.<|>  # completions for 'spam.egg' with filter ''
        //   foo<|>         # all scope vars with filter 'foo'
        //   foo.<|>        # completions for 'foo' with filter ''
    } else if (line.length === 0 || line[line.length - 1].match(/\\w|\\.|\\$/)) {
        match = simpleExpressionRE.exec(line);
        if (line.length === 0 || match) {
            var expr;
            completeOn = (match ? match[0] : '');
            if (line.length === 0) {
                filter = '';
                expr = '';
            } else if (line[line.length - 1] === '.') {
                filter = '';
                expr = match[0].slice(0, match[0].length - 1);
            } else {
                var bits = match[0].split('.');
                filter = bits.pop();
                expr = bits.join('.');
            }
            // Resolve expr and get its completions.
            var obj, memberGroups = [];
            if (!expr) {
                // If context is instance of vm.ScriptContext
                // Get global vars synchronously
                if (this.useGlobal ||
                    this.context.constructor &&
                    this.context.constructor.name === 'Context') {
                    var contextProto = this.context;
                    while (contextProto = Object.getPrototypeOf(contextProto)) {
                        completionGroups.push(Object.getOwnPropertyNames(contextProto));
                    }
                    completionGroups.push(Object.getOwnPropertyNames(this.context));
                    addStandardGlobals(completionGroups, filter);
                    completionGroupsLoaded();
                } else {
                    this.eval('.scope', this.context, 'repl', function(err, globals) {
                        if (err || !globals) {
                            addStandardGlobals(completionGroups, filter);
                        } else if (Array.isArray(globals[0])) {
                            // Add grouped globals
                            globals.forEach(function(group) {
                                completionGroups.push(group);
                            });
                        } else {
                            completionGroups.push(globals);
                            addStandardGlobals(completionGroups, filter);
                        }
                        completionGroupsLoaded();
                    });
                }
            } else {
                this.eval(expr, this.context, 'repl', function(e, obj) {
                    // if (e) console.log(e);
                    if (obj != null) {
                        if (typeof obj === 'object' || typeof obj === 'function') {
                            memberGroups.push(Object.getOwnPropertyNames(obj));
                        }
                        // works for non-objects
                        try {
                            var sentinel = 5;
                            var p;
                            if (typeof obj === 'object' || typeof obj === 'function') {
                                p = Object.getPrototypeOf(obj);
                            } else {
                                p = obj.constructor ? obj.constructor.prototype : null;
                            }
                            while (p !== null) {
                                memberGroups.push(Object.getOwnPropertyNames(p));
                                p = Object.getPrototypeOf(p);
                                // Circular refs possible? Let\'s guard against that.
                                sentinel--;
                                if (sentinel <= 0) {
                                    break;
                                }
                            }
                        } catch (e) {
                            //console.log("completion error walking prototype chain:" + e);
                        }
                    }
                    if (memberGroups.length) {
                        for (i = 0; i < memberGroups.length; i++) {
                            completionGroups.push(memberGroups[i].map(function(member) {
                                return expr + '.' + member;
                            }));
                        }
                        if (filter) {
                            filter = expr + '.' + filter;
                        }
                    }
                    completionGroupsLoaded();
                });
            }
        } else {
            completionGroupsLoaded();
        }
    } else {
        completionGroupsLoaded();
    }
    // Will be called when all completionGroups are in place
    // Useful for async autocompletion

    function completionGroupsLoaded(err) {
        if (err) throw err;
        // Filter, sort (within each group), uniq and merge the completion groups.
        if (completionGroups.length && filter) {
            var newCompletionGroups = [];
            for (i = 0; i < completionGroups.length; i++) {
                group = completionGroups[i].filter(function(elem) {
                    return elem.indexOf(filter) == 0;
                });
                if (group.length) {
                    newCompletionGroups.push(group);
                }
            }
            completionGroups = newCompletionGroups;
        }
        if (completionGroups.length) {
            var uniq = {};  // unique completions across all groups
            completions = [];
            // Completion group 0 is the "closest"
            // (least far up the inheritance chain)
            // so we put its completions last: to be closest in the REPL.
            for (i = completionGroups.length - 1; i >= 0; i--) {
                group = completionGroups[i];
                group.sort();
                for (var j = 0; j < group.length; j++) {
                    c = group[j];
                    if (!hasOwnProperty(c)) {
                        completions.push(c);
                        uniq[c] = true;
                    }
                }
                completions.push(''); // separator btwn groups
            }
            while (completions.length && completions[completions.length - 1] === '') {
                completions.pop();
            }
        }
        callback(null, [completions || [], completeOn]);
    }
}