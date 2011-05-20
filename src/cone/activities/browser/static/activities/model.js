define([
    'require',
    'cdn/underscore.js',
    'cdn/backbone.js',
    './settings',
    './localstorage',
    './placeandroute'
], function(require) {
    var placeandroute = require('./placeandroute');
    var settings = require('./settings');
    var storage = require('./localstorage');
    var Store = storage.Store;

    // XXX: temp for testing
    var testpaths = function(activity) {
        var A = new ForkJoin({name: 'A'});
        var B = new DecMer({name: 'B'});
        var C = new Action({name: 'C'});
        var D = new DecMer({name: 'D'});
        var E = new ForkJoin({name: 'E'});
        var F = new Action({name: 'F'});
        var G = new Action({name: 'G'});
        var H = new Action({name: 'H'});
        var I = new Initial({name: 'I'});
        var J = new Action({name: 'J', x_req: 2});
        var K = new Action({name: 'K'});
        var L = new Action({name: 'L'});
        var M = new Action({name: 'M'});
        var N = new Final({name: 'N'});
        var P = new Action({name: 'P'});
        var Q = new Final({name: 'Q'});
        var R = new Action({name: 'R', x_req: 3});

        // build paths
        var paths = activity.paths;
        paths.add(new Path({
            nodes: [I, A, B, C, D, E, Q]
        }));
        paths.add(new Path({
            nodes: [I, A, B, F, G, D, E, Q]
        }));
        paths.add(new Path({
            nodes: [I, A, B, N]
        }));
        paths.add(new Path({
            nodes: [I, A, H, J, K, L, M, E, Q]
        }));
        paths.add(new Path({
            nodes: [I, A, P, E, Q]
        }));
        paths.add(new Path({
            nodes: [I, A, R, E, Q]
        }));
    };

    var Model = storage.Model;
    var Collection = storage.Collection;

    // root object is based on a Backbone.Model, but the save and
    // fetch functions are disabled. You can give it a custom name:
    // var app = new App({name: "myApp"});
    // This is used for testing. The name is used as top-level
    // database key.
    var App = storage.Root.extend({
        initialize: function(attributes) {
            this.name = attributes.name || settings.localstorage_key;
            // XXX: consider using a collection for this
            this.layers = [];
            var prev;
            for (i = 0; i < 6; i++) {
                var layer = this.defchild(Layer, {}, {name:"layer"+i});
                layer.prev = prev;
                if (prev) {
                    prev.next = layer;
                }
                this.layers.push(layer);
                prev = layer;
            }

            // mark special layers
            var toplayer = _.first(this.layers);
            toplayer.toplayer = true;
            var bottomlayer = _.last(this.layers);
            bottomlayer = true;

            // create activity for top-layer and tell it to show it
            var act;
            if (toplayer.activities.length === 0) {
                act = toplayer.activities.create();
            } else {
                act = toplayer.activities.first();
            }
            toplayer.activity = act;
            
//            testpaths(toplevel.activity);
        }
    });

    var Layer = Model.extend({
        initialize: function() {
            this.initials = this.defchild(Initials, [], {name: 'initials'});
            this.finals = this.defchild(Finals, [], {name:'finals'});
            this.actions = this.defchild(Actions, [], {name:'actions'});
            this.decmers = this.defchild(DecMers, [], {name:"decmers"});
            this.forkjoins = this.defchild(ForkJoins, [], {name:'forkjoins'});
            this.activities = this.defchild(Activities, [], {name:'activities'});
        },
        obj: function(id) {
            var res;
            res = this.initials.get(id); if (res) { return res; }
            res = this.finals.get(id); if (res) { return res; }
            res = this.actions.get(id); if (res) { return res; }
            res = this.decmers.get(id); if (res) { return res; }
            res = this.forkjoins.get(id); if (res) { return res; }
            res = this.activities.get(id); if (res) { return res; }
            debugger;
            throw "Could not find node for id "+id;
        }
    });
    
    var Node = Model.extend({
        defaults: {
            x_req: 1, // varibale size supported
            y_req: 1  // fixed for now
        }
    });
    var Final = Node.extend({});
    var Initial = Node.extend({});
    var Action = Node.extend({
        toJSON: function() {
            var attributes = this.attributes;
            return _.reduce(_.keys(attributes), function(memo, key) {
                if (key === "activity") {
                    memo[key] = attributes[key].id;
                } else {
                    memo[key] = attributes[key];
                }
                return memo;
            }, {});
        }
    });

    var DecMer = Node.extend({});
    var ForkJoin = Node.extend({});

    var Initials = Collection.extend({
        model: Initial
    });

    var Finals = Collection.extend({
        model: Final
    });

    var Actions = Collection.extend({
        model: Action
    });

    var DecMers = Collection.extend({
        model: DecMer
    });

    var ForkJoins = Collection.extend({
        model: ForkJoin
    });

    var Activity = Model.extend({
        initialize: function(attrs, opts) {
            this.paths = this.defchild(Paths, [], {name:'paths'});
            this.layer = opts.layer || this.collection.parent;
            if ((!this.paths.length) && (this.layer !== undefined)) {
                // don't create path, initial and final node in the
                // storage, just "add" them. Only if the path is
                // changed later on, it will be added to the storage.
                var source = new Initial();
                var target = new Final();
                this.layer.initials.add(source);
                this.layer.finals.add(target);
                // XXX: this one only temp
                var action = new Action();
                this.layer.actions.add(action);
                this.paths.add({nodes: [source, action, target]});
            }
        },
        placeandroute: function() {
            return placeandroute(this.paths, this.cid);
        }
    });

    var Activities = Collection.extend({
        model: Activity
    });

    var Path = Model.extend({
        copy: function() {
            return new Path({
                nodes: [].concat(this.get('nodes'))
            });
        },
        count: function() {
            return _.size(this.get('nodes'));
        },
        include: function(node) {
            return _.include(this.get('nodes'), node);
        },
        last: function() {
            return _.last(this.get('nodes'));
        },
        remove: function(node) {
            var nodes = this.get('nodes');
            node = nodes.splice(_.indexOf(nodes, node), 1);
            // XXX: what to return, the node or the remaining nodes?
        },
        toJSON: function() {
            return _.pluck(this.get('nodes'), 'id');
        },
        xReq: function() {
            return _.reduce(this.get('nodes'), function (memo, node) {
                return memo + node.get('x_req');
            }, 0 );
        },
        yReq: function() {
            return 1;
            return _.max(this.get('nodes'), function (node) {
                return node.get('y_req');
            }).get('y_req');
        }
    });

    var Paths = Collection.extend({
        // On serialization (see toJSON of PATH above), only the ids
        // are stored. Upon parse (see below) the nodes that form a
        // path are looked up in the library.
        lib: undefined,
        model: Path,
        deep: function() {
            var wc = new Paths(
                this.map(function (path) {
                    return path.copy();
                })
            );
            return wc;
        },
        longest: function() {
            return this.max(function(path) { return path.xReq(); });
        },
        parse: function(response) {
            // this might be called during tests, also if no lib is
            // defined. However, the lib is only needed if there is
            // data coming from the storage.
            var layer = this.layer || this.parent.parent;
            var ids = response[0];
            nodes = _.map(ids, function(id) {
                return layer.obj(id);
            });
            var path = nodes.length ? new Path({nodes: nodes}) : undefined;
            return path;
        },
        xReq: function() {
            return this.longest().xReq();
        },
        yReq: function() {
            return this.reduce(function(memo, path) {
                return memo + path.yReq();
            }, 0);
        }
    });

    // Edges connect a source and target node and allow to insert a
    // new node in their place. Therefore they keep a reference to the
    // paths they belong to.
    var Edge = Model.extend({
        initialize: function(opts) {
            this.source = opts && opts.source;
            this.target = opts && opts.target;
            this.paths = [];
        },
        insert: function(node) {
            var source = this.source;
            _.each(this.paths, function(path) {
                var nodes = path.get('nodes');
                var idx = _.indexOf(nodes, source);
                var head = _.head(nodes, idx+1);
                var tail = _.tail(nodes, idx+1);
                path.set({nodes: head.concat(node).concat(tail)},
                         {silent: true});
            });
            _.first(this.paths).collection.trigger("change");
        }
    });

    return {
        App: App,
        Layer: Layer,
        Initial: Initial,
        Initials: Initials,
        Final: Final,
        Finals: Finals,
        Action: Action,
        Actions: Actions,
        DecMer: DecMer,
        DecMers: DecMers,
        ForkJoin: ForkJoin,
        ForkJoins: ForkJoins,
        Activity: Activity,
        Activities: Activities,
        Path: Path,
        Paths: Paths,
        Edge: Edge
    };
});
