require(
    [
        "jquery",
        "backbone",
        "GeoRefineClient"
    ],
    function($, Backbone, GeoRefineClient){
      new GeoRefineClient.views.GeoRefineClientView({
        model: new Backbone.Model(),
        el: $(GeoRefine.config.mainEl)
      });
    }
);
