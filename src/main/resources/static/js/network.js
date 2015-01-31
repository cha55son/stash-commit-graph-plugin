define("plugin/commitgraph", [
    'exports',
    'jquery'
], function(exports, $) {
    // Call this function to append changesets to the graph.
    exports.applyChangesets = function(changesets, tableCells) {
        console.log('Changesets: ' + changesets.length);
        console.log('tableCells: ' + tableCells);
    };
});
