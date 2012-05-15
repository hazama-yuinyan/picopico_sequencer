/**
 * main.js
 * ぴこぴこしーけんさー
 * developed by HAZAMA(http://funprogramming.ojaru.jp)
 */


define(["mml_compiler", "sequencer", "dojo/dom-class", "dijit/registry", "dojox/timing", "mml_updater"],
    function(compiler, Sequencer, dom_class, registry, timing, updater){

    var sequencer = null,
    data_store = null,
    timer = null,
    compile = function(){
        processMMLSource();
        var tab_container = registry.byId("main_tab");
        if(tab_container.selectedChildWidget.id == "piano_roll"){
            tab_container.selectedChildWidget.set("_tree", data_store.list);
        }
        var display = registry.byId("ast");
        display.set("value", data_store.tree && data_store.tree.toPrettyString() || compiler.mml_parser.stringifyErrors());
        if(!data_store.tree){return;}
        
        if(!sequencer){sequencer = new Sequencer({stop : stop, play : play, hold : hold});}
        sequencer.setASTTree(data_store.tree);
        sequencer.prepareToPlay();
    },

    stop = function(){
        sequencer.stop();
        timer.stop();
    },
    
    play = function(){
        if(!sequencer){
            alert("まだ曲のデータの解析が終わっていません。\n初めて曲を再生する場合は、\"コンパイル\"ボタンを使ってください。");
            return;
        }
        sequencer.play();
        
        var FPS = 30, millisecs_per_frame = 1000.0 / FPS;
        timer = new timing.Timer(millisecs_per_frame);
        var piano_roll = registry.byId("piano_roll"), ticks_per_quarter_note = piano_roll._ticks_per_quarter_note, num_iter = 0;
        timer.onStart = function(){
            piano_roll.set("_cur_ticks", 0);
            var viewport_pos = piano_roll.get("_viewport_pos");
            viewport_pos.x = 0;
            piano_roll.set("_viewport_pos", viewport_pos);
            piano_roll.onUpdate();
        };
        
        timer.onTick = function(){
            var cur_tempo = sequencer.getCurTempo(), ticks = cur_tempo * ticks_per_quarter_note / 60.0 / FPS;
            if(++num_iter % Math.floor(FPS / 2) === 0){
                var cur_ticks_in_seq = sequencer.cur_ticks;
                piano_roll.set("_cur_ticks", cur_ticks_in_seq);
            }
            piano_roll.onSoundPlaying(ticks);
            var error_console = registry.byId("various_uses_pane");
            error_console.domNode.textContent = piano_roll._cur_ticks * 100;
        };
        timer.start();
    },
    
    hold = function(){
        sequencer.hold();
    },
    
    processMMLSource = function(){
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
        
        error_console = registry.byId("various_uses_pane");
        if(!tmp.tree){
            error_console.domNode.textContent = tmp;
            return;
        }else{
            error_console.domNode.textContent = "compiled successfully!";
        }
        data_store = tmp;
    },
    
    switchController = function(){
        dom_class.toggle("controller", "play_button");
        dom_class.toggle("controller", "hold_button");
    };
    
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
            if(new_val.title == "ピアノロール"){
                processMMLSource();
                new_val.set("_metaevent_list", data_store.metaevents);
                new_val.set("_tree", data_store.list);
            }else if(old.title == "ピアノロール"){
                old.set("_tree", null);
            }
        });
    },
    
    "#track_selector" : function(){
        var track_selector = registry.byId("track_selector"), piano_roll = registry.byId("piano_roll");
        track_selector.watch("value", function(name, old, new_val){
            piano_roll.set("_track_num", new_val);
        });
    },
    
    "#editor" : function(){
        registry.byId("editor").set("value", "/[volume 127] [velocity 127]\n" +
            "(t1)@1 v40 c4c8d8 e8e8g4 e8e8d8d8 c1\n" +
            "[key_signature +f]\n" +
            "t132 l4 d edg f2d eda g2d <d>bg\n" +
            "f t66 e t132 <c>bga t80 g2\n" +
            "[key_signature +fc][volume 80]\n" +
            "t80 l8 bbffa2r4 bbffa4baa4^8,,80g,,60\n" +
            "[key_signature -b, -e, -a, -d, -g]\n" +
            "l4 o4 u30 {dde}e2d4,*240 cc>b4<c4d1\n\n" +

            '(t2)@0 v65 l2 "ceg" "ceg" "cfa" "d1gb"\n' +
            '/ここからキーGMajor\n' +
            'l4 d ">b<e"d">b<g" "a2f"d "ce"d"ca"\n' +
            '">b<g"960">b<d" "d2g<d""dg" "df""ce""c<c"\n' +
            '>"db"960"ca" ">b2<g"\n' +
            '/ここからキーDMajor\n' +
            'l8 ffdde2r4 ffdde4fee4^8,,60d,,50\n' +
            '/ここからキーDbMajor\n' +
            'v100 l1 o3 "dfa" l2 "egb" "ea<c" >"dfa"1920, 120\n');
    }
};

});