/**
 * Created by vdn73631 on 25/07/2017.
 */


// -------------------------------ElasticSearch--------------------------------
// Request JSON

function esRequest(size) {
    // Abstracts the actual request from the main active code
    return {
        "_source": {
            "include": [
                "data_format.format",
                "file.filename",
                "file.path",
                "file.data_file",
                "file.quicklook_file",
                "file.location",
                "file.directory",
                "misc",
                "spatial",
                "temporal"
            ]
        },
        "sort": [
            {
                "temporal.start_time": {"order": "desc"}
            },
            "_score"
        ],
        "query": {
            "bool": {
                "must": {
                    "match_all": {}
                },
                "filter": {
                    "bool": {
                        "must": [
                            {
                                "exists": {
                                    "field": "spatial.geometries.display.type"
                                }

                            }
                        ],
                        "should": [],
                        "must_not": []
                    }
                }
            }
        },
        "aggs": {
            "data_count": {
                "terms": {
                    "field": "misc.platform.Satellite.raw"
                }
            },
            "all": {
                "global": {},
                "aggs": {
                    "satellites": {
                        "terms": {
                            "field": "misc.platform.Satellite.raw",
                            "size": 30
                        }
                    }
                }
            }
        },
        "size": size
    };
}

function geo_shapeQuery(envelope) {
    // Abstraction function to build the geo_shape query
    return {
        "geo_shape": {
            "spatial.geometries.search": {
                "shape": {
                    "type": "envelope",
                    "coordinates": envelope
                }
            }
        }
    }
}

function treeRequest() {
    // Abstracts the actual request from the main active code
    // Simpler, light request just for initialising the tree.
    return {
        "aggs": {
            "data_count": {
                "terms": {
                    "field": "misc.platform.Satellite.raw"
                }
            },
            "all": {
                "global": {},
                "aggs": {
                    "satellites": {
                        "terms": {
                            "field": "misc.platform.Satellite.raw",
                            "size": 30
                        }
                    }
                }
            }
        },
        "size": 0
    };
}

function createElasticsearchRequest(gmaps_corners, full_text, size, drawing) {
    var i, end_time, tmp_ne, tmp_sw, nw,
        se, start_time, request, temporal, tf, vars;

    // Present loading modal
    if (!export_modal_open) {
        displayLoadingModal()
    }

    if (drawing) {
        nw = gmaps_corners[0];
        se = gmaps_corners[1]
    }
    else {

        tmp_ne = gmaps_corners.getNorthEast();
        tmp_sw = gmaps_corners.getSouthWest();
        nw = [tmp_sw.lng().toString(), tmp_ne.lat().toString()];
        se = [tmp_ne.lng().toString(), tmp_sw.lat().toString()];
    }

    // ElasticSearch request
    request = esRequest(size);

    // Add geo_spatial filters to search
    // First check to see if the search window crosses the date line
    var envelope_corners = []
    if (datelineCheck(nw[0], se[0])) {
        // We have crossed the date line, need to send the search area into two.
        envelope_corners.push([nw, [180, se[1]]])
        envelope_corners.push([[-180, nw[1]], se])

    } else {
        // Not crossing the date line so can just use the search area.
        envelope_corners.push([nw, se])
    }

    // Push the geoshape conditions to the main request.
    for (i = 0; i < envelope_corners.length; i++) {
        request.query.bool.filter.bool.should.push(geo_shapeQuery(envelope_corners[i]));
    }

    // Tree selection filters.
    vars = requestFromTree();

    if (vars) {
        for (i = 0; i < vars.length; i++) {
            request.query.bool.filter.bool.must_not.push(vars[i]);
        }
    }

    temporal = {
        range: {
            'temporal.start_time': {}
        }
    };

    start_time = $('#start_time').val();
    if (start_time !== '') {
        temporal.range['temporal.start_time'].from = start_time;
    }

    end_time = $('#end_time').val();
    if (end_time !== '') {
        temporal.range['temporal.start_time'].to = end_time;
    }

    if (temporal.range['temporal.start_time'].to !== null ||
        temporal.range['temporal.start_time'].from !== null) {
        request.query.bool.filter.bool.must.push(temporal);
    }

    return request;
}

function sendElasticsearchRequest(request, callback, gmap) {
    var xhr, response;

    // Construct and send XMLHttpRequest
    xhr = new XMLHttpRequest();
    xhr.open('POST', ES_URL, true);
    xhr.setRequestHeader("Content-Type", "application/json")
    xhr.send(JSON.stringify(request));
    xhr.onload = function () {
        if (xhr.readyState === 4) {
            response = JSON.parse(xhr.responseText);

            if (gmap) {
                callback(response, gmap);
            } else {
                callback(response);
            }
        }
    };
}

