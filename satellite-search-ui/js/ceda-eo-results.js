

function createResultPanel(hits) {
    var elementcontent, info, view, panelrows = '';

    var i, temparray, chunk = 3;
    for (i = 0; i < hits.length; i += chunk) {
        temparray = hits.slice(i, i + chunk);
        var row = '';
        for (j = 0; j < temparray.length; j++) {

            hit = temparray[j]._source;

            var coordinates, latlng
            coordinates = hit.spatial.geometries.full_search.coordinates[0][0]
            latlng = JSON.stringify({lng: coordinates[0], lat: coordinates[1]})

            view = {
                date: hit.temporal.start_time.split('T')[0],
                instrument: hit.misc.platform["Instrument Abbreviation"],
                border_colour: colourSelect(hit.misc.platform.Mission),
                info_window_index: i + j,
                latlng: latlng
            };

            if (hit.file.quicklook_file) {
                view.thumbnail_link = 'http://data.ceda.ac.uk' + hit.file.path.truncatePath(1) + '/' + hit.file.quicklook_file
            }
            else {
                view.thumbnail_link = 'img/no_preview.png'
            }

            if (hit.file.location === "on_disk") {

                view.location_icon = '<i class="fas fa-hdd"></i>'
            } else {
                view.location_icon = '<img src="img/tape-icon.png" style="height: 15px; margin-bottom: 3px">'
            }

            var template = $('#result-panel-template').html();
            elementcontent = Mustache.render(template, view);
            row = row + elementcontent
        }
        panelrows = panelrows + "<div class='row'>" + row + "</div>"


    }

    return panelrows
}

$('#refresh').click(function () {
    $('#applyfil').trigger('click')
})

function highlightGeometry(index){
    // reset last geom
    if (lastGeom){

        geometries[lastGeom.index].setOptions({
        strokeColor: lastGeom.colour,
        strokeOpacity: 0.6
    })
    }

    // Get current geometry parameters and set the lastGeom object
    lastGeom = {
        index: index,
        colour: geometries[index].strokeColor
    }

    geometries[index].setOptions(
        {
            strokeColor: '#e50925',
            strokeOpacity: 1
        }
    )
}

function openinfowindow(window_index, latlng) {
    var j;
    for (j = 0; j < info_windows.length; j += 1) {
        info_windows[j].close();
    }

    highlightGeometry(window_index)

    info_windows[window_index].setPosition(latlng);
    getQuickLook(info_windows[window_index], window_index);
    info_windows[window_index].open(glomap, null);

    $('.result-selected').removeClass('result-selected')
    $("#result_" + window_index).addClass('result-selected')




}