;(function($, window, Raphael) {
    function Graph(element, options) {
        var defaults = {
            padding: 0,
            yStep: 20,
            xStep: 15,
            dotRadius: 3,
            lineWidth: 2,
            data: [],
            finished: function(graph) { }
        };
        this.$el = $(element);
        this.options = $.extend({}, defaults, options);
        this.data = this.options.data;
        this.buildGraph();
        this.options.finished(this);
    }

    Graph.prototype.buildGraph = function() {
        var self = this;
        // To find the width we can loop and find the deepest branch.
        var deepestBranch = 0;
        $.each(this.data, function(i, point) {
            if (point.dotOffset > deepestBranch) deepestBranch = point.dotOffset;
        });
        // Magic 100 to account for routes crossing multi branches causing a buldge in the route.
        this.options.width = deepestBranch * this.options.xStep + (this.options.padding * 2) + 100; 
        this.options.height = this.data.length * this.options.yStep;
        this.paper = Raphael(this.$el[0], this.options.width, this.options.height);
        this.objects = this.paper.set();

        $.each(this.data, function(i, point) {
            // Don't add rows since it will mess up the bounding box.
            self.drawRow(point, i);
            var routes = self.drawRoutes(point, i);
            $.each(routes, function(i, route) { self.objects.push(route); });
            self.objects.push(self.drawDot(point, i));
            self.objects.push(self.drawLabels(point, i));
        });
    };

    Graph.prototype.drawRow = function(point, yStep) {
        var box = this.paper
            .rect(0,
                this.getYPos(yStep) - (this.options.yStep/2),
                this.options.width,
                this.options.yStep)
            .attr({ fill: '#EEE', 'fill-opacity': 0, stroke: 'none' })
            .toBack();
        box.hover(function() {
            box.attr({ 'fill-opacity': 1 });
        }, function() {
            box.attr({ 'fill-opacity': 0 });
        });
        return box;
    };

    Graph.prototype.drawDot = function(point, yStep) {
        var dot = this.paper
            .circle(this.getXPos(point.dotOffset), this.getYPos(yStep), this.options.dotRadius)
            .attr({
                fill: this.getColor(point.dotColor),
                'stroke-width': 0,
                cursor: 'pointer'
            });
        dot.hover(function() {
            dot.animate({ transform: 'S 1.5 1.5' }, 50);
        }, function() {
            dot.animate({ transform: 'S 1 1' }, 50);
        });
        dot.click(function() {
            window.open(point.commitHref);
        });
        return dot;
    };

    Graph.prototype.drawRoutes = function(point, yStep) {
        // Loop over the routes in reverse so the
        // lines lay on top of each other properly.
        var quarterXStep = this.options.xStep / 4;
        var twoThirdYStep = this.options.yStep / 3 * 2;
        var fromY = this.getYPos(yStep);
        var toY = this.getYPos(yStep + 1);
        var routes = [];

        for (var i = point.routes.length - 1; i >= 0; i--) {
            var route = point.routes[i];
            var fromX = this.getXPos(route.from);
            var toX = this.getXPos(route.to);
            var pathOptions = { stroke: this.getColor(route.color), 'stroke-width': this.options.lineWidth };
            var moveArr = ['M', fromX, fromY];

            var path = null;
            if (fromX === toX) {
                path = this.paper.path(moveArr.concat([
                    'L', toX, toY
                ])).attr(pathOptions);
            } else {
                path = this.paper.path(moveArr.concat([
                    'C', fromX - quarterXStep, fromY + twoThirdYStep,
                        toX + quarterXStep, toY - twoThirdYStep,
                        toX, toY
                ])).attr(pathOptions);
            }
            routes.push(path);
        }
        return routes;
    };

    Graph.prototype.drawLabels = function(point, yStep) {
        if (point.labels.length === 0) return;
        var xStep = point.dotOffset;
        var triSize = 10;
        var semiTriSize = triSize / 3 * 2;
        var commitPadding = 5;
        var xPos = this.getXPos(xStep) - this.options.dotRadius - 5;
        var yPos = this.getYPos(yStep);
        var color = 'rgba(51, 51, 51, 80)';

        this.paper.setStart();
            // Draw tooltip triangle
            var triXPos = xPos - semiTriSize;
            var tri = this.paper.path([
                'M', triXPos, yPos - (triSize / 2),
                'L', xPos, yPos,
                'L', xPos - semiTriSize, yPos + (triSize / 2),
                'L', triXPos, yPos - triSize
            ]).attr({ fill: color, stroke: 'none' });
            var textAttrs = { fill: '#FFF', font: '11px monospace', cursor: 'pointer', 'text-anchor': 'start' };
            // Create the labels and link to their respective pages
            var labels = this.paper.set();
            var startX = 0;
            for (var i = 0; i < point.labels.length; i++) {
                var text = this.paper.text(startX, 0, point.labels[i].name).attr(textAttrs);
                startX += text.getBBox().width;
                text._label = point.labels[i];
                text.click(function() { window.open(this._label.href); });
                labels.push(text);
                if (i < point.labels.length - 1) {
                    var comma = this.paper.text(startX, 0, ', ').attr(textAttrs);
                    startX += comma.getBBox().width;
                    labels.push(comma);
                }
            }
            var textBBox = labels.getBBox();
            var textPadding = 3, LRPadding = 3;
            // Draw the label box
            var labelBox = this.paper
                .rect(triXPos - textBBox.width - textPadding * 2 - LRPadding * 2,
                    yPos - (textBBox.height / 2) - textPadding,
                    textBBox.width + textPadding * 2 + LRPadding * 2,
                    textBBox.height + textPadding * 2)
                .attr({ fill: color, stroke: 'none' });
            var labelBBox = labelBox.getBBox();
            // Move the text back into place
            labels.attr({
                x: labelBBox.x + textPadding + LRPadding,
                y: labelBBox.y + labelBBox.height / 2
            }).toFront();
        var label = this.paper.setFinish();

        // var self = this;
        // var createTextAndHover = function(branch, x, y) {
        //     var aText = self.paper.text(x, y, branch.display).attr(textAttrs).attr({ 'text-anchor': 'start', fill: '#333' });
        //     aText.attr({ y: aText.getBBox().y + aText.getBBox().height });
        //     aText.hover(function() {
        //         aText.attr({ 'font-weight': 'bold' });
        //     }, function() {
        //         aText.attr({ 'font-weight': 'normal' });
        //     });
        //     aText.click(function() {
        //         window.open(branch.href);
        //     });
        //     return aText;
        // };

        // if (!singleBranch) {
        //     var rightXPos = text.getBBox().x + text.getBBox().width;
        //     var yPos = text.getBBox().y;
        //     this.paper.setStart();
        //     for (var i = 0; i < branchObjs.length; i++) {
        //         var branchObj = branchObjs[i];
        //         var aText = createTextAndHover(branchObj, rightXPos, yPos);
        //         yPos += aText.getBBox().height;
        //     }
        //     label._branchList = this.paper.setFinish();
        //     label.push(label._branchList);
        //     label._branchList.hide();
        // }

        // // Setup label event handlers
        // label.hoverset(this.paper, function() {
        //     label.toFront();
        //     var attrs = { fill: 'rgba(150, 150, 150, 255)' };
        //     box.attr(attrs);
        //     tri.attr(attrs);
        //     text.attr({ fill: '#333' }).toFront();
        //     if (singleBranch) return;
        //     text.hide();
        //     label._branchList.show();
        //     box.attr({
        //         x: label.getBBox().x - textPadding - LRPadding,
        //         width: label.getBBox().width,
        //         height: label.getBBox().height + textPadding
        //     });
        // }, function() {
        //     var attrs = { fill: color };
        //     box.attr(attrs);
        //     tri.attr(attrs);
        //     text.attr({ fill: '#FFF' });
        //     text.show();
        //     box.attr(box._oldBBox);
        //     if (singleBranch) return;
        //     label._branchList.hide();
        // });
        // label.click(function() { if (singleBranch) window.open(branchObjs[0].href); });
        return label;
    };

    Graph.prototype.getYPos = function(level) {
        return (this.options.yStep * level) + this.options.padding + this.options.dotRadius;
    };

    Graph.prototype.getXPos = function(branch) {
        return this.options.width - (this.options.xStep * branch) - this.options.padding - this.options.dotRadius;
    };

    Graph.prototype.getColor = function(branch) {
        return this.colors[branch % this.colors.length];
    };

    Graph.prototype.colors = [
        "#e11d21", "#fbca04", "#009800", "#006b75", "#207de5",
        "#0052cc", "#5319e7", "#f7c6c7", "#fad8c7", "#fef2c0",
        "#bfe5bf", "#c7def8", "#bfdadc", "#bfd4f2", "#d4c5f9",
        "#cccccc", "#84b6eb", "#e6e6e6", "#cc317c"
    ];

    $.fn.commitgraph = function(options) {
        return this.each(function() {
            new Graph(this, options);
        });
    };
})(jQuery, window, Raphael);
