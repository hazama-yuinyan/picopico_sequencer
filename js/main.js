/**
 * main.js
 * ぴこぴこしーけんさー
 * developed by HAZAMA(http://funprogramming.ojaru.jp)
 */


define(["mml_compiler", "sequencer", "dojo/dom-class", "dijit/registry", "mml_updater"], function(compiler, Sequencer, dom_class, registry, updater){

    var sequencer = null,
    tree = null,
    compile = function(){
        var editor = registry.byId("editor");
        var tree = compiler.mml_parser.parse(editor.value);
        var display = registry.byId("ast");
        display.set("value", tree && tree.toPrettyString() || compiler.mml_parser.stringifyErrors());
        if(!tree){return;}
        sequencer = new Sequencer(tree, {stop : stop, play : play, hold : hold});
    },

    stop = function(){
        sequencer.stop();
    },
    
    play = function(){
        if(!sequencer){
            alert("まだ曲のデータの解析が終わっていません。\n初めて曲を再生する場合は、\"コンパイル\"ボタンを使ってください。");
            return;
        }
        sequencer.play();
    },
    
    hold = function(){
        sequencer.hold();
    },
    
    switchController = function(){
        dom_class.toggle("controller", "play_button");
        dom_class.toggle("controller", "hold_button");
    };
    
    var _self = this;
return {
    ".compile_button" : {
        onclick : function(e){
            e.stopImmediatePropagation();
            compile();
            var controller = dojo.byId("controller");
            switchController();
            controller.value = "一時停止";
        }
    },
    
    ".hold_button" : {
        onclick : function(e){
            e.stopImmediatePropagation();
            hold();
            e.target.value = "プレイ";
            switchController();
        }
    },
    
    ".stop_button" : {
        onclick : function(e){
            e.stopImmediatePropagation();
            stop();
            var controller = dojo.byId("controller");
            dom_class.toggle(controller, "hold_button", false);
            dom_class.toggle(controller, "play_button", true);
            controller.value = "プレイ";
        }
    },
    
    ".play_button" : {
        onclick : function(e){
            e.stopImmediatePropagation();
            play();
            e.target.value = "一時停止";
            switchController();
        }
    },
    
    "#compile_button" : function(target){
        dom_class.add(target, "compile_button");
    },
    
    "#controller" : function(target){
        dom_class.add(target, "play_button");
    },
    
    "#stop_button" : function(target){
        dom_class.add(target, "stop_button");
    },
    
    "#main_tab" : function(){
        var tab_container = registry.byId("main_tab");
        tab_container.watch("selectedChildWidget", function(name, old, new_val){
            if(new_val.title == "ピアノロール" && old.title == "MMLソース"){
                var tmp, error_console;
                try{
                    var editor = registry.byId("editor");
                    tmp = updater.compile(editor.value);
                }
                catch(e){
                    error_console = registry.byId("various_uses_pane");
                    error_console.domNode.textContent = e.message;
                    return;
                }
                if(!tmp.tree){
                    error_console = registry.byId("various_uses_pane");
                    error_console.domNode.textContent = tmp;
                    return;
                }
                tree = tmp.tree;
                new_val.set("_tree", tmp.list);
                new_val.onUpdate();
            }else if(old.title == "ピアノロール"){
                old.set("_tree", null);
            }
        });
    },
    
    "#editor" : function(){
        registry.byId("editor").value = "/[volume 127] [velocity 127]\n" +
            "(t1)@1 v100 c4c8d8 e8e8g4 e8e8d8d8 c1\n" +
            "[key_signature +f]\n" +
            "t132 l4 d edg f2d eda g2d <d>bg\n" +
            "f t66 e t132 <c>bga t80 g2\n" +
            "[key_signature +fc][volume 127]\n" +
            "t80 l8 bbffa2r4 bbffa4baa4^8,,80g,,60\n" +
            "[key_signature -b, -e, -a, -d, -g]\n" +
            "l4 o4 {dde}e2d4 cc>b4<c4d1\n\n" +

            '(t2)@0 v65 l2 "ceg" "ceg" "cfa" "d1gb"\n' +
            '/ここからキーGMajor\n' +
            'l4 d ">b<e"d">b<g" "a2f"d "ce"d"ca"\n' +
            '">b<g"960">b<d" "d2g<d""dg" "df""ce""c<c"\n' +
            '>"db"960"ca" ">b2<g"\n' +
            '/ここからキーDMajor\n' +
            'l8 ffdde2r4 ffdde4fee4^8,,60d,,50\n' +
            '/ここからキーDbMajor\n' +
            'v100 l1 o3 "dfa" l2 "egb" "ea<c" >"dfa"1920, 6"';
    }
};

});