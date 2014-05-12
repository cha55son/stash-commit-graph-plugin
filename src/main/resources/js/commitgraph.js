(function($, ko, _) {
    var isEmpty = function(val) { return typeof val === 'undefined'; };
    // CommitGraph should be added by the template

    var CommitGraphVM = function() {
        this.els = { };
        this.els.$commitTable = $('#commit-graph-table');
        this.els.$commitList = $('> tbody', this.els.$commitTable);
        this.els.$graphBox = $('#commit-graph');

        this.urls = { };
        this.urls.base = '/rest/api/1.0/projects/' + CommitGraph.projectKey + '/repos/' + CommitGraph.repoSlug;
        this.urls.commits = this.urls.base + '/commits';
        this.urls.branches = this.urls.base + '/branches';
        this.urls.tags = this.urls.base + '/tags';

        this.isLoading = ko.observable(false);

        this.getData();
    };
    CommitGraphVM.prototype.getData = function() {
        var self = this;
        this.isLoading(true);
        $.when(
            $.ajax({
                url: this.urls.commits,
                data: { limit: 500 }
            }),
            $.ajax({ url: this.urls.branches }),
            $.ajax({ url: this.urls.tags })
        ).then(function(commitData, branchData, tagData) {
            self.isLoading(false);
            // var debounceFn = _.debounce(function() {
            //     buildGraph(commitData[0].values);
            // }, 200);
            // $(window).resize(debounceFn);
            self.buildTable(commitData[0].values);
            // buildGraph(commitData[0].values, branchData[0].values, tagData[0].values);
        });
    };
    CommitGraphVM.prototype.buildTable = function(commits) {
        var self = this;
        $.each(commits, function(i, commit) {
            var date = new Date(commit.authorTimestamp);
            var isMerge = commit.parents.length > 1;
            self.els.$commitList.append([
                '<tr class="commit-row', (isMerge ? ' merge' : ''), '">',
                    '<td>', commit.author.name, '</td>',
                    '<td>',
                        '<a class="changesetid" href="/projects/', CommitGraph.projectKey, '/repos/', CommitGraph.repoSlug, '/commits/', commit.id, '">', 
                            commit.displayId, 
                        '</a>',
                        (isMerge ? '<span class="aui-lozenge merge-lozenge abbreviated" title="This commit is a merge.">M</span>' : ''),
                    '</td>',
                    '<td class="commit-message">', commit.message, '</td>',
                    '<td class="commit-date">', date.toDateString(), '</td>',
                '</tr>'
            ].join(''));
        });
    };
    CommitGraphVM.prototype.buildGraph = function(commits, branchRefs, tagRefs) {
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
        var graphHeight = commits.length * cellHeight - (cellHeight / 2);
        $graphBox.commits({
            width: width,
            height: graphHeight,
            orientation: 'vertical',
            data: nodes,
            y_step: cellHeight,
            dotRadius: dotRadius,
            lineWidth: 2
        });
        var graphWidth = Math.min(width + 10, $parent.width() * 0.4);
        $graphBox.css({
            top: cellHeight + (cellHeight / 2) - (dotRadius / 2) - 1,
            width: graphWidth,
            height: graphHeight
        });
        $('.commit-container').css('padding-left', graphWidth);
    };

    $(document).ready(function() {
        if (!CommitGraph) return;
        ko.applyBindings(new CommitGraphVM());
    });
})(jQuery, ko, _);
