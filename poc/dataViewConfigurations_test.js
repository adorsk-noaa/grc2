resultFacets = {
  __result__t: {
    "id": "timestep",
    "noClose":true,
    "choices":[],
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
  __result__substrate_id: {
    "id": "substrate",
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
  }
};

baseLayers = {
  osgeoWorld: {
    "layer_type":"WMS",
    "label":"Layer 0",
    "disabled":false,
    "service_url": 'http://vmap0.tiles.osgeo.org/wms/vmap0',
    "params": {"layers": 'basic'},
    "id":"layer0",
    "options":{}
  }
};

resultLayers = {
  z: {
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
};

resultDefaultInitialActions = {
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
};

filterGroups = {
  scenario: {id: 'scenario'},
  data: {id: 'data'}
};

resultQFields = {
  z: {
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
  }
};

defaultFilterGroups = [filterGroups['scenario'], filterGroups['data']];
defaultSummaryBar = {
  base_filter_groups: ['scenario'],
  primary_filter_groups: ['data']
};

resultDataViewConfigurations = {
  __result__z: {
    defaultInitialState: {
      qField: resultQFields['z'],
      facetsEditor: {
        predefined_facets: resultFacets
      },
      mapEditor: {
        "max_extent":[-5, -5, 5, 5],
        "graticule_intervals":[2],
        "base_layers":[baseLayers['osgeoWorld']],
        "overlay_layers":[],
        "data_layers": [resultLayers['z']],
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
        "primary_filter_groups":["data"],
        "base_filter_groups":["scenario"]
      },
      filterGroups: defaultFilterGroups,
      summaryBar : defaultSummaryBar
    },
    initialActions: resultDefaultInitialActions
  }
};

dataViewConfigurations = {};
for (var k in resultDataViewConfigurations){
  dataViewConfigurations[k] = resultDataViewConfigurations[k];
}

