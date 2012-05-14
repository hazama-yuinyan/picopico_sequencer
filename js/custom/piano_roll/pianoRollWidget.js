define(["dojo/_base/declare","dijit/_WidgetBase", "dijit/_TemplatedMixin", "dijit/_WidgetsInTemplateMixin", "dojox/gfx", "dojo/on",
    "dojo/_base/lang", "dojo/text!custom/piano_roll/templates/piano_roll_template.html", "dijit/layout/BorderContainer", "dijit/layout/BorderContainer",
    "dijit/form/Button"],
    function(declare, WidgetBase, TemplatedMixin, WidgetsInTemplateMixin, gfx, on, lang, template){
        return declare("myCustomWidgets.PianoRoll", [WidgetBase, TemplatedMixin, WidgetsInTemplateMixin], {
            templateString : template,
            widgetsInTemplate : true,
            baseClass : "pianoRollWidget",
            keyboard_size : {width : 60, height : 257},
            // cur_uppermost_note: Number
            //      左端の鍵盤上で一番上に表示されている鍵盤のノートナンバー
            cur_uppermost_note : 71,
            cur_uppermost_note_pos : 0,
            guide_bar : null,
            // _track_num : Number
            //      現在選択されているトラックナンバー
            _track_num : 1,
            // _viewport_info: Object
            //      ピアノロールの左端の鍵盤を除いた部分の大きさ
            _viewport_size : {w : 0, h : 0},
            // _viewport_pos: Object
            //      ピアノロールの左端の鍵盤を除いた部分の位置
            //      xは鍵盤の右端を、yは鍵盤の上端を基準とした相対座標
            _viewport_pos : {x : 0, y : 0},
            _keyboard_pos : 0,
            // _cur_ticks: Number
            //      現在のtick数
            _cur_ticks : 0,
            // _bar_height: Number
            //      音符を配置するバー一本分の高さ
            //      upperはF-Bまで、lowerはC-Eまでの音に対応する音符領域の高さ
            _bar_heights : {upper : 0, lower : 0},
            _tree : null,
            _surface : null,
            _touched : false,
            _last_mouse_pos : {x : 0, y : 0},
            _width_quarter_note : 48,
            _ticks_per_quarter_note : 480,
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
            
            _getviewport_sizeAttr : function(){
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
            
            postCreate : function(){
                this._surface = gfx.createSurface("piano_roll", 400, this.keyboard_size.height * 7);
                this._set("_bar_heights", {upper : Math.round(1028.0 / 49.0),   //(257/7)*(4/7) F-Bまでの領域が黒鍵と白鍵で等分されていると仮定した場合
                    lower : Math.round(771.0 / 35.0)});                         //(257/7)*(3/5) C-Eまでの領域が黒鍵と白鍵で等分されていると仮定した場合
                this.cur_uppermost_note_pos = 3 * this.keyboard_size.height;
                this._viewport_pos.y = 3 * this.keyboard_size.height;
                this._keyboard_pos = -3 * this.keyboard_size.height;
                
                on(this._surface.getEventSource(), "mousedown", lang.hitch(this, this.onmousedown));
                on(this._surface.getEventSource(), "mouseup", lang.hitch(this, this.onmouseup));
                on(this._surface.getEventSource(), "mousemove", lang.hitch(this, this.onmousemove));
            },
            
            resize : function(changeSize/*, resultSize*/){
                this._surface.setDimensions(changeSize.w, this.keyboard_size.height * 7);
                this._set("_viewport_size", changeSize);
                
                this.onUpdate();
            },
            
            calcNoteNumPos : function(note_num){
                // summary:
                //      指定したノートナンバーの鍵盤のオフセットを鍵盤の上端を基準とした相対座標として算出する
                
                var i = 107, y = 0, bar_heights = this.get("_bar_heights");
                while(i - note_num >= 12){
                    y += this.keyboard_size.height;
                    i -= 12;
                }
                
                for(var bar_height = bar_heights.upper; i > note_num; --i){
                    y += bar_height;
                    bar_height = (i % 12 < 5) ? bar_heights.lower : bar_heights.upper;
                }
                
                return y;
            },
            
            convertTicksToPos : function(ticks){
                // summary:
                //      指定したtick数をx方向のオフセットに換算する
                
                var MULTIPLIERS_NOTE_LEN = this._ticks_per_quarter_note / this._width_quarter_note;
                return ticks / MULTIPLIERS_NOTE_LEN;
            },
            
            _drawGuideLines : function(){
                // summary:
                //      背景に小節線や拍子の区切りをあらわす線を描く
                
                var WIDTH_QUARTER_NOTE = this._width_quarter_note, WIDTH_MEASURE = 4 * WIDTH_QUARTER_NOTE, KEYBOARD_WIDTH = this.keyboard_size.width;
                var viewport_size = this.get("_viewport_size"), viewport_pos = this.get("_viewport_pos");
                
                //まず音高の区切りをあらわす横線を描く
                var line_offset = viewport_pos.y - this.cur_uppermost_note_pos, i = (line_offset != 0) ? this.cur_uppermost_note - 1 : 
                    this.cur_uppermost_note, diff_y = 0, bar_heights = this.get("_bar_heights");
                for(; line_offset < viewport_size.h; --i, line_offset += diff_y){
                    this._surface.createLine({x1 : KEYBOARD_WIDTH, y1 : line_offset, x2 : viewport_size.w, y2 : line_offset})
                        .setStroke("gray");
                    diff_y = (i % 12 < 5) ? bar_heights.lower : bar_heights.upper;
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
                
                var WIDTH_MEASURE = 4 * this._width_quarter_note, KEYBOARD_WIDTH = this.keyboard_size.width, BOTTOM_MEASURE_NUM_BAR = 18;
                var viewport_size = this.get("_viewport_size"), viewport_pos = this.get("_viewport_pos"), x;
                this._surface.createRect({x : KEYBOARD_WIDTH, y : 0, width : viewport_size.w, height : BOTTOM_MEASURE_NUM_BAR})
                    .setFill("white");
                this._surface.createLine({x1 : KEYBOARD_WIDTH, y1 : BOTTOM_MEASURE_NUM_BAR, x2 : viewport_size.w, y2 : BOTTOM_MEASURE_NUM_BAR})
                    .setStroke("black");
                x = -(viewport_pos.x % WIDTH_MEASURE) + KEYBOARD_WIDTH + 8;
                var canceller = function(e){e.preventDefault();};
                for(var measure_num = Math.floor(viewport_pos.x / WIDTH_MEASURE) + 1; x < viewport_size.w; x += WIDTH_MEASURE, ++measure_num){
                    var text = this._surface.createText({x : x, y : 16, text : (measure_num).toString(), align : "start"})
                        .setFont({family : "Arial", size : "14pt", weight : "normal"})
                        .setFill("black");
                    on(text.rawNode, "mousemove", canceller);
                }
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
                
                if(!this._tree){return;}
                var MULTIPLIERS_NOTE_LEN = this._ticks_per_quarter_note / this._width_quarter_note;
                var start_ticks = this._viewport_pos.x * MULTIPLIERS_NOTE_LEN, cur_track = this._tree[this._track_num - 1], _self = this;
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
                    info.x = tmp.start_time / MULTIPLIERS_NOTE_LEN - _self._viewport_pos.x + _self.keyboard_size.width;
                    if(inner_index !== 0){info.x += (inner_index - 1) * tmp.gate_time / MULTIPLIERS_NOTE_LEN;}
                    info.y = _self.calcNoteNumPos(tmp.pitch) + _self._keyboard_pos;
                    info.width = (inner_index === 0) ? tmp.length / MULTIPLIERS_NOTE_LEN - tmp.gate_time / MULTIPLIERS_NOTE_LEN :
                        tmp.length / MULTIPLIERS_NOTE_LEN - (inner_index - 1) * tmp.gate_time / MULTIPLIERS_NOTE_LEN;
                    info.height = (tmp.pitch % 12 < 5) ? _self._bar_heights.lower : _self._bar_heights.upper;
                    index = (inner_index === 0) ? index + 1 : index;
                    return info.x < _self._viewport_pos.x + _self._viewport_size.w;
                };
                proceedToNextEvent(info);
                var surface = this._surface; 
                
                do{
                    if(!this.isBetween(0, this._viewport_size.h, info.y)){continue;}    //ビューポートの高さに収まらないノートは描画しない
                    
                    var color = "#ff0000";
                    surface.createRect({x : info.x, y : info.y, width : info.width, height : info.height})
                           .setFill(color)
                           .setStroke("black");
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
                var TOTAL_KEYBOARD_HEIGHT = 7 * this.keyboard_size.height;
                this._surface.createImage({x : 0, y : this._keyboard_pos, width : this.keyboard_size.width,
                    height : TOTAL_KEYBOARD_HEIGHT, src : "js/custom/piano_roll/images/keyboard.svg"});
            },
            
            clip : function(lower, upper, val){
                return (val < lower) ? lower :
                       (val > upper) ? upper : val;
            },
            
            isBetween : function(lower, upper, val){
                return (lower <= val && val <= upper);
            },
            
            onSoundPlaying : function(ticks){
                this._cur_ticks += ticks;
                var original_offset = this.convertTicksToPos(this._cur_ticks), viewport_size = this.get("_viewport_size");
                var PIANO_ROLL_WIDTH = viewport_size.w - this.keyboard_size.width;
                var offset = original_offset % PIANO_ROLL_WIDTH + this.keyboard_size.width;
                if(this._viewport_pos.x + PIANO_ROLL_WIDTH < original_offset){
                    this._viewport_pos.x += PIANO_ROLL_WIDTH;
                    this.onUpdate();
                }
                
                this._drawGuideBar(offset);
            },
            
            onmousedown : function(e){
                this._touched = true;
                this._last_mouse_pos.x = e.x;
                this._last_mouse_pos.y = e.y;
            },
            
            onmousemove : function(e){
                if(this._touched){
                    e.preventDefault();
                    var diff_x = e.x - this._last_mouse_pos.x, diff_y = e.y - this._last_mouse_pos.y, changed = false, viewport_pos = this._viewport_pos;
                    if(Math.abs(diff_y) > 0 && this.isBetween(0, 7 * this.keyboard_size.height - this._viewport_size.h, viewport_pos.y + diff_y) &&
                        this.isBetween(-7 * this.keyboard_size.height + this._viewport_size.h, 0, this._keyboard_pos + diff_y)){
                        viewport_pos.y += diff_y;
                        this._keyboard_pos += diff_y;
                        var bar_heights = this.get("_bar_heights"), bar_height = (this.cur_uppermost_note % 12 < 5) ? bar_heights.lower : bar_heights.upper;
                        if(this.cur_uppermost_note_pos > viewport_pos.y){
                            ++this.cur_uppermost_note;
                            bar_height = (this.cur_uppermost_note % 12 < 5) ? bar_heights.lower : bar_heights.upper;
                            this.cur_uppermost_note_pos -= bar_height;
                        }else if(this.cur_uppermost_note_pos + bar_height < viewport_pos.y){
                            --this.cur_uppermost_note;
                            this.cur_uppermost_note_pos += bar_height;
                        }
                        
                        changed = true;
                    }else{
                        viewport_pos.y = this.clip(0, 7 * this.keyboard_size.height - this._viewport_size.h, viewport_pos.y);
                        this._keyboard_pos = this.clip(-7 * this.keyboard_size.height + this._viewport_size.h, 0, this._keyboard_pos);
                        this.cur_uppermost_note = this.clip(12, 107, this.cur_uppermost_note);
                    }
                    
                    if(Math.abs(diff_x) > 0){
                        viewport_pos.x -= diff_x;
                        if(viewport_pos.x < 0){viewport_pos.x = 0;}
                        changed = true;
                    }
                    
                    this._last_mouse_pos.x = e.x;
                    this._last_mouse_pos.y = e.y;
                    if(changed){this.onUpdate();}
                }
            },
            
            onmouseup : function(){
                if(this._touched){this._touched = false;}
            }
        });
});