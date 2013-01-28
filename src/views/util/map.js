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
       'MapView/views/map_editor',
       './colormap'
],
function($, Backbone, _, _s, Util, FiltersUtil, FormatUtil, SerializationUtil, RequestsUtil, MapEditorView, ColorMapUtil){

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

    console.log(mapEditorModel);
    var mapEditorView = new GRMapEditorView({
      el: opts.el,
      model: mapEditorModel
    });

    return mapEditorView;
  };

  var decorateMapEditor = function(mapEditor, opts){
    // Decorate the map layers.
    _.each(mapEditor.mapView.layerRegistry, function(layer){
      decorateLayer(layer, opts);
    });
  };

  var initializeMapEditor = function(mapEditor, opts){
    decorateMapEditor(mapEditor, opts);
    // Initialize layers.
    _.each(mapEditor.mapView.layerRegistry, function(layer){
      initializeLayer(layer, opts);
    });
  };

  // Define layer connectors 
  var layerConnectors = {};
  layerConnectors['default'] = {
    connect: function(layer){
      if (layer.model.get('source') == 'georefine_data_layer'){
        return connectLocalDataLayer(layer);
      }
    },
    disconnect: function(layer){
      if (layer.model.get('source') == 'georefine_data_layer'){
        return disconnectLocalDataLayer(layer);
      }
    }
  };

  layerConnectors['georefine_data_layer'] = {
    connect: function(layer){
      // Change query parameters when layer parameters change.
      layer.model.on('change:data_entity change:primary_filters change:base_filters', layer.model.updateQueryParameters, layer.model);
      // Change service url when query parameters change.
      layer.model.on('change:query_parameters', layer.model.updateServiceUrl, layer.model);
    },
    disconnect: function(layer){
      layer.model.off(null, layer.model.updateServiceUrl);
      layer.model.off(null, layer.model.updateQueryParameters);
    }
  };

  var getLayerConnector = function(layer, connect){
    var connector = layerConnectors[layer.model.get('source')];
    if (! connector){
      connector = layerConnectors['default'];
    }
    return (connect) ? connector.connect : connector.disconnect;
  };
  var connectLayer = function(layer){
    getLayerConnector(layer, true)(layer);
  };

  var disconnectLayer = function(layer){
    getLayerConnector(layer, false)(layer);
  };

  var connectMapEditor = function(mapEditor){
    // Connect enabled layers.
    _.each(mapEditor.mapView.layerRegistry, function(layer){
      if (! layer.model.get('disabled')){
        connectLayer(layer);
      }
    });

  };

  var disconnectMapEditor = function(mapEditor){
    // Disconnect layers.
    _.each(mapEditor.mapView.layerRegistry, function(layer){
      disconnectLayer(layer);
    });
  };



  // This function will be used by local data layers to set their
  // service url query parameters.
  // The 'this' object will be a layer model.
  var updateQueryParametersLocalDataLayerModel = function(){
    var model = this;

    // Get query.
    var inner_q = {
      'ID': 'inner',
      'SELECT_GROUP_BY': true
    };
    RequestsUtil.extendQuery(inner_q, model.get('inner_query'));
    RequestsUtil.addFiltersToQuery(model, ['primary_filters', 'base_filters'], inner_q);
    var outer_q = {
      'ID': 'outer',
      'FROM': [{'ID': 'inner', 'SOURCE': inner_q}]
    };
    RequestsUtil.extendQuery(outer_q, model.get('outer_query'));

    // Assemble parameters.
    var params = {
      'QUERY': outer_q,
      'GEOM_ID_ENTITY': model.get('geom_id_entity').toJSON(),
      'GEOM_ENTITY': model.get('geom_entity').toJSON(),
      'DATA_ENTITY': model.get('data_entity').toJSON()
    };

    // Set stringified parameters.
    var jsonParams = JSON.stringify(params);
    model.set('query_parameters', jsonParams);
  };

  // This function is used by local data layers to set their
  // service URLs on change.
  // The 'this' object will be a layer model.
  var updateServiceUrlLocalDataLayerModel = function(){
    var model = this;

    // Deferred object to trigger after url has been set.
    var deferred = $.Deferred();

    // Get shortened parameters key.
    $.ajax({
      url: GeoRefine.app.keyedStringsEndpoint + '/getKey/',
      type: 'POST',
      data: {'s': model.get('query_parameters')},
      // After we get the key back, add it as a query parameter.
      // and set the service_url.
      success: function(data, status, xhr){
        var url_params = [_s.sprintf('PARAMS_KEY=%s', data.key)];
        var service_url = GeoRefine.app.dataLayerEndpoint + '?' + url_params.join('&') + '&';

        // Resolve after load end.
        var onLoadEnd = function(){
          deferred.resolve();
          // Disconnect after.
          model.off('load:end', onLoadEnd);
        };
        model.on('load:end', onLoadEnd);

        // Set the url.
        model.set('service_url', service_url);
      },
      error: function(){
        deferred.reject();
      }
    });

    return deferred;
  };

  // Define layer decorators.
  var layerDecorators = {};
  layerDecorators['default'] = function(layer){

    // Set model to remove callbacks when remove is triggered.
    layer.model.on('remove', function(){ this.off(); }, layer.model);

    // Set default onDisabledChange function for model and 
    // connect to disabled events.
    layer.model.onDisabledChange = function(){
      // Tie visibility to disabled state.
      layer.model.set('visible', ! layer.model.get('disabled'));
      // Connect or disconnect layer.
      if (layer.model.get('disabled')){
        disconnectLayer(layer);
      }
      else{
        connectLayer(layer);
      }
    };
    layer.model.on('change:disabled', function(){
      layer.model.onDisabledChange();
    }, layer.model);
  };

  // Local getmap layer decorator.
  layerDecorators['georefine_data_layer'] = function(layer, opts){

    // Call default decorator.
    layerDecorators['default'](layer);

    // Listen for filter changes.
    _.each(['primary', 'base'], function(filterCategory){
      var groupIds = layer.model.get(filterCategory + "_filter_groups");
      _.each(groupIds, function(groupId){
        var filterGroup = opts.filterGroups[groupId];
        filterGroup.on('change:filters', function(){
          var filters = _.clone(layer.model.get(filterCategory + '_filters')) || {};
          filters[groupId] = filterGroup.getFilters();
          layer.model.set(filterCategory + '_filters', filters);
        }, layer.model);

        // Remove callback when layer is removed.
        layer.model.on('remove', function(){
          filterGroup.off(null, null, layer.model);
        });
      });
    });

    // Set updateQueryParameters method.
    layer.model.updateQueryParameters = updateQueryParametersLocalDataLayerModel;

    // Set updateServiceUrl method.
    layer.model.updateServiceUrl = updateServiceUrlLocalDataLayerModel;

    // Override onDisabledChange to set visible only after
    // service url has changed.
    layer.model.onDisabledChange = function(){
      // If disabled, then turn visibility off and disconnect.
      if (layer.model.get('disabled')){
        layer.model.set('visible', false);
        disconnectLayer(layer);
      }
      // Otherwise if enabled...
      else{
        // Update filters.
        _.each(['base', 'primary'], function(filterCategory){
          FiltersUtil.updateModelFilters(layer.model, filterCategory, opts);
        });
        // Manually call update query parameters.
        layer.model.updateQueryParameters();

        // If query parameters have changed, then
        // update the service url and connect.
        if (layer.model.hasChanged('query_parameters')){
          var deferred = layer.model.updateServiceUrl();
          deferred.then(function(){
            layer.model.set('visible', true);
            connectLayer(layer);
          });
        }
        // Otherwise just set visibility and connect.
        else{
          layer.model.set('visible', true);
          connectLayer(layer);
        }
      }
    }
  };

  var decorateLayer = function(layer, opts){
    var decorator = layerDecorators[layer.model.get('source')];
    if (! decorator){
      decorator = layerDecorators['default'];
    }
    decorator(layer, opts);
  };

  // Define layer initializers.
  var layerInitializers = {};
  layerInitializers['georefine_data_layer'] = function(layer, opts){
    // Set colorbar urls.
    var data_entity = layer.model.get('data_entity');

    // Assign colormap if none was specified.
    if (! data_entity.get('colormap')){
      var cmapId = data_entity.get('colormap_id') || 'ColorBrewer:Rd';
      data_entity.set('colormap', ColorMapUtil.CMAPS[cmapId]);
    }

    var colorbar_def = {
      vmin: 0,
      vmax: 1,
      num_bins: data_entity.get('num_bins') || 10,
      include_values: data_entity.get('colormap_include_values') || [],
      colormap: data_entity.get('colormap')
    }

    var json_def = JSON.stringify(colorbar_def);
    var colorbar_url = _s.sprintf(
      "%s?WIDTH=100&HEIGHT=100&CBAR=%s", 
      GeoRefine.app.colorBarEndpoint,
      encodeURIComponent(json_def)
    );

    data_entity.set('colorbar_url', colorbar_url);

    // Set filters.
    _.each(['base', 'primary'], function(filterCategory){
      FiltersUtil.updateModelFilters(layer.model, filterCategory, 
                                     {silent: true, filterGroups: opts.filterGroups});
    });
  };

  // Initialize a layer.
  var initializeLayer = function(layer, opts){
    // Initialize the layer.
    var initializer = layerInitializers[layer.model.get('source')];
    if (initializer){
      initializer(layer, opts);
    }
  };

  var actionHandlers = {};
  actionHandlers.mapEditor_initializeMapEditor = function(ctx, opts){
    initializeMapEditor(ctx.mapEditor, {filterGroups: ctx.filterGroups});
  };

  var exports = {
    createMapEditor: createMapEditor,
    actionHandlers: actionHandlers,
  };
  return exports;
});
