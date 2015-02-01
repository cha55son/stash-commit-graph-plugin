define("plugin/commitgraph/graph", [
    'exports',
    'jquery'
], function(exports, $) {
    var isEmpty = function(val) { return typeof val === 'undefined'; };
    // Determine the different branches(lanes) for each commits and
    // how to draw the lines between them.
    var parseGraph = function(commits) {
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
            // // Add labels to the commit
            // var labels = [];
            // for (var j = 0; j < self.branches.length; j++) {
            //     var branchObj = self.branches[j];
            //     if (branchObj.latestChangeset === commit.id)
            //         labels.push({ display: self.shortenName(branchObj.displayId), href: self.getBranchLink(branchObj) });
            // }
            // for (var j = 0; j < self.tags.length; j++) {
            //     var tagObj = self.tags[j];
            //     if (tagObj.latestChangeset === commit.id)
            //         labels.push({ display: self.shortenName(tagObj.displayId), href: self.getBranchLink(tagObj) });
            // }
            nodes.push([commit.id, [offset, branch, commit.id], routes]);
        }
        return nodes;
    };
    exports.parseCommits = function($graph, commits, $els) {
        var cells = $els;
        var cellHeight = $els.eq(0).outerHeight();
        var dotRadius = 4;
        $graph.commitgraph({
            orientation: 'vertical',
            data: parseGraph(commits),
            padding: (cellHeight / 2) - dotRadius,
            yStep: cellHeight,
            dotRadius: dotRadius,
            lineWidth: 2,
            finished: function(graph) {
                // var box = graph.objects.getBBox();
                // width = Math.min(box.width + 10, $parent.width() * 0.5);
                // self.els.$graphBox.width(width);
                // if (box.width > width)
                // self.els.$graphBox.css('overflow-x', 'scroll');
                // $('.commit-container').css('padding-left', width);
            }
        });
    };
});
