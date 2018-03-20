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


function geo_shapeRectangleQuery(envelope) {
    // Abstracts different query syntax for envelope search
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

function geo_shapePolygonQuery(path) {
    // Abstracts different query syntax for polygon search
    return {
        "geo_shape": {
            "spatial.geometries.search": {
                "shape": {
                    "type": "polygon",
                    "coordinates": path
                }
            }
        }
    }
}

function splitDatelinePolygon(path) {
    // Where crosses the dateline splits polygon into 2 segments. This does produce inaccurate results if the user
    // draws a shape which cuts back accross but this use case is considered too edge to try to rectify at this stage.
    //
    // Example:
    // The | represents the dateline.
    // Some of the indentation detail is lost after clipping
    //
    // This shape:
    //
    //                   WEST          EAST
    //                           |
    //                   xxxxxxxxxxxxxxxxxxxxx
    //                       x   |           x
    //                           x           x
    //                           |   x       x
    //                           x           x
    //                       x   |           x
    //                   xxxxxxxxxxxxxxxxxxxxx
    //                           |
    //
    // Becomes two shapes:
    //                   WEST                     EAST
    //                           |           |
    //                   xxxxxxxxx           xxxxxxxxxxxxx
    //                       x   x           x           x
    //                           x           x           x
    //                           x           x           x
    //                           x           x           x
    //                       x   x           x           x
    //                   xxxxxxxxx           xxxxxxxxxxxxx
    //                           |           |

    path = path[0]
    var query = [];

    var bbox = getNWSE(drawing.overlay.getBounds())

    if (datelineCheck(bbox[0][0], bbox[1][0])) {

        // Split polygon east/west of the dateline
        var east = [];
        var west = [];

        for (var i = 0; i < path.length; i++) {
            var lng_tmp;
            var lng = path[i][0];
            var lat = path[i][1];

            if (lng < 0) {
                // Create values for the western polygon. If lng < 0. The Point is east of the dateline and needs to be
                // wrapped as if it continues past 180 from the west.
                lng_tmp = 180 + (180 + lng);
                west.push([lng_tmp, lat]);

                // Push the unchaged coordinates to the other side
                east.push([lng, lat])

            } else if (lng > 0) {
                // Create values for the eastern polygon. If lng > 0. The Point is west of the dateline and needs to be
                // wrapped as if it continues past -180 from the east.
                lng_tmp = -180 - (180 - lng);
                east.push([lng_tmp, lat]);

                // Push the unchaged coordinates to the other side
                west.push([lng, lat])
            }
        }

        query.push(geo_shapePolygonQuery([east]));
        query.push(geo_shapePolygonQuery([west]));
    } else {
        query.push(geo_shapePolygonQuery(path))
    }

    return query
}

function splitDatelineRectangle(bounds) {
    var query = []
    var nw = bounds[0]
    var se = bounds[1]

    if (datelineCheck(nw[0], se[0])) {
        // We have crossed the date line, need to split the search area into two.
        query.push(geo_shapeRectangleQuery([nw, [180, se[1]]]));
        query.push(geo_shapeRectangleQuery([[-180, nw[1]], se]));

    } else {
        // Not crossing the date line so can just use the search area.
        query.push(geo_shapeRectangleQuery(bounds));
    }

    return query
}

function getNWSE(bounds) {
    // Input Google Maps bounds object and return NW and SE array lng, lat formatted
    var tmp_ne = bounds.getNorthEast();
    var tmp_sw = bounds.getSouthWest();
    var nw = [tmp_sw.lng(), tmp_ne.lat()];
    var se = [tmp_ne.lng(), tmp_sw.lat()];
    return [nw, se]
}

function getGeoShapeQuery(gmaps_corners) {

    if (window.drawing) {
        var bounds = getShapeBounds();

        switch (drawing.type) {
            case 'rectangle':
                query = splitDatelineRectangle(bounds);
                break;

            case 'polygon':
                query = splitDatelinePolygon(bounds);
                break;
        }

    } else {
        var mapboundary = getNWSE(gmaps_corners)
        var query = splitDatelineRectangle(mapboundary);
    }

    return query

}

function createElasticsearchRequest(gmaps_corners, full_text, size) {
    var i, end_time, tmp_ne, tmp_sw, nw,
        se, start_time, request, temporal, tf, vars;

    // ElasticSearch request
    request = esRequest(size);

    // Add geo_spatial filters to search
    var geoshapequeries = getGeoShapeQuery(gmaps_corners)

    // Push the geoshape conditions to the main request.
    for (i = 0; i < geoshapequeries.length; i++) {
        request.query.bool.filter.bool.should.push(geoshapequeries[i]);
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

