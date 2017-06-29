/*jslint browser: true, devel: true, sloppy: true*/
/*global google, $, GeoJSON*/



function getParameterByName(name) {
    // Function from: http://stackoverflow.com/a/901144
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    var regex = new RegExp('[\\?&]' + name + '=([^&#]*)'),
        results = regex.exec(location.search);
    if (!results) {
        return null;
    }
    return decodeURIComponent(results[1].replace(/\+/g, ' '));
}

// Window constants
var REQUEST_SIZE = 1000;
var INDEX = getParameterByName('index') || 'ceda-eo';
var ES_URL = 'http://jasmin-es1.ceda.ac.uk:9000/' + INDEX + '/_search';
var TRACK_COLOURS = [
    '#B276B2', '#5DA5DA', '#FAA43A',
    '#60BD68', '#F17CB0', '#B2912F',
    '#4D4D4D', '#DECF3F', '#F15854'
];
var redraw_pause = false;

// based on the Track Colours
var COLOUR_MAP = {
    "sentinel1": "#B276B2",
    "sentinel2": "#5DA5DA",
    "sentinel3": "#FAA43A",
    "landsat": "#60BD68",
    "other": "#F17CB0"
};
var export_modal_open = false;

// -----------------------------------String-----------------------------------
String.prototype.hashCode = function () {
    // Please see: http://bit.ly/1dSyf18 for original
    var i, c, hash;

    hash = 0;
    if (this.length === 0) {
        return hash;
    }

    for (i = 0; i < this.length; i++) {
        c = this.charCodeAt(i);
        hash = ((hash << 5) - hash) + c;
    }

    return hash;
};

String.prototype.truncatePath = function (levels) {
    // Removes 'levels' directories from a path, e.g.:
    // '/usr/bin/path/to/something/useful'.truncatePath(3);
    //     => '/usr/bin/path
    var parts, t_path;
    parts = this.split('/');
    t_path = parts.slice(0, parts.length - levels).join('/');
    return t_path;
};

// Toggle text at top of the filters panel
function toggleText() {
    var sliders = document.getElementsByClassName('slider')
    for (var i = 0; i < sliders.length; i++) {
        sliders[i].classList.toggle('closed')
    }
    var headerCollapse = document.getElementById('headCollapse');
    var hCHTML = headerCollapse.innerHTML;
    headerCollapse.innerHTML = hCHTML === 'Collapse Header' ? 'Expand Header' : 'Collapse Header'

}

// ---------------------------'Export Results' Modal---------------------------
function sleep(miliseconds) {
    var currentTime = new Date().getTime();

    while (currentTime + miliseconds >= new Date().getTime()) {
    }
}

function updateExportResultsModal(hits) {
    loading();
    $('#results').html(JSON.stringify(hits, null, '    '));
}

$('#copy').click(function (event) {
    $('#results').select();

    try {
        document.execCommand('copy');
    } catch (err) {
        console.log('Oops, unable to copy');
    }
});

// Handle popover trigger and release
$('#copy[data-toggle="popover"]')
    .on('focus', function (event) {
        $(this).popover({
            placement: 'bottom',
            trigger: 'manual'
        });
        $(this).popover('show');
    })
    .on('blur', function (event) {
        sleep(700);
        $(this).popover('hide');
    });


// ---------------------------'Loading' Modal---------------------------

function displayLoadingModal() {
    var $loading = $('#loading_modal');
    $loading.css("display", $loading.css("display") === 'none' ? 'block' : 'none');

}

// loading gif inside export modal
function loading() {
    var loading_blk = $('.loading_block');
    loading_blk.css("display", loading_blk.css("display") === 'none' ? 'block' : 'none');
}

// ---------------------------'Quicklook' Modal---------------------------

function displayquicklookModal(i) {
    // set quicklook image
    $('#modal-quicklook-image').attr('src', quicklooks[i]);

    // set modal title to data filename
    var title = $(info_windows[i].getContent()).find("#iw-title").first().attr('title');
    title = title.replace(/^<strong>.+<\/strong>/g, '');
    $('#file_nameQL').html(title);

    var $loading = $('#quicklook_modal');
    $loading.modal()

}

//Display the unavailable.png image in place of the broken image icon.
$('#quicklook_modal').on('hidden.bs.modal', function () {
    $('#modal-quicklook-image').attr('onerror', 'imgError(this)')

});

// -------------------------------Hierarchy tree ------------------------------

function titleCase(string) {
    return string[0].toUpperCase() + string.slice(1);
}

function getDocCount(key, aggregatedData) {
    // Returns the number of documents for each satellite given the current filter parameters.

    var count;
    var data_count = aggregatedData['data_count']['buckets'];
    var i;

    for (i = 0; i < data_count.length; i++) {
        if (data_count[i]['key'] === key) {
            count = data_count[i]['doc_count'];
            break;
        } else {
            count = 0
        }
    }
    if (!data_count.length) {
        count = 0
    }
    return count
}

