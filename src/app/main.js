/**
 * main.js
 * ぴこぴこしーけんさー
 * developed by HAZAMA(http://funprogramming.ojaru.jp)
 */


define(["app/mml_compiler", "app/sequencer", "app/utils", "dojo/dom-class", "dojo/dom-geometry", "dojo/on", "dijit/registry", "dojox/timing", 
    "dijit/form/Select","app/mml_updater", "dojo/i18n!app/nls/resources", "dijit/Menu", "dijit/MenuItem", "dojo/aspect", "dojo/request",
    "dojo/dom", "dojo/ready"],
    function(compiler, Sequencer, utils, dom_class, dom_geometry, on, registry, timing, Select, updater, resources, Menu, MenuItem, aspect, request, dom, ready){

    var sequencer = null,
    data_store = null,
    saved_data = null,
    elapsed_time = 0,
    timer = null,
    fs = null,
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
    
    formatTime = function(millisecs){
        var result = "", millis = millisecs % 1000;
        millisecs = Math.floor(millisecs / 1000);
        var secs = millisecs % 60;
        millisecs = Math.floor(millisecs / 60);
        var mins = millisecs % 60;
        millisecs = Math.floor(millisecs / 60);
        result = "" + Math.floor(millisecs) + ":" + mins + ":" + utils.padNumber(secs, "0", 2) + "." + utils.padNumber(millis, "0", 3);
        return result;
    },
    
    compile = function(){
        if(!processMMLSource()){
            setMsgOnStatusBar(resources.msg_empty_string)
            return;
        }
        
        var tab_container = registry.byId("main_tab");
        if(tab_container.selectedChildWidget.id == "piano_roll"){
            tab_container.selectedChildWidget.set("_metaevent_list", data_store.metaevents);
            tab_container.selectedChildWidget.set("_tree", data_store.list);
        }
        var display = registry.byId("ast");
        display.set("value", data_store.tree && data_store.tree.toPrettyString() || compiler.mml_parser.stringifyErrors());
        if(!data_store.tree)
            return;
        
        if(!sequencer)
            sequencer = new Sequencer({stop : stop, play : play, hold : hold});

        sequencer.setASTTree(data_store.tree);
        sequencer.prepareToPlay();
        elapsed_time = 0;
    },

    stop = function(){
        sequencer.stop();
        if(timer.isRunning)
            timer.stop();

        elapsed_time = 0;
        var controller = registry.byId("controller");
        switchController(controller, "play");
    },
    
    play = function(){
        if(!sequencer){
            alert(resources.msg_prompt_compiling);
            return;
        }
        var controller = registry.byId("controller"), music_info = registry.byId("music_info");
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
            setMsgOnStatusBar(Math.round(piano_roll._cur_ticks));
            elapsed_time += millisecs_per_frame;
            var elapsed_time_str = formatTime(Math.floor(elapsed_time));
            music_info.set("value", elapsed_time_str);
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
    
    playFromHalfWay = function(e){
        if(!sequencer){
            alert(resources.msg_prompt_compiling);
            return;
        }
        var x = e.x, piano_roll = registry.byId("piano_roll"), viewport_pos = piano_roll.get("_viewport_pos");
        var PIANO_ROLL_POS = dom_geometry.position(piano_roll.domNode, true), PIANO_ROLL_WIDTH = PIANO_ROLL_POS.w - piano_roll.keyboard_size.w;
        var CLICKED_POS = x + viewport_pos.x - piano_roll.keyboard_size.w - PIANO_ROLL_POS.x;
        var TICKS_PER_MEASURE = piano_roll.get("_ticks_per_measure");
        var clicked_pos_in_ticks = piano_roll.convertPosToTicks(CLICKED_POS), clipped_ticks = Math.floor(clicked_pos_in_ticks / TICKS_PER_MEASURE) * TICKS_PER_MEASURE;
        elapsed_time = sequencer.prepareToPlayFrom(clipped_ticks);
        piano_roll.set("_cur_ticks", clipped_ticks);
        piano_roll.set("_viewport_pos", {x : Math.floor(CLICKED_POS / PIANO_ROLL_WIDTH) * PIANO_ROLL_WIDTH, y : viewport_pos.y});
        piano_roll.onUpdate();
        resume();
    },
    
    toPlainString = function(html_source){
        return html_source.replace(/<br[^>]+>|<\/div><div>|<div>/g, "\n").replace(/<[^>]+>/g, "").replace(/&quot;/g, "\"").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
    },
    
    toDisplayedString = function(str){
        return str.replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
    },
    
    processMMLSource = function(){
        var tmp;
        try{
            var editor = registry.byId("editor");
            var source = toPlainString(editor.get("value"));
            if(source === "")
                return false;

            tmp = updater.compile(source);
        }
        catch(e){
            setMsgOnStatusBar(e.message);
            return false;
        }
        
        if(!tmp.tree){
            setMsgOnStatusBar(tmp);
            return false;
        }else{
            setMsgOnStatusBar(resources.msg_compile_succeeded);
        }
        
        data_store = tmp;
        return true;
    },
    
    switchController = function(controller, mode){
        if(listener_remover)
            listener_remover.remove();
        
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
    
    fetchHeadersFromServer = function(success_func){
        request.get("sequencer", {
            handleAs : "json",
            query : {
                method : "get_list"
            }
        }).then(
            function(data){
                clear();
                success_func(data);
            },
            function(error_msg){
                clear();
                alert(error_msg);
            }
        );
        var clear = addDotToStatusBar(1000, resources.connect_to_server);
    },
    
    normalizeLineBreaks = function(str){
        return str.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    },
    
    arrayIncludesProperty = function(array, prop_name, prop){
        return !array.every(function(item){
            return (item[prop_name] === prop) ? false : true;
        });
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
    
    openFile = function(location, file_name, other_infos){
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
            var last_modified_date = new Date(item.date);
            editor.set("value", item.source);
            old_value = item.source;
            title_editor.set("value", item.name);
            author_editor.set("value", item.author);
            comment_editor.set("value", item.comment);
            last_modified_display.set("value", last_modified_date.toLocaleString());
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
                    var last_modified_date = new Date(other_infos.date);
                    editor.set("value", json_data.source);
                    old_value = json_data.source;
                    title_editor.set("value", file_name);
                    author_editor.set("value", other_infos.author);
                    comment_editor.set("value", other_infos.comment);
                    last_modified_display.set("value", last_modified_date.toLocaleString());
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
            editor.set("value", other_infos.source);
            old_value = other_infos.source;
            title_editor.set("value", other_infos.title);
            author_editor.set("value", other_infos.author);
            comment_editor.set("value", other_infos.comment);
            last_modified_display.set("value", other_infos.date);
            reset();
            dom_class.toggle("save_button_label", "not_saved", false);  //remove the "not saved" indicator in case of it being already changed
            setMsgOnStatusBar(resources.msg_file_opened);
            break;
            
        default :
            alert("Unknown location!");
        }
    },
    
    prepareForSave = function(){
        var now = new Date(), title_editor = registry.byId("music_title"), music_title = title_editor.get("value"), last_modified_display = registry.byId("last_modified_display");
        last_modified_display.set("value", now.toLocaleString());
        var item = {
            source : null,
            author : null,
            comment : null,
            name : music_title,
            date : now.toUTCString()
        };

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
        var loc_save = "LOCAL";//registry.byId("save_as").get("value");
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
            }else{      //ローカルストレージに同名のファイルが存在しない場合、問答無用で全てのプロパティーを保存する
                contents_changed.name = true;
                item = prepareForSave();
            }
            localStorage.setItem(item.name, JSON.stringify(item));
            setMsgOnStatusBar(resources.msg_file_saved);
            resetContentsStatus();
            old_value = item.source;
            dom_class.toggle("save_button_label", "not_saved", false);  //remove the "not saved" indicator
            break;
            
        case "SERVER":
            fetchHeadersFromServer(
                function(json_data){
                    if(!arrayIncludesProperty(json_data, "name", item.name)){  //サーバーに同名のファイルが存在しない場合、問答無用で全てのプロパティーを保存する
                        contents_changed.name = true;
                        item = prepareForSave();
                    }
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
                }
            );
            break;
            
        case "FILE":
            var raw_text = "";
            contents_changed.name = true;
            item = prepareForSave();
            var original_source = item.source;
            item.source = toPlainString(item.source);
            raw_text = "*TITLE:" + item.name + ";\n*COMMENT:" + item.comment + ";\n*AUTHOR:" + item.author + ";\n*SOURCE:" + item.source + ";\n";
            fs.root.getFile(item.name + ".pico", {create : true}, function(fileEntry){
                fileEntry.createWriter(function(fileWriter){
                    fileWriter.onwriteend = function(){
                        var dialog = registry.byId("save_to_local_dialog"), file_link = dom.byId("local_file_link");
                        file_link.href = fileEntry.toURL();
                        file_link.download = item.name + ".pico";
                        dialog.show();
                        resetContentsStatus();
                        old_value = original_source;
                        dom_class.toggle("save_button_label", "not_saved", false);  //remove the "not saved" indicator
                        setMsgOnStatusBar(resources.click_to_download);
                    };
                    
                    fileWriter.onerror = function(e){
                        alert("Failed to write the data;" + e.toString());
                    };
                    
                    var blob = new Blob([raw_text], {type : "text/plain"});
                    fileWriter.write(blob);
                }, fsErrorHandler);
            }, fsErrorHandler);
            break;
            
        default:
            alert("Choose a desired location!");
            return;
        }
    },
    
    retrieveAllDataFromStorage = function(){
        var data = [];
        for(var i = 0; i < localStorage.length; ++i){
            var cur_key = localStorage.key(i);
            var item = JSON.parse(localStorage.getItem(cur_key));
            if(typeof item.comment !== "undefined" && typeof item.author !== "undefined" && typeof item.date !== "undefined"){
                // comment, author, dateプロパティを持たないデータは、picopico-sequencerのものではないと判断して無視する
                data.push({
                    name : cur_key,
                    comment : item.comment,
                    author : item.author,
                    date : item.date
                });
            }
        }
        return data;
    },
    
    retrieveDataFromFile = function(file){
        var reader = new FileReader();
        reader.onload = function(e){
            var data = {}, raw_text = normalizeLineBreaks(e.target.result);
            var results = raw_text.match(/\*[A-Z]+:[^;]+;[\n\r]+/g);
            for(var i = 0; i < results.length; ++i){
                var details = results[i].match(/\*([A-Z]+):([^;]+);/);
                data[details[1].toLowerCase()] = details[2];
            }
            data.date = file.lastModifiedDate.toLocaleString();
            data.source = toDisplayedString(data.source);
            openFile("FILE", file.name, data);
        };
        reader.readAsText(file);
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
    },
    
    fsErrorHandler = function(e){
        var msg = "";
        
        switch(e.code){
            case FileError.QUOTA_EXCEEDED_ERR:
              msg = 'QUOTA_EXCEEDED_ERR';
              break;
            case FileError.NOT_FOUND_ERR:
              msg = 'NOT_FOUND_ERR';
              break;
            case FileError.SECURITY_ERR:
              msg = 'SECURITY_ERR';
              break;
            case FileError.INVALID_MODIFICATION_ERR:
              msg = 'INVALID_MODIFICATION_ERR';
              break;
            case FileError.INVALID_STATE_ERR:
              msg = 'INVALID_STATE_ERR';
              break;
            default:
              msg = 'Unknown Error';
              break;
        }
        
        alert(msg);
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
    
        var new_btn = dom.byId("new_button"), save_btn = dom.byId("save_button"), about_btn = dom.byId("about_button");
        on(new_btn, "click", newFile);
    
        on(save_btn, "click", saveFile);
    
        var open_btn = registry.byId("open_button"), open_accept_btn = registry.byId("open_dialog_ok_button"), select_file = registry.byId("open_dialog_file_selector");
        var open_dialog = registry.byId("open_dialog"), open_cancel_btn = registry.byId("open_dialog_cancel_button");
        /*var resource_names = (typeof fs !== "undefined") ? ["open_explanation", "type_LOCAL", "type_SERVER", "type_FILE"]
                                                         : ["open_explanation", "type_LOCAL", "type_SERVER"];*/
        /*open_from.options.forEach(function(option, i){
            option.label = resources[resource_names[i]];
        });
        var file_input = dom.byId("file_input");
        on(file_input, "change", function(e){
            var target_file = e.target.files[0];
            if(!target_file.type.match("text/plain") && !target_file.name.match(".pico")){
                alert("Unexpected file type!");
                return;
            }
            retrieveDataFromFile(target_file);
        });*/
        //open_from.startup();
        /*open_from.onChange =*/
        on(open_btn, "click", function(){
            var loc = "LOCAL"/*this.get("value")*/, names;
            switch(loc){
            case "LOCAL":
                saved_data = retrieveAllDataFromStorage();
                names = saved_data.map(function(item){return {value : item.name, label : item.name};});
                //names.unshift({value : "", label : resources.open_prompt, selected : true});
                break;
            
            case "SERVER":
                fetchHeadersFromServer(
                    function(json_data){
                        setMsgOnStatusBar(resources.received_responce);
                        saved_data = json_data;
                        names = json_data.map(function(item){return {value : item.name, label : item.name};});
                        names.unshift({value : "", label : resources.open_prompt, selected : true});
                        select_file.set("options", names);
                        select_file.startup();
                        open_btn.openDropDown();
                    }
                );
                break;
                
            case "FILE":
                on.emit(file_input, "click", {
                    bubbles : true,
                    cancelable : false
                });
                break;
                
            default:
                alert("Choose a desired location!");
                return;
            }
            
            var _self = this;
            if(!select_file){
                select_file = new Select({
                    name : "selectFile",
                    options : names,
                    maxHeight : -1
                }, "open_dialog_file_selector");
            }else{
                select_file.set("options", names);
            }
            select_file.startup();

            open_dialog.show();
        });
        on(open_cancel_btn, "click", function(){
            open_dialog.hide();
        });
        on(open_accept_btn, "click", function(){
            var file_name = select_file.get("value"), target, location = "LOCAL";
            saved_data.every(function(item){
                if(item.name == file_name){
                    target = item;
                    return false;
                }
                return true;
            });
            openFile(location, file_name, target);

            open_dialog.hide();
        });
    
        /*var save_as = registry.byId("save_as");
        resource_names = (typeof fs !== "undefined") ? ["save_explanation", "type_LOCAL", "type_SERVER", "type_FILE"]
                                                     : ["save_explanation", "type_LOCAL", "type_SERVER"];
        save_as.options.forEach(function(option, i){
            option.label = resources[resource_names[i]];
        });
        save_as.startup();
        save_as.onChange = function(){
            var save_btn = registry.byId("save_button");
            save_btn.openDropDown();
        };*/
        
        on(about_btn, "click", function(){
            var about_dialog = registry.byId("aboutDialog");
            about_dialog.show();
        });
    
        var tab_container = registry.byId("main_tab");
        tab_container.watch("selectedChildWidget", function(name, old, new_val){
            if(new_val.id == "piano_roll"){
                if(!processMMLSource()){
                    return;
                }
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
    
        var editor = registry.byId("editor"), jump_btn = registry.byId("jump_button");
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
        
        var context_menu = new Menu({
            id : "piano_roll_menu",
            targetNodeIds : ["piano_roll"]
        });
        context_menu.addChild(new MenuItem({
            id : "item_play_from",
            Label : resources.play_from,
            onClick : playFromHalfWay
        }));
        context_menu.addChild(new MenuItem({
            id : "item_jump",
            Label : resources.jump_to,
            onClick : function(){
                var jump_dialog = registry.byId("jump_to_measure_dialog");
                jump_dialog.show();
            }
        }));
        
        on(jump_btn, "click", function(){
            var measure_num_editor = registry.byId("to_measure_num"), piano_roll = registry.byId("piano_roll"), MEASURE_NUM = measure_num_editor.get("value");
            piano_roll.jumpToMeasure(MEASURE_NUM);
        });
    });
    
    var requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;
    if(requestFileSystem){
        requestFileSystem(window.TEMPORARY, 5*1024*1024 /*5MB*/, function(Fs){
            fs = Fs;
        }, fsErrorHandler);
    }

return resources;

});