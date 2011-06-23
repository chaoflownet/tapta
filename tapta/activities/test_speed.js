define([
    'require',
    'vendor/underscore.js',
    'vendor/jslitmus.js',
    './functional'
], function(require) {
    var functional = require('./functional');

    var numbers = [];
    for (var i=0; i<1000; i++) numbers.push(i);
    var objects = _.map(numbers, function(n){ return {num : n}; });
    var randomized = _.sortBy(numbers, function(){ return Math.random(); });

    JSLitmus.test('functional.map() with fun', function() {
        return functional.map(function(obj){ return obj.num; }, objects);
    });

    JSLitmus.test('functional.map2() with fun', function() {
        return functional.map2(function(obj){ return obj.num; }, objects);
    });

    JSLitmus.test('functional.map3() with fun', function() {
        return functional.map2(function(obj){ return obj.num; }, objects);
    });

    JSLitmus.test('functional.map() with strfun', function() {
        return functional.map("_.num", objects);
    });
});
