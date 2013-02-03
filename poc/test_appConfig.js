if (! window.GeoRefine){
  GeoRefine = {};
}

if (! GeoRefine.config){
  GeoRefine.config = {};
}

// NORMALLY THIS WOULD BE IN THE CLIENT MAIN HTML PAGE.
var geoRefineBaseUrl = 'http://localhost:8000/georefine';
var projectId = window.PROJECT_ID || 112;

GeoRefine.app = {
  requestsEndpoint: geoRefineBaseUrl + '/projects/execute_requests/' + projectId + '/',
  WMSLayerEndpoint: geoRefineBaseUrl + '/projects/' + projectId + 'layer',
  colorBarEndpoint: geoRefineBaseUrl + '/projects/colorbar/',
  dataLayerEndpoint: geoRefineBaseUrl + '/projects/get_map/' + projectId + '/',
  keyedStringsEndpoint: geoRefineBaseUrl + '/ks'
};

GeoRefine.initialize = function($, Backbone, _, _s){

  /********
   * Shared objects.
   */
  var baseLayers = {
    'world': new Backbone.Model({
      layer_type:"WMS",
      label:"Layer 0",
      disabled:false,
      service_url: 'http://vmap0.tiles.osgeo.org/wms/vmap0',
      params: {"layers": 'basic'},
      id:"world",
    })
  };

  var overlayLayers = {
    graticule: new Backbone.Model({
      layer_type:"Graticule",
      label:"Lat/Lon Grid",
      disabled: true,
    })
  };

  var defaultMap = new Backbone.Model({
    maxExtent: [-180, -90, 180, 90],
    extent: [-70, 30, -65, 50],
    resolutions:[0.025,0.0125,0.00625,0.003125,0.0015625,0.00078125],
    options: {
      allOverlays: true
    },
    default_layer_options: {
      transitionEffect:"resize",
      tileSize:{"w":1024, "h":1024},
      buffer:0
    },
    default_layer_attributes:{
      disabled: true,
      reorderable: true
    },
  });

  var cellsFeatureQuery = new Backbone.Model({
    ID: 'features',
    SELECT: [
      {'ID': 'fid', EXPRESSION: '__cell__id'},
      {'ID': 'geometry', EXPRESSION: 'func.AsGeoJSON(__cell__geom)'},
    ]
  });

  var cellKeyEntity = new Backbone.Model({
    KEY_ENTITY: {
      EXPRESSION: '__result__cell_id',
      ID: 'cell_id',
      ALL_VALUES: true
    },
    QUERY: {
      ID: 'kq',
      SELECT: [
        {ID: 'cell_id', EXPRESSION: '__cell__id'},
      ]
    }
  });
  /**************/


  /**************/
  var generateResultsConfig = function(){
    var resultFields = [
      {
      id: 'a',
      label: 'A label',
      scale_type: 'sequential',
      colormapId: 'ColorBrewer:Rd',
    },
    {
      id: 'y',
      label: 'Y label',
      scale_type: 'sequential',
      colormapId: 'ColorBrewer:Pi',
    },
    {
      id: 'x',
      label: 'X label',
      scale_type: 'sequential',
      colormapId: 'ColorBrewer:Br',
    },
    {
      id: 'z',
      label: 'Z label',
      scale_type: 'diverging',
      colormapId: 'ColorBrewer:PiG',
    },
    {
      id: 'znet',
      label: 'Znet label',
      scale_type: 'diverging',
      colormapId: 'ColorBrewer:Rd:Bu',
    },
    ];

    var qFields = {};
    _.each(resultFields, function(field){
      if (! field.col){
        field.col = field.id;
      }
      var modelOpts = {};
      var entityId = field.id + '_sum';
      $.extend(true, modelOpts, {
        id: field.id,
        label: field.label,
        format: '%.1H',
        inner_query: {
          SELECT: [{ID: entityId, EXPRESSION: 'func.sum(__result__' + field.col + ')'}]
        },
        outer_query: {
          SELECT: [{ID: entityId + '_sum', EXPRESSION: '__inner__' + entityId}]
        },
      }, field);
      qFields[field.id] = new Backbone.Model(modelOpts);
    });

    var facetDefinitions = new Backbone.Collection();

    // Timestep facet.
    facetDefinitions.add(new Backbone.Model({
      id: 'time',
      label: 'Time',
      noClose: true,
      primary_filter_groups: ['scenario'],
      type: 'timeSlider',
      value_type: 'numeric',
      filter_entity: {
        EXPRESSION: '__result__t',
        ID: 't',
        TYPE: 'ENTITY'
      },
      KEY: {
        KEY_ENTITY: {EXPRESSION: '__result__t', ID: 't'},
        QUERY: {
          SELECT: [{EXPRESSION: '__time__id', 'ID': 't'}]
        }
      },
    }));

    // Generic result facets.
    var facetFields = [
    {
      id: 'substrate',
      sasipediaId: 'substrates',
      info: 'substrates info',
      label: "Substrates",
    },
      {
      id: 'energy',
      sasipediaId: 'energies',
      info: 'energy info',
      label: "Energies",
    },
    {
      id: 'feature',
      sasipediaId: 'features',
      info: 'feature info',
      label: "Features",
    },
    {
      id: 'feature_category',
      sasipediaId: 'feature_categories',
      info: 'feature category info',
      label: "Feature Categories",
    },
    {
      id: 'gear',
      sasipediaId: 'gears',
      info: 'gear info',
      label: "Gear",
    },
    ];

    _.each(facetFields, function(field){
      var modelOpts = {};
      var idId = field.id + '_id';
      var labelId = field.id + '_label';
      var resultColExpression = '__result__' + idId;
      var idColExpression = '__' + field.id + '__id';
      var labelColExpression = '__' + field.id + '__label';
      $.extend(true, modelOpts, {
        info: 'da info',
        info_link: "{{PROJECT_STATIC_DIR}}/sasipedia#" + field.sasipediaId + "/index.html",
        inner_query: {
          SELECT: [
            {EXPRESSION: resultColExpression, ID: idId}
          ],
          GROUP_BY: [
            {ID: idId}
          ],
        },
        outer_query: {
          SELECT: [
            {EXPRESSION: idColExpression, ID: idId},
            {EXPRESSION: labelColExpression, ID: labelId}
          ],
          FROM: [
            {
            SOURCE: field.id,
            JOINS: [
              [
                "inner",
                [
                  {TYPE: "ENTITY", EXPRESSION: "__inner__" + idId}, "==",
                  {TYPE: "ENTITY", EXPRESSION: idColExpression}
                ]
            ]
            ]
          }
          ],
          GROUP_BY: [
            {ID: labelId},
            {ID: idId}
          ],
        },
        KEY: {
          LABEL_ENTITY: {ID: labelId},
          QUERY: {
            SELECT: [
              {EXPRESSION: idColExpression, ID: idId},
              {EXPRESSION: labelColExpression, ID: labelId}
            ]
          },
          KEY_ENTITY: {EXPRESSION: resultColExpression, ID: idId}
        },
        label: field.label,
        type: "list",
        filter_entity: {TYPE: "ENTITY", EXPRESSION: resultColExpression, ID: field.id},
        base_filter_groups: ["scenario"],
        primary_filter_groups: ["data"]
      }, field);

      facetDefinitions.add(new Backbone.Model(modelOpts));

    });


    var dataLayers = {};
    _.each(resultFields, function(field){
      var densityId = field.col + '_density';
      var propertyMappings = {};
      propertyMappings[densityId] = densityId;
      dataLayers[field.id] = new Backbone.Model({
        id: field.id,
        colormapId: field.colormapId,
        scale_type: field.scale_type,
        dataProp: densityId,
        layer_type: 'Vector',
        layer_category: 'data',
        source: 'georefine_data',
        label: field.label + ', per unit cell area',
        vmin: 0,
        vmax: 1,
        disabled: false,
        expanded: true,
        base_filter_groups: ['scenario'],
        primary_filter_groups: ['data'],
        featuresQuery: cellsFeatureQuery,
        propertiesQuery: new Backbone.Model({
          quantity_field: new Backbone.Model({
            inner_query: {
            SELECT: [
              {ID: field.col + '_sum', EXPRESSION: 'func.sum(__result__' + field.col + ')'},
              {ID: 'cell_id', EXPRESSION: '__result__cell_id'}
            ],
            GROUP_BY: [
              {ID: 'cell_id'}
            ]
          },
          outer_query: {
            SELECT: [
              {ID: field.col + '_density', EXPRESSION: '__inner__' + field.col + '_sum/__cell__area'},
              {ID: 'cell_id', EXPRESSION: '__cell__id'},
            ],
            FROM: [
              {
              SOURCE: 'cell',
              JOINS: [
                ['inner', [{TYPE: 'ENTITY', EXPRESSION: '__inner__cell_id'}, 
                  '==', {TYPE: 'ENTITY', EXPRESSION: '__cell__id'}, ] ]
              ]
            }
            ]
          },
          }),
          KEY: cellKeyEntity,
          mappings: propertyMappings,
        }),
        styleMap: new Backbone.Collection(
          [
            new Backbone.Model({
          id: 'default', 
          strokeWidth: 0, 
        })
        ])
      });
    });

    var initialTimestepFacetActionQueue = {
      "async": false,
      "type": "actionQueue",
      "once": true,
      "actions": [
        {
        "handler": "facets_facet_add",
        "type": "action",
        "opts": {
          "category": "base",
          "fromDefinition": true,
          "definitionId": "time",
          "facetId": "time",
        }
      },
      {
        "handler": "facets_facet_initialize",
        "type": "action",
        "opts": {
          "category": "base",
          "id": "time"
        }
      },
      {
        "handler": "facets_facet_connect",
        "type": "action",
        "opts": {
          "category": "base",
          "id": "time"
        }
      },
      {
        "handler": "facets_facet_getData",
        "type": "action",
        "opts": {
          "category": "base",
          "id": "time"
        }
      },
      {
        "handler": "facets_facet_setSelection",
        "type": "action",
        "opts": {
          "category": "base",
          "index": 1,
          "id": "time"
        }
      }
      ]
    };

    var initialSummaryBarActionQueue = {
      "async": false,
      "type": "actionQueue",
      "once": true,
      "actions": [
        {
        "handler": "summaryBar_initialize",
        "type": "action"
      },
      {
        "handler": "summaryBar_connect",
        "type": "action"
      },
      {
        "handler": "summaryBar_updateQuery",
        "type": "action"
      },
      {
        "handler": "summaryBar_getData",
        "type": "action",
      }
      ]
    };

    var mapActionQueue = {
      "async": false,
      "type": "actionQueue",
      "actions": [
        {
        "type": "action",
        "handler": "mapEditor_initializeMapEditor"
      },
      ]
    };

    var summaryBarActionQueue = {
      "async": false,
      "type": "actionQueue",
      "actions": [
        {
        "handler": "summaryBar_initialize",
        "type": "action"
      },
      {
        "handler": "summaryBar_connect",
        "type": "action"
      },
      ]
    };

    var facetsEditorActionQueue = {
      "async": false,
      "type": "actionQueue",
      "actions": [
        {
        "type": "action",
        "handler": "facetsEditor_connect"
      },
      ]
    };

    var initialActions = {
      async: false,
      type: "actionQueue",
      actions: [
        initialTimestepFacetActionQueue,
        initialSummaryBarActionQueue,
        summaryBarActionQueue,
        facetsEditorActionQueue,
        mapActionQueue,
      ]
    };

    var dvConfigs = {};
    _.each(resultFields, function(field){
      dvConfigs[field.id] = new Backbone.Model({
        qField: qFields[field.id],
        filterGroups: ['scenario', 'data'],
        summaryBar: new Backbone.Model({
          base_filter_groups: ['scenario'],
          primary_filter_groups: ['data'],
        }),
        facetsEditor: new Backbone.Model({
          facetDefinitions: facetDefinitions,
          facets: new Backbone.Collection([])
        }),
        mapEditor: new Backbone.Model({
          map: defaultMap.clone(),
          base_layers: new Backbone.Collection(
            [baseLayers['world']]
          ) ,
          overlay_layers: new Backbone.Collection(
            [
              dataLayers[field.id],
              overlayLayers.graticule,
          ])
        }),
        initialActions: initialActions,
      })
    });

    return dvConfigs;

  };
  /**************/

  GeoRefine.config.dataViewConfigurations = _.extend(
    {},
    generateResultsConfig()
  );

  GeoRefine.config.floatingDataViews = {};
  GeoRefine.config.floatingDataViews.defaults = {
    width: 800,
    height: 600,
  };

};
