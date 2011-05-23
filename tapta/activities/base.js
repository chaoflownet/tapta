define([
    'require',
    'cdn/underscore',
    'cdn/backbone.js'
], function(require) {
    var DEBUG_RENDER = true;

    var location = function(obj) {
        if (!obj) { obj = this; }
        if (obj.parent) {
            return location(obj.parent).concat(obj);
        } else if (obj.collection) {
            return location(obj.collection).concat(obj);
        } else {
            return [obj];
        }
    };

    var abspath = function(location) {
        var pathsep = '/';
        if (!location) { location = this.location(); }
        return _.reduce(location, function(memo, obj) {
            var name = obj.name || obj.id;
            return memo + pathsep + name;
        }, '');
    };

    var View = Backbone.View.extend({
        abspath: abspath,
        location: location,
        defchild: function(View, props) {
            var child = new View(props);
            child.name = props.name;
            child.parent = props.parent || this;
            child.bind("all", _.bind(this.eventForwarder, this));
            var realrender = child.render;
            child.render = function() {
                console.log("DEBUG:RENDER: " + child.abspath());
                realrender.apply(this, arguments);
            };
            return child;
        },
        eventForwarder: function() {
            this.trigger.apply(this, arguments);
        }
    });
    return {
        abspath: abspath,
        location: location,
        View: View
    };
});