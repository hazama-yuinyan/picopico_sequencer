/**
 * main.js
 * ぴこぴこしーけんさー
 * developed by HAZAMA(http://funprogramming.ojaru.jp)
 */

var main = {};

require(["mml_compiler", "sequencer"], function(compiler, Sequencer){

main.compile = function(){
    var editor = document.getElementById("editor");
    var tree = compiler.mml_parser.parse(editor.value);
    var display = document.getElementById("ast");
    display.value = tree.toPrettyString();
    this.sequencer = new Sequencer(tree, this);
};

main.stop = function(){
    main.sequencer.stop();
    var button = document.getElementById("controller");
    button.onclick = main.play;
    button.value = "プレイ";
};

main.play = function(){
    var button = document.getElementById("controller");
    button.onclick = main.stop;
    button.value = "ストップ";
    main.sequencer.play();
};

});