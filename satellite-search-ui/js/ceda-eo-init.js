/*jslint browser: true, devel: true, sloppy: true*/
/*global google, $, GeoJSON*/

// Handles map drawing functions such as drawing the polygons on the map, listeners and handles the window.onload event.

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
var REQUEST_SIZE = 250;
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

var lastGeom = null
var export_modal_open = false;

function numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

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


// -----------------------------------Map--------------------------------------
var geometries = [];
var info_windows = [];
var quicklooks = [];
var results = [];

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

function colourSelect(mission) {
    // Designates a colour to the polygons based on the satellite mission.
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
    // Polygons drawn at the poles were wrapping round the globe as google maps mecator projection is limited to 85N/S.
    // Function truncates coordinates to 85 N/S for drawing purposes.

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
    // Add satellite scene polygons onto the map.

    var colour_index, geom, hit, i, info_window, options, display;

    // Display no. of results in results panel
    // $('#result-count').html(hits.length)

    // only need to pass to truncate filter if map is displaying region north/south of 70N/S
    var mapBounds = gmap.getBounds();
    var truncate;
    if (mapBounds.getNorthEast().lat() > 70 || mapBounds.getSouthWest().lat() < -70) {
        truncate = true
    } else {
        truncate = false
    }

    // Reverse the "hits" array because the ES response is ordered new - old and we want to draw the newest items on top.
    hits.reverse();
    updateProgress('Drawing Results...', 90)
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

        // Truncate the polygon coordinates
        if (truncate) {
            display.coordinates = truncatePole(display)
        }

        // Create the polygon
        geom = GeoJSON(display, options);

        geom.setMap(gmap);
        geometries.push(geom);

        // Construct info window
        info_window = createInfoWindow(hit);

        info_windows.push(info_window);
    }
    updateProgress('Complete', 100)
    // Put results in the results panel
    $('#results-rows').append(createResultPanel(hits))

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

                    $('.result-selected').removeClass('result-selected')
                    $("#result_" + i).addClass('result-selected')

                    $('#results-rows').animate({
                        scrollTop: $('#results-rows').scrollTop() + $("#result_" + i).offset().top - 180
                    }, 1000);

                    highlightGeometry(i)

                };
            })(i));
    }
    $('#loading').hide()
}


function updateProgress(text, percentage) {
    $('#loading-text').html(text)
    $('.progress-bar').width(percentage + '%')
    $('.progress-bar').html(percentage + '%')
}

function cleanup() {
    // removes all map objects
    var i;

    // Remove satellite scene polygons
    for (i = 0; i < geometries.length; i += 1) {
        geometries[i].setMap(null);
    }
    geometries = [];

    // Clear info windows
    for (i = 0; i < info_windows.length; i += 1) {
        info_windows[i].close();
    }
    info_windows = [];
    quicklooks = [];

    // Clear Results Panel
    $('#results-rows').html('')
    $('#result-count').html('')
}

function redrawMap(gmap) {
    var full_text, request;

    openSidenav()
    $('.sidenav a[href="#results-pane"]').tab('show')


    // Clear old map drawings and data
    cleanup()

    // Draw flight tracks
    request = createElasticsearchRequest(gmap.getBounds(), REQUEST_SIZE);

    updateProgress('Sending Request...', 20)
    sendElasticsearchRequest(request, updateMap, gmap);

}

function updateMap(response, gmap) {
    if (response.hits) {
        // Update "hits" and "response time" fields
        $('#resptime').html(response.took);
        $('#numresults').html(response.hits.total);
        $('#result-count').html(response.hits.hits.length + '/' + numberWithCommas(response.hits.total))


        // Draw flight tracks on a map
        drawFlightTracks(gmap, response.hits.hits);

        // $("img.lazyload").lazyload();

    }
    if (response.aggregations) {
        // Generate variable aggregation on map and display
        updateTreeDisplay(response.aggregations, gmap);
    }
}

function openSidenav() {
    closeNoAdjust()
    var map_container = $('#map-container')
    $('.sidenav').width('30%')
    map_container.width('70%')
    map_container.addClass('floatright')
    $('#key').css('left', 'calc(30vw + 10px)')

    // Resize google map
    google.maps.event.trigger(glomap, "resize");
}


