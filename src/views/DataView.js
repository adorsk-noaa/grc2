define([
       'backbone',
       'underscore',
       'Facets/views/facet_collection',
       'Facets/views/facetsEditor',
       './SummaryBar',
       'text!./templates/DataView.html'
],
function(Backbone, _, FacetCollectionView, FacetsEditorView, SummaryBarView, DataViewTemplate){
  var DataView = Backbone.View.extend({
    initialize: function(opts){
      $(this.el).addClass('dataview');
      this.config = this.model.get('config');
      this.initialRender();
      this.setupFilterGroups();
      this.setupWidgets();
      this.setupInitialState();
      this.on('ready', this.onReady, this);
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
      var _this = this;
      var facetsEditorModel = new Backbone.Model();
        // Use a customized FacetCollectionView which adds a token
        // formatter to each facet view class.
        // This allows us to do things like adding in the project's
        // static dir to a url.
        var GRFacetCollectionView = FacetCollectionView.extend({
          getFacetViewClass: function(){
            BaseFacetClass = FacetCollectionView.prototype.getFacetViewClass.apply(this, arguments);
            GRFacetClass = BaseFacetClass.extend({
              formatter: function(){
                var orig = BaseFacetClass.prototype.formatter.apply(this, arguments);
                // @TODO
                return orig;
                //return formatUtil.GeoRefineTokenFormatter(orig);
              }
            });
            return GRFacetClass;
          }
        });

        // Use a customized facets editor class.
        var GRFacetsEditorView = FacetsEditorView.extend({
          formatter: function(){
            var orig = FacetsEditorView.prototype.formatter.apply(this, arguments);
            // @TODO
            return orig;
            //return formatUtil.GeoRefineTokenFormatter(orig);
          },
          getFacetCollectionViewClass: function(){
            return GRFacetCollectionView;
          }
        });

        // Create facets editor view.
        var facetsEditorView = new GRFacetsEditorView({
          el: $('.facets-editor', _this.el),
          model: facetsEditorModel,
        });

        // Add references to the the facetsEditor and summaryBar in the app variable.
        _this.facetsEditor = facetsEditorView;

        // Setup initial facets.
        //@TODO
        /*
        var facetCollectionView = facetsEditorView.subViews.facets;
        if (facetCollectionView){
          // Initialize and connect any initial facets.
          _.each(facetCollectionView.registry, function(facetView, id){
            initializeFacet(facetView);
            connectFacet(facetView);
          });

          // Disconnect facets when removed.
          facetCollectionView.on('removeFacetView', function(view){
            disconnectFacet(view)
          });
        }
        */
    },

    setupSummaryBar: function(){
      this.SummaryBar = new SummaryBarView({
        model: new Backbone.Model(),
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
    }

  });

  return DataView;
});

