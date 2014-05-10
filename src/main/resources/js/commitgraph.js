(function($) {
    $(document).ready(function() {
        if (!CommitGraph) return;
        var url = '/rest/api/1.0/projects/' + CommitGraph.projectKey + '/repos/' + CommitGraph.repoSlug + '/commits';
        var limit = 1000;
        $.ajax({
            url: url,
            data: {
                limit: limit
            }, 
            success: function(data, status) {
                var commits = data.values;
                commits.sort(function(a, b) {
                    return b.authorTimestamp - a.authorTimestamp;
                });

                /*
                * [sha1, dotData, routeData]
                * sha1 (string) The sha1 for the commit
                * dotData (array) [0]: Branch
                *                 [1]: Dot color
                * routeData (array) May contain many different routes.
                *                   [x][0]: From branch
                *                   [x][1]: To branch
                *                   [x][2]: Route color
                */
                var nodes = [];
                var branchCnt = 0;
                var reserve = [];
                var branches = { };

                var getBranch = function(sha) {
                    if (!branches[sha]) {
                        branches[sha] = branchCnt;
                        reserve.push(branchCnt++);
                    }
                    return branches[sha]
                };

                $.each(commits, function(i, commit) {
                    var branch = getBranch(commit.id);
                    var parentCnt = commit.parents.length;
                    var offset = reserve.indexOf(branch);
                    var routes = [];

                    if (parentCnt === 1) {
                        // Create branch
                        if (branches[commit.parents[0].id]) {
                            for (var j = 1; j < reserve.length; j++)
                                routes.push([j + offset + 1, j + offset + 1 - 1, reserve[j]]);
                            for (var j = 0; j < reserve.length; j++)
                                routes.push([j, j, reserve[j]]);
                            reserve.splice(reserve.indexOf(branch), 1);
                            routes.push([offset, reserve.indexOf(branches[commit.parents[0].id]), branch]);
                        // Continue straight
                        } else {
                            for (var j = 0; j < reserve.length; j++)
                                routes.push([j, j, reserve[j]]);
                            branches[commit.parents[0].id] = branch
                        }
                    // Merge branch
                    } else if (parentCnt === 2) {
                        branches[commit.parents[0].id] = branch
                        for (var j = 0; j < reserve.length; j++)
                            routes.push([j, j, reserve[j]]);
                        var otherBranch = getBranch(commit.parents[1].id);
                        routes.push([offset, reserve.indexOf(otherBranch), otherBranch]);
                    }

                    nodes.push([commit.id, [offset, branch], routes]);
                });

                var $graphBox = $('#commit-graph');
                $graphBox.commits({
                    width: 400,
                    height: 2000,
                    orientation: 'vertical',
                    data: nodes,
                    y_step: 50,
                    dotRadius: 8,
                    lineWidth: 8
                });
            }
        });
    });
})(jQuery);
