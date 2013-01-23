require(
  [
    "jquery",
    "openlayers",
    "poc/customLayer/CustomLayer"
],
function($, ol, CustomLayer){
  console.log("here", CustomLayer);

  var $map = $('<div id="map" style="width:800px; height: 600px;"></div>').appendTo($('body'));
  var map = new OpenLayers.Map('map', {
    div: $map.get(0),
    maxExtent: [-180, -90, 180, 90]
  });
  window.m = map;

  var wms = new OpenLayers.Layer.WMS(
    "OpenLayers WMS",
    "http://vmap0.tiles.osgeo.org/wms/vmap0",
    {'layers':'basic'},
    {wrapDateLine: true}
  );
  map.addLayer(wms);

  var generateRectGeom = function(x0, x1, y0, y1){
    return {
      'type': 'Polygon',
      'coordinates': [[[x0,y0],[x0,y1],[x1,y1],[x1,y0],[x0,y0]]]
    };
  }

  var gjFeaturesToOLFeatures = function(geoJSON){
    var reader = new OpenLayers.Format.GeoJSON();
    return reader.read(geoJSON);
  };

  var createGeoJSONGrid = function(xMin, xMax, yMin, yMax, dx, dy){
    var gjFeatures = [];
    var featureCounter = 0;
    for (var x=xMin; x < xMax; x += dx){
      for (var y=yMin; y < yMax; y += dy){
        featureCounter += 1;
        gjFeatures.push({
          "type": "Feature",
          "geometry": generateRectGeom(x,x+dx,y,y+dy),
          "id": featureCounter
        });
      }
    }
    return {
      type: 'FeatureCollection',
      features: gjFeatures
    }
  };

  //gjFeatures = createGeoJSONGrid(-45, 45, -45, 45, 10, 10);
  gjFeatures = createGeoJSONGrid(-20, 20, -20, 20, 40, 40);
  olFeatures = gjFeaturesToOLFeatures(gjFeatures);

  var customLayer = new OpenLayers.Layer.CustomLayer(
    "customLayer1",
    {}
  );
  map.addLayer(customLayer);
  map.zoomToMaxExtent();

  customLayer.addFeatures(olFeatures);

});
