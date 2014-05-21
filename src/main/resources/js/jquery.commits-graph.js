;(function($, window, Raphael) {
// -- Route --------------------------------------------------------

function Route(commit, data, options) {
    this._data = data;
    this.commit = commit;
    this.options = options;
    this.from = data[0];
    this.to = data[1];
    this.branch = data[2];
}

Route.prototype.drawRoute = function(ctx) {
    var box = newBox();
    var topOffset = 10 * this.options.scaleFactor;
    var from_x = this.options.width - this.from * this.options.xStep - this.options.dotRadius;
    var from_y = topOffset + this.commit.idx * this.options.yStep + this.options.dotRadius;
    var to_x = this.options.width - this.to * this.options.xStep - this.options.dotRadius;
    var to_y = topOffset + (this.commit.idx + 1) * this.options.yStep + this.options.dotRadius;
    box.x.min = from_x;
    box.y.min = from_y;
    box.x.max = to_x;
    box.y.max = to_y;

    ctx.lineWidth = this.options.lineWidth;
    ctx.strokeStyle = this.commit.graph.get_color(this.branch);
    ctx.beginPath();
    ctx.moveTo(from_x, from_y);
    if (from_x === to_x) {
        ctx.lineTo(to_x, to_y);
    } else {
        ctx.bezierCurveTo(
            from_x - this.options.xStep / 4,
            from_y + this.options.yStep / 3 * 2,
            to_x + this.options.xStep / 4,
            to_y - this.options.yStep / 3 * 2,
            to_x, to_y
        );
    }
    ctx.stroke();
    if (this.options.debug) {
        ctx.beginPath();
        ctx.rect(box.x.min, box.y.min, box.x.max - box.x.min, box.y.max - box.y.min);
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'red';
        ctx.stroke();
    }
    return box;
};

// -- Commit Node --------------------------------------------------------

function Commit(graph, idx, data, options) {
    this._data = data;
    this.graph = graph;
    this.idx = idx;
    this.options = options;
    this.sha = data[0];
    this.dot = data[1];
    this.dot_offset = this.dot[0];
    this.dot_branch = this.dot[1];

    // Get the dot coords
    this.pos = { };
    this.pos.x = this.options.width - this.dot_offset * this.options.xStep - this.options.dotRadius;
    this.pos.y = (10 * this.options.scaleFactor) + this.idx * this.options.yStep + this.options.dotRadius;

    var self = this;
    this.routes = $.map(data[2], function(e) { 
        return new Route(self, e, options); 
    });
    this.labels = data[3];
}

Commit.prototype.drawDot = function(ctx) {
    var box = newBox();
    ctx.fillStyle = this.graph.get_color(this.dot_branch);
    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, this.options.dotRadius, 0, 2 * Math.PI, true);
    box.x.min = this.pos.x;
    box.y.min = this.pos.y;
    box.x.max = this.pos.x + (this.options.dotRadius * 2);
    box.y.max = this.pos.y + (this.options.dotRadius * 2);
    ctx.fill();

    if (this.options.debug) {
        ctx.stroke();
        ctx.beginPath();
        ctx.rect(box.x.min - this.options.dotRadius, 
                box.y.min - this.options.dotRadius, 
                box.x.max - box.x.min, 
                box.y.max - box.y.min);
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'red';
        ctx.stroke();
    }

    return box;
};

Commit.prototype.drawLabel = function(ctx) {
    var box = newBox();
    if (this.labels.length === 0) return box;
    var labelTipColor = '#333';
    // Draw the label tip
    ctx.fillStyle = labelTipColor;
    ctx.beginPath();
    var triSize = 10 * this.options.scaleFactor;
    var transX = this.pos.x - triSize - 5;
    var transY = this.pos.y - (triSize / 2);
    ctx.moveTo(transX, transY);
    ctx.lineTo(transX + (triSize / 2), transY + (triSize / 2));
    ctx.lineTo(transX, transY + triSize);
    ctx.closePath();
    ctx.fill();
    // Gather the text for the label
    var labelText = this.labels.join(', ');
    var textHeight = 10 * this.options.scaleFactor;
    ctx.font = textHeight + 'px monospace';
    var textWidth = ctx.measureText(labelText).width;
    // Draw the label body
    ctx.beginPath();
    var padding = 10 * this.options.scaleFactor;
    var labelHeight = textHeight + padding;
    var labelWidth = textWidth + padding;
    var labelX = transX - labelWidth;
    var labelY = transY + (triSize / 2) - (labelHeight / 2);
    box.x.min = labelX;
    box.y.min = labelY;
    box.x.max = labelX + labelWidth + (triSize / 2);
    box.y.max = labelY + labelHeight;
    ctx.rect(labelX, labelY, labelWidth, labelHeight);
    ctx.fillStyle = labelTipColor;
    ctx.fill();
    // Draw the text
    ctx.fillStyle = '#FFF';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(labelText, labelX + (padding / 2), labelY + (padding / 2) + (textHeight / 2));

    if (this.options.debug) {
        ctx.stroke();
        ctx.beginPath();
        ctx.rect(box.x.min, 
                box.y.min, 
                box.x.max - box.x.min, 
                box.y.max - box.y.min);
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'red';
        ctx.stroke();
    }

    return box;
};

// -- Graph Canvas --------------------------------------------------------

function backingScale() {
    if ('devicePixelRatio' in window)
        if (window.devicePixelRatio > 1)
            return window.devicePixelRatio;
    return 1;
}

function GraphCanvas( data, options ) {
  var self = this;

  self.data = data;
  self.options = options;
  self.canvas = document.createElement("canvas");
  self.canvas.style.height = options.height + "px";
  self.canvas.style.width = options.width + "px";
  self.canvas.height = options.height;
  self.canvas.width = options.width;

  var scaleFactor = backingScale();
  if (scaleFactor > 1) {
      self.canvas.width = self.canvas.width * scaleFactor;
      self.canvas.height = self.canvas.height * scaleFactor;
  }
  self.options.yStep = options.yStep * scaleFactor;
  self.options.xStep = options.xStep * scaleFactor;
  self.options.dotRadius = options.dotRadius * scaleFactor;
  self.options.lineWidth = options.lineWidth * scaleFactor;
  self.options.width = options.width * scaleFactor;
  self.options.height = options.height * scaleFactor;
	  
  self.options.scaleFactor = scaleFactor;

  // or use context.scale(2,2) // not tested

  self.boundingBox = newBox();
}

GraphCanvas.prototype.toHTML = function () {
  var self = this;

  self.draw();

  return $(self.canvas);
};

GraphCanvas.prototype.get_color = function(branch) {
  var self = this;

};

GraphCanvas.prototype.draw = function() {
    var self = this,
    ctx = self.canvas.getContext("2d");
    ctx.lineWidth = self.options.lineWidth;

    var n_commits = self.data.length;
    for (var i=0; i<n_commits; i++) {
        var commit = new Commit(self, i, self.data[i], self.options);
        for (var j = commit.routes.length - 1; j >= 0; j--) {
            var route = commit.routes[j];
            this.checkBox(route.drawRoute(ctx));
        }
        this.checkBox(commit.drawDot(ctx));
        this.checkBox(commit.drawLabel(ctx));
    }
};

// -- Graph Plugin ------------------------------------------------------------

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
            this.objects.push(self.drawRoutes(point, i));
            this.objects.push(self.drawDot(point, i));
            this.objects.push(self.drawLabels(point, point[1][0], i));
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
    };

    Graph.prototype.drawLabels = function(point, xStep, yStep) {
        if (point[3].length === 0) return;
        var triSize = 10;
        var semiTriSize = triSize / 3 * 2;
        var commitPadding = 5;
        var xPos = this.getXPos(xStep) - this.options.dotRadius - 5;
        var yPos = this.getYPos(yStep);
        var color = 'rgba(51, 51, 51, 80)';
        // Small triangle
        this.paper.path([
            'M', xPos - semiTriSize, yPos - (triSize / 2),
            'L', xPos, yPos,
            'L', xPos - semiTriSize, yPos + (triSize / 2),
            'L', xPos - semiTriSize, yPos - triSize
        ]).attr({ fill: color, 'stroke-width': 0 });
        // Add text
        // Draw the text off screen to get the width
        var text = this.paper.text(-100, -100, point[3].join(', '))
                             .attr({ 
                                 fill: '#FFF', 
                                 'stroke-width': 0,
                                 'font-size': '11px',
                                 'font-weight': 'lighter',
                                 'font-family': 'monospace',
                                 'text-anchor': 'end', 
                                 'alignment-baseline': 'baseline' 
                             });
        var textBox = text.getBBox();
        // Black rectangle for text
        var textPadding = 3;
        var LRPadding = 3;
        var box = this.paper.rect(xPos - semiTriSize - textBox.width - textPadding * 2 - LRPadding * 2, 
                                  yPos - (textBox.height / 2) - textPadding, 
                                  textBox.width + textPadding * 2 + LRPadding * 2, 
                                  textBox.height + textPadding * 2).attr({ fill: color, 'stroke-width': 0 });
        // Move the text back into place
        text.attr({ x: box.getBBox().x + textPadding + LRPadding, y: box.getBBox().y + (box.getBBox().height / 2) }).toFront();
    };

    Graph.prototype.drawRoutes = function(point, yStep) {
        // Loop over the routes in reverse so the
        // lines lay on top of each other properly.
        var quarterXStep = this.options.xStep / 4;
        var twoThirdYStep = this.options.yStep / 3 * 2;
        var fromY = this.getYPos(yStep);
        var toY = this.getYPos(yStep + 1);

        for (var i = point[2].length - 1; i >= 0; i--) {
            var route = point[2][i];
            var fromX = this.getXPos(route[0]);
            var toX = this.getXPos(route[1]);
            var pathOptions = { stroke: this.getColor(route[2]), 'stroke-width': this.options.lineWidth };
            var moveArr = ['M', fromX, fromY];
            
            if (fromX === toX) {
                this.paper.path(moveArr.concat([
                    'L', toX, toY
                ])).attr(pathOptions);
            } else {
                this.paper.path(moveArr.concat([
                    'C', fromX - quarterXStep, fromY + twoThirdYStep, 
                        toX + quarterXStep, toY - twoThirdYStep,
                        toX, toY
                ])).attr(pathOptions);
            }
        }
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
