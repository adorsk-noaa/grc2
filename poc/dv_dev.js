require(
  [
    "jquery",
    "rless!GeoRefineClient/styles/DataView.less",
    "GeoRefineClient/views/DataView"
],
function($, DataViewCss, DataView){

  GeoRefine = {};
  GeoRefine.app = {
    requestsEndpoint: "http://localhost:8000/georefine/projects/execute_requests/42/"
  }


  var dvConfig = {
    defaultInitialState: {
      qField: {
        id: 'a',
        format: '%.1s',
        inner_query: {
          SELECT: [
            {ID: 'a_sum', EXPRESSION: 'func.sum(__result__a)'}
          ]
        },
        label: 'A',
        outer_query: {
          SELECT: [
            {ID: 'a_sum', EXPRESSION: '__inner__a_sum'}
          ]
        },
        value_type: 'numeric'
      },

      filterGroups: [
        {id: 'scenario'},
        {id: 'data'}
      ],

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
          }
        }
      },
    },
    map: {},
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
        model: new Backbone.Model({
          config: dvConfig
        }),
        el: $('#main')
      });

      window.dv.trigger('ready');
    });
  });
}
);
