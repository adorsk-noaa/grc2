define([
       'backbone',
       'underscore',
       './filters',
       './requests',
       "MapView/models/Feature",
],
function(Backbone, _, FiltersUtil, RequestsUtil, FeatureModel){

  /*
   * Define custom functions.
   */
  var vectorDataLayerGetProperties = function(){
    console.log('vdlgd', this);

    var features = this.model.get('features');

    var deferred = $.when(this.executePropertiesQuery());
    deferred.done(_.bind(function(data){
      if (! data || ! data.results || ! data.results.keyed_results){
        return;
      }
      _.each(data.results.keyed_results, function(datum){
        var featureModel = features.get(datum.key);
        if (! featureModel){
          return;
        }
        var newProperties = {};
        _.each(this.model.get('propertiesQuery').get('mappings'), function(col, prop){
          if (datum.data.properties && typeof datum.data.properties[col] != 'undefined'){
            newProperties[prop] = datum.data.properties[col];
          }
        }, this);
        featureModel.get('properties').set(newProperties);
      }, this);
    }, this));

    deferred.fail(function(){
      console.log('fail');
    });

    return deferred;
  };

  var vectorDataLayerUpdatePropertiesQuery = function(){
    console.log('vdluq', this);
    var setObj = {};
    _.each(['base', 'primary'], function(filterCategory){
      var attr = filterCategory + '_filters';
      setObj[attr] = this.model.get(attr);
    }, this);
    this.model.get('propertiesQuery').set(setObj);
  };

  var vectorDataLayerExecutePropertiesQuery = function(){
    console.log('vedq', this);
    var query = this.model.get('propertiesQuery');
    var qfield  = query.get('quantity_field');
    if (! qfield){
      return;
    }

    // Copy the key entity.
    var key = JSON.parse(JSON.stringify(query.get('KEY')));

    // Assemble the queries.
    var inner_q = RequestsUtil.makeKeyedInnerQuery(query, key, ['base_filters', 'primary_filters']);
    var outer_q = RequestsUtil.makeKeyedOuterQuery(query, key, inner_q, 'properties');

    // Assemble the keyed result parameters.
    var keyed_results_parameters = {
      "KEY": key,
      "QUERIES": [outer_q]
    };

    // Assemble keyed query request.
    var keyed_query_request = {
      'ID': 'keyed_results',
      'REQUEST': 'execute_keyed_queries',
      'PARAMETERS': keyed_results_parameters
    };
    var requests = [keyed_query_request];

    // Start the request and save the deferred object.
    var deferred = $.ajax({
      url: GeoRefine.app.requestsEndpoint,
      type: 'POST',
      data: {'requests': JSON.stringify(requests)},
    });
    return deferred;
  };

  var vectorDataLayerGetFeatures = function(){
    var features = this.model.get('features');

    var deferred = $.Deferred();

    var queryDeferred = this.executeFeaturesQuery();
    queryDeferred.done(_.bind(function(data){
      _.each(data.results.featuresResults.features, function(datum){
        var featureModel = new FeatureModel({
          id: datum.fid,
          geometry: JSON.parse(datum.geometry)
        });
        features.add(featureModel);
      });
      deferred.resolve();
    }, this));

    queryDeferred.fail(function(){
      console.log('fail');
      deferred.reject();
    });

    return deferred;
  };

  var vectorDataLayerExecuteFeaturesQuery = function(){
    console.log('vdefq', this);
    var featuresQuery = this.model.get('featuresQuery');

    // Assemble query request.
    var query_request = {
      'ID': 'featuresResults',
      'REQUEST': 'execute_queries',
      'PARAMETERS': {QUERIES: [featuresQuery.toJSON()]}
    };
    var requests = [query_request];

    // Start the request and save the deferred object.
    var deferred = $.ajax({
      url: GeoRefine.app.requestsEndpoint,
      type: 'POST',
      data: {'requests': JSON.stringify(requests)},
    });
    return deferred;
  };

  var vectorDataLayerInitializeLayer = function(){
    console.log("vdlil");
    var featuresDeferred = this.getFeatures();
    return featuresDeferred;
  }

  /*
   * Define layer decorators.
   */
  var layerDecorators = {}
  layerDecorators['default'] = function(layer, opts){
    // Set model to remove callbacks when remove is triggered.
    layer.model.on('remove', function(){ this.off(); }, layer.model);
    // Set default onDisabledChange function for model and 
    // connect to disabled events.
    layer.model.onDisabledChange = function(){
      layer.model.set('visible', ! layer.model.get('disabled'));
      if (layer.model.get('disabled')){
        disconnectLayer(layer, opts);
      }
      else{
        connectLayer(layer, opts);
      }
    };
    layer.model.on('change:disabled', function(){
      console.log('change:disabled');
      layer.model.onDisabledChange();
    }, layer.model);
  };

  layerDecorators['VectorData'] = function(layer, opts){
    console.log("decorate VectorData Layer");
    layerDecorators['default'](layer, opts);

    // Initialize query.
    if (! layer.model.get('propertiesQuery')){
      layer.model.set('propertiesQuery', new Backbone.Model());
    }
    layer.model.get('propertiesQuery').on('change', function(){
      layer.model.trigger('change:propertiesQuery change');
    });

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

        layer.model.on('remove', function(){
          filterGroup.off(null, null, layer.model);
        });
      });
      // Get current filters.
      FiltersUtil.updateModelFilters(layer.model, filterCategory, opts);
    });

    // Default methods.
    var defaultMethods = {
      initializeLayer:  vectorDataLayerInitializeLayer,
      updatePropertiesQuery: vectorDataLayerUpdatePropertiesQuery,
      getProperties: vectorDataLayerGetProperties,
      executePropertiesQuery: vectorDataLayerExecutePropertiesQuery,
      getFeatures: vectorDataLayerGetFeatures,
      executeFeaturesQuery: vectorDataLayerExecuteFeaturesQuery,
    };

    _.each(defaultMethods, function(defaultMethod, methodId){
      var method = layer.model.get(methodId);
      if (method){
        if (typeof method == 'string'){
          method = eval(method);
        }
      }
      else{
        method = defaultMethod;
      }
      layer[methodId] = method;
    });
  }

  var decorateLayer = function(layer, opts){
    console.log('decorateLayer', arguments);
    var decorator = layer.model.get('decorator');
    if (decorator){
      if (typeof decorator == 'string'){
        decorator = eval(decorator);
      }
    }
    else{
      var src = layer.model.get('source');
      var type = layer.model.get('layer_type');
      if (src == 'georefine_data' && type == 'Vector'){
        decorator = layerDecorators['VectorData'];
      }
      else{
        decorator = layerDecorators['default'];
      }
    }

    if (decorator){
      decorator(layer, opts);
    }
  };


  /*
   * Define layer connectors.
   */
  var layerConnectors = {};
  layerConnectors['default'] = {
    connect: function(layer, opts){
      console.log('connectDefault');
    },
    disconnect: function(layer, opts){
      console.log("disconnectDefault");
    }
  };

  layerConnectors['georefine_data'] = {
    connect: function(layer, opts){
      console.log("connectDataLayer");
      layer.model.on('change:primary_filters change:base_filters', layer.updatePropertiesQuery, layer);
      layer.model.on('change:propertiesQuery', layer.getProperties, layer);
      layer.updatePropertiesQuery();
    },
    disconnect: function(layer, opts){
      console.log("disconnectDataLayer");
      layer.model.off(null, layer.updatePropertiesQuery);
      layer.model.off(null, layer.getProperties);
    }
  };

  var getLayerConnector = function(layer, connect){
    var connectors = layer.model.get('connectors');
    if (connectors){
      if (typeof connectors == 'string'){
        connectors = eval(connectors);
      }
    }
    else{
      var src = layer.model.get('source');
      connectors = layerConnectors[src];
    }
    if (! connectors){
      connectors = layerConnectors['default'];
    }
    return (connect) ? connectors.connect : connectors.disconnect;
  };

  var connectLayer = function(layer, opts){
    console.log('connectLayer');
    getLayerConnector(layer, true)(layer, opts);
  };

  var disconnectLayer = function(layer, opts){
    console.log('disconnectLayer');
    getLayerConnector(layer, false)(layer, opts);
  };

  var exports = {
    decorateLayer: decorateLayer,
    connectLayer: connectLayer
  };
  return exports;
});
