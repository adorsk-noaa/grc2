require(
  [
    "jquery",
    "rless!GeoRefineClient/styles/DataView.less",
    "GeoRefineClient/views/DataView"
],
function($, DataViewCss, DataView){

  var geoRefineBaseUrl = 'http://localhost:8000/georefine';
  var projectId = 94;
  GeoRefine = {};
  GeoRefine.app = {
    requestsEndpoint: geoRefineBaseUrl + '/projects/execute_requests/' + projectId + '/',
    WMSLayerEndpoint: geoRefineBaseUrl + '/projects/' + projectId + 'layer',
    colorBarEndpoint: geoRefineBaseUrl + '/projects/colorbar/',
    dataLayerEndpoint: geoRefineBaseUrl + '/projects/get_map/' + projectId + '/',
    keyedStringsEndpoint: geoRefineBaseUrl + '/ks'
  };

  var dvConfig = {
    defaultInitialState: {
      qField: {
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
      },

      filterGroups: [
        {id: 'scenario'},
        {id: 'data'}
      ],

      summaryBar: {
        base_filter_groups: ['scenario'],
        primary_filter_groups: ['data']
      },

      facetsEditor: {
        predefined_facets: {
          timestep: {
            "facetDef":{
              "noClose":true,
              "choices":[{id: 0}],
              "value_type":"numeric",
              "KEY":{
                "QUERY":{
                  "SELECT":[
                    {
                    "EXPRESSION":"__time__id",
                    "ID":"t"
                  }
                  ]
                },
                "KEY_ENTITY":{
                  "EXPRESSION":"__result__t",
                  "ID":"t"
                }
              },
              "label":"Timestep",
              "type":"timeSlider",
              "filter_entity":{
                "TYPE":"ENTITY",
                "EXPRESSION":"__result__t",
                "ID":"t"
              },
              "primary_filter_groups":[
                "scenario"
              ]
            },
            "id":"timestep"
          },
          substrate: {
            "facetDef":{
              "info": null,
              "info_link":"{{PROJECT_STATIC_DIR}}/sasipedia#substrates/index.html",
              "outer_query":{
                "GROUP_BY":[{"ID":"substrate_label"}, {"ID":"substrate_id"}],
                "FROM":[{
                  "SOURCE":"substrate",
                  "JOINS":[
                    ["inner", [{"TYPE":"ENTITY", "EXPRESSION":"__inner__substrate_id"},
                      "==", {"TYPE":"ENTITY", "EXPRESSION":"__substrate__id" }]]
                  ]
                }],
                "SELECT":[
                  {"EXPRESSION":"__substrate__id", "ID":"substrate_id" },
                  {"EXPRESSION":"__substrate__label", "ID":"substrate_label"}
                ]
              },
              "base_filter_groups":["scenario"],
              "label":"Substrates",
              "inner_query":{
                "GROUP_BY":[{"EXPRESSION":"__result__substrate_id","ID":"substrate_id"}],
                "SELECT":[{"EXPRESSION":"__result__substrate_id", "ID":"substrate_id"}]
              },
              "KEY":{
                "LABEL_ENTITY":{"ID":"substrate_label"},
                "QUERY":{
                  "SELECT":[
                    {"EXPRESSION":"__substrate__id","ID":"substrate_id"},
                    {"EXPRESSION":"__substrate__label", "ID":"substrate_label"}
                  ]
                },
                "KEY_ENTITY":{"EXPRESSION":"__result__substrate_id","ID":"substrate_id"}
              },
              "type":"list",
              "filter_entity":{"TYPE":"ENTITY", "EXPRESSION":"__result__substrate_id", "ID":"substrate"},
              "primary_filter_groups":["data"]
            },
            "id":"substrate"
          }
        }
      },
      mapEditor: {
        //"max_extent":[-80, 30, -65, 45],
        "max_extent":[-5, -5, 5, 5],
        "graticule_intervals":[2],
        "base_layers":[
          {
          "layer_type":"WMS",
          "label":"Layer 0",
          "disabled":false,
          "service_url": 'http://vmap0.tiles.osgeo.org/wms/vmap0',
          "params": {"layers": 'basic'},
          "id":"layer0",
          "options":{}
        },
        ],
        "overlay_layers":[],
        "base_filter_groups":["scenario"],
        "data_layers": [
          /*
          {
          "layer_type":"WMS",
          "geom_id_entity":{"ID":"z_geom_id"},
          "options":{},
          "outer_query":{
            "FROM":[{
              "SOURCE":"cell",
              "JOINS":[
                ["inner", [{"TYPE":"ENTITY", "EXPRESSION":"__inner__cell_id"},
                  "==", { "TYPE":"ENTITY", "EXPRESSION":"__cell__id" }]]
              ]
            }
            ],
            "SELECT":[
              {"EXPRESSION":"__cell__id", "ID":"z_geom_id" },
              {"EXPRESSION":"__cell__geom", "ID":"z_geom"},
              {"EXPRESSION":"__inner__z_data / __cell__area", "ID":"z_data"}
            ]
          },
          "geom_entity":{"ID":"z_geom"},
          "label":"Net Swept Area (Z) (density)",
          "disabled":true,
          "source":"georefine_data_layer",
          "inner_query":{
            "GROUP_BY":[{"EXPRESSION":"__result__cell_id", "ID":"cell_id"}],
            "SELECT":[{"EXPRESSION":"func.sum(__result__z)", "ID":"z_data" }]
          },
          "info":"info test",
          "params":{
            "transparent":true
          },
          "data_entity":{"max":1,"ID":"z_data","min":0 },
          "layer_category":"data",
          "id":"z"
        }
          */
        ],
        "default_layer_options":{
          "transitionEffect":"resize",
          "tileSize":{"w":1024, "h":1024},
          "buffer":0
        },
        "default_layer_attributes":{
          "disabled":true,
          "reorderable":true
        },
        "resolutions":[0.025,0.0125,0.00625,0.003125,0.0015625,0.00078125],
        "primary_filter_groups":["data"]
      },
    },
    initialActions: {
      "async":false,
      "actions": [
        {
        "async":false,
        "type":"actionQueue",
        "actions":[
          {
          "handler":"facets_addFacet",
          "type":"action",
          "opts":{
            "category":"base",
            "facetId":"tstep",
            "defId":"timestep",
            "fromDefinition":true
          }
        },
        {
          "handler":"facets_initializeFacet",
          "type":"action",
          "opts":{
            "category":"base",
            "id":"tstep"
          }
        },
        {
          "handler":"facets_connectFacet",
          "type":"action",
          "opts":{
            "category":"base",
            "id":"tstep"
          }
        },
        {
          "handler":"facets_facetGetData",
          "type":"action",
          "opts":{
            "category":"base",
            "id":"tstep"
          }
        },
        {
          "handler":"facets_facetSetSelection",
          "type":"action",
          "opts":{
            "category":"base",
            "index":0,
            "id":"tstep"
          }
        }
        ]
      },
      {
        "async":false,
        "type":"actionQueue",
        "actions":[
          {
          "handler":"summaryBar_initialize",
          "type":"action"
        },
        {
          "handler":"summaryBar_connect",
          "type":"action"
        },
        {
          "handler":"summaryBar_getData",
          "type":"action"
        }
        ]
      },
      {
        "handler":"mapEditor_initializeMapEditor",
        "type":"action"
      }
      ]
    }
  };


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
        model: new Backbone.Model({ }),
        config: dvConfig
        el: $('#main')
      });

      //window.dv.trigger('ready');
    });
  });
}
);
