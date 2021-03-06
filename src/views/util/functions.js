define([
],
function(){
  // Parse min/max from a bucket label.
  parseBucketLabel = function(bucketLabel){
    var minmax_regex = new RegExp('[\[(](.*?),(.*?)[\]|)]');
    var match = minmax_regex.exec(bucketLabel);
    var bmin, bmax;

    if (match != null){
      bmin = (match[1].indexOf('...') > -1) ? -Number.MAX_VALUE : parseFloat(match[1]);
      bmax = (match[2].indexOf('...') > -1) ? Number.MAX_VALUE : parseFloat(match[2]);
      return {
        min: bmin,
        max: bmax
      };
    }
    else{
      return null;
    }
  };

  var exports = {
    parseBucketLabel: parseBucketLabel
  };
  return exports;
});

