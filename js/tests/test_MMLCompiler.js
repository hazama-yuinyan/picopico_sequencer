


define(["mml_compiler"], function(compiler){
    describe("tests.MMLcompiler", function (){
        var simple_mml_sources = [
                "abcdefg\n",
                "a4,10,100c8,,80d,80,80e,,127f,,0\n",
                "l4 t120 q8 abcabc\n",
                "l2 t80 a+b-8^4,40,127c*120\n",
                "\"c4eg\"\n",
                "\"<c1eg\",100\n",
                "\"ceg\"1920,100\n",
                "[key_signature +fc]\n",
                "[key_signature -b, -e, -a]\n",
                "[volume 127]\n",
                "[define test_macro'aabb4 c']\n",
                "[function (freq, time){\n" +
                "var a = 1;\n" +
                "}\n"
                ];
                
        it("MMLLexer tests", function(){
            var lexer = compiler.mml_lexer;
            
            var expected_lens = [
                8,
                25,
                13,
                19,
                7,
                10,
                9,
                7,
                12,
                5,
                8,
                11
                ];
            var tokens;
            simple_mml_sources.forEach(function(source, i){
                console.log("start " + (i + 1) + " th tokenization");
                tokens = lexer.tokenize(source);
                expect(tokens.length).toEqual(expected_lens[i]);
                console.log(tokens);
            });
        });
        
        it("MMLParser tests", function(){
            var parser = compiler.mml_parser;
            
            var tree;
            simple_mml_sources.forEach(function(source, i){
                console.log("start " + (i + 1) + " th parse");
                tree = parser.parse(simple_mml_sources[i]);
                expect(tree).not.toEqual(null);
                console.log(tree);
            });
        });
    });
});
