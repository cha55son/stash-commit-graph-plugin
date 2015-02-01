define("plugin/commitgraph", [
    'exports',
    'jquery'
], function(exports, $) {
    // Call this function to append changesets to the graph.
    exports.applyChangesets = function(changesets) {
        console.log('Changesets: ' + changesets.length);
    };
});

(function($) {
    $(document).ready(function() {
        $('.infinitescroll').infinitescroll({
            navSelector: 'tbody.infinitescroll',
            nextSelector: 'a#scroll-next:last',
            itemSelector: '.commit-row'
        }, function(newChangesets) {
            console.log(newChangesets);
        });
    });
})(jQuery);