function getProductNode(key, aggregatedData){
    var i,j, mode, product, resolution;
    var node = [];
    var modes = aggregatedData.modes.buckets
    for (i=0; i< modes.length; i++){
        mode = modes[i]
        var products = mode.products.buckets
        for (j=0; j< products.length; j++){
            product = products[j]
            var resolutions = product.resolutions.buckets
            // At the moment, resolution is singular. If there is more than one resolution per product, it is a
            // tokenised version of N/A
            if (resolutions.length < 2){
                resolution = '_' + resolutions[0]["key"]
            } else {
                resolution = ''
            }
            // Create the node JSON.
            var product_name = mode.key + '_' + product.key + resolution;
            node.push({
                    text: product_name.toUpperCase()
                })
        }

    }
    node = node.sort(function (a,b) {
        if (a.text < b.text)
            return -1;
        if (a.text > b.text)
            return 1;
        return 0;

    })
    return node
}

function getTreeJSON(aggregatedData) {
    // Produces the JSON which makes up the data section for the Bootstrap treeview.

    var tree = [];
    var tree_buckets = aggregatedData['all'];
    var satellites, childName, child, doc_count, child_JSON, satellite_node;

    // Create JSON for satellites aggregation
    if ("satellites" in tree_buckets) {
        satellites = tree_buckets['satellites']['buckets'].sort(function (a, b) {
                if (a.key < b.key)
                    return -1;
                if (a.key > b.key)
                    return 1;
                return 0;
            }
        );

        // Create the child JSON
        var i, j, satellite_children = [];
        for (i = 0, j = satellites.length; i < j; i++) {
            child = satellites[i]['key'];
            doc_count = getDocCount(child, aggregatedData);
            childName = child + " <a class='glyphicon glyphicon-globe heatmap' data-mission='" + child + "' href='#'></a>";

            child_JSON = {
                text: titleCase(childName),
                tags: [doc_count]
            };

            // For sentinel 1 products, need to provide selectable product nodes.
            var reg = /Sentinel-1./i;
            if (reg.test(child)) {
                child_JSON.nodes = getProductNode(child, satellites[i])
                // console.log(JSON.stringify(child_JSON))
            }
            // push each child to the children array
            satellite_children.push(child_JSON)
        }

        // Create the main satellite parent node
        satellite_node = {
            text: "Satellites",
            nodes: satellite_children,
            selectable: false
        };

        // Push the satellite node JSON to the main tree data array.
        tree.push(satellite_node)
    }
    return tree
}

function initTree(response) {
    // Initialisation function for the tree. Main difference is that tags are not set
    // so the total number of hits for each satellite are not shown.

    var aggregatedData = response.aggregations;
    var treeMenu = $('#tree_menu');

    treeMenu.treeview({
        data: getTreeJSON(aggregatedData, false),
        showCheckbox: true,
        multiSelect: true,
        highlightSelected: false,
        showBorder: false,
        onNodeChecked: function (event, data) {
            treeMenu.treeview('selectNode', [data.nodeId, {silent: true}]);
            if (data.nodeId === 0) {
                treeMenu.treeview('checkAll')
            }
        },
        onNodeUnchecked: function (event, data) {
            treeMenu.treeview('unselectNode', [data.nodeId, {silent: true}]);
            if (data.nodeId === 0) {
                treeMenu.treeview('uncheckAll')
            }
        },
        onNodeUnselected: function (event, data) {
            treeMenu.treeview('uncheckNode', [data.nodeId, {silent: true}]);
            if (siblingState(data.nodeId)) {
                treeMenu.treeview('checkNode', [0, {silent: true}]);
                treeMenu.treeview('selectNode', [0, {silent: true}]);
            } else {
                treeMenu.treeview('uncheckNode', [0, {silent: true}]);
                treeMenu.treeview('unselectNode', [0, {silent: true}]);
            }
        },
        onNodeSelected: function (event, data) {
            treeMenu.treeview('checkNode', [data.nodeId, {silent: true}]);
            if (siblingState(data.nodeId)) {
                treeMenu.treeview('checkNode', [0, {silent: true}]);
                treeMenu.treeview('selectNode', [0, {silent: true}]);
            } else {
                treeMenu.treeview('uncheckNode', [0, {silent: true}]);
                treeMenu.treeview('unselectNode', [0, {silent: true}]);
            }
        }
    });
    treeMenu.treeview('checkAll');

}

function childSelectToggle(method, children, gmap) {
    var tree_menu = $('#tree_menu'), child, i;

    // Don't trigger redrawMap() until the last child is toggled
    redraw_pause = true;

    for (i = 0; i < children.length; i++) {
        // if(i === children.length -1){redraw_pause=false}
        child = children[i];
        tree_menu.treeview(method, [child])
    }
    if (window.rectangle !== undefined) {
        queryRect()
    } else {
        redrawMap(gmap, true)
    }
    redraw_pause = false;
}

function siblingState(node) {
    // tests state of all sibling nodes. Returns true if all of the satellites are checked, and false if one is unchecked.
    var tree = $('#tree_menu');
    var siblings = tree.treeview('getSiblings', [node]);
    var test = [tree.treeview('getNode', [node]).state.checked];
    var i, sibling;
    for (i = 0; i < siblings.length; i++) {
        sibling = siblings[i];
        test.push(sibling.state.checked)
    }
    return test.every(function (element, index, array) {
        return element === true
    })
}

