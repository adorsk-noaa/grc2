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
      'click .addView': 'addDataView',
      'click .cloneTest': 'cloneTest'
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
        _this.model = _this.state.model || new Backbone.Model();
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
      $(this.el).html(_.template(GeoRefineClientTemplate, {model: this.model}));
      this.$headerCell = $('.header-cell', this.el);
      this.$launchersTable = $('.launchers-table', this.$headerCell);
      this.$dvCell = $('.data-views-cell', this.el);

      this.renderDataViewLaunchers();
      this.resize();

      FloatingDataViewsUtil.setUpWindows(this);
      FloatingDataViewsUtil.setUpDataViews(this);
    },

    renderDataViewLaunchers: function(){
      _.each(GeoRefine.config.dataViewGroups, function(dvGroup){
        var $groupRow = $('<tr class="launchers-group"></tr>');
        this.$launchersTable.append($groupRow);

        var $groupLabel = $('<td class="label"><h3>' + dvGroup.label + ': </h3></td>');
        $groupRow.append($groupLabel);

        var $launchersCell = $('<td class="launchers"></td>').appendTo($groupRow);
        var $launchersList = $('<ul></ul>').appendTo($launchersCell);

        _.each(dvGroup.models, function(dvModel){
          var $launcher = $('<li class="launcher">' + dvModel.get('label') + '</li>');

          $launcher.on('click', _.bind(function(){
            dvModelCopy = SerializationUtil.copy(dvModel);
            this.addDataView(dvModelCopy);
          }, this));

          $launchersList.append($launcher);

        }, this);
      }, this);
    },

    onReady: function(){
      this.resize();
      // TESTING
      var dvModel = GeoRefine.config.dataViewGroups[0].models[0];
      this.addDataView(SerializationUtil.copy(dvModel));
    },

    resize: function(){
      var headerPos = this.$headerCell.position();
      var headerHeight = this.$headerCell.outerHeight(true);
      this.$dvCell.css('top', headerPos.top + headerHeight);
    },

    // TODO: change this to add from model.
    addDataView: function(dataViewModel){
      // @TODO: get this dynamically.
      var fdv = FloatingDataViewsUtil.addFloatingDataView(this, {
        model: new Backbone.Model({
          dataView: dataViewModel
        })
      });
      // TESTING
      if (! window.fdv){
        window.fdv = fdv;
      }
    },

    cloneTest: function(){
      var serializationRegistry = {};
      var deserializationRegistry = {};
      serializedModel = SerializationUtil.serialize(window.fdv.model, serializationRegistry);
      fdvModel = SerializationUtil.deserialize(serializedModel, deserializationRegistry, serializationRegistry);
      FloatingDataViewsUtil.addFloatingDataView(this, {
        model: fdvModel
      });
    },

  });

  return GeoRefineClientView;

});

