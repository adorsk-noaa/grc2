define([
       'backbone',
       'underscore',
       './filters',
],
function(Backbone, _, FiltersUtil){

  /*
   * Define custom functions.
   */
  var vectorDataLayerGetData = function(){
    console.log('vdlgd', this);
    var features = this.get('features');

    _.each(features.models, function(featureModel){
      var props = featureModel.get('properties');
      props.set({p1: props.get('p1') * this.get('query')});
    }, this);

  };

  var vectorDataLayerUpdateQuery = function(){
    console.log('vdluq', this);
    var setObj = {};
    _.each(['base', 'primary'], function(filterCategory){
      var attr = filterCategory + '_filters';
      setObj[attr] = this.get(attr);
    }, this);
    this.get('query').set(setObj);
  };


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
    var query = new Backbone.Model();
    layer.model.set('query', query);
    query.on('change', function(){
      layer.model.trigger('change:query change');
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
    });

    // Set updateQuery method.
    var updateQueryFn = layer.model.get('updateQuery');
    if (updateQueryFn){
      if (typeof updateQueryFn == 'string'){
        updateQueryFn = eval(updateQueryFn);
      }
    }
    else{
      updateQueryFn = vectorDataLayerUpdateQuery;
    }
    layer.model.updateQuery = updateQueryFn;

    // Set getData method.
    var getDataFn = layer.model.get('getData');
    if (getDataFn){
      if (typeof getDataFn == 'string'){
        getDataFn = eval(getDataFn);
      }
    }
    else{
      getDataFn = vectorDataLayerGetData;
    }
    layer.model.getData = getDataFn;
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
        console.log('here');
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
   * Define layer initializers.
   */
  var layerInitializers = {};
  var initializeLayer = function(layer, opts){
    console.log("initializeLayer", arguments);
    var initializer = layer.model.get('initializer');
    if (initializer){
      if (typeof initializer == 'string'){
        initializer = eval(initializer);
      }
    }
    else{
    }
    if (initializer){
      return initializer(layer, opts);
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
      layer.model.on('change:primary_filters change:base_filters', layer.model.updateQuery, layer.model);
      layer.model.on('change:query', layer.model.getData, layer.model);
      layer.model.updateQuery();
    },
    disconnect: function(layer, opts){
      console.log("disconnectDataLayer");
      layer.model.off(null, layer.model.updateQuery);
      layer.model.off(null, layer.model.getData);
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
    initializeLayer: initializeLayer,
    decorateLayer: decorateLayer,
    connectLayer: connectLayer
  };
  return exports;
});
