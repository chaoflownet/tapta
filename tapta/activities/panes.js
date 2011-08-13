define([
    'require',
    'jquery',
    'vendor/jquery.tmpl',
    'vendor/underscore.js',
    './debug',
    './base',
    './graphviews'
], function(require) {
    var DEBUG = require('./debug'),
        base = require('./base');

    var Pane = base.View.extend({
        tagName: "div",
        className: "pane"
    });

    // a div with special divs as children
    var PaneManager = base.View.extend({
        tagName: "div",
        className: "panemanager",
        panescfg: [],
        initialize: function(props) {
            if (props.panescfg !== undefined) this.panescfg = props.panescfg;
            _.each(this.panescfg, this.append, this);
            this.init(props);
        },
        // Backbone uses the constructor which calls initialize
        // Our framework uses initialize which calls init
        // init is to be used by users of the framework, e.g. tapta
        init: function(props) {},
        append: function(cfg) {
            // create the pane
            var pane = base.View.prototype.append.call(
                this, Pane, {name: cfg.name,
                             extraClassNames: cfg.extraClassNames}
            );

            // add its content
            _.each(cfg.content, function(cfg) {
                var ViewProto = cfg.ViewProto,
                    props = cfg.propscallback !== undefined
                        ? cfg.propscallback.call(this)
                        : _.clone(cfg.props);
                props.panemanager = this;
                pane.append(ViewProto, props);
            }, this);

            return pane;
        }
    });

    var DebugInfo = base.View.extend({
        className: "debuginfo",
        name: "debuginfo",
        initialize: function() {
            this.bind("editmode", this.render);
        },
        render: function() {
            $(this.el)
                .html("<h4>Debug info</h4>")
                .append("Editmode: " + (this.options.panemanager.editmodename));
            return this;
        }
    });

    // things to be put in panes - APIs are not stable here
    // especially some mixup/mashup of editmode and tool right now

    var Tool = base.View.extend({
        tagName: "li",
        className: "tool",
        events: {
            "click": "clicked"
        },
        clicked: function() {
            // XXX: don't pass the full view, but just what is needed
            this.trigger("editmode", {name: this.name, view: this});
        },
        activate: function(layerview) {
            this.layerview = layerview;
            this.layer = layerview.model;
            $(layerview.el).delegate(".arc .ctrl", "click.editmode", this.act);
        },
        deactivate: function(layerview) {
            this.layerview = undefined;
            this.layer = undefined;
            $(layerview.el).undelegate(".editmode");
        },
        initialize: function() {
            this.bind("editmode", function(info) {
                if (info.name === this.name) {
                    $(this.el).addClass("highlight");
                } else {
                    $(this.el).removeClass("highlight");
                }
            });
            _.bindAll(this, "act");
        },
        render: function() {
            $(this.el).text(this.name);
            return this;
        }
    });

    var PropertiesView = base.View.extend({
        tagName: "div",
        className: "properties",
        events: {
            "keydown": "keydown"
        },
        initialize: function(props) {
            this.layer = props.layer;
            this.bindToActivity();
            _.bindAll(this, "bindToActivity");
            this.layer.bind("change:activity", this.bindToActivity);
        },
        bindToActivity: function() {
            if (this.layer.activity === this.activity) return;
            if (this.activity) this.activity.unbind(this.render);
            this.activity = this.layer.activity;
            if (this.activity === undefined) return;
            this.activity.bind("change:selected", this.render);
        },
        render: function() {
            $(this.el).text("");
            if (this.activity === undefined) return this;
            if (this.activity.get('selected') === undefined) return this;
            $(this.el).html(_.template(
                'Node: <%= type %>, <%= cid %><br>'
                + 'Label: '
                + '<input type="input"'
                + ' name="label"'
                + ' value="<%= label %>"'
                + ' class="label"'
                + ' /><br>'
                + 'Description: '
                + '<textarea class="description" name="description" rows="10">'
                + '<%= description %>'
                + '</textarea><br>'
                + '<div width="100%" class="update">Update</div>'
            , {
                cid: this.selected.cid,
                type: this.selected.type,
                label: this.selected.get('label') || '',
                description: this.selected.get('description') || ''
            }));
            this.$(".label")[0].focus();
            this.$(".update").click(_.bind(function() {
                this.save([this.$(".label")[0], this.$(".description")[0]]);
            }, this));
            return this;
        },
        keydown: function(info) {
            this.unsaved(info.srcElement);
            this.save_debounced([info.srcElement]);
        },
        save: function(els) {
            console.log("huhu");
            var data = foldl(function(acc, el) {
                $(el).removeClass("unsaved");
                acc[el.name] = el.value;
                return acc;
            }, {}, els);
            this.selected.set(data);
            this.selected.save();
        },
        save_debounced: _.debounce(function(els) {
            this.save(els);
        }, 400),
        unsaved: function(el) {
            $(el).addClass("unsaved");
        }
    });
    Object.defineProperties(PropertiesView.prototype, {
        selected: { get: function() { return this.activity.get('selected'); } }
    });


    // click -> select for changing properties
    // drag final node -> drop on mimo ctrl area
    var SelectTool = Tool.extend({
        act: function(info) {
            var node = info.view.model.payload;
            // ignore nodes, that have non-object payloads (initial, final,...)
            if (node.type === undefined) return;
            this.layerview.model.activity.set({
                selected: info.view.model.payload
            });
            this.layerview.model.activity.save();
        }
    });

    var gv = require('./graphviews');

    var AddNewNodeTool = Tool.extend({
        extraClassNames: ['addnode', 'addnewnode'],
        act: function(e) {
            var arcmodel = this.layerview.traverseToModel(e.target.id);
            if (arcmodel.type !== "arc") throw "Why did you call me?";
            var source = arcmodel.source,
                target = arcmodel.target;
            // create node
            var collection = this.layerview.model[this.options.collection],
                node;
            if (collection === undefined) {
                node = "forkjoin";
            } else {
                node = collection.create();
            }

            // create new vertex with action as payload
            var graph = this.layerview.model.activity.graph,
                // XXX: this triggers already spaceOut and
                // silent:true seems not to work
                newvert = new graph.model({payload: node});

            if (target === undefined) {
                // Open arc of a MIMO, create final node
                target = new graph.model({payload: "final"});
                graph.add(target, {silent:true});
                source.next.splice(arcmodel.addnewidx, 0, newvert);
            } else {
                // change next of source without triggering an event
                    source.next.splice(source.next.indexOf(target), 1, newvert);
            }
            newvert.next.push(target);
            graph.add(newvert, {silent:true});
            target.save();
            newvert.save();
            source.save();
            // XXX: this currently triggers rebinding of the graphview
            graph.trigger("rebind");
            this.layer.activity.set({
                selected: node
            });
            this.layer.activity.save();
        }
    });


    var EditModeChanger = base.View.extend({
        className: "editmodechanger",
        tagName: "li",
        initialize: function() {
            this.bind("editmode", function(name) {
                if (name === this.name) {
                    $(this.el).addClass("highlight");
                } else {
                    $(this.el).removeClass("highlight");
                }
            }, this);
        },
        render: function() {
            $(this.el).text(this.name);
            return this;
        }
    });

    var SubtractTool = EditModeChanger.extend({
        className: "subtract",
        name: "subtract"
    });

    var ToolbarView = base.View.extend({
        tagName: "ul",
        className: "toolbar",
        initialize: function() {
            this.append(SelectTool, {name: "select"});
            this.append(AddNewNodeTool, {name: "addnewaction",
                                         collection: "actions"});
            this.append(AddNewNodeTool, {name: "addnewdecmer",
                                         collection: "decmers"});
            this.append(AddNewNodeTool, {name: "addnewforkjoin",
                                         collection: "forkjoins"});
            this.append(SubtractTool);
        }
    });

    var LibItemView = Tool.extend({
        className: "libitem",
        extraClassNames: ["addnode", "addlibnode"],
        act: function(info) {
            if (info.view instanceof gv.ArcView) {
                var source = info.view.srcview.model,
                    target = info.view.tgtview && info.view.tgtview.model,
                    node = this.model;

                // XXX: code just copied from AddNewNodeTooh
                // needs to be merged

                // create new vertex with action as payload
                var graph = this.layerview.model.activity.graph,
                    // XXX: this triggers already spaceOut and
                    // silent:true seems not to work
                    newvert = new graph.model({payload: node});

                if (target === undefined) {
                    // Open arc of a MIMO, create final node
                    target = new graph.model({payload: "final"});
                    graph.add(target, {silent:true});
                    source.next.splice(info.view.addnewidx, 0, newvert);
                } else {
                    // change next of source without triggering an event
                    source.next.splice(source.next.indexOf(target), 1, newvert);
                }
                newvert.next.push(target);
                graph.add(newvert, {silent:true});
                target.save();
                newvert.save();
                source.save();
                // XXX: this currently triggers rebinding of the graphview
                graph.trigger("rebind");
            }
        },
        clicked: function() {
            // XXX: hackish - or maybe not - we are and editmode tool
            // and want to select the action for the propertiesview
            Tool.prototype.clicked.call(this);
            this.layer.activity.set({
                selected: this.model
            });
            this.layer.activity.save();
        },
        initialize: function(props) {
            Tool.prototype.initialize.call(this, props);
            this.layer = props.layer;
            this.model.bind("change:label", this.render);
        },
        render: function() {
            $(this.el).text(this.model.get('label') || "unnamed");
            return this;
        }
    });

    var LibraryView = base.View.extend({
        tagName: "ul",
        className: "library",
        initialize: function(props) {
            this.layer = props.layer;
            this.collection = this.layer[this.name];
            _.bindAll(this, "handle_add", "handle_refresh");
            this.init_children();
            this.collection.bind("add", this.handle_add);
            this.collection.bind("refresh", this.handle_refresh);
        },
        handle_add: function(model) {
            var view = this.append(LibItemView, {name: model.id,
                                                 layer: this.layer,
                                                 model: model});
            $(this.el).append(view.render().el);
        },
        handle_refresh: function() {
            this.removeChildren();
            this.init_children();
            this.render();
        },
        init_children: function() {
            _.each(this.collection.toArray(), function(action) {
                this.append(LibItemView, {name: action.id,
                                          layer: this.layer,
                                          model: action});
            }, this);
        }
    });

    return {
        DebugInfo: DebugInfo,
        LibraryView: LibraryView,
        PaneManager: PaneManager,
        PropertiesView: PropertiesView,
        ToolbarView: ToolbarView
    };
});
