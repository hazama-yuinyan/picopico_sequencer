define(["scripts/lib/enchant.js"], function(){
function $H(object) {
	return new Hash(object);
};

function $A(object){
	if(!object){return [];}
	var length = object.length || 0, results = new Array(length);
	while (length--) results[length] = object[length];
	return results;
}

Object.prototype.extend = function(destination, source){
	for(var property in source){
		destination[property] = source[property];
	}
	
	return destination;
};

if(!Object.prototype.clone){
	Object.prototype.clone = function(obj){
		return Object.prototype.extend.call(this, {}, obj);
	};
}

if(!Object.prototype.isString){
	Object.prototype.isString = function(obj){
		return typeof(obj) == "string";
	};
}

if(!Object.prototype.isArray){
	Object.prototype.isArray = function(obj){
		return Object.prototype.toString.call(obj) == "[object Array]";
	};
}

if(!Object.prototype.isHash){
	Object.prototype.isHash = function(obj){
		return obj instanceof Hash;
	};
}

Array.prototype.inject = function(memo, iterator, context) {
	this.forEach(function(value, index) {
		memo = iterator.call(context, memo, value, index);
	});
	return memo;
};

var Hash = enchant.Class.create({
	initialize : function(object) {
		this._object = Object.isHash(object) ? object.toObject() : Object.clone(object);
	},

	each : function(iterator, context) {
		for (var key in this._object) {
			var value = this._object[key], pair = [key, value];
			pair.key = key;
			pair.value = value;
			iterator.call(context, pair);
		}
	},

	set : function(key, value) {
		return this._object[key] = value;
	},

	get : function(key) {
		if (this._object[key] !== Object.prototype[key])
			return this._object[key];
	},

	unset : function(key) {
		var value = this._object[key];
		delete this._object[key];
		return value;
	},

	toObject : function() {
		return Object.clone(this._object);
	},

	merge : function(object) {
		return this.clone().update(object);
	},
	
	inject : function(memo, iterator, context) {
		this.each(function(pair) {
			memo = iterator.call(context, memo, pair);
		});
		return memo;
	},

	update : function(object) {
		return new Hash(object).inject(this, function(result, pair) {
			result.set(pair.key, pair.value);
			return result;
		});
	},

	clone : function() {
		return new Hash(this);
	}
});



var Parse = {};

Parse.mobj = function(values, group) {
    var m = $A(values);
    m.group = $H(group);
    m.g = m.group.toObject();
    return m;
}

Parse.Parser = enchant.Class.create({
	initialize : function(){
		this._grammers = $H();
        this.errors = [];
	},
	
    Seq: function() {
        var parser = this;
        return {
            type: "Seq",
            children: $A(arguments),
            parse: function(tokens) {
                var values = [], group = $H(), r;
                
                for(var i = 0;i < this.children.length; ++i) {
                    if(r = this.children[i].parse(tokens)) {
                        tokens = r.rests;
                        values.push(r.value);
                        group.update(r.group);
                    } else {
                        parser.errors.push({cause : this.type, msg : "Unexpected syntax. Expected : " + this.children[i].type});
                        return null;
                    }
                }
                var value = Parse.mobj(values, group);
                return {rests:tokens, value:value, group:group};
            }
        };
    },
    Token: function(tokentype) {
        return {
            type: "Token",
            parser: this,
            tokentype: tokentype,
            parse: function(tokens) {
                if(tokens.length && this.parser.isTokenOf(tokens[0], this.tokentype)) {
                    var group = $H();
                    group.set(this.tokentype, tokens[0].value);
                    return {
                        value: tokens[0].value,
                        rests: tokens.slice(1),
                        group: group,
                    };
                }
                this.parser.errors.push({cause : this.type, msg : "Unexpected token. Expected : " + this.tokentype});
                return null;
            }
        };
    },
    Repeat_: function(child, minimum, maximum) {
        //var parser = this;
        return {
            type: "Repeat",
            child: child,
            minimum: minimum,
            maximum: maximum,
            parse: function(tokens) {
                var values = [];
                var group = $H();
                for(var i = 0; this.maximum == null || i < this.maximum; ++i){
                    var r = this.child.parse(tokens);
                    if(!r){
                        break;
                    }
                    tokens = r.rests;
                    values.push(r.value);
                    group.update(r.group);
                }
                if(this.minimum == null || this.minimum <= i) {
                    var value = Parse.mobj(values, group);
                    return {
                        rests:tokens,
                        value:value,
                        group:group,
                    };
                }
            }
        };
    },
    Repeat1: function(child) {
        if(2 <= arguments.length) {
            child = this.Seq.apply(this, arguments);
        }
        return this.Repeat_(child, 1);
    },
    Repeat: function(child) {
        if(2 <= arguments.length) {
            child = this.Seq.apply(this, arguments);
        }
        return this.Repeat_(child, 0);
    },
    Any: function() {
        var parser = this;
        return {
            type: "Any",
            children: $A(arguments),
            parse: function(tokens) {
                for(var i = 0; i < this.children.length; ++i) {
                    var r = this.children[i].parse(tokens);
                    if(r) {
                        return r;
                    }
                }
                parser.errors.push({cause : this.type, msg : "None of the syntaxes found."});
                return null;
            },
        };
    },
    Maybe: function(child) {
        if(2 <= arguments.length) {
            child = this.Seq.apply(this, arguments);
        }
        return {
            type: "Maybe",
            child: child,
            parse: function(tokens) {
                var r = this.child.parse(tokens);
                if(r) {
                    return r;
                } else {
                    return {rests:tokens, value:null, group:$H()};
                }
            },
        };
    },
    End: function() {
        var parser = this;
        return {
            type: "End",
            parse: function(tokens){
               if(!tokens.length) {
                   return {rests:[], value:null, group:$H()};
               } else {
                   parser.errors.push({cause : this.type, msg : "Expected EOF, but I'm still in middle of the inputs!"});
                   return null;
               }
            }
        };
    },
    Grammer: function(name, child, fn) {
        if(child.type != "Seq") {
            child = this.Seq(child);
        }
        return {
            type: "Grammer",
            child: child,
            fn: fn,
            parser: this,
            name: name,
            parse: function(tokens){
                var r = this.child.parse(tokens);
                if(r) {
                    this.parser.errors.splice(0);
                    var value;
                    if(this.fn) {
                        var m = Object.clone(r.value);
                        m.name = this.name;
                        value = this.fn(m);
                    } else {
                        value = r.value;
                    }
                    var group = $H();
                    group.set(this.name, value);
                    return {
                        rests: r.rests,
                        value: value,
                        group: group,
                    };
                } else {
                    return null;
                }
            },
        };
    },
    Label: function(name, child) {
        return {
            type: "Label",
            child: child,
            name: name,
            parse: function(tokens){
                var r = this.child.parse(tokens);
                if(r) {
                    var group = $H(r.group);
                    group.set(this.name, r.value);
                    return {
                        rests: r.rests,
                        value: r.value,
                        group: group,
                    };
                } else {
                    return null;
                }
            }
        };
    },
    Ref: function (name) {
        return {
            type: "Ref",
            parser: this,
            name: name,
            parse: function(tokens){
                var g = this.parser._grammers.get(this.name);
                if(!g) {
                    throw Error(this.name);
                }
                return g.parse(tokens);
            }
        };
    },
    def: function(name, child, fn) {
        if(arguments.length == 1) {
            $H(arguments[0]).each(function(item){
                if(Object.isArray(item.value)) {
                    this.def(item.key, item.value[0], item.value[1]);
                } else {
                    this.def(item.key, item.value);
                }
            }, this);
        } else {
            if(Object.isString(child)) {
                var src = this.compile(child);
                with(this) {
                    child = eval(src);
                }
            }
            this._grammers.set(name, this.Grammer(name, child, fn));
        }
    },
    callback: function(name, fn) {
        if(arguments.length == 1) {
            $H(arguments[0]).each(function(item){
                this._grammers.get(item.key).fn = item.value;
            }, this);
        } else {
            this._grammers.get(name).fn = fn;
        }
    },
    entry: function(name) {
        this._entry = name;
    },
    isTokenOf : function(token, name) {
        return token.type == name;
    },
    parse: function(tokens, entryPoint) {
        return this._grammers.get(entryPoint || this._entry).parse(tokens);
    },
});

    return Parse;
});
