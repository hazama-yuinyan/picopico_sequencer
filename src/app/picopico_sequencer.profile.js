var profile = {
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
            include: [ "dojo/dojo", "app/main" ],
            customBase: true,
            boot: true
        }
    },
 
    resourceTags: {
        amd: function (filename, mid) {
            return /\.js$/.test(filename);
        }
    }
};