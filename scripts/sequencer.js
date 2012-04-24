define(["scripts/lib/enchant.js", "utils"], function(dummy, util){

return enchant.Class.create({
    initialize : function(parse_tree, main){
        this.buffer_size = 4096;
        this.context = (window.AudioContext) ? new AudioContext() : new webkitAudioContext();
        this.main = main;
        this.env = {       //グローバルなシーケンサーの状態
            for_worker : new util.Enviroment(),
            for_playback : new util.Enviroment()
        };
        this.cmd_manager = new util.CommandManager();
        this.cur_ast_node = {
            for_playback : parse_tree,           //現在着目しているASTのノード（GUI用）
            for_worker : parse_tree             //現在着目しているASTのノード（ワーカー用）
        };
        this.next_playing_buffer_count = 0;     //次に出力バッファーに流すべきデータのキュー内での位置
        this.queue = [];                        //波形データのキュー。ワーカーで生成された後、使用されるまでここに保持される
        this.frame_in_buf = 0;                  //現在のバッファー内のフレーム数
        this.secs_per_frame = 1.0 / this.context.sampleRate;
        this.node = this.context.createJavaScriptNode(this.buffer_size, 1, 1);
        this.actual_sample_rate = this.context.sampleRate;
        this.cur_frame = 0;             //現在の再生側の経過時間をサンプルフレーム数で表したもの
        this.sound_producer = new Worker("scripts/sound_producer.js");   //バックグラウンドで波形生成を担当する
        
        var _self = this;
        this.node.onaudioprocess = function(e){
            var data = e.outputBuffer.getChannelData(0);
            _self.processAudioCallback(data.length, data, e.outputBuffer.getChannelData(1));
        };
        
        this.sound_producer.onmessage = function(e){
            var data = e.data;
            _self.queue.push(data);
            if(_self.queue.length >= 10){_self.node.connect(_self.context.destination);}   //ある程度キューにデータが溜まってから再生開始
            _self.prepareToProcessNextNode(_self.getNextNode(_self.cur_ast_node.for_worker, true));
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
            }}
        ]);
        
        //一番目のノートを演奏する準備をする
        this.prepareToProcessNextNode(this.getNextNode(this.cur_ast_node.for_worker, false));
        this.cur_ast_node.for_playback = this.getNextNode(this.cur_ast_node.for_playback, false);
    },
    
    indexOf : function(node, target_node){
        for(var i = 0; i < node.length; ++i){
            if(node[i] == target_node){return i;}
        }
        return -1;
    },
    
    getNextNode : function(node, skip_child){
        if(!skip_child && (node.cons === "params" || node.cons === "command" || node.cons === "chord")){return node;}
        if(!skip_child && node.length){return this.getNextNode(node[0], false);}
        
        if(!node.parent){return null;}
        var index = this.indexOf(node.parent, node);
        if(index + 1 >= node.parent.length){
            return this.getNextNode(node.parent, true);
        }else{
            return this.getNextNode(node.parent[index + 1], false);
        }
    },
    
    convertToFrequency : function(note_num){
        var octave = Math.floor(note_num / 12) - 1;
        return(440 * Math.pow(2.0, octave - 4.0 + (note_num % 12 - 9) / 12.0));
    },
    
    convertMidiTicksToSampleFrame : function(ticks){
        return(ticks * this.actual_sample_rate * 60.0 / (480.0 * 1.0 * this.env.for_worker.getCurrentTempo()));
    },
    
    prepareToProcessNextNode : function(node){
        if(!node){             //全部のASTノードの処理が終わったので、波形生成スレッドを停止する
            this.sound_producer.terminate();
            return;
        }
        if(node.cons === "command"){
            this.cmd_manager.invoke(node[0].value, [node[1], node[2], "for_worker"]);
            return this.prepareToProcessNextNode(this.getNextNode(node, true));
        }
        
        var start_frame = this.cur_ast_node.for_worker.end_frame + 1 || 0;
        node.end_frame = start_frame +
            this.convertMidiTicksToSampleFrame((node.cons == "chord") ? node[1][0].value : node[0][1][0].value);
        var next_nodes = (node.cons == "chord") ? node[0].toArray() : [[node]];
        var freqs = next_nodes.map(function(note){
            return this.convertToFrequency(note[0][0][0][0].value);
        }, this);
        this.cur_ast_node.for_worker = node;
        
        this.sound_producer.postMessage({
            freq_list : freqs, program_num : 0, note_len : node.end_frame - start_frame, secs_per_frame : this.secs_per_frame
        });
    },
    
    proceedToNextNode : function(node){
        var next_node = this.getNextNode(node, true);
        if(!next_node){             //曲の最後まで到達したので、再度の再生に備える
            this.main.stop();
            this.cur_ast_node.for_playback = this.parse_tree;
            return false;
        }
        if(next_node.cons === "command"){   //画面表示用に"command"タイプのノードの処理をする
            this.cmd_manager.invoke(next_node[0].value, [next_node[1], next_node[2], "for_playback"]);
            return this.proceedToNextNode(next_node);
        }
        
        this.cur_ast_node.for_playback = next_node;
        return true;
    },
    
    processAudioCallback : function(data_length, left_data, right_data){
        var playing_queue = this.queue[this.next_playing_buffer_count], index = this.frame_in_buf;
        
        for(var i = 0; i < data_length; ++i, ++index){    //出力バッファーに波形データをセットする
            if(index >= playing_queue.length){
                if(!this.proceedToNextNode(this.cur_ast_node.for_playback)){return;}    //曲の終端に到達したので、メソッドを抜ける
                index = 0;
                ++this.next_playing_buffer_count;
                playing_queue = this.queue[this.next_playing_buffer_count];
            }
            
            left_data[i] = playing_queue[index];
            right_data[i] = playing_queue[index];
        }
        
        this.frame_in_buf = index;
        this.cur_frame += data_length;
    },
    
    stop : function(){
        this.node.disconnect();
    },
    
    play : function(){
        this.node.connect(this.context.destination);
    }
});

});