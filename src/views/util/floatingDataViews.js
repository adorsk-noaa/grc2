define([
       "jquery",
       "backbone",
       "underscore",
       "_s",
       "Util",
       "Windows",
       "./serialization",
],
function($, Backbone, _, _s, Util, Windows, serializationUtil){

  var setUpWindows = function(ctx){
    $.window.prepare({
      "handleScrollbar": false
    });
  };

  var setUpDataViews = function(ctx){
    var dvState = ctx.state.dataViews || {};
    ctx.dataViews = {};
    ctx.dataViews.counter = dvState.counter || 0;
    ctx.dataViews.defaults = dvState.defaults || {
      width: 485,
      height: 300
    };
    ctx.dataViews.container = $('.data-views-container', ctx.el);

    // Initialize floating data views registry.
    ctx.dataViews.floatingDataViews = dvState.floatingDataViews || {};

    // Create any initial data views.
    _.each(ctx.dataViews.floatingDataViews, function(floatingDataViewModel){
      addFloatingDataView(floatingDataViewModel);
    });
  };


  // View that combines DataView and Window models.
  var FloatingDataViewView = Backbone.View.extend({

    initialize: function(opts){
      this.ctx = opts.ctx;
      this.initialRender();

      // Connect window events to data view.
      this.window.on("resize", function(){
        if (this.dataView){
          Util.util.fillParent(this.dataView.el);
          this.dataView.trigger('resize');
        }
      }, this);

      this.window.on("resizeStop", function(){
        if (this.dataView){
          this.dataView.trigger('resizeStop');
          //Util.util.unsetWidthHeight(this.dataView.el);
        }
      }, this);

      _.each(['pagePositionChange', 'deactive', 'activate'], function(event){
        this.window.on(event, function(){
          this.dataView.trigger(event);
        }, this);
      }, this);

      this.window.on("close", this.remove, this);

      // Bump counter.
      this.ctx.dataViews.counter += 1;

      // Listen for ready event.
      this.on("ready", this.onReady, this);
    },

    initialRender: function(){
      this.renderDataView();
      this.renderWindow();
      if (this.dataView && this.dataView.el){
        $(this.window.getBody()).append(this.dataView.el);
      }
    },

    renderDataView: function(){
      console.log("render dv");
    },

    renderWindow : function(){
      var $dataViews = $(this.ctx.dataViews.container);
      var dvOffset = $dataViews.offset();

      console.log("dv: ", this.ctx);
      this.window = new Windows.views.WindowView({
        model: this.model.get('window'),
        minimizable: false,
        maximizable: false,
        caller: $dataViews,
        //containment: $(this.ctx.dataViews.constraint)
      });
    },

    onReady: function(){
      if (this.dataView){
        this.dataView.trigger('ready');
      }
      this.window.resize();
      this.window.resizeStop();

    },

    remove: function(){
      this.trigger('remove');
      this.dataView.trigger('remove');
      this.window.trigger('remove');
    }
  });

  var addFloatingDataView = function(ctx, model){
    // Set default id if none given.
    if (! model.id){
      model.id = model.cid;
    }

    // Create floating data view.
    var floatingDataView = new FloatingDataViewView({
      model: model,
      ctx: ctx
    });

    // Register the floating data view.
    ctx.dataViews.floatingDataViews[model.id] = floatingDataView;

    // Initialize and connect data view.
    initializeDataView(ctx, floatingDataView.dataView);
    connectDataView(ctx, floatingDataView.dataView);

    // Trigger ready if initialized.
    if (ctx.initialized){
      floatingDataView.trigger('ready');
    }

  };

  var initializeDataView = function(ctx, dataView){
  };

  var connectDataView = function(ctx, dataView){
  };

  // Create default data view window model.
  var createDefaultWindowModel = function(ctx, opts){
    opts = opts || {};

    // Get data views container offset.
    $dataViews = $(ctx.dataViewsContainer);
    var dvOffset = $dataViews.offset();

    // Set default title.
    opts.title = opts.title || 'Window';

    // Add window number to title.
    opts.title = _s.sprintf("%d | %s", ctx.dataViews.counter, opts.title);

    // Merge with defaults.
    opts = _.extend({
      "inline-block": true,
      "width": ctx.dataViews.defaults.width,
      "height": ctx.dataViews.defaults.height,
      // The next two lines slightly offset successive views.
      "x": (ctx.dataViews.counter % 5) * 20,
      "y": (ctx.dataViews.counter % 5) * 20,
      "showFooter": false,
      "scrollable": false
    }, opts);

    // Create model.
    var model = new Backbone.Model(opts);

    return model;

  };

  var createDataViewModel = function(ctx, opts){
    return new Backbone.Model();
  };

  // Create a new floating data view from config defaults.
  var createFloatingDataView = function(ctx, opts){
    opts = opts || {};
    opts.dataView = opts.dataView || {};
    opts.window = opts.window || {};

    var windowModel = createDefaultWindowModel(ctx, opts.window);
    var dataViewModel = createDataViewModel(ctx, opts.dataView);

    var floatingDataViewModel = new Backbone.Model({
      id: opts.id || Math.random(),
      window: windowModel,
      dataView: dataViewModel,
      ctx: ctx
    });

    addFloatingDataView(ctx, floatingDataViewModel);
  };

  var actionHandlers = {};
  actionHandlers.dataViews_createFloatingDataView = function(opts){
    createFloatingDataView(opts);
  };

  actionHandlers.dataViews_setMapLayerAttributes = function(ctx, opts){
    var dataView = ctx.dataViews.floatingDataViews[opts.id];
    var mapEditor = dataView.dataView;
    _.each(opts.layers, function(layerOpts){
      var layer = mapViewUtil.getMapEditorLayers(mapEditor, {layers: [layerOpts]}).pop();
      layer.model.set(layerOpts.attributes);
    });
  };

  actionHandlers.dataViews_selectChartFields = function(ctx, opts){
    var dataView = ctx.dataViews.floatingDataViews[opts.id];
    var chartEditor = dataView.dataView;
    chartsUtil.selectFields(chartEditor, opts);
  };

  dataViews_alterState = function(state){
    state.dataViews = state.dataViews || {};
    state.dataViews.floatingDataViews = state.dataViews.floatingDataViews || {};

    _.each(ctx.dataViews.floatingDataViews, function(fdv, id){
      var serializedFdv = serializationUtil.serialize(fdv.model, state.serializationRegistry);
      state.dataViews.floatingDataViews[id] = serializedFdv; 
    });
  };

  dataViews_postInitialize = function(ctx){
    _.each(ctx.dataViews.floatingDataViews, function(fdv){
      fdv.trigger('ready');
    });
  };

  // Objects to expose.
  var dataViewUtil = {
    actionHandlers: actionHandlers,
    setUpDataViews: setUpDataViews,
    setUpWindows: setUpWindows,
    createFloatingDataView: createFloatingDataView,
    alterStateHooks: [
      dataViews_alterState
    ],
    postInitializeHooks : [
      dataViews_postInitialize
    ]
  };
  return dataViewUtil;
});
