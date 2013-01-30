define([
       "jquery",
       "backbone",
       "underscore",
       "./format",
       'MapView/views/map_editor',
       "./layers",
],
function($, Backbone, _, FormatUtil, MapEditorView, LayersUtil){

  var createMapEditor = function(opts){
    opts = opts || {};
    var mapEditorModel = opts.model || new Backbone.Model();

    // Customize map editor to add formatting to layer editors.
    var BaseMapEditor = MapEditorView;
    var GRMapEditorView = BaseMapEditor.extend({

      getLayerCollectionEditorClass: function(){
        var BaseCollectionEditor = BaseMapEditor.prototype.getLayerCollectionEditorClass.apply(this, arguments);
        var GRCollectionEditor = BaseCollectionEditor.extend({
          getLayerEditorClass: function(){
            var BaseLayerEditor = BaseCollectionEditor.prototype.getLayerEditorClass.apply(this, arguments);
            var GRLayerEditor = BaseLayerEditor.extend({
              formatter: function(){
                var orig = BaseLayerEditor.prototype.formatter.apply(this, arguments);
                return FormatUtil.GeoRefineTokenFormatter(orig);
              }
            });
            return GRLayerEditor;
          }
        });
        return GRCollectionEditor;
      }
    });

    var mapEditorView = new GRMapEditorView({
      el: opts.el,
      model: mapEditorModel
    });

    window.mev = mapEditorView;
    return mapEditorView;
  };


  var initializeMapEditor = function(mapEditor, opts){
    var deferred = $.Deferred();

    // Initialize layers.
    var initializerDeferreds = [];
    _.each(mapEditor.mapView.layerRegistry, function(layer){
      LayersUtil.decorateLayer(layer, opts);
      if (layer.initializeLayer){
        initializerDeferreds.push(layer.initializeLayer(opts));
      }
    });
    var initializerDeferred = $.when.apply($, initializerDeferreds);

    // Connect layers when initialization is done.
    initializerDeferred.always(function(){
      console.log("init is done");
      _.each(mapEditor.mapView.layerRegistry, function(layer){
        LayersUtil.connectLayer(layer, opts);
      });
      deferred.resolve();
    });
    return deferred;
  };

  var actionHandlers = {};
  actionHandlers.mapEditor_initializeMapEditor = function(ctx, opts){
    return initializeMapEditor(ctx.mapEditor, {filterGroups: ctx.filterGroups});
  };

  var exports = {
    createMapEditor: createMapEditor,
    actionHandlers: actionHandlers,
  };
  return exports;
});
