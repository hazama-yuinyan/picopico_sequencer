


define(["mml_compiler"], function(compiler){
    describe("tests.MMLtokenizer", function (){
        it("MMLLexer tests", function(){
            var lexer = compiler.mml_lexer;
            var simple_mml_sources = [
                "abcdefg",
                "a4,10,100c8,,80d,80,80e,,127f,,0",
                "l4 t120 q8 abcabc",
                "l2 t80 a+b-8^4,40,127c*120",
                "\"c4eg\"",
                "\"<c1eg\",100",
                "\"ceg\"1920,100",
                "[key_signature +fc]",
                "[key_signature -b, -e, -a]",
                "[volume 127]",
                "[function (freq, time){\n" +
                "var a = 1;\n" +
                "}"
                ];
            var expected_lens = [
                7,
                24,
                12,
                18,
                6,
                9,
                8,
                6,
                11,
                4,
                10
                ];
            var tokens;
            simple_mml_sources.forEach(function(source, i){
                console.log("start " + (i + 1) + " th tokenization");
                tokens = lexer.tokenize(source);
                expect(tokens.length).toEqual(expected_lens[i]);
                console.log(tokens);
            });
        });
    });
});
