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
       'text!./templates/DataView.html',
       'Util'
],
function(Backbone, _, SummaryBarView, ActionsUtil, FacetsUtil, FiltersUtil, SummaryBarUtil, StateUtil, MapUtil, DataViewTemplate, Util){

  var hookModules = [FacetsUtil, FiltersUtil, SummaryBarUtil, MapUtil];

  var DataView = Backbone.View.extend({

    initialize: function(opts){
      var _this = this;

      $(this.el).addClass('dataview');

      this.initialRender();

      this.initializeFilterGroups();
      this.initializeWidgets();

      this.setupActionHandlers();

      var initialActionsDeferred = null;
      var initialActions = this.model.get('initialActions') || {};
      if (initialActions){
        initialActionsDeferred = ActionsUtil.executeActions(this, initialActions);
      }
      else{
        initialActionsDeferred = $.Deferred();
        initialActionsDeferred.resolve();
      }
      initialActionsDeferred.done(function(){
        console.log("done with initialActions");

        // Do default actions.
        var defaultActionsDeferred = _this.executeDefaultActions();
        defaultActionsDeferred.done(function(){
          console.log("done with defaultActions");
          _this.initialized = true;
          _this.postInitialize();
          _this.on('ready', _this.onReady, _this);
          _this.trigger("ready");
        });
      });
    },

    initialRender: function(){
      $(this.el).html(_.template(DataViewTemplate, {}));
      this.$table = $('> table', this.el);
      this.$rightTable = $('.right-cell-table', this.el);
    },

    initializeFilterGroups: function(){
      var _this = this;
      this.filterGroups = this.model.get('filterGroups') || new Backbone.Collection();
    },

    initializeWidgets: function(){
      this.setupSummaryBar();
      this.setupFacetsEditor();
      this.setupMapEditor();
      this.subViews = {
        summaryBar: this.summaryBar,
        facetsEditor: this.facetsEditor,
        mapEditor: this.mapEditor
      };
    },

    setupSummaryBar: function(){
      this.summaryBar = SummaryBarUtil.createSummaryBar({
        model: this.model.get('summaryBar') || new Backbone.Model(),
        el: $('.summary-bar', this.el)
      });
    },

    setupFacetsEditor: function(){
      this.facetsEditor = FacetsUtil.createFacetsEditor({
        model: this.model.get('facetsEditor') || new Backbone.Model(),
        el: $('.facets-editor', this.el),
        filterGroups: this.filterGroups,
        summaryBar: this.summaryBar
      });
    },

    setupMapEditor: function(){
      this.mapEditor = MapUtil.createMapEditor({
        model: this.model.get('mapEditor') || new Backbone.Model(),
        el: $('.map-editor', this.el)
      });
    },

    postInitialize: function(){
      var _this = this;
      // Listen for window resize events.
      this.on('resize', this.resize, this);
      this.on('resizeStop', this.resizeStop, this);

      // Call post initialize hooks.
      /*
      _.each(UtilModules, function(module){
        _.each(module.postInitializeHooks, function(hook){
          hook(_this, {});
        });
      });
      */

      // Setup infotips.
      /*
      GeoRefineViewsUtil.infotipsUtil.setUpInfotips({
        el: this.el
      });
      */
    },

    // Not sure on this yet...here or in postInitialize? postInitializeActions?
    // goals is to make it possiblef or things like vectorLayers to fetch data,
    // and block execution until they resolve.
    executeDefaultActions: function(){
      var defaultActions = {
        async: false,
        actions: [
          {
          handler: "facetsEditor_initializeFacetsEditor",
          type: "action"
        }
        ]
      };
      return ActionsUtil.executeActions(this, defaultActions);
    },

    resize: function(){
      _.each(this.subViews, function(subView){
        subView.trigger('resize');
      }, this);
    },

    resizeStop: function(){
      _.each(this.subViews, function(subView){
        subView.trigger('resizeStop');
      }, this);
    },

    onReady: function(){
      this.resize();
      _.each(this.subViews, function(subView){
        subView.trigger('ready');
      }, this);
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

