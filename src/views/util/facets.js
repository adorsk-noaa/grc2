define([
       'underscore',
       'Facets/views/facet_collection',
       'Facets/views/facetsEditor',
],
function(_, FacetCollectionView, FacetsEditorView){

    var createFacetsEditor = function(opts){
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
        el: $('.facets-editor', opts.el),
        model: facetsEditorModel,
      });

      return facetsEditorView;

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
    };

    /**
     * Initialize a facet.  Sets filters, qfield.
     **/
    var initializeFacet = function(facet, opts){
      console.log('initializeFacet');
      /*
      decorateFacet(facet);
      facet.model.set({quantity_field: opts.qField}, {silent: true});
      facet.updateFilters();
      updateFacetModelPrimaryFilters(facet.model, {silent: true});
      filtersUtil.updateModelFilters(facet.model, 'base', {silent: true});
      if (GeoRefine.app.summaryBar && GeoRefine.app.summaryBar.model){
            var data = GeoRefine.app.summaryBar.model.get('data');
            if (data){
                var total = parseFloat(data.total);
                if (! isNaN(total)){
                    facet.model.set('total', total);
                }
            }
        }
      */
    };

    var connectFacet = function(facet, opts){
      console.log('connect');
    };

    var actionHandlers = {};
    actionHandlers.facets_addFacet = function(ctx, opts){
      if (opts.fromDefinition){
        var predefinedFacets = ctx.dataView.facetsEditor.model.get('predefined_facets');
        var facetDefModel = predefinedFacets.get(opts.defId);
        var facetDef = facetDefModel.get('facetDef');
        facetDef.id = opts.facetId;
        var facetModel = ctx.dataView.facetsEditor.createFacetModelFromDef(facetDef);
        ctx.dataView.facetsEditor.model.get('facets').add(facetModel);
      }
    };

    actionHandlers.facets_initializeFacet = function(ctx, opts){
      var facet = ctx.dataView.getFacetView(opts);
      initializeFacet(facet);
    };

    actionHandlers.facets_connectFacet = function(ctx, opts){
      var facet = ctx.dataView.getFacetView(opts);
      connectFacet(facet);
    };

    actionHandlers.facets_facetGetData = function(ctx, opts){
      var facet = ctx.dataView.getFacetView(opts);
      if (facet.model.getData){
        return facet.model.getData(opts);
      }
    };

    actionHandlers.facets_facetSetSelection = function(ctx, opts){
      var facet = ctx.dataView.getFacetView(opts);
      if (facet.model.get('type') == 'timeSlider'){
        if (opts.index != null){
          var choice = facet.model.get('choices')[opts.index];
          facet.model.set('selection', choice.id);
        }
      }
    };


    // Define alterState hook for saving facetEditor state.
    var facetsEditor_alterState = function(ctx, state){
        state.facetsEditor = serializationUtil.serialize(ctx.facetsEditor.model, state.serializationRegistry);
    };

    // Define deserializeConfigState hook for facets editor.
    var facetsEditor_deserializeConfigState = function(serializedState, deserializedState){
        if (! serializedState.facetsEditor){
            return;
        }
        var facetsEditorModel = new Backbone.Model();

        // Make collections and models for facet editor sub-collections.
        _.each(['facets', 'predefined_facets'], function(attr){
            var collection = new Backbone.Collection();
            _.each(serializedState.facetsEditor[attr], function(modelDef){
                var model = new Backbone.Model(_.extend({}, modelDef));
                collection.add(model);
            });
            facetsEditorModel.set(attr, collection);
        });

        deserializedstate.facetsEditor = facetsEditorModel;
    };

    var exports = {
      createFacetsEditor: createFacetsEditor,
      actionHandlers: actionHandlers
    };

    return exports;
});
