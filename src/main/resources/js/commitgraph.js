(function($) {
    $(document).ready(function() {
        if (!CommitGraph) return;
        var url = '/rest/api/1.0/projects/' + CommitGraph.projectKey + '/repos/' + CommitGraph.repoSlug + '/commits';
        $.ajax({
            url: url,
            data: {
                limit: 20
            }, 
            success: function(data, status) {
                var commits = data.values;
                var data = [];
                $.each(commits, function(i, commit) {

                });
                data.push(["10c2993a6ba2", [0, 1], [[0, 0, 1]]]);
                data.push(["e5f3e2cf9be5", [0, 1], [[0, 0, 1]]]);
                $('#commit-graph').commits({
                    width: 400,
                    height: 600,
                    orientation: 'vertical',
                    data: data
                });
            }
        });
    });
})(jQuery);
