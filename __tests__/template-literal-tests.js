'use strict';

const babel = require('@babel/core');
const HTMLBarsInlinePrecompile = require('../index');
const TransformModules = require('@babel/plugin-transform-modules-amd');

describe('htmlbars-inline-precompile: useTemplateLiteralProposalSemantics', function () {
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

  it('works with templates exported as the default', function () {
    let transpiled = transform(
      `
        import { hbs } from 'ember-template-imports';

        export default hbs\`hello\`;
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
        import { hbs } from 'ember-template-imports';

        class Foo {
          static template = hbs\`hello\`;
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
      import { createTemplateFactory as _createTemplateFactory } from \\"@ember/template-factory\\";

      const Foo = _setComponentTemplate(_createTemplateFactory(
      /*
        hello
      */
      \\"precompiled(hello)\\"), class {});"
    `);
  });

  it('works with templates assigned to export classes', function () {
    let transpiled = transform(
      `
        import { hbs } from 'ember-template-imports';

        export class Foo {
          static template = hbs\`hello\`;
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
        import { hbs } from 'ember-template-imports';

        export default class Foo {
          static template = hbs\`hello\`;
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
      strictMode: true,
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
        import { hbs } from 'ember-template-imports';

        const Foo = hbs\`hello\`;
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
          import { hbs } from 'ember-template-imports';

          const Foo = hbs\`hello\`;
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

    it('works with templates exported as the default', function () {
      let transpiled = transform(
        `
          import { hbs } from 'ember-template-imports';

          export default hbs\`hello\`;
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
          import { hbs } from 'ember-template-imports';

          class Foo {
            static template = hbs\`hello\`;
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
          import { hbs } from 'ember-template-imports';

          export class Foo {
            static template = hbs\`hello\`;
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
          import { hbs } from 'ember-template-imports';

          export default class Foo {
            static template = hbs\`hello\`;
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
          import { hbs } from 'ember-template-imports';

          const Foo = class {
            static template = hbs\`hello\`;
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
          import { hbs } from 'ember-template-imports';

          const Foo = hbs\`hello\`;
          const Bar = hbs\`hello\`;
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
