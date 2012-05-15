define(["utils", "dojo/_base/declare", "dojo/_base/lang", "dijit/registry"], function(util, declare, lang, registry){

return declare(null, {
    constructor : function(main){
        this.buffer_size = 4096;
        this.context = (window.AudioContext) ? new AudioContext() : new webkitAudioContext();
        this.main = main;
        this.env = {       //グローバルなシーケンサーの状態
            for_worker : new util.Enviroment(),
            for_playback : new util.Enviroment()
        };
        this.cmd_manager = new util.CommandManager();
        this.cur_ast_node = null;       //現在着目しているASTのノード(波形生成時用)
        this.queues = null;             //波形データのキュー。ワーカーで生成された後、使用されるまでここに保持される
        this.note_tags = null;          //再生時に必要な情報を線形リストで保持する
        this.next_metaevent = null;     //次のトラックをまたがって適用されるメタイベント
        this.track_infos = null;        //各トラックごとの再生情報
        this.secs_per_frame = 1.0 / this.context.sampleRate;
        this.nodes = null;
        this.gain_nodes = null;
        this.compressor = this.context.createDynamicsCompressor();
        this.actual_sample_rate = this.context.sampleRate;
        this.cur_frame = 0;             //現在の再生側の経過時間をサンプルフレーム数で表したもの
        this.actual_end_frame = 0;      //バッファーが空になるように曲の終端チェックを少しずらすときに使用する
        this.next_ticks = 0;            //cur_ticksの一時保管領域。processAudioCallbackは実際に演奏されるよりも前に呼び出されるため
        this.cur_ticks = 0;             //現在の再生側の経過時間をMIDIのtick数で表したもの(ピアノロールとの同期用)
        this.last_vol = 127;            //一個前のノードのボリューム(波形生成時用)
        this.sound_producer = null;     //バックグラウンドで波形生成を担当する
        this.can_play = true;
        
        var _self = this;
        this.processAudio = function(e){
            var data = e.outputBuffer.getChannelData(0), track_num = _self.nodes.indexOf(e.currentTarget);
            _self.processAudioCallback(data.length, data, e.outputBuffer.getChannelData(1), track_num);
        };
        
        this.cmd_manager.registerAll([
            {shorter_name : "o", longer_name : ["octave"], func : function(args){
                _self.env[args[2]].setOctave(args[0].value);
            }},
            {shorter_name : null, longer_name : ["k.sign", "key_signature"], func : function(args){
                _self.env[args[2]].setCurrentKey([args[0].value.split(""), args[1].value.split("")]);
            }},
            {shorter_name : "l", longer_name : null, func : function(/*args*/){
                //_self.env.setCurrentDefaultLength(args[0]);
            }},
            {shorter_name : "q", longer_name : null, func : function(/*args*/){
                //_self.env.setGateTime(args[0]);
            }},
            {shorter_name : "t", longer_name : ["tempo"], func : function(args){
                _self.env[args[2]].setTempo(args[0].value);
            }},
            {shorter_name : null, longer_name : ["track"], func : function(args){
                _self.env[args[2]].setTrackNum(args[0].value - 1);
            }},
            {shorter_name : null, longer_name : ["program_change"], func : function(args){
                var env = _self.env[args[2]];
                env.setProgramNumForTrack(env.getCurrentTrackNum(), args[0].value);
            }},
            {shorter_name : "v", longer_name : ["volume"], func : function(args){
                var env = _self.env[args[2]];
                env.setVolume(env.getCurrentTrackNum(), (lang.isArray(args[0].value)) ? args[0].value[0] : args[0].value);
            }},
            {shorter_name : "u", longer_name : ["velocity"], func : function(args){
                var env = _self.env[args[2]];
                env.setVolume(env.getCurrentTrackNum(), (lang.isArray(args[0].value)) ? args[0].value[0] : args[0].value);
            }}
        ]);
    },
    
    setASTTree : function(tree_root){
        this.cur_ast_node = tree_root;
    },
    
    /**
     * 構文木から波形を生成して演奏をするための準備をする
     */
    prepareToPlay : function(){
        this.queues = [[]];
        this.note_tags = [[]];
        this.next_metaevent = null;
        this.track_infos = [{frame_in_buf : 0, next_tag_count : 0}];
        if(this.gain_nodes){
            this.gain_nodes.forEach(function(node){
                node.disconnect();
            });
        }
        if(this.nodes){
            this.nodes.forEach(function(node){
                node.disconnect();
            });
        }
        this.nodes = [this.context.createJavaScriptNode(this.buffer_size, 1, 1)];
        this.gain_nodes = [this.context.createGainNode()];
        this.last_vol = 127;
        this.sound_producer = new Worker("js/sound_producer.js");
        
        this.env.for_worker.restoreDefault();
        this.env.for_worker.setTrackNum(0);
        
        var _self = this;
        this.sound_producer.onmessage = function(e){
            var data = e.data, cur_track_num = _self.env.for_worker.getCurrentTrackNum();
            _self.queues[cur_track_num].push(data.buffer);
            _self.note_tags[cur_track_num].push(data.tag);
            _self.prepareToProcessNextNode(_self.getNextNode(_self.cur_ast_node, true));
        };
        
        this.nodes[0].onaudioprocess = this.processAudio;
        this.nodes[0].connect(this.gain_nodes[0]);
        this.gain_nodes[0].connect(this.compressor);
        //一番目のノートを演奏する準備をする
        this.prepareToProcessNextNode(this.getNextNode(this.cur_ast_node, false));
        this.can_play = true;
    },
    
    /**
     * ASTノードに対してArray.prototype.indexOfと同じ処理を施す
     * @param node {Object} 処理対象となるASTノード
     * @param target_node {Object} 探索対象のノード
     * @returns {Number} | -1 探索対象のノードの親要素内でのインデックス
     */
    indexOf : function(node, target_node){
        for(var i = 0; i < node.length; ++i){
            if(node[i] == target_node){return i;}
        }
        return -1;
    },
    
    find : function(array, pred){
        var tmp = null;
        array.every(function(obj, index){
            if(pred(obj, index)){
                tmp = obj;
                return false;
            }
            
            return true;
        });
        
        return tmp;
    },
    
    /**
     * 次の処理対象となるASTノードを探しだす
     * @param node {Object} 探索元となるASTノード
     * @param skip_child {boolean} 子要素を探索するかどうか
     * @returns {Object} | null 見つかったノード、またはnull
     */
    getNextNode : function(node, skip_child){
        if(!skip_child && (node.cons === "params" || node.cons === "command" || node.cons === "chord")){return node;}
        if(!skip_child && node.length){return this.getNextNode(node[0], false);}
        
        if(!node.parent){
            return null;
        }
        var index = this.indexOf(node.parent, node);
        if(index + 1 >= node.parent.length){
            return this.getNextNode(node.parent, true);
        }else{
            return this.getNextNode(node.parent[index + 1], false);
        }
    },
    
    getCurTempo : function(){
        return this.env.for_playback.getCurrentTempo();
    },
    
    /**
     * MIDIのノートナンバーを周波数に変換する
     * @param note_num {Number} 変換するMIDIのノートナンバー
     * @returns {Number} 変換された周波数値
     */
    convertToFrequency : function(note_num){
        var octave = Math.floor(note_num / 12) - 1;
        return(440 * Math.pow(2.0, octave - 4.0 + (note_num % 12 - 9) / 12.0));
    },
    
    /**
     * MIDIのTick数からサンプルフレーム数に変換する
     * @param ticks {Number} 変換するTick数
     * @returns {Number} 変換されたサンプルフレーム数
     */
    convertMidiTicksToSampleFrame : function(ticks){
        return Math.round(ticks * this.actual_sample_rate * 60.0 / (480.0 * 1.0 * this.env.for_worker.getCurrentTempo()));
    },
    
    /**
     * ASTノードをたどって波形生成スレッドに必要な情報を供給する
     * @param node {Object} 次に処理対象とするノード
     */
    prepareToProcessNextNode : function(node){
        if(!node){             //全部のASTノードの処理が終わったので、波形生成スレッドを停止する
            this.sound_producer.terminate();
            this.main.play();
            return;
        }
        var track_num = this.env.for_worker.getCurrentTrackNum();
        if(node.cons === "command"){
            if(node[0].value === "track" && node[1].value != 1 || node[0].value !== "track"){
                this.cmd_manager.invoke(node[0].value, [node[1], node[2], "for_worker"]);
                if(node[0].value === "track"){
                    var new_node = this.context.createJavaScriptNode(this.buffer_size, 1, 1);
                    new_node.onaudioprocess = this.processAudio;
                    var gain_node = this.context.createGainNode();
                    new_node.connect(gain_node);
                    gain_node.connect(this.compressor);
                    this.nodes.push(new_node);
                    this.gain_nodes.push(gain_node);
                    this.track_infos.push({frame_in_buf : 0, next_tag_count : 0});
                    this.queues.push([]);
                    this.note_tags.push([]);
                    this.cur_ast_node = {};     //トラックが変わったので、適当なノードを着目ノードに設定する
                    this.env.for_worker.restoreDefault();
                    this.env.for_worker.setVolume(this.env.for_worker.getCurrentTrackNum(), 127);
                    this.env.for_worker.setProgramNumForTrack(this.env.for_worker.getCurrentTrackNum(), 0);
                    this.next_metaevent = this.find(this.note_tags[0], function(tag){
                        return((tag.name == "t" || tag.name == "tempo" || tag.name == "k.sign" || tag.name == "key_signature") && tag.start_frame >= 0);
                    });
                }else{
                    var start_frame = this.cur_ast_node.end_frame || 0;
                    this.note_tags[track_num].push({
                        type : "command", name : node[0].value, arg1 : node[1], arg2 : node[2], start_frame : start_frame
                    });
                }
            }
            
            return this.prepareToProcessNextNode(this.getNextNode(node, true));
        }
        
        if(this.next_metaevent){
            var cur_frame = this.cur_ast_node.end_frame || 0;
            while(this.next_metaevent && this.next_metaevent.start_frame <= cur_frame){
                if(this.next_metaevent.start_frame != cur_frame){
                    alert("Warning! The current note will play over a metaevent! It might cause the track to delay against the track #0.");
                }
                
                var event = this.next_metaevent, prev_index = this.note_tags[0].indexOf(this.next_metaevent);
                this.cmd_manager.invoke(event.name, [event.arg1, event.arg2, "for_worker"]);
                this.next_metaevent = this.find(this.note_tags[0], function(tag, cur_index){
                    return((tag.name == "t" || tag.name == "tempo" || tag.name == "k.sign" || tag.name == "key_signature") &&
                        prev_index < cur_index && tag.start_frame >= cur_frame);
                });
            }
        }
        
        var start_frame = this.cur_ast_node.end_frame || 0, ticks = (node.cons == "chord") ? node[1][0].value : node[0][1][0].value;
        node.end_frame = start_frame + this.convertMidiTicksToSampleFrame(ticks);
        var next_nodes = (node.cons == "chord") ? node[0].toArray() : [[node]];
        var freqs = next_nodes.map(function(note){
            return this.convertToFrequency(note[0][0][0][0].value);
        }, this);
        this.cur_ast_node = node;
        
        var gate_time_in_ticks = (node.cons == "chord") ? node[2][0].value : node[0][2][0].value;
        var gate_time = (gate_time_in_ticks != "none") ? this.convertMidiTicksToSampleFrame(gate_time_in_ticks) : 0;
        
        var vol;
        if(node.cons == "chord" || node[0][3].length == 1){
            vol = this.env.for_worker.getVolumeForTrack(track_num);
        }else{
            switch (node[0][3][0].value) {
            case "+" :
                vol = this.last_vol + node[0][3][1].value;
                break;
                
            case "-" :
                vol = this.last_vol - node[0][3][1].value;
                break;
                
            default:
                vol = node[0][3][1].value;
                break;
            }
        }
        
        this.last_vol = vol;
        
        this.sound_producer.postMessage({
            freq_list : freqs, program_num : this.env.for_worker.getProgramNumForTrack(track_num), note_len : node.end_frame - start_frame,
            secs_per_frame : this.secs_per_frame, volume : vol, track_num : track_num, len_in_ticks : ticks,
            gate_time : gate_time
        });
    },
    
    /**
     * 特定のトラックの次に再生するノートを探しだす
     * @param track_num {Number} 対象となるトラックナンバー
     * @returns {Object} | null 次のノートの情報
     */
    proceedToNextNoteForTrack : function(track_num){
        var track_tags = this.note_tags[track_num], track_info = this.track_infos[track_num];
        if(track_info.next_tag_count >= track_tags.length){         //曲の最後まで到達したので、メソッドを抜ける
            this.can_play = false;
            if(track_num === 0 && this.actual_end_frame === 0){this.actual_end_frame = this.cur_frame + 5 * this.buffer_size;}
            return null;
        }
        var tag = track_tags[track_info.next_tag_count];
        if(tag.type === "command"){   //画面表示用に"command"タイプのタグの処理をする
            this.cmd_manager.invoke(tag.name, [tag.arg1, tag.arg2, "for_playback"]);
            if(tag.name.search(/u|v|volume|velocity/) != -1){
                this.gain_nodes[track_num].gain.value = tag.arg1.value / 127.0;
            }
            ++track_info.next_tag_count;
            return this.proceedToNextNoteForTrack(track_num);
        }
        this.gain_nodes[track_num].gain.value = tag.vol / 127.0;
        
        return tag;
    },
    
    processAudioCallback : function(data_length, left_data, right_data, track_num){
        if(!this.can_play && this.actual_end_frame !== 0 && this.cur_frame >= this.actual_end_frame){
            this.main.stop();
            return;
        }
        var track_info = this.track_infos[track_num], tag = this.proceedToNextNoteForTrack(track_num), i;
        if(!tag){       //曲の終端に到達したので、メソッドを抜ける
            if(track_num === 0){this.cur_frame += data_length;}
            for(i = 0; i < data_length; ++i){    //後片付けをする
                left_data[i] = 0;
                right_data[i] = 0;
            }
            return;
        }
        var playing_buffer = this.queues[track_num][tag.note_id], index = track_info.frame_in_buf;
        
        for(i = 0; i < data_length; ++i, ++index){    //出力バッファーに波形データをセットする
            if(index >= playing_buffer.length){
                ++track_info.next_tag_count;
                if(!(tag = this.proceedToNextNoteForTrack(track_num))){break;} //曲の終端に到達したので、ループを抜ける
                index = 0;
                playing_buffer = this.queues[track_num][tag.note_id];
            }
            
            left_data[i] = playing_buffer[index];
            right_data[i] = playing_buffer[index];
        }
        
        track_info.frame_in_buf = index;
        if(track_num === 0){
            this.cur_frame += data_length;
            var music_info = registry.byId("music_info");
            music_info.set("value", this.cur_frame);
            this.cur_ticks = this.next_ticks;
            var sample_frame_per_tick = this.actual_sample_rate / (this.getCurTempo() * 480.0 / 60.0);
            var ticks = data_length / sample_frame_per_tick;
            this.next_ticks += ticks;
        }
    },
    
    reinitialize : function(){
        this.track_infos.forEach(function(track_info){
            track_info.next_tag_count = 0;
            track_info.frame_in_buf = 0;
        });
        this.cur_frame = 0;
        this.actual_end_frame = 0;
        this.cur_ticks = 0;
        this.next_ticks = 0;
        this.env.for_playback.restoreDefault();
    },
    
    stop : function(){
        this.hold();
    },
    
    hold : function(){
        this.compressor.disconnect();
        this.can_play = false;
    },
    
    play : function(){
        this.reinitialize();
        this.compressor.connect(this.context.destination);
        this.can_play = true;
    }
});

});