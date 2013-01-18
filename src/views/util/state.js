define([
	"jquery",
	"backbone",
	"underscore",
	"_s",
	"Util",
	"./filters",
	"./facets",
	"./serialization"
],
function($, Backbone, _, _s, Util, filtersUtil, facetsUtil, serializationUtil){

    // Registry for alterState hooks.
    var alterStateHooks = [];
    _.each([filtersUtil, facetsUtil, summaryBarUtil], function(module){
        _.each(module.alterStateHooks, function(hook){
            alterStateHooks.push(hook);
        });
    });

    // Add hook to add config to state.
    var config_alterState = function(state){
        state.config = serializationUtil.serialize(GeoRefine.config, state.serializationRegistry);
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
        var deserializedState = serializationUtil.deserialize(serializedState, deserializationRegistry, serializationRegistry);

        return deserializedState;
    };

    // Registry for deserializeConfigState hooks.
    var deserializeConfigStateHooks = [];
    _.each([filtersUtil, facetsUtil, summaryBarUtil, dataViewsUtil], function(module){
        _.each(module.deserializeConfigStateHooks, function(hook){
            deserializeConfigStateHooks.push(hook);
        });
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

    // Convert an action definition to an action function.
    var processAction = function(action){
        // Get handler for action.
        var handler = null;
        if ($.isFunction(action.handler)){
            handler = action.handler;
        }
        else{
            handler = actionHandlers[action.handler];
        }
        // Return handler bound w/ action opts.
        return function(){
            return handler(action.opts); 
        };
    };

    var getAQStrings = function(actionQueue){
        var afs = [];
        var _actionQueue = actionQueue;
        _.each(_actionQueue.actions, function(action){
            if (action.type == 'action'){
                afs.push(action.handler);
            }
            else if (action.type == 'actionQueue'){
                afs.push(getAQStrings(action));
            }
        });
        return afs;
    };

    // Convert an action queue definition to an action function.
    var processActionQueue = function(actionQueue){
        var _id = (Math.random() * 100).toPrecision(3);

        var _actionQueue = actionQueue;

        var queueAction = function(){
            var deferred = $.Deferred();

            // If there were child actions...
            if (_actionQueue.actions.length > 0){
                // Convert child actions into action functions.
                var actionFuncs = [];
                _.each(_actionQueue.actions, function(action){
                    var actionFunc = null;
                    if (action.type == 'action'){
                        actionFunc = processAction(action);
                    }
                    else if (action.type == 'actionQueue'){
                        actionFunc = processActionQueue(action);
                    }
                    actionFuncs.push(actionFunc);
                });


                // Deferred representing deferred form final child action.
                var finalDeferred = null;

                // If async, execute actions in parallel.
                if (_actionQueue.async){
                    var deferreds = [];
                    _.each(actionFuncs, function(actionFunc){
                        deferreds.push(actionFunc());
                    });
                    finalDeferred = $.when.apply($, deferreds);
                }

                // Otherwise, execute actions in sequence.
                else{
                    // Initialize with first action.
                    finalDeferred = $.when(actionFuncs[0]());
                    // Trigger subsequent subactions in sequence.
                    for (var i = 1; i < actionFuncs.length; i++){
                        // We wrap inside a function to avoid closure conflicts.
                        (function(_i){
                            finalDeferred = finalDeferred.pipe(function(){
                                return $.when(actionFuncs[_i]());
                            });
                        })(i);
                    }
                }

                // When final deferred is complete, resolve.
                finalDeferred.done(function(){
                    deferred.resolve();
                });
            }
            // If there were no child actions, resolve immediately.
            else{
                deferred.resolve();
            }

            return deferred;
        };

        return queueAction;
    };

    // Objects to expose.
    var stateUtil = {
        serializeState: serializeState,
        deserializeState: deserializeState,
        deserializeConfigState: deserializeConfigState,
        processActionQueue: processActionQueue
    };

    return stateUtil;
});
