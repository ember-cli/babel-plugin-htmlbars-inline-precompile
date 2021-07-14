import path from 'path';
import * as babel from '@babel/core';
import HTMLBarsInlinePrecompile, { Options } from '..';
import TransformTemplateLiterals from '@babel/plugin-transform-template-literals';
import TransformModules from '@babel/plugin-transform-modules-amd';
import TransformUnicodeEscapes from '@babel/plugin-transform-unicode-escapes';
import { stripIndent } from 'common-tags';

describe('htmlbars-inline-precompile', function () {
  let precompile: NonNullable<Options['precompile']>;
  let plugins: any[];
  let optionsReceived: any;
  let buildOptions: (o?: Partial<Options>) => Options;

  function transform(code: string) {
    let x = babel
      .transform(code, {
        filename: 'foo-bar.js',
        plugins,
      })!
      .code!.trim();
    return x;
  }

  beforeEach(function () {
    optionsReceived = undefined;
    precompile = (template, options) => {
      optionsReceived = options;
      return `"precompiled(${template})"`;
    };

    buildOptions = function (o?: Partial<Options>): Options {
      let defaultOptions: Options = {
        precompile(...args: Parameters<typeof precompile>) {
          return precompile(...args);
        },
      };

      return Object.assign({}, defaultOptions, o);
    };

    plugins = [[HTMLBarsInlinePrecompile, buildOptions()]];
  });

  it('supports compilation that returns a non-JSON.parseable object', function () {
    precompile = (template) => {
      return `function() { return "${template}"; }`;
    };

    let transpiled = transform(
      "import { precompileTemplate } from '@ember/template-compilation';\nvar compiled = precompileTemplate('hello');"
    );

    expect(transpiled).toMatchInlineSnapshot(`
      "import { createTemplateFactory } from \\"@ember/template-factory\\";
      var compiled = createTemplateFactory(
      /*
        hello
      */
      function () {
        return \\"hello\\";
      });"
    `);
  });

  it('supports compilation with templateCompilerPath', function () {
    plugins = [
      [
        HTMLBarsInlinePrecompile,
        buildOptions({ precompilerPath: require.resolve('./mock-precompile') }),
      ],
    ];

    let transpiled = transform(
      "import { precompileTemplate } from '@ember/template-compilation';\nvar compiled = precompileTemplate('hello');"
    );

    expect(transpiled).toMatchInlineSnapshot(`
      "import { createTemplateFactory } from \\"@ember/template-factory\\";
      var compiled = createTemplateFactory(
      /*
        hello
      */
      precompiledFromPath(hello));"
    `);
  });

  it('passes options when used as a call expression', function () {
    let source = 'hello';
    transform(
      `import { precompileTemplate } from '@ember/template-compilation';\nvar compiled = precompileTemplate('${source}');`
    );

    expect(optionsReceived).toEqual({
      contents: source,
    });
  });

  it('uses the user provided isProduction option if present', function () {
    let source = 'hello';

    transform(
      `import { precompileTemplate } from '@ember/template-compilation';\nvar compiled = precompileTemplate('${source}', { isProduction: true });`
    );

    expect(optionsReceived).toEqual({
      contents: source,
      isProduction: true,
    });
  });

  it('allows a template string literal when used as a call expression', function () {
    let source = 'hello';
    transform(
      `import { precompileTemplate } from '@ember/template-compilation';\nvar compiled = precompileTemplate(\`${source}\`);`
    );

    expect(optionsReceived).toEqual({
      contents: source,
    });
  });

  it('errors when the template string contains placeholders', function () {
    expect(() =>
      transform(
        "import { precompileTemplate } from '@ember/template-compilation';\nvar compiled = precompileTemplate(`string ${value}`)"
      )
    ).toThrow(/placeholders inside a template string are not supported/);
  });

  it('errors when the template string is tagged', function () {
    plugins = [
      [
        HTMLBarsInlinePrecompile,
        buildOptions({
          enableLegacyModules: ['htmlbars-inline-precompile'],
        }),
      ],
    ];
    expect(() =>
      transform("import hbs from 'htmlbars-inline-precompile';\nvar compiled = hbs(hbs`string`)")
    ).toThrow(/tagged template strings inside hbs are not supported/);
  });

  it('allows static userland options when used as a call expression', function () {
    let source = 'hello';
    transform(
      `import { precompileTemplate } from '@ember/template-compilation';\nvar compiled = precompileTemplate('${source}', { parseOptions: { srcName: 'bar.hbs' }, moduleName: 'foo/bar.hbs', xyz: 123, qux: true, stringifiedThing: ${JSON.stringify(
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
      import { precompileTemplate } from '@ember/template-compilation';
      if ('foo') {
        const template = precompileTemplate('hello');
      }
    `);

    expect(transformed).toEqual(stripIndent`
      import { createTemplateFactory } from "@ember/template-factory";

      if ('foo') {
        const template = createTemplateFactory(
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
      `import { precompileTemplate } from '@ember/template-compilation';\nvar compiled = precompileTemplate('hello', { insertRuntimeErrors: true });`
    );

    expect(transformed).toMatchInlineSnapshot(`
      "var compiled = function () {
        throw new Error(\\"NOOOOOOOOOOOOOOOOOOOOOO\\");
      }();"
    `);
  });

  it('escapes any */ included in the template string', function () {
    plugins = [
      [
        HTMLBarsInlinePrecompile,
        buildOptions({
          enableLegacyModules: ['htmlbars-inline-precompile'],
        }),
      ],
    ];

    let transformed = transform(stripIndent`
      import hbs from 'htmlbars-inline-precompile';
      if ('foo') {
        const template = hbs\`hello */\`;
      }
    `);

    expect(transformed).toEqual(stripIndent`
      import { createTemplateFactory } from "@ember/template-factory";

      if ('foo') {
        const template = createTemplateFactory(
        /*
          hello *\\/
        */
        "precompiled(hello */)");
      }
    `);
  });

  it('passes options when used as a tagged template string', function () {
    plugins = [
      [
        HTMLBarsInlinePrecompile,
        buildOptions({
          enableLegacyModules: ['htmlbars-inline-precompile'],
        }),
      ],
    ];

    let source = 'hello';
    transform(`import hbs from 'htmlbars-inline-precompile';\nvar compiled = hbs\`${source}\`;`);

    expect(optionsReceived).toEqual({
      contents: source,
    });
  });

  it("strips import statement for '@ember/template-precompilation' module", function () {
    let transformed = transform(
      "import { precompileTemplate } from '@ember/template-compilation';\nimport Ember from 'ember';"
    );

    // strips import statement
    expect(transformed).toEqual("import Ember from 'ember';");
  });

  it('replaces tagged template expressions with precompiled version', function () {
    plugins = [
      [
        HTMLBarsInlinePrecompile,
        buildOptions({
          enableLegacyModules: ['htmlbars-inline-precompile'],
        }),
      ],
    ];
    let transformed = transform(
      "import hbs from 'htmlbars-inline-precompile';\nvar compiled = hbs`hello`;"
    );

    expect(transformed).toMatchInlineSnapshot(`
      "import { createTemplateFactory } from \\"@ember/template-factory\\";
      var compiled = createTemplateFactory(
      /*
        hello
      */
      \\"precompiled(hello)\\");"
    `);
  });

  it('replaces tagged template expressions with precompiled version when ember-cli-htmlbars is enabled', function () {
    plugins = [
      [
        HTMLBarsInlinePrecompile,
        buildOptions({
          enableLegacyModules: ['ember-cli-htmlbars'],
        }),
      ],
    ];

    let transformed = transform(
      "import { hbs as baz } from 'ember-cli-htmlbars';\nvar compiled = baz`hello`;"
    );

    expect(transformed).toMatchInlineSnapshot(`
      "import { createTemplateFactory } from \\"@ember/template-factory\\";
      var compiled = createTemplateFactory(
      /*
        hello
      */
      \\"precompiled(hello)\\");"
    `);
  });

  it('leaves tagged template expressions alone when ember-cli-htmlbars is disabled', function () {
    let transformed = transform(
      "import { hbs as baz } from 'ember-cli-htmlbars';\nvar compiled = baz`hello`;"
    );

    expect(transformed).toMatchInlineSnapshot(`
      "import { hbs as baz } from 'ember-cli-htmlbars';
      var compiled = baz\`hello\`;"
    `);
  });

  it('does not cause an error when no import is found', function () {
    expect(() => transform('something("whatever")')).not.toThrow();
    expect(() => transform('something`whatever`')).not.toThrow();
  });

  it('works with multiple imports', function () {
    let transformed = transform(`
      import { precompileTemplate } from '@ember/template-compilation';
      import { precompileTemplate as other } from '@ember/template-compilation';
      let a = precompileTemplate('hello');
      let b = other('hello');
    `);

    expect(transformed).toMatchInlineSnapshot(`
      "import { createTemplateFactory } from \\"@ember/template-factory\\";
      let a = createTemplateFactory(
      /*
        hello
      */
      \\"precompiled(hello)\\");
      let b = createTemplateFactory(
      /*
        hello
      */
      \\"precompiled(hello)\\");"
    `);
  });

  it('does not fully remove imports that have other imports', function () {
    let transformed = transform(`
      import { precompileTemplate, compileTemplate } from '@ember/template-compilation';
    `);

    expect(transformed).toMatchInlineSnapshot(
      `"import { compileTemplate } from '@ember/template-compilation';"`
    );
  });

  it('forbids template literal usage of @ember/template-compilation', function () {
    expect(() => {
      transform(`
        import { precompileTemplate } from '@ember/template-compilation';
        let a = precompileTemplate\`hello\`;
      `);
    }).toThrow(
      /Attempted to use `precompileTemplate` as a template tag, but it can only be called as a function with a string passed to it:/
    );
  });

  it('works properly when used along with modules transform', function () {
    plugins.push([TransformModules]);
    let transformed = transform(
      "import { precompileTemplate } from '@ember/template-compilation';\n" +
        "var compiled1 = precompileTemplate('hello');\n" +
        "var compiled2 = precompileTemplate('goodbye');\n"
    );

    expect(transformed).toMatchInlineSnapshot(`
      "define([\\"@ember/template-factory\\"], function (_templateFactory) {
        \\"use strict\\";

        var compiled1 = (0, _templateFactory.createTemplateFactory)(
        /*
          hello
        */
        \\"precompiled(hello)\\");
        var compiled2 = (0, _templateFactory.createTemplateFactory)(
        /*
          goodbye
        */
        \\"precompiled(goodbye)\\");
      });"
    `);
  });

  it('does not error when reusing a preexisting import', function () {
    let transformed = transform(`
      import { createTemplateFactory } from '@ember/template-factory';
      import { precompileTemplate } from '@ember/template-compilation';
      precompileTemplate('hello');
      createTemplateFactory('whatever here');
    `);

    expect(transformed).toMatchInlineSnapshot(`
      "import { createTemplateFactory } from '@ember/template-factory';
      createTemplateFactory(
      /*
        hello
      */
      \\"precompiled(hello)\\");
      createTemplateFactory('whatever here');"
    `);
  });

  it('works properly when used after modules transform', function () {
    plugins.unshift([TransformModules]);
    let transformed = transform(
      "import { precompileTemplate } from '@ember/template-compilation';\nvar compiled = precompileTemplate('hello');"
    );

    expect(transformed).toMatchInlineSnapshot(`
      "define([\\"@ember/template-factory\\", \\"@ember/template-compilation\\"], function (_templateFactory, _templateCompilation) {
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
      "import { precompileTemplate } from '@ember/template-compilation';\nvar compiled = precompileTemplate('some emoji goes 💥');"
    );

    expect(transformed).toMatchInlineSnapshot(`
      "import { createTemplateFactory } from \\"@ember/template-factory\\";
      var compiled = createTemplateFactory(
      /*
        some emoji goes 💥
      */
      \\"precompiled(some emoji goes 💥)\\");"
    `);
  });

  it('replaces tagged template expressions when before babel-plugin-transform-es2015-template-literals', function () {
    plugins = [
      [
        HTMLBarsInlinePrecompile,
        buildOptions({
          enableLegacyModules: ['htmlbars-inline-precompile'],
        }),
      ],
      TransformTemplateLiterals,
    ];

    let transformed = transform(
      "import hbs from 'htmlbars-inline-precompile';\nvar compiled = hbs`hello`;"
    );

    expect(transformed).toMatchInlineSnapshot(`
      "import { createTemplateFactory } from \\"@ember/template-factory\\";
      var compiled = createTemplateFactory(
      /*
        hello
      */
      \\"precompiled(hello)\\");"
    `);
  });

  it("doesn't replace unrelated tagged template strings", function () {
    plugins = [
      [
        HTMLBarsInlinePrecompile,
        buildOptions({
          enableLegacyModules: ['htmlbars-inline-precompile'],
        }),
      ],
    ];
    let transformed = transform(
      'import hbs from "htmlbars-inline-precompile";\nvar compiled = anotherTag`hello`;'
    );

    // other tagged template strings are not touched
    expect(transformed).toEqual('var compiled = anotherTag`hello`;');
  });

  it('throws when the tagged template string contains placeholders', function () {
    plugins = [
      [
        HTMLBarsInlinePrecompile,
        buildOptions({
          enableLegacyModules: ['htmlbars-inline-precompile'],
        }),
      ],
    ];
    expect(() =>
      transform(
        "import hbs from 'htmlbars-inline-precompile';\nvar compiled = hbs`string ${value}`"
      )
    ).toThrow(/placeholders inside a tagged template string are not supported/);
  });

  it('works with glimmer modules', function () {
    plugins = [
      [
        HTMLBarsInlinePrecompile,
        buildOptions({
          outputModuleOverrides: {
            '@ember/template-factory': {
              createTemplateFactory: ['createTemplateFactory', '@glimmer/core'],
            },
          },
        }),
      ],
    ];

    let transformed = transform(stripIndent`
      import { precompileTemplate } from '@ember/template-compilation';
      const template = precompileTemplate('hello');
    `);

    expect(transformed).toEqual(stripIndent`
      import { createTemplateFactory } from "@glimmer/core";
      const template = createTemplateFactory(
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

  it('throws when the second argument is not an object', function () {
    expect(() =>
      transform(
        "import { precompileTemplate } from '@ember/template-compilation';\nvar compiled = precompileTemplate('first', 'second');"
      )
    ).toThrow(
      /precompileTemplate can only be invoked with 2 arguments: the template string, and any static options/
    );
  });

  it('throws when argument is not a string', function () {
    expect(() =>
      transform(
        "import { precompileTemplate } from '@ember/template-compilation';\nvar compiled = precompileTemplate(123);"
      )
    ).toThrow(
      /precompileTemplate should be invoked with at least a single argument \(the template string\)/
    );
  });

  it('throws when no argument is passed', function () {
    expect(() =>
      transform(
        "import { precompileTemplate } from '@ember/template-compilation';\nvar compiled = precompileTemplate();"
      )
    ).toThrow(
      /precompileTemplate should be invoked with at least a single argument \(the template string\)/
    );
  });

  describe('with ember-source', function () {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const compiler = require('ember-source/dist/ember-template-compiler');

    beforeEach(function () {
      precompile = (template, options) => {
        return compiler.precompile(template, options);
      };
    });

    it('includes the original template content', function () {
      let transformed = transform(stripIndent`
        import { precompileTemplate } from '@ember/template-compilation';

        const template = precompileTemplate('hello {{firstName}}');
      `);

      expect(transformed).toContain(`hello {{firstName}}`);
    });
  });

  describe('scope', function () {
    it('correctly handles scope function (non-block arrow function)', function () {
      let source = 'hello';
      transform(
        `import { precompileTemplate } from '@ember/template-compilation';\nvar compiled = precompileTemplate('${source}', { scope: () => ({ foo, bar }) });`
      );
      expect(optionsReceived).toEqual({
        contents: source,
        locals: ['foo', 'bar'],
      });
    });

    it('correctly handles scope function (block arrow function)', function () {
      let source = 'hello';
      transform(
        `import { precompileTemplate } from '@ember/template-compilation';\nvar compiled = precompileTemplate('${source}', { scope: () => { return { foo, bar }; }});`
      );
      expect(optionsReceived).toEqual({
        contents: source,
        locals: ['foo', 'bar'],
      });
    });

    it('correctly handles scope function (normal function)', function () {
      let source = 'hello';
      transform(
        `import { precompileTemplate } from '@ember/template-compilation';\nvar compiled = precompileTemplate('${source}', { scope: function() { return { foo, bar }; }});`
      );
      expect(optionsReceived).toEqual({
        contents: source,
        locals: ['foo', 'bar'],
      });
    });

    it('correctly handles scope function (object method)', function () {
      let source = 'hello';
      transform(
        `import { precompileTemplate } from '@ember/template-compilation';\nvar compiled = precompileTemplate('${source}', { scope() { return { foo, bar }; }});`
      );
      expect(optionsReceived).toEqual({
        contents: source,
        locals: ['foo', 'bar'],
      });
    });

    it('errors if scope contains mismatched keys/values', function () {
      expect(() => {
        transform(
          "import { precompileTemplate } from '@ember/template-compilation';\nvar compiled = precompileTemplate('hello', { scope: () => ({ foo: bar }) });"
        );
      }).toThrow(
        /Scope objects for `precompileTemplate` may only contain direct references to in-scope values, e.g. { foo } or { foo: foo }/
      );
    });

    it('errors if scope is not an object', function () {
      expect(() => {
        transform(
          "import { precompileTemplate } from '@ember/template-compilation';\nvar compiled = precompileTemplate('hello', { scope: () => ['foo', 'bar'] });"
        );
      }).toThrow(
        /Scope objects for `precompileTemplate` must be an object expression containing only references to in-scope values/
      );
    });

    it('errors if scope contains any non-reference values', function () {
      expect(() => {
        transform(
          "import { precompileTemplate } from '@ember/template-compilation';\nvar compiled = precompileTemplate('hello', { scope: () => ({ foo, bar: 123 }) });"
        );
      }).toThrow(
        /Scope objects for `precompileTemplate` may only contain direct references to in-scope values, e.g. { bar } or { bar: bar }/
      );
    });
  });
});
