define([
       "jquery",
       "backbone",
       "underscore",
       "_s",
       "Util",
       "./filters",
       "./facets",
       "./summaryBar",
       "./map",
       "./serialization"
],
function($, Backbone, _, _s, Util, FiltersUtil, FacetsUtil, SummaryBarUtil, MapUtil, SerializationUtil){

  var hookModules = [FiltersUtil, FacetsUtil, SummaryBarUtil, MapUtil];

  // Registry for alterState hooks.
  var alterStateHooks = [];
  _.each(hookModules, function(module){
    _.each(module.alterStateHooks, function(hook){
      alterStateHooks.push(hook);
    });
  });

  // Add hook to add config to state.
  var config_alterState = function(state){
    state.config = SerializationUtil.serialize(GeoRefine.config, state.serializationRegistry);
  };
  alterStateHooks.push(config_alterState);

  // Serialize the app's state.
  var serializeState = function(){
    // Iniitialize state object.
    var state = { };
    // Initialize serialization registry.
    state.serializationRegistry = {};
    // Call hooks.
    _.each(alterStateHooks, function(hook){
      hook(state);
    });
    // Return the altered state object.
    return state;
  };

  // Deserialize serialized state.
  var deserializeState = function(serializedState){
    // Iniitialize deserialized registry.
    var deserializationRegistry = {};

    // Remove the serialized registry from the state.
    var serializationRegistry = serializedState.serializationRegistry;
    delete serializedState.serializationRegistry;

    // Deserialized the serialized state.
    var deserializedState = SerializationUtil.deserialize(serializedState, deserializationRegistry, serializationRegistry);

    return deserializedState;
  };

  // Registry for deserializeConfigState hooks.
  var deserializeConfigStateHooks = [];
  _.each(hookModules, function(module){
    _.each(module.deserializeConfigStateHooks, function(hook){
      deserializeConfigStateHooks.push(hook);
    });
  });

  // Add hook for deserializing quantity field.
  deserializeConfigStateHooks.push(function(configState, deserializedState){
    if (! configState.qField){
      return;
    }
    qFieldModel = new Backbone.Model(_.extend({}, configState.qField));
    deserializedState.qField = qFieldModel;
  });

  // Deserialize state from a config-style serialized state.
  // This is used for initializing the app when no state is passed.
  var deserializeConfigState = function(configState){
    // Initialize state object.
    var state = {};

    // Call hooks.
    _.each(deserializeConfigStateHooks, function(hook){
      hook(configState, state);
    });

    // Add initial actions from config.
    state.initialActionQueue = configState.initialActionQueue;

    return state;
  };

  var exports = {
    serializeState: serializeState,
    deserializeState: deserializeState,
    deserializeConfigState: deserializeConfigState,
  };

  return exports;
});
