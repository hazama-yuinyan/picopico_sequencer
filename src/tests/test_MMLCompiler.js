define(["app/mml_compiler"], function(compiler){
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
        "aacc b${with_params:2, 1, 4} c\n",
        "{ab<c}2{ab<c}2\n",
        '{"ceg""ceg""ceg"}2{"eg<c">"eg<c">"eg<c"}2\n'
        ];
    describe("tests.MMLcompiler.Lexer", function (){
        var lexer = compiler.mml_lexer;
        it("basics", function(){
            var expected_lens = [
                8,
                25,
                13,
                19
                ];
            var tokens, sources = simple_mml_sources;
            for(var i = 0; i < 4; ++i){
                console.log("start " + (i + 1) + " th tokenization");
                tokens = lexer.tokenize(sources[i]);
                expect(tokens.length).toEqual(expected_lens[i]);
                console.log(tokens);
            };
        });
        it("chords", function(){
            lexer.resetState();
            var expected_lens = [
                7,
                10,
                9
                ];
            var tokens, sources = simple_mml_sources;
            for(var i = 4; i < 7; ++i){
                console.log("start " + (i - 3) + " th tokenization");
                tokens = lexer.tokenize(sources[i]);
                expect(tokens.length).toEqual(expected_lens[i - 4]);
                console.log(tokens);
            };
        });
        it("commands", function(){
            lexer.resetState();
            var expected_lens = [
                7,
                12,
                5,
                10,
                16,
                14,
                9,
                17
                ];
            var tokens, sources = simple_mml_sources;
            for(var i = 7; i < 13; ++i){
                console.log("start " + (i - 6) + " th tokenization");
                tokens = lexer.tokenize(sources[i]);
                expect(tokens.length).toEqual(expected_lens[i - 7]);
                console.log(tokens);
            };
        });
        it("with macros", function(){
            lexer.resetState();
            var expected_lens = [
                9,
                17
                ];
            var tokens, sources = simple_mml_sources;
            for(var i = 13; i < 15; ++i){
                console.log("start " + (i - 12) + " th tokenization");
                tokens = lexer.tokenize(sources[i]);
                expect(tokens.length).toEqual(expected_lens[i - 13]);
                console.log(tokens);
            };
        });
        it("tuplets", function(){
            lexer.resetState();
            var expected_lens = [
                15,
                42
                ];
            var tokens, sources = simple_mml_sources;
            for(var i = 15; i < 17; ++i){
                console.log("start " + (i - 14) + " th tokenization");
                tokens = lexer.tokenize(sources[i]);
                expect(tokens.length).toEqual(expected_lens[i - 15]);
                console.log(tokens);
            }
        })
    });
    describe("tests.MMLCompiler.PreParser", function(){
        var lexer = compiler.mml_lexer, parser = compiler.mml_parser;
        it("simple", function(){
            lexer.resetState();
            var source = 
                "[define test_macro()'aabb4 c']\n" +
                "ab ${test_macro} c1\n";
            var expected_len = 12;
            
            var tokens = lexer.tokenize(source);
            var preparsed = parser.preparse(tokens);
            expect(preparsed.length).toEqual(expected_len);
            console.log(preparsed);
        });
        it("with parameters", function(){
            lexer.resetState();
            var source =
                "[define with_params(a, b, c)\n" +
                "'a$(a)b$(c)c$(b)']\n" +
                "aacc b${with_params:2, 1, 4} c\n";
            var expected_len = 14;
            
            var tokens = lexer.tokenize(source);
            var preparsed = parser.preparse(tokens);
            expect(preparsed.length).toEqual(expected_len);
            console.log(preparsed);
        });
        it("with arguments containing operators", function(){
            lexer.resetState();
            var source = 
                "[define with_opes(a, b)\n" +
                "'\"a$(a)bc\"$(b)']\n" +
                "\"ceg\"\"ceg\" ${with_opes:4^8, >} \"ceg\"\n";
            var expected_len = 26;
            
            var tokens = lexer.tokenize(source);
            var preparsed = parser.preparse(tokens);
            expect(preparsed.length).toEqual(expected_len);
            console.log(preparsed);
        });
        it("with parameters but no arguments", function(){
            lexer.resetState();
            var source =
                "[define with_params(a, b, c)\n" +
                "'a$(a)b$(c)c$(b)']\n" +
                "aacc b${with_params:2} c\n";
            var expected_len = 12;
            
            var tokens = lexer.tokenize(source);
            var preparsed = parser.preparse(tokens);
            expect(preparsed.length).toEqual(expected_len);
            console.log(preparsed);
        });
        it("with arguments containing keywords", function(){
            lexer.resetState();
            var source =
                "[define with_params(keyword, b, c)\n" +
                "'$(keyword) ab$(c)c$(b)']\n" +
                "aacc b${with_params:l8, 2, 4} c\n";
            var expected_len = 15;
            
            var tokens = lexer.tokenize(source);
            var preparsed = parser.preparse(tokens);
            expect(preparsed.length).toEqual(expected_len);
            console.log(preparsed);
        });
    });
    describe("tests.MMLCompiler.Parser", function(){
        var parser = compiler.mml_parser;
        it("basics", function(){
            var tree, sources = simple_mml_sources.slice(0, 4);
            sources.forEach(function(source, i){
                console.log("start " + (i + 1) + " th parse");
                tree = parser.parse(source);
                expect(tree).not.toEqual(null);
                console.log(tree);
            });
        });
        it("chords", function(){
            var tree, sources = simple_mml_sources.slice(4, 7);
            sources.forEach(function(source, i){
                console.log("start " + (i + 1) + " th parse");
                tree = parser.parse(source);
                expect(tree).not.toEqual(null);
                console.log(tree);
            });
        });
        it("commands", function(){
            var tree, sources = simple_mml_sources.slice(7, 13);
            sources.forEach(function(source, i){
                console.log("start " + (i + 1) + " th parse");
                tree = parser.parse(source);
                expect(tree).not.toEqual(null);
                console.log(tree);
            });
        });
        it("tuplets", function(){
            var tree, sources = simple_mml_sources.slice(15, 17);
            sources.forEach(function(source, i){
                console.log("start " + (i + 1) + " th parse");
                tree = parser.parse(source);
                expect(tree).not.toEqual(null);
                console.log(tree);
            });
        });
    });
});
