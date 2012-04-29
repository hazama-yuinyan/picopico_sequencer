define(["scripts/lib/enchant.js"], function(){
    return enchant.Class.create({
        initialize : function(definitions){
            this.tokenize = function(str){
                var tokens = [], m;
                
                while(str.length){
                    definitions.every(function(definition){
                        if(m = definition.regexp.exec(str)){
                            if(definition.type.search(/ignore/i) == -1){
                                tokens.push({type : definition.type == "operators" ? m[0] : definition.type,
                                    value : (definition.callback) ? definition.callback(m[0]) : m[0]});
                            }
                            return false;
                        }
                        
                        return true;
                    });
                    if(!m){throw new Error("Lexer Error!");}
                    str = str.substring(m[0].length);
                }
                
                return tokens;
            };
        }
    });
});