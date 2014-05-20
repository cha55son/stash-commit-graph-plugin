(function($, ko, _) {
    var isEmpty = function(val) { return typeof val === 'undefined'; };
    // CommitGraph should be added by the template

    var CommitGraphVM = function() {
        this.els = { };
        this.els.$commitTable = $('#commit-graph-table');
        this.els.$commitList = $('> tbody', this.els.$commitTable);
        this.els.$graphBox = $('#commit-graph');

        this.urls = { };
        this.urls.base = AJS.contextPath() + '/rest/api/1.0/projects/' + CommitGraph.projectKey + '/repos/' + CommitGraph.repoSlug;
        this.urls.commits = this.urls.base + '/commits';
        this.urls.branches = this.urls.base + '/branches';
        this.urls.tags = this.urls.base + '/tags';

        this.isLoading = ko.observable(false);
        this.commits = ko.observableArray();
        this.branches = ko.observableArray();
        this.tags = ko.observableArray();

        this.ajax = { };
        this.ajax.limit = 500;

        this.getData();
    };
    CommitGraphVM.prototype.getData = function() {
        var self = this;
        this.isLoading(true);
        $.when(
            $.ajax({
                url: this.urls.commits,
                data: { limit: this.ajax.limit }
            }),
            $.ajax({ url: this.urls.branches }),
            $.ajax({ url: this.urls.tags })
        ).then(function(masterCommitData, branchData, tagData) {
            self.branches(branchData[0].values);
            self.tags(tagData[0].values);

            var masterCommits = masterCommitData[0].values;
            var finalBranchCommits = [];
            self.getBranchCommits().then(function(branchCommits) {
                // Remove duplicate commits issue/#11
                $.each(branchCommits, function(i, branchCommit) {
                    var isDup = false;
                    $.each(masterCommits.concat(finalBranchCommits), function(j, finalCommit) {
                        if (branchCommit.id === finalCommit.id) {
                            isDup = true;
                            return false;
                        }
                    });
                    if (!isDup)
                        finalBranchCommits.push(branchCommit);
                });
                // Merge branch commits into the mainline by timestamp
                $.each(finalBranchCommits, function(i, branchCommit) {
                    $.each(masterCommits, function(j, masterCommit) {
                        if (branchCommit.authorTimestamp < masterCommit.authorTimestamp) return; 
                        masterCommits.splice(j, 0, branchCommit);
                        return false;
                    });
                });
                var debounceFn = _.debounce(function() {
                    self.buildGraph();
                }, 200);
                $(window).resize(debounceFn);
                self.commits($.map(masterCommits, function(commit) {
                    return new CommitVM(commit);
                }));
                self.isLoading(false);
                self.buildGraph();
            });
        });
    };
    CommitGraphVM.prototype.getBranchCommits = function() {
        var deferred = $.Deferred();
        var cnt = this.branches().length;
        var branchCommits = [];
        var self = this;
        $.each(this.branches(), function(i, branch) {
            $.ajax({
                url: self.urls.commits,
                data: { until: branch.id, limit: self.ajax.limit },
                success: function(commitData, status) {
                    branchCommits = branchCommits.concat(commitData.values);
                },
                complete: function() {
                    if (--cnt === 0) deferred.resolve(branchCommits);
                }
            });
        });
        return deferred.promise();
    };
    CommitGraphVM.prototype.shortenName = function(name) {
        if (name.length <= 25) return name;
        return name.slice(0, 11) + '..' + name.slice(-11);
    };
    CommitGraphVM.prototype.buildGraph = function() {
        /*
        * node = [sha1, dotData, routeData, labelData]
        * sha1 (string) The sha1 for the commit
        * dotData (array) [0]: Branch
        *                 [1]: Dot color
        * routeData (array) May contain many different routes.
        *                   [x][0]: From branch
        *                   [x][1]: To branch
        *                   [x][2]: Route color
        * labelData (array) Tags to be added to the graph.
        */
        var self = this;
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

        $.each(this.commits(), function(i, commit) {
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
            // Add labels to the commit
            var labels = [];
            $.each(self.branches(), function(i, branch) {
                if (branch.latestChangeset === commit.id)
                    labels.push(self.shortenName(branch.displayId));
            });
            $.each(self.tags(), function(i, tag) {
                if (tag.latestChangeset === commit.id)
                    labels.push(self.shortenName(tag.displayId));
            });
            nodes.push([commit.id, [offset, branch], routes, labels]);
        });

        this.els.$graphBox.children().remove();
        var cellHeight = $('.commit-row', this.els.$commitList).outerHeight(true);
        var $parent = this.els.$graphBox.parent();
        var width = 1000;
        var dotRadius = 4;
        var graphHeight = this.commits().length * cellHeight - (cellHeight / 2) + (cellHeight / 2);
        this.els.$graphBox.commits({
            width: width,
            height: graphHeight,
            orientation: 'vertical',
            data: nodes,
            y_step: cellHeight,
            dotRadius: dotRadius,
            lineWidth: 2,
            finished: function(graph) {
                var graphWidth = (graph.boundingBox.x.max - graph.boundingBox.x.min) / graph.scaleFactor;
                width = Math.min(graphWidth + 5, $parent.width() * 0.5);
                self.els.$graphBox.css({
                    paddingTop: cellHeight + (cellHeight / 2) - (dotRadius / 2) - 10,
                    width: width,
                    height: graphHeight
                });
                $('.commit-container').css('padding-left', width);
            }
        });
    };

    var CommitVM = function(data) {
        $.extend(this, data);
        this.isMerge = this.parents.length > 1;
        this.date = new Date(this.authorTimestamp);
        this.commitURL = AJS.contextPath() + '/projects/' + CommitGraph.projectKey + '/repos/' + CommitGraph.repoSlug + '/commits/' + this.id;
    };

    $(document).ready(function() {
        if (!CommitGraph) return;
        ko.applyBindings(new CommitGraphVM());
    });
})(jQuery, ko, _);
