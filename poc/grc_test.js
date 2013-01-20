require(
  [
    "jquery",
    "rless!GeoRefineClient/styles/GeoRefineClient.less",
    "GeoRefineClient/views/GeoRefineClient"
],
function($, GeoRefineClientCss, GeoRefineClientView){

  var geoRefineBaseUrl = 'http://localhost:8000/georefine';
  var projectId = 94;
  GeoRefine = {};
  GeoRefine.app = {
    requestsEndpoint: geoRefineBaseUrl + '/projects/execute_requests/' + projectId + '/',
    WMSLayerEndpoint: geoRefineBaseUrl + '/projects/' + projectId + 'layer',
    colorBarEndpoint: geoRefineBaseUrl + '/projects/colorbar/',
    dataLayerEndpoint: geoRefineBaseUrl + '/projects/get_map/' + projectId + '/',
    keyedStringsEndpoint: geoRefineBaseUrl + '/ks'
  };

  GeoRefine.config = {
    defaultInitialState: {
      dataViews: {
      }
    }
  };

  $(document).ready(function(){
    $(document.body).append('<p id="stylesLoaded" style="display: none;"></p>');
    cssEl = document.createElement('style');
    cssEl.id = 'grc_css';
    cssEl.type = 'text/css';
    cssText = GeoRefineClientCss + "\n#stylesLoaded {position: fixed;}\n";
    if (cssEl.styleSheet){
      cssEl.styleSheet.cssText = cssText;
    }
    else{
      cssEl.appendChild(document.createTextNode(cssText));
    }
    document.getElementsByTagName("head")[0].appendChild(cssEl);

    var cssDeferred = $.Deferred();
    var cssInterval = setInterval(function(){
      $testEl = $('#stylesLoaded');
      var pos = $testEl.css('position');
      if (pos == 'fixed'){
        clearInterval(cssInterval);
        cssDeferred.resolve();
      }
      else{
        console.log('loading styles...', pos);
      }
    }, 500);

    cssDeferred.done(function(){
      window.grc = new GeoRefineClientView({
        model: new Backbone.Model({
        }),
        el: $('#main')
      });

      //window.dv.trigger('ready');
    });
  });
}
);
