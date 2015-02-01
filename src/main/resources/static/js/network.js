define("plugin/commitgraph/network", [
    'exports',
    'jquery',
    'plugin/commitgraph/graph'
], function(exports, $, Graph) {
    // Call this function to append changesets to the graph.
    exports.applyChangesets = function(changesets) {
        if (changesets.length == 0) return;
        var $els = $('.commit-row:not(.parsed)');
        // Create a new graph container for this round of commits
        var $container = $('<div class="graph-segment"></div>').appendTo('.commit-graph .graph-body')
                                                               .height(changesets.length * $els.eq(0).outerHeight());
        Graph.parseCommits($container, changesets, $els);
        $els.addClass('parsed');
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
            bufferPx: 200,
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
