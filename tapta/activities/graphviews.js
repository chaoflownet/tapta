define([
    'require',
    'vendor/underscore.js',
    './base',
    './graph',
    './settings'
], function(require) {
    var base = require('./base'),
        View = base.View,
        CFG = require('./settings'),
        Vertex = require('./graph').Vertex;

    var xToPix = function(x) {
        return CFG.gridsize.x * x;
    };
    var yToPix = function(y) {
        return CFG.gridsize.y * y;
    };

    var GraphElement = View.extend({
        remove: function() {
            // remove children from canvas - our children are raphael sets
            for (var name in this.children) {
                this.children[name].remove();
                delete this.children[name];
            }
        },
        render: function(canvas) {
            // remove previously rendered stuff
            this.remove();

            // render symbol
            this.children["symbol"] = this.symbol(canvas);
        }
    });

    // An arcview connects two vertex views
    // var ArcView = GraphElement.extend({
    //     initialize: function() {
    //         // XXX: bind to our source and target
    //         this.model.bind("change:geometry", function(opts) {
    //         });
    //     },
    //     render: function(canvas) {
    //     }
    // });


    // XXX: are we able to be stateless? binding to canvas elements could be a problem

    // if our elements do not exist anymore we do not have to care whether
    // we have bound functions to it. apart from that we can manage
    // everything stateless. the render method in this case needs to receive
    // the container geometry and the mode it shall render. It is possible
    // that one graph is displayed twice with different mode and will
    // generate events accordingly.

    // Let's call modes flavours!

    // vertex is the thing without knowledge of its payload. We are
    // not viewing the vertex, but it's payload, which is a node.
    var NodeView = GraphElement.extend({
        initialize: function() {
            // bind to our model
            this.model.bind("change:geometry", function(opts) {
                // XXX use opts.diff to move existing symol
            });
        }
    });
    Object.defineProperties(NodeView.prototype, {
        // XXX: this would be the place for free positioning.
        geometry: {
            // We use fixed size and do not scale depending on available space
            get: function() {
                var pg = this.parent.geometry,
                    mg = this.model.geometry,
                    geometry = {
                        x: pg.x + xToPix(mg.x),
                        y: pg.y + yToPix(mg.y),
                        width: xToPix(mg.width),
                        height: yToPix(mg.height)
                    };
                return geometry;
            }
        }
    });

    var InitialNodeView = NodeView.extend({
        // a filled circle centered with radius r
        symbol: function(canvas) {
            var cfg = CFG.symbols.initial,
                geo = this.geometry,
                cx = geo.x + cfg.r + (geo.width - 2 * cfg.r) / 2,
                cy = geo.y + cfg.r + (geo.height - 2 * cfg.r) / 2,
                symbol = canvas.circle(cx, cy, cfg.r);
            symbol.attr({fill: cfg.fill});
            return symbol;
        }
    });

    var FinalNodeView = NodeView.extend({
        // a filled circle surrounded by an empty circle, vertically
        // centered, left aligned
        symbol: function(canvas) {
            var cfg = CFG.symbols.final_,
                geo = this.geometry,
                cx = geo.x + cfg.r_outer,
                cy = geo.y + cfg.r_outer + (geo.height - 2 * cfg.r_outer) / 2,
                symbol = canvas.set(),
                outer = canvas.circle(cx, cy, cfg.r_outer),
                inner = canvas.circle(cx, cy, cfg.r_inner);
            outer.attr({fill: "black",
                        "fill-opacity": 0,
                        stroke: cfg.stroke,
                        "stroke-width": cfg["stroke-width"]});
            inner.attr({fill: cfg.fill});
            symbol.push(inner);
            symbol.push(outer);
            return symbol;
        }
    });

    var ActionNodeView = NodeView.extend({
        // a box with round corners and a label, centered
        symbol: function(canvas) {
            var cfg = CFG.symbols.action,
                label = this.model.payload.get('label'),
                geo = this.geometry,
                x = geo.x + (geo.width - cfg.width) / 2,
                y = geo.y + (geo.height - cfg.height) / 2,
                symbol = canvas.set(),
                rect = canvas.rect(x, y, cfg.width, cfg.height, cfg.r);
            rect.attr({fill: cfg.fill,
                       stroke: cfg.stroke,
                       "stroke-width": cfg["stroke-width"]});
            symbol.push(rect);
            if (label) {
                var text = canvas.text(x+5, y+5, label);
                symbol.push(text);
            }
            return symbol;
        }
    });

    var DecMerNodeView = NodeView.extend({
        // a diamond: colored bigger in case of decision (two outgoing)
        // without color and smaller in case of pure merge (one outgoing)
        // reasoning: a decmer with only one outgoing edge is at most a
        // merge, but not a decision. Only decisions are colorful -
        // they need to stand out, as human needs to do something in
        // contrast to forkjoin and pure merge.
        symbol: function(canvas) {
            var cfg = this.decision ? CFG.symbols.decision : CFG.symbols.merge,
                geo = this.geometry,
                edgelength = Math.sqrt(Math.pow(cfg.width, 2) / 2),
                x = geo.x + (geo.width - edgelength) / 2,
                y = geo.y + (geo.height - edgelength) / 2,
                symbol = canvas.rect(x, y, edgelength, edgelength);
            symbol.rotate(45);
            symbol.attr({fill: cfg.fill,
                         stroke: cfg.stroke,
                         "stroke-width": cfg["stroke-width"]});
        }
    });
    Object.defineProperties(DecMerNodeView.prototype, {
        // more than one outgoing edge: decision
        decision: {get: function() { return (this.outgoing > 1); }}
    });

    var ForkJoinNodeView = NodeView.extend({
        symbol: function(canvas) {
            var cfg = CFG.symbols.forkjoin,
                geo = this.geometry,
                x = geo.x + (geo.width - cfg.width) / 2,
                y = geo.y + cfg.padY,
                height = geo.height - 2 * cfg.padY,
                symbol = canvas.rect(x, y, cfg.width, height);
            symbol.attr({fill: cfg.fill,
                       stroke: cfg.stroke,
                       "stroke-width": cfg["stroke-width"]});
            return symbol;
        }
    });

    var nodeviews = {
        initial: InitialNodeView,
        "final": FinalNodeView,
        action: ActionNodeView,
        decmer: DecMerNodeView,
        forkjoin: ForkJoinNodeView
    };

    // A graph contains vertices, arcs and control areas
    var GraphView = base.View.extend({
        initialize: function() {
            this._geometry = this.options.geometry;
            this.bindToGraph(this.model);
        },
        // XXX: this could be this.model's setter
        bindToGraph: function(graph) {
            // remove old views and forget about them
            this.remove();
            this.vertices = {};
            this.model = graph;

            // no graph, nothing to do
            if (graph === undefined) return;

            // If graph model is empty, add an initial and final node
            if (graph.length === 0) {
                var initial = new Vertex({payload: "initial"});
                var final_ = new Vertex({payload: "final"});
                initial.next.push(final_);
                graph.add([initial, final_]);
            }

            // create vertex views and remember them by their models cid
            // we need that to initialize the arc views
            this.vertices = foldl(function(acc, vertex) {
                var view = this.defchild(
                    nodeviews[vertex.type],
                    {model: vertex, name: "vertex_"+vertex.cid}
                );
                acc[vertex.cid] = view;
                return acc;
            }, {}, graph.toArray(), this);

            // XXX: See how removing of nodes works and then decide
            // who is responsible for rendering arcs. Probably source
            // node renders and source and target reference it.
            //
            // // create arc views
            // this.views.push.apply(this, _.map(this.graph.arcs(), function(arc) {
            //     // XXX: probably remember the arc by source and target
            //     // cid for later removal
            //     this.defchild(ArcView, {
            //         source: this.vertices[arc[0].cid],
            //         target: this.vertices[arc[1].cid]
            //     });
            //}));

            // We are responsible for selectivly removing or adding views
            // XXX
            // this.model.graph.bind("add", XXX);
            // this.model.graph.bind("remove", XXX);
        },
        remove: function() {
            for (var cid in this.vertices) this.vertices[cid].remove();
        },
        render: function(canvas) {
            for (var cid in this.vertices) this.vertices[cid].render(canvas);
        }
    });
    Object.defineProperties(GraphView.prototype, {
        geometry: {
            get: function() { return this._geometry; },
            set: function(g) {
                // XXX: do the diffing and trigger event
                this._geometry = g;
            }
        }
    });

    return {
        GraphView: GraphView
    };
});