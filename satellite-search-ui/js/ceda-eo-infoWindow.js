/**
 * Created by Richard Smith on 25/07/2017.
 *
 * Handles the creation and customisation of Google's InfoWindow object
 */


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
            'box-shadow': '0 0 5px #3990B9', // 3D effect to highlight the button
            cursor: 'pointer'
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
        var quicklook = "<a href='" + quicklooks[i] +"' target='_blank'><img class='quicklook' src='" + quicklooks[i] + "' alt='Data quicklook image' onerror='imgError(this)'> </a>";

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
    url = $(image).data('src')
    image.src = url
}