function updateTreeDisplay(aggregatedData, gmap) {
    // Sets the current behaviour of the tree.

    var tree_menu = $('#tree_menu');

    // get current state before the tree is updated.
    var selection = tree_menu.treeview('getSelected');

    tree_menu.treeview({
        data: getTreeJSON(aggregatedData),
        showCheckbox: true,
        showBorder: false,
        multiSelect: true,
        highlightSelected: false,
        showTags: true,
        onNodeSelected: function (event, data) {
            tree_menu.treeview('checkNode', [data.nodeId, {silent: true}]);
            if (!redraw_pause) {
                if (window.rectangle !== undefined) {
                    queryRect(gmap)
                } else {
                    redrawMap(gmap, true)
                }
            }

            if (siblingState(data.nodeId)) {
                tree_menu.treeview('checkNode', [0, {silent: true}]);
                tree_menu.treeview('selectNode', [0, {silent: true}]);
            } else {
                tree_menu.treeview('uncheckNode', [0, {silent: true}]);
                tree_menu.treeview('unselectNode', [0, {silent: true}]);
            }

        },
        onNodeUnselected: function (event, data) {
            tree_menu.treeview('uncheckNode', [data.nodeId, {silent: true}]);
            if (!redraw_pause) {
                if (window.rectangle !== undefined) {
                    queryRect(gmap)
                } else {
                    redrawMap(gmap, true)
                }
            }

            if (siblingState(data.nodeId)) {
                tree_menu.treeview('checkNode', [0, {silent: true}]);
                tree_menu.treeview('selectNode', [0, {silent: true}]);
            } else {
                tree_menu.treeview('uncheckNode', [0, {silent: true}]);
                tree_menu.treeview('unselectNode', [0, {silent: true}]);
            }

        },
        onNodeChecked: function (event, data) {
            if (data.text !== "Satellites") {
                tree_menu.treeview('selectNode', [data.nodeId]);

                if (!redraw_pause) {
                    redrawMap(gmap, true)
                }

            } else {
                tree_menu.treeview('selectNode', [data.nodeId, {silent: true}]);
                var children = data.nodes;
                childSelectToggle('checkNode', children, gmap)
            }
        },
        onNodeUnchecked: function (event, data) {
            if (data.text !== "Satellites") {
                tree_menu.treeview('unselectNode', [data.nodeId]);
                if (!redraw_pause) {
                    redrawMap(gmap, true)
                }

            } else {
                tree_menu.treeview('unselectNode', [data.nodeId, {silent: true}]);
                var children = data.nodes;
                childSelectToggle('uncheckNode', children, gmap)
            }
        }
    });

    // apply previous state if there were checked boxes.
    if (selection.length) {
        var i;
        for (i = 0; i < selection.length; i++) {
            var node = selection[i];
            tree_menu.treeview('checkNode', [node.nodeId, {silent: true}]);
            tree_menu.treeview('selectNode', [node.nodeId, {silent: true}]);
        }
    }

}

function requestFromTree() {
    // Get the checked items in the tree to apply in the ES query.
    var i,j, req = [], selection;

    selection = $('#tree_menu').treeview('getUnselected');


    if (selection.length) {
        for (i = 0; i < selection.length; i++) {
            if (selection[i].text !== "Satellites") {
                if (selection[i].parentId === 0) {
                    req.push({
                        match: {
                            'misc.platform.Satellite.raw': selection[i].text.split(' ')[0]
                        }
                    });
                } else {
                    // Node is a data product, a sub-selection of the satellite mission.
                    var params
                    params = selection[i].text.split('_');
                    req.push({match: {'misc.platform.Instrument Mode': params[0]}})
                    req.push({match: {'misc.product_info.Product Type': params[1]}})
                    if (params.length > 2){
                        // There is a resolution parameter
                        req.push({match: {'misc.product_info.Resolution': params[2]}})
                    }
                }
            }
        }
        return req;
    }
    return '';
}

// Open the data coverage modal on mouseover the globe in the tree menu.
var dataCoverageTimer
$('body').on({
        mouseover: function () {
            var mission = $(this).data('mission')
            dataCoverageTimer = setTimeout(function () {
                $('#dataset-coverage-image').attr('src', './img/coverage_maps/' + mission + '.png' )
                $('#caption').html(mission + " Coverage Map")
                $('#coverage_modal').modal('show')
            }, 400);
        },
    mouseleave: function () {
        clearTimeout(dataCoverageTimer)
    }
    }, 'a.heatmap'
);

// -------------------------------ElasticSearch--------------------------------

function requestFromFilters(full_text) {
    var i, ft, req;

    req = [];
    if (full_text.length > 0) {
        ft = full_text.split(' ');
        for (i = 0; i < ft.length; i += 1) {
            req.push({
                term: {
                    _all: ft[i].toLowerCase()
                }
            });
        }
        return req;
    }
}

