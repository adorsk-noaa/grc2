define([
       'backbone',
       'underscore',
       './SummaryBar',
       './util/actions',
       './util/facets',
       './util/filters',
       './util/summaryBar',
       './util/map',
       'text!./templates/DataView.html',
       'Util',
       'tabble',
       'qtip',
],
function(Backbone, _, SummaryBarView, ActionsUtil, FacetsUtil, FiltersUtil, SummaryBarUtil, MapUtil, DataViewTemplate, Util, Tabble, qtip){

  var hookModules = [FacetsUtil, FiltersUtil, SummaryBarUtil, MapUtil];

  var DataView = Backbone.View.extend({

    initialize: function(opts){
      var _this = this;

      $(this.el).addClass('dataview loading');

      this.qField = this.model.get('qField');

      this.initialRender();

      this.setupInfoTips();
      this.initializeFilterGroups();
      this.initializeWidgets();

      this.setupActionHandlers();

      var initialActionsDeferred = null;
      var initialActions = this.model.get('initialActions');
      if (initialActions){
        initialActionsDeferred = ActionsUtil.executeActions(this, initialActions);
      }
      else{
        initialActionsDeferred = $.Deferred();
        initialActionsDeferred.resolve();
      }
      initialActionsDeferred.done(function(){
        console.log("done with initialActions");
        _this.initialized = true;
        _this.postInitialize();
      });
    },

    initialRender: function(){
      $(this.el).html(_.template(DataViewTemplate, {}));
      this.$title = $('> .dataview-title', this.el);
      this.$title.html(this.model.get('label'));
      this.$table = $('> table', this.el);
      this.$fCell = $('.dataview-facets-cell', this.el);
      this.$rtCell = $('.dataview-right-table-cell', this.el);
      this.$table.tabble({
        stretchTable: true,
        resize: _.bind(this.onTabbleResize, this),
      });
    },

    onTabbleResize: function(){
      var minW = parseInt(this.$rtCell.css('min-width')) + this.$fCell.outerWidth(true);
      var minH = parseInt(this.$table.css('min-height')) + this.$title.outerHeight(true);
      $(this.el).css({
        minWidth: minW,
        minHeight: minH,
      });
      this.trigger('change:minDimensions');
    },

    initializeFilterGroups: function(){
      var _this = this;
      this.filterGroups = {};
      _.each(this.model.get('filterGroups'), function(groupId){
        var filterGroup = new Backbone.Collection();
        FiltersUtil.decorateFilterGroup(filterGroup);
        this.filterGroups[groupId] = filterGroup;
      }, this);
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
        el: $('.summary-bar', this.el),
      });
    },

    setupFacetsEditor: function(){
      this.facetsEditor = FacetsUtil.createFacetsEditor({
        model: this.model.get('facetsEditor') || new Backbone.Model(),
        el: $('.facets-editor', this.el),
        filterGroups: this.filterGroups,
        qField: this.qField,
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
      this.resize();
      this.resizeStop();

      // Listen for window events.
      this.on('resize', this.resize, this);
      this.on('resizeStop', this.resizeStop, this);
      this.on('pagePositionChange', this.pagePositionChange, this);

      this.on('ready', this.onReady, this);
      this.trigger("ready");
      $('.dataview-loading-overlay', this.el).fadeOut('slow', _.bind(function(){
        $(this.el).removeClass('loading');
      }, this));
    },

    resize: function(){
      Util.util.fillParent(this.$table);
      _.each(this.subViews, function(subView){
        subView.trigger('resize');
      }, this);
    },

    resizeStop: function(){
      this.$table.tabble('resize');
      _.each(this.subViews, function(subView){
        subView.trigger('resizeStop');
      }, this);
      Util.util.unsetWidthHeight(this.el);
    },

    pagePositionChange: function(){
      _.each(this.subViews, function(subView){
        subView.trigger('pagePositionChange');
      }, this);
    },

    onReady: function(){
      this.resize();
      this.resizeStop();
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
    },

    setupInfoTips: function(opts){
      var _this = this;
      opts = opts || {};
      opts.el = opts.el || this.el;
      opts.selector = opts.selector || '.info-button';
      $(opts.el).on('click', opts.selector, function(event) {
        $(this).qtip({
          overwrite: false,
          content: {
            text: $('> .content', this).clone()
          },
          position: {
            my: 'left center',
            at: 'right center',
            container: $(_this.el),
          },
          show: {
            event: 'click',
          },
          hide: {
            fixed: true,
            event: 'unfocus'
          },
          style: {
            classes: 'info-tip',
            tip: false
          },
          events: {
            render: function(event, api){
              // Toggle when target is clicked.
              $(api.elements.target).on('click', function(clickEvent){
                clickEvent.preventDefault();
                api.toggle();
              });
            },
          },
        });
        $(this).qtip('show')
      });
    },

  });

  return DataView;
});

