define("plugin/commitgraph/network", [
    'exports',
    'jquery',
    'plugin/commitgraph/graph'
], function(exports, $, Graph) {
    var allChangesets = [];
    // Call this function to append changesets to the graph.
    exports.applyChangesets = function(changesets) {
        if (changesets.length == 0) return;
        allChangesets = allChangesets.concat(changesets);
        var $els = $('.commit-row:not(.parsed)');
        var $container = $('.commit-graph .graph-body');
        $container.children().remove();
        Graph.parseCommits($container, allChangesets, $els.eq(0).outerHeight());
    };
});

(function($) {
    var hideLinks = function() {
        $('tr.infinitescroll-nav').hide();
        var $nextLink = $('a.scroll-next:last');
        // Change the next links href to include "contentsOnly=true"
        // which only returns a small amount of data.
        $nextLink.attr('href', $nextLink.attr('href') + '&contentsOnly=true');
    };
    var getChangesets = function() {
        eval($('commitgraph-javascript:last').html());
    };
    $(document).ready(function() {
        var $scroller = $('tbody.infinitescroll');
        var $loader = $('.commitgraph-loading-indicator').spin('large').hide();
        hideLinks();
        getChangesets();
        $scroller.infinitescroll({
            navSelector: 'tr.infinitescroll-nav',
            nextSelector: 'a.scroll-next:last',
            itemSelector: 'tr',
            loading: {
                start: function() {
                    $loader.show();
                    var $this = $(this).data('infinitescroll');
                    $this.beginAjax($this.options);
                },
                finished: function() {
                    $loader.hide();
                }
            },
            errorCallback: function() {
                $loader.spinStop().children().remove();
                $loader.html('No more history');
                $scroller.infinitescroll('pause');
            }
        }, function(newChangesets) {
            hideLinks();
            getChangesets();
        });
    });
})(jQuery);