function esRequest(nw, se, size) {
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
            "filtered": {
                "query": {
                    "match_all": {}
                },
                "filter": {
                    "bool": {
                        "must": [
                            {
                                "geo_shape": {
                                    "spatial.geometries.search": {
                                        "shape": {
                                            "type": "envelope",
                                            "coordinates": [nw, se]
                                        }
                                    }
                                }
                            }
                        ],
                        "must_not": [
                            {
                                "missing": {
                                    "field": "spatial.geometries.display.type"
                                }

                            }
                        ]
                    }
                }
            }
        },
        "aggs": treeRequest().aggs,
        "size": size
    };
}

function treeRequest(size) {
    // Abstracts the actual request from the main active code
    // Simpler, light request just for initialising the tree.
    // Provides the aggs section of the ES request
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
                            "field": "misc.platform.Satellite.raw"
                        },

                        "aggs": {
                            "modes": {
                                "terms": {
                                    "field": "misc.platform.Instrument Mode"

                                },
                                "aggs": {
                                    "products": {
                                        "terms": {
                                            "field": "misc.product_info.Product Type"
                                        },
                                        "aggs": {
                                            "resolutions": {
                                                "terms": {
                                                    "field": "misc.product_info.Resolution"
                                                }
                                            }
                                        }
                                    }

                                }
                            }

                        }
                    }
                }
            }
        },
        "size": size
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
    request = esRequest(nw, se, size);

    // Add other filters from page to query
    // tf = requestFromFilters(full_text);
    // if (tf) {
    //     for (i = 0; i < tf.length; i += 1) {
    //         request.query.filtered.filter.bool.must.push(tf[i]);
    //     }
    // }

    // Tree selection filters.
    vars = requestFromTree();

    if (vars) {
        for (i = 0; i < vars.length; i += 1) {
            request.query.filtered.filter.bool.must_not.push(vars[i]);
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
        request.query.filtered.filter.bool.must.push(temporal);
    }

    return request;
}

