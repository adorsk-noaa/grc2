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
    console.log('vdlgp', this);

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
        _.each(this.model.get('propertiesQuery').get('mappings'), function(mapping){
          var val = mapping.default;
          if (datum.data.properties && typeof datum.data.properties[mapping.source] != 'undefined'){
            val = datum.data.properties[mapping.source];
          }
          newProperties[mapping.target] = val;
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
    console.log('vdlupq', this);
    var setObj = {};
    var query = this.model.get('propertiesQuery');
    _.each(['base', 'primary'], function(filterCategory){
      var attr = filterCategory + '_filters';
      var newVal = this.model.get(attr);
      var oldVal = query.get(attr);
      if (! _.isEqual(newVal, oldVal)){
        setObj[attr] = this.model.get(attr);
      }
      else{
      }
    }, this);
    this.model.get('propertiesQuery').set(setObj);
  };

  var vectorDataLayerExecutePropertiesQuery = function(){
    console.log('vdledpq', this);
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

        // Flag features so that they do not get serialized.
        featureModel._noSerialize = true;

        features.add(featureModel);
      });
      deferred.resolve();
    }, this));

    queryDeferred.fail(function(){
      console.log('fail');
      deferred.reject(arguments);
    });

    return deferred;
  };

  var vectorDataLayerExecuteFeaturesQuery = function(){
    console.log('vdlefq', this);
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
    this.updatePropertiesQuery();
    var deferred = $.Deferred();
    var fDeferred = this.getFeatures();
    fDeferred.done(_.bind(function(){
      var pDeferred = this.getProperties();
      pDeferred.done(function(){
        deferred.resolve();
      });
      pDeferred.fail(function(){
        deferred.reject(arguments);
      });
    }, this));
    fDeferred.fail(function(){
      deferred.reject(arguments);
    });
    return deferred;
  }

  /*
   * Define layer decorators.
   */
  var layerDecorators = {}
  layerDecorators['default'] = function(layer, opts){
    // Set model to remove callbacks when remove is triggered.
    layer.model.on('remove', function(){ this.off(); }, layer.model);
    // Set default visibility change function.
    layer.onVisibilityChange = function(){
      if (! layer.model.get('properties').get('visibility')){
        disconnectLayer(layer, opts);
      }
      else{
        connectLayer(layer, opts);
      }
    };
    layer.model.get('properties').on('change:visibility', function(){
      layer.onVisibilityChange();
    }, layer.model);
  };

  layerDecorators['VectorData'] = function(layer, opts){
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
    },
    disconnect: function(layer, opts){
    }
  };

  layerConnectors['georefine_data'] = {
    connect: function(layer, opts){
      layer.model.on('change:primary_filters change:base_filters', layer.updatePropertiesQuery, layer);
      layer.model.on('change:propertiesQuery', layer.getProperties, layer);
      layer.updatePropertiesQuery();
    },
    disconnect: function(layer, opts){
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
    getLayerConnector(layer, true)(layer, opts);
  };

  var disconnectLayer = function(layer, opts){
    getLayerConnector(layer, false)(layer, opts);
  };

  var exports = {
    decorateLayer: decorateLayer,
    connectLayer: connectLayer
  };
  return exports;
});