$('#search').click(function () {
    openSidenav();

    // Explore data should just open the side panel unless it is on the about section in which case it should open
    if ($('.sidenav #about-tab').hasClass('active')) {
        $('.sidenav a[href="#search-pane"]').tab('show')
    }
})


$('#about').click(function () {
    openSidenav()
    $('.sidenav a[href="#about-pane"]').tab('show')

})

$('.closebtn').click(function () {
    var map_container = $('#map-container')
    $('.sidenav').width(0)
    map_container.width('100vw')
    map_container.removeClass('floatright')
    $('#key').css('left', '10px')

    // Resize google map
    google.maps.event.trigger(glomap, "resize");
})

function closeNoAdjust() {
    $('.sidenav').width(0)
}


$('#collapse_temporal').on('show.bs.collapse', function () {
    sendHistogramRequest()
})


// ------------------------------window.unload---------------------------------


// makes sure that the drawing tool is always off on page load.
window.unload = function () {
    document.getElementById$('polygon_draw').checked = false
};

// ------------------------------window.onload---------------------------------

window.onload = function () {
    var geocoder, lat, lon, map;


    // Google Maps geocoder and map object
    geocoder = new google.maps.Geocoder();
    map = new google.maps.Map(
        document.getElementById('map'),
        {
            mapTypeId: google.maps.MapTypeId.SATELLITE,
            zoom: 3,
        }
    );
    glomap = map

    centreMap(map, geocoder, 'Lake Balaton, Hungary');

    // set map key colours
    $('#sentinel1Key').css('border-color', COLOUR_MAP['sentinel1']);
    $('#sentinel2Key').css('border-color', COLOUR_MAP['sentinel2']);
    $('#sentinel3Key').css('border-color', COLOUR_MAP['sentinel3']);
    $('#landsatKey').css('border-color', COLOUR_MAP['landsat']);
    $('#otherKey').css('border-color', COLOUR_MAP['other']);

    drawingManager = new google.maps.drawing.DrawingManager({
        drawingControl: false,
        drawingControlOptions: {
            position: google.maps.ControlPosition.TOP_CENTER,
            drawingModes: ['polygon', 'rectangle']
        },
        // circleOptions: {
        //     fillColor: '#ffff00',
        //     fillOpacity: 0.1,
        //     strokeWeight: 5,
        //     clickable: true,
        //     editable: true,
        //     draggable: true,
        //     zIndex: 1
        // },
        polygonOptions: {
            fillColor: '#ffff00',
            fillOpacity: 0.1,
            strokeWeight: 5,
            clickable: true,
            editable: true,
            draggable: true,
            zIndex: 1
        },
        rectangleOptions: {
            fillColor: '#ffff00',
            fillOpacity: 0.1,
            strokeWeight: 5,
            clickable: true,
            editable: true,
            draggable: true,
            zIndex: 1
        }
    });
    drawingManager.setMap(map);


    google.maps.event.addListener(drawingManager, 'overlaycomplete', drawingComplete)


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
            $('#loading').show()
            redrawMap(map);
        }
    );

    $('#clearfil').click(
        function () {
            var tree_menu = $('#tree_menu');
            $('#start_time').val('');
            $('#end_time').val('');
            $('#ftext').val('');
            if (window.drawing !== undefined) {
                clearDrawings();
            }

            // Clear the map of objects and initialise the tree to clear the badges.
            cleanup()
            sendElasticsearchRequest(treeRequest(), initTree, false);


            // Check all the options in the tree and make sure they are selected.
            // Checked state has to match selected state.
            if (tree_menu.treeview('getUnselected').length > 0) {
                tree_menu.treeview('checkAll', {silent: true})
                var unselected = tree_menu.treeview('getUnselected'), i;
                for (i = 0; i < unselected.length; i++) {
                    tree_menu.treeview('selectNode', [unselected[i].nodeId, {silent: true}])
                }
            }

            // Make sure the rectangle drawing tool is deactivated.
            $('#polygon_draw').prop('checked', false).change()

        }
    );


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


    //---------------------------- Map main loop ------------------------------

    sendElasticsearchRequest(treeRequest(), initTree, false);

};

