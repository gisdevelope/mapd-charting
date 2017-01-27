/******************************************************************************
 * EXTEND: dc.rasterMixin                                                     *
 * ***************************************************************************/

dc.rasterMixin = function(_chart) {
    var _con = window.hasOwnProperty('con') ? con : null;
    var _sampling = false;
    var _tableName = null;
    var _popupColumns = [];
    var _popupColumnsMapped = {};
    var _popupSearchRadius = 2;
    var _popupFunction = null;
    var _colorBy = null;
    var _sizeBy = null;
    var _showColorByInPopup = false;
    var _mouseLeave = false // used by displayPopup to maybe return early
    var _minMaxCache = {}
    var _crossfilter = null;

    var _data_events = ["preData"]
    var _listeners = d3.dispatch.apply(d3, _data_events)
    var _on = _chart.on.bind(_chart)

    _chart.on = function (event, listener) {
      if (_data_events.indexOf(event) === -1) {
        _on(event, listener)
      } else {
        _listeners.on(event, listener)
      }
      return _chart
    }

    _chart._invokePreDataListener = function (f) {
      if (f !== "undefined") {
        _listeners.preData(_chart, f)
      }
    }

    _chart.getMinMax = function (value) {
      if (_minMaxCache[value]) {
        return Promise.resolve(_minMaxCache[value])
      }

      return _chart.crossfilter().groupAll().reduce([
        {expression: value, agg_mode: "min", name: "minimum"},
        {expression: value, agg_mode: "max", name: "maximum"}
      ]).valuesAsync(true)
        .then(function(bounds) {
          _minMaxCache[value] = [bounds["minimum"], bounds["maximum"]]
          return _minMaxCache[value]
        })
    }

    _chart.getTopValues = function (value) {
      var NUM_TOP_VALUES = 10
      var OFFSET = 0

      if (_minMaxCache[value]) {
          return Promise.resolve(_minMaxCache[value])
      }

      return _chart.crossfilter().dimension(value).order("val").group().reduceCount(value)
          .topAsync(NUM_TOP_VALUES, OFFSET, null, true).then(function(results) {
              return results.map(function(result) { return result.key0})
          })
    }


    _chart.crossfilter = function(_) {
        if(!arguments.length){ return _crossfilter; }
        _crossfilter = _;
        return _chart;
    }

    _chart.xRangeFilter = function (range) {
        if (!_chart.xDim()) {
            throw new Error("Must set xDim before invoking xRange")
        }

        var xValue = _chart.xDim().value()[0]

        if (!arguments.length) {
            return _minMaxCache[xValue]
        }

        _minMaxCache[xValue] = range
        return _chart
    }

    _chart.yRangeFilter = function (range) {
        if (!_chart.yDim()) {
            throw new Error("Must set yDim before invoking yRange")
        }

        var yValue = _chart.yDim().value()[0]

        if (!arguments.length) {
            return _minMaxCache[yValue]
        }

        _minMaxCache[yValue] = range
        return _chart
    }

    _chart.popupSearchRadius = function (popupSearchRadius) {
        if (!arguments.length){ return _popupSearchRadius; }
        _popupSearchRadius = popupSearchRadius;
        return _chart;
    }

    _chart._resetVegaSpec = function() {
        var pixelRatio = this._getPixelRatio();
        _chart._vegaSpec.width = Math.round(_chart.width() * pixelRatio);
        _chart._vegaSpec.height = Math.round(_chart.height() * pixelRatio);
        _chart._vegaSpec.data = [{
            "name": "table",
            "sql": "select x, y from tweets;"
        }];
        if (!!_tableName) { _chart._vegaSpec.data[0].dbTableName = _tableName; }
        _chart._vegaSpec.scales = [];
        _chart._vegaSpec.marks = [];
    }

    _chart.con = function(_) {
        if(!arguments.length){ return _con; }
        _con = _;
        return _chart;
    }

    _chart.popupColumns = function(popupColumns) {
        if (!arguments.length) { return _popupColumns; }
        _popupColumns = popupColumns;
        return _chart;
    }

    _chart.popupColumnsMapped = function(popupColumnsMapped) {
        if (!arguments.length) { return _popupColumnsMapped; }
        _popupColumnsMapped = popupColumnsMapped;
        return _chart;
    }

    _chart.tableName = function(tableName) {
        if (!arguments.length) { return _tableName; }
        _tableName = tableName;
        return _chart;
    }

    _chart.popupFunction = function(popupFunction) {
      if (!arguments.length){ return _popupFunction; }
      _popupFunction = popupFunction;
      return _chart;
    }

    // _determineScaleType because there is no way to determine the scale type
    // in d3 except for looking to see what member methods exist for it
    _chart.sampling = function(isSetting) { // isSetting should be true or false
        if (!arguments.length) { return _sampling; }
        if (isSetting && !_sampling) {// if wasn't sampling
            dc._sampledCount++;
        } else if (!isSetting && _sampling) {
            dc._sampledCount--;
        }
        _sampling = isSetting;
        if (_sampling === false) {
            _chart.dimension().samplingRatio(null); // unset sampling
        }
        return _chart;
    }

    _chart.setSample = function() {
        if (_sampling) {
            var id = _chart.dimension().getCrossfilterId();
            var filterSize = dc.lastFilteredSize(id);
            if (filterSize == undefined)
                _chart.dimension().samplingRatio(null);
            else {
                _chart.dimension().samplingRatio(Math.min(_chart.cap()/filterSize, 1.0))
            }
        }
    }

    _chart._determineScaleType = function(scale) {
        var scaleType = null;
        if (scale.rangeBand !== undefined){ return "ordinal"; }
        if (scale.exponent !== undefined){ return "power"; }
        if (scale.base !== undefined){ return "log"; }
        if (scale.quantiles !== undefined){ return "quantiles"; }
        if (scale.interpolate !== undefined){ return "linear"; }
        return "quantize";
    }

    _chart.vegaSpec = function(_) {
        if (!arguments.length) { return _chart._vegaSpec; }
        _chart._vegaSpec = _;
        return _chart;
    }

    _chart.colorBy = function(_) {
        if (!arguments.length) { return _colorBy; }
        _colorBy = _;
        return _chart;
    }

    _chart.sizeBy = function(_) {
        if (!arguments.length) { return _sizeBy; }
        _sizeBy = _;
        return _chart;
    }

    _chart.getClosestResult = function getClosestResult (point, callback) {
        var height = (typeof _chart.effectiveHeight === 'function' ? _chart.effectiveHeight() : _chart.height());
        var pixelRatio = _chart._getPixelRatio() || 1;
        var pixel = new TPixel({x: Math.round(point.x * pixelRatio), y: Math.round((height - point.y) * pixelRatio)})
        var tableName = _chart.tableName()
        var columns = getColumnsWithPoints()
        // TODO best to fail, skip cb, or call cb wo args?
        if (!point || !tableName || !columns.length || columns.length === 3 && hideColorColumnInPopup()) { return; }

        return _chart.con().getResultRowForPixel(_chart.__dcFlag__, pixel, {"table": columns}, [function(results){
            return callback(results[0])
        }], _popupSearchRadius * pixelRatio)
    }

    _chart.displayPopup = function displayPopup (result) {
      if(_mouseLeave || !result || !result.row_set || !result.row_set.length){ return }
      if(_chart.select('.map-popup').empty()){ // show only one popup at a time.
        var data = result.row_set[0];
        var mappedData = mapDataViaColumns(data, _popupColumnsMapped)
        if( Object.keys(mappedData).length === 2 ) { return } // xPoint && yPoint
        var offsetBridge = 0;

        var width = (typeof _chart.effectiveWidth === 'function' ? _chart.effectiveWidth() : _chart.width());
        var height = (typeof _chart.effectiveHeight === 'function' ? _chart.effectiveHeight() : _chart.height());
        var margins = (typeof _chart.margins === 'function' ? _chart.margins() : {left: 0, right: 0, top: 0, bottom: 0});

        var xscale = _chart.x();
        var yscale = _chart.y();

        var origXRange = xscale.range();
        var origYRange = yscale.range();

        xscale.range([0, width]);
        yscale.range([0, height]);

        var xPixel = xscale(data.xPoint) + margins.left;
        var yPixel = (height - yscale(data.yPoint)) + margins.top;

        // restore the original ranges so we don't screw anything else up
        xscale.range(origXRange);
        yscale.range(origYRange);

        var mapPopup = _chart.root().append('div').attr('class', 'map-popup');
        mapPopup.on("wheel", function () { _chart.select('.map-popup').remove() })
        mapPopup.append('div')
        .attr('class', 'map-point-wrap')
        .append('div')
        .attr('class', 'map-point')
        .style({left: xPixel + 'px', top: yPixel + 'px'})
        .append('div')
        .attr('class', 'map-point-gfx')
        .style('background', colorPopupBackground(result.row_set[0]))
        mapPopup.append('div')
        .attr('class', 'map-popup-wrap')
        .style({left: xPixel + 'px', top: yPixel + 'px'})
        .append('div')
        .attr('class', 'map-popup-box')
        .html(_chart.popupFunction() ? _popupFunction(mappedData) : renderPopupHTML(mappedData))
        .style('left', function(){
          var boxWidth = d3.select(this).node().getBoundingClientRect().width;
          var overflow = _chart.width() - (xPixel + boxWidth/2) < 0  ? _chart.width() - (xPixel + boxWidth/2) - 6 : (xPixel - boxWidth/2 < 0 ? -(xPixel - boxWidth/2 ) + 6 : 0);
          offsetBridge = boxWidth/2 - overflow;
          return overflow + 'px';
        })
        .classed('pop-down', function(){
          var boxHeight = d3.select(this).node().getBoundingClientRect().height;
          return yPixel - (boxHeight + 12) < 8 ;
        })
        .append('div')
        .attr('class', 'map-popup-bridge')
        .style('left', function(){
          return offsetBridge + 'px';
        });
      }
    }

    _chart.hidePopup = function hidePopup() {
      if (!_chart.select('.map-popup').empty()) {
        _chart.select('.map-popup-wrap')
        .classed('removePopup', true)
        .on('animationend', function(){
          _chart.select('.map-popup').remove();
        });
        _chart.select('.map-point')
        .classed('removePoint', true);
      }
    }

    _chart._vegaSpec = {};

    return _chart;

    function getColumnsWithPoints () {
        var columns = _chart.popupColumns().slice();

        if (typeof _chart.useLonLat === "function" && _chart.useLonLat()) {
            columns.push("conv_4326_900913_x(" + _chart._xDimName + ") as xPoint");
            columns.push("conv_4326_900913_y(" + _chart._yDimName + ") as yPoint");
        } else {
            columns.push(_chart._xDimName + ' as xPoint');
            columns.push(_chart._yDimName + ' as yPoint');
        }

        if (_chart.colorBy() && columns.indexOf(_chart.colorBy().value) === -1) {
            columns.push(_chart.colorBy().value)
        }

        return columns
    }

    function renderPopupHTML(data) {
      var html = '';
      for (var key in data) {
        if(key !== "xPoint" && key !== "yPoint" && !(key === _chart.colorBy().value && hideColorColumnInPopup())){
          html += '<div class="map-popup-item"><span class="popup-item-key">' + key + ':</span><span class="popup-item-val"> ' + dc.utils.formatValue(data[key]) +'</span></div>'
        }
      }
      return html;
    }

    function colorPopupBackground (data) {
        if (!_chart.colors().domain || !_chart.colorBy()) {
            return _chart.defaultColor();
        } else if (isNaN(_chart.colors().domain()[0])) {
            var matchIndex = _chart.colors().domain().indexOf(data[_chart.colorBy().value])
            return matchIndex !== -1 ? _chart.colors().range()[matchIndex] : _chart.defaultColor();
        } else {
            return _chart.colors()(data[_chart.colorBy().value])
        }
    }

    function mapDataViaColumns (data, _popupColumnsMapped) {
      var newData = {}
      for (var key in data) {
        var newKey = _popupColumnsMapped[key] || key
        newData[newKey] = data[key]
      }
      return newData
    }

    function hideColorColumnInPopup () {
        return _chart.colorBy() && _chart.popupColumns().indexOf(_chart.colorBy().value) === -1
    }
}

/******************************************************************************
 * END EXTEND: dc.rasterMixin                                                 *
 * ***************************************************************************/
