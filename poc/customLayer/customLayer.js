require(
  [
    "jquery",
    "openlayers",
    "poc/customLayer/CustomLayer"
],
function($, ol, CustomLayer){
  console.log("here", CustomLayer);

  var $map = $('<div id="map" style="width:800px; height: 600px;"></div>').appendTo($('body'));
  var map = new OpenLayers.Map($map.get(0), 'map');

  var wms = new OpenLayers.Layer.WMS(
    "OpenLayers WMS",
    "http://vmap0.tiles.osgeo.org/wms/vmap0",
    {'layers':'basic'}
  );
  map.addLayer(wms);

  var custom = new OpenLayers.Layer.CustomLayer(
    "custom",
    {}
  );
  map.addLayer(custom);

  map.zoomToMaxExtent();
});