function sendElasticsearchRequest(request, callback, gmap) {
    var xhr, response;

    // Construct and send XMLHttpRequest
    xhr = new XMLHttpRequest();
    xhr.open('POST', ES_URL, true);
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

// -------------------------- Update Map features and Export Modal Parameters ------------------------------------------

function updateMap(response, gmap) {
    if (response.hits) {
        // Update "hits" and "response time" fields
        $('#resptime').html(response.took);
        $('#numresults').html(response.hits.total);

        // Draw flight tracks on a map
        drawFlightTracks(gmap, response.hits.hits);

        // Toggle loading modal
        if (!export_modal_open) {
            displayLoadingModal()
        }
    }
    if (response.aggregations) {
        // Generate variable aggregation on map and display
        updateTreeDisplay(response.aggregations, gmap);
    }
}

function updateRawJSON(response) {
    updateExportResultsModal(response.hits.hits);
}

function updateFilePaths(response) {
    var h, i, paths;
    h = response.hits.hits;

    paths = [];
    for (i = 0; i < h.length; i += 1) {
        var filepath = [h[i]._source.file.directory, '/', h[i]._source.file.data_file];
        paths.push(filepath.join(""));
    }

    updateExportResultsModal(paths);
}

function updateDownloadPaths(response) {
    var h, i, paths;
    h = response.hits.hits;

    paths = [];
    for (i = 0; i < h.length; i += 1) {
        var filepath = [h[i]._source.file.directory, '/', h[i]._source.file.data_file];
        paths.push('http://data.ceda.ac.uk' + filepath.join(""));
    }

    updateExportResultsModal(paths);
}


// -----------------------------------Map--------------------------------------
var geometries = [];
var info_windows = [];
var quicklooks = [];

function centreMap(gmap, geocoder, loc) {
    if (loc !== '') {
        geocoder.geocode(
            {
                address: loc
            },
            function (results, status) {
                if (status === 'OK') {
                    gmap.panTo(results[0].geometry.location);
                } else {
                    alert('Could not find "' + loc + '"');
                }
            }
        );
    }
}

// --------------------------- Info window ------------------------------------

function createInfoWindow(hit) {
    var content, info, view;

    hit = hit._source;

    view = {
        title: "Scene Details",
        filename: hit.file.data_file,
        start_time: hit.temporal.start_time,
        end_time: hit.temporal.end_time,
        mission: hit.misc.platform.Mission,
        satellite: hit.misc.platform.Satellite,
        instrument: hit.misc.platform["Instrument Abbreviation"]
    };

    var template = $('#infowindowTemplate').html();
    content = Mustache.render(template, view);

    if (hit.file.quicklook_file) {
        quicklooks.push('http://data.ceda.ac.uk' + hit.file.path.truncatePath(1) + '/' + hit.file.quicklook_file)
    }
    else {
        quicklooks.push('-')
    }

    if (hit.file.location === "on_disk") {
        content += '<p class="iw_table">' +
            '<a class="btn btn-danger" target="_blank" href="http://data.ceda.ac.uk' +
            hit.file.path.truncatePath(1) + '/' + hit.file.data_file + '" role="button">Download <span class="glyphicon glyphicon-circle-arrow-down"/>' +
            '</a>' +
            '   <a class="btn btn-primary" target="_blank" href="http://data.ceda.ac.uk' +
            hit.file.path.truncatePath(1) + '">View directory <span class="glyphicon glyphicon-folder-open"/>' +
            '</a>' +
            '</p>';

    } else {
        content += '<p class="iw_table">This file is stored on tape, please click <a target="_blank" href="http://help.ceda.ac.uk/article/265-nla">here</a> for information about access to this file.</p>'
    }

    // close the section tag
    content += '</section>';

    info = new google.maps.InfoWindow(
        {
            content: content,
            disableAutoPan: false
        }
    );

    /*  ---------   Infowindow modifications   -----------------
     * The google.maps.event.addListener() event waits for
     * the creation of the infowindow HTML structure 'domready'
     * before the opening of the infowindow defined styles
     * are applied.
     */
    google.maps.event.addListener(info, 'domready', function () {

        // Reference DIV which receives the contents of the infowindow.
        var iwOuter = $('.gm-style-iw');

        /* The DIV we want to change is above the .gm-style-iw DIV. */
        var iwBackground = iwOuter.prev();

        // Remove the background shadow DIV
        iwBackground.children(':nth-child(2)').css({'display': 'none'});

        // Remove the white background DIV
        iwBackground.children(':nth-child(4)').css({'display': 'none'});

        // Changes the z-index of the tail to bring it forward.
        iwBackground.children(':nth-child(3)').find('div').children().css({'z-index': '1'});

        //The following div to .gm-style-iw groups the close button elements.
        var iwCloseBtn = iwOuter.next();

        // Apply the desired effect to the close button
        iwCloseBtn.css({
            opacity: '1', // by default the close button has an opacity of 0.7
            right: '75px', top: '18px', // button repositioning
            'border-radius': '13px', // circular effect
            'box-shadow': '0 0 5px #3990B9' // 3D effect to highlight the button
        });

        // The API automatically applies 0.7 opacity to the button after the mouseout event.
        // This function reverses this event to the desired value.
        iwCloseBtn.mouseout(function () {
            $(this).css({opacity: '1'});
        });

    });

    return info;
}


// ------------------------------ Info window quicklook -------------
function getQuickLook(info_window, i) {
    var content = $(info_window.getContent());

    if (quicklooks[i] !== '-') {
        // There is a quicklook in the archive
        var quicklook = "<img class='quicklook' src='" + quicklooks[i] + "' alt='Data quicklook image' onclick='displayquicklookModal(" + i + ")' onerror='imgError(this)'> ";

    } else {
        // There is no quicklook image in the archive
        var quicklook = '<img class="quicklook" src="./img/no_preview.png" alt="Data quicklook image">';

    }

    content.find("#quicklooks_placeholder").first().html(quicklook);
    content = content.prop('outerHTML');
    info_window.setContent(content)
}

// replace the broken img icon with a custom image.
function imgError(image) {
    image.onerror = "";
    image.src = "./img/unavailable.png"
}

function colourSelect(mission) {
    var colour;
    switch (true) {
        case /sentinel\W1.*/gi.test(mission):
            colour = COLOUR_MAP['sentinel1'];
            break;

        case /sentinel\W2.*/gi.test(mission):
            colour = COLOUR_MAP['sentinel2'];
            break;

        case /sentinel\W3.*/gi.test(mission):
            colour = COLOUR_MAP['sentinel3'];
            break;

        case /landsat/gi.test(mission):
            colour = COLOUR_MAP['landsat'];
            break;

        default:
            colour = COLOUR_MAP['other'];
            break;
    }
    return colour
}

function truncatePole(displayCoords) {
    var i, truncatedCoords = [];
    var truncate = false;

    displayCoords = displayCoords.coordinates[0];
    for (i = 0; i < displayCoords.length; i++) {
        var coords = displayCoords[i];
        var last_coords;

        if (coords[1] > 85) {
            // If co-ordinate traverses >85 N, truncate to 85
            coords[1] = 85.0;

            // Only return the first co-ordinate to cross the threshold
            if (!truncate) {
                truncatedCoords.push(coords)
            }
            truncate = true;
            // Store last coordinate to push when polygon re-enters threshold
            if (truncate) {
                last_coords = coords
            }

        } else if (coords[1] < -85) {
            // If co-ordinate traverses < -85 S, truncate to -85
            coords[1] = -85;

            // Only return the first co-ordinate to cross the threshold
            if (!truncate) {
                truncatedCoords.push(coords)
            }
            truncate = true;
            // Store last coordinate to push when polygon re-enters threshold
            if (truncate) {
                last_coords = coords
            }

        } else {
            // On re-entry, push the last truncated co-ordinate as well as the current
            // non-truncated coordinate
            if (truncate) {
                truncatedCoords.push(last_coords)
            }
            truncate = false;
            truncatedCoords.push(coords)
        }
    }
    truncatedCoords = [truncatedCoords];
    return truncatedCoords
}


function drawFlightTracks(gmap, hits) {
    var colour_index, geom, hit, i, info_window, options, display;
    // Clear old map drawings
    cleanup();

    // only need to pass to truncate filter if searching in region north/south of 70N/S
    var mapBounds = gmap.getBounds();
    var truncate;
    if (mapBounds.getNorthEast().lat() > 70 || mapBounds.getSouthWest().lat() < -70) {
        truncate = true
    } else {
        truncate = false
    }

    // Reverse the "hits" array because the ES response is ordered new - old and we want to draw the newest items on top.
    hits.reverse();

    for (i = 0; i < hits.length; i += 1) {
        hit = hits[i];
        hit = hits[i];

        var mission = hit._source.misc.platform.Mission
        options = {
            strokeColor: colourSelect(mission),
            strokeWeight: 5,
            strokeOpacity: 0.6,
            fillOpacity: 0.1,
            zIndex: i
        };
        // Create GeoJSON object
        display = hit._source.spatial.geometries.display;

        if (truncate) {
            display.coordinates = truncatePole(display)
        }

        geom = GeoJSON(display, options);

        geom.setMap(gmap);
        geometries.push(geom);

        // Construct info window
        info_window = createInfoWindow(hit);
        info_windows.push(info_window);
    }

    for (i = 0; i < geometries.length; i += 1) {
        google.maps.event.addListener(geometries[i], 'click',
            (function (i, e, hits) {
                return function (e, hits) {
                    var j;

                    google.maps.event.clearListeners(gmap, 'bounds_changed');

                    for (j = 0; j < info_windows.length; j += 1) {
                        info_windows[j].close();
                    }

                    info_windows[i].setPosition(e.latLng);
                    getQuickLook(info_windows[i], i);
                    info_windows[i].open(gmap, null);

                    window.setTimeout(function () {
                        addBoundsChangedListener(gmap);
                    }, 1000);
                };
            })(i));
    }
}


function cleanup() {
    var i;
    for (i = 0; i < geometries.length; i += 1) {
        geometries[i].setMap(null);
    }
    geometries = [];

    for (i = 0; i < info_windows.length; i += 1) {
        info_windows[i].close();
    }
    info_windows = [];
    quicklooks = [];

}

function redrawMap(gmap, add_listener) {
    var full_text, request;

    // Draw flight tracks
    // full_text = $('#ftext').val();
    request = createElasticsearchRequest(gmap.getBounds(), full_text, REQUEST_SIZE);
    sendElasticsearchRequest(request, updateMap, gmap);

    if (add_listener === true) {
        window.setTimeout(function () {
            addBoundsChangedListener(gmap);
        }, 1000);
    }
}

function addBoundsChangedListener(gmap) {

    google.maps.event.addListenerOnce(gmap, 'bounds_changed', function () {

        if (window.rectangle === undefined)
            redrawMap(gmap, true);
    });
}


// ---------------------------------Histogram----------------------------------
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
            width: document.getElementById('filter').offsetWidth * 0.75
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

                            $('#applyfil').trigger('click')
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
    xhr.send(JSON.stringify(req));
    xhr.onload = function (e) {
        if (xhr.readyState === 4) {
            response = JSON.parse(xhr.responseText);
            drawHistogram(response);
        }
    };
}

