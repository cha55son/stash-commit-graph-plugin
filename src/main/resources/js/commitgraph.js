(function($) {
    var $commitTable = null;
    var $commitList = null;
    var $graphBox = null;
    var isEmpty = function(val) { return typeof val === 'undefined'; };
    var buildTable = function(commits) {
        $.each(commits, function(i, commit) {
            var date = new Date(commit.authorTimestamp);
            $commitList.append([
                '<tr class="commit-row">',
                    '<td>', commit.author.name, '</td>',
                    '<td>',
                        '<a class="changesetid" href="/projects/', CommitGraph.projectKey, '/repos/', CommitGraph.repoSlug, '/commits/', commit.id, '">', commit.displayId, '</a>',
                    '</td>',
                    '<td class="commit-message">', commit.message, '</td>',
                    '<td class="commit-date">', date.toDateString(), '</td>',
                '</tr>'
            ].join(''));
        });
    };
    var buildGraph = function(commits) {
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
            if (isEmpty(branches[sha])) {
                branches[sha] = branchCnt;
                reserve.push(branchCnt++);
            }
            return branches[sha];
        };

        $.each(commits, function(i, commit) {
            var branch = getBranch(commit.id);
            var parentCnt = commit.parents.length;
            var offset = reserve.indexOf(branch);
            var routes = [];

            if (parentCnt <= 1) {
                // Create branch
                if (!isEmpty(commit.parents[0]) && !isEmpty(branches[commit.parents[0].id])) {
                    for (var j = offset + 1; j < reserve.length; j++)
                        routes.push([j, j - 1, reserve[j]]);
                    for (var j = 0; j < offset; j++)
                        routes.push([j, j, reserve[j]]);
                    reserve.splice(reserve.indexOf(branch), 1);
                    routes.push([offset, reserve.indexOf(branches[commit.parents[0].id]), branch]);
                // Continue straight
                } else {
                    // Remove a branch if we have hit the root (first commit).
                    for (var j = 0; j < reserve.length; j++)
                        routes.push([j, j, reserve[j]]);
                    if (!isEmpty(commit.parents[0]))
                        branches[commit.parents[0].id] = branch;
                }
            // Merge branch
            } else if (parentCnt === 2) {
                branches[commit.parents[0].id] = branch;
                for (var j = 0; j < reserve.length; j++)
                    routes.push([j, j, reserve[j]]);
                var otherBranch = getBranch(commit.parents[1].id);
                routes.push([offset, reserve.indexOf(otherBranch), otherBranch]);
            }
            nodes.push([commit.id, [offset, branch], routes]);
        });

        $graphBox.children().remove();
        $graphBox.data('plugin_commits_graph', undefined);
        var cellHeight = $('tr', $commitList).outerHeight(true);
        var $parent = $graphBox.parent();
        var width = 25 * reserve.length;
        var dotRadius = 4;
        $graphBox.commits({
            width: width,
            height: commits.length * cellHeight - (cellHeight / 2),
            orientation: 'vertical',
            data: nodes,
            y_step: cellHeight,
            dotRadius: dotRadius,
            lineWidth: 2
        });
        $graphBox.css('top', cellHeight + (cellHeight / 2) - (dotRadius / 2) - 1);
        $('.commit-container').css('padding-left', width + 10);
        console.log(commits);
    };

    $(document).ready(function() {
        if (!CommitGraph) return;
        $commitTable = $('#commit-graph-table');
        $commitList = $('> tbody', $commitTable);
        $graphBox = $('#commit-graph');
        var url = '/rest/api/1.0/projects/' + CommitGraph.projectKey + '/repos/' + CommitGraph.repoSlug + '/commits';
        var limit = 500;
        $.ajax({
            url: url,
            data: {
                limit: limit
            }, 
            success: function(data, status) {
                var debounceFn = _.debounce(function() {
                    buildGraph(data.values);
                }, 200);
                $(window).resize(debounceFn);
                buildTable(data.values);
                buildGraph(data.values);
            }
        });
    });
})(jQuery);
