define([
       "jquery",
       "backbone",
       "underscore",
       "_s",
       "Util",
       "Windows",
       "./serialization",
       "../DataView",
],
function($, Backbone, _, _s, Util, Windows, serializationUtil, DataView){

  var setUpWindows = function(ctx){
    $.window.prepare({
      "handleScrollbar": false
    });
  };

  var setUpDataViews = function(ctx){
    var fdvCollection = ctx.model.get("floating_data_views");
    if (! fdvCollection){
      fdvCollection = new Backbone.Collection();
      ctx.model.set('floating_data_views', fdvCollection);
    }
    ctx.floatingDataViews = {};
    ctx.floatingDataViews.counter = 0;
    if (! GeoRefine.config.floatingDataViews){
      GeoRefine.config.floatingDataViews = {
        defaults: {width: 485, height: 385}
      };
    }
    ctx.floatingDataViews.defaults = GeoRefine.config.floatingDataViews.defaults || {
      width: 485,
      height: 300
    };
    ctx.floatingDataViews.$container = $('.data-views-container', ctx.el);
    ctx.floatingDataViews.$constraint = $('.data-views-constraint', ctx.el);
    ctx.floatingDataViews.$invitation = $('.data-views-invitation', ctx.el);

    // Create any initial data views.
    _.each(fdvCollection.models, function(fdvModel){
      addFloatingDataView(ctx, {model: fdvModel});
    });

    // Listen for changes to data views.
    fdvCollection.on('add', function(fdvModel){
      addFloatingDataView(ctx, {model: fdvModel});
    });
    fdvCollection.on('remove', function(fdvModel){
      removeFloatingDataView(ctx, {model: fdvModel});
    });

    updateInvitation(ctx);
  };

  var updateInvitation = function(ctx){
    var fdvCollection = ctx.model.get('floating_data_views');
    var $invitation = ctx.floatingDataViews.$invitation;
    if (! fdvCollection || ! fdvCollection.length){
      $invitation.fadeIn();
    }
    else{
      $invitation.fadeOut();
    }
  };

  // View that combines DataView and Window models.
  var FloatingDataView = Backbone.View.extend({

    initialize: function(opts){
      this.ctx = opts.ctx;
      this.opts = opts;

      if (! this.model.get('window')){
        this.model.set('window', createDefaultWindowModel(this.ctx, this.opts.window));
      }

      this.initialRender();

      // Connect window events to data view.
      this.window.on("resize", function(){
        if (this.dataView){
          Util.util.fillParent(this.dataView.el);
          this.dataView.trigger('resize');
        }
      }, this);

      this.window.on("dragStop", function(){
        if (this.dataView){
          this.dataView.trigger('pagePositionChange');
        }
      }, this);

      _.each(['resizeStop', 'deactive', 'activate'], function(event){
          this.window.on(event, _.bind(function(){
            if (this.dataView){
              this.dataView.trigger(event);
            }
          }, this));
      }, this);

      this.window.on("close", this.remove, this);

      // Bump counter.
      this.ctx.floatingDataViews.counter += 1;

      // Listen for ready event.
      this.on("ready", this.onReady, this);
    },

    initialRender: function(){
      this.renderWindow();
      this.renderDataView();
      if (this.dataView && this.dataView.el){
        $(this.window.getBody()).append(this.dataView.el);
      }
    },

    renderWindow : function(){
      var $dataViews = $(this.ctx.floatingDataViews.$container);
      var dvOffset = $dataViews.offset();

      this.window = new Windows.views.WindowView({
        model: this.model.get('window'),
        minimizable: false,
        maximizable: false,
        caller: $dataViews,
        containment: $(this.ctx.floatingDataViews.$constraint)
      });
    },

    renderDataView: function(){
      this.dataView = new DataView({
        model: this.model.get('dataView')
      })
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
      this.model.collection.remove(this.model);
      this.dataView.trigger('remove');
      this.window.trigger('remove');
    }
  });

  var addFloatingDataView = function(ctx, opts){

    var model = opts.model || new Backbone.Model();

    // Create floating data view.
    var floatingDataView = new FloatingDataView({
      model: model,
      ctx: ctx
    });

    ctx.subViews[model.cid] = floatingDataView;

    // Initialize and connect data view.
    initializeDataView(ctx, floatingDataView.dataView);
    connectDataView(ctx, floatingDataView.dataView);

    // Trigger ready if initialized.
    if (ctx.initialized){
      floatingDataView.trigger('ready');
    }

    updateInvitation(ctx);

    return floatingDataView;

  };

  var removeFloatingDataView = function(ctx, opts){
    delete ctx.subViews[opts.model.cid];
    updateInvitation(ctx);
  };

  var initializeDataView = function(ctx, dataView){
  };

  var connectDataView = function(ctx, dataView){
  };

  // Create default data view window model.
  var createDefaultWindowModel = function(ctx, opts){
    opts = opts || {};

    // Get data views container offset.
    var dvOffset = ctx.floatingDataViews.$container.offset();

    // Set default title.
    opts.title = opts.title || 'Window';

    // Add window number to title.
    opts.title = _s.sprintf("%d | %s", ctx.floatingDataViews.counter, opts.title);

    // Merge with defaults.
    opts = _.extend({
      "inline-block": true,
      "width": ctx.floatingDataViews.defaults.width,
      "height": ctx.floatingDataViews.defaults.height,
      // The next two lines slightly offset successive views.
      "x": (ctx.floatingDataViews.counter % 5) * 20,
      "y": (ctx.floatingDataViews.counter % 5) * 20,
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

  var actionHandlers = {};
  actionHandlers.dataViews_createFloatingDataView = function(opts){
    createFloatingDataView(opts);
  };

  // Objects to expose.
  var dataViewUtil = {
    actionHandlers: actionHandlers,
    setUpDataViews: setUpDataViews,
    setUpWindows: setUpWindows,
    addFloatingDataView: addFloatingDataView,
  };
  return dataViewUtil;
});
