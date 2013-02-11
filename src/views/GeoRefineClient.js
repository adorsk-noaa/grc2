define([
       'jquery',
       'backbone',
       'underscore',
       '_s',
       'text!./templates/GeoRefineClient.html',
       './util/actions',
       './util/floatingDataViews',
       './util/serialization',
       './util/format',
       'qtip',
],
function($, Backbone, _, _s, GeoRefineClientTemplate, ActionsUtil, FloatingDataViewsUtil, SerializationUtil, FormatUtil, qtip){

  // Setup GeoRefine singleton.
  if (! GeoRefine){
    GeoRefine = {};
  }

  // Run pre initializeHooks
  var sortedHooks = _.sortBy(GeoRefine.preInitializeHooks, function(hook){
    return hook.weight;
  });
  _.each(sortedHooks, function(hook){
    hook.fn($, Backbone, _, _s);
  });

  var GeoRefineClientView = Backbone.View.extend({
    events: {
      'click .saveTestState': 'saveTestState',
    },

    saveTestState: function(){
      console.log("sts", this.model);
      var jsonState = this.getJsonState(null, 2);
      console.log("slength", jsonState.length);
      localStorage['testState'] = jsonState;
    },

    getJsonState: function(){
      var reg = {};
      var serializedModel = SerializationUtil.serialize(this.model, reg);
      var state = {
        model: serializedModel,
        registry: reg,
      };
      return JSON.stringify(state, arguments);
    },

    deserializeJsonState: function(jsonState){
      var serializedState = JSON.parse(jsonState);
      var model = SerializationUtil.deserialize({
        obj: serializedState.model,
        serializedRegistry: serializedState.registry,
      });
      return {
        model: model,
      };
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

      // Parse shareLinkUrlTemplate.
      var shareMatch;
      if (shareMatch = new RegExp('/shareLinkUrlTemplate=(.*?)/').exec(hash)){
        opts.shareLinkUrlTemplate = decodeURIComponent(shareMatch[1]);
      }
      if (opts.shareLinkUrlTemplate){
        GeoRefine.config.shareLinkUrlTemplate = opts.shareLinkUrlTemplate;
      }

      // Parse state key.
      if (keyMatch = new RegExp('/stateKey=(.*?)/').exec(hash)){
        opts.stateKey = decodeURIComponent(keyMatch[1]);
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
          url: GeoRefine.app.keyedStringsEndpoint + '/getString/' + opts.stateKey,
          type: 'GET',
          success: function(data){
            _this.state = _this.deserializeJsonState(data.s);
            stateDeferred.resolve();
          }
        });
      }
      else if (opts.testState) {
        try {
          _this.state = _this.deserializeJsonState(localStorage['testState']);
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

      _.each(GeoRefine.postInitializeHooks, function(hook){
        hook($,Backbone,_, _s);
      });

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
      this.$dvContainer = $('.data-views-container', this.el);

      this.renderInfoLauncher();
      this.renderDataViewLaunchers();
      this.renderShareLauncher();
      this.resize();

      FloatingDataViewsUtil.setUpWindows(this);
      FloatingDataViewsUtil.setUpDataViews(this);
    },

    renderInfoLauncher: function(){
      if (GeoRefine.config.projectInfo){
        var projectInfo = GeoRefine.config.projectInfo;
        var $container = $('<div class="info-launcher-container"></div>').prependTo(this.$headerCell);
        var $launcher = $('<a class="info-launcher"</a>').appendTo($container);
        var label = projectInfo.label || 'info';
        var formattedLabel = FormatUtil.GeoRefineTokenFormatter(label);
        $launcher.html(formattedLabel);

        var launcherHref = 'javascript:{}';
        if (projectInfo.infoLink){
          $launcher.attr('href', FormatUtil.GeoRefineTokenFormatter(projectInfo.infoLink));
          $launcher.attr('target', '_blank');
        }
        else{
          $launcher.attr('href', 'javascript:{}');
          var $content =  $('<div class="content" style="display: none"></div>').appendTo($launcher);
          var content = projectInfo.content || '';
          var formattedContent = FormatUtil.GeoRefineTokenFormatter(content);
          $content.html(formattedContent);

          $launcher.qtip({
            content: {
              text: $content,
            },
            position: {
              container: $(this.el),
            },
            show: {
              event: 'click'
            },
            hide: {
              fixed: true,
              event: 'unfocus'
            },
            style: {
              classes: 'project-info-tooltip info-tip',
              tip: false
            },
            events: {
              render: function(event, api){
                $(api.elements.target).on('click', function(clickEvent){
                  clickEvent.preventDefault();
                  api.toggle();
                });
              },
            }
          });
        }
      }
    },

    renderShareLauncher: function(){
      var _this = this;
      $shareLauncher = $('.share-launcher', this.el);
      if (GeoRefine.config.noShareLauncher){
        $shareLauncher.css({display: 'none'});
        return;
      }
      var $slForm = $('<div><div class="description">Use the link below to share the current configuration.</div><input class="link" type="text"></div>');
      $shareLauncher.qtip({
        content: {
          text: $slForm,
        },
        position: {
          container: $(this.el),
        },
        show: {
          event: 'click'
        },
        hide: {
          fixed: true,
          event: 'unfocus'
        },
        style: {
          classes: 'share-link-form-tooltip',
          tip: false
        },
        events: {
          render: function(event, api){
            // Toggle when target is clicked.
            $(api.elements.target).on('click', function(clickEvent){
              clickEvent.preventDefault();
              api.toggle();
            });
          },

          show: function(event, api){
            // Get state.
            var oldJsonState = _this.jsonState;
            var newJsonState = _this.getJsonState();
            if (oldJsonState == newJsonState){
              return;
            }
            _this.jsonState = newJsonState;

            // Set loading text.
            var $linkInput = $('input.link', $slForm);
            $linkInput.prop('disabled', true);
            $linkInput.val('  loading...');
            $linkInput.addClass('loading');
            var deferred = $.ajax({
              url: GeoRefine.app.keyedStringsEndpoint + '/getKey/',
              type: 'POST',
              data: {'s': _this.jsonState},
            });

            // When key request finishes...
            deferred.then(function(data){
              var shareLinkUrlTemplate = GeoRefine.config.shareLinkUrlTemplate;
              if (! shareLinkUrlTemplate){
                shareLinkUrlTemplate = window.location.origin + window.location.pathname + '#/stateKey={{STATE_KEY}}/';
              }
              // Assemble link url from the template.
              var linkUrl = shareLinkUrlTemplate.replace('{{STATE_KEY}}', data.key);
              // Fill in link url in the tooltip after a slight delay.
              setTimeout(function(){
                $linkInput.val(linkUrl);
                $linkInput.prop('size', linkUrl.length);
                $linkInput.removeClass('loading');
                $linkInput.prop('disabled', false);
              }, 1500);

            });
          }
        }
      });
    },

    renderDataViewLaunchers: function(){
      var _this = this;
      _.each(GeoRefine.config.dataViewGroups, function(dvGroup){
        var $groupRow = $('<tr class="launchers-group"></tr>');
        this.$launchersTable.append($groupRow);

        var $groupLabelCell = $('<td class="label"></td>');
        var $groupLabel = $('<h3>' + dvGroup.label + ': </h3>').appendTo($groupLabelCell);
        $groupLabelCell.appendTo($groupRow);

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
    },

    resize: function(){
      var headerPos = this.$headerCell.position();
      var headerHeight = this.$headerCell.outerHeight(true);
      this.$dvContainer.css('top', headerHeight);
      $('.data-views-invitation', this.el).css('top', headerHeight + 40);
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

