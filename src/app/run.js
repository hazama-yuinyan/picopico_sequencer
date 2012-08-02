require(["app/main", "dojo/behavior", "dojo/parser", "app/modules", "dojo/domReady!"], function(main, behavior, parser){
    parser.parse({propsThis : main.resources, template : true});
    behavior.add(main.behaviors);
    behavior.apply();
});