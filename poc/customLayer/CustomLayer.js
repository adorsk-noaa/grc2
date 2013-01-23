define(
  [
    "openlayers",
    "./CustomSVGRenderer"
],
function(ol, CustomSVGRenderer){

  OpenLayers.Layer.CustomLayer = OpenLayers.Class(OpenLayers.Layer, {
    CLASS_NAME: "OpenLayers.Layer.CustomLayer",

    isBaseLayer: false,
    isFixed: false,
    features: null,
    selectedFeatures: null,
    unrenderedFeatures: null,
    style: null,
    styleMap: null,
    drawn: false,
    ratio: 1,

    initialize: function(name, options) {
      console.log("initialize", arguments);
      OpenLayers.Layer.prototype.initialize.apply(this, arguments);
      this.renderer = new OpenLayers.Renderer.SVG(this.div, this.rendererOptions);
      if (!this.styleMap) {
        this.styleMap = new OpenLayers.StyleMap();
      }
      this.features = [];
      this.selectedFeatures = [];
      this.unrenderedFeatures = {};
    },

    setMap: function(map){
      console.log("setMap", arguments);
      OpenLayers.Layer.prototype.setMap.apply(this, arguments);
      this.renderer.map = this.map;
      var newSize = this.map.getSize();
      newSize.w = newSize.w * this.ratio;
      newSize.h = newSize.h * this.ratio;
      this.renderer.setSize(newSize);
    },

    onMapResize: function() {
      console.log("onMapResize", arguments);
      OpenLayers.Layer.prototype.onMapResize.apply(this, arguments);
      var newSize = this.map.getSize();
      newSize.w = newSize.w * this.ratio;
      newSize.h = newSize.h * this.ratio;
      this.renderer.setSize(newSize);
    },

    moveTo: function(bounds, zoomChanged, dragging) {
      console.log("moveTo", arguments);
      OpenLayers.Layer.prototype.moveTo.apply(this, arguments);

      var coordSysUnchanged = true;
      if (!dragging) {
        this.renderer.root.style.visibility = 'hidden';

        var viewSize = this.map.getSize(),
        viewWidth = viewSize.w,
        viewHeight = viewSize.h,
        offsetLeft = (viewWidth / 2 * this.ratio) - viewWidth / 2,
        offsetTop = (viewHeight / 2 * this.ratio) - viewHeight / 2;
        offsetLeft += parseInt(this.map.layerContainerDiv.style.left, 10);
        offsetLeft = -Math.round(offsetLeft);
        offsetTop += parseInt(this.map.layerContainerDiv.style.top, 10);
        offsetTop = -Math.round(offsetTop);

        this.div.style.left = offsetLeft + 'px';
        this.div.style.top = offsetTop + 'px';

        var extent = this.map.getExtent().scale(this.ratio);
        coordSysUnchanged = this.renderer.setExtent(extent, zoomChanged);

        this.renderer.root.style.visibility = 'visible';

        // Force a reflow on gecko based browsers to prevent jump/flicker.
        // This seems to happen on only certain configurations; it was originally
        // noticed in FF 2.0 and Linux.
        if (OpenLayers.IS_GECKO === true) {
          this.div.scrollLeft = this.div.scrollLeft;
        }

        if (!zoomChanged && coordSysUnchanged) {
          for (var i in this.unrenderedFeatures) {
            var feature = this.unrenderedFeatures[i];
            this.drawFeature(feature);
          }
        }
      }
      if (!this.drawn || zoomChanged || !coordSysUnchanged) {
        this.drawn = true;
        var feature;
        for(var i=0, len=this.features.length; i<len; i++) {
          this.renderer.locked = (i !== (len - 1));
          feature = this.features[i];
          this.drawFeature(feature);
        }
      }
    },

    addFeatures: function(features, options) {
      console.log("addFeatures", arguments);
      if (!(OpenLayers.Util.isArray(features))) {
        features = [features];
      }

      // Track successfully added features for featuresadded event, since
      // beforefeatureadded can veto single features.
      var featuresAdded = [];
      for (var i=0, len=features.length; i<len; i++) {
        if (i != (features.length - 1)) {
          this.renderer.locked = true;
        } else {
          this.renderer.locked = false;
        }
        var feature = features[i];

        if (this.geometryType &&
            !(feature.geometry instanceof this.geometryType)) {
          throw new TypeError('addFeatures: component should be an ' +
                              this.geometryType.prototype.CLASS_NAME);
        }

        feature.layer = this;

        if (!feature.style && this.style) {
          feature.style = OpenLayers.Util.extend({}, this.style);
        }

        featuresAdded.push(feature);
        this.features.push(feature);
        this.drawFeature(feature);
      }
    },

    drawFeature: function(feature, style) {
      console.log("drawFeature");
      if (!this.drawn) {
        return;
      }
      if (typeof style != "object") {
        if(!style && feature.state === OpenLayers.State.DELETE) {
          style = "delete";
        }
        var renderIntent = style || feature.renderIntent;
        style = feature.style || this.style;
        if (!style) {
          style = this.styleMap.createSymbolizer(feature, renderIntent);
        }
      }

      var drawn = this.renderer.drawFeature(feature, style);
      //TODO remove the check for null when we get rid of Renderer.SVG
      if (drawn === false || drawn === null) {
        this.unrenderedFeatures[feature.id] = feature;
      } else {
        delete this.unrenderedFeatures[feature.id];
      }
    }

  });

  console.log("defined CustomLayer");
});
