var profile = (function(){
    return {
        basePath: "..",
     
        action: "release",
     
        cssOptimize: "comments",
     
        mini: true,
     
        optimize: "closure",
     
        layerOptimize: "closure",
     
        stripConsole: "all",
     
        selectorEngine: "acme",
        
        layers: {
            "dojo/dojo": {
                include: [ "dojo/dojo", "app/main", "app/modules" ],
                customBase: true,
                boot: true
            }
        },
        
        staticHasFeatures: {
            // The trace & log APIs are used for debugging the loader, so we don’t need them in the build
            'dojo-trace-api':0,
            'dojo-log-api':0,
    
            // This causes normally private loader data to be exposed for debugging, so we don’t need that either
            'dojo-publish-privates':0,
    
            // We’re fully async, so get rid of the legacy loader
            'dojo-sync-loader':0,
            
            // dojo-xhr-factory relies on dojo-sync-loader
            'dojo-xhr-factory':0,
    
            // We aren’t loading tests in production
            'dojo-test-sniff':0
        },
     
        resourceTags: {
            amd: function (filename, mid) {
                return /\.js$/.test(filename);
            },
            
            miniExclude: function(filename, mid){
                return mid in {
                    "app/picopico_sequencer.profile" : 1,
                    "app/config" : 1,
                    "app/config_build" : 1
                };
            }
        }
    };
})();