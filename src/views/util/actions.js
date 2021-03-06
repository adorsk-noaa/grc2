define([
	"jquery",
],
function($){

    var executeActions = function(ctx, actions){
      var deferred = $.Deferred();
      var actionsFunc = processActionQueue(ctx, actions);
      $.when(actionsFunc()).then(function(){
        deferred.resolve();
      });
      return deferred;
    };

    var processAction = function(ctx, action){
      // Convert an action definition to an action function.
      var handler = null;
      if ($.isFunction(action.handler)){
        handler = action.handler;
      }
      else{
        handler = ctx.actionHandlers[action.handler];
      }
      return function(){
        return handler(ctx, action.opts);
      };
    };

    // Convert an action queue definition to an action function.
    var processActionQueue = function(ctx, actionQueue){
        var _actionQueue = actionQueue;

        var queueAction = function(){
            var deferred = $.Deferred();

            // If there were child actions...
            if (_actionQueue.actions && _actionQueue.actions.length > 0){

                // Convert child actions into action functions.
                var actionFuncs = [];
                _.each(_actionQueue.actions, function(action){
                    var actionFunc = null;
                    if (action.type == 'action'){
                        actionFunc = processAction(ctx, action);
                    }
                    else if (action.type == 'actionQueue'){
                        actionFunc = processActionQueue(ctx, action);
                    }
                    actionFuncs.push(actionFunc);
                });

                // Remove actions that should only be executed once.
                _actionQueue.actions = _.filter(_actionQueue.actions, function(action){
                  return ! action.once;
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

    var exports = {
      executeActions: executeActions,
      processActionQueue: processActionQueue
    };

    return exports;

});

