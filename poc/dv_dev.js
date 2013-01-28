require(
  [
    "jquery",
    "rless!GeoRefineClient/styles/DataView.less",
    "GeoRefineClient/views/DataView"
],
function($, DataViewCss, DataView){

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

    filterGroups: new Backbone.Collection(
      [new Backbone.Model({id: 'scenario'}), new Backbone.Model({id: 'data'})]
    ),

    summaryBar: new Backbone.Model({
    }),

    facetsEditor: new Backbone.Model({
      facetDefinitions: new Backbone.Collection(),
      facets: new Backbone.Collection()
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
        [new Backbone.Model({
        layer_type:"WMS",
        label:"Layer 0",
        disabled:false,
        service_url: 'http://vmap0.tiles.osgeo.org/wms/vmap0',
        params: {"layers": 'basic'},
        id:"layer0",
      })]) ,
    }),

    initialActions: {
      async: false,
      actions: [
        {
        handler: "mapEditor_initializeMapEditor",
        type: "action"
      }
      ]
    }
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
