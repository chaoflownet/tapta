/*
 Any global constants go here
 */
define([
    'require',
    'vendor/underscore.js',
    'jquery'
], function(require) {
    if (!window.activities){
        window.activities = {};
    }
    $.extend(window.activities, {
        /*
         * global activity related
         */
        glob: {

            // public objects
            keys: null,
            mouse: null,
            dnd: null,

            /*
             * intialize globals
             */
            initialize: _.once(function() {
                activities.glob.keys = new activities.events.KeyListener();
                activities.glob.mouse = new activities.events.MouseListener();
                activities.glob.dnd = new activities.events.DnD();
                activities.glob._inizialized = 1;
            })
        },

        /*
         * activity events namespace and event types
         */
        events: {

            // events
            MOUSE_DOWN : 0,
            MOUSE_UP   : 1,
            MOUSE_MOVE : 2,
            MOUSE_IN   : 3,
            MOUSE_OUT  : 4,
            MOUSE_WHEEL: 5,
            KEY_DOWN   : 6,
            KEY_UP     : 7,

            // keys
            KEY_SHIFT  : 16,
            KEY_CTL    : 17,
            KEY_ALT    : 18
        },

        /*
         * editor settings
         */
        settings: {
            grid: {
                res_x: 50,
                res_y: 50
            },

            rendering: {
                shadowOffsetX   : 2.5,
                shadowOffsetY   : 2.5,
                shadowBlur      : 3.0,
                shadowColor     : '#aaaaaa',
                textColor       : '#000000',
                textAlign       : 'center',
                textBaseline    : 'middle',
                lineHeight      : 14,
                fontSize        : 12,
                fontStyle       : 'sans-serif',
                rounding        : 3,
                gridsize        : 120,
                element_size    : 100,
            },

            node: {
                edgeOffset          : 5,
                borderWidth         : 2,
                fillColor           : '#edf7ff',
                borderColor         : '#b5d9ea',
                selectedFillColor   : '#fff7ae',
                selectedBorderColor : '#e3ca4b'
            },

            edge: {
                color         : '#333333',
                lineWidth     : 3,
                arrowLength   : 15,
                selectedColor : '#bbbbbb'
            },

            overlay: {
                padding     : 10,
                fillColor   : '#efefef',
                borderColor : '#dddddd',
                alpha       : 0.9,
                textColor   : '#222222'
            },

            diagram: {
                childFactories: []
            },

            actions: {

                icon_css_sprite_img: "url('icons/activities_sprite.png')",

                // css sprite positions for actions by id
                icon_css_sprite: {
                    'initial_node'  : 0,
                    'final_node'    : -23,
                    'action_node'   : -46,
                    'decision_node' : -69,
                    'merge_node'    : -92,
                    'fork_node'     : -115,
                    'join_node'     : -138,
                    'edge'          : -161,
                    'new_activity'  : -184,
                    'open_activity' : -207,
                    'save_activity' : -230,
                    'debug'         : -253,
                    'run_tests'     : -276,
                    'flip_layers'   : -299,
                    'delete_element': -322,
                    'snap'          : -345
                }
            }
        }
    });

    // new-style
    var cfg = {
        canvas: {
            width: 600,
            height: 300,
            r_corner: 10
        },
        gridsize: {
            x: 140,
            y: 60
        },
        localstorage_key: 'tapta0',
        symbols: {}
    };
    cfg.symbols.edge = {
        adx: 6,
        ady: 5,
        stroke: "#424242",
        "stroke-width": 2,
        ctrls : {
            addingnewmode: {
                stroke: "green",
                "stroke-width": 25,
                opacity: 0.2
            }
        }
    };
    cfg.symbols.initial = {
        r: 10,
        fill: "#424242"
    };
    cfg.symbols["final_"] = {
        r_inner: 8,
        r_outer: 12,
        fill: "#424242",
        stroke: "#424242",
        "stroke-width": 2
    };
    cfg.symbols.action = {
        width: 60,
        height: 40,
        r: 4,
        fill: "edf7ff",
        stroke: "#b5d9ea",
        "stroke-width": 2
    };
    cfg.symbols.forkjoin = {
        width: 5,
        padY: 10,
        fill: "#424242"
    };
    cfg.symbols.decision = {
        width: 60,
        fill: "edf7ff",
        stroke: "#b5d9ea",
        "stroke-width": 2
    };
    cfg.symbols.merge = {
        width: 60,
        fill: "424242",
        stroke: "#424242",
        "stroke-width": 2
    };

    return cfg;
});
