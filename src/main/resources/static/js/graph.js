define("plugin/commitgraph/graph", [
    'exports',
    'jquery'
], function(exports, $) {
    var isEmpty = function(val) { return typeof val === 'undefined'; };
    // A way of caching all commits requested and helps to speed up 
    // raphael rendering performance.
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
    // Determine the different branches(lanes) for each commits and
    // how to draw the lines between them.
    var parseGraph = function(commits) {
        var commitLen = commits.length;
        for (var i = 0; i < commitLen; i++) {
            var commit = commits[i];
            var branch = getBranch(commit.id);
            var parentCnt = commit.parents.length;
            var offset = reserve.indexOf(branch);
            var routes = [];

            if (parentCnt == 1) {
                // Create branch
                if (!isEmpty(branches[commit.parents[0].id])) {
                    for (var j = offset + 1; j < reserve.length; j++)
                        routes.push({ from: j, to: j - 1, color: reserve[j] });
                    for (var j = 0; j < offset; j++)
                        routes.push({ from: j, to: j, color: reserve[j] });
                    reserve.splice(reserve.indexOf(branch), 1);
                    routes.push({ from: offset, to: reserve.indexOf(branches[commit.parents[0].id]), color: branch });
                // Continue straight
                } else {
                    // Remove a branch if we have hit the root (first commit).
                    for (var j = 0; j < reserve.length; j++)
                        routes.push({ from: j, to: j, color: reserve[j] });
                    branches[commit.parents[0].id] = branch;
                }
            // Merge branch
            } else if (parentCnt === 2) {
                branches[commit.parents[0].id] = branch;
                for (var j = 0; j < reserve.length; j++)
                    routes.push({ from: j, to: j, color: reserve[j] });
                var otherBranch = getBranch(commit.parents[1].id);
                routes.push({ from: offset, to: reserve.indexOf(otherBranch), color: otherBranch });
            }
            nodes.push({
                commitId: commit.id,
                commitHref: commit.href,
                dotOffset: offset,
                dotColor: branch,
                routes: routes,
                labels: commit.labels || []
            });
        }
        return nodes;
    };
    exports.parseCommits = function($graph, commits, cellHeight) {
        var dotRadius = 4;
        var oldLen = nodes.length;
        parseGraph(commits);
        $graph.commitgraph({
            data: nodes.slice(oldLen, nodes.length),
            padding: (cellHeight / 2) - dotRadius,
            yStep: cellHeight,
            dotRadius: dotRadius,
            lineWidth: 2,
            finished: function(graph) {
                var graphWidth = graph.objects.getBBox().width;
                $graph.width(graphWidth + (cellHeight / 2 - dotRadius) * 2);
                if (graphWidth > 400) $graph.css('overflow-x', 'scroll');
            }
        });
    };
});
