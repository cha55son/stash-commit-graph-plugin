(function($, ko, _) {
    var isEmpty = function(val) { return typeof val === 'undefined'; };
    // Used to convert the author initals to a string for color selection.
    String.prototype.hashCode = function() {
        var hash = 0;
        if (this.length == 0) return hash;
        for (i = 0; i < this.length; i++) {
            var aChar = this.charCodeAt(i);
            hash = ((hash << 5) - hash) + aChar;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash;
    };
    // CommitGraph should be added by the template
    var CommitGraphVM = function() {
        this.els = { };
        this.els.$commitTable = $('#commit-graph-table');
        this.els.$commitList = $('> tbody', this.els.$commitTable);
        this.els.$graphBox = $('#commit-graph');

        this.urls = { };
        this.urls.base = AJS.contextPath() + '/projects/' + CommitGraph.projectKey + '/repos/' + CommitGraph.repoSlug;
        this.urls.apiBase = AJS.contextPath() + '/rest/api/1.0/projects/' + CommitGraph.projectKey + '/repos/' + CommitGraph.repoSlug;
        this.urls.commits = this.urls.apiBase + '/commits';
        this.urls.branches = this.urls.apiBase + '/branches';
        this.urls.tags = this.urls.apiBase + '/tags';

        this.isLoading = ko.observable(false);
        this.displayCommits = ko.observableArray();

        // Stores 
        this.commits = [];
        this.branches = [];
        this.tags = [];
        // Hashmap of commit ids for dup removal
        this.commitsHash = { };

        this.ajax = { };
        this.ajax.limit = 300;

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
            $.ajax({ 
                url: this.urls.branches, 
                data: { limit: this.ajax.limit }
            }),
            $.ajax({ 
                url: this.urls.tags,
                data: { limit: this.ajax.limit }
            })
        ).then(function(masterCommitData, branchData, tagData) {
            self.branches = branchData[0].values;
            self.tags = tagData[0].values;
            self.commits = masterCommitData[0].values;

            // Convert to hashmap for fast lookup
            var len = self.commits.length;
            for (var i = 0; i < len; i++)
                self.commitsHash[self.commits[i].id] = self.commits[i];

            self.getBranchCommits().then(function(branchCommits) {
                for (var i = 0; i < branchCommits.length; i++) {
                    var branchCommit = branchCommits[i];
                    for (var j = 0; j < self.commits.length; j++) {
                        var masterCommit = self.commits[j];
                        if (branchCommit.authorTimestamp < masterCommit.authorTimestamp) continue;
                        self.commits.splice(j, 0, branchCommit);
                        break;
                    }
                }
                var debounceFn = _.debounce(function() {
                    self.buildGraph();
                }, 200);
                $(window).resize(debounceFn);
                self.displayCommits(self.commits.map(function(commit) {
                    return new CommitVM(commit, self);
                }));
                self.isLoading(false);
                self.buildGraph();
            });
        });
    };
    CommitGraphVM.prototype.getBranchCommits = function() {
        var self = this;
        var deferred = $.Deferred();
        var branchCommits = [];
        var ajaxCnt = this.branches.length - 1;
        for (var i = 0; i < this.branches.length; i++) {
            var branch = this.branches[i];
            if (branch.displayId === 'master') {
                ajaxCnt--; continue;
            }
            $.ajax({
                url: this.urls.commits,
                data: { until: branch.id, limit: this.ajax.limit },
                success: function(commitData, status) {
                    var dupsRemoved = self.removeDups(commitData.values);
                    for (var i = 0; i < dupsRemoved.length; i++)
                        branchCommits.push(dupsRemoved[i]);
                },
                complete: function() {
                    if (ajaxCnt-- === 0) 
                        deferred.resolve(branchCommits);
                }
            });
        }
        if (ajaxCnt <= 0)
            deferred.resolve(branchCommits);
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
        var len = 24;
        if (name.length <= len) return name;
        return name[0] + '..' + name.slice(-20);
    };
    CommitGraphVM.prototype.getCommitLink = function(commit) {
        return this.urls.base + '/commits/' + commit.id;
    };
    CommitGraphVM.prototype.getBranchLink = function(branch) {
        return this.urls.base + '/commits?until=' + encodeURI(branch.displayId);
    };
    CommitGraphVM.prototype.buildGraph = function() {
        /*
        * node = [sha1, dotData, routeData, labelData]
        * sha1 (string) The sha1 for the commit
        * dotData (array) [0]: Branch
        *                 [1]: Dot color
        *                 [2]: commit link
        * routeData (array) May contain many different routes.
        *                 [x][0]: From branch
        *                 [x][1]: To branch
        *                 [x][2]: Route color
        * labelData (array) Tags to be added to the graph.
        *                 [0]: { display: '...', href: '...' }
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
                    labels.push({ display: self.shortenName(branchObj.displayId), href: self.getBranchLink(branchObj) });
            }
            for (var j = 0; j < self.tags.length; j++) {
                var tagObj = self.tags[j];
                if (tagObj.latestChangeset === commit.id)
                    labels.push({ display: self.shortenName(tagObj.displayId), href: self.getBranchLink(tagObj) });
            }
            nodes.push([commit.id, [offset, branch, self.getCommitLink(commit)], routes, labels]);
        }

        this.els.$graphBox.children().remove();
        var cells = $('.commit-row', this.els.$commitList);
        var cellHeight = this.els.$commitList.outerHeight(true) / cells.length;
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
            }
        });
    };

    var CommitVM = function(data, graph) {
        $.extend(this, data);
        this.isMerge = this.parents.length > 1;
        this.date = new Date(this.authorTimestamp);
        this.commitURL = graph.getCommitLink(this);
    };

    CommitVM.prototype.getAuthorInitials = function() {
        var tokens = this.author.name.split(' ');
        var initials = tokens.map(function(token) {
            return token[0].toUpperCase();
        }).join('');
        return initials.slice(0, 2);
    };

    CommitVM.prototype.getAuthorColor = function() {
        var initials = this.getAuthorInitials();
        return this.authorColors[initials.hashCode() % this.authorColors.length];
    };

    CommitVM.prototype.authorColors = [
        '#610B0B', '#61210B', '#61380B', '#5F4C0B', '#5E610B', '#4B610B', '#38610B', '#21610B', '#0B610B',
        '#0B6121', '#0B6138', '#0B614B', '#0B615E', '#0B4C5F', '#0B3861', '#0B2161', '#0B0B61', '#210B61',
        '#380B61', '#4C0B5F', '#610B5E', '#610B4B', '#610B38', '#610B21', '#2E2E2E'
    ];

    $(document).ready(function() {
        if (!CommitGraph) return;
        ko.applyBindings(new CommitGraphVM());
    });
})(jQuery, ko, _);
