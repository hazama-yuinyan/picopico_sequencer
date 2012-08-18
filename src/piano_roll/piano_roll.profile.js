var profile = (function(){
    return{
        resourceTags: {
            amd: function (filename, mid) {
                return /\.js$/.test(filename);
            },
            
            miniExclude: function(filename, mid){
                return mid in {
                    "piano_roll/piano_roll.profile" : 1
                };
            }
        }
    };
})();