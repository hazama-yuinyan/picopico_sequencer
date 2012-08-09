/**
 * main.js
 * ぴこぴこしーけんさー
 * developed by HAZAMA(http://funprogramming.ojaru.jp)
 */


define(["app/mml_compiler", "app/sequencer", "dojo/dom-class", "dojo/on", "dijit/registry", "dojox/timing", "dijit/form/Select","app/mml_updater",
    "dojo/i18n!app/nls/resources", "dojo/aspect", "dojo/_base/xhr"],
    function(compiler, Sequencer, dom_class, on, registry, timing, Select, updater, resources, aspect, xhr){

    var sequencer = null,
    data_store = null,
    timer = null,
    source_changed = false,
    old_value = "",
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
            alert(resources.msg_prompt_compiling);
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
            setMsgOnStatusBar(piano_roll._cur_ticks);
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
        var tmp;
        try{
            var editor = registry.byId("editor");
            var source = toPlainString(editor.get("value"));
            tmp = updater.compile(source);
        }
        catch(e){
            setMsgOnStatusBar(e.message);
            return;
        }
        
        if(!tmp.tree){
            setMsgOnStatusBar(tmp);
            return;
        }else{
            setMsgOnStatusBar("compiled successfully!");
        }
        data_store = tmp;
    },
    
    switchController = function(){
        dom_class.toggle(".controller", "play_button");
        dom_class.toggle(".controller", "hold_button");
    },
    
    newFile = function(){
        if(source_changed){
            if(confirm(resources.warning_not_saved)){
                saveFile();
            }
        }
        
        var editor = registry.byId("editor");
        var title_editor = registry.byId("music_title"), last_modified_display = registry.byId("last_modified_display");
        editor.set("value", "");
        old_value = "";
        title_editor.set("value", resources.no_file_name);
        last_modified_display.set("value", "");
        reset();
        setMsgOnStatusBar(resources.msg_new_file_opened);
    },
    
    openFile = function(location){
        if(source_changed){
            if(confirm(resources.warning_not_saved)){
                saveFile();
            }
        }
        
        var file_name = registry.byId("select_file").get("value");
        var editor = registry.byId("editor"), title_editor = registry.byId("music_title"), author_editor = registry.byId("author_editor");
        var item = null, last_modified_display = registry.byId("last_modified_display");
        switch(location){
        case "LOCAL" :
            item = JSON.parse(localStorage.getItem(file_name));
            item.name = file_name;
            break;
        
        case "SERVER" :
            xhr.get({
                url : "sequencer",
                handleAs : "json",
                content : {
                    method : "get_content",
                    target : file_name
                },
                load : function(json_data){
                    item = {name : file_name, source : json_data.source};
                },
                error : function(msg){
                    alert(msg);
                }
            });
            break;
            
        case "FILE" : 
            break;
            
        default :
            alert("Unknown location!");
        }
        
        var source = item.source;
        editor.set("value", source);
        old_value = source;
        dom_class.toggle("save_button_label", "not_saved", false);  //remove the "not saved" indicator in case of it being already changed
        title_editor.set("value", item.name);
        author_editor.set("value", item.author);
        last_modified_display.set("value", item.date);
        reset();
        setMsgOnStatusBar(resources.msg_file_opened)
    },
    
    saveFile = function(){
        var loc_save = registry.byId("save_as").get("value"), last_modified_display = registry.byId("last_modified_display");
        var editor = registry.byId("editor"), source = editor.get("value"), author_editor = registry.byId("author_editor"), author_name = author_editor.get("value");
        var title_editor = registry.byId("music_title"), music_title = title_editor.get("value");
        var now = new Date();
        switch(loc_save){
        case "LOCAL":
            localStorage.setItem(music_title, JSON.stringify({source : source, date : now.toString(), author : author_name}));
            setMsgOnStatusBar(resources.msg_file_saved);
            source_changed = false;
            old_value = source;
            dom_class.toggle("save_button_label", "not_saved", false);  //remove the "not saved" indicator
            break;
            
        case "SERVER":
            var http_obj = new XMLHttpRequest();
            http_obj.open("post", "sequencer", true);
            http_obj.setRequestHeader("Content-Type", "application/json; char-set=UTF-8");
            http_obj.onreadystatechange = function(){
                if(this.readyState == 4 && this.status == 200){
                    setMsgOnStatusBar(resources.msg_file_saved);
                    source_changed = false;
                    old_value = source;
                    dom_class.toggle("save_button_label", "not_saved", false);  //remove the "not saved" indicator
                }else if(this.readyState == 4){
                    setMsgOnStatusBar(resources.msg_save_failed);
                }
            };
            http_obj.send('{"source":"'+source+'","date":"'+now.toString()+'","name":"'+music_title+'","author":"'+author_name+'"}');
            /*xhr.post({
                url : "/picopicosequencer",
                content : {
                    source : source,
                    date : new Date(),
                    name : music_title,
                    author : author_name
                },
                handleAs : "json",
                load : function(){
                    status_bar.domNode.textContent = resources.msg_file_saved;
                    source_changed = false;
                    old_value = source;
                    dom_class.toggle("save_button_label", "not_saved", false);  //remove the "not saved" indicator
                },
                error : function(){
                    status_bar.domNode.textContent = resources.msg_save_failed;
                }
            });*/
            break;
            
        case "FILE":
            throw new Error("Not implemented yet!");
            break;
            
        default:
            alert("保存先を選択してください！");
            return;
        }
        last_modified_display.set("value", now.toString());
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
    
    setMsgOnStatusBar = function(msg){
        var status_bar = registry.byId("various_uses_pane");
        status_bar.domNode.textContent = msg;
    };
    
return {
    behaviors : {
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
            var resource_names = ["open_explanation", "type_LOCAL", "type_SERVER", "type_FILE"], i = 0;
            open_from.options.forEach(function(option){
                option.label = resources[resource_names[i]];
                ++i;
            });
            open_from.startup();
            open_from.watch("value", function(name, old, new_val){
                var names;
                switch(new_val){
                case "LOCAL":
                    var data = retrieveAllDataFromStorage();
                    names = data.map(function(item){return {value : item.name, label : item.name};});
                    names.unshift({value : "", label : resources.open_prompt, selected : true});
                    break;
                
                case "SERVER":
                    xhr.get({
                        url : "sequencer",
                        handleAs : "json",
                        content : {
                            method : "get_list"
                        },
                        load : function(json_data){
                            setMsgOnStatusBar(resources.recieved_responce);
                            names = json_data.map(function(item){return {value : item.title, label : item.title};});
                            names.unshift({value : "", label : resources.open_prompt, selected : true});
                            select_file.set("options", names);
                            select_file.startup();
                        },
                        error : function(msg){
                            alert(msg);
                        }
                    });
                    setMsgOnStatusBar(resources.connect_to_server);
                    break;
                    
                case "FILE":
                    throw new Error("Not implemented yet!");
                    break;
                    
                default:
                    alert("保存元が選択されていません！");
                    return;
                }
                
                var select_file = registry.byId("select_file");
                if(!select_file){
                    select_file = new Select({
                        name : "selectFile",
                        options : names,
                        maxHeight : -1,
                        onChange : function(){
                            openFile(new_val);
                        }
                    }, "select_file");
                }else{
                    select_file.set("options", names);
                }
                select_file.startup();
            });
        },
        
        "#save_as" : function(){
            var save_as = registry.byId("save_as");
            var resource_names = ["save_explanation", "type_LOCAL", "type_SERVER", "type_FILE"], i = 0;
            save_as.options.forEach(function(option){
                option.label = resources[resource_names[i]];
                ++i;
            });
            save_as.startup();
        },
        
        "#main_tab" : function(){
            var tab_container = registry.byId("main_tab");
            tab_container.watch("selectedChildWidget", function(name, old, new_val){
                if(new_val.id == "piano_roll"){
                    processMMLSource();
                    new_val.set("_metaevent_list", data_store.metaevents);
                    new_val.set("_tree", data_store.list);
                }else if(old.id == "piano_roll"){
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
            newFile();
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
            aspect.after(editor, "onKeyUp", function(){
                var new_val = editor.get("value");
                if(old_value != new_val){
                    source_changed = true;
                    dom_class.toggle("save_button_label", "not_saved", true);
                }else{
                    source_changed = false;
                    dom_class.toggle("save_button_label", "not_saved", false);
                }
            });
            old_value = editor.get("value");
        }
    },
    resources : resources
};

});