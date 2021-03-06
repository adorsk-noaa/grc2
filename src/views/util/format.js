define([
       "jquery",
       "backbone",
       "underscore",
       "_s",
       "Util",
],
function($, Backbone, _, _s, Util){

  var GeoRefineFormatter = function(f, s){
    var re = /%(\.(\d+))?(H|h)/;
    var m = re.exec(f)
    if (m){
      f = f.replace(re, '%s');
      var d = parseInt(m[2])|| 1;
      var use_long = (m[3] == 'H');
      s = Util.util.friendlyNumber(s, d, use_long)
    }
    return _s.sprintf(f, s);
  };

  var GeoRefineTokenFormatter = function(str){
    if (str){
      // Replace tokens in a string.
      var tokenRe = new RegExp('({{(.*?)}})', 'g');
      var tokenized_str = str.replace(tokenRe, function(match, token, tokenId){
        if (GeoRefine.app && GeoRefine.app.tokens && GeoRefine.app.tokens[tokenId]){
          return GeoRefine.app.tokens[tokenId];
        }
        else{
          return token;
        }
      });
      return tokenized_str;
    }
    else{
      return str;
    }
  };

  var exports = {
    GeoRefineFormatter: GeoRefineFormatter,
    GeoRefineTokenFormatter: GeoRefineTokenFormatter
  };
  return exports;
});
