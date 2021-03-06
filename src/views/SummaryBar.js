define(
  [
    "jquery",
    "backbone",
    "underscore",
    "_s",
    "ui",
    "Util",
    "text!./templates/SummaryBar.html",
    "./util/filters",
],
function($, Backbone, _, _s, ui, Util, template, FiltersUtil){

  var SummaryBarView = Backbone.View.extend({

    initialize: function(opts){
      // Set default formatter if none given.
      if (! opts.formatter){
        this.formatter = _s.sprintf;
      }

      this.initialRender();

      this.model.on('change:data', this.onDataChange, this);
      this.model.on('change:primary_filters change:base_filters', this.updateActiveFilters, this);
      this.on('ready', this.onReady, this);
    },

    initialRender: function(){
      $(this.el).html(_.template(template));
      this.$activeFilters = $('.active-filters', this.el);
      this.updateActiveFilters();
    },

    onDataChange: function(){
      var data = this.model.get('data');

      // Do nothing if data is incomplete.
      if (! data || data.selected == null || data.total == null){
        return;
      }

      var format = '%s';
      var scale_type;
      var scale_mid;
      var qField = this.model.get('quantity_field');
      if (qField){
        format = qField.get('format');
        scale_mid = qField.get('scale_mid') || 0;
        scale_type = qField.get('scale_type') || 'sequential';
      }

      var formatted_selected = this.formatter(format, data.selected);
      var formatted_total = this.formatter(format, data.total);
      var percentage;
      if (data.total == 0 && data.selected == 0){
        percentage = 100.0;
      }
      else{
        percentage = 100.0 * data.selected/data.total;
      }

      $(".text .selected", this.el).html(formatted_selected);
      $(".text .total", this.el).html(_s.sprintf('(<span class="pct">%.1f%%</span> of %s total)', percentage, formatted_total));

      var scaleBarOpts = {
        $sbContainer: $('.scalebar-container', this.el),
        $selected: $('.scalebar-fill.selected', this.el),
        $total: $('.scalebar-fill.total', this.el),
        data: data,
        percentage: percentage,
      };

      if (scale_type == 'diverging'){
        this.formatDivergingScalebar(scaleBarOpts);
      }
      else{
        this.formatSequentialScalebar(scaleBarOpts);
      }

    },

    updateActiveFilters: function(){
      this.$activeFilters.empty();
      var combinedFilters = [];
      _.each(['base', 'primary'], function(category){
        var filterGroups = this.model.get(category + '_filters');
        combinedFilters.push.apply(
          combinedFilters, FiltersUtil.filterObjectGroupsToArray(filterGroups) || []);
      }, this);
      if (combinedFilters.length > 0){
        this.$activeFilters.append($('<h4>Active Filters:</h4>'));
        var $filtersList = $('<ul></ul>').appendTo(this.$activeFilters);
        _.each(combinedFilters, function(f){
          if (f.repr){
            $filtersList.append('<li>' + f.repr + '</li>');
          }
        }, this);
      }
    },

    formatDivergingScalebar: function(opts){
      opts.$sbContainer.removeClass('sequential');
      opts.$sbContainer.addClass('diverging');

      _.each(['total', 'selected'], function(ts){
        var neg = (opts.data[ts] < 0);
        var $sbFill = opts['$' + ts];
        var right = neg ? '50%' : '';
        var left = neg ? '' : '50%';
        $sbFill.toggleClass('negative', neg);
        $sbFill.css({
          left: left,
          right: right,
        })
      });
      opts.$total.css({
        width: '50%',
      });
      opts.$selected.css({
        width: opts.percentage * .5 + '%',
      });
    },

    formatSequentialScalebar: function(opts){
      opts.$sbContainer.removeClass('diverging');
      opts.$sbContainer.addClass('sequential');
      var neg = (opts.data.total < 0);
      var left = neg ? '' : 0;
      var right = neg ? 0 : '';

      _.each(['total', 'selected'], function(ts){
        var $sbFill = opts['$' + ts];
        $sbFill.toggleClass('negative', neg);
        $sbFill.css({
          left: left,
          right: right,
        })
      });
      opts.$total.css({
        width: '100%',
      });
      opts.$selected.css({
        width: opts.percentage + '%',
      });
    },

    // Update display on ready.
    onReady: function(){
      this.onDataChange();
    }


  });

  return SummaryBarView;
});

