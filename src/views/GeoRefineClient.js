define([
       'jquery',
       'backbone',
       'underscore',
       '_s',
       'text!./templates/GeoRefineClient.html',
       './util/actions',
       './util/floatingDataViews',
       './util/serialization',
],
function($, Backbone, _, _s, GeoRefineClientTemplate, ActionsUtil, FloatingDataViewsUtil, SerializationUtil){

  // Setup GeoRefine singleton.
  if (! GeoRefine){
    GeoRefine = {};
  }

  // Run initialize function if provided.
  if (GeoRefine.initialize){
    GeoRefine.initialize($, Backbone, _, _s);
  }

  var GeoRefineClientView = Backbone.View.extend({
    events: {
      'click .addView': 'addDataView'
    },

    initialize: function(opts){


      var _this = this;
      opts = opts || {};
      this.config = opts.config || {};

      $(this.el).addClass('georefine-client');

      this.on('ready', this.onReady, this);

      this.tokens = {
        PROJECT_STATIC_DIR: this.config.project_static_dir
      };

      // Parse url hash for options.
      var hash = window.location.hash;

      // Parse state key.
      if (keyMatch = new RegExp('\/stateKey=(.*)\/').exec(hash)){
        opts.stateKey = keyMatch[1];
      }

      // Deferred object for handling state load.
      var stateDeferred = $.Deferred();

      // If a state key was given...
      if (opts.stateKey){
        // Load the state from the server.
        $.ajax({
          url: _this.config.keyedStringsEndpoint + '/getString/' + opts.stateKey,
          type: 'GET',
          success: function(data){
            serializedState = JSON.parse(data.s);
            _this.state = _this.deserializeState(serializedState);
            stateDeferred.resolve();
          }
        });
      }

      // Otherwise if serialized state was passed in options...
      // @TODO: fix this.
      else if (opts.serializedState){
      }

      // Otherwise, get state from config.
      else{
        var configState = _this.config.defaultInitialState || {};
        _this.state = _this.deserializeConfigState(configState);
        stateDeferred.resolve();
      }

      // When stateDeferred resolves, continue...
      stateDeferred.then(function(){
        _this.initialRender();

        // Execute initial actions.
        var actionsDeferred = null;
        if (_this.state.initialActions){
          actionsDeferred = ActionsUtil.executeActions(_this.state.initialActions);
        }
        else{
          actionsDeferred = $.Deferred();
          actionsDeferred.resolve();
        }

        // When initial actions are completed, continue...
        actionsDeferred.done(function(){
          _this.initialized = true;
          _this.trigger("ready");
          _this.postInitialize();

        });

      });
    },

    // @TODO: figure out how to do this more modularly, how to handle common registries.
    deserializeState: function(serializedState, deserializationRegistry, serializationRegistry){
    },

    deserializeConfigState: function(configState){
      if (! configState){
        return {};
      }
      return {};
    },

    postInitialize: function(){
      // Listen for window resize events.
      this.on('resize', this.resize, this);
      var _this = this;
      var onWindowResize = function(){
        if (_this._windowResizeTimeout){
          clearTimeout(_this.windowResizeTimeout);
        }
        _this.windowResizeTimeout = setTimeout(function(){
          _this._windowResizeTimeout = false;
          _this.trigger('resize');
        }, 200);
      };
      $(window).resize(onWindowResize);

      // Call post initialize hooks.
    },

    initialRender: function(){
      var _this = this;
      var html = _.template(GeoRefineClientTemplate, {model: this.model});
      $(this.el).html(html);
      this.$qFieldSelector = $('#qFieldSelector');
      //_.each(this.config.dataViewConfigurations, function(dvConfig, key){
      _.each(GeoRefine.config.dataViewConfigurations, function(dvConfig, key){
        $('<option value="' + key + '">' + key + '</option>').appendTo(_this.$qFieldSelector);
      });
      FloatingDataViewsUtil.setUpWindows(this);
      FloatingDataViewsUtil.setUpDataViews(this);
    },

    onReady: function(){
      this.resize();
      // TESTING
      for (var k in GeoRefine.config.dataViewConfigurations){
        this.$qFieldSelector.val(k);
        break;
      }
      this.addDataView();
    },

    resize: function(){
    },

    addDataView: function(){
      // @TODO: get this dynamically.
      var configKey = this.$qFieldSelector.val();
      var dataViewModel = GeoRefine.config.dataViewConfigurations[configKey].clone();
      // Serialize and deserialize the model to clone it.
      var serializationRegistry = {};
      var deserializationRegistry = {};
      serializedModel = SerializationUtil.serialize(dataViewModel, serializationRegistry);
      dataViewModel = SerializationUtil.deserialize(serializedModel, deserializationRegistry, serializationRegistry);
      console.log(dataViewModel);
      FloatingDataViewsUtil.addFloatingDataView(this, {
        dataViewModel: dataViewModel
      });
    }

  });

  return GeoRefineClientView;

});

