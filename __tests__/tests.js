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
      "var compiled = Ember.HTMLBars.template(
      /*
        hello
      */
      function () {
        return \\"hello\\";
      });"
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

          isProduction: true,
        },
      ],
    ];

    transform(`import hbs from 'htmlbars-inline-precompile';\nvar compiled = hbs\`${source}\`;`);

    expect(optionsReceived).toEqual({
      contents: source,
      isProduction: true,
      scope: null,
      strict: false,
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
      if ('foo') {
        const template = Ember.HTMLBars.template(
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
      "var compiled = function () {
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
      if ('foo') {
        const template = Ember.HTMLBars.template(
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
      strict: false,
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

    expect(transformed).toEqual(
      'var compiled = Ember.HTMLBars.template(\n/*\n  hello\n*/\n"precompiled(hello)");',
      'tagged template is replaced'
    );
  });

  it('replaces tagged template expressions with precompiled version for custom import paths with named exports', function () {
    plugins[0][1].modules = {
      'foo-bar': 'baz',
    };

    let transformed = transform("import { baz } from 'foo-bar';\nvar compiled = baz`hello`;");

    expect(transformed).toEqual(
      'var compiled = Ember.HTMLBars.template(\n/*\n  hello\n*/\n"precompiled(hello)");'
    );
  });

  it('replaces tagged template expressions with precompiled version for custom import paths', function () {
    plugins[0][1].modulePaths = ['ember-cli-htmlbars-inline-precompile'];

    let transformed = transform(
      "import hbs from 'ember-cli-htmlbars-inline-precompile';\nvar compiled = hbs`hello`;"
    );

    expect(transformed).toEqual(
      'var compiled = Ember.HTMLBars.template(\n/*\n  hello\n*/\n"precompiled(hello)");'
    );
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

    let expected = `let a = Ember.HTMLBars.template(\n/*\n  hello\n*/\n"precompiled(hello)");\nlet b = Ember.HTMLBars.template(\n/*\n  hello\n*/\n"precompiled(hello)");`;

    expect(transformed).toEqual(expected, 'tagged template is replaced');
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
      "import { foo } from 'precompile1';
      import { bar } from 'precompile2';
      import baz from 'precompile3';
      let a = Ember.HTMLBars.template(
      /*
        hello
      */
      \\"precompiled(hello)\\");
      let b = Ember.HTMLBars.template(
      /*
        hello
      */
      \\"precompiled(hello)\\");
      let c = Ember.HTMLBars.template(
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

    let expected = `let a = Ember.HTMLBars.template(\n/*\n  hello\n*/\n"precompiled(hello)");\nlet b = Ember.HTMLBars.template(\n/*\n  hello\n*/\n"precompiled(hello)");`;

    expect(transformed).toEqual(expected, 'tagged template is replaced');
  });

  it('can disable template literal usage', function () {
    plugins = [
      [
        HTMLBarsInlinePrecompile,
        {
          precompile() {
            return precompile.apply(this, arguments);
          },

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

    expect(transformed).toEqual(
      `define([], function () {\n  "use strict";\n\n  var compiled = Ember.HTMLBars.template(\n  /*\n    hello\n  */\n  "precompiled(hello)");\n});`,
      'tagged template is replaced'
    );
  });

  it('works properly when used after modules transform', function () {
    plugins.unshift([TransformModules]);
    let transformed = transform(
      "import hbs from 'htmlbars-inline-precompile';\nvar compiled = hbs`hello`;"
    );

    expect(transformed).toEqual(
      `define([], function () {\n  "use strict";\n\n  var compiled = Ember.HTMLBars.template(\n  /*\n    hello\n  */\n  "precompiled(hello)");\n});`,
      'tagged template is replaced'
    );
  });

  it('works properly when used along with @babel/plugin-transform-unicode-escapes', function () {
    plugins.push([TransformUnicodeEscapes]);
    let transformed = transform(
      "import hbs from 'htmlbars-inline-precompile';\nvar compiled = hbs('some emoji goes 💥');"
    );

    expect(transformed).toMatchInlineSnapshot(`
      "var compiled = Ember.HTMLBars.template(
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

    expect(transformed).toEqual(
      'var compiled = Ember.HTMLBars.template(\n/*\n  hello\n*/\n"precompiled(hello)");',
      'tagged template is replaced'
    );
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

      expect(transformed).toEqual(
        'var compiled = Ember.HTMLBars.template(\n/*\n  hello\n*/\n"precompiled(hello)");',
        'tagged template is replaced'
      );
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

  describe('with Ember imports', function () {
    it('adds an Ember import if useEmberModule is set to true', function () {
      plugins = [
        [
          HTMLBarsInlinePrecompile,
          {
            precompile() {
              return precompile.apply(this, arguments);
            },

            useEmberModule: true,
          },
        ],
      ];

      let transpiled = transform(
        "import hbs from 'htmlbars-inline-precompile';\nvar compiled = hbs`hello`;"
      );

      expect(transpiled).toMatchInlineSnapshot(`
        "import _ember from \\"ember\\";

        var compiled = _ember.HTMLBars.template(
        /*
          hello
        */
        \\"precompiled(hello)\\");"
      `);
    });

    it('Uses existing Ember import if one exists', function () {
      plugins = [
        [
          HTMLBarsInlinePrecompile,
          {
            precompile() {
              return precompile.apply(this, arguments);
            },

            useEmberModule: true,
          },
        ],
      ];

      let transpiled = transform(
        "import Foo from 'ember';\nimport hbs from 'htmlbars-inline-precompile';\nvar compiled = hbs`hello`;"
      );

      expect(transpiled).toMatchInlineSnapshot(`
        "import Foo from 'ember';
        var compiled = Foo.HTMLBars.template(
        /*
          hello
        */
        \\"precompiled(hello)\\");"
      `);
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
        scope: ['foo', 'bar'],
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

  describe('with useTemplateLiteralProposalSemantics', function () {
    beforeEach(() => {
      plugins = [
        [
          HTMLBarsInlinePrecompile,
          {
            precompile() {
              return precompile.apply(this, arguments);
            },

            modules: {
              'ember-template-imports': {
                export: 'hbs',
                useTemplateLiteralProposalSemantics: 1,
              },
            },
          },
        ],
        '@babel/plugin-proposal-class-properties',
      ];
    });

    it('works with templates assigned to variables', function () {
      let transpiled = transform(
        `
          import { hbs } from 'ember-template-imports';

          const Foo = hbs\`hello\`;
        `
      );

      expect(transpiled).toMatchInlineSnapshot(`
        "import { templateOnly as _templateOnly } from \\"@ember/component/template-only\\";
        import { setComponentTemplate as _setComponentTemplate } from \\"@ember/component\\";

        const Foo = _templateOnly(\\"foo-bar\\", \\"Foo\\");

        _setComponentTemplate(Ember.HTMLBars.template(
        /*
          hello
        */
        \\"precompiled(hello)\\"), Foo);"
      `);
    });

    it('works with templates exported as the default', function () {
      let transpiled = transform(
        `
          import { hbs } from 'ember-template-imports';

          export default hbs\`hello\`;
        `
      );

      expect(transpiled).toMatchInlineSnapshot(`
        "import { setComponentTemplate as _setComponentTemplate } from \\"@ember/component\\";
        import { templateOnly as _templateOnly } from \\"@ember/component/template-only\\";

        const _fooBar = _templateOnly(\\"foo-bar\\", \\"_fooBar\\");

        _setComponentTemplate(Ember.HTMLBars.template(
        /*
          hello
        */
        \\"precompiled(hello)\\"), _fooBar);

        export default _fooBar;"
      `);
    });

    it('works with templates assigned to classes', function () {
      let transpiled = transform(
        `
          import { hbs } from 'ember-template-imports';

          class Foo {
            static template = hbs\`hello\`;
          }
        `
      );

      expect(transpiled).toMatchInlineSnapshot(`
        "import { setComponentTemplate as _setComponentTemplate } from \\"@ember/component\\";

        class Foo {}

        _setComponentTemplate(Ember.HTMLBars.template(
        /*
          hello
        */
        \\"precompiled(hello)\\"), Foo);"
      `);
    });

    it('works with templates assigned to class expressions', function () {
      let transpiled = transform(
        `
          import { hbs } from 'ember-template-imports';

          const Foo = class {
            static template = hbs\`hello\`;
          }
        `
      );

      expect(transpiled).toMatchInlineSnapshot(`
        "import { setComponentTemplate as _setComponentTemplate } from \\"@ember/component\\";

        const Foo = _setComponentTemplate(Ember.HTMLBars.template(
        /*
          hello
        */
        \\"precompiled(hello)\\"), class {});"
      `);
    });

    it('correctly handles scope', function () {
      let source = 'hello';
      transform(
        `
          import { hbs } from 'ember-template-imports';
          import baz from 'qux';

          let foo = 123;
          const bar = 456;

          export default hbs\`${source}\`;
        `
      );

      expect(optionsReceived).toEqual({
        contents: source,
        isProduction: undefined,
        scope: ['baz', 'foo', 'bar'],
        strict: true,
      });
    });

    it('errors if used in an incorrect positions', function () {
      expect(() => {
        transform("import { hbs } from 'ember-template-imports';\nhbs`hello`;");
      }).toThrow(
        /Attempted to use `hbs` to define a template in an unsupported way. Templates defined using this helper must be:/
      );

      expect(() => {
        transform("import { hbs } from 'ember-template-imports';\nfunc(hbs`hello`);");
      }).toThrow(
        /Attempted to use `hbs` to define a template in an unsupported way. Templates defined using this helper must be:/
      );
    });

    it('errors if passed incorrect useTemplateLiteralProposalSemantics version', function () {
      plugins[0][1].modules['ember-template-imports'].useTemplateLiteralProposalSemantics = true;

      expect(() => {
        transform(
          `
            import { hbs } from 'ember-template-imports';

            const Foo = hbs\`hello\`;
          `
        );
      }).toThrow(
        /Passed an invalid version for useTemplateLiteralProposalSemantics. This option must be assign a version number. The current valid version numbers are: 1/
      );
    });
  });

  describe('with useTemplateTagProposalSemantics', function () {
    beforeEach(() => {
      plugins = [
        [
          HTMLBarsInlinePrecompile,
          {
            precompile() {
              return precompile.apply(this, arguments);
            },

            modules: {
              'ember-template-imports': {
                export: 'GLIMMER_TEMPLATE',
                debugName: '<template>',
                useTemplateTagProposalSemantics: 1,
              },
            },
          },
        ],
        '@babel/plugin-proposal-class-properties',
      ];
    });

    it('works with templates assigned to variables', function () {
      let transpiled = transform(
        `
          const Foo = [GLIMMER_TEMPLATE(\`hello\`)];
        `
      );

      expect(transpiled).toMatchInlineSnapshot(`
        "import { templateOnly as _templateOnly } from \\"@ember/component/template-only\\";
        import { setComponentTemplate as _setComponentTemplate } from \\"@ember/component\\";

        const Foo = _templateOnly(\\"foo-bar\\", \\"Foo\\");

        _setComponentTemplate(Ember.HTMLBars.template(
        /*
          hello
        */
        \\"precompiled(hello)\\"), Foo);"
      `);
    });

    it('works with templates exported as variables', function () {
      let transpiled = transform(
        `
          export const Foo = [GLIMMER_TEMPLATE(\`hello\`)];
        `
      );

      expect(transpiled).toMatchInlineSnapshot(`
        "import { templateOnly as _templateOnly } from \\"@ember/component/template-only\\";
        import { setComponentTemplate as _setComponentTemplate } from \\"@ember/component\\";
        export const Foo = _templateOnly(\\"foo-bar\\", \\"Foo\\");

        _setComponentTemplate(Ember.HTMLBars.template(
        /*
          hello
        */
        \\"precompiled(hello)\\"), Foo);"
      `);
    });

    it('works with templates exported as the default', function () {
      let transpiled = transform(
        `
          export default [GLIMMER_TEMPLATE(\`hello\`)];
        `
      );

      expect(transpiled).toMatchInlineSnapshot(`
        "import { setComponentTemplate as _setComponentTemplate } from \\"@ember/component\\";
        import { templateOnly as _templateOnly } from \\"@ember/component/template-only\\";

        const _fooBar = _templateOnly(\\"foo-bar\\", \\"_fooBar\\");

        _setComponentTemplate(Ember.HTMLBars.template(
        /*
          hello
        */
        \\"precompiled(hello)\\"), _fooBar);

        export default _fooBar;"
      `);
    });

    it('works with templates defined at the top level', function () {
      let transpiled = transform(
        `
          [GLIMMER_TEMPLATE(\`hello\`)];
        `
      );

      expect(transpiled).toMatchInlineSnapshot(`
        "import { setComponentTemplate as _setComponentTemplate } from \\"@ember/component\\";
        import { templateOnly as _templateOnly } from \\"@ember/component/template-only\\";

        const _fooBar = _templateOnly(\\"foo-bar\\", \\"_fooBar\\");

        _setComponentTemplate(Ember.HTMLBars.template(
        /*
          hello
        */
        \\"precompiled(hello)\\"), _fooBar);

        export default _fooBar;"
      `);
    });

    it('works with templates assigned to classes', function () {
      let transpiled = transform(
        `
          class Foo {
            [GLIMMER_TEMPLATE(\`hello\`)];
          }
        `
      );

      expect(transpiled).toMatchInlineSnapshot(`
        "import { setComponentTemplate as _setComponentTemplate } from \\"@ember/component\\";

        class Foo {}

        _setComponentTemplate(Ember.HTMLBars.template(
        /*
          hello
        */
        \\"precompiled(hello)\\"), Foo);"
      `);
    });

    it('works with templates assigned to class expressions', function () {
      let transpiled = transform(
        `
          const Foo = class {
            [GLIMMER_TEMPLATE(\`hello\`)];
          }
        `
      );

      expect(transpiled).toMatchInlineSnapshot(`
        "import { setComponentTemplate as _setComponentTemplate } from \\"@ember/component\\";

        const Foo = _setComponentTemplate(Ember.HTMLBars.template(
        /*
          hello
        */
        \\"precompiled(hello)\\"), class {});"
      `);
    });

    it('correctly handles scope', function () {
      let source = 'hello';
      transform(
        `
          import baz from 'qux';

          let foo = 123;
          const bar = 456;

          export default [GLIMMER_TEMPLATE(\`${source}\`)];
        `
      );

      expect(optionsReceived).toEqual({
        contents: source,
        isProduction: undefined,
        scope: ['baz', 'foo', 'bar'],
        strict: true,
      });
    });

    it('errors if used in an incorrect positions', function () {
      expect(() => {
        transform("func([GLIMMER_TEMPLATE('hello')]);");
      }).toThrow(
        /Attempted to use `<template>` to define a template in an unsupported way. Templates defined using this syntax must be:/
      );
    });

    it('errors if used with template literal syntax', function () {
      plugins[0][1].modules['ember-template-imports'].useTemplateLiteralProposalSemantics = 1;

      expect(() => {
        transform("func([GLIMMER_TEMPLATE('hello')]);");
      }).toThrow(/Cannot use both the template literal and template tag syntax proposals together/);
    });

    it('errors if passed incorrect useTemplateTagProposalSemantics version', function () {
      plugins[0][1].modules['ember-template-imports'].useTemplateTagProposalSemantics = true;

      expect(() => {
        transform(
          `
            const Foo = [GLIMMER_TEMPLATE(\`hello\`)];
          `
        );
      }).toThrow(
        /Passed an invalid version for useTemplateTagProposalSemantics. This option must be assign a version number. The current valid version numbers are: 1/
      );
    });
  });
});
