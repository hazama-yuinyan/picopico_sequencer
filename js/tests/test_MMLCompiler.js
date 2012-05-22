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
                "[define test_macro()'aabb4 c']\n",
                "[define with_params(a, b, c)\n" +
                "'a$(a)b$(c)c$(b)']\n",
                "[function (freq, time){\n" +
                "var a = 1;\n" +
                "}]\n",
                "ab ${test_macro} c1\n",
                "aacc b${with_params:2, 1, 4} c\n"
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
                10,
                16,
                14,
                9,
                17
                ];
            var tokens;
            simple_mml_sources.forEach(function(source, i){
                console.log("start " + (i + 1) + " th tokenization");
                tokens = lexer.tokenize(source);
                expect(tokens.length).toEqual(expected_lens[i]);
                console.log(tokens);
            });
        });
        
        it("MMLPreParser tests", function(){
            var lexer = compiler.mml_lexer, parser = compiler.mml_parser;
            var sources = [
                "[define test_macro()'aabb4 c']\n" +
                "ab ${test_macro} c1\n",
                "[define with_params(a, b, c)\n" +
                "'a$(a)b$(c)c$(b)']\n" +
                "aacc b${with_params:2, 1, 4} c\n"
                ];
            var expected_lens = [
                12,
                14
                ];
            
            sources.forEach(function(source, i){
                console.log("start " + (i + 1) + " th macro expansion");
                var tokens = lexer.tokenize(source);
                var preparsed = parser.preparse(tokens);
                expect(preparsed.length).toEqual(expected_lens[i]);
                console.log(preparsed);
            });
        });
        
        it("MMLParser tests", function(){
            var parser = compiler.mml_parser;
            
            var tree, sources = simple_mml_sources.slice(0, simple_mml_sources.length - 2);
            sources.forEach(function(source, i){
                console.log("start " + (i + 1) + " th parse");
                tree = parser.parse(source);
                expect(tree).not.toEqual(null);
                console.log(tree);
            });
        });
    });
});
