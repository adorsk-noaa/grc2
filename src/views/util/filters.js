define([
       "jquery",
       "backbone",
       "underscore",
       "_s",
       "Util",
],
function($, Backbone, _, _s, Util){

  var decorateFilterGroup = function(filterGroup, filterGroupId){

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
  };

  // Merge a set of grouped filter objects into a list.
  // filter objects are keyed by filter group id.
  var filterObjectGroupsToArray = function(groups){
    filters_hash = {};
    _.each(groups, function(group){
      _.each(group, function(filter_obj){
        var key = JSON.stringify(filter_obj.filters);
        filters_hash[key] = filter_obj;
      });
    });
    var combined_filters = [];
    _.each(filters_hash, function(filter_obj){
      if (filter_obj.filters){
        combined_filters.push.apply(combined_filters, filter_obj.filters);
      }
    });

    return combined_filters;
  };


  // Get filters from model's specified filter group.
  var getModelFilters = function(model, filterCategory, opts){
    var filters = _.clone(model.get(filterCategory + '_filters')) || {} ;
    _.each(model.get(filterCategory + '_filter_groups'), function(filterGroupId, key){
      var filterGroup = opts.filterGroups[filterGroupId];
      filters[filterGroupId] = filterGroup.getFilters();
    });
    return filters;
  };

  // Update model's filter attributes by getting filters from its
  // filter groups.
  var updateModelFilters = function(model, filterCategory, opts){
    var filters = getModelFilters(model, filterCategory, opts);
    var setObj = {};
    setObj[filterCategory + '_filters'] = filters;
    model.set(setObj, opts);
  };

  // Objects to expose.
  var exports = {
    decorateFilterGroup: decorateFilterGroup,
    filterObjectGroupsToArray: filterObjectGroupsToArray,
    getModelFilters: getModelFilters,
    updateModelFilters: updateModelFilters,
  };
  return exports;
});
