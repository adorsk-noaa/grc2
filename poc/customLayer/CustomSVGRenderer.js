define(
  [
    "openlayers"
],
function(ol){

  OpenLayers.Renderer.CustomSVGRenderer = OpenLayers.Class(OpenLayers.Renderer, {
    CLASS_NAME: "OpenLayers.Renderer.CustomSVGRenderer",

    xmlns: "http://www.w3.org/2000/svg",
    xlinkns: "http://www.w3.org/1999/xlink",
    MAX_PIXEL: 15000,
    translationParameters: null,
    symbolMetrics: null,

    initialize: function(containerID) {
    },

    translate: function(x, y) {
      var transformString = "";
      if (x || y) {
        transformString = "translate(" + x + "," + y + ")";
      }
      this.root.setAttributeNS(null, "transform", transformString);
      this.translationParameters = {x: x, y: y};
      return true;
    },

    setSize: function(size) {
      OpenLayers.Renderer.prototype.setSize.apply(this, arguments);
      this.rendererRoot.setAttributeNS(null, "width", this.size.w);
      this.rendererRoot.setAttributeNS(null, "height", this.size.h);
    },

    getNodeType: function(geometry, style) {
      var nodeType = null;
      switch (geometry.CLASS_NAME) {
        case "OpenLayers.Geometry.Point":
          if (style.externalGraphic) {
          nodeType = "image";
        } else if (this.isComplexSymbol(style.graphicName)) {
          nodeType = "svg";
        } else {
          nodeType = "circle";
        }
        break;
        case "OpenLayers.Geometry.Rectangle":
          nodeType = "rect";
        break;
        case "OpenLayers.Geometry.LineString":
          nodeType = "polyline";
        break;
        case "OpenLayers.Geometry.LinearRing":
          nodeType = "polygon";
        break;
        case "OpenLayers.Geometry.Polygon":
          case "OpenLayers.Geometry.Curve":
          nodeType = "path";
        break;
        default:
          break;
      }
      return nodeType;
    },

    setStyle: function(node, style, options) {
      style = style  || node._style;
      options = options || node._options;
      var r = parseFloat(node.getAttributeNS(null, "r"));
      var widthFactor = 1;
      var pos;
      if (node._geometryClass == "OpenLayers.Geometry.Point" && r) {
        node.style.visibility = "";
        if (style.graphic === false) {
          node.style.visibility = "hidden";
        } else if (style.externalGraphic) {
          pos = this.getPosition(node);
          if (style.graphicTitle) {
            node.setAttributeNS(null, "title", style.graphicTitle);
            //Standards-conformant SVG
            // Prevent duplicate nodes. See issue https://github.com/openlayers/openlayers/issues/92
            var titleNode = node.getElementsByTagName("title");
            if (titleNode.length > 0) {
              titleNode[0].firstChild.textContent = style.graphicTitle;
            } else {
              var label = this.nodeFactory(null, "title");
              label.textContent = style.graphicTitle;
              node.appendChild(label);
            }
          }
          if (style.graphicWidth && style.graphicHeight) {
            node.setAttributeNS(null, "preserveAspectRatio", "none");
          }
          var width = style.graphicWidth || style.graphicHeight;
          var height = style.graphicHeight || style.graphicWidth;
          width = width ? width : style.pointRadius*2;
          height = height ? height : style.pointRadius*2;
          var xOffset = (style.graphicXOffset != undefined) ?
            style.graphicXOffset : -(0.5 * width);
          var yOffset = (style.graphicYOffset != undefined) ?
            style.graphicYOffset : -(0.5 * height);

          var opacity = style.graphicOpacity || style.fillOpacity;

          node.setAttributeNS(null, "x", (pos.x + xOffset).toFixed());
          node.setAttributeNS(null, "y", (pos.y + yOffset).toFixed());
          node.setAttributeNS(null, "width", width);
          node.setAttributeNS(null, "height", height);
          node.setAttributeNS(this.xlinkns, "href", style.externalGraphic);
          node.setAttributeNS(null, "style", "opacity: "+opacity);
          node.onclick = OpenLayers.Renderer.SVG.preventDefault;
        } else if (this.isComplexSymbol(style.graphicName)) {
          // the symbol viewBox is three times as large as the symbol
          var offset = style.pointRadius * 3;
          var size = offset * 2;
          var src = this.importSymbol(style.graphicName);
          pos = this.getPosition(node);
          widthFactor = this.symbolMetrics[src.id][0] * 3 / size;

          // remove the node from the dom before we modify it. This
          // prevents various rendering issues in Safari and FF
          var parent = node.parentNode;
          var nextSibling = node.nextSibling;
          if(parent) {
            parent.removeChild(node);
          }

          // The more appropriate way to implement this would be use/defs,
          // but due to various issues in several browsers, it is safer to
          // copy the symbols instead of referencing them.
          // See e.g. ticket http://trac.osgeo.org/openlayers/ticket/2985
          // and this email thread
          // http://osgeo-org.1803224.n2.nabble.com/Select-Control-Ctrl-click-on-Feature-with-a-graphicName-opens-new-browser-window-tc5846039.html
          node.firstChild && node.removeChild(node.firstChild);
          node.appendChild(src.firstChild.cloneNode(true));
          node.setAttributeNS(null, "viewBox", src.getAttributeNS(null, "viewBox"));

          node.setAttributeNS(null, "width", size);
          node.setAttributeNS(null, "height", size);
          node.setAttributeNS(null, "x", pos.x - offset);
          node.setAttributeNS(null, "y", pos.y - offset);

          // now that the node has all its new properties, insert it
          // back into the dom where it was
          if(nextSibling) {
            parent.insertBefore(node, nextSibling);
          } else if(parent) {
            parent.appendChild(node);
          }
        } else {
          node.setAttributeNS(null, "r", style.pointRadius);
        }

        var rotation = style.rotation;

        if ((rotation !== undefined || node._rotation !== undefined) && pos) {
          node._rotation = rotation;
          rotation |= 0;
          if (node.nodeName !== "svg") {
            node.setAttributeNS(null, "transform",
                                "rotate(" + rotation + " " + pos.x + " " +
                                  pos.y + ")");
          } else {
            var metrics = this.symbolMetrics[src.id];
            node.firstChild.setAttributeNS(null, "transform", "rotate("
                                           + rotation + " "
                                           + metrics[1] + " "
                                           + metrics[2] + ")");
          }
        }
      }

      if (options.isFilled) {
        node.setAttributeNS(null, "fill", style.fillColor);
        node.setAttributeNS(null, "fill-opacity", style.fillOpacity);
      } else {
        node.setAttributeNS(null, "fill", "none");
      }

      if (options.isStroked) {
        node.setAttributeNS(null, "stroke", style.strokeColor);
        node.setAttributeNS(null, "stroke-opacity", style.strokeOpacity);
        node.setAttributeNS(null, "stroke-width", style.strokeWidth * widthFactor);
        node.setAttributeNS(null, "stroke-linecap", style.strokeLinecap || "round");
        // Hard-coded linejoin for now, to make it look the same as in VML.
        // There is no strokeLinejoin property yet for symbolizers.
        node.setAttributeNS(null, "stroke-linejoin", "round");
        style.strokeDashstyle && node.setAttributeNS(null,
                                                     "stroke-dasharray", this.dashStyle(style, widthFactor));
      } else {
        node.setAttributeNS(null, "stroke", "none");
      }

      if (style.pointerEvents) {
        node.setAttributeNS(null, "pointer-events", style.pointerEvents);
      }

      if (style.cursor != null) {
        node.setAttributeNS(null, "cursor", style.cursor);
      }

      return node;
    },

    dashStyle: function(style, widthFactor) {
      var w = style.strokeWidth * widthFactor;
      var str = style.strokeDashstyle;
      switch (str) {
        case 'solid':
          return 'none';
        case 'dot':
          return [1, 4 * w].join();
        case 'dash':
          return [4 * w, 4 * w].join();
        case 'dashdot':
          return [4 * w, 4 * w, 1, 4 * w].join();
        case 'longdash':
          return [8 * w, 4 * w].join();
        case 'longdashdot':
          return [8 * w, 4 * w, 1, 4 * w].join();
        default:
          return OpenLayers.String.trim(str).replace(/\s+/g, ",");
      }
    },

    createNode: function(type, id) {
      var node = document.createElementNS(this.xmlns, type);
      if (id) {
        node.setAttributeNS(null, "id", id);
      }
      return node;
    },

    nodeTypeCompare: function(node, type) {
      return (type == node.nodeName);
    },

    createRenderRoot: function() {
      var svg = this.nodeFactory(this.container.id + "_svgRoot", "svg");
      svg.style.display = "block";
      return svg;
    },

    createRoot: function(suffix) {
      return this.nodeFactory(this.container.id + suffix, "g");
    },

    createDefs: function() {
      var defs = this.nodeFactory(this.container.id + "_defs", "defs");
      this.rendererRoot.appendChild(defs);
      return defs;
    },

    drawPoint: function(node, geometry) {
      return this.drawCircle(node, geometry, 1);
    },

    drawCircle: function(node, geometry, radius) {
    },

    drawLineString: function(node, geometry) {
      var componentsResult = this.getComponentsString(geometry.components);
      if (componentsResult.path) {
        node.setAttributeNS(null, "points", componentsResult.path);
        return (componentsResult.complete ? node : null);  
      } else {
        return false;
      }
    },

    drawLinearRing: function(node, geometry) {
      var componentsResult = this.getComponentsString(geometry.components);
      if (componentsResult.path) {
        node.setAttributeNS(null, "points", componentsResult.path);
        return (componentsResult.complete ? node : null);  
      } else {
        return false;
      }
    },

    drawPolygon: function(node, geometry) {
      var d = "";
      var draw = true;
      var complete = true;
      var linearRingResult, path;
      for (var j=0, len=geometry.components.length; j<len; j++) {
        d += " M";
        linearRingResult = this.getComponentsString(
          geometry.components[j].components, " ");
          path = linearRingResult.path;
          if (path) {
            d += " " + path;
            complete = linearRingResult.complete && complete;
          } else {
            draw = false;
          }
      }
      d += " z";
      if (draw) {
        node.setAttributeNS(null, "d", d);
        node.setAttributeNS(null, "fill-rule", "evenodd");
        return complete ? node : null;
      } else {
        return false;
      }
    },

    drawRectangle: function(node, geometry) {
      var resolution = this.getResolution();
      var x = ((geometry.x - this.featureDx) / resolution + this.left);
      var y = (this.top - geometry.y / resolution);

      if (this.inValidRange(x, y)) {
        node.setAttributeNS(null, "x", x);
        node.setAttributeNS(null, "y", y);
        node.setAttributeNS(null, "width", geometry.width / resolution);
        node.setAttributeNS(null, "height", geometry.height / resolution);
        return node;
      } else {
        return false;
      }
    },

    getComponentsString: function(components, separator) {
      var renderCmp = [];
      var complete = true;
      var len = components.length;
      var strings = [];
      var str, component;
      for(var i=0; i<len; i++) {
        component = components[i];
        renderCmp.push(component);
        str = this.getShortString(component);
        strings.push(str);
      }

      return {
        path: strings.join(separator || ","),
        complete: complete
      };
    },

    getShortString: function(point) {
      return point.x + "," + point.y;
    },

    getPosition: function(node) {
      return({
        x: parseFloat(node.getAttributeNS(null, "cx")),
        y: parseFloat(node.getAttributeNS(null, "cy"))
      });
    }
  });
  console.log("CustomSVGRenderer Defined");
});
