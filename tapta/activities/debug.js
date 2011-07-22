define([
    'require'
], function(require) {
    var DEBUG = {
        controller: true,
        spaceout: true,
        panes: true,
        view: {
            events: true,
            init: true,
            render: true
        },
        model: {
            events: true
        }
    };

    return DEBUG;
});
