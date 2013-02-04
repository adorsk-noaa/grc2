define([
       'underscore',
       'Facets/views/facet_collection',
       'Facets/views/facetsEditor',
       './functions',
       './filters',
       './requests',
       './format'
],
function(_, FacetCollectionView, FacetsEditorView, FunctionsUtil, FiltersUtil, RequestsUtil, FormatUtil){

  var createFacetsEditor = function(opts){
    var facetsEditorModel = opts.model || new Backbone.Model();
    var summaryBar = opts.summaryBar;
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
            return FormatUtil.GeoRefineTokenFormatter(orig);
          }
        });
        return GRFacetClass;
      }
    });

    // Use a customized facets editor class.
    var GRFacetsEditorView = FacetsEditorView.extend({
      formatter: function(){
        var orig = FacetsEditorView.prototype.formatter.apply(this, arguments);
        return FormatUtil.GeoRefineTokenFormatter(orig);
      },
      getFacetCollectionViewClass: function(){
        return GRFacetCollectionView;
      }
    });

    // Create facets editor view.
    var facetsEditorView = new GRFacetsEditorView({
      el: opts.el,
      model: facetsEditorModel,
    });

    // Setup facet collection view.
    var facetCollectionView = facetsEditorView.subViews.facets;
    // Initialize and connect initial facets.
    _.each(facetCollectionView.registry, function(facetView, id){
      initializeFacet(facetView, {filterGroups: opts.filterGroups, qField: opts.qField});
      connectFacet(facetView, {filterGroups: opts.filterGroups, summaryBar: summaryBar});
    });
    // Disconnect facets when removed.
    facetCollectionView.on('removeFacetView', function(view){
      disconnectFacet(view, {filterGroups: opts.filterGroups, summaryBar: opts.summaryBar});
    });

    return facetsEditorView;
  };

  // Define postInitialize hook.
  var connectFacetsEditor = function(ctx, opts){
    var facetsEditor = ctx.facetsEditor;

    // Initialize and connect newly created facets.
    var facetCollectionView = facetsEditor.subViews.facets;
    if (facetCollectionView){
      facetCollectionView.on('addFacetView', function(facet){
        initializeFacet(facet, ctx);
        connectFacet(facet, ctx);
        if (facet.model.getData){
          var getDataOpts = {};
          if (facet.model.get('type') == 'numeric'){
            getDataOpts.updateRange = true;
          }
          facet.model.getData(getDataOpts);
        }
      });
    }
  };

  /**
   * Define functions for decorating facets.
   **/
  var facetDecorators = {};
  facetDecorators['numeric'] = function(numericFacet){
    var model = numericFacet.model;
    model.getData = function(opts){
      // 'this' is a numeric facet model.
      var _this = this;
      var opts = opts || {updateRange: false};

      var qfield  = _this.get('quantity_field');
      if (! qfield){
        return;
      }

      // Copy the key entity.
      var key = JSON.parse(JSON.stringify(_this.get('KEY')));

      // Set base filters on key entity context.
      if (! key['KEY_ENTITY']['CONTEXT']){
        key['KEY_ENTITY']['CONTEXT'] = {};
      }
      var key_context = key['KEY_ENTITY']['CONTEXT'];

      RequestsUtil.addFiltersToQuery(_this, ['base_filters'], key_context);

      // Get the base query.
      var base_inner_q = RequestsUtil.makeKeyedInnerQuery(_this, key, ['base_filters']);
      var base_outer_q = RequestsUtil.makeKeyedOuterQuery(_this, key, base_inner_q, 'base');

      // Get the primary query.
      var primary_inner_q = RequestsUtil.makeKeyedInnerQuery(_this, key, ['base_filters', 'primary_filters']);
      var primary_outer_q = RequestsUtil.makeKeyedOuterQuery(_this, key, primary_inner_q, 'primary');

      // Assemble the keyed result parameters.
      var keyed_results_parameters = {
        "KEY": key,
        "QUERIES": [base_outer_q, primary_outer_q]
      };

      // Assemble keyed query request.
      var keyed_query_request = {
        'ID': 'keyed_results',
        'REQUEST': 'execute_keyed_queries',
        'PARAMETERS': keyed_results_parameters
      };

      // Assemble request.
      var requests = [keyed_query_request];

      // Start the request and save the deferred object.
      var deferred = $.ajax({
        url: GeoRefine.app.requestsEndpoint,
        type: 'POST',
        data: {
          'requests': JSON.stringify(requests)
        },
        success: function(data, status, xhr){
          var results = data.results;
          var count_entity = qfield.get('outer_query')['SELECT'][0];

          // Parse data into histograms.
          var base_histogram = [];
          var primary_histogram = [];

          // Generate choices from data.
          var choices = [];
          _.each(results['keyed_results'], function(result){
            var bucketLabel = result['label'];
            var bminmax = FunctionsUtil.parseBucketLabel(bucketLabel);

            if (result['data']['base']){
              var base_bucket = {
                bucket: bucketLabel,
                min: bminmax.min,
                max: bminmax.max,
                count: result['data']['base'][count_entity['ID']]
              };
              base_histogram.push(base_bucket);

              // Get primary count (if present).
              var primary_count = 0.0;
              if (result['data'].hasOwnProperty('primary')){
                var primary_count = result['data']['primary'][count_entity['ID']];
              }
              var primary_bucket = _.extend({}, base_bucket, {
                count: primary_count
              });
              primary_histogram.push(primary_bucket);
            }
          });

          base_histogram = _.sortBy(base_histogram, function(b){return b.count});
          primary_histogram = _.sortBy(primary_histogram, function(b){return b.count;});

          _this.set({
            base_histogram: base_histogram,
            filtered_histogram: primary_histogram,
          });
        }
      });

      return deferred;
    };


    // Define the formatFilters function for facet.
    numericFacet.formatFilters = function(selection){
      // 'this' is a numeric facet view.
      var filter_entity = this.model.get('filter_entity');
      var formatted_filters = [];
      _.each(['min', 'max'], function(minmax){
        var val = parseFloat(selection[minmax]);
        if (! isNaN(val)){
          var op = (minmax == 'min') ? '>=' : '<=';
          formatted_filters.push([filter_entity, op, val]);
        }
      });
      return formatted_filters;
    };

    // Define formatter for the view.
    numericFacet.formatter = function(format, value){
      return FormatUtil.GeoRefineFormatter(format, value);
    };
  };

  // Time slider facet decorator.
  facetDecorators['timeSlider'] = function(timeSliderFacet){
    var model = timeSliderFacet.model;

    // Define getData function for model.
    model.getData = function(){
      // 'this' is a timeSliderFacet model.
      var _this = this;

      // Copy the key entity.
      var key = JSON.parse(JSON.stringify(_this.get('KEY')));

      // Assemble request.
      key['QUERY']['ID'] = 'key_query'
      var keyed_query_req = {
        'ID': 'keyed_results',
        'REQUEST': 'execute_keyed_queries',
        'PARAMETERS': {
          'KEY': key,
          'QUERIES': [key['QUERY']]
        }
      };
      var requests = [keyed_query_req];

      // Start request and save the deferred object.
      var deferred = $.ajax({
        url: GeoRefine.app.requestsEndpoint,
        type: 'POST',
        data: {
          'requests': JSON.stringify(requests)
        },
        success: function(data, status, xhr){
          var results = data.results;

          // Generate choices from data.
          var choices = [];
          _.each(results['keyed_results'], function(result){
            value = null,
            choices.push({
              'id': result['key'],
              'label': result['label'],
              'value': value
            });
          }, _this);

          // Sort choices.
          choices = _.sortBy(choices, function(choice){
            return choice['label'];
          });

          _this.set('choices', choices);
        }
      });

      return deferred;
    };

    // Define formatFilters function for the view.
    timeSliderFacet.formatFilters = function(selection){
      var _this = this;
      var formatted_filters = [
        [_this.model.get('filter_entity'), '==', selection]
      ];
      return formatted_filters;
    };
  };

  // List facet decorator.
  facetDecorators['list'] = function(listFacet){
    var model = listFacet.model;

    // Define getData function for model.
    model.getData = function(){
      // 'this' is a list facet model.
      var _this = this;
      var qfield = this.get('quantity_field');
      if (! qfield){
        return;
      }

      // Copy the key entity.
      var key = JSON.parse(JSON.stringify(_this.get('KEY')));

      // Assemble request.
      var keyed_query_req = RequestsUtil.makeKeyedQueryRequest(_this, key);
      var requests = [];
      requests.push(keyed_query_req);

      // Execute requests and save the deferred object.
      var deferred = $.ajax({
        url: GeoRefine.app.requestsEndpoint,
        type: 'POST',
        data: {
          'requests': JSON.stringify(requests)
        },
        success: function(data, status, xhr){
          var results = data.results;
          var count_entity = qfield.get('outer_query')['SELECT'][0];

          // Generate choices from data.
          var choices = [];
          _.each(results['keyed_results'], function(result){
            value = result['data']['outer'][count_entity['ID']];
            choices.push({
              id: result['key'],
              label: result['label'],
              count: value,
              count_label: FormatUtil.GeoRefineFormatter(qfield.get('format') || '%s', value)
            });
          });
          _this.set('choices', choices);
        }
      });

      return deferred;
    };

    // Define the formatFilters function for the view.
    listFacet.formatFilters = function(selection){
      // 'this' is a listFacetView.
      var formatted_filters = [];
      if (selection.length > 0){
        formatted_filters = [
          [this.model.get('filter_entity'), 'in', selection]
        ];
      }
      return formatted_filters;
    };

    // Define formatChoiceCountLabels function for the view.
    listFacet.formatChoiceCountLabels = function(choices){
      // 'this' is a listFacetView.
      var labels = [];
      var count_entity = this.model.get('count_entity');
      _.each(choices, function(choice){
        var label = "";
        if (count_entity && count_entity.format){
          label = FormatUtil.GeoRefineFormatter(count_entity.format || '%s', choice['count']);
        }
        else{
          label = choice['count'];
        }
        labels.push(label);
      });
      return labels;
    };
  };

  var decorateFacet = function(facet){
    var decorator = facetDecorators[facet.model.get('type')];
    if (decorator){
      decorator(facet);
    }
  };

  var updateFacetModelPrimaryFilters = function(facetModel, opts){
    var filters = FiltersUtil.getModelFilters(facetModel, 'primary', opts);
    // Remove filters generated by this facet.
    _.each(filters, function(filterSet, groupId){
      var keep_filters = [];
      _.each(filterSet, function(filter){
        if (filter.source.id != facetModel.id){
          keep_filters.push(filter);
        }
      });
      filters[groupId] = keep_filters;
    });
  };

  /**
   * Initialize a facet.  Sets filters, decorates, qfield.
   **/
  var initializeFacet = function(facet, opts){
    opts = opts || {};
    decorateFacet(facet);
    if (opts.qField){
      facet.model.set({quantity_field: opts.qField}, {silent: true});
    }
    facet.updateFilters();
    updateFacetModelPrimaryFilters(facet.model, {silent: true, filterGroups: opts.filterGroups});
    FiltersUtil.updateModelFilters(facet.model, 'base', {silent: true, filterGroups: opts.filterGroups});
  };

  var connectFacet = function(facet, opts){
    var facetsEditor = opts.facetsEditor;
    var summaryBar = opts.summaryBar;

    // Setup the facet's primary filter groups.
    _.each(facet.model.get('primary_filter_groups'), function(filterGroupId, key){
      var filterGroup = opts.filterGroups[filterGroupId];
      filterGroup.add(facet.model);
      filterGroup.on('change:filters', function(){
        updateFacetModelPrimaryFilters(this, opts);
      }, facet.model);
      // Remove callback when model is removed.
      facet.model.on('remove', function(){
        filterGroup.off(null, null, this);
      }, facet.model);
    });

    // Setup the facet's base filter group config.
    _.each(facet.model.get('base_filter_groups'), function(filterGroupId, key){
      var filterGroup = opts.filterGroups[filterGroupId];
      filterGroup.on('change:filters', function(){
        FiltersUtil.updateModelFilters(this, 'base', opts);
      }, facet.model);
      // Remove callback when model is removed.
      facet.model.on('remove', function(){
        filterGroup.off(null, null, this);
      }, facet.model);
    });

    // Listen for quantity field changes, if not a timeSlider.
    if (facet.model.get('type') != 'timeSlider'){
      // Update totals when the summary bar totals change.
      summaryBar.model.on('change:data', function(){
        var data = summaryBar.model.get('data');
        this.set('total', data.total);
      }, facet.model);
      // Remove callback when model is removed.
      facet.model.on('remove', function(){
        summaryBar.model.off(null, null, this);
      }, facet.model);
    }

    // Have the facet update when its query or base filters or quantity_field change.
    if (facet.model.getData){
      // helper function to get a timeout getData function.
      var _timeoutGetData = function(changes){
        var delay = 500;
        return setTimeout(function(){
          var getDataOpts = {};
          // For numeric facet, add update range flag
          // for base_filter changes.
          if (facet.model.get('type') == 'numeric' 
              && changes && changes.changes 
            && changes.changes['base_filters']){
              getDataOpts.updateRange = true;
            }
            var getDataDeferred = facet.model.getData(getDataOpts);
            getDataDeferred.always(function(){
              $(facet.el).removeClass('loading');
            });
            facet.model.set('_fetch_timeout', null);
        }, delay);
      };

      facet.model.on('change:primary_filters change:base_filters change:quantity_field', function(){

        $(facet.el).addClass('loading');

        var changes = arguments[2];
        // We delay the get data call a little, in case multiple things are changing.
        // The last change will get executed.
        var fetch_timeout = this.get('_fetch_timeout');
        // If we're fetching, clear the previous fetch.
        if (fetch_timeout){
          clearTimeout(fetch_timeout);
        }
        // Start a new fetch.
        this.set('_fetch_timeout', _timeoutGetData(changes));
      }, facet.model);
    }
  };

  var disconnectFacet = function(facet, opts){
    // Remove summaryBar callback.
    opts.summaryBar.model.off(null, null, facet.model);

    // For each filter group...
    _.each(['base', 'primary'], function(filterGroupCategory){
      _.each(facet.model.get(filterGroupCategory + '_filter_groups'), function(filterGroupId, key){
        var filterGroup = opts.filterGroups[filterGroupId];
        // Remove callback.
        filterGroup.off(null, null, facet.model);
        // Remove from group.
        filterGroup.remove(facet.model);
        // Trigger change in group filters.
        filterGroup.trigger('change:filters');
      });
    });
  };

  var actionHandlers = {};
  actionHandlers.facetsEditor_connect = function(ctx, opts){
    connectFacetsEditor(ctx);
  };

  actionHandlers.facets_facet_add = function(ctx, opts){
    if (opts.fromDefinition){
      var facetDefinitions = ctx.facetsEditor.model.get('facetDefinitions');
      var facetDefModel = facetDefinitions.get(opts.definitionId);
      ctx.facetsEditor.addFacetFromDefinition({
        defModel: facetDefModel,
        id: opts.facetId
      });
    }
  };

  actionHandlers.facets_facet_initialize = function(ctx, opts){
    var facet = ctx.getFacetView(opts);
    initializeFacet(facet, ctx);
  };

  actionHandlers.facets_facet_connect = function(ctx, opts){
    var facet = ctx.getFacetView(opts);
    connectFacet(facet, ctx);
  };

  actionHandlers.facets_facet_getData = function(ctx, opts){
    var facet = ctx.getFacetView(opts);
    if (facet.model.getData){
      return facet.model.getData(opts);
    }
  };

  actionHandlers.facets_facet_setSelection = function(ctx, opts){
    var facet = ctx.getFacetView(opts);
    if (facet.model.get('type') == 'timeSlider'){
      if (opts.index != null){
        var choice = facet.model.get('choices')[opts.index];
        facet.model.set('selection', choice.id);
      }
    }
  };

  var exports = {
    createFacetsEditor: createFacetsEditor,
    actionHandlers: actionHandlers,
  };

  return exports;
});
