require(
  [
    "jquery",
    "rless!GeoRefineClient/styles/DataView.less",
    "GeoRefineClient/views/DataView",
    "MapView/models/Feature",
],
function($, DataViewCss, DataView, FeatureModel){

  var getFeatures = function(){
    var createGrid = function(xMin, xMax, yMin, yMax, dx, dy){
      var geoms = {};
      var featureCounter = 0;
      for (var x=xMin; x < xMax; x += dx){
        for (var y=yMin; y < yMax; y += dy){
          featureCounter += 1;
          var coords = [[x, y],[x,y+dy],[x+dx,y+dy],[x+dx,y],[x,y]];
          var hex = (featureCounter % 255).toString(16);
          var color = '#' + hex + hex + hex;
          geoms[featureCounter] = {
            "type": "Polygon",
            "coordinates": [coords]
          };
        }
      }
      return geoms;
    };

    var xMin = -40;
    var xMax = 40;
    var dx = 10;
    var yMin = -40;
    var yMax = 40;
    var dy = 10;
    var geoms = createGrid(xMin, xMax, yMin, yMax, dx, dy);

    var features = new Backbone.Collection();
    for (var i in geoms){
      var feature = new FeatureModel({
        id: parseInt(i),
        geometry: geoms[i],
        properties: new Backbone.Model({
          p1: parseInt(i)
        })
      });
      features.add(feature);
    }
    return features;
  };

  getData = function(){
    console.log('getData');
    _.each(this.get('features').models, function(featureModel){
      featureModel.get('properties').set({p1: featureModel.get('properties').get('p1') + 1});
    }, this);
  };

  testGetGrid = function(layerView, opts){
    var deferred = $.Deferred();
    var features = getFeatures();
    layerView.model.get('features').add(features.models);
    setTimeout(function(){
      console.log('tggResolve');
      deferred.resolve();
    }, 50);
    return deferred;
  };

  var dvModel = new Backbone.Model({
    qField: new Backbone.Model({
      id: 'z',
      format: '%.1H',
      inner_query: {
        SELECT: [
          {ID: 'z_sum', EXPRESSION: 'func.sum(__result__z)'}
        ]
      },
      label: 'Z',
      outer_query: {
        SELECT: [
          {ID: 'z_sum', EXPRESSION: '__inner__z_sum'}
        ]
      },
      value_type: 'numeric'
    }),

    filterGroups: ['scenario', 'data'],

    summaryBar: new Backbone.Model({
    }),

    facetsEditor: new Backbone.Model({
      facetDefinitions: new Backbone.Collection(),
      facets: new Backbone.Collection(
        [
          new Backbone.Model({
        id: 'timestep',
        type: 'timeSlider',
        choices: [{id: 0, label: 0, value: 0}, {id: 1, label: 1, value: 1}],
        primary_filter_groups: ['data'],
        base_filter_groups: ['scenario']
      })
      ])
    }),

    mapEditor: new Backbone.Model({
      map: new Backbone.Model({
        max_extent: [-5, -5, 5, 5],
        graticule_intervals:[2],
        default_layer_options: {
          transitionEffect:"resize",
          tileSize:{"w":1024, "h":1024},
          buffer:0
        },
        default_layer_attributes:{
          disabled: true,
          reorderable: true
        },
        resolutions:[0.025,0.0125,0.00625,0.003125,0.0015625,0.00078125],
      }),
      base_layers: new Backbone.Collection(
        [
          new Backbone.Model({
        layer_type:"WMS",
        label:"Layer 0",
        disabled:false,
        service_url: 'http://vmap0.tiles.osgeo.org/wms/vmap0',
        params: {"layers": 'basic'},
        id:"layer0",
      })]) ,
      data_layers: new Backbone.Collection(
        [
          new Backbone.Model({
        colormapId: 'ColorBrewer:PiG',
        dataProp: 'p1',
        layer_type: 'Vector',
        layer_category: 'data',
        source: 'georefine_data',
        label: 'Test Vector',
        disabled: false,
        id: 'testVector',
        initializer: 'testGetGrid',
        base_filter_groups: ['scenario'],
        primary_filter_groups: ['data'],
        getData: 'getData',
        query: new Backbone.Model({
        }),
      })])
    }),
  });

  $(document).ready(function(){
    $(document.body).append('<p id="stylesLoaded" style="display: none;"></p>');
    cssEl = document.createElement('style');
    cssEl.id = 'grc_css';
    cssEl.type = 'text/css';
    cssText = DataViewCss + "\n#stylesLoaded {position: fixed;}\n";
    if (cssEl.styleSheet){
      cssEl.styleSheet.cssText = cssText;
    }
    else{
      cssEl.appendChild(document.createTextNode(cssText));
    }
    document.getElementsByTagName("head")[0].appendChild(cssEl);

    var cssDeferred = $.Deferred();
    var cssInterval = setInterval(function(){
      $testEl = $('#stylesLoaded');
      var pos = $testEl.css('position');
      if (pos == 'fixed'){
        clearInterval(cssInterval);
        cssDeferred.resolve();
      }
      else{
        console.log('loading styles...', pos);
      }
    }, 500);

    cssDeferred.done(function(){
      window.dv = new DataView({
        model: dvModel,
        el: $('#main')
      });

      window.dv.trigger('ready');
    });
  });
}
);
