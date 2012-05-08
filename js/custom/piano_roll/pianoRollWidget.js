define(["dojo/_base/declare","dijit/_WidgetBase", "dijit/_TemplatedMixin", "dojox/gfx", "dojo/text!custom/piano_roll/templates/piano_roll_template.html",
    "dijit/layout/LayoutContainer", "dijit/layout/ContentPane"],
    function(declare, WidgetBase, TemplatedMixin, gfx, template){
        return declare("myCustomWidgets.PianoRoll", [WidgetBase, TemplatedMixin], {
            cur_sample_frame : 0,
            templateString : template,
            widgetsInTemplate : true,
            baseClass : "pianoRollWidget",
            postCreate : function(){
                var surface = gfx.createSurface("piano_roll", 400, 400);
                surface.createCircle({ cx: 300, cy: 300, rx: 50, r: 25 }).setStroke({
                    style: "Dot", width: 3, cap: "round", color: "#f00"
                    });
                surface.createImage({x : 0, y : 0, width : 60, height : 257, src : "images/keyboard.svg"});
            }
        });
});