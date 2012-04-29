var functions = [               //波形生成に使われる関数群
    function(time, freq){       //引数には現在のノートが鳴り始めてからの経過時間(s)とそのノートが発生させるべき周波数が入ってくる
        return Math.sin(freq * 2 * Math.PI * time);
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
    }
];

/**
 * 0 <= x < toの範囲で漸減/漸増する直線を描く関数
 */
function linear(val, x, to, len, is_up){
    var tmp = (is_up) ? x : to - x;
    return val * tmp / len;
}

var cur_sample_frame = 0, len_foot = 1000, note_id = 0, cur_track_num = 0;

onmessage = function(e){
    var data = e.data, freq_list = data.freq_list, func = functions[data.program_num], note_len = data.note_len;
    var buffer = new Float32Array(note_len), secs_per_frame = data.secs_per_frame, amp = data.volume;
    if(cur_track_num != data.track_num){
        cur_track_num = data.track_num;
        cur_sample_frame = 0;
        note_id = 0;
    }
    var note_tag = {type : "note", start_frame : cur_sample_frame, end_frame : cur_sample_frame + note_len, note_id : note_id++};
    
    for(var i = 0; i < note_len; ++i, ++cur_sample_frame){    //出力バッファーに波形データをセットする
        var y = 0.0;
        freq_list.forEach(function(freq){
            y += amp * func(i * secs_per_frame, freq);
        });
        if(i <= len_foot){y = linear(y, i, len_foot, len_foot, true);}    //急激な波形の変化を抑えるため、ノートの端の方は波形を変化させる
        if(i >= note_len - len_foot){y = linear(y, i, note_len, len_foot, false);}
        buffer[i] = y;
    }
    
    postMessage({buffer : buffer, tag : note_tag});
};