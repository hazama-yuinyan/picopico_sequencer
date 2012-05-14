define(["dojo/_base/declare"], function(declare){
    
    var Enviroment = declare(null, {
        constructor : function(){
            this.notes_with_signature = {};
            this.cur_tempo = 120;
            this.cur_default_length = 480;
            this.cur_default_octave = 4;
            this.cur_gate_time = 0;
            this.cur_volumes = [127];
            this.cur_track_num = 0;
            this.program_nums = [0];
            
            var diff_pitches = {c : 0, d : 2, e : 4, f : 5, g : 7, a : 9, b : 11};
            this.getPitchDifference = function(char){
                return diff_pitches[char];
            };
        },
        
        restoreDefault : function(){
            this.notes_with_signature = {};
            this.cur_tempo = 120;
            this.cur_default_length = 480;
            this.cur_default_octave = 4;
            this.cur_gate_time = 0;
        },
        
        getPitchDiffByKey : function(note_name){
            return this.notes_with_signature[note_name] || 0;
        },
        
        setCurrentKey : function(key_def){
            this.notes_with_signature = {};
            if(typeof key_def == "string"){
                throw SyntaxError("Sorry, but currently you can't set key signatures by keyword! Please specify which notes should " + 
                    "be sharpend or flattened one by one.");
            }else{
                var notes = key_def[1], signs = key_def[0];
                notes.forEach(function(note_name, index){
                    var sign = (signs.length > 1) ? signs[index] : signs;
                    this.notes_with_signature[note_name] = (sign == '-') ? -1 : 1;
                }, this);
            }
        },
        
        getCurrentTempo : function(){
            return this.cur_tempo;
        },
        
        setTempo : function(t){
            this.cur_tempo = t;
        },
        
        getCurrentDefaultLength : function(){
            return this.cur_default_length;
        },
        
        setCurrentDefaultLength : function(args){
            this.cur_default_length = (args[0]) ? args[1] : 480 * 4 / args[1];
        },
        
        getOctaveInNoteNum : function(){
            return this.cur_default_octave * 12 + 12;
        },
        
        setOctave : function(o){
            this.cur_default_octave = o;
        },
        
        getGateTime : function(){
            return this.cur_gate_time;
        },
        
        setGateTime : function(args){
            this.cur_gate_time = (args[0]) ? args[1] : 480 * args[1] / 8;
        },
        
        getProgramNumForTrack : function(track_num){
            return this.program_nums[track_num];
        },
        
        setProgramNumForTrack : function(track_num, program_num){
            this.program_nums[track_num] = program_num;
        },
        
        getVolumeForTrack : function(track_num){
            return this.cur_volumes[track_num];
        },
        
        setVolume : function(track_num, v){
            this.cur_volumes[track_num] = v;
        },
        
        getCurrentTrackNum : function(){
            return this.cur_track_num;
        },
        
        setTrackNum : function(track_num){
            this.cur_track_num = track_num;
        }
    });
    
    var CommandManager = declare(null, {
        constructor : function(){
            this.command_names = {};
        },
        
        invoke : function(name, args){
            if(!this.command_names[name]){throw Error("Command not found named: " + name);}
            this.command_names[name](args);
        },
        
        register : function(name, func){
            this.command_names[name] = func;
        },
        
        registerAll : function(objs){
            objs.forEach(function(obj){
                if(obj.shorter_name){this.register(obj.shorter_name, obj.func);}
                if(obj.longer_name){
                    obj.longer_name.forEach(function(name){
                        this.register(name, obj.func);
                    }, this);
                }
            }, this);
        }
    });
    
    return {Enviroment : Enviroment, CommandManager : CommandManager};
});