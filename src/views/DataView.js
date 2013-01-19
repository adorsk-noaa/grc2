define([
       'backbone',
       'underscore',
       './SummaryBar',
       './util/actions',
       './util/facets',
       './util/filters',
       './util/summaryBar',
       './util/state',
       './util/map',
       'text!./templates/DataView.html'
],
function(Backbone, _, SummaryBarView, ActionsUtil, FacetsUtil, FiltersUtil, SummaryBarUtil, StateUtil, MapUtil, DataViewTemplate){

  var UtilModules = [ActionsUtil, FacetsUtil, FiltersUtil, SummaryBarUtil, StateUtil, MapUtil];

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

        _this.qField = _this.state.qField;
        _this.setupFilterGroups();
        _this.setupWidgets();

        _this.setupActionHandlers();

        var actionsDeferred = _this.processActions(_this.config.initialActions);
        actionsDeferred.done(function(){
          console.log("done with actions");
          _this.initialized = true;
          _this.trigger("ready");
          _this.postInitialize();
        });
      });
    },

    postInitialize: function(){
      var _this = this;
      // Listen for window resize events.
      this.on('resize', this.resize, this);
      this.on('resizeStop', this.resizeStop, this);

      var ctx = {
        dataView: this
      };

      // Call post initialize hooks.
      _.each(UtilModules, function(module){
        _.each(module.postInitializeHooks, function(hook){
          hook(ctx, {});
        });
      });

      // Setup infotips.
      /*
      GeoRefineViewsUtil.infotipsUtil.setUpInfotips({
        el: this.el
      });
      */
    },

    initialRender: function(){
      $(this.el).html(_.template(DataViewTemplate, {}));
    },

    setupFilterGroups: function(){
      var _this = this;
      _this.filterGroups = _this.state.filterGroups;
      _.each(_this.filterGroups, function(filterGroup, filterGroupId){
        FiltersUtil.decorateFilterGroup(filterGroup, filterGroupId);
      });
    },

    setupWidgets: function(){
      this.setupSummaryBar();
      this.setupFacetsEditor();
      this.setupMapEditor();
    },

    setupFacetsEditor: function(){
      this.facetsEditor = FacetsUtil.createFacetsEditor({
        model: this.state.facetsEditor,
        config: this.config.facets,
        el: $('.facets-editor', this.el),
        filterGroups: this.filterGroups,
        summaryBar: this.summaryBar
      });
    },

    setupSummaryBar: function(){
      this.summaryBar = SummaryBarUtil.createSummaryBar({
        model: this.state.summaryBar,
        el: $('.summary-bar', this.el)
      });
    },

    setupMapEditor: function(){
      this.mapEditor = MapUtil.createMapEditor({
        model: this.state.mapEditor,
        el: $('.map-editor', this.el)
      });
    },

    setupInitialState: function(){
      console.log('setupInitialState');
    },

    resize: function(){
      this.facetsEditor.trigger('resize');
      this.mapEditor.trigger('resize');
    },

    resizeStop: function(){
    },

    onReady: function(){
      this.resize();
      this.mapEditor.trigger('ready');
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
      _.each([FacetsUtil, SummaryBarUtil, MapUtil], function(module){
        if (module.actionHandlers){
          _.extend(_this.actionHandlers, module.actionHandlers);
        }
      }, _this);
    }


  });

  return DataView;
});

