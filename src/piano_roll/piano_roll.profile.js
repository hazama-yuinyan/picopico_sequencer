var profile = (function(){
    var not_copied = {
        "piano_roll/profile" : 1
    };
    return{
        resourceTags: {
            amd: function (filename, mid) {
                return !(mid in not_copied) && /\.js$/.test(filename);
            }
        }
    };
})();