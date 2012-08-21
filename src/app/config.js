var dojoConfig = {
    async : true,
    isDebug : true,
    baseUrl : location.pathname.replace(/\/[^/]*$/, "/"),
    tlmSiblingOfDojo : false,
    parseOnLoad : false,
    //locale : "en-us",
    packages : [
        {name : "dojo", location : "lib/dojo"},
        {name : "dijit", location : "lib/dijit"},
        {name : "dojox", location : "lib/dojox"},
        {name : "treehugger", location : "lib/treehugger/lib/treehugger"},
        {name : "app", location : "app"},
        {name : "piano_roll", location : "piano_roll"}
    ]
};