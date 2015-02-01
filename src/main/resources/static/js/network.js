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
    var hideLinks = function() {
        $('tr.infinitescroll-nav').hide();
    };
    $(document).ready(function() {
        var $scroller = $('tbody.infinitescroll');
        var $loader = $('.commits .loading-indicator').spin('large').hide();
        hideLinks();
        $scroller.infinitescroll({
            navSelector: 'tr.infinitescroll-nav',
            nextSelector: 'a.scroll-next:last',
            itemSelector: '.commit-row',
            loading: {
                start: function() {
                    $loader.show();
                    var $this = $(this).data('infinitescroll');
                    $this.beginAjax($this.options);
                },
                finished: function() {
                    $loader.hide();
                    var $script = $('commitgraph-javascript:last');
                    eval($script.html());
                    $script.parent().parent().remove();
                }
            },
            errorCallback: function() {
                $loader.hide();
                $scroller.infinitescroll('pause');
            }
        }, function(newChangesets) {
            // Hide all the nav links
            hideLinks();
            // Change the next links href to include "contentsOnly=true"
            // which only return a small amount of data.
            var $nextLink = $('a.scroll-next:last', $scroller);
            $nextLink.attr('href', $nextLink.attr('href') + '&contentsOnly=true');
        });
    });
})(jQuery);