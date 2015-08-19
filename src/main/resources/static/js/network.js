define("plugin/commitgraph/network", [
    'exports',
    'jquery',
    'plugin/commitgraph/graph'
], function(exports, $, Graph) {
    // Call this function to append commits to the graph.
    exports.applyCommits = function(commits) {
        if (commits.length == 0) return;
        var $els = $('.commit-row:not(.parsed)');
        var $container = $('.commit-graph .graph-body');
        // Create a new graph container for this round of commits
        var $container = $('<div class="graph-segment"></div>').appendTo('.commit-graph .graph-body');
        $container.wrap('<div class="wrap-stopper"></div>');
        Graph.parseCommits($container, commits, $els.eq(0).outerHeight());
        // Subsequent graph segments need to be moved up half a cell
        // so the graph looks correct.
        if ($('.commit-graph .graph-body .graph-segment').length >= 2)
            $container.parent().css({ 'margin-top': -($els.eq(0).outerHeight() / 2) });
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
    var getCommits = function() {
        eval($('commitgraph-javascript:last').html());
    };
    $(document).ready(function() {
        var $scroller = $('tbody.infinitescroll');
        var $loader = $('.commitgraph-loading-indicator').spin('large').hide();
        hideLinks();
        getCommits();
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
        }, function(newCommits) {
            hideLinks();
            getCommits();
        });
    });
})(jQuery);
