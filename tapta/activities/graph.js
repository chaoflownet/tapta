// directed acyclic graph - persistent
define([
    'require',
    'vendor/underscore.js',
    './graphutils',
    './localstorage'
], function(require) {
    var graphutils = require('./graphutils');
    var storage = require('./localstorage');
    var Model = storage.Model;
    var Collection = storage.Collection;

    // A vertex is a container that knows its direct successors.
    var Vertex = Model.extend({
        initialize: function() {
            this._geometry = {};
            this._minwidth = 1;
            this._minheight = 1;
        },
        setGeometry: function(obj) {
            _.extend(this._geometry, obj);
            // XXX: trigger event if something changed, carrying what changed
        },
        // list of direct successors
        next: function() {
        },
        // string or object, object needs an id
        payload: function() {
            return this.get('payload');
        },
        // goes hand-in-hand with Graph.parse
        toJSON: function() {
            // we are not responsible for jsonification, but only
            // selection of what is going to be jsonified.
            return _.reduce(this.attributes, function(memo, val, key) {
                memo[key] = function() {
                    if (key === "payload") {
                        if (_.isString(val)) return val;
                        if (val.id === undefined) throw "Payload needs an id!";
                        return val.id;
                    }
                    if (key === "next") return _.pluck(val, 'id');
                    return val;
                }();
                return memo;
            }, {});
        }
    });
    Object.defineProperties(Vertex.prototype, {
        minwidth: { get: function() { return this._minwidth; } },
        minheight: { get: function() { return this._minheight; } },
        next: { get: function() {
            return this.get('next') || this.set({next:[]}).get('next');
        } },
        x: { get: function() { return this._geometry.x; } },
        y: { get: function() { return this._geometry.y; } },
        width: { get: function() { return this._geometry.width;} },
        height: { get: function() { return this._geometry.height; } }
    });

    // a graph is stored as a collection of vertices.
    // arcs are stored as direct successors on vertices
    var Graph = Collection.extend({
        arcs: function() {
            return graphutils.arcs(this.sources());
        },
        model: Vertex,
        // goes hand-in-hand with Vertex.toJSON
        parse: function(resp) {
            // create vertices and cache them by id. in the next step
            // this is used to replace references to ids with the real
            // vertices.
            var cache = {};
            var vertices = _.map(resp, function(attrs) {
                var vertex = new this.model(attrs);
                cache[vertex.id] = vertex;
                return vertex;
            }, this);

            // replace ids with the real objects
            _.each(vertices, function(vertex) {
                var attrs = vertex.attributes;
                if (this.nodelib && attrs['payload']) {
                    attrs['payload'] = this.nodelib.get(attrs['payload']);
                }
                _.each(['next'], function(name) {
                    attrs[name] = _.map(attrs[name], function(id) {
                        return cache[id];
                    });
                });
            }, this);
            return vertices;
        },
        paths: function() {
            return graphutils.paths(this.sources());
        },
        sinks: function() {
            return graphutils.sinks(this.models);
        },
        sources: function() {
            return graphutils.sources(this.models);
        }
    });

    return {
        Graph: Graph,
        Vertex: Vertex
    };
});
