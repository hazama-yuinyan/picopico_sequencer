define(["scripts/lib/enchant.js", "utils"], function(dummy, util){

return enchant.Class.create({
    initialize : function(parse_tree, main){
        this.context = (window.AudioContext) ? new AudioContext() : new webkitAudioContext();
        this.main = main;
        this.env = new util.Enviroment();     //グローバルなシーケンサーの状態
        this.cmd_manager = new util.CommandManager();
        this.parse_tree = parse_tree;           //MMLコンパイラから受け取った曲の構文解析木
        this.cur_ast_node = parse_tree;         //現在の着目しているASTのノード
        this.cur_ast_node_start_frame = 0;      //現在のASTノードの再生を開始したサンプルフレーム数
        this.buffers = new Array(16);
        this.next_node_frame = 0;               //次のASTノードに入る時間をサンプルフレーム数で表したもの
        this.secs_per_tick = this.env.getCurrentTempo() / 480.0;
        this.node = this.context.createJavaScriptNode(4096, 2, 16);
        this.actual_sample_rate = this.context.sampleRate;
        this.cur_frame = 0;             //現在の再生側の経過時間をサンプルフレーム数で表したもの
        this.functions = [              //波形生成に使われる関数群
            function(time, freq){       //引数には現在のノートが鳴り始めてからの経過時間(s)とそのノートが発生させるべき周波数が入ってくる
                return Math.sin(freq * 2 * Math.PI * time);
            }
        ];
        
        var _self = this;
        this.node.onaudioprocess = function(e){
            var data = e.outputBuffer.getChannelData(0);
            _self.process(data.length, data, e.outputBuffer.getChannelData(1));
        };
        
        this.cmd_manager.registerAll([
            {shorter_name : "o", longer_name : ["octave"], func : function(nodes){
                _self.env.setOctave(nodes[0].value);
            }},
            {shorter_name : null, longer_name : ["k.sign", "key_signature"], func : function(nodes){
                _self.env.setCurrentKey([nodes[0].value.split(""), nodes[1].value.split("")]);
            }},
            {shorter_name : "l", longer_name : null, func : function(/*args*/){
                //_self.env.setCurrentDefaultLength(args[0]);
            }},
            {shorter_name : "q", longer_name : null, func : function(/*args*/){
                //_self.env.setGateTime(args[0]);
            }},
            {shorter_name : "t", longer_name : ["tempo"], func : function(nodes){
                _self.env.setTempo(nodes[0].value);
            }}
        ]);
        
        //一番目のノートを演奏する準備をする
        var first_node = this.getNextNode(this.cur_ast_node);
        first_node.end_frame = this.convertMidiTicksToSampleFrame(first_node[0][1][0].value);
        this.cur_ast_node = first_node;
        this.buffers[0] = new Float32Array(4096);
        this.node.connect(this.context.destination);
    },
    
    indexOf : function(node, target_node){
        for(var i = 0; i < node.length; ++i){
            if(node[i] == target_node){return i;}
        }
        return -1;
    },
    
    getNextNode : function(node, skip_child){
        if(!skip_child && (node.cons === "params" || node.cons === "command")){return node;}
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
        return(ticks * this.actual_sample_rate * 60.0 / (480.0 * 1.0 * this.env.getCurrentTempo()));
    },
    
    prepareToProcessNextNode : function(node){
        var next_node = this.getNextNode(node, true);
        if(!next_node){
            this.main.stop();
            return null;
        }
        if(next_node.cons === "command"){
            this.cmd_manager.invoke(next_node[0].value, [next_node[1], next_node[2]]);
            return this.prepareToProcessNextNode(next_node);
        }
        var last_end_frame = this.cur_ast_node.end_frame, first_freq = this.convertToFrequency(this.cur_ast_node[0][0][0].value);
        this.cur_ast_node_start_frame = last_end_frame;
        next_node.end_frame = this.cur_ast_node_start_frame + this.convertMidiTicksToSampleFrame(next_node[0][1][0].value);
        var second_freq = this.convertToFrequency(next_node[0][0][0].value);
        this.cur_ast_node = next_node;
        var result = {"0" : first_freq};
        result[this.cur_ast_node_start_frame] = second_freq;
        return result;
    },
    
    process : function(data_length, left_data, right_data){
        var cur_sample_frame = this.cur_frame, len_sample = data_length;
        var cur_diff_frame = cur_sample_frame - this.cur_ast_node_start_frame, secs_per_frame = 1.0 / this.context.sampleRate;
        var func = this.functions[this.env.getProgramNumForTrack(0)], freq_list;
        var end_time_at_cur_exec = cur_sample_frame + data_length;      //今回の処理が終わった時のサンプルフレーム数を導出する
        if(end_time_at_cur_exec >= this.cur_ast_node.end_frame){
            if(!(freq_list = this.prepareToProcessNextNode(this.cur_ast_node))){return;}
        }else{
            freq_list = {"0" : this.convertToFrequency(this.cur_ast_node[0][0][0].value)};
        }
        
        if(this.buffers[0].length < len_sample){
            this.buffers[0] = new Float32Array(len_sample);
        }
        var buf = this.buffers[0];
        
        for(var i = 0, freq = freq_list["0"]; i < len_sample; ++i){    //出力バッファーに波形データをセットする
            buf[i] = func((cur_diff_frame + i) * secs_per_frame, freq);
            if(freq_list[i] !== undefined){freq = freq_list[i];}
        }
        
        if(data_length){
            var step = 1, index = 0;
            for(var j = 0; j < data_length; ++j){
                left_data[j] = buf[Math.floor(index)];
                right_data[j] = buf[Math.floor(index)];
                index += step;
            }
        }
        
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