require(
    [
        "jquery",
        "GeoRefineClient"
    ],
    function($, GeoRefineClient){
      new GeoRefineClient.views.GeoRefineClientView({
        model: new Backbone.Model(),
        el: $(GeoRefine.mainEl)
      });
    }
);
