define(["dojo/_base/lang", "app/mml_compiler"], function(lang, mml_compiler){
    
    // module: mml_updater
    // summary: 
    //      
    
    var compiler = mml_compiler.mml_parser;
    return {
        start_time : 0,
        last_vol : 100,
        
        /**
         * ASTノードに対してArray.prototype.indexOfと同じ処理を施す
         * @param node {Object} 処理対象となるASTノード
         * @param target_node {Object} 探索対象のノード
         * @returns {Number} | -1 探索対象のノードの親要素内でのインデックス
         */
        indexOf : function(node, target_node){
            for(var i = 0; i < node.length; ++i){
                if(node[i] == target_node){return i;}
            }
            return -1;
        },
    
        /**
         * 次の処理対象となるASTノードを探しだす
         * @param node {Object} 探索元となるASTノード
         * @param skip_child {boolean} 子要素を探索するかどうか
         * @returns {Object} | null 見つかったノード、またはnull
         */
        getNextNode : function(node, skip_child){
            if(!skip_child && (node.cons === "params" || node.cons === "command" || node.cons === "chord")){return node;}
            if(!skip_child && node.length){return this.getNextNode(node[0], false);}
            
            if(!node.parent){
                return null;
            }
            var index = this.indexOf(node.parent, node);
            if(index + 1 >= node.parent.length){
                return this.getNextNode(node.parent, true);
            }else{
                return this.getNextNode(node.parent[index + 1], false);
            }
        },
        
        simplifyNote : function(params){
            // summary:
            //      noteタイプのノードのparamsを受け取って一つのオブジェクトにまとめる
            
            var gate_time = (params[0][2][0].value != "none") ? params[0][2][0].value : 0;
            var vol = (!lang.isString(params[0][3][0].value)) ? params[0][3][0].value : 
                      (params[0][3][0].value == "none") ? params[0][3][1].value : this.last_vol + parseInt(params[0][3][0].value + params[0][3][1].value);
            var tmp = {type : (params[0][0][0].value < 0) ? "rest" : "note", pitch : params[0][0][0].value, length : params[0][1][0].value,
                gate_time : gate_time, velocity : vol, start_time : this.start_time};
            
            this.last_vol = vol;
            return tmp;
        },
        
        simplifyChord : function(chord){
            // summary:
            //      chordタイプのノードを受け取って簡単なnoteオブジェクトの配列にする
            
            var tmp = [], _self = this, len = chord[1][0].value;
            chord[0].forEach(function(note){
                var tmp_val = _self.simplifyNote(note[0]);
                tmp_val.length = len;
                if(chord[2][0].value != "none"){tmp_val.gate_time = chord[2][0].value;}
                tmp.push(tmp_val);
            });
            this.start_time += len;
            
            return tmp;
        },
        
        simplifyCommand : function(command){
            // summary:
            //      commandタイプのノードを受け取って一つのオブジェクトにまとめる
            
            var tmp = {type : "command", name : command[0].value, arg1 : lang.isArray(command[1]) ? command[1] : command[1].value,
                arg2 : command[2] && command[2].value || "none", start_time : this.start_time};
            return tmp;
        },
        
        compile : function(str){
            var tree = compiler.parse(str);
            if(!tree){return compiler.stringifyErrors();}
            
            var node = this.getNextNode(tree, false), list = [], inner = [], metaevents = [];
            do{
                switch(node.cons){
                case "params" :
                    var tmp = this.simplifyNote(node);
                    this.start_time += tmp.length;
                    inner.push(tmp);
                    break;
                    
                case "chord" :
                    inner.push(this.simplifyChord(node));
                    break;
                    
                case "command" :
                    tmp = this.simplifyCommand(node);
                    if(tmp.name == "track" && tmp.arg1 != 1){
                        this.start_time = 0;
                        list.push(inner);
                        inner = [];
                    }else if(tmp.name.search(/^(t|tempo|k.sign|key_signature|program_change)/) != -1){
                        metaevents.push(tmp);
                    }
                    break;
                
                default :
                    throw Error("Unknown type!");
                }
            }while((node = this.getNextNode(node, true)));
            
            list.push(inner);
            this.start_time = 0;
            return {tree : tree, list : list, metaevents : metaevents};
        },
        
        sourcify : function(ast){
        }
    };
});
