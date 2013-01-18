define([
       'backbone',
       'underscore',
       './SummaryBar',
       './util/actions',
       './util/facets',
       './util/summaryBar',
       './util/state',
       'text!./templates/DataView.html'
],
function(Backbone, _, SummaryBarView, ActionsUtil, FacetsUtil, SummaryBarUtil, StateUtil, DataViewTemplate){

  var DataView = Backbone.View.extend({

    initialize: function(opts){
      var _this = this;
      opts = _.extend({
        config: {}
      }, opts);

      opts.config = _.extend({
        defaultInitialState: {}
      }, opts.config);

      $(_this.el).addClass('dataview');

      _this.config = _this.model.get('config');

      this.on('ready', this.onReady, this);

      // Deserialize state.
      var stateDeferred = $.Deferred();
      if (opts.serializedState){
        _this.state = StateUtil.deserializeState(opts.serializedState);
        stateDeferred.resolve();
      }
      else{
        _this.state = StateUtil.deserializeConfigState(_this.config.defaultInitialState);
        stateDeferred.resolve();
      }

      // When stateDeferred resolves, continue...
      stateDeferred.then(function(){
        _this.initialRender();

        _this.setupFilterGroups();
        _this.setupWidgets();
        _this.setupInitialState();

        _this.setupActionHandlers();

        var actionsDeferred = _this.processActions(_this.config.initialActions);
        actionsDeferred.done(function(){
          console.log("done with actions");
        });
      });
    },

    initialRender: function(){
      $(this.el).html(_.template(DataViewTemplate, {}));
    },

    setupFilterGroups: function(){
      var _this = this;
      // Initialize filter groups...maybe move this into state deserialize
      // later.
      _this.filterGroups = {};
      _.each(_this.config.filterGroups, function(filterGroupDef){
        var filterGroup = new Backbone.Collection();
        _this.filterGroups[filterGroupDef.id] = filterGroup;
      });

      _.each(_this.filterGroups, function(filterGroup, filterGroupId){
        // Define getFilters method for each group.
        filterGroup.getFilters = function(){
          var filters = [];
          _.each(filterGroup.models, function(model){
            var modelFilters = model.get('filters');
            if (modelFilters){
              filters.push({
                'source': {
                  'type': model.getFilterType ? model.getFilterType() : null,
                  'id': model.id
                },
                'filters': modelFilters
              });
            }
          });
          return filters;
        };

        // Add registration function to set id on new members, for
        // determining filter sources w/in the group.
        filterGroup.on('add', function(model){
          var filterGroupIds = model.get("filterGroupIds") || {};
          if (! filterGroupIds[filterGroupId]){
            filterGroupIds[filterGroupId] = Date.now() + Math.random();
          }
          model.set("filterGroupIds", filterGroupIds);
        });
      });
    },

    setupWidgets: function(){
      this.setupFacetsEditor();
      this.setupSummaryBar();
      this.setupMap();
    },

    setupFacetsEditor: function(){
      this.facetsEditor = FacetsUtil.createFacetsEditor({
        model: this.state.facetsEditor,
        config: this.config.facets,
        el: $('.facets-editor', this.el),
      });
    },

    setupSummaryBar: function(){
      this.summaryBar = SummaryBarUtil.createSummaryBar({
        model: this.state.summaryBar,
        el: $('.summary-bar', this.el)
      });
    },

    setupMap: function(){
      console.log('setupMap');
    },

    setupInitialState: function(){
      console.log('setupInitialState');
    },

    resize: function(){
      this.facetsEditor.trigger('resize');
    },

    onReady: function(){
      this.resize();
    },

    processActions: function(actions){
      var deferred = $.Deferred();
      var ctx = {
        dataView: this,
        handlers: this.actionHandlers,
      };
      var actionsFunc = ActionsUtil.processActionQueue(ctx, actions);

      $.when(actionsFunc()).then(function(){
        deferred.resolve();
      });

      return deferred;
    },

    getFacetView: function(opts){
      // Helper function get facet view form facet editor.
      var facetCollection = this.facetsEditor.subViews.facets;
      return facetCollection.registry[opts.id];
    },

    setupActionHandlers: function(){
      var _this = this;
      _this.actionHandlers = {};
      _.each([FacetsUtil, SummaryBarUtil], function(module){
        if (module.actionHandlers){
          _.extend(_this.actionHandlers, module.actionHandlers);
        }
      }, _this);
    }


  });

  return DataView;
});

