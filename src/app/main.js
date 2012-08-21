/**
 * main.js
 * ぴこぴこしーけんさー
 * developed by HAZAMA(http://funprogramming.ojaru.jp)
 */


define(["app/mml_compiler", "app/sequencer", "dojo/dom-class", "dojo/on", "dijit/registry", "dojox/timing", "dijit/form/Select","app/mml_updater",
    "dojo/i18n!app/nls/resources", "dojo/aspect", "dojo/request", "dojo/dom", "dojo/ready"],
    function(compiler, Sequencer, dom_class, on, registry, timing, Select, updater, resources, aspect, request, dom, ready){

    var sequencer = null,
    data_store = null,
    saved_data = null,
    timer = null,
    contents_changed = {
        source : false,
        comment : false,
        author : false,
        name : false
    },
    old_value = "",
    listener_remover = null,
    reset = function(){
        sequencer = null;
        data_store = null;
        timer = null;
        resetContentsStatus();
    },
    
    resetContentsStatus = function(){
        contents_changed.source = false;
        contents_changed.comment = false;
        contents_changed.author = false;
        contents_changed.name = false;
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
        var controller = registry.byId("controller");
        switchController(controller, "play");
    },
    
    play = function(){
        if(!sequencer){
            alert(resources.msg_prompt_compiling);
            return;
        }
        var controller = registry.byId("controller");
        switchController(controller, "hold");
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
    
    resume = function(){
        var controller = registry.byId("controller");
        switchController(controller, "hold");
        sequencer.resume();
        timer.onStart = null;
        timer.start();
    },
    
    hold = function(){
        var controller = registry.byId("controller");
        switchController(controller, "resume");
        sequencer.hold();
        timer.stop();
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
            setMsgOnStatusBar("Compiled successfully!");
        }
        data_store = tmp;
    },
    
    switchController = function(controller, mode){
        if(listener_remover){listener_remover.remove();}
        
        switch(mode){
        case "play" :
            listener_remover = on(controller.domNode, "click", onPlayButtonClicked);
            controller.set("label", resources.play_btn_text);
            break;
            
        case "hold" :
            listener_remover = on(controller.domNode, "click", onHoldButtonClicked);
            controller.set("label", resources.hold_btn_text);
            break;
        
        case "resume" :
            listener_remover = on(controller.domNode, "click", onResumeButtonClicked);
            controller.set("label", resources.resume_btn_text);
            break;
            
        default :
            throw new Error("Unknown mode!");
        }
    },
    
    addDotToStatusBar = function(interval, str){
        var tmp = str;
        var timer_id = setInterval(function(){
            tmp = tmp + ".";
            setMsgOnStatusBar(tmp);
        }, interval);
        setMsgOnStatusBar(str);
        return function(){
            clearInterval(timer_id);
        };
    },
    
    newFile = function(){
        if(contents_changed.source){
            if(confirm(resources.warning_not_saved)){
                saveFile();
            }
        }
        
        var editor = registry.byId("editor"), comment_editor = registry.byId("comment_editor"), author_editor = registry.byId("author_editor");
        var title_editor = registry.byId("music_title"), last_modified_display = registry.byId("last_modified_display");
        editor.set("value", "");
        old_value = "";
        title_editor.set("value", resources.no_file_name);
        author_editor.set("value", "");
        comment_editor.set("value", "");
        last_modified_display.set("value", "");
        reset();
        setMsgOnStatusBar(resources.msg_new_file_opened);
        dom_class.toggle("save_button_label", "not_saved", false);
    },
    
    openFile = function(location, file_name, other_info){
        if(contents_changed.source){
            if(confirm(resources.warning_not_saved)){
                saveFile();
            }
        }
        
        var editor = registry.byId("editor"), title_editor = registry.byId("music_title"), author_editor = registry.byId("author_editor");
        var item = null, last_modified_display = registry.byId("last_modified_display"), comment_editor = registry.byId("comment_editor");
        
        switch(location){
        case "LOCAL" :
            item = JSON.parse(localStorage.getItem(file_name));
            editor.set("value", item.source);
            old_value = item.source;
            title_editor.set("value", item.name);
            author_editor.set("value", item.author);
            comment_editor.set("value", item.comment);
            last_modified_display.set("value", item.date);
            reset();
            dom_class.toggle("save_button_label", "not_saved", false);  //remove the "not saved" indicator in case of it being already changed
            setMsgOnStatusBar(resources.msg_file_opened);
            break;
        
        case "SERVER" :
            request.get("sequencer", {
                handleAs : "json",
                query : {
                    method : "get_content",
                    target : file_name
                }
            }).then(
                function(json_data){
                    clear();
                    editor.set("value", json_data.source);
                    old_value = json_data.source;
                    title_editor.set("value", file_name);
                    author_editor.set("value", other_info.author);
                    comment_editor.set("value", other_info.comment);
                    last_modified_display.set("value", other_info.date);
                    reset();
                    dom_class.toggle("save_button_label", "not_saved", false);  //remove the "not saved" indicator in case of it being already changed
                    setMsgOnStatusBar(resources.msg_file_opened);
                },
                function(error_msg){
                    clear();
                    alert(error_msg);
                }
            );
            var clear = addDotToStatusBar(1000, resources.connect_to_server);
            break;
            
        case "FILE" : 
            throw new Error("Not implemented yet!");
            break;
            
        default :
            alert("Unknown location!");
        }
    },
    
    prepareForSave = function(){
        var now = new Date(), title_editor = registry.byId("music_title"), music_title = title_editor.get("value");
        var item = {source : null, author : null, comment : null, name : music_title, date : now.toString()};
        if(contents_changed.name || contents_changed.source){   //タイトルを変更したときは問答無用で全プロパティーを更新する
            var editor = registry.byId("editor"), source = editor.get("value");
            item.source = source;
        }
        
        if(contents_changed.name || contents_changed.author){
            var author_editor = registry.byId("author_editor"), author_name = author_editor.get("value");
            item.author = author_name;
        }
        
        if(contents_changed.name || contents_changed.comment){
            var comment_editor = registry.byId("comment_editor"), comment = comment_editor.get("value");
            item.comment = comment;
        }
        return item;
    },
    
    saveFile = function(){
        var loc_save = registry.byId("save_as").get("value"), last_modified_display = registry.byId("last_modified_display");
        var item = prepareForSave();
        
        switch(loc_save){
        case "LOCAL":
            var old_item = JSON.parse(localStorage.getItem(item.name));
            if(old_item){   //変更されていないプロパティーをすでに保存されているオブジェクトから拾ってくる
                if(!item.source){
                    item.source = old_item.source;
                }
                if(!item.author){
                    item.author = old_item.author;
                }
                if(!item.comment){
                    item.comment = old_item.comment;
                }
            }
            localStorage.setItem(item.name, JSON.stringify(item));
            setMsgOnStatusBar(resources.msg_file_saved);
            resetContentsStatus();
            old_value = item.source;
            dom_class.toggle("save_button_label", "not_saved", false);  //remove the "not saved" indicator
            break;
            
        case "SERVER":
            var http_obj = new XMLHttpRequest();
            http_obj.open("post", "sequencer", true);
            http_obj.setRequestHeader("Content-Type", "application/json; charset=UTF-8");
            http_obj.onreadystatechange = function(){
                if(this.readyState == 4 && this.status == 200){
                    clear();
                    setMsgOnStatusBar(resources.msg_file_saved);
                    resetContentsStatus();
                    old_value = item.source;
                    dom_class.toggle("save_button_label", "not_saved", false);  //remove the "not saved" indicator
                }else if(this.readyState == 4){
                    clear();
                    setMsgOnStatusBar(resources.msg_save_failed);
                }
            };
            http_obj.send(JSON.stringify(item));
            var clear = addDotToStatusBar(1000, resources.connect_to_server);
            break;
            
        case "FILE":
            throw new Error("Not implemented yet!");
            break;
            
        default:
            alert("保存先を選択してください！");
            return;
        }
        last_modified_display.set("value", item.date);
    },
    
    retrieveAllDataFromStorage = function(){
        var data = [];
        for(var i = 0; i < localStorage.length; ++i){
            var cur_key = localStorage.key(i);
            var item = JSON.parse(localStorage.getItem(cur_key));
            data.push({name : cur_key, comment : item.comment, author : item.author, date : item.date});
        }
        return data;
    },
    
    setMsgOnStatusBar = function(msg){
        var status_bar = registry.byId("various_uses_pane");
        status_bar.domNode.textContent = msg;
    },
    
    onPlayButtonClicked = function(e){
        e.stopImmediatePropagation();
        play();
    },
    
    onResumeButtonClicked = function(e){
        e.stopImmediatePropagation();
        resume();
    },
    
    onHoldButtonClicked = function(e){
        e.stopImmediatePropagation();
        hold();
    };
    
    ready(function(){
        var compile_btn = dom.byId("compile_button"), stop_btn = dom.byId("stop_button");
        on(compile_btn, "click", function(e){
            e.stopImmediatePropagation();
            compile();
        });
    
        var controller = registry.byId("controller");
        switchController(controller, "play");
    
        on(stop_btn, "click", function(e){
            e.stopImmediatePropagation();
            stop();
        });
    
        var new_btn = dom.byId("new_button"), accept_btn = dom.byId("accept_button");
        on(new_btn, "click", newFile);
    
        on(accept_btn, "click", saveFile);
    
        var open_from = registry.byId("open_from"), open_btn = registry.byId("open_button"), dialog_content = registry.byId("openDialogContent");
        var resource_names = ["open_explanation", "type_LOCAL", "type_SERVER", "type_FILE"], i = 0;
        open_from.options.forEach(function(option){
            option.label = resources[resource_names[i]];
            ++i;
        });
        open_from.startup();
        open_from.onChange = function(){
            var loc = this.get("value"), names;
            switch(loc){
            case "LOCAL":
                saved_data = retrieveAllDataFromStorage();
                names = saved_data.map(function(item){return {value : item.name, label : item.name};});
                names.unshift({value : "", label : resources.open_prompt, selected : true});
                break;
            
            case "SERVER":
                request.get("sequencer", {
                    handleAs : "json",
                    query : {
                        method : "get_list"
                    }
                }).then(
                    function(json_data){
                        clear();
                        setMsgOnStatusBar(resources.received_responce);
                        saved_data = json_data;
                        names = json_data.map(function(item){return {value : item.name, label : item.name};});
                        names.unshift({value : "", label : resources.open_prompt, selected : true});
                        select_file.set("options", names);
                        select_file.startup();
                        open_btn.openDropDown();
                    },
                    function(error_msg){
                        clear();
                        alert(error_msg);
                    }
                );
                var clear = addDotToStatusBar(1000, resources.connect_to_server);
                break;
                
            case "FILE":
                throw new Error("Not implemented yet!");
                break;
                
            default:
                alert("保存元が選択されていません！");
                return;
            }
            
            var select_file = registry.byId("select_file"), _self = this;
            if(!select_file){
                select_file = new Select({
                    name : "selectFile",
                    options : names,
                    maxHeight : -1,
                    onChange : function(){
                        var file_name = this.get("value"), target, location = _self.get("value");
                        saved_data.every(function(item){
                            if(item.name == file_name){
                                target = item;
                                return false;
                            }
                            return true;
                        });
                        openFile(location, file_name, target);
                    }
                }, "select_file");
                dialog_content.addChild(select_file);
            }else{
                select_file.set("options", names);
            }
            select_file.startup();
            open_btn.openDropDown();
        };
    
        var save_as = registry.byId("save_as");
        resource_names = ["save_explanation", "type_LOCAL", "type_SERVER", "type_FILE"], i = 0;
        save_as.options.forEach(function(option){
            option.label = resources[resource_names[i]];
            ++i;
        });
        save_as.startup();
    
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
    
        var track_selector = registry.byId("track_selector"), piano_roll = registry.byId("piano_roll");
        track_selector.watch("value", function(name, old, new_val){
            piano_roll.set("_track_num", new_val);
        });
    
        var title_editor = registry.byId("music_title");        //タイトルが変更されたかわかるよう監視する
        title_editor.watch("value", function(name, old, new_val){
            if(new_val != old){
                contents_changed.name = true;
                dom_class.toggle("save_button_label", "not_saved", true);
            }else{
                contents_changed.name = false;
                dom_class.toggle("save_button_label", "not_saved", false);
            }
        });
    
        var author_editor = registry.byId("author_editor");      //作成者名が変更されたかわかるよう監視する
        author_editor.watch("value", function(name, old, new_val){
            if(new_val != old){
                contents_changed.author = true;
                dom_class.toggle("save_button_label", "not_saved", true);
            }else{
                contents_changed.author = false;
                dom_class.toggle("save_button_label", "not_saved", false);
            }
        });
    
        var comment_editor = registry.byId("comment_editor");   //コメントが変更されたかわかるよう監視する
        comment_editor.watch("value", function(name, old, new_val){
            if(new_val != old){
                contents_changed.comment = true;
                dom_class.toggle("save_button_label", "not_saved", true);
            }else{
                contents_changed.comment = false;
                dom_class.toggle("save_button_label", "not_saved", false);
            }
        });
    
        var editor = registry.byId("editor");
        newFile();
            
        aspect.after(editor, "onKeyUp", function(){ //ソース画面で入力するたびに変更されたことが検知できるようにする
            var new_val = editor.get("value");
            if(old_value != new_val){
                contents_changed.source = true;
                dom_class.toggle("save_button_label", "not_saved", true);
            }else{
                contents_changed.source = false;
                dom_class.toggle("save_button_label", "not_saved", false);
            }
        });
    });
    
return resources;

});