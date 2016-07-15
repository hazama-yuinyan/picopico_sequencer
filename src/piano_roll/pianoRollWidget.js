define(["dojo/_base/declare","dijit/_WidgetBase", "dijit/_TemplatedMixin", "dijit/_WidgetsInTemplateMixin", "dojox/gfx", "dojo/on",
    "dojo/_base/lang", "dojo/text!piano_roll/templates/piano_roll_template.html", "dijit/Tooltip", "dijit/registry", "dojo/i18n!./nls/resources",
    "dojo/mouse", "dijit/layout/BorderContainer", "dijit/layout/BorderContainer", "dijit/form/Button"],
    function(declare, WidgetBase, TemplatedMixin, WidgetsInTemplateMixin, gfx, on, lang, template, Tooltip, registry, resources, mouse){
        return declare("myCustomWidgets.PianoRoll", [WidgetBase, TemplatedMixin, WidgetsInTemplateMixin], {
            templateString : template,
            widgetsInTemplate : true,
            baseClass : "pianoRollWidget",
            keyboard_size : {w : 60, h : 257},
            // cur_uppermost_note: Number
            //      左端の鍵盤上で一番上に表示されている鍵盤のノートナンバー
            cur_uppermost_note : 71,
            // cur_uppermost_note_pos: Number
            //      cur_uppermost_noteの座標
            cur_uppermost_note_pos : 0,
            // guide_bar: Object
            //      ガイドバーのインスタンス。ガイドバーのみを消去するため
            guide_bar : null,
            // _track_num : Number
            //      現在選択されているトラックナンバー
            //      1がベース。つまり配列のインデックスとして使うには1を引かなければならない
            _track_num : 1,
            // _viewport_info: Object
            //      ビューポートの大きさ
            _viewport_size : {w : 0, h : 0},
            // _pianoroll_height: Number
            //      ピアノロール自体の高さ
            _pianoroll_height : 0,
            // _viewport_pos: Object
            //      ピアノロールの左端の鍵盤を除いた部分の位置
            //      xは鍵盤の右端を、yは鍵盤の上端を基準とした相対座標
            _viewport_pos : {x : 0, y : 0},
            // _keyboard_pos: Number
            //      鍵盤の上端の位置
            //      ビューポートの初期位置が基準なので値域は-7 * keyboard_size.h + this._viewport_size.h <= y <= 0
            _keyboard_pos : 0,
            // _cur_ticks: Number
            //      現在のtick数
            _cur_ticks : 0,
            // _bar_heights: Number
            //      音符を配置するバー一本分の幅
            //      upperはF-Bまで、lowerはC-Eまでの音に対応する音符領域の高さ
            _bar_heights : {upper : 0, lower : 0},
            // _ticks_per_measure: Number
            //      1小節に相当するtick数
            _ticks_per_measure : 1920,
            _lowest_uppermost_note_num : 0,
            _velocity_colors : {weak : [0, 0, 255], strong : [255, 0, 0]},
            _tree : null,
            _surface : null,
            _touched : false,
            _last_mouse_pos : {x : 0, y : 0},
            _width_quarter_note : 48,
            _ticks_per_quarter_note : 480,
            _cur_selected_note : null,
            _predefined_inst_names : [resources.sine_wave, resources.square_wave, resources.sawtooth_wave, resources.triangle_wave, 
                resources.m_shaped_wave, resources.noise],
            _translations : resources,
            // _metaevent_list
            //      info_bar領域に特殊なアイコンを描画すべきメタイベントのリスト
            //      中身はSVGの画像
            _metaevent_list : [],
            _set_metaevent_listAttr : function(events){ //ツールチップで表示すべきイベントのリストを作る
                this._metaevent_list.splice(0);
                var MULTIPLIERS_NOTE_LEN = this._ticks_per_quarter_note / this._width_quarter_note, label_texts = [], _self = this;
                
                var prettifyEventParams = function(info){
                    var name, params;
                    if(info.name.search(/^(t|tempo)/) != -1){
                        name = resources.e_tempo_change;
                        params = info.arg1;
                    }else if(info.name.search(/^(k.sign|key_signature)/) != -1){
                        name = resources.e_key_change;
                        info.arg1 = info.arg1.replace(/^\+/, "#").replace(/^-/, "♭");
                        var sign = info.arg1[0];
                        params = info.arg2.match(/[a-g]/gi).map(function(note_name){
                            return note_name + sign;
                        }).join(", ");
                    }else{
                        name = resources.e_program_change;
                        var inst_names = _self._predefined_inst_names;
                        params = (info.arg1 < inst_names.length) ? inst_names[info.arg1] : resources.user_defined_wave + (info.arg1 - inst_names.length + 1);
                        params += "(for track " + (info.arg2 + 1) + ")";
                    }
                    
                    return '<p>Event name : ' + name + '<br>' + params + "</p>";
                };
                
                var last_x = 0;
                events.forEach(function(event){
                    var x = event.start_time / MULTIPLIERS_NOTE_LEN;
                    
                    if(x != last_x){       //保管しておいた情報を元に実際にイベントの情報を表示するツールチップとアイコンを追加する
                        var metaevent = {x : last_x};
                        metaevent.tooltip = new Tooltip({label : ["<div>"].concat(label_texts).concat(["</div>"]).join(""), showDelay : 250,
                            connectId : []});
                        this._metaevent_list.push(metaevent);
                        label_texts.splice(0);
                    }
                    
                    label_texts.push(prettifyEventParams(event));
                    
                    last_x = x;
                }, this);
                if(label_texts.length){ //add the last metaevent infos
                    var metaevent = {x : last_x};
                    metaevent.tooltip = new Tooltip({label : ["<div>"].concat(label_texts).concat(["</div>"]).join(""), showDelay : 250, connectId : []});
                    this._metaevent_list.push(metaevent);
                    label_texts.splice(0);
                }
            },
            _set_track_numAttr : function(num){
                this._track_num = num;
                if(this._tree && this._tree[this._track_num - 1]){
                    this.onUpdate();
                }
            },
            _set_treeAttr : function(tree){
                this._tree = tree;
                this.onUpdate();
            },
            
            _get_pianoroll_heightAttr : function(){
                return this._pianoroll_height;
            },
            
            _set_pianoroll_heightAttr : function(height){
                this._pianoroll_height = height;
            },
            
            _get_viewport_sizeAttr : function(){
                return this._viewport_size;
            },
            
            _set_viewport_sizeAttr : function(/*Object*/ info){
                this._viewport_size.w = info.w;
                this._viewport_size.h = info.h;
            },
            
            _get_viewport_posAttr : function(){
                return this._viewport_pos;
            },
            
            _set_viewport_posAttr : function(/*Object*/ pos){
                this._viewport_pos.x = pos.x;
                this._viewport_pos.y = pos.y;
            },
            
            _set_cur_ticksAttr : function(/*Number*/ cur_ticks){
                this._cur_ticks = cur_ticks;
            },
            
            _get_bar_heightsAttr : function(){
                return this._bar_heights;
            },
            
            _set_bar_heightsAttr : function(bar_heights){
                this._bar_heights = bar_heights;
            },
            
            _get_ticks_per_measureAttr : function(){
                return this._ticks_per_measure;
            },
            
            _set_ticks_per_measureAttr : function(/*Number*/ new_ticks){
                this._ticks_per_measure = new_ticks;
            },
            
            postCreate : function(){
                this._surface = gfx.createSurface("piano_roll", 400, this.keyboard_size.h * 7);
                this._set("_bar_heights", {upper : Math.round(1028.0 / 49.0),   //(257/7)*(4/7) F-Bまでの領域が黒鍵と白鍵で等分されていると仮定した場合
                    lower : Math.round(771.0 / 35.0)});                         //(257/7)*(3/5) C-Eまでの領域が黒鍵と白鍵で等分されていると仮定した場合
                this.cur_uppermost_note_pos = 3 * this.keyboard_size.h;
                this._viewport_pos.y = 3 * this.keyboard_size.h;
                this._keyboard_pos = -3 * this.keyboard_size.h;
                
                on(this._surface.getEventSource(), "mousedown", lang.hitch(this, this.onmousedown));
                on(this._surface.getEventSource(), "mouseup", lang.hitch(this, this.onmouseup));
                on(this._surface.getEventSource(), "mousemove", lang.hitch(this, this.onmousemove));
                on(this._surface.getEventSource(), "touchstart", lang.hitch(this, this.onmousedown));
                on(this._surface.getEventSource(), "touchend", lang.hitch(this, this.onmouseup));
                on(this._surface.getEventSource(), "touchmove", lang.hitch(this, this.onmousemove));
            },
            
            resize : function(new_size){
                this._surface.setDimensions(new_size.w, this.keyboard_size.h * 7);
                this._set("_pianoroll_height", new_size.h/* - this.tool_box.domNode.offsetHeight*/);
                this._set("_viewport_size", new_size);
                var viewport_height = this._viewport_size.h, i = 12, y = 0, bar_heights = this.get("_bar_heights");
                for(; y < viewport_height; ++i){
                    y += (this.isInLowerOfOctave(i)) ? bar_heights.lower : bar_heights.upper;
                }
                this._lowest_uppermost_note_num = i;
                
                if(!this.isBetween(-7 * this.keyboard_size.h + this._pianoroll_height, 0, this._keyboard_pos)){
                    this.cur_uppermost_note_pos = 3 * this.keyboard_size.h;
                    this._viewport_pos.y = 3 * this.keyboard_size.h;
                    this._keyboard_pos = -3 * this.keyboard_size.h;
                    this.cur_uppermost_note = 71;
                }
                
                this.onUpdate();
            },
            
            isInLowerOfOctave : function(note_num){
                return note_num % 12 < 5;
            },
            
            calcNoteNumPos : function(note_num){
                // summary:
                //      指定したノートナンバーの鍵盤のオフセットを鍵盤の上端を基準とした相対座標として算出する
                
                var i = 107, y = 0, bar_heights = this.get("_bar_heights");
                while(i - note_num > 12){
                    i -= 12;
                    y += this.keyboard_size.h;
                }
                
                for(; i > note_num; --i){
                    y += (this.isInLowerOfOctave(i)) ? bar_heights.lower : bar_heights.upper;
                }
                
                return y;
            },
            
            convertPosToNoteNum : function(offset){
                // summary:
                //      特定のy座標をノートナンバーに換算する
                
                var i = this.cur_uppermost_note, y = this._viewport_pos.y - this.cur_uppermost_note_pos, bar_heights = this.get("_bar_heights");
                for(; y != offset; --i){
                    y += (this.isInLowerOfOctave(i)) ? bar_heights.lower : bar_heights.upper;
                }
                
                return i;
            },
            
            convertTicksToPos : function(ticks){
                // summary:
                //      指定したtick数をx方向のオフセットに換算する
                
                var MULTIPLIERS_NOTE_LEN = this._ticks_per_quarter_note / this._width_quarter_note;
                return ticks / MULTIPLIERS_NOTE_LEN;
            },
            
            convertPosToTicks : function(x){
                // summary:
                //     特定のx座標をtick数に換算する
                
                var MULTIPLIERS_NOTE_LEN = this._ticks_per_quarter_note / this._width_quarter_note;
                return x * MULTIPLIERS_NOTE_LEN;
            },
            
            _drawGuideLines : function(){
                // summary:
                //      背景に小節線や拍子の区切りをあらわす線を描く
                
                var WIDTH_QUARTER_NOTE = this._width_quarter_note, WIDTH_MEASURE = 4 * WIDTH_QUARTER_NOTE, KEYBOARD_WIDTH = this.keyboard_size.w;
                var viewport_size = this.get("_viewport_size"), viewport_pos = this.get("_viewport_pos");
                
                //まず音高の区切りをあらわす横線を描く
                var i = this.cur_uppermost_note, line_offset = this.calcNoteNumPos(i) + this._keyboard_pos, bar_heights = this.get("_bar_heights");
                for(; line_offset < viewport_size.h; --i){
                    this._surface.createLine({x1 : KEYBOARD_WIDTH, y1 : line_offset, x2 : viewport_size.w, y2 : line_offset})
                        .setStroke("gray");
                    line_offset += (this.isInLowerOfOctave(i)) ? bar_heights.lower : bar_heights.upper;
                }
                
                //次に拍子をあらわす区切り線を描く
                var BOTTOM_MEASURE_NUM_BAR = 18;
                var x = 60 + WIDTH_QUARTER_NOTE - viewport_pos.x % WIDTH_QUARTER_NOTE;  //拍子の切れ目からのオフセットを出す
                var abs_x = viewport_pos.x + (x - KEYBOARD_WIDTH);          //1小節目の左端からのオフセットを算出する
                for(; x < viewport_size.w; x += WIDTH_QUARTER_NOTE, abs_x += WIDTH_QUARTER_NOTE){
                    var IS_AT_MEASURE_END = abs_x % WIDTH_MEASURE === 0;
                    this._surface.createLine({x1 : x, y1 : (IS_AT_MEASURE_END) ? 0 : BOTTOM_MEASURE_NUM_BAR, x2 : x, y2 : viewport_size.h})
                        .setStroke((IS_AT_MEASURE_END) ? "black" : "gray");
                }
            },
            
            _drawInfobar : function(){
                // summary:
                //      小節番号を含む領域を描画する
                
                var WIDTH_MEASURE = 4 * this._width_quarter_note, KEYBOARD_WIDTH = this.keyboard_size.w, BOTTOM_MEASURE_NUM_BAR = 18;
                var viewport_size = this.get("_viewport_size"), viewport_pos = this.get("_viewport_pos"), x;
                this._surface.createRect({x : KEYBOARD_WIDTH, y : 0, width : viewport_size.w, height : BOTTOM_MEASURE_NUM_BAR})
                    .setFill("white");
                this._surface.createLine({x1 : KEYBOARD_WIDTH, y1 : BOTTOM_MEASURE_NUM_BAR, x2 : viewport_size.w, y2 : BOTTOM_MEASURE_NUM_BAR})
                    .setStroke("black");
                x = -(viewport_pos.x % WIDTH_MEASURE) + KEYBOARD_WIDTH + 8;
                var canceller = function(e){e.preventDefault();}, measure_num_texts = [];
                for(var measure_num = Math.floor(viewport_pos.x / WIDTH_MEASURE) + 1; x < viewport_size.w; x += WIDTH_MEASURE, ++measure_num){
                    var text = this._surface.createText({x : x, y : 16, text : (measure_num).toString(), align : "start"})
                        .setFont({family : "Arial", size : "14pt", weight : "normal"})
                        .setFill("black");
                    measure_num_texts.push(text);
                    on(text.rawNode, "mousemove", canceller);
                }
                
                this._metaevent_list.filter(function(metaevent){    //メタイベントのアイコンを描画する
                    return this.isBetween(viewport_pos.x, viewport_pos.x + viewport_size.w, metaevent.x);
                }, this).forEach(function(metaevent){
                    var offset = metaevent.x - viewport_pos.x + this.keyboard_size.w;
                    measure_num_texts.every(function(text){
                        var width = text.rawNode.clientWidth;
                        if(this.isBetween(text.shape.x, text.shape.x + width, offset)){
                            offset += width;
                            return false;
                        }else if(this.isBetween(offset, offset + 12, text.shape.x)){
                            offset -= width;
                            return false;
                        }
                        return true;
                    }, this);
                    metaevent.img = this._surface.createImage({
                        x : offset,
                        y : 2,
                        width : 12,
                        height : 12,
                        src : "piano_roll/images/metaevent.png"
                    });
                    metaevent.tooltip.set("connectId", metaevent.img.rawNode);
                }, this);
            },
            
            _findStartNoteIndex : function(list, ticks){
                // summary:
                //      指定された時間を超えない最後のイベントのインデックスを返す
                
                var i = 0;
                for(; i < list.length; ++i){
                    var event = list[i];
                    if(lang.isArray(event) && event[0].start_time + event[0].length >= ticks || event.start_time + event.length >= ticks){
                        return i;
                    }
                }
                
                return -1;
            },
            
            _drawNotes : function(){
                // summary:
                //      音符を描画する
                
                if(!this._tree || this._track_num > this._tree.length){return;}
                var MULTIPLIERS_NOTE_LEN = this._ticks_per_quarter_note / this._width_quarter_note;
                var viewport_pos = this.get("_viewport_pos"), viewport_size = this.get("_viewport_size"), _self = this;
                var start_ticks = viewport_pos.x * MULTIPLIERS_NOTE_LEN, cur_track = this._tree[this._track_num - 1];
                var index = this._findStartNoteIndex(cur_track, start_ticks), info = {}, inner_index = 0;
                if(index == -1){return;}
                
                var proceedToNextEvent = function(info){
                    if(index >= cur_track.length){return false;}
                    var tmp = cur_track[index];
                    if(lang.isArray(tmp)){
                        if(inner_index < tmp.length){
                            tmp = tmp[inner_index];
                            ++inner_index;
                        }else{
                            inner_index = 0;
                            ++index;
                            return proceedToNextEvent(info);
                        }
                    }else if(tmp.type == "rest"){
                        ++index;
                        return proceedToNextEvent(info);
                    }
                    
                    info.event = tmp;
                    info.x = tmp.start_time / MULTIPLIERS_NOTE_LEN - viewport_pos.x + _self.keyboard_size.w;
                    if(inner_index !== 0){info.x += (inner_index - 1) * tmp.gate_time / MULTIPLIERS_NOTE_LEN;}
                    info.y = _self.calcNoteNumPos(tmp.pitch) + _self._keyboard_pos;
                    info.width = (inner_index === 0) ? tmp.length / MULTIPLIERS_NOTE_LEN - tmp.gate_time / MULTIPLIERS_NOTE_LEN :
                        tmp.length / MULTIPLIERS_NOTE_LEN - (inner_index - 1) * tmp.gate_time / MULTIPLIERS_NOTE_LEN;
                    info.height = (_self.isInLowerOfOctave(tmp.pitch)) ? _self._bar_heights.lower : _self._bar_heights.upper;
                    index = (inner_index === 0) ? index + 1 : index;
                    return info.x < viewport_pos.x + viewport_size.w;
                };
                
                var linear = function(val, x, from, to, len, is_up){
                    var tmp = (is_up) ? x - from : to - x;
                    return val * tmp / len;
                };
                
                var interpretVelocity = function(velocity){
                    var color = [], diffs = [color_strong[0] - color_weak[0], color_strong[1] - color_weak[1], color_strong[2] - color_weak[2]];
                    color[0] = Math.round(linear(Math.abs(diffs[0]), velocity, 0, 127, 128, (color_weak[0] < color_strong[0])));
                    color[1] = Math.round(linear(Math.abs(diffs[1]), velocity, 0, 127, 128, (color_weak[1] < color_strong[1])));
                    color[2] = Math.round(linear(Math.abs(diffs[2]), velocity, 0, 127, 128, (color_weak[2] < color_strong[2])));
                    return color;
                };
                
                var findNoteAt = function(ticks, y){
                    for(var i = 0, channel = _self._tree[_self._track_num - 1]; i < channel.length; ++i){
                        var elem = channel[i];
                        if(!lang.isArray(elem)){
                            if(ticks == channel[i].start_time){return elem;}
                        }else{
                            if(ticks == elem[0].start_time){
                                var note_num = _self.convertPosToNoteNum(y);
                                for(var j = 0; j < elem.length; ++j){
                                    if(note_num == elem[j].pitch){return elem[j];}
                                }
                            }
                        }
                    }
                    
                    throw Error("Unreachable code reached");
                };
                
                proceedToNextEvent(info);
                var surface = this._surface, color_weak = this._velocity_colors.weak, color_strong = this._velocity_colors.strong;
                
                do{
                    if(!this.isBetween(0, this._viewport_size.h, info.y)){continue;}    //ビューポートの高さに収まらないノートは描画しない
                    
                    var color = interpretVelocity(info.event.velocity);
                    var note_rect = surface.createRect({x : info.x, y : info.y, width : info.width, height : info.height})
                           .setFill("rgb(" + color.join(",") + ")")
                           .setStroke("black");
                    on(note_rect.rawNode, "click", function(e){
                        var node = e.currentTarget, pos = {x : node.x.baseVal.value, y : node.y.baseVal.value};
                        var ticks = _self.convertPosToTicks(pos.x + viewport_pos.x - _self.keyboard_size.w);
                        var target = findNoteAt(ticks, pos.y), velocity_display = registry.byId("velocity");
                        velocity_display.set("value", target.velocity);
                        
                        if(_self._cur_selected_note){
                            _self._cur_selected_note.node.setAttribute("fill-opacity", 1);
                            _self._cur_selected_note.node.setAttribute("stroke", "#000000");
                        }
                        node.setAttribute("fill-opacity", 0.5);        //選択されたことを示すハイライトを追加する
                        node.setAttribute("stroke", "rgb(255, 183, 0)");
                        _self._cur_selected_note = {node : node, pos : pos};
                    });
                }while(proceedToNextEvent(info));
            },
            
            _drawGuideBar : function(offset){
                var BOTTOM_MEASURE_NUM_BAR = 18;
                if(this.guide_bar){this._surface.remove(this.guide_bar, true);}
                this.guide_bar = this._surface.createRect({x : offset, y : BOTTOM_MEASURE_NUM_BAR, width : 4, height : this._viewport_size.h})
                    .setFill("gray")
                    .setStroke("blue");
            },
            
            onUpdate : function(){
                this._surface.clear();
                
                this._drawGuideLines();
                
                this._drawNotes();
                
                this._drawInfobar();
                
                //鍵盤を左端に表示する
                var TOTAL_KEYBOARD_HEIGHT = 7 * this.keyboard_size.h;
                this._surface.createImage({x : 0, y : this._keyboard_pos, width : this.keyboard_size.w,
                    height : TOTAL_KEYBOARD_HEIGHT, src : "piano_roll/images/keyboard.svg"});
            },
            
            clip : function(lower, upper, val){
                return (val < lower) ? lower :
                       (val > upper) ? upper : val;
            },
            
            isBetween : function(lower, upper, val){
                return (lower <= val && val <= upper);
            },
            
            jumpToMeasure : function(measure_num){
                var target_ticks = (measure_num - 1) * this._ticks_per_measure;
                var target_x = this.convertTicksToPos(target_ticks), PIANO_ROLL_WIDTH = this._viewport_size.w - this.keyboard_size.w;
                var viewport_pos = this.get("_viewport_pos");
                this.set("_viewport_pos", {x : Math.floor(target_x / PIANO_ROLL_WIDTH) * PIANO_ROLL_WIDTH, y : viewport_pos.y});
                this.onUpdate();
            },
            
            onSoundPlaying : function(ticks){
                this._cur_ticks += ticks;
                var original_offset = this.convertTicksToPos(this._cur_ticks), viewport_size = this.get("_viewport_size");
                var PIANO_ROLL_WIDTH = viewport_size.w - this.keyboard_size.w;
                var offset = original_offset % PIANO_ROLL_WIDTH + this.keyboard_size.w;
                if(!this.isBetween(this._viewport_pos.x, this._viewport_pos.x + PIANO_ROLL_WIDTH, original_offset)){ //再生中のノートが表示されていなければそこまで移動する
                    this._viewport_pos.x = Math.floor(original_offset / PIANO_ROLL_WIDTH) * PIANO_ROLL_WIDTH;
                    this.onUpdate();
                }
                if(this._viewport_pos.x + PIANO_ROLL_WIDTH < original_offset){
                    this._viewport_pos.x += PIANO_ROLL_WIDTH;
                    this.onUpdate();
                }
                
                this._drawGuideBar(offset);
            },
            
            onmousedown : function(e){
                if(mouse.isRight(e))
                    return;

                this._touched = true;
                this._last_mouse_pos.x = e.pageX;
                this._last_mouse_pos.y = e.pageY;
            },
            
            onmousemove : function(e){
                if(this._touched){
                    e.preventDefault();
                    var diff_x = e.pageX - this._last_mouse_pos.x, diff_y = e.pageY - this._last_mouse_pos.y, changed = false, viewport_pos = this._viewport_pos;
                    var pianoroll_height = this.get("_pianoroll_height");
                    if(Math.abs(diff_y) > 0 && this.isBetween(0, 7 * this.keyboard_size.h, viewport_pos.y + diff_y) &&
                        this.isBetween(-7 * this.keyboard_size.h + pianoroll_height, 0, this._keyboard_pos + diff_y)){
                        viewport_pos.y += diff_y;
                        this._keyboard_pos += diff_y;
                        viewport_pos.y = this.clip(0, 7 * this.keyboard_size.h, viewport_pos.y);
                        this._keyboard_pos = this.clip(-7 * this.keyboard_size.h + pianoroll_height, 0, this._keyboard_pos);
                        this.cur_uppermost_note = this.clip(this._lowest_uppermost_note_num, 107, this.cur_uppermost_note);
                        
                        var bar_heights = this.get("_bar_heights"), bar_height = (this.isInLowerOfOctave(this.cur_uppermost_note)) ? bar_heights.lower : bar_heights.upper;
                        if(this.cur_uppermost_note_pos + bar_height < Math.abs(this._keyboard_pos)){
                            --this.cur_uppermost_note;
                            this.cur_uppermost_note_pos += bar_height;
                        }else if(this.cur_uppermost_note_pos > Math.abs(this._keyboard_pos)){
                            ++this.cur_uppermost_note;
                            bar_height = (this.isInLowerOfOctave(this.cur_uppermost_note)) ? bar_heights.lower : bar_heights.upper;
                            this.cur_uppermost_note_pos -= bar_height;
                        }
                        
                        changed = true;
                    }
                    
                    if(Math.abs(diff_x) > 0){
                        viewport_pos.x -= diff_x;
                        if(viewport_pos.x < 0){viewport_pos.x = 0;}
                        changed = true;
                    }
                    
                    this._last_mouse_pos.x = e.pageX;
                    this._last_mouse_pos.y = e.pageY;
                    if(changed)
                        this.onUpdate();
                }
            },
            
            onmouseup : function(){
                if(this._touched)
                    this._touched = false;
            }
        });
});