// Window resize

$(window).resize(function () {
    sendHistogramRequest()
});


// ----------------------- Rectangle Drawing tool ---------------------------

function rectBounds() {
    current_bounds = window.rectangle.getBounds();
    var ne = current_bounds.getNorthEast();
    var sw = current_bounds.getSouthWest();

    return [[sw.lng(), ne.lat()], [ne.lng(), sw.lat()]]
}

function queryRect(map) {
    // create ES request, send and draw results.
    var request = createElasticsearchRequest(rectBounds(), $('#ftext').val(), 100, true);
    sendElasticsearchRequest(request, updateMap, map);

    // zoom map to new rectangle
    map.fitBounds(current_bounds);
    map.setZoom(map.getZoom() - 1);
}

function clearRect() {
    window.rectangle.setMap(null);
    window.rectangle = undefined;

    // Clear rectangle corner position
    document.getElementById('NW').innerHTML = '';
    document.getElementById('SE').innerHTML = '';

}

// ----------------------------- First Load --------------------------------

$('#applyfil').one('click', function(){
    // When the user clicks apply filters for the first time. Make the map responsive.
    addBoundsChangedListener(glomap)
});

// ------------------------------window.unload---------------------------------


    // makes sure that the drawing tool is always off on page load.
    window.unload = function() {
        document.getElementById('polygon_draw').bootstrapToggle('off')
    };

// ------------------------------window.onload---------------------------------

