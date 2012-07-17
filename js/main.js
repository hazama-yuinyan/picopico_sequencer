/**
 * main.js
 * ぴこぴこしーけんさー
 * developed by HAZAMA(http://funprogramming.ojaru.jp)
 */


define(["mml_compiler", "sequencer", "dojo/dom-class", "dojo/on", "dijit/registry", "dojox/timing", "dijit/form/Select", "dojo/store/Memory",
    "mml_updater"],
    function(compiler, Sequencer, dom_class, on, registry, timing, Select, Memory, updater){

    var sequencer = null,
    data_store = null,
    timer = null,
    source_changed = false,
    reset = function(){
        sequencer = null;
        data_store = null;
        timer = null;
        source_changed = false;
    },
    
    compile = function(){
        processMMLSource();
        var tab_container = registry.byId("main_tab");
        if(tab_container.selectedChildWidget.id == "piano_roll"){
            tab_container.selectedChildWidget.set("_metaevent_list", data_store.metaevents);
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
    
    toPlainString = function(html_source){
        return html_source.replace(/<br[^>]+>|<\/div>/g, "\n").replace(/<[^>]+>/g, "").replace(/&quot;/g, "\"").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
    },
    
    toDisplayedString = function(str){
        return str.replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
    },
    
    processMMLSource = function(){
        var tmp, error_console;
        try{
            var editor = registry.byId("editor");
            var source = toPlainString(editor.get("value"));
            tmp = updater.compile(source);
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
    },
    
    newFile = function(){
        if(source_changed){
            if(confirm("未保存のファイルが開かれています。編集中のファイルを先に保存しますか？")){
                saveFile();
            }else{
                return;
            }
        }
        
        var editor = registry.byId("editor"), status_bar = registry.byId("various_uses_pane");
        var title_editor = registry.byId("music_title");
        editor.set("value", "");
        title_editor.set("value", "名無しのファイルさん");
        reset();
        status_bar.domNode.textContent = "新規ファイルに切り替えました。";
    },
    
    openFile = function(data){
        if(source_changed){
            if(confirm("未保存のファイルが開かれています。編集中のファイルを先に保存しますか？")){
                saveFile();
            }else{
                return;
            }
        }
        
        var file_name = registry.byId("select_file").get("value"), status_bar = registry.byId("various_uses_pane");
        var editor = registry.byId("editor"), title_editor = registry.byId("music_title");
        var item = null;
        data.every(function(datum){
            if(datum.name == file_name){
                item = datum;
                return false;
            }
            return true;
        });
        
        var source = item.source;
        editor.set("value", source);
        title_editor.set("value", item.name);
        reset();
        status_bar.domNode.textContent = "ファイルを開きました。";
    },
    
    saveFile = function(){
        var loc_save = registry.byId("save_as").get("value");
        var editor = registry.byId("editor"), source = editor.get("value");
        var title_editor = registry.byId("music_title"), music_title = title_editor.get("value");
        switch(loc_save){
        case "LOCAL":
            localStorage.setItem(music_title, JSON.stringify({source : source, date : new Date()}));
            break;
            
        case "SERVER":
            throw new Error("Not implemented yet!");
            break;
            
        case "FILE":
            throw new Error("Not implemented yet!");
            break;
            
        default:
            alert("保存先を選択してください！");
            return;
        }
        
        source_changed = false;
        dom_class.toggle("save_button_label", "not_saved", false);  //remove the "not saved" indicator
        var status_bar = registry.byId("various_uses_pane");
        status_bar.domNode.textContent = "正常に保存しました。";
    },
    
    retrieveAllDataFromStorage = function(){
        var data = [];
        for(var i = 0; i < localStorage.length; ++i){
            var cur_key = localStorage.key(i);
            var item = JSON.parse(localStorage.getItem(cur_key));
            data.push({name : cur_key, source : item.source, date : item.date});
        }
        return data;
    },
    
    handleLanguageSwitch = function(lang_name){
        
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
    
    "#new_button" : function(target){
        on(target, "click", newFile);
    },
    
    "#accept_button" : function(target){
        on(target, "click", saveFile);
    },
    
    "#open_from" : function(){
        var open_from = registry.byId("open_from");
        open_from.watch("value", function(name, old, new_val){
            var file_store;
            switch(new_val){
            case "LOCAL":
                var data = retrieveAllDataFromStorage();
                var names = data.map(function(item){return {value : item.name, label : item.name};});
                names.unshift({value : "", label : "開くファイルを選択してください", selected : true});
                break;
            
            case "SERVER":
                throw new Error("Not implemented yet!");
                break;
                
            case "FILE":
                throw new Error("Not implemented yet!");
                break;
                
            default:
                alert("保存元が選択されていません！");
                return;
            }
            
            var select_file = new Select({
                name : "selectFile",
                options : names,
                maxHeight : -1,
                onChange : function(){
                    openFile(data);
                }
            }, "select_file");
            select_file.startup();
        });
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
        var editor = registry.byId("editor");
        editor.set("value", "/[volume 127] [velocity 127]<br>" +
            "[function (freq, time){<br>" +
            "return Math.cos(2 * Math.PI * freq * time);<br>" +
            "}]<br>" +
            "(t1)@6 v40 c4c8d8 e8e8g4 e8e8d8d8 c1<br>" +
            "[key_signature +f]<br>" +
            "t132 l4 d edg f2d eda g2d &lt;d&gt;bg<br>" +
            "f t66 e t132 &lt;c&gt;bga t80 g2<br>" +
            "[key_signature +fc][volume 80]<br>" +
            "t80 l8 bbffa2r4 bbffa4baa4^8,,80g,,-20<br>" +
            "[key_signature -b, -e, -a, -d, -g]<br>" +
            "l4 o4 u30 {dde}e2d4,*240,+30 cc&gt;b4&lt;c4d1<br><br>" +

            '(t2)@0 v65 l2 &quot;ceg&quot; &quot;ceg&quot; &quot;cfa&quot; &quot;d1gb&quot;<br>' +
            '/ここからキーGMajor<br>' +
            'l4 d &quot;&gt;b&lt;e&quot;d&quot;&gt;b&lt;g&quot; &quot;a2f&quot;d &quot;ce&quot;d&quot;ca&quot;<br>' +
            '&quot;&gt;b&lt;g&quot;960&quot;&gt;b&lt;d&quot; &quot;d2g&lt;d&quot;&quot;dg&quot; &quot;df&quot;&quot;ce&quot;&quot;c&lt;c&quot;<br>' +
            '&gt;&quot;db&quot;960&quot;ca&quot; &quot;&gt;b2&lt;g&quot;<br>' +
            '/ここからキーDMajor<br>' +
            'l8 ffdde2r4 ffdde4fee4^8,,60d,,50<br>' +
            '/ここからキーDbMajor<br>' +
            'v100 l1 o3 &quot;dfa&quot; l2 &quot;egb&quot; &quot;ea&lt;c&quot; &gt;&quot;dfa&quot;1920, 120<br>');
        editor.watch("value", function(name, old, new_val){
            if(old != new_val){
                source_changed = true;
                dom_class.toggle("save_button_label", "not_saved", true);
            }
        });
    }
};

});