require(
  [
    "jquery",
    "rless!GeoRefineClient/styles/GeoRefineClient.less",
    "GeoRefineClient/views/GeoRefineClient"
],
function($, GeoRefineClientCss, GeoRefineClientView){
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
      GeoRefine.view = new GeoRefineClientView({
        model: new Backbone.Model(),
        el: $(GeoRefine.config.mainEl)
      });
    });
  });
}
);
