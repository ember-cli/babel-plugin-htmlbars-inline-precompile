var assert = require('assert');

var babel = require('babel-core');
var HTMLBarsInlinePrecompile = require('../index');

function transform(code, precompile) {
  return babel.transform(code, {
    plugins: [
      [HTMLBarsInlinePrecompile, {precompile: precompile}],
    ],
  }).code.trim();
}

describe("htmlbars-inline-precompile", function() {
  it("strips import statement for 'htmlbars-inline-precompile' module", function() {
    var transformed = transform("import hbs from 'htmlbars-inline-precompile';\nimport Ember from 'ember';");

    assert.equal(transformed, "import Ember from 'ember';", "strips import statement");
  });

  it("throws error when import statement is not using default specifier", function() {
    try {
      transform("import { hbs } from 'htmlbars-inline-precompile'");

      assert.fail("error should have been thrown");
    } catch (e) {
      assert.ok(e.message.match(/Only `import hbs from 'htmlbars-inline-precompile'` is supported/), "needed import syntax is present");
      assert.ok(e.message.match(/You used: `import { hbs } from 'htmlbars-inline-precompile'`/), "used import syntax is present");
    }
  });


  it("replaces tagged template expressions with precompiled version", function() {
    var transformed = transform("import hbs from 'htmlbars-inline-precompile';\nvar compiled = hbs`hello`;", function(template) {
      return "precompiled(" + template + ")";
    });

    assert.equal(transformed, "var compiled = Ember.HTMLBars.template(precompiled(hello));", "tagged template is replaced");
  });

  it("doesn't replace unrelated tagged template strings", function() {
    var transformed = transform('import hbs from "htmlbars-inline-precompile";\nvar compiled = anotherTag`hello`;', function(template) {
      return "precompiled(" + template + ")";
    });

    assert.equal(transformed, "var compiled = anotherTag`hello`;", "other tagged template strings are not touched");
  });

  it("warns when the tagged template string contains placeholders", function() {
    assert.throws(function() {
      transform("import hbs from 'htmlbars-inline-precompile';\nvar compiled = hbs`string ${value}`");
    }, /placeholders inside a tagged template string are not supported/);
  });

  describe('single string argument', function() {
    it("works with a plain string as parameter hbs('string')", function() {
      var transformed = transform("import hbs from 'htmlbars-inline-precompile';\nvar compiled = hbs('hello');", function(template) {
        return "precompiled(" + template + ")";
      });

      assert.equal(transformed, "var compiled = Ember.HTMLBars.template(precompiled(hello));", "tagged template is replaced");
    });

    it("warns when more than one argument is passed", function() {
      assert.throws(function() {
        transform("import hbs from 'htmlbars-inline-precompile';\nvar compiled = hbs('first', 'second');");
      }, /hbs should be invoked with a single argument: the template string/);
    });

    it("warns when argument is not a string", function() {
      assert.throws(function() {
        transform("import hbs from 'htmlbars-inline-precompile';\nvar compiled = hbs(123);");
      }, /hbs should be invoked with a single argument: the template string/);
    });

    it("warns when no argument is passed", function() {
      assert.throws(function() {
        transform("import hbs from 'htmlbars-inline-precompile';\nvar compiled = hbs();");
      }, /hbs should be invoked with a single argument: the template string/);
    });
  });
});
