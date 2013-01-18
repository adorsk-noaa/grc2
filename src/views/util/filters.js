define([
	"jquery",
	"backbone",
	"underscore",
	"_s",
	"Util",
		],
function($, Backbone, _, _s, Util){

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
                combined_filters = combined_filters.concat(filter_obj.filters);
            }
        });

        return combined_filters;
    };


    // Get filters from model's specified filter group.
    var getModelFilters = function(model, filterCategory, opts){
        var filters = _.clone(model.get(filterCategory + '_filters')) || {} ;
        _.each(model.get(filterCategory + '_filter_groups'), function(filterGroupId, key){
            var filterGroup = GeoRefine.app.filterGroups[filterGroupId];
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

    // Define alterState hook for saving filterGroup state.
    var filterGroups_alterState = function(state){
        // Save filter group ids.
        state.filterGroups = state.filterGroups || {};
        _.each(GeoRefine.app.filterGroups, function(filterGroup, id){
            state.filterGroups[id] = serializationUtil.serialize(filterGroup, state.serializationRegistry);
        });
    };

    // Define deserializeConfigState hook for filter groups.
    var filterGroups_deserializeConfigState = function(configState, state){
        if (! configState.filterGroups){
            return;
        }

        // Create collections for filter groups.
        var filterGroups = {};

        _.each(configState.filterGroups, function(filterGroupDef){
            var filterGroup = new Backbone.Collection();
            filterGroups[filterGroupDef.id] = filterGroup;
        });

        // Set editor in state object.
        state.filterGroups = filterGroups;
    };

    // Objects to expose.
    var filtersUtil = {
        filterObjectGroupsToArray: filterObjectGroupsToArray,
        getModelFilters: getModelFilters,
        updateModelFilters: updateModelFilters,
        alterStateHooks : [
            filterGroups_alterState
        ],
        deserializeConfigStateHooks: [
            filterGroups_deserializeConfigState
        ]
    };
    return filtersUtil;
});
