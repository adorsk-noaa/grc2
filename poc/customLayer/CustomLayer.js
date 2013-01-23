define(
  [
    "openlayers"
],
function($, ol, CustomLayer){

  OpenLayers.Layer.CustomLayer = OpenLayers.Class(OpenLayers.Layer, {
    CLASS_NAME: "OpenLayers.Layer.CustomLayer",

    initialize: function(name, options) {
      console.log("initialize", arguments);
      OpenLayers.Layer.prototype.initialize.apply(this, arguments);
    },

    onMapResize: function() {
      console.log("onMapResize", arguments);
      OpenLayers.Layer.prototype.onMapResize.apply(this, arguments);
    },

    moveTo: function(bounds, zoomChanged, dragging) {
      console.log("moveTo", arguments);
      OpenLayers.Layer.prototype.moveTo.apply(this, arguments);
    },
  });

  console.log("defined CustomLayer");
});
