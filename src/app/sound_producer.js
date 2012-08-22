var functions = [               //波形生成に使われる関数群
    function(time, freq){       //引数には現在のノートが鳴り始めてからの経過時間(s)とそのノートが発生させるべき周波数(Hz)が入ってくる
        return Math.sin(freq * 2 * Math.PI * time);     //正弦波
    },
    
    function(time, freq){       //矩形波
        return Math.round(Math.sin(2 * Math.PI * freq * time));
    },
    
    function(time, freq){       //ノコギリ波
        var x = freq * time;
        return 2.0 * (x - Math.round(x));
    },
    
    function(time, freq){       //三角波
        var x = Math.pow(-1.0, Math.round(freq * time)) * functions[2](time, freq);
        return x;
    },
    
    function(time, freq){       //M字型
        var x = Math.pow(-1.0, Math.floor(freq * time)) * functions[2](time, freq);
        return x;
    },
    
    function(){                 //ノイズ
        return Math.random();
    }
];

/**
 * 0 <= x < toの範囲で漸減/漸増する直線を描く関数
 */
function linear(val, x, from, to, len, is_up){
    var tmp = (is_up) ? x - from : to - x;
    return val * tmp / len;
}

function findNextNoteStartFrame(start_frame_list, cur_frame){
    for(var i = 0; i < start_frame_list.length; ++i){
        if(start_frame_list[i] > cur_frame){return start_frame_list[i];}
    }
    has_arpeggiated_note = false;
    return start_frame_list[start_frame_list.length - 1];
}

var cur_sample_frame = 0, len_suppressing = 1000, note_id = 0, cur_track_num = 0, secs_per_frame, has_arpeggiated_note = true;

onmessage = function(e){
    var data = e.data;
    if(data.func){
        eval("functions.push(function("+data.func.params[0]+","+data.func.params[2]+"){"+data.func.body+"})");
        return;
    }
    var freq_list = data.freq_list, func = functions[data.program_num], note_len = data.note_len, buffer = new Float32Array(note_len);
    var gate_time = data.gate_time, is_chord = (freq_list.length > 1), velocity = data.volume;
    secs_per_frame = data.secs_per_frame;
    has_arpeggiated_note = true;
    if(cur_track_num != data.track_num){
        cur_track_num = data.track_num;
        cur_sample_frame = 0;
        note_id = 0;
    }
    var note_tag = {type : "note", start_frame : cur_sample_frame, end_frame : cur_sample_frame + note_len, note_id : note_id++,
        len_in_ticks : data.len_in_ticks, vol : velocity};
    
    //ここから実際に出力バッファーに波形データをセットする
    var i, y;
    if(is_chord){               //和音の場合
        var start_frame_list = freq_list.map(function(dummy, index){    //和音にゲートタイムがセットされていた場合、鳴らしはじめの時間をずらして
            return index * gate_time;                                   //処理する
        });
        var next_note_start_frame = 0, end_suppressing_frame1 = len_suppressing, end_suppressing_frame2 = note_len,
            start_suppressing_frame1 = 0, start_suppressing_frame2 = note_len - len_suppressing;
        for(i = 0; i < note_len; ++i, ++cur_sample_frame){
            y = 0.0;
            for(var j = 0; j < freq_list.length; ++j){
                if(start_frame_list[j] > i){break;}
                y += func(i * secs_per_frame, freq_list[j]);
            }
            
            y *= Math.pow(velocity / 127.0, 2.0);
            //急激な波形の変化を抑えるため、ノートの端の方は波形を変化させる
            if(i >= next_note_start_frame && has_arpeggiated_note){
                next_note_start_frame = findNextNoteStartFrame(start_frame_list, i);
                start_suppressing_frame1 = i;
                start_suppressing_frame2 = (has_arpeggiated_note) ? next_note_start_frame - len_suppressing : note_len - len_suppressing;
                end_suppressing_frame1 = i + len_suppressing;
                end_suppressing_frame2 = (has_arpeggiated_note) ? next_note_start_frame : note_len;
            }
            if(i <= end_suppressing_frame1){y = linear(y, i, start_suppressing_frame1, end_suppressing_frame1, len_suppressing, true);}
            if(i >= start_suppressing_frame2){y = linear(y, i, start_suppressing_frame2, end_suppressing_frame2, len_suppressing, false);}
            
            buffer[i] = y;
        }
    }else{                      //単音の場合
        var freq = freq_list[0], actual_end_frame = (gate_time !== 0) ? note_len - gate_time : note_len;
        for(i = 0; i < note_len; ++i, ++cur_sample_frame){
            y = func(i * secs_per_frame, freq);
            y *= Math.pow(velocity / 127.0, 2.0);
            if(i <= len_suppressing){y = linear(y, i, 0, len_suppressing, len_suppressing, true);}    //急激な波形の変化を抑えるため、ノートの端の方は波形を変化させる
            if(i >= actual_end_frame - len_suppressing){y = linear(y, i, actual_end_frame - len_suppressing, actual_end_frame, len_suppressing, false);}
            if(i >= actual_end_frame){freq = 0.0;}          //ゲートタイムの長さに合わせて発音時間を調整する
            buffer[i] = y;
        }
    }
    
    postMessage({buffer : buffer, tag : note_tag});
};