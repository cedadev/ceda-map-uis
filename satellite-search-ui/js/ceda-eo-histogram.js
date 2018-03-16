/**
 * Created by Richard Smith on 25/07/2017.
 *
 *  Handles the drawing of the Histogram in the side pane.
 *  Builds the ElasticSearch request and draws the Histogram.
 */

function sendHistogramRequest() {
    var req, response, xhr;

    req = {
        'aggs': {
            'only_sensible_timestamps': {
                'filter': {
                    'range': {
                        'temporal.start_time': {
                            'gt': '1990-01-01'
                        }
                    }
                },
                'aggs': {
                    'docs_over_time': {
                        'date_histogram': {
                            'field': 'temporal.start_time',
                            'format': 'yyyy',
                            'interval': 'year',
                            'min_doc_count': 0
                        }
                    }
                }
            }
        },
        'size': 0
    };

    xhr = new XMLHttpRequest();
    xhr.open('POST', ES_URL, true);
    xhr.setRequestHeader("Content-Type", "application/json")
    xhr.send(JSON.stringify(req));
    xhr.onload = function (e) {
        if (xhr.readyState === 4) {
            response = JSON.parse(xhr.responseText);
            drawHistogram(response);
        }
    };
}

function drawHistogram(request) {
    var ost, buckets, keys, counts, i;

    ost = request.aggregations.only_sensible_timestamps;
    buckets = ost.docs_over_time.buckets;
    keys = [];
    counts = [];
    for (i = 0; i < buckets.length; i += 1) {
        keys.push(buckets[i].key_as_string);
        counts.push(buckets[i].doc_count);
    }

    $('#date_histogram').highcharts({
        chart: {
            type: 'column',
            height: 200,
            width: document.getElementById('parameter-accordian').offsetWidth * 0.75
        },
        title: {
            text: ''
        },
        xAxis: {
            categories: keys,
            labels: {
                step: 6,
                rotation: 270,
                useHTML: true
            }
        },
        yAxis: {
            title: {
                text: null
            },
            type: 'logarithmic'
        },
        legend: {
            enabled: false
        },
        plotOptions: {
            column: {
                borderWidth: 0,
                groupPadding: 0,
                pointPadding: 0
            },
            series: {
                cursor: 'pointer',
                point: {
                    events: {
                        click: function () {
                            var start_date = this.category + "-01-01";
                            var end_date = this.category + "-12-31";

                            $('#start_time').datepicker('setDate', start_date);
                            $('#end_time').datepicker('setDate', end_date);

                        }
                    }
                }

            }
        },
        series: [{
            name: 'Total Datasets',
            data: counts
        }]
    });
}


// Redraw Histogram on Window resize to make sure that the size of it makes sense and fits in the side pane.
$(window).resize(function () {
    sendHistogramRequest()
});
