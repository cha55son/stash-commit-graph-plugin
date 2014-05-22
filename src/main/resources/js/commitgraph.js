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
        this.displayCommits = ko.observableArray();

        // Stores 
        this.commits = [];
        this.branches = [];
        this.tags = [];
        // Hashmap of commit ids for dup removal
        this.commitsHash = { };

        this.ajax = { };
        this.ajax.limit = 400;

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
            self.branches = branchData[0].values;
            self.tags = tagData[0].values;
            self.commits = masterCommitData[0].values;

            // Convert to hashmap for fast lookup
            var len = self.commits.length;
            for (var i = 0; i < len; i++)
                self.commitsHash[self.commits[i].id] = self.commits[i];

            self.getBranchSets().then(function(branchSets) {
                for (var i = 0; i < branchSets.length; i++) {
                    var set = branchSets[i];
                    var firstCommit = set[set.length - 1];
                    var parentCommit = firstCommit.parents[0];
                    if (!firstCommit) continue;
                    // Find the firstCommits parent then
                    // insert all of the branch's commits.
                    var commitsLen = self.commits.length;
                    for (var j = 0; j < commitsLen; j++) {
                        var commit = self.commits[j];
                        if (parentCommit.id !== commit.id) continue;
                        for (var k = set.length - 1; k >= 0; k--)
                            self.commits.splice(j, 0, set[k]);
                        break;
                    }
                }
                var debounceFn = _.debounce(function() {
                    self.buildGraph();
                }, 200);
                $(window).resize(debounceFn);
                self.displayCommits(self.commits.map(function(commit) {
                    return new CommitVM(commit);
                }));
                self.isLoading(false);
                self.buildGraph();
            });
        });
    };
    CommitGraphVM.prototype.getBranchSets = function() {
        var self = this;
        var deferred = $.Deferred();
        var branchSets = [];
        var ajaxCnt = this.branches.length - 1;
        for (var i = 0; i < this.branches.length; i++) {
            var branch = this.branches[i];
            if (branch.displayId === 'master') {
                ajaxCnt--;
                continue;
            }
            $.ajax({
                url: this.urls.commits,
                data: { until: branch.id, limit: this.ajax.limit },
                success: function(commitData, status) {
                    branchSets.push(self.removeDups(commitData.values));
                },
                complete: function() {
                    if (ajaxCnt-- === 0) 
                        deferred.resolve(branchSets);
                }
            });
        }
        return deferred.promise();
    };
    CommitGraphVM.prototype.removeDups = function(commits) {
        var set = [];
        var len = commits.length;
        for (var i = 0; i < len; i++) {
            var commit = commits[i];
            if (this.commitsHash[commit.id]) continue;
            set.push(commit);
            this.commitsHash[commit.id] = commit;
        }
        return set;
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

        var commitLen = this.commits.length;
        for (var i = 0; i < commitLen; i++) {
            var commit = this.commits[i];
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
            // Add labels to the commit
            var labels = [];
            for (var j = 0; j < self.branches.length; j++) {
                var branchObj = self.branches[j];
                if (branchObj.latestChangeset === commit.id)
                    labels.push(self.shortenName(branchObj.displayId));
            }
            for (var j = 0; j < self.tags.length; j++) {
                var tag = self.tags[j];
                if (tag.latestChangeset === commit.id)
                    labels.push(self.shortenName(tag.displayId));
            }
            nodes.push([commit.id, [offset, branch], routes, labels]);
        }

        this.els.$graphBox.children().remove();
        var cellHeight = $('.commit-row', this.els.$commitList).outerHeight(true);
        var $parent = this.els.$graphBox.parent();
        var width = 1000;
        var dotRadius = 4;
        var graphHeight = this.commits.length * cellHeight;
        this.els.$graphBox.commits({
            width: width,
            height: graphHeight,
            orientation: 'vertical',
            data: nodes,
            padding: (cellHeight / 2) - dotRadius,
            yStep: cellHeight,
            dotRadius: dotRadius,
            lineWidth: 2,
            finished: function(graph) {
                var box = graph.objects.getBBox();
                width = Math.min(box.width + 10, $parent.width() * 0.5);
                self.els.$graphBox.width(width);
                if (box.width > width)
                    self.els.$graphBox.css('overflow-x', 'scroll');
                $('.commit-container').css('padding-left', width);
                // var graphWidth = (graph.boundingBox.x.max - graph.boundingBox.x.min) / graph.scaleFactor;
                // width = Math.min(graphWidth + 5, $parent.width() * 0.5);
                // self.els.$graphBox.css({
                //     paddingTop: cellHeight + (cellHeight / 2) - (dotRadius / 2) - 10,
                //     width: width,
                //     height: graphHeight
                // });
                // $('.commit-container').css('padding-left', width);
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
