function clearAggregatedVariables() {
    var select = $('#var_multiselect').html('');
    select.multiSelect('refresh');
    var select = $('#inst_multiselect').html('');
    select.multiSelect('refresh');
}

function clearAggregatedVariablesAsButtons(){
    var child;
    var parent = document.getElementById('coll_select');
    while (parent.firstChild) {
        parent.removeChild(parent.firstChild);
    }
}

function displayAggregatedVariables(buckets, wname) {
    var select, i;

    select = $(wname);
    for (i = 0; i < buckets.length; i += 1) {
        select.multiSelect('addOption', {
            value: buckets[i].key,
            text: (buckets[i].key + ' (' + buckets[i].doc_count + ')')
        });
    }
}

function resetAggregatedVariablesAsButtons() {
    var cbutton;
    var wname = 'coll_select';
    var parent = document.getElementById(wname);
    for (cbutton of parent.childNodes){
        try {
        cbutton.classList.remove('btn-info');
        } catch (e) {}
    }
}

function requestFromButtons() {
    var cbutton, coll;
    var wname = 'coll_select';
    var parent = document.getElementById(wname);
    for (cbutton of parent.childNodes){
        try {
            if (cbutton.classList.contains('btn-info')){
                coll = cbutton.id;
            }
        } catch (e) {}
    }
    return coll;
}

function displayAggregatedVariablesAsButtons(buckets, wname, gmap) {
    var cbutton;
    var parent = document.getElementById(wname);
    for (i = 0; i < buckets.length; i += 1) {
        cbutton = document.createElement('a');
        cbutton.classList.add("btn");
        cbutton.classList.add("btn-primary");
        cbutton.classList.add("index-select");
        cbutton.id = buckets[i].key;
        cbutton.innerHTML = buckets[i].key.toUpperCase();
        cbutton.onclick = function(){
            // Refresh whole window with redirect
            resetAggregatedVariablesAsButtons();
            this.classList.add('btn-info');
            redrawMap(gmap, false, false);
        };
        parent.appendChild(cbutton);
    }
    //$(wname) = parent;
}

function requestFromMultiselect(wname) {
    var i, select, req;
    req = [];
    select = $(wname).val();

    if (select) {
        for (i of select) {
            req.push(i);
        }
    }
    return req;
}

function refreshMultiselects(){
    $('#var_multiselect').empty().multiSelect('refresh')
    $('#inst_multiselect').empty().multiSelect('refresh')
    $('#coll_multiselect').empty().multiSelect('refresh')
}

function requestFromFlightNum(){
    var fn;
    fn = $('#fnumtext').val();
    if (fn){
        if (typeof fn == "object"){
            return fn.split(' ');
        }
        else{
            return fn;
        }
    }
}

function requestFromCapswitch(){
    return document.getElementById('capswitch').checked;
}

function requestFromFlightPop(){
    var fpoptext;
    fpoptext = $('#fpoptext').val();
    if (fpoptext){
        return fpoptext;
    }
    else {
        return undefined;
    }
}

function requestFromKeyword(){
    var kw, kwtext, kwargs, req;

    kwtext = $('#kwtext').val();
    req = [];
    if (kwtext) {
        kwargs = kwtext.split(' ');
        for (kw of kwargs) {
            req.push(kw.toLowerCase());
        }
        return req;
    }
}
