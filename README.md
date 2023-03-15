⚠️ Archived ⚠️

This library has been superceded by [babel-plugin-ember-template-compilation][gh-babel-etc] and [ember-template-imports][gh-eti].

Depending on a consumer's [ember-source][gh-eti] version, [ember-cli-htmlbars][gh-ech] will select whether to use `babel-plugin-htmlbars-inline-precompile` or `babel-plugin-ember-template-compilation` - based on [this code][gh-the-condition] -- i.e: after `ember-source@3.27.0-alahpa.1`, only `babel-plugin-ember-template-compilation` will be used.

At the time of archiving this repo, [`ember-source@3.x` is not under LTS](https://emberjs.com/releases/lts/)

[gh-ember-source]: https://github.com/emberjs/ember.js/
[gh-babel-etc]: https://github.com/emberjs/babel-plugin-ember-template-compilation
[gh-eti]: https://github.com/ember-template-imports/ember-template-imports/
[gh-ech]: https://github.com/ember-cli/ember-cli-htmlbars
[gh-the-condition]: https://github.com/ember-cli/ember-cli-htmlbars/blob/edf8af6ecacdf9ac4acbfeab63f45237c2aab01b/lib/ember-addon-main.js#L197

---------------------------------


# babel-plugin-htmlbars-inline-precompile

<a href="https://github.com/ember-cli/babel-plugin-htmlbars-inline-precompile"><img alt="Build Status" src="https://github.com/ember-cli/babel-plugin-htmlbars-inline-precompile/workflows/CI/badge.svg"></a>

Babel plugin to replace tagged `.hbs` formatted strings with a precompiled version.

## Requirements

* Node 8+
* Ember 2.10+
* Babel 7

## Usage

Can be used as either a normal function invocation or a tagged template string:

```js
import hbs from 'htmlbars-inline-precompile';

hbs`some {{handlebarsthingy}}`;
hbs('some {{handlebarsthingy}}');
```

When used as a normal function invocation, you can pass additional options (e.g. to configure the resulting template's `moduleName` metadata):

```js
import hbs from 'htmlbars-inline-precompile';

hbs('some {{handlebarsthingy}}', { moduleName: 'some/path/to/file.hbs' });
```

## Babel Plugin Usage

``` js
var HTMLBarsCompiler = require('./bower_components/ember/ember-template-compiler');
var HTMLBarsInlinePrecompile = require('babel-plugin-htmlbars-inline-precompile');

require('babel').transform("code", {
  plugins: [
    [HTMLBarsInlinePrecompile, {precompile: HTMLBarsCompiler.precompile}],
  ],
});
```

### Example

``` js
import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module("my component", function(hooks) {
  setupRenderingTest(hooks);

  test('inline templates ftw', async function(assert) {
    await render(hbs`hello!`);

    assert.dom().hasText('hello!');
  });
});
```

results in

``` js
import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module("my component", function(hooks) {
  setupRenderingTest(hooks);

  test('inline templates ftw', async function(assert) {
    await render(Ember.HTMLBars.template(function() {
      /* crazy HTMLBars template function stuff */
    }));

    assert.dom().hasText('hello!');
  });
});
```
