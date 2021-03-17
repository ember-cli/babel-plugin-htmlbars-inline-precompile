'use strict';

const path = require('path');

const babel = require('@babel/core');
const HTMLBarsInlinePrecompile = require('../index');
const TransformTemplateLiterals = require('@babel/plugin-transform-template-literals');
const TransformModules = require('@babel/plugin-transform-modules-amd');
const TransformUnicodeEscapes = require('@babel/plugin-transform-unicode-escapes');
const { stripIndent } = require('common-tags');

describe('htmlbars-inline-precompile', function () {
  let precompile, plugins, optionsReceived;

  function transform(code) {
    return babel
      .transform(code, {
        filename: 'foo-bar.js',
        plugins,
      })
      .code.trim();
  }

  beforeEach(function () {
    optionsReceived = undefined;
    precompile = (template, options) => {
      optionsReceived = options;
      return `"precompiled(${template})"`;
    };

    plugins = [
      [
        HTMLBarsInlinePrecompile,
        {
          precompile() {
            return precompile.apply(this, arguments);
          },

          ensureModuleApiPolyfill: false,
        },
      ],
    ];
  });

  it('supports compilation that returns a non-JSON.parseable object', function () {
    precompile = (template) => {
      return `function() { return "${template}"; }`;
    };

    let transpiled = transform(
      "import hbs from 'htmlbars-inline-precompile';\nvar compiled = hbs`hello`;"
    );

    expect(transpiled).toMatchInlineSnapshot(`
      "import { createTemplateFactory as _createTemplateFactory } from \\"@ember/template-factory\\";

      var compiled = _createTemplateFactory(
      /*
        hello
      */
      function () {
        return \\"hello\\";
      });"
    `);
  });

  it('supports compilation with templateCompilerPath', function () {
    plugins[0][1].templateCompilerPath = require.resolve('./mock-precompile');

    let transpiled = transform(
      "import hbs from 'htmlbars-inline-precompile';\nvar compiled = hbs`hello`;"
    );

    expect(transpiled).toMatchInlineSnapshot(`
      "import { createTemplateFactory as _createTemplateFactory } from \\"@ember/template-factory\\";

      var compiled = _createTemplateFactory(
      /*
        hello
      */
      precompiledFromPath(hello));"
    `);
  });

  it('does not error when transpiling multiple modules with a single plugin config', function () {
    let transpiled = transform(
      "import hbs from 'htmlbars-inline-precompile';\nvar compiled = hbs`hello`;"
    );

    expect(transpiled).toMatchInlineSnapshot(`
      "import { createTemplateFactory as _createTemplateFactory } from \\"@ember/template-factory\\";

      var compiled = _createTemplateFactory(
      /*
        hello
      */
      \\"precompiled(hello)\\");"
    `);

    transpiled = transform(
      "import hbs from 'htmlbars-inline-precompile';\nvar compiled = hbs`hello`;"
    );

    expect(transpiled).toMatchInlineSnapshot(`
      "import { createTemplateFactory as _createTemplateFactory } from \\"@ember/template-factory\\";

      var compiled = _createTemplateFactory(
      /*
        hello
      */
      \\"precompiled(hello)\\");"
    `);
  });

  it('passes options when used as a call expression', function () {
    let source = 'hello';
    transform(`import hbs from 'htmlbars-inline-precompile';\nvar compiled = hbs('${source}');`);

    expect(optionsReceived).toEqual({
      contents: source,
    });
  });

  it('passes through isProduction option when used as a call expression', function () {
    let source = 'hello';

    plugins = [
      [
        HTMLBarsInlinePrecompile,
        {
          precompile() {
            return precompile.apply(this, arguments);
          },

          ensureModuleApiPolyfill: false,
          isProduction: true,
          scope: null,
        },
      ],
    ];

    transform(`import hbs from 'htmlbars-inline-precompile';\nvar compiled = hbs('${source}');`);

    expect(optionsReceived).toEqual({
      contents: source,
      isProduction: true,
    });
  });

  it('uses the user provided isProduction option if present', function () {
    let source = 'hello';

    plugins = [
      [
        HTMLBarsInlinePrecompile,
        {
          precompile() {
            return precompile.apply(this, arguments);
          },

          isProduction: false,
        },
      ],
    ];

    transform(
      `import hbs from 'htmlbars-inline-precompile';\nvar compiled = hbs('${source}', { isProduction: true });`
    );

    expect(optionsReceived).toEqual({
      contents: source,
      isProduction: true,
    });
  });

  it('passes through isProduction option when used as a TaggedTemplateExpression', function () {
    let source = 'hello';

    plugins = [
      [
        HTMLBarsInlinePrecompile,
        {
          precompile() {
            return precompile.apply(this, arguments);
          },

          ensureModuleApiPolyfill: false,
          isProduction: true,
        },
      ],
    ];

    transform(`import hbs from 'htmlbars-inline-precompile';\nvar compiled = hbs\`${source}\`;`);

    expect(optionsReceived).toEqual({
      contents: source,
      isProduction: true,
      scope: null,
      strictMode: false,
    });
  });

  it('allows a template string literal when used as a call expression', function () {
    let source = 'hello';
    transform(`import hbs from 'htmlbars-inline-precompile';\nvar compiled = hbs(\`${source}\`);`);

    expect(optionsReceived).toEqual({
      contents: source,
    });
  });

  it('errors when the template string contains placeholders', function () {
    expect(() =>
      transform(
        "import hbs from 'htmlbars-inline-precompile';\nvar compiled = hbs(`string ${value}`)"
      )
    ).toThrow(/placeholders inside a template string are not supported/);
  });

  it('errors when the template string is tagged', function () {
    expect(() =>
      transform("import hbs from 'htmlbars-inline-precompile';\nvar compiled = hbs(hbs`string`)")
    ).toThrow(/tagged template strings inside hbs are not supported/);
  });

  it('allows static userland options when used as a call expression', function () {
    let source = 'hello';
    transform(
      `import hbs from 'htmlbars-inline-precompile';\nvar compiled = hbs('${source}', { parseOptions: { srcName: 'bar.hbs' }, moduleName: 'foo/bar.hbs', xyz: 123, qux: true, stringifiedThing: ${JSON.stringify(
        { foo: 'baz' }
      )}});`
    );

    expect(optionsReceived).toEqual({
      contents: source,
      parseOptions: { srcName: 'bar.hbs' },
      moduleName: 'foo/bar.hbs',
      xyz: 123,
      qux: true,
      stringifiedThing: {
        foo: 'baz',
      },
    });
  });

  it('adds a comment with the original template string', function () {
    let transformed = transform(stripIndent`
      import hbs from 'htmlbars-inline-precompile';
      if ('foo') {
        const template = hbs\`hello\`;
      }
    `);

    expect(transformed).toEqual(stripIndent`
      import { createTemplateFactory as _createTemplateFactory } from "@ember/template-factory";

      if ('foo') {
        const template = _createTemplateFactory(
        /*
          hello
        */
        "precompiled(hello)");
      }
    `);
  });

  it('avoids a build time error when passed `insertRuntimeErrors`', function () {
    precompile = () => {
      throw new Error('NOOOOOOOOOOOOOOOOOOOOOO');
    };

    let transformed = transform(
      `import hbs from 'htmlbars-inline-precompile';\nvar compiled = hbs('hello', { insertRuntimeErrors: true });`
    );

    expect(transformed).toMatchInlineSnapshot(`
      "import { createTemplateFactory as _createTemplateFactory } from \\"@ember/template-factory\\";

      var compiled = function () {
        throw new Error(\\"NOOOOOOOOOOOOOOOOOOOOOO\\");
      }();"
    `);
  });

  it('escapes any */ included in the template string', function () {
    let transformed = transform(stripIndent`
      import hbs from 'htmlbars-inline-precompile';
      if ('foo') {
        const template = hbs\`hello */\`;
      }
    `);

    expect(transformed).toEqual(stripIndent`
      import { createTemplateFactory as _createTemplateFactory } from "@ember/template-factory";

      if ('foo') {
        const template = _createTemplateFactory(
        /*
          hello *\\/
        */
        "precompiled(hello */)");
      }
    `);
  });

  it('passes options when used as a tagged template string', function () {
    let source = 'hello';
    transform(`import hbs from 'htmlbars-inline-precompile';\nvar compiled = hbs\`${source}\`;`);

    expect(optionsReceived).toEqual({
      contents: source,
      isProduction: undefined,
      scope: null,
      strictMode: false,
    });
  });

  it("strips import statement for 'htmlbars-inline-precompile' module", function () {
    let transformed = transform(
      "import hbs from 'htmlbars-inline-precompile';\nimport Ember from 'ember';"
    );

    expect(transformed).toEqual("import Ember from 'ember';", 'strips import statement');
  });

  it('replaces tagged template expressions with precompiled version', function () {
    let transformed = transform(
      "import hbs from 'htmlbars-inline-precompile';\nvar compiled = hbs`hello`;"
    );

    expect(transformed).toMatchInlineSnapshot(`
      "import { createTemplateFactory as _createTemplateFactory } from \\"@ember/template-factory\\";

      var compiled = _createTemplateFactory(
      /*
        hello
      */
      \\"precompiled(hello)\\");"
    `);
  });

  it('replaces tagged template expressions with precompiled version for custom import paths with named exports', function () {
    plugins[0][1].modules = {
      'foo-bar': 'baz',
    };

    let transformed = transform("import { baz } from 'foo-bar';\nvar compiled = baz`hello`;");

    expect(transformed).toMatchInlineSnapshot(`
      "import { createTemplateFactory as _createTemplateFactory } from \\"@ember/template-factory\\";

      var compiled = _createTemplateFactory(
      /*
        hello
      */
      \\"precompiled(hello)\\");"
    `);
  });

  it('replaces tagged template expressions with precompiled version for custom import paths', function () {
    plugins[0][1].modulePaths = ['ember-cli-htmlbars-inline-precompile'];

    let transformed = transform(
      "import hbs from 'ember-cli-htmlbars-inline-precompile';\nvar compiled = hbs`hello`;"
    );

    expect(transformed).toMatchInlineSnapshot(`
      "import { createTemplateFactory as _createTemplateFactory } from \\"@ember/template-factory\\";

      var compiled = _createTemplateFactory(
      /*
        hello
      */
      \\"precompiled(hello)\\");"
    `);
  });

  it('does not cause an error when no import is found', function () {
    expect(() => transform('something("whatever")')).not.toThrow();
    expect(() => transform('something`whatever`')).not.toThrow();
  });

  it('works with multiple imports', function () {
    let transformed = transform(`
      import hbs from 'htmlbars-inline-precompile';
      import otherHbs from 'htmlbars-inline-precompile';
      let a = hbs\`hello\`;
      let b = otherHbs\`hello\`;
    `);

    expect(transformed).toMatchInlineSnapshot(`
      "import { createTemplateFactory as _createTemplateFactory } from \\"@ember/template-factory\\";

      let a = _createTemplateFactory(
      /*
        hello
      */
      \\"precompiled(hello)\\");

      let b = _createTemplateFactory(
      /*
        hello
      */
      \\"precompiled(hello)\\");"
    `);
  });

  it('does not fully remove imports that have other imports', function () {
    plugins[0][1].modules = {
      precompile1: 'default',
      precompile2: 'hbs',
      precompile3: 'hbs',
    };

    let transformed = transform(`
      import hbs, { foo } from 'precompile1';
      import { hbs as otherHbs, bar } from 'precompile2';
      import baz, { hbs as otherOtherHbs } from 'precompile3';
      let a = hbs\`hello\`;
      let b = otherHbs\`hello\`;
      let c = otherOtherHbs\`hello\`;
    `);

    expect(transformed).toMatchInlineSnapshot(`
      "import { createTemplateFactory as _createTemplateFactory } from \\"@ember/template-factory\\";
      import { foo } from 'precompile1';
      import { bar } from 'precompile2';
      import baz from 'precompile3';

      let a = _createTemplateFactory(
      /*
        hello
      */
      \\"precompiled(hello)\\");

      let b = _createTemplateFactory(
      /*
        hello
      */
      \\"precompiled(hello)\\");

      let c = _createTemplateFactory(
      /*
        hello
      */
      \\"precompiled(hello)\\");"
    `);
  });

  it('works with multiple imports from different modules', function () {
    plugins = [
      [
        HTMLBarsInlinePrecompile,
        {
          precompile() {
            return precompile.apply(this, arguments);
          },

          ensureModuleApiPolyfill: false,

          modules: {
            'ember-cli-htmlbars': 'hbs',
            '@ember/template-compilation': {
              export: 'precompileTemplate',
            },
          },
        },
      ],
    ];

    let transformed = transform(`
      import { hbs } from 'ember-cli-htmlbars';
      import { precompileTemplate } from '@ember/template-compilation';
      let a = hbs\`hello\`;
      let b = precompileTemplate('hello');
    `);

    expect(transformed).toMatchInlineSnapshot(`
      "import { createTemplateFactory as _createTemplateFactory } from \\"@ember/template-factory\\";

      let a = _createTemplateFactory(
      /*
        hello
      */
      \\"precompiled(hello)\\");

      let b = _createTemplateFactory(
      /*
        hello
      */
      \\"precompiled(hello)\\");"
    `);
  });

  it('can disable template literal usage', function () {
    plugins = [
      [
        HTMLBarsInlinePrecompile,
        {
          precompile() {
            return precompile.apply(this, arguments);
          },

          ensureModuleApiPolyfill: false,

          modules: {
            '@ember/template-compilation': {
              export: 'precompileTemplate',
              disableTemplateLiteral: true,
            },
          },
        },
      ],
    ];

    expect(() => {
      transform(`
        import { precompileTemplate } from '@ember/template-compilation';
        let a = precompileTemplate\`hello\`;
      `);
    }).toThrow(
      /Attempted to use `precompileTemplate` as a template tag, but it can only be called as a function with a string passed to it:/
    );
  });

  it('can disable function call usage', function () {
    plugins = [
      [
        HTMLBarsInlinePrecompile,
        {
          precompile() {
            return precompile.apply(this, arguments);
          },

          ensureModuleApiPolyfill: false,

          modules: {
            'ember-template-imports': {
              export: 'hbs',
              disableFunctionCall: true,
            },
          },
        },
      ],
    ];

    expect(() => {
      transform(`
        import { hbs } from 'ember-template-imports';
        let a = hbs(\`hello\`);
      `);
    }).toThrow(
      /Attempted to use `hbs` as a function call, but it can only be used as a template tag:/
    );
  });

  it('works properly when used along with modules transform', function () {
    plugins.push([TransformModules]);
    let transformed = transform(
      "import hbs from 'htmlbars-inline-precompile';\nvar compiled = hbs`hello`;"
    );

    expect(transformed).toMatchInlineSnapshot(`
      "define([\\"@ember/template-factory\\"], function (_templateFactory) {
        \\"use strict\\";

        var compiled = (0, _templateFactory.createTemplateFactory)(
        /*
          hello
        */
        \\"precompiled(hello)\\");
      });"
    `);
  });

  it('works properly when used along with modules transform multiple times', function () {
    plugins.push([TransformModules]);
    let transformed = transform(
      "import hbs from 'htmlbars-inline-precompile';\nvar compiled = hbs`hello`;\nvar otherCompiled = hbs`hello`;"
    );

    expect(transformed).toMatchInlineSnapshot(`
      "define([\\"@ember/template-factory\\"], function (_templateFactory) {
        \\"use strict\\";

        var compiled = (0, _templateFactory.createTemplateFactory)(
        /*
          hello
        */
        \\"precompiled(hello)\\");
        var otherCompiled = (0, _templateFactory.createTemplateFactory)(
        /*
          hello
        */
        \\"precompiled(hello)\\");
      });"
    `);
  });

  it('works properly when used after modules transform', function () {
    plugins.unshift([TransformModules]);
    let transformed = transform(
      "import hbs from 'htmlbars-inline-precompile';\nvar compiled = hbs`hello`;"
    );

    expect(transformed).toMatchInlineSnapshot(`
      "define([\\"@ember/template-factory\\"], function (_templateFactory) {
        \\"use strict\\";

        var compiled = (0, _templateFactory.createTemplateFactory)(
        /*
          hello
        */
        \\"precompiled(hello)\\");
      });"
    `);
  });

  it('works properly when used along with @babel/plugin-transform-unicode-escapes', function () {
    plugins.push([TransformUnicodeEscapes]);
    let transformed = transform(
      "import hbs from 'htmlbars-inline-precompile';\nvar compiled = hbs('some emoji goes 💥');"
    );

    expect(transformed).toMatchInlineSnapshot(`
      "import { createTemplateFactory as _createTemplateFactory } from \\"@ember/template-factory\\";

      var compiled = _createTemplateFactory(
      /*
        some emoji goes 💥
      */
      \\"precompiled(some emoji goes 💥)\\");"
    `);
  });

  it('replaces tagged template expressions when before babel-plugin-transform-es2015-template-literals', function () {
    plugins.push([TransformTemplateLiterals]);
    let transformed = transform(
      "import hbs from 'htmlbars-inline-precompile';\nvar compiled = hbs`hello`;"
    );

    expect(transformed).toMatchInlineSnapshot(`
      "import { createTemplateFactory as _createTemplateFactory } from \\"@ember/template-factory\\";

      var compiled = _createTemplateFactory(
      /*
        hello
      */
      \\"precompiled(hello)\\");"
    `);
  });

  it("doesn't replace unrelated tagged template strings", function () {
    let transformed = transform(
      'import hbs from "htmlbars-inline-precompile";\nvar compiled = anotherTag`hello`;'
    );

    expect(transformed).toEqual(
      'var compiled = anotherTag`hello`;',
      'other tagged template strings are not touched'
    );
  });

  it('warns when the tagged template string contains placeholders', function () {
    expect(() =>
      transform(
        "import hbs from 'htmlbars-inline-precompile';\nvar compiled = hbs`string ${value}`"
      )
    ).toThrow(/placeholders inside a tagged template string are not supported/);
  });

  it('works with glimmer modules', function () {
    plugins[0][1].moduleOverrides = {
      '@ember/component/template-only': {
        default: ['templateOnlyComponent', '@glimmer/core'],
      },
      '@ember/template-factory': {
        createTemplateFactory: ['createTemplateFactory', '@glimmer/core'],
      },
      '@ember/component': {
        setComponentTemplate: ['setComponentTemplate', '@glimmer/core'],
      },
    };

    let transformed = transform(stripIndent`
      import hbs from 'htmlbars-inline-precompile';

      const template = hbs\`hello\`;
    `);

    expect(transformed).toEqual(stripIndent`
      import { createTemplateFactory as _createTemplateFactory } from "@glimmer/core";

      const template = _createTemplateFactory(
      /*
        hello
      */
      "precompiled(hello)");
    `);
  });

  describe('caching', function () {
    it('include `baseDir` function for caching', function () {
      expect(HTMLBarsInlinePrecompile.baseDir()).toEqual(path.resolve(__dirname, '..'));
    });
  });

  describe('single string argument', function () {
    it("works with a plain string as parameter hbs('string')", function () {
      let transformed = transform(
        "import hbs from 'htmlbars-inline-precompile';\nvar compiled = hbs('hello');"
      );

      expect(transformed).toMatchInlineSnapshot(`
        "import { createTemplateFactory as _createTemplateFactory } from \\"@ember/template-factory\\";

        var compiled = _createTemplateFactory(
        /*
          hello
        */
        \\"precompiled(hello)\\");"
      `);
    });

    it('warns when the second argument is not an object', function () {
      expect(() =>
        transform(
          "import hbs from 'htmlbars-inline-precompile';\nvar compiled = hbs('first', 'second');"
        )
      ).toThrow(
        /hbs can only be invoked with 2 arguments: the template string, and any static options/
      );
    });

    it('warns when argument is not a string', function () {
      expect(() =>
        transform("import hbs from 'htmlbars-inline-precompile';\nvar compiled = hbs(123);")
      ).toThrow(/hbs should be invoked with at least a single argument: the template string/);
    });

    it('warns when no argument is passed', function () {
      expect(() =>
        transform("import hbs from 'htmlbars-inline-precompile';\nvar compiled = hbs();")
      ).toThrow(/hbs should be invoked with at least a single argument: the template string/);
    });

    it('works with babel-plugin-ember-modules-api-polyfill', function () {
      plugins.push('babel-plugin-ember-modules-api-polyfill');

      precompile = (template) => {
        return `function() { return "${template}"; }`;
      };

      let transpiled = transform(
        "import hbs from 'htmlbars-inline-precompile';\nvar compiled = hbs`hello`;"
      );

      expect(transpiled).toMatchInlineSnapshot(`
        "var compiled = Ember.HTMLBars.template(
        /*
          hello
        */
        function () {
          return \\"hello\\";
        });"
      `);
    });

    it('works with ensureModuleApiPolyfill', function () {
      plugins[0][1].ensureModuleApiPolyfill = true;

      precompile = (template) => {
        return `function() { return "${template}"; }`;
      };

      let transpiled = transform(
        "import hbs from 'htmlbars-inline-precompile';\nvar compiled = hbs`hello`;"
      );

      expect(transpiled).toMatchInlineSnapshot(`
        "var compiled = Ember.HTMLBars.template(
        /*
          hello
        */
        function () {
          return \\"hello\\";
        });"
      `);
    });
  });

  describe('with ember-source', function () {
    const compiler = require('ember-source/dist/ember-template-compiler');

    beforeEach(function () {
      precompile = (template, options) => {
        return compiler.precompile(template, options);
      };
    });

    it('includes the original template content', function () {
      let transformed = transform(stripIndent`
        import hbs from 'htmlbars-inline-precompile';

        const template = hbs\`hello {{firstName}}\`;
      `);

      expect(transformed).toContain(`hello {{firstName}}`);
    });
  });

  describe('with transformScope: true', function () {
    beforeEach(() => {
      plugins = [
        [
          HTMLBarsInlinePrecompile,
          {
            precompile() {
              return precompile.apply(this, arguments);
            },

            ensureModuleApiPolyfill: false,

            modules: {
              '@ember/template-compilation': {
                export: 'precompileTemplate',
                shouldParseScope: true,
              },
            },
          },
        ],
      ];
    });

    it('correctly handles scope', function () {
      let source = 'hello';
      transform(
        `import { precompileTemplate } from '@ember/template-compilation';\nvar compiled = precompileTemplate('${source}', { scope: { foo, bar } });`
      );

      expect(optionsReceived).toEqual({
        contents: source,
        locals: ['foo', 'bar'],
      });
    });

    it('errors if scope contains mismatched keys/values', function () {
      expect(() => {
        transform(
          "import { precompileTemplate } from '@ember/template-compilation';\nvar compiled = precompileTemplate('hello', { scope: { foo: bar } });"
        );
      }).toThrow(
        /Scope objects for `precompileTemplate` may only contain direct references to in-scope values, e.g. { foo } or { foo: foo }/
      );
    });

    it('errors if scope is not an object', function () {
      expect(() => {
        transform(
          "import { precompileTemplate } from '@ember/template-compilation';\nvar compiled = precompileTemplate('hello', { scope: ['foo', 'bar'] });"
        );
      }).toThrow(
        /Scope objects for `precompileTemplate` must be an object expression containing only references to in-scope values/
      );
    });

    it('errors if scope contains any non-reference values', function () {
      expect(() => {
        transform(
          "import { precompileTemplate } from '@ember/template-compilation';\nvar compiled = precompileTemplate('hello', { scope: { foo, bar: 123 } });"
        );
      }).toThrow(
        /Scope objects for `precompileTemplate` may only contain direct references to in-scope values, e.g. { bar } or { bar: bar }/
      );
    });
  });
});
