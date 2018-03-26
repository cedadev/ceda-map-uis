/**
 * Created by vdn73631 on 25/07/2017.
 */


// ---------------------------------------------------------------------
// ---------------------    'Export Results' Modal  --------------------
// ---------------------------------------------------------------------

$('#raw_json').click(
    function () {
        loading();
        var req = createElasticsearchRequest(glomap.getBounds(), REQUEST_SIZE);
        sendElasticsearchRequest(req, updateRawJSON);
    }
);

$('#file_paths').click(
    function () {
        loading();
        var req = createElasticsearchRequest(glomap.getBounds(), REQUEST_SIZE);
        sendElasticsearchRequest(req, updateFilePaths);
    }
);

$('#dl_urls').click(
    function () {
        loading();
        var req = createElasticsearchRequest(glomap.getBounds(), REQUEST_SIZE);
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


function sleep(miliseconds) {
    var currentTime = new Date().getTime();

    while (currentTime + miliseconds >= new Date().getTime()) {
    }
}

function updateExportResultsModal(hits) {
    loading();
    $('#results-export').html(JSON.stringify(hits, null, '    '));
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

// Update Export Modal fields

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

// loading gif inside export modal
function loading() {
    $('#results-export').html('Loading...')
}

