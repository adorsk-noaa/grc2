if (! window.GeoRefine){
  GeoRefine = {};
}

if (! GeoRefine.config){
  GeoRefine.config = {};
}

// NORMALLY THIS WOULD BE IN THE CLIENT MAIN HTML PAGE.
var geoRefineBaseUrl = 'http://localhost:8000/georefine';
var projectId = 7;

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

  var defaultMap = new Backbone.Model({
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
    var fields = [
      {
      id: 'z',
      label: 'Z label',
      scaleType: 'diverging',
      colormapId: 'ColorBrewer:PiG',
      col: 'z',
    },
    ];

    var qFields = {};
    _.each(fields, function(field){
      var entityId = field.id + '_sum';
      qFields[field.id] = new Backbone.Model({
        id: field.id,
        label: field.label,
        format: '%.1H',
        inner_query: {
          SELECT: [{ID: entityId, EXPRESSION: 'func.sum(__result__' + field.col + ')'}]
        },
        outer_query: {
          SELECT: [{ID: entityId + '_sum', EXPRESSION: '__inner__' + entityId}]
        },
      });
    });

    var facetDefinitions = new Backbone.Collection([
      new Backbone.Model({
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
    }),
    new Backbone.Model({
      id: "energy",
      info: 'da info',
      info_link: "{{PROJECT_STATIC_DIR}}/sasipedia#energies/index.html",
      inner_query: {
        SELECT: [
          {EXPRESSION: "__result__energy_id", ID: "energy_id"}
        ],
        GROUP_BY: [
          {EXPRESSION: "__result__energy_id", ID: "energy_id"}
        ],
      },
      outer_query: {
        SELECT: [
          {EXPRESSION: "__energy__id", ID: "energy_id"},
          {EXPRESSION: "__energy__label", ID: "energy_label"}
        ],
        FROM: [
          {
          SOURCE: "energy",
          JOINS: [
            [
              "inner",
              [
                {TYPE: "ENTITY", EXPRESSION: "__inner__energy_id"}, "==", 
                {TYPE: "ENTITY", EXPRESSION: "__energy__id"} 
              ]
          ]
          ]
        }
        ],
        GROUP_BY: [
          {ID: "energy_label"},
          {ID: "energy_id"}
        ],
      },
      base_filter_groups: ["scenario"],
      label: "Energies",
      KEY: {
        LABEL_ENTITY: {ID: "energy_label"},
        QUERY: {
          SELECT: [
            {EXPRESSION: "__energy__id", ID: "energy_id"},
            {EXPRESSION: "__energy__label", ID: "energy_label"}
          ]
        },
        KEY_ENTITY: {EXPRESSION: "__result__energy_id", ID: "energy_id"}
      },
      type: "list",
      filter_entity: {TYPE: "ENTITY", EXPRESSION: "__result__energy_id", ID: "energy"},
      primary_filter_groups: ["data"]
    }),
    ]);

    var dataLayers = {};
    _.each(fields, function(field){
      var densityId = field.col + '_density';
      var propertyMappings = {};
      propertyMappings[field.id] = densityId;
      dataLayers[field.id] = new Backbone.Model({
        id: field.id,
        colormapId: field.colormapId,
        dataProp: field.id,
        layer_type: 'Vector',
        layer_category: 'data',
        source: 'georefine_data',
        label: field.label + ', per unit cell area',
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
        propertyMappings: propertyMappings,
        }),
      })
    });

    var dvConfigs = {};
    _.each(fields, function(field){
      dvConfigs[field.id] = new Backbone.Model({
        qField: qFields[field.id],
        filterGroups: ['scenario', 'data'],
        summaryBar: new Backbone.Model(),
        facetsEditor: new Backbone.Model({
          facetDefinitions: facetDefinitions,
          facets: new Backbone.Collection([])
        }),
        mapEditor: new Backbone.Model({
          map: defaultMap.clone(),
          base_layers: new Backbone.Collection(
            [baseLayers['world']]
          ) ,
          data_layers: new Backbone.Collection([dataLayers[field.id]])
        }),
      })
    });

    return dvConfigs;

  };
  /**************/

  GeoRefine.config.dataViewConfigurations = _.extend(
    {},
    generateResultsConfig()
  );

};
