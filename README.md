# babel-plugin-htmlbars-inline-precompile [![Build Status](https://travis-ci.org/pangratz/babel-plugin-htmlbars-inline-precompile.svg?branch=master)](https://travis-ci.org/pangratz/babel-plugin-htmlbars-inline-precompile)

Babel plugin to replace ES6 tagged template strings with the `HTMLBars.precompile`d version of it:

``` js
import hbs from 'htmlbars-inline-precompile';

module("my view");

test("inline templates ftw", function(assert) {
  var view = Ember.View.create({
    greeting: "inline template world",
    template: hbs`
      <span>hello {{view.greeting}}</span>
    `
  });

  view.appendTo('#testing');

  assert.equal(view.$().html().trim(), "<span>hello inline template world</span>");
});
```

results in

``` js
module("my view");

test("inline templates ftw", function(assert) {
  var view = Ember.View.create({
    greeting: "inline template world",
    template: Ember.HTMLBars.template(function() {
      /* crazy HTMLBars template function stuff */
    })
  });

  view.appendTo('#testing');

  assert.equal(view.$().html().trim(), "<span>hello inline template world</span>");
});
```

## Usage

``` js
var HTMLBarsCompiler = require('./bower_components/ember/ember-template-compiler');
var HTMLBarsInlinePrecompile = require('babel-plugin-htmlbars-inline-precompile');

var pluginConfiguredWithCompiler = HTMLBarsInlinePrecompile(HTMLBarsCompiler.precompile);

require('babel').transform("code", {
  plugins: [ pluginConfiguredWithCompiler ]
});
```
