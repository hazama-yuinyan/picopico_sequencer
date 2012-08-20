require(["app/main", "dojo/parser", "app/modules", "dojo/domReady!"], function(main, parser){
    parser.parse({propsThis : main, template : true});
});