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
       "./requests",
],
function($, Backbone, _, _s, Util, SummaryBarView, FiltersUtil, FormatUtil, SerializationUtil, RequestsUtil){

  var createSummaryBar = function(opts){
    opts = opts || {};
    var summaryBarModel = opts.model || new Backbone.Model();
    var summaryBarView = new SummaryBarView({
      el: opts.el,
      model: summaryBarModel,
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

      var qField = this.get('quantity_field');
      if (! qField){
        return;
      }

      // Get the 'selected' query.
      var selected_inner_q = {
        'ID': 'inner',
        'SELECT_GROUP_BY': true,
      };
      RequestsUtil.extendQuery(selected_inner_q, qField.get('inner_query'));
      RequestsUtil.addFiltersToQuery(model, ['primary_filters', 'base_filters'], selected_inner_q);
      var selected_q = {
        'ID': 'selected',
        'FROM': [{'ID': 'inner', 'SOURCE': selected_inner_q}],
        'SELECT_GROUP_BY': true,
      };
      RequestsUtil.extendQuery(selected_q, qField.get('outer_query'));

      // Get the 'total' query.
      var total_inner_q = {
        'ID': 'inner',
        'SELECT_GROUP_BY': true,
      };
      RequestsUtil.extendQuery(total_inner_q, qField.get('inner_query'));
      RequestsUtil.addFiltersToQuery(model, ['base_filters'], total_inner_q);
      var total_q = {
        'ID': 'total',
        'FROM': [{'ID': 'inner', 'SOURCE': total_inner_q}],
        'SELECT_GROUP_BY': true,
      };
      RequestsUtil.extendQuery(total_q, qField.get('outer_query'));

      // Assemble request.
      var totals_request = {
        'ID': 'totals',
        'REQUEST': 'execute_queries',
        'PARAMETERS': {'QUERIES': [selected_q, total_q]}
      };

      var requests = [totals_request];

      var _this = this;
      var deferred = $.ajax({
        url: GeoRefine.app.requestsEndpoint,
        type: 'POST',
        data: {'requests': JSON.stringify(requests)},
        success: function(data, status, xhr){
          var results = data.results;
          var count_entity = qField.get('outer_query')['SELECT'][0];

          var selected = results['totals']['selected'][0][count_entity['ID']] || 0.0;
          var total = results['totals']['total'][0][count_entity['ID']] || 0.0;

          _this.set('data', {
            "selected": selected,
            "total": total
          });
        }
      });

      return deferred;
    };

    summaryBar.formatter = FormatUtil.GeoRefineFormatter;
    summaryBar.decorated = true;
  };

  var connectSummaryBar = function(opts){
    var summaryBar = opts.summaryBar;
    if (summaryBar.connected){
      return;
    }
    var filterGroups = opts.filterGroups;

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
    console.log('initializeSummaryBar');
    var summaryBar = opts.summaryBar;

    if (summaryBar.initialized){
      return;
    }

    var qField = opts.qField;
    var filterGroups = opts.filterGroups;

    decorateSummaryBar(opts);
    if (qField){
      summaryBar.model.set({quantity_field: qField }, {silent: true});
    }

    summaryBar.initialized = true;
  };

  var updateSummaryBarQuery = function(opts){
    _.each(['base', 'primary'], function(filterCategory){
      FiltersUtil.updateModelFilters(opts.summaryBar.model, filterCategory, opts);
    });
  };

  var actionHandlers =  {};

  // Initialize summary bar.  Sets filters, qField.
  actionHandlers.summaryBar_initialize = function(ctx, opts){
    initializeSummaryBar(ctx);
  };

  // Connect summaryBar.
  actionHandlers.summaryBar_connect = function(ctx, opts){
    connectSummaryBar(ctx);
  };

  // Update summary bar filters.
  actionHandlers.summaryBar_updateQuery= function(ctx, opts){
    updateSummaryBarQuery(ctx);
  };

  // getData action handler.
  actionHandlers.summaryBar_getData = function(ctx, opts){
    var summaryBar = ctx.summaryBar;
    if (summaryBar.model.getData){
      return summaryBar.model.getData(opts);
    }
  };

  // Define deserializeConfigState hook for facets editor.
  var deserializeConfigState = function(configState, deserializedState){
    if (! configState.summaryBar){
      return;
    }
    var summaryBarModel = new Backbone.Model(configState.summaryBar);
    deserializedState.summaryBar= summaryBarModel;
  };

  var exports = {
    createSummaryBar: createSummaryBar,
    connectSummaryBar: connectSummaryBar,
    initializeSummaryBar: initializeSummaryBar,
    actionHandlers: actionHandlers,
    deserializeConfigState: deserializeConfigState,
    //postInitializeHooks: [summaryBar_postInitialize],
  };
  return exports;
});
