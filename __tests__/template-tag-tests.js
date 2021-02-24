'use strict';

const babel = require('@babel/core');
const HTMLBarsInlinePrecompile = require('../index');
const TransformModules = require('@babel/plugin-transform-modules-amd');

describe('htmlbars-inline-precompile: useTemplateTagProposalSemantics', function () {
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

          modules: {
            'TEMPLATE-TAG-MODULE': {
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
      "import _emberComponentTemplateOnly from \\"@ember/component/template-only\\";
      import { setComponentTemplate as _setComponentTemplate } from \\"@ember/component\\";
      import { createTemplateFactory as _createTemplateFactory } from \\"@ember/template-factory\\";

      const Foo = _emberComponentTemplateOnly(\\"foo-bar\\", \\"Foo\\");

      _setComponentTemplate(_createTemplateFactory(
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
      "import _emberComponentTemplateOnly from \\"@ember/component/template-only\\";
      import { setComponentTemplate as _setComponentTemplate } from \\"@ember/component\\";
      import { createTemplateFactory as _createTemplateFactory } from \\"@ember/template-factory\\";
      export const Foo = _emberComponentTemplateOnly(\\"foo-bar\\", \\"Foo\\");

      _setComponentTemplate(_createTemplateFactory(
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
      import _emberComponentTemplateOnly from \\"@ember/component/template-only\\";
      import { createTemplateFactory as _createTemplateFactory } from \\"@ember/template-factory\\";

      const _fooBar = _emberComponentTemplateOnly(\\"foo-bar\\", \\"_fooBar\\");

      _setComponentTemplate(_createTemplateFactory(
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
      import _emberComponentTemplateOnly from \\"@ember/component/template-only\\";
      import { createTemplateFactory as _createTemplateFactory } from \\"@ember/template-factory\\";

      const _fooBar = _emberComponentTemplateOnly(\\"foo-bar\\", \\"_fooBar\\");

      _setComponentTemplate(_createTemplateFactory(
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
      import { createTemplateFactory as _createTemplateFactory } from \\"@ember/template-factory\\";

      class Foo {}

      _setComponentTemplate(_createTemplateFactory(
      /*
        hello
      */
      \\"precompiled(hello)\\"), Foo);"
    `);
  });

  it('works with templates assigned to export classes', function () {
    let transpiled = transform(
      `
        export class Foo {
          [GLIMMER_TEMPLATE(\`hello\`)];
        }
      `
    );

    expect(transpiled).toMatchInlineSnapshot(`
      "import { setComponentTemplate as _setComponentTemplate } from \\"@ember/component\\";
      import { createTemplateFactory as _createTemplateFactory } from \\"@ember/template-factory\\";
      export class Foo {}

      _setComponentTemplate(_createTemplateFactory(
      /*
        hello
      */
      \\"precompiled(hello)\\"), Foo);"
    `);
  });

  it('works with templates assigned to export default classes', function () {
    let transpiled = transform(
      `
        export default class Foo {
          [GLIMMER_TEMPLATE(\`hello\`)];
        }
      `
    );

    expect(transpiled).toMatchInlineSnapshot(`
      "import { setComponentTemplate as _setComponentTemplate } from \\"@ember/component\\";
      import { createTemplateFactory as _createTemplateFactory } from \\"@ember/template-factory\\";
      export default class Foo {}

      _setComponentTemplate(_createTemplateFactory(
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
      import { createTemplateFactory as _createTemplateFactory } from \\"@ember/template-factory\\";

      const Foo = _setComponentTemplate(_createTemplateFactory(
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
      strictMode: true,
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
    plugins[0][1].modules['TEMPLATE-TAG-MODULE'].useTemplateLiteralProposalSemantics = 1;

    expect(() => {
      transform("func([GLIMMER_TEMPLATE('hello')]);");
    }).toThrow(/Cannot use both the template literal and template tag syntax proposals together/);
  });

  it('errors if passed incorrect useTemplateTagProposalSemantics version', function () {
    plugins[0][1].modules['TEMPLATE-TAG-MODULE'].useTemplateTagProposalSemantics = true;

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

  it('works alongside useTemplateLiteralProposalSemantics', function () {
    plugins[0][1].modules['ember-template-imports'] = {
      export: 'hbs',
      useTemplateLiteralProposalSemantics: 1,
    };

    let transpiled = transform(
      `
        import { hbs } from 'ember-template-imports';

        const Foo = [GLIMMER_TEMPLATE(\`hello\`)];
        const Bar = hbs\`hello\`;
      `
    );

    expect(transpiled).toMatchInlineSnapshot(`
      "import _emberComponentTemplateOnly from \\"@ember/component/template-only\\";
      import { setComponentTemplate as _setComponentTemplate } from \\"@ember/component\\";
      import { createTemplateFactory as _createTemplateFactory } from \\"@ember/template-factory\\";

      const Foo = _emberComponentTemplateOnly(\\"foo-bar\\", \\"Foo\\");

      _setComponentTemplate(_createTemplateFactory(
      /*
        hello
      */
      \\"precompiled(hello)\\"), Foo);

      const Bar = _emberComponentTemplateOnly(\\"foo-bar\\", \\"Bar\\");

      _setComponentTemplate(_createTemplateFactory(
      /*
        hello
      */
      \\"precompiled(hello)\\"), Bar);"
    `);
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

    let transpiled = transform(
      `
        const Foo = [GLIMMER_TEMPLATE(\`hello\`)];
      `
    );

    expect(transpiled).toMatchInlineSnapshot(`
      "import { templateOnlyComponent as _templateOnlyComponent } from \\"@glimmer/core\\";
      import { setComponentTemplate as _setComponentTemplate } from \\"@glimmer/core\\";
      import { createTemplateFactory as _createTemplateFactory } from \\"@glimmer/core\\";

      const Foo = _templateOnlyComponent(\\"foo-bar\\", \\"Foo\\");

      _setComponentTemplate(_createTemplateFactory(
      /*
        hello
      */
      \\"precompiled(hello)\\"), Foo);"
    `);
  });

  describe('with babel-plugin-ember-modules-api-polyfill', function () {
    beforeEach(() => {
      plugins.push('babel-plugin-ember-modules-api-polyfill');
    });

    it('works with templates assigned to variables', function () {
      let transpiled = transform(
        `
          const Foo = [GLIMMER_TEMPLATE(\`hello\`)];
        `
      );

      expect(transpiled).toMatchInlineSnapshot(`
        "const Foo = Ember._templateOnlyComponent(\\"foo-bar\\", \\"Foo\\");

        Ember._setComponentTemplate(Ember.HTMLBars.template(
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
        "export const Foo = Ember._templateOnlyComponent(\\"foo-bar\\", \\"Foo\\");

        Ember._setComponentTemplate(Ember.HTMLBars.template(
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
        "const _fooBar = Ember._templateOnlyComponent(\\"foo-bar\\", \\"_fooBar\\");

        Ember._setComponentTemplate(Ember.HTMLBars.template(
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
        "const _fooBar = Ember._templateOnlyComponent(\\"foo-bar\\", \\"_fooBar\\");

        Ember._setComponentTemplate(Ember.HTMLBars.template(
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
        "class Foo {}

        Ember._setComponentTemplate(Ember.HTMLBars.template(
        /*
          hello
        */
        \\"precompiled(hello)\\"), Foo);"
      `);
    });

    it('works with templates assigned to export classes', function () {
      let transpiled = transform(
        `
          export class Foo {
            [GLIMMER_TEMPLATE(\`hello\`)];
          }
        `
      );

      expect(transpiled).toMatchInlineSnapshot(`
        "export class Foo {}

        Ember._setComponentTemplate(Ember.HTMLBars.template(
        /*
          hello
        */
        \\"precompiled(hello)\\"), Foo);"
      `);
    });

    it('works with templates assigned to export default classes', function () {
      let transpiled = transform(
        `
          export default class Foo {
            [GLIMMER_TEMPLATE(\`hello\`)];
          }
        `
      );

      expect(transpiled).toMatchInlineSnapshot(`
        "export default class Foo {}

        Ember._setComponentTemplate(Ember.HTMLBars.template(
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
        "const Foo = Ember._setComponentTemplate(Ember.HTMLBars.template(
        /*
          hello
        */
        \\"precompiled(hello)\\"), class {});"
      `);
    });

    it('works when used alongside modules transform', function () {
      plugins[0][1].ensureModuleApiPolyfill = true;
      plugins.push([TransformModules]);

      let transpiled = transform(
        `
          const Foo = [GLIMMER_TEMPLATE(\`hello\`)];
          const Bar = [GLIMMER_TEMPLATE(\`hello\`)];
        `
      );

      expect(transpiled).toMatchInlineSnapshot(`
        "define([], function () {
          \\"use strict\\";

          const Foo = Ember._templateOnlyComponent(\\"foo-bar\\", \\"Foo\\");

          Ember._setComponentTemplate(Ember.HTMLBars.template(
          /*
            hello
          */
          \\"precompiled(hello)\\"), Foo);

          const Bar = Ember._templateOnlyComponent(\\"foo-bar\\", \\"Bar\\");

          Ember._setComponentTemplate(Ember.HTMLBars.template(
          /*
            hello
          */
          \\"precompiled(hello)\\"), Bar);
        });"
      `);
    });
  });
});
