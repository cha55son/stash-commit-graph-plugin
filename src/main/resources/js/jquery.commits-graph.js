;(function($, window, undefined) {
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
    var topOffset = 10 * this.options.scaleFactor;
    var from_x = this.options.width - this.from * this.options.x_step - this.options.dotRadius;
    var from_y = topOffset + this.commit.idx * this.options.y_step + this.options.dotRadius;
    var to_x = this.options.width - this.to * this.options.x_step - this.options.dotRadius;
    var to_y = topOffset + (this.commit.idx + 1) * this.options.y_step + this.options.dotRadius;

    ctx.strokeStyle = this.commit.graph.get_color(this.branch);
    ctx.beginPath();
    ctx.moveTo(from_x, from_y);
    if (from_x === to_x) {
        ctx.lineTo(to_x, to_y);
    } else {
        ctx.bezierCurveTo(
            from_x - this.options.x_step / 4,
            from_y + this.options.y_step / 3 * 2,
            to_x + this.options.x_step / 4,
            to_y - this.options.y_step / 3 * 2,
            to_x, to_y
        );
    }
    ctx.stroke();
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
    this.pos.x = this.options.width - this.dot_offset * this.options.x_step - this.options.dotRadius;
    this.pos.y = (10 * this.options.scaleFactor) + this.idx * this.options.y_step + this.options.dotRadius;

    var self = this;
    this.routes = $.map(data[2], function(e) { 
        return new Route(self, e, options); 
    });
    this.labels = data[3];
}

Commit.prototype.drawDot = function(ctx) {
    ctx.fillStyle = this.graph.get_color(this.dot_branch);
    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, this.options.dotRadius, 0, 2 * Math.PI, true);
    ctx.fill();
};

Commit.prototype.drawLabel = function(ctx) {
    if (this.labels.length === 0) return;
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
    var textWidth = ctx.measureText(labelText).width * this.options.scaleFactor;
    // Draw the label body
    ctx.beginPath();
    var padding = 10 * this.options.scaleFactor;
    var labelHeight = textHeight + padding;
    var labelWidth = textWidth + padding;
    var labelX = transX - labelWidth;
    var labelY = transY + (triSize / 2) - (labelHeight / 2);
    ctx.rect(labelX, labelY, labelWidth, labelHeight);
    ctx.fillStyle = labelTipColor;
    ctx.fill();
    // Draw the text
    ctx.fillStyle = '#FFF';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(labelText, labelX + (padding / 2), labelY + (padding / 2) + (textHeight / 2));

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
  if (self.options.orientation === "horizontal") {
	if (scaleFactor < 1) {
	  self.canvas.width = self.canvas.width * scaleFactor;
	  self.canvas.height = self.canvas.height * scaleFactor;
	}
  } else {
	if (scaleFactor > 1) {
	  self.canvas.width = self.canvas.width * scaleFactor;
	  self.canvas.height = self.canvas.height * scaleFactor;
	}
  }
  self.options.y_step = options.y_step * scaleFactor;
  self.options.x_step = options.x_step * scaleFactor;
  self.options.dotRadius = options.dotRadius * scaleFactor;
  self.options.lineWidth = options.lineWidth * scaleFactor;
  self.options.width = options.width * scaleFactor;
  self.options.height = options.height * scaleFactor;
	  
  self.options.scaleFactor = scaleFactor;

  // or use context.scale(2,2) // not tested

  self.colors = [
    "#e11d21",
    "#fbca04",
    "#009800",
    "#006b75",
    "#207de5",
    "#0052cc",
    "#5319e7",
    "#f7c6c7",
    "#fad8c7",
    "#fef2c0",
    "#bfe5bf",
    "#c7def8",
    "#bfdadc",
    "#bfd4f2",
    "#d4c5f9",
    "#cccccc",
    "#84b6eb",
    "#e6e6e6",
    "#cc317c"
  ];
  // self.branch_color = {};
}

GraphCanvas.prototype.toHTML = function () {
  var self = this;

  self.draw();

  return $(self.canvas);
};

GraphCanvas.prototype.get_color = function (branch) {
  var self = this;

  var n = self.colors.length;
  return self.colors[branch % n];
};

/*

[
  sha,
  [offset, branch], //dot
  [
    [from, to, branch],  // route1
    [from, to, branch],  // route2
    [from, to, branch],
  ]  // routes
],

*/
// draw
GraphCanvas.prototype.draw = function () {
    var self = this,
    ctx = self.canvas.getContext("2d");
    ctx.lineWidth = self.options.lineWidth;

    var n_commits = self.data.length;
    for (var i=0; i<n_commits; i++) {
        var commit = new Commit(self, i, self.data[i], self.options);
        for (var j=0; j<commit.routes.length; j++) {
            var route = commit.routes[j];
            route.drawRoute(ctx);
        }
        commit.drawDot(ctx);
        commit.drawLabel(ctx);
    }
};

// -- Graph Plugin ------------------------------------------------------------

function Graph( element, options ) {
	var self = this,
    defaults = {
        height: 800,
        width: 200,
        y_step: 20,
        x_step: 20,
        orientation: "vertical",
        dotRadius: 3,
        lineWidth: 2,
        data: [],
        finished: function(graph) { }
    };
	self.element    = element;
	self.$container = $( element );
	self.options = $.extend( {}, defaults, options ) ;
    self.data = self.options.data;
	self._defaults = defaults;
	self.applyTemplate();
    self.options.finished(this);
}

// Apply results to HTML template
Graph.prototype.applyTemplate = function() {
	var self = this,
        graphCanvas = new GraphCanvas(self.data, self.options),
        $canvas = graphCanvas.toHTML();
	$canvas.appendTo(self.$container);
};

// -- Attach plugin to jQuery's prototype --------------------------------------

	$.fn.commits = function ( options ) {
		return this.each(function () {
            new Graph( this, options );
		});
	};

}( window.jQuery, window ) );
