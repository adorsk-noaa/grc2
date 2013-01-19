define([
       "jquery",
       "backbone",
       "underscore",
       "_s",
       "Util",
       "./filters",
       "./format",
       "./serialization",
       "./requests",
       'MapView/views/map_editor'
],
function($, Backbone, _, _s, Util, FiltersUtil, FormatUtil, SerializationUtil, RequestsUtil, MapEditorView){

  var createMapEditor = function(opts){
    opts = opts || {};
    var mapEditorModel = opts.model || new Backbone.Model();

    // Customize map editor to add formatting to layer editors.
    var BaseMapEditor = MapEditorView;
    var GRMapEditorView = BaseMapEditor.extend({

      getLayerCollectionEditorClass: function(){
        var BaseCollectionEditor = BaseMapEditor.prototype.getLayerCollectionEditorClass.apply(this, arguments);
        var GRCollectionEditor = BaseCollectionEditor.extend({
          getLayerEditorClass: function(){
            var BaseLayerEditor = BaseCollectionEditor.prototype.getLayerEditorClass.apply(this, arguments);
            var GRLayerEditor = BaseLayerEditor.extend({
              formatter: function(){
                var orig = BaseLayerEditor.prototype.formatter.apply(this, arguments);
                return FormatUtil.GeoRefineTokenFormatter(orig);
              }
            });
            return GRLayerEditor;
          }
        });
        return GRCollectionEditor;
      }
    });

    var mapEditorView = new GRMapEditorView({
      el: opts.el,
      model: mapEditorModel
    });

    return mapEditorView;
  };

  var mapEditor_deserializeConfigState = function(configState, deserializedState){
    if (! configState.mapEditor){
      return;
    }
    var mapConfig = configState.mapEditor;
    var mapEditorModel = new Backbone.Model();

    // Create layer collections.
    var layerCollections = {};
    _.each(['data', 'base', 'overlay'], function(layerCategory){
      var layers = mapConfig[_s.sprintf('%s_layers', layerCategory)];
      var layerCollection = new Backbone.Collection();
      _.each(layers, function(layerDef){
        // Clone the layer definition.
        var layerDef = JSON.parse(JSON.stringify(layerDef));
        layerDef.layer_category = layerCategory;
        var layerModel = createLayerModelFromDef(mapConfig, layerDef);
        layerCollection.add(layerModel);
      });
      // Save the layer collection.
      layerCollections[layerCategory] = layerCollection;
    });

    var mapModel = new Backbone.Model(_.extend({
      layers: new Backbone.Collection(),
      options: {
        allOverlays: true,
        maxExtent: mapConfig.max_extent,
        restrictedExtent: mapConfig.max_extent,
        resolutions: mapConfig.resolutions,
        theme: null
      },
      graticule_intervals: [2]
    }, mapConfig));

    // Create Map Editor model.
    var mapEditorModel = new Backbone.Model({
      data_layers: layerCollections['data'],
      base_layers: layerCollections['base'],
      overlay_layers: layerCollections['overlay'],
      map: mapModel,
      type: 'map'
    });

    deserializedState.mapEditor = mapEditorModel;
  };

  var createLayerModelFromDef = function(mapConfig, layerDef){
    var layerModel = new Backbone.Model(_.extend(
      {}, mapConfig.default_layer_attributes, layerDef,
      {
        options: _.extend(
          {}, mapConfig.default_layer_options, layerDef.options),
        // Have layers include map's filter groups.
        primary_filter_groups: mapConfig.primary_filter_groups,
        base_filter_groups: mapConfig.base_filter_groups,
        // Set initial visible state per disabled state.
        visible: (layerDef.visible != null) ? layerDef.visible : ! layerDef.disabled
      }
    ));

    // Handle customizations for specific layer types.
    if (layerDef.source == 'georefine_data_layer'){
      _.each(['data_entity', 'geom_entity', 'geom_id_entity'], function(entity_attr){
        if (layerDef[entity_attr]){
          var entityModel = new Backbone.Model(layerDef[entity_attr]);
          layerModel.set(entity_attr, entityModel);
        }
      });
    }
    else if (layerDef.source == 'georefine_wms_layer'){
      var service_url = _s.sprintf("%s/%s/wms", GeoRefine.app.WMSLayerEndpoint, layerModel.id);
      layerModel.set('service_url', service_url);
    }
    return layerModel;
  };

  var exports = {
    createMapEditor: createMapEditor,
    deserializeConfigStateHooks: [
      mapEditor_deserializeConfigState
    ],
  };
  return exports;
});
