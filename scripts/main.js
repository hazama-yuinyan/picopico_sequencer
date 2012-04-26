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
    var button = document.getElementById("controller");
    button.onclick = main.hold;
    button.value = "一時停止";
};

main.stop = function(){
    main.sequencer.stop();
    main.sequencer.reinitialize();
    var button = document.getElementById("controller");
    button.onclick = main.play;
    button.value = "プレイ";
};

main.play = function(){
    if(!main.sequencer){
        alert("まだ曲のデータの解析が終わっていません。\n初めて曲を再生する場合は、\"コンパイル\"ボタンを使ってください。");
        return;
    }
    var button = document.getElementById("controller");
    button.onclick = main.hold;
    button.value = "一時停止";
    main.sequencer.play();
};

main.hold = function(){
    main.sequencer.stop();
    var button = document.getElementById("controller");
    button.onclick = main.play;
    button.value = "プレイ";
};

});