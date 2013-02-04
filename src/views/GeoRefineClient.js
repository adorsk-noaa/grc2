define([
       'jquery',
       'backbone',
       'underscore',
       '_s',
       'text!./templates/GeoRefineClient.html',
       './util/actions',
       './util/floatingDataViews',
       './util/serialization',
       'qtip',
],
function($, Backbone, _, _s, GeoRefineClientTemplate, ActionsUtil, FloatingDataViewsUtil, SerializationUtil, qtip){

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
      'click .saveTestState': 'saveTestState',
    },

    saveTestState: function(){
      console.log("sts", this.model);
      var reg = {};
      var serializedModel = SerializationUtil.serialize(this.model, reg);
      var state = {
        model: serializedModel,
        registry: reg,
      };
      var jsonState = JSON.stringify(state, null, 2);
      console.log("slength", jsonState.length);
      localStorage['testState'] = jsonState;
    },

    initialize: function(opts){
      var _this = this;
      opts = opts || {};
      this.config = opts.config || {};

      $(this.el).addClass('georefine-client');

      this.subViews = {};

      this.on('ready', this.onReady, this);

      this.tokens = {
        PROJECT_STATIC_DIR: this.config.project_static_dir
      };

      // Parse url hash for options.
      var hash = window.location.hash;

      // Parse state key.
      if (keyMatch = new RegExp('stateKey=(.*)').exec(hash)){
        opts.stateKey = keyMatch[1];
      }
      if (new RegExp('testState').exec(hash)){
        opts.testState = true;
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
            var serializedState = JSON.parse(data.s);
            _this.state = _this.deserializeState(serializedState);
            stateDeferred.resolve();
          }
        });
      }
      else if (opts.testState) {
        try {
          var serializedState = JSON.parse(localStorage['testState']);
          console.log("ss: ", serializedState);
          var model = SerializationUtil.deserialize({
            obj: serializedState.model,
            serializedRegistry: serializedState.registry,
          });
          _this.state = {
            model: model,
          };
          console.log("ds: ", _this.state);
          stateDeferred.resolve();
        }
        catch (err){
          throw err;
          stateDeferred.reject();
        }
      }

      // Otherwise if serialized state was passed in options...
      // @TODO: fix this.
      else if (opts.serializedState){
      }

      // Otherwise, get state from config.
      else{
        _this.state = {}
        stateDeferred.resolve();
      }

      stateDeferred.fail(function(){
        console.log('fail');
      });

      // When stateDeferred resolves, continue...
      stateDeferred.then(_.bind(this.afterLoadState, this));
    },

    afterLoadState: function(){
      console.log('after load state');
      this.model = this.state.model || new Backbone.Model();

      if (! this.model.get('floating_data_views')){
        this.model.set('floating_data_views', new Backbone.Collection());
      }

      this.initialRender();

      // Execute initial actions.
      var actionsDeferred = null;
      if (this.state.initialActions){
        actionsDeferred = ActionsUtil.executeActions(this.state.initialActions);
      }
      else{
        actionsDeferred = $.Deferred();
        actionsDeferred.resolve();
      }

      // When initial actions are completed, continue...
      actionsDeferred.done(_.bind(this.postInitialize, this));
    },

    postInitialize: function(){
      this.initialized = true;

      // Listen for window resize events.
      this.on('resize', this.resize, this);
      var _this = this;
      var onWindowResize = _.bind(function(){
        if (this._windowResizeTimeout){
          clearTimeout(this.windowResizeTimeout);
        }
        this.windowResizeTimeout = setTimeout(_.bind(function(){
          this._windowResizeTimeout = false;
          this.trigger('resize');
        }, this), 200);
      }, this);
      $(window).resize(onWindowResize);

      this.trigger("ready");
    },

    initialRender: function(){
      var _this = this;
      $(this.el).html(_.template(GeoRefineClientTemplate, {model: this.model}));

      $('.showTestState', this.el).qtip({
        content: {
          text: function(){
            return localStorage['testState'] || 'empty';
          }
        },
        show: {
          event: 'click'
        },
        hide: {
          fixed: true,
          event: 'unfocus',
        }
      });

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
            var fdvCollection = this.model.get('floating_data_views');
            fdvCollection.add(new Backbone.Model({
              dataView: dvModelCopy,
            }));
          }, this));

          $launchersList.append($launcher);

        }, this);
      }, this);
    },

    onReady: function(){
      this.resize();
      _.each(this.subViews, function(subView){
        subView.trigger('ready');
      }, this);

      // TESTING
      var dvModel = GeoRefine.config.dataViewGroups[0].models[0];
      var fdvCollection = this.model.get('floating_data_views');
      //fdvCollection.add(SerializationUtil.copy(dvModel));
    },

    resize: function(){
      var headerPos = this.$headerCell.position();
      var headerHeight = this.$headerCell.outerHeight(true);
      this.$dvCell.css('top', headerPos.top + headerHeight);
      _.each(this.subViews, function(subView){
        subView.trigger('resize');
      }, this);
    },

    resizeStop: function(){
      _.each(this.subViews, function(subView){
        subView.trigger('resizeStop');
      }, this);
    },

    cloneTest: function(){
      var serializationRegistry = {};
      serializedModel = SerializationUtil.serialize(window.fdv.model, serializationRegistry);
      fdvModel = SerializationUtil.deserialize({
        obj: serializedModel, 
        serializedRegistry: serializationRegistry,
      });
      FloatingDataViewsUtil.addFloatingDataView(this, {
        model: fdvModel
      });
    },

  });

  return GeoRefineClientView;

});

