/**
 * Created by vdn73631 on 25/07/2017.
 */


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



function getTreeJSON(aggregatedData, numbers) {
    // Produces the JSON which makes up the data section for the Bootstrap treeview.

    if (numbers === undefined) {
        numbers = true
    }

    var tree = [];
    var tree_buckets = aggregatedData['all'];
    var satellites, childName, child, doc_count, child_JSON, satellite_node;

    // Create JSON for satellites aggregation
    if ("satellites" in tree_buckets) {
        satellites = tree_buckets['satellites']['buckets'].sort(
            function (a, b) {
            if (a.key < b.key)
                return -1;
            if (a.key > b.key)
                return 1;
            return 0;
        });

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

            // Tick or untick the root node based on the state of the children.
            // Eg. if one of the children is unchecked, uncheck the root.
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

            // Tick or untick the root node based on the state of the children.
            // Eg. if one of the children is unchecked, uncheck the root.
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
    // When user changes the state of the root node checkbox (eg Satellites) modify the children.
    // Eg. If user ticks Satellites, all the children boxes should be checked and if satellites is unchecked, all children
    // should be unchecked.

    var tree_menu = $('#tree_menu'), child, i;

    for (i = 0; i < children.length; i++) {
        child = children[i];
        tree_menu.treeview(method, [child])
    }

}

function siblingState(node) {
    // Tests state of all sibling nodes. Returns true if all of the satellites are checked, and false if one is unchecked.
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

            } else {
                tree_menu.treeview('selectNode', [data.nodeId, {silent: true}]);
                var children = data.nodes;
                childSelectToggle('checkNode', children, gmap)
            }
        },
        onNodeUnchecked: function (event, data) {
            if (data.text !== "Satellites") {
                tree_menu.treeview('unselectNode', [data.nodeId]);

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
    var i, req = [], selection;

    selection = $('#tree_menu').treeview('getUnselected');
    if (selection.length) {
        for (i = 0; i < selection.length; i++) {
            if (selection[i].text !== "Satellites") {
                req.push({
                    match: {
                        'misc.platform.Satellite.raw': selection[i].text.split(' ')[0]

                    }
                });
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