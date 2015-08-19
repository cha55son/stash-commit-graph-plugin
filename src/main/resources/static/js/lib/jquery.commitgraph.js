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
        this.options.width = Math.max(1000, deepestBranch * this.options.xStep + (this.options.padding * 2) + 100);
        this.options.height = this.data.length * this.options.yStep;
        // If the last commit has parents extend the svg by
        // another half cell.
        if (this.data[this.data.length - 1].commitParents > 0) {
            this.options.height += this.options.yStep / 2; 
        }
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
            .attr({ fill: '#DDD', 'fill-opacity': 0, stroke: 'none' })
            .toBack();
        box.hover(function() {
            box.attr({ 'fill-opacity': 0.50 });
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
            var textAttrs = { fill: '#FFF', font: '11px monospace', 'text-anchor': 'start' };
            var labelAttrs = $.extend({ cursor: 'pointer' }, textAttrs);
            // Create the labels and link to their respective pages
            var labels = this.paper.set();
            var startX = 0;
            for (var i = 0; i < point.labels.length; i++) {
                var text = this.paper.text(startX, 0, point.labels[i].name).attr(labelAttrs);
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
            labels.transform('T' + 
                (labelBBox.x + textPadding + LRPadding) + ',' +
                (labelBBox.y + labelBBox.height / 2)
            ).toFront();
        var label = this.paper.setFinish();
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
        "#e11d21", "#fbca04", "#5319e7", "#cc317c", "#207de5",
        "#0052cc", "#009800", "#486EB6", "#ECDA42", "#CF2027",
        "#77C258", "#A5C33B", "#783695", "#DB7928", "#54958C",
        "#83421B", "#84b6eb", "#7F7F7F", "#006b75"
    ];

    $.fn.commitgraph = function(options) {
        return this.each(function() {
            new Graph(this, options);
        });
    };
})(jQuery, window, Raphael);
