define([
       "jquery",
       "backbone",
       "underscore",
       "_s",
       "Util",
       "../SummaryBar",
       "./filters",
       "./format",
       "./serialization",
],
function($, Backbone, _, _s, Util, SummaryBarView, FiltersUtil, FormatUtil, SerializationUtil){

  var createSummaryBar = function(opts){
    opts = opts || {};
    var summaryBarModel = opts.model || new Backbone.Model();
    var summaryBarView = new SummaryBarView({
      el: opts.el,
      model: summaryBarModel
    });

    return summaryBarView;
  };

  var decorateSummaryBar = function(opts){
    var summaryBar = opts.summaryBar;
    if (summaryBar.decorated){
      return;
    }

    var model = summaryBar.model;

    // Define getData function.
    model.getData = function(){
      var deferred = $.Deferred();
      deferred.resolve();
      return deferred;
    };

    summaryBar.formatter = FormatUtil.GeoRefineFormatter;
    summaryBar.decorated = true;
  };

  var connectSummaryBar = function(opts){
    var summaryBar = opts.summaryBar;
    var filterGroups = opts.filterGroups;

    if (summaryBar.connected){
      return;
    }

    // Listen for filter changes.
    _.each(['primary', 'base'], function(filterCategory){
      var groupIds = summaryBar.model.get(filterCategory + "_filter_groups");
      _.each(groupIds, function(filterGroupId){
        var filterGroup = filterGroups[filterGroupId];
        filterGroup.on('change:filters', function(){
          var filters = _.clone(summaryBar.model.get(filterCategory + '_filters')) || {};
          filters[filterGroupId] = filterGroup.getFilters();
          summaryBar.model.set(filterCategory + '_filters', filters);
        });
        // Remove callback when model is removed.
        summaryBar.model.on('remove', function(){
          filterGroup.off(null, null, this);
        }, summaryBar.model);
      });
    });

    // Get data when parameters change.
    if (summaryBar.model.getData){
      summaryBar.model.on('change:primary_filters change:base_filters quantity_field', function(){
        summaryBar.model.getData();
      });
    }

    // Set connected.
    summaryBar.connected = true;
  };

  var initializeSummaryBar = function(opts){
    var summaryBar = opts.summaryBar;
    var qField = opts.qField;

    decorateSummaryBar({summaryBar: summaryBar});
    if (qField){
      summaryBar.model.set({quantity_field: qfield }, {silent: true});
    }

    // Set filters.
    _.each(['base', 'primary'], function(filterCategory){
      FiltersUtil.updateModelFilters(summaryBar.model, filterCategory, {silent: true});
    });
  };

  var actionHandlers =  {};

  // Initialize summary bar.  Sets filters, qfield.
  actionHandlers.summaryBar_initialize = function(ctx, opts){
    var summaryBar = ctx.dataView.summaryBar;
    initializeSummaryBar({summaryBar: summaryBar});
  };

  // Connect summaryBar.
  actionHandlers.summaryBar_connect = function(ctx, opts){
    connectSummaryBar({
      summaryBar: ctx.dataView.summaryBar,
      filterGroups: ctx.dataView.filterGroups
    })
  };

  // getData action handler.
  actionHandlers.summaryBar_getData = function(ctx, opts){
    var summaryBar = ctx.dataView.summaryBar;
    if (summaryBar.model.getData){
      return summaryBar.model.getData(opts);
    }
  };

  var exports = {
    createSummaryBar: createSummaryBar,
    connectSummaryBar: connectSummaryBar,
    initializeSummaryBar: initializeSummaryBar,
    actionHandlers: actionHandlers
  };
  return exports;
});
