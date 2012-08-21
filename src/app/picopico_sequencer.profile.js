var profile = (function(){
    return {
        basePath: "..",
     
        action: "release",
     
        cssOptimize: "comments",
     
        mini: true,
     
        optimize: "closure",
     
        layerOptimize: "closure",
     
        stripConsole: "all",
     
        selectorEngine: "lite",
        
        layers: {
            "dojo/dojo": {
                include: [ "dojo/dojo", "app/main", "app/modules" ],
                customBase: true,
                boot: true
            }
        },
        
        /*defaultConfig:{
            hasCache:{
				// these are the values given above, not-built client code may test for these so they need to be available
				'dojo-built':1,
				'dojo-loader':1,
				'dom':1,
				'host-browser':1,

				// default
				"config-selectorEngine":"lite"
			},
			async:1
		},*/
        
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
            'dojo-test-sniff':0,
            
            // dojo/dojo
            'config-dojo-loader-catches':0,
            
            // dojo/dojo
			'config-tlmSiblingOfDojo':0,

			// dojo/dojo
			'dojo-amd-factory-scan':0,

			// dojo/dojo
			'dojo-combo-api':0,

			// dojo/_base/config, dojo/dojo
			'dojo-config-api':1,

			// dojo/main
			'dojo-config-require':0,

			// dojo/_base/kernel
			'dojo-debug-messages':0,

			// dojo/dojo
			'dojo-dom-ready-api':1,

			// dojo/main
			'dojo-firebug':0,

			// dojo/_base/kernel
			'dojo-guarantee-console':1,

			// dojo/has
			'dojo-has-api':1,

			// dojo/dojo
			'dojo-inject-api':1,

			// dojo/_base/config, dojo/_base/kernel, dojo/_base/loader, dojo/ready
			'dojo-loader':1,

			// dojo/_base/kernel
			'dojo-modulePaths':0,

			// dojo/_base/kernel
			'dojo-moduleUrl':0,

			// dojo/dojo
			'dojo-requirejs-api':0,

			// dojo/dojo
			'dojo-sniff':0,

			// dojo/dojo
			'dojo-timeout-api':0,

			// dojo/dojo
			'dojo-undef-api':0,

			// dojo/i18n
			'dojo-v1x-i18n-Api':1,

			// dojo/_base/loader, dojo/dojo, dojo/on
			'dom':1,

			// dojo/dojo
			'host-browser':1,

			// dojo/_base/array, dojo/_base/connect, dojo/_base/kernel, dojo/_base/lang
			'extend-dojo':1,
            
            'dojo-preload-i18n-Api':1
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