window.onload = function () {
    var geocoder, lat, lon, map;



    // Google Maps geocoder and map object
    geocoder = new google.maps.Geocoder();
    map = new google.maps.Map(
        document.getElementById('map-container').getElementsByClassName('map')[0],
        {
            mapTypeId: google.maps.MapTypeId.TERRAIN,
            zoom: 3,
        }
    );
    glomap = map

    centreMap(map, geocoder, 'Lake Balaton, Hungary');
    google.maps.event.addListener(map, 'mousemove', function (event) {
        // Add listener to update mouse position
        // see: http://bit.ly/1zAfter
        lat = event.latLng.lat().toFixed(2);
        lon = event.latLng.lng().toFixed(2);
        $('#mouse').html('Lat: ' + lat + ', Lng: ' + lon);
    });

    // set map key colours
    $('#sentinel1Key').css('border-color', COLOUR_MAP['sentinel1']);
    $('#sentinel2Key').css('border-color', COLOUR_MAP['sentinel2']);
    $('#sentinel3Key').css('border-color', COLOUR_MAP['sentinel3']);
    $('#landsatKey').css('border-color', COLOUR_MAP['landsat']);
    $('#otherKey').css('border-color', COLOUR_MAP['other']);


    // Open welcome modal
    var welcomeModal = $('#welcome_modal');

    if (Storage !== undefined) {
        // If HTML5 storage available
        // If the modal has been closed this session do not display the modal
        if (!sessionStorage.welcomeDismissed) {
            welcomeModal.modal('show')
        }

        // When the welcome modal is closed, set the session welcomeDismissed to true to prevent showing the modal on
        // page refresh during the same browser session.
        welcomeModal.on('hidden.bs.modal', function () {
            sessionStorage.welcomeDismissed = true
        });
    } else {
        // HTML5 storage is not available, default to displaying the modal on every page load.
        welcomeModal.modal('show')
    }

    //------------------------------- Buttons -------------------------------
    $('#location_search').click(
        function () {
            centreMap(map, geocoder, $('#location').val());
        }
    );

    $('#ftext').keypress(
        function (e) {
            var charcode = e.charCode || e.keyCode || e.which;
            if (charcode === 13) {
                if (window.rectangle !== undefined) {
                    queryRect(map);
                } else {
                    redrawMap(map, false);
                }
                return false;
            }
        }
    );

    $('#location').keypress(
        function (e) {
            var charcode = e.charCode || e.keyCode || e.which;
            if (charcode === 13) {
                centreMap(map, geocoder, $('#location').val());
                return false;
            }
        }
    );

    $('#applyfil').click(
        function () {
            if (window.rectangle !== undefined) {
                queryRect(map);
            } else {
                redrawMap(map, false);
            }
        }
    );

    $('#clearfil').click(
        function () {
            var tree_menu = $('#tree_menu');
            $('#start_time').val('');
            $('#end_time').val('');
            $('#ftext').val('');
            if (window.rectangle !== undefined) {
                clearRect();
            }

            // Clear the map of objects and initialise the tree to clear the badges.
            cleanup()
            sendElasticsearchRequest(treeRequest(0), initTree, false);


            // Check all the options in the tree and make sure they are selected.
            // Checked state has to match selected state.
            if (tree_menu.treeview('getUnselected').length > 0) {
                tree_menu.treeview('checkAll', { silent: true})
                var unselected = tree_menu.treeview('getUnselected'), i;
                for (i = 0; i < unselected.length; i++){
                    tree_menu.treeview('selectNode', [ unselected[i].nodeId, {silent: true}])
                }
            }

            // Make sure the rectangle drawing tool is deactivated.
            $('#polygon_draw').bootstrapToggle('off')

        }
    );


    //---------------------------- Map drawing tool ---------------------------


    $('#polygon_draw').change(
        function () {

            if ($('#polygon_draw').prop('checked')) {

                // Show instructions panel if it is closed.
                $('#collapsePolygonInstructions').collapse('show');

                // Open rectangle search panel if not already open. Using the link for the panel title
                // rather than the bootstrap method so that the panel still behaves like an accordian.
                if (!$('#collapse_spatial').hasClass('in')){
                    document.getElementById('spatial_accordian').click()
                }

                if (window.rectangle !== undefined) {
                    clearRect();
                }

                // Clear all the satellite product objects to allow user to draw.
                for (i = 0; i < geometries.length; i += 1) {
                    geom = geometries[i];
                    geom.setMap(null)
                }

                map.setOptions({'draggable': false});
                map.setOptions({'keyboardShortcuts': false});

                var dragging = false;
                var rect;

                rect = new google.maps.Rectangle({
                    map: map
                });

                google.maps.event.addListener(map, 'mousedown', function (mEvent) {
                    // Close instruction panel if open
                    $('#collapsePolygonInstructions').collapse('hide');

                    map.draggable = false;
                    latlng1 = mEvent.latLng;
                    dragging = true;
                    pos1 = mEvent.pixel;
                });

                google.maps.event.addListener(map, 'mousemove', function (mEvent) {
                    latlng2 = mEvent.latLng;
                    showRect();
                });

                google.maps.event.addListener(map, 'mouseup', function (mEvent) {
                    map.draggable = true;
                    dragging = false;

                });

                google.maps.event.addListener(rect, 'mouseup', function (data) {
                    map.draggable = true;
                    dragging = false;

                    // Trigger apply filter at the conclusion of the drawing
                    $('#applyfil').trigger('click');

                    // Allow the user to resize and drag the rectangle at the conclusion of drawing.
                    rect.setEditable(true);
                    rect.setDraggable(true);
                });

                rect.addListener('bounds_changed',function() {
                    var ne = rect.getBounds().getNorthEast();
                    var sw = rect.getBounds().getSouthWest();


                    // update corner position
                    document.getElementById('NW').innerHTML = ' Lat: ' + ne.lat().toFixed(2) + ' Lng: ' + sw.lng().toFixed(2);
                    document.getElementById('SE').innerHTML = ' Lat: ' + sw.lat().toFixed(2) + ' Lng: ' + ne.lng().toFixed(2);
                })
            }
            else {
                // Hide instructions panel if it is open.
                $('#collapsePolygonInstructions').collapse('hide');

                // Hide Rectangle Search accordian panel if open.
                $('#collapse_spatial').collapse('hide');

                // clear rectangle drawing listeners and reinstate boundschanged listener.
                google.maps.event.clearListeners(map, 'mousedown');
                google.maps.event.clearListeners(map, 'mouseup');
                addBoundsChangedListener(map);

                dragging = false;
                map.setOptions({draggable: true});
                map.keyboardShortcuts = true;

            }

            function showRect() {
                if (dragging) {
                    if (rect === undefined) {
                        rect = new google.maps.Rectangle({
                            map: map
                        });

                    } else {
                        rect.setEditable(false)
                    }

                    // allow rectangle drawing from any angle, has issues on the international date line.
                    var lat1 = latlng1.lat();
                    var lat2 = latlng2.lat();
                    var minLat = lat1 < lat2 ? lat1 : lat2;
                    var maxLat = lat1 < lat2 ? lat2 : lat1;
                    var lng1 = latlng1.lng();
                    var lng2 = latlng2.lng();
                    var minLng = lng1 < lng2 ? lng1 : lng2;
                    var maxLng = lng1 < lng2 ? lng2 : lng1;
                    var latLngBounds = new google.maps.LatLngBounds(
                        //ne
                        new google.maps.LatLng(maxLat, minLng),
                        //sw
                        new google.maps.LatLng(minLat, maxLng)
                    );
                    rect.setBounds(latLngBounds);

                    // Update the rectangle corners in the spatial search pane.
                    document.getElementById('NW').innerHTML = ' Lat: ' + maxLat.toFixed(2) + ' Lng: ' + minLng.toFixed(2);
                    document.getElementById('SE').innerHTML = ' Lat: ' + minLat.toFixed(2) + ' Lng: ' + maxLng.toFixed(2);

                    window.rectangle = rect
                }
            }
        }
    );


    //--------------------------- 'Export Results' ---------------------------
    $('#raw_json').click(
        function () {
            loading();
            var req;
            if (window.rectangle !== undefined) {
                req = createElasticsearchRequest(rectBounds(), $('#ftext').val(), REQUEST_SIZE, true);

            } else {
                req = createElasticsearchRequest(map.getBounds(), $('#ftext').val(), REQUEST_SIZE);
            }
            sendElasticsearchRequest(req, updateRawJSON);
        }
    );

    $('#file_paths').click(
        function () {
            loading();
            var req;
            if (window.rectangle !== undefined) {
                req = createElasticsearchRequest(rectBounds(), $('#ftext').val(), REQUEST_SIZE, true);

            } else {
                req = createElasticsearchRequest(map.getBounds(), $('#ftext').val(), REQUEST_SIZE);
            }
            sendElasticsearchRequest(req, updateFilePaths);
        }
    );

    $('#dl_urls').click(
        function () {
            loading();
            var req;
            if (window.rectangle !== undefined) {
                req = createElasticsearchRequest(rectBounds(), $('#ftext').val(), REQUEST_SIZE, true);

            } else {
                req = createElasticsearchRequest(map.getBounds(), $('#ftext').val(), REQUEST_SIZE);
            }
            sendElasticsearchRequest(req, updateDownloadPaths);
        }
    );


    // When the modal is dismissed either by the x in corner, close button or by clicking outside; clear previous
    // results and set the export_modal_open variable to false to allow the loading modal to fire.

    var export_modal = $('#export_modal');
    export_modal.on('hidden.bs.modal', function (e) {
        $('#results').html('');
        export_modal_open = false
    });

    // When the modal is displayed, set the export_modal_open variable to supress firing the loading modal.
    export_modal.on('shown.bs.modal', function (e) {
        export_modal_open = true
    });

    //----------------------------- UI Widgets -------------------------------


    // initialise the treeview
    $('#tree_menu').treeview({
        data: {},
        showBorder: false
    });

    // Kick off help text popovers
    // http://stackoverflow.com/a/18537617
    $('span[data-toggle="popover"]').popover({
        'trigger': 'hover'
    });

    // Datepicker
    var picker = $('#datepicker').datepicker({
        autoclose: true,
        format: 'yyyy-mm-dd',
        startView: 2
    });


    // Draw histogram
    sendHistogramRequest();


    //---------------------------- Map main loop ------------------------------
    google.maps.event.addListenerOnce(map, 'bounds_changed', function () {
        // init Tree
        var bounds, tmp_ne, tmp_sw, nw, se, request;

        bounds = map.getBounds();
        tmp_ne = bounds.getNorthEast();
        tmp_sw = bounds.getSouthWest();
        nw = [tmp_sw.lng().toString(), tmp_ne.lat().toString()];
        se = [tmp_ne.lng().toString(), tmp_sw.lat().toString()];

        sendElasticsearchRequest(treeRequest(), initTree, false);
    });
};
