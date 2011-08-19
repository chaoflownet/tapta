define([
    'require',
    'vendor/underscore.js',
    'vendor/backbone.js',
    './base',
    './graph',
    './settings',
    './localstorage'
], function(require) {
    var base = require('./base'),
        cfg = require('./settings'),
        Graph = require('./graph').Graph,
        storage = require('./localstorage'),
        Model = storage.Model,
        Collection = storage.Collection,
        IndexedCollection = storage.IndexedCollection;

    // root object is based on a Backbone.Model, but the save and
    // fetch functions are disabled. You can give it a custom name:
    // var app = new App({name: "myApp"});
    // This is used for testing. The name is used as top-level
    // database key.
    var App = storage.Root.extend({
        initialize: function(attributes) {
            // XXX: should localstorage_key be in effect here or used in localstorage?
            this.name = attributes.name || cfg.localstorage_key;
            // XXX: consider using a collection for this
            this.layers = [];
            var prev;
            var i;
            for (i = 0; i < 6; i++) {
                var layer = this.defchild(Layer, {}, {name: "layer"+i});
                layer.prev = prev;
                if (prev) {
                    prev.next = layer;
                }
                this.layers.push(layer);
                prev = layer;
            }
            this.fetch();
        },
        fetch: function() {
            // need to be fetched in reverse order, so actions can
            // look up activities they reference.
            this.layers.concat().reverse().forEach(function(layer) { layer.fetch(); });

            var toplayer = _.first(this.layers);
            var bottomlayer = _.last(this.layers);

            // make sure top-layer has an activity
            var act;
            if (toplayer.activities.length === 0) {
                act = toplayer.activities.create();
            } else {
                act = toplayer.activities.first();
            }
            toplayer.activity = act;
            toplayer.trigger("change:activity");
        }
    });

    var Layer = Model.extend({
        initialize: function() {
            this.activity = undefined;
            this.actions = this.defchild(Actions, [], {name:'actions'});
            // XXX: turn this into decisions only - merges are not in the lib
            this.decmers = this.defchild(DecMers, [], {name:"decmers"});
            this.activities = this.defchild(Activities, [], {name:'activities'});
            var layer = this;
            this.nodelib = {
                get: function(id) {
                    var res;
                    res = layer.actions.get(id); if (res) return res;
                    res = layer.decmers.get(id); if (res) return res;
                    res = layer.activities.get(id); if (res) return res;
                    throw "Could not find node for id: "+id;
                }
            };
        },
        fetch: function() {
            this.actions.fetch();
            this.decmers.fetch();
            this.activities.fetch();
        }
    });

    var Node = Model.extend({});

    var Action = Node.extend({
        type: "action",
        toJSON: function() {
            var attributes = _.clone(this.attributes);
            _(['act']).each(function(key){
                var tmp = this.attributes[key];
                if(tmp !== undefined){
                    attributes[key] = tmp.id;
                }
            }, this);
            return attributes;
        }
    });
    var Actions = Collection.extend({
        model: Action,
        parse: function(resp) {
            var parent = this.parent;
            var model = this.model;
            resp = _.map(resp, function(data) {
                var actid = data['activity'];
                if (actid) {
                    data['activity'] = parent.next.activities.get(actid);
                }
                return new model(data);
            });
            return resp;
        }
    });

    var DecMer = Node.extend({
        type: "decmer"
    });
    var DecMers = Collection.extend({
        model: DecMer
    });

    // An activity has a graph and remembers the selected node
    var Activity = Model.extend({
        initialize: function(attrs, opts) {
            this.layer = opts.layer || this.collection.parent;
            this.graph = this.defchild(Graph, [], {
                name: 'graph',
                nodelib: this.layer.nodelib
            });
        },
        toJSON: function() {
            var attributes = _.clone(this.attributes);
            _(["selected"]).each(function(key){
                attributes[key] = attributes[key] && attributes[key].id;
            }, this);
            return attributes;
        }
    });

    var Activities = Collection.extend({
        model: Activity,
        parse: function(response) {
            var layer = this.parent;
            var activities = _.map(response, function(attrs) {
                _(["selected"]).each(function(key){
                    attrs[key] = attrs[key] && layer.nodelib.get(attrs[key]);
                }, this);
                return new Activity(attrs, {layer: layer});
            });
            return activities;
        }
    });

    return {
        App: App,
        Layer: Layer,
        Node: Node,
        Action: Action,
        Actions: Actions,
        DecMer: DecMer,
        DecMers: DecMers,
        Activity: Activity,
        Activities: Activities
    };
});
