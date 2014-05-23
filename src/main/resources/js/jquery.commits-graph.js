;(function($, window, Raphael) {
    function Graph(element, options) {
        var defaults = {
            padding: 0,
            height: 800,
            width: 200,
            yStep: 20,
            xStep: 15,
            dotRadius: 3,
            lineWidth: 2,
            data: [],
            debug: false,
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
        this.paper = Raphael(this.$el[0], this.options.width, this.options.height);
        this.objects = this.paper.set();

        $.each(this.data, function(i, point) {
            var routes = self.drawRoutes(point, i);
            $.each(routes, function(i, route) { self.objects.push(route); });
            self.objects.push(self.drawDot(point, i));
            self.objects.push(self.drawLabels(point, point[1][0], i));
        });
    };

    Graph.prototype.drawDot = function(point, yStep) {
        var dot = this.paper.circle(this.getXPos(point[1][0]), this.getYPos(yStep), this.options.dotRadius)
                            .attr({ fill: this.getColor(point[1][1]), 'stroke-width': 0 });
        dot.hover(function() {
            dot.animate({ transform: 'S 1.5 1.5' }, 50);           
        }, function() {
            dot.animate({ transform: 'S 1 1' }, 50);           
        });
        return dot;
    };

    Graph.prototype.drawLabels = function(point, xStep, yStep) {
        if (point[3].length === 0) return;
        var triSize = 10;
        var semiTriSize = triSize / 3 * 2;
        var commitPadding = 5;
        var xPos = this.getXPos(xStep) - this.options.dotRadius - 5;
        var yPos = this.getYPos(yStep);
        var color = 'rgba(51, 51, 51, 80)';
        var label = this.paper.set();
        // Small triangle
        var triXPos = xPos - semiTriSize;
        label.push(this.paper.path([
            'M', triXPos, yPos - (triSize / 2),
            'L', xPos, yPos,
            'L', xPos - semiTriSize, yPos + (triSize / 2),
            'L', triXPos, yPos - triSize
        ]).attr({ fill: color, stroke: 'none' }));
        // Draw the text off screen to get the width
        var text = this.paper
            .text(0, 0, point[3].join(', '))
            .attr({ 
                fill: '#FFF', 
                stroke: 'none',
                'font-size': '11px',
                'font-family': 'monospace',
                'text-anchor': 'end', 
                'alignment-baseline': 'baseline' 
            });
        var textBox = text.getBBox();
        var textPadding = 3;
        var LRPadding = 3;
        var box = this.paper
            .rect(triXPos - textBox.width - textPadding * 2 - LRPadding * 2, 
                  yPos - (textBox.height / 2) - textPadding, 
                  textBox.width + textPadding * 2 + LRPadding * 2, 
                  textBox.height + textPadding * 2)
            .attr({ fill: color, stroke: 'none' });
        label.push(box);
        // Move the text back into place
        text.attr({ 
            x: box.getBBox().x + textPadding + LRPadding, 
            y: box.getBBox().y + (box.getBBox().height / 2) 
        }).toFront();
        label.push(text);
        return label;
    };

    Graph.prototype.drawRoutes = function(point, yStep) {
        // Loop over the routes in reverse so the
        // lines lay on top of each other properly.
        var quarterXStep = this.options.xStep / 4;
        var twoThirdYStep = this.options.yStep / 3 * 2;
        var fromY = this.getYPos(yStep);
        var toY = this.getYPos(yStep + 1);
        var routes = [];

        for (var i = point[2].length - 1; i >= 0; i--) {
            var route = point[2][i];
            var fromX = this.getXPos(route[0]);
            var toX = this.getXPos(route[1]);
            var pathOptions = { stroke: this.getColor(route[2]), 'stroke-width': this.options.lineWidth };
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

    $.fn.commits = function(options) {
        return this.each(function() {
            new Graph(this, options);
        });
    };
})(window.jQuery, window, Raphael);
