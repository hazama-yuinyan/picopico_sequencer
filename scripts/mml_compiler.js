define(["scripts/lib/enchant.js", "lexer", "scripts/parser.js", "utils", "lib/treehugger/tree", "lib/treehugger/traverse"], function(dummy, Lexer, Parse, util, tree, traverse){
    var MMLLexer = enchant.Class.create(Lexer, {
        initialize : function(){
            Lexer.call(this, [
                {type : "IGNORE", regexp : /^\/[^\n\t\r]+|^[ ]+/},
                {type : "line_delimiter", regexp : /^[\t\n\r]+/},
                {type : "commands", regexp : /^(velocity|volume|program|include|key_signature|k.sign)/i},
                {type : "note_name", regexp : /^[a-gr]/i},
                {type : "keywords", regexp : /^[loqtuv]/i},
                {type : "num", regexp : /^\d+/, callback : function(arg){
                    return parseInt(arg, 10);
                }},
                {type : "operators", regexp : /^[<>,\.\^\+#\-!\*@{}\[\]"'\(\)]/}
            ]);
        }
    });
    
    var MMLParser = enchant.Class.create({
        initialize : function(){
            var lexer = new MMLLexer();
            var parser = new Parse.Parser();
            
            this.env = null;
            this.cmd_manager = new util.CommandManager();
            
            with(parser){
                parser.def({
                    mml: Seq(Repeat(Ref("line")), End()),
                    line: Seq(Maybe(Any(Repeat1(Ref("longer_command")), Repeat1(Any(Ref("shortened_command"), Ref("tuplet"), Ref("chord"),
                        Ref("tie"), Ref("note"))))), Token("line_delimiter")),
                    tie: Seq(Ref("note"), Repeat1(Token("&"), Ref("note"))),
                    tuplet: Seq(Token("{"), Repeat1(Ref("note")), Token("}"), Maybe(Ref("note_length"))),
                    chord: Seq(Any(Token('"'), Token("'")), Repeat1(Any(Ref("note"), Ref("shortened_command"))), Any(Token('"'), Token("'")),
                        Maybe(Token("num"), Maybe(Token(","), Label("gate_time", Token("num"))))),
                    note: Seq(Ref("pitch"), Maybe(Ref("note_length")), Maybe(Token(","), Maybe(Label("gate_time", Ref("note_length"))),
                        Maybe(Token(","), Label("velocity", Seq(Maybe(Any(Token("+"), Token("-"))), Token("num")))))),
                    note_length: Seq(Maybe(Token("*")), Token("num"), Repeat(Token(".")), Repeat(Token("^"),
                        Maybe(Token("*")), Token("num"), Repeat(Token(".")))),
                    pitch: Seq(Token("note_name"), Maybe(Token("!")), Repeat(Any(Token("#"), Token("+"), Token("-")))),
                    shortened_command: Any(Seq(Token("("), Token("keywords"), Token("num"), Token(")")), Seq(Maybe(Token("@")),
                        Maybe(Token("keywords")), Seq(Maybe(Token("*")), Token("num"), Repeat(Token("."))),
                        Maybe(Token(":"), Repeat(Token("num"), Maybe(Token(","))))), Any(Token("<"), Token(">"))),
                    longer_command: Seq(Token("["), Token("commands"), Ref("argument_list"), Token("]")),
                    argument_list: Any(Label("digit_args", Seq(Token("num"), Repeat(Token(","), Token("num")))),
                        Label("note_args", Seq(Any(Token("+"), Token("#"), Token("-")), Repeat1(Token("note_name")),
                        Repeat(Token(","), Any(Token("+"), Token("#"), Token("-")), Token("note_name")))))
                });
            }
            var _self = this;
            parser.callback({
                mml: function(m){
                    return tree.cons("mml", [tree.list(m[0])]);
                },
                line: function(m){
                    return tree.cons("line", [(m[0]) ? tree.list(m[0]) : tree.string("empty_line")]);
                },
                tie: function(m){
                    var array = [m[0]].concat(m[1].length && m[1][1]).filter(function(obj){
                        return !!obj;
                    });
                    return tree.cons("tie", [tree.list(array)]);
                },
                note: function(m){
                    var velocity_node = tree.cons("velocity", (m.g.velocity) ? [tree.string(m.g.velocity[0] || "none"),
                        tree.num(m.g.velocity[1])] :
                        [tree.string("none")]);
                    
                    return tree.cons((m.g.pitch[0].value <= 0) ? "rest" : "note", [tree.cons("params", [tree.list([m[0],
                        tree.cons("length", m.g.note_length || [tree.num(_self.env.getCurrentDefaultLength())]),
                        tree.cons("gate_time", (m.g.gate_time) ? [tree.num(m.g.gate_time)] : [tree.string("none")]),
                        tree.cons("velocity", velocity_node)])])]);
                },
                note_length: function(m){
                    var length = 0, sequence = [["^", m[0], m[1], m[2]]].concat(m[3]).filter(function(obj){
                        return !!obj;
                    });
                    
                    sequence.forEach(function(seq){
                        if(seq[1]){
                            length += parseInt(seq[2]);    //音長がtick指定だったのでそのまま加算
                        }else{
                            length += 480 * 4 / parseInt(seq[2]);   //相対指定なので４分音符との比をかけて加算
                        }
                        var num_dots = seq[3].length;
                        length *= Math.pow(1.5, num_dots);
                    });
                    return [tree.num(length)];
                },
                tuplet: function(m){
                    var notes = m[1], cur_default_len = _self.env.getCurrentDefaultLength();
                    var len = m[3] && m[3][0].value || cur_default_len, len_per_note = len / notes.length;
                    
                    notes.forEach(function(note){
                        if(note[0][0][1][0].value != cur_default_len){
                            throw SyntaxError("Illegal notation! You can't write a note length in a tuplet defnition!");
                        }
                        note[0][0][1][0].value = len_per_note;
                    });
                    return tree.cons("tuplet", [tree.list(notes), tree.cons("length", [tree.num(len)])]);
                },
                chord: function(m){
                    if(m[0] !== m[2]){
                        throw Error("Invalid operators! You have to use the same quotation mark on either side of a chord" +
                            "and keep them balanced!");
                    }
                    var contents = m[1], len = -1, cur_default_len = _self.env.getCurrentDefaultLength(), notes = [];
                    
                    contents.forEach(function(note){   //和音の構成音の定義から和音の長さを指定したパラメーターがあるか調べる
                        if(note.cons != "note"){return;}
                        if(len == -1 && note[0][0][1][0].value != cur_default_len){
                            len = note[0][0][1][0].value;
                        }else if(len != -1 && note[0][0][1][0].value != cur_default_len){
                            throw SyntaxError("Multiple definitions found! You can set the note length just once in a chord!" +
                                "Remove one of the length definition or just use the postfix-style notation.");
                        }
                        notes.push(note);
                    });
                    if(len == -1){      //和音定義の中には長さ指定のパラメーターがなかったので、後置形式で指定されているか調べる
                        len = m[3] && m[3][0] || cur_default_len;
                    }
                    return tree.cons("chord", [tree.list(notes), tree.cons("length", [tree.num(len)]), tree.cons("gate_time",
                        [m.g.gate_time && tree.num(m.g.gate_time) || tree.string("none")])]);
                },
                pitch: function(m){     //音高をMIDIのNoteNum形式で求める
                    if(m[0] === 'r'){return tree.cons("pitch", [tree.num(-127)]);}
                    var pitch_num = _self.env.getOctaveInNoteNum();
                    pitch_num += _self.env.getPitchDifference(m.g.note_name);
                    var diff_pitch = _self.env.getPitchDiffByKey(m.g.note_name), num_accidentals = m[2].length;
                    if(m[1]){pitch_num += -diff_pitch;}     //調号を無効にする
                    pitch_num += diff_pitch;
                    if(num_accidentals){pitch_num += (m[2][0] == '-') ? -1 * num_accidentals : 1 * num_accidentals;}
                    return tree.cons("pitch", [tree.num(pitch_num)]);
                },
                shortened_command: function(m){
                    if(typeof m[0] == "string"){    //"<",">"コマンドの処理
                        var next_octave = (m[0] === '<') ? _self.env.cur_default_octave + 1 : _self.env.cur_default_octave - 1;
                        _self.cmd_manager.invoke("o", [[null, next_octave]]);
                        return tree.cons("command", [tree.string("o"), tree.string(next_octave), tree.string("none")]);
                    }
                    
                    var args = m[0], optional_args = args[3], command_name, arg1, arg2;   //その他のコマンドの処理
                    if(args[0] == '(' && args[3] == ')'){
                        command_name = "track";
                        _self.cmd_manager.invoke(command_name, args[2]);
                        arg1 = args[2];
                    }else{
                        command_name = (!m.g.keywords) ? "program_change" : args[1].toLowerCase();
                        _self.cmd_manager.invoke(command_name, [args[2], args[3] && optional_args[1], args[0] ? true : false]);
                        arg1 = args[2][1];
                        arg2 = args[3] && optional_args[1];
                    }
                    return tree.cons("command", [tree.string(command_name), tree.string(arg1), tree.string(arg2 || "none")]);
                },
                longer_command: function(m){
                    var command_name = m.g.commands.toLowerCase();
                    _self.cmd_manager.invoke(command_name, m.g.argument_list.array);
                    return tree.cons("command", [tree.string(command_name)].concat(m.g.argument_list.node || tree.string("none")));
                },
                argument_list: function(m){
                    var array, result;
                    if(m.g.digit_args){
                        array = m.g.digit_args.map(function(val){
                            return val[1];
                        }).filter(function(val){
                            return !!val;
                        });
                        array.unshift(m[0][0]);
                        result = {array : array, node : tree.num(array)};
                    }else{
                        var note_args = m.g.note_args, signs = [note_args[0]], note_names = [].concat(note_args[1]);
                        note_args[2].forEach(function(obj){
                            signs.push(obj[1]);
                            note_names.push(obj[2]);
                        });
                        array = [signs, note_names];
                        result = {array : array, node : [tree.string(signs.join("")), tree.string(note_names.join(""))]};
                    }
                    return result;
                }
            });
            
            this.cmd_manager.registerAll([
                {shorter_name : "o", longer_name : ["octave"], func : function(args){
                    _self.env.setOctave(args[0][1]);
                }},
                {shorter_name : null, longer_name : ["k.sign", "key_signature"], func : function(args){
                    _self.env.setCurrentKey(args);
                }},
                {shorter_name : "l", longer_name : null, func : function(args){
                    _self.env.setCurrentDefaultLength(args[0]);
                }},
                {shorter_name : "q", longer_name : null, func : function(args){
                    _self.env.setGateTime(args[0]);
                }},
                {shorter_name : "t", longer_name : ["tempo"], func : function(/*args*/){
                    //_self.env.setTempo(args[0]);
                }},
                {shorter_name : null, longer_name : ["track"], func : function(num){
                    _self.env.setTrackNum(num - 1);
                }},
                {shorter_name : null, longer_name : ["program_change"], func : function(args){
                    _self.env.setProgramNumForTrack(0, args[0][1]);
                }},
                {shorter_name : "v", longer_name : ["volume"], func : function(/*args*/){
                
                }},
                {shorter_name : "u", longer_name : ["velocity"], func : function(/*args*/){
                
                }}
            ]);
            
            this.parse = function(input_str){
                this.env = new util.Enviroment();
                var tokens = lexer.tokenize(input_str);
                var result = parser.parse(tokens, "mml");
                if(!result){return;}
                
                traverse.addParentPointers(result.value);
                return result.value;
            };
            
            this.stringifyErrors = function(){
                var errors = parser.errors, str = "";
                errors.forEach(function(error){
                    str += "An error occured in " + error.cause + " : " + error.msg + "\n";
                });
                
                return str;
            }
        }
    });
    
    return {mml_lexer : new MMLLexer(), mml_parser : new MMLParser()};
});