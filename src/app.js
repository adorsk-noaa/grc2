define(
    [
        "jquery",
        "backbone",
        "GeoRefineClient/views/GeoRefineClient"
    ],
    function($, Backbone, GeoRefineClientView){
      new GeoRefineClientView({
        model: new Backbone.Model(),
        el: $(GeoRefine.config.mainEl)
      });
    }
);
