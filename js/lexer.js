define(["dojo/_base/declare"], function(declare){
    return declare(null, {
        constructor : function(definitions){
            this.definitions = definitions;
        },
        
        tokenize : function(str){
            var tokens = [], m, line_num = 1, num_chars = 1;
            
            while(str.length){
                this.definitions.every(function(definition){
                    if(m = definition.regexp.exec(str)){
                        if(definition.type.search(/ignore/i) == -1){
                            if(definition.enable_if && !definition.enable_if()){
                                m = null;
                                return true;
                            }
                            tokens.push({type : definition.type == "operators" ? m[0] : definition.type,
                                value : (definition.callback) ? definition.callback(m[0]) : m[0],
                                line_num : line_num, num_chars : num_chars});
                        }
                        return false;
                    }
                        
                    return true;
                });
                if(!m){throw new Error("Lexer Error! at " + line_num + " : " + num_chars);}
                str = str.substring(m[0].length);
                
                num_chars += m[0].length;
                if(m[0].search(/[\n\r]/) != -1){
                    num_chars = 1;
                    ++line_num;
                }
            }
                
            return tokens;
        }
    });
});