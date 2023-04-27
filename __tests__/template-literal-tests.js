'use strict';

const babel = require('@babel/core');
const HTMLBarsInlinePrecompile = require('../index');
const TransformModules = require('@babel/plugin-transform-modules-amd');
const { join } = require('path');

const { preprocessEmbeddedTemplates } = HTMLBarsInlinePrecompile;

const TEMPLATE_LITERAL_CONFIG = {
  getTemplateLocalsRequirePath: require.resolve('@glimmer/syntax'),
  getTemplateLocalsExportPath: 'getTemplateLocals',

  importIdentifier: 'hbs',
  importPath: 'ember-template-imports',

  relativePath: '/foo/bar.js',
  includeSourceMaps: false,
  includeTemplateTokens: true,
};

const FILENAME = join(process.cwd(), 'foo-bar.js');

describe('htmlbars-inline-precompile: useTemplateLiteralProposalSemantics', function () {
  let precompile, plugins, optionsReceived;

  function transform(code) {
    return babel
      .transform(code, {
        filename: FILENAME,
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

      const Foo = _setComponentTemplate(_createTemplateFactory(
      /*
        hello
      */
      \\"precompiled(hello)\\"), _emberComponentTemplateOnly(\\"foo-bar\\", \\"Foo\\"));"
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
      "import _emberComponentTemplateOnly from \\"@ember/component/template-only\\";
      import { setComponentTemplate as _setComponentTemplate } from \\"@ember/component\\";
      import { createTemplateFactory as _createTemplateFactory } from \\"@ember/template-factory\\";
      export default _setComponentTemplate(_createTemplateFactory(
      /*
        hello
      */
      \\"precompiled(hello)\\"), _emberComponentTemplateOnly(\\"foo-bar\\", \\"_fooBar\\"));"
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

  it('works with anonymous class declarations exported as the default', function () {
    let transpiled = transform(
      `
        import { hbs } from 'ember-template-imports';
        export default class {
          static template = hbs\`hello\`;
        }
      `
    );

    expect(transpiled).toMatchInlineSnapshot(`
      "import { setComponentTemplate as _setComponentTemplate } from \\"@ember/component\\";
      import { createTemplateFactory as _createTemplateFactory } from \\"@ember/template-factory\\";
      export default _setComponentTemplate(_createTemplateFactory(
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
      locals: ['baz', 'foo', 'bar'],
      strictMode: true,
      meta: {
        moduleName: FILENAME,
      },
    });
  });

  it('works if used in an arbitrary expression statement', function () {
    let transpiled = transform("import { hbs } from 'ember-template-imports';\nhbs`hello`;");

    expect(transpiled).toMatchInlineSnapshot(`
      "import _emberComponentTemplateOnly from \\"@ember/component/template-only\\";
      import { setComponentTemplate as _setComponentTemplate } from \\"@ember/component\\";
      import { createTemplateFactory as _createTemplateFactory } from \\"@ember/template-factory\\";

      _setComponentTemplate(_createTemplateFactory(
      /*
        hello
      */
      \\"precompiled(hello)\\"), _emberComponentTemplateOnly(\\"foo-bar\\", \\"_fooBar\\"));"
    `);
  });

  it('works when passed directly to a function', function () {
    let transpiled = transform("import { hbs } from 'ember-template-imports';\nfunc(hbs`hello`);");

    expect(transpiled).toMatchInlineSnapshot(`
      "import _emberComponentTemplateOnly from \\"@ember/component/template-only\\";
      import { setComponentTemplate as _setComponentTemplate } from \\"@ember/component\\";
      import { createTemplateFactory as _createTemplateFactory } from \\"@ember/template-factory\\";
      func(_setComponentTemplate(_createTemplateFactory(
      /*
        hello
      */
      \\"precompiled(hello)\\"), _emberComponentTemplateOnly(\\"foo-bar\\", \\"_fooBar\\")));"
    `);
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

      const Foo = _setComponentTemplate(_createTemplateFactory(
      /*
        hello
      */
      \\"precompiled(hello)\\"), _templateOnlyComponent(\\"foo-bar\\", \\"Foo\\"));"
    `);
  });

  describe('with preprocessing', function () {
    it('works with templates assigned to variables', function () {
      let transpiled = transform(
        preprocessEmbeddedTemplates(
          `
            import { hbs } from 'ember-template-imports';

            const Foo = hbs\`hello\`;
          `,
          TEMPLATE_LITERAL_CONFIG
        ).output
      );

      expect(transpiled).toMatchInlineSnapshot(`
        "import _emberComponentTemplateOnly from \\"@ember/component/template-only\\";
        import { setComponentTemplate as _setComponentTemplate } from \\"@ember/component\\";
        import { createTemplateFactory as _createTemplateFactory } from \\"@ember/template-factory\\";

        const Foo = _setComponentTemplate(_createTemplateFactory(
        /*
          hello
        */
        \\"precompiled(hello)\\"), _emberComponentTemplateOnly(\\"foo-bar\\", \\"Foo\\"));"
      `);
    });

    it('works with templates exported as the default', function () {
      let transpiled = transform(
        preprocessEmbeddedTemplates(
          `
            import { hbs } from 'ember-template-imports';

            export default hbs\`hello\`;
          `,
          TEMPLATE_LITERAL_CONFIG
        ).output
      );

      expect(transpiled).toMatchInlineSnapshot(`
        "import _emberComponentTemplateOnly from \\"@ember/component/template-only\\";
        import { setComponentTemplate as _setComponentTemplate } from \\"@ember/component\\";
        import { createTemplateFactory as _createTemplateFactory } from \\"@ember/template-factory\\";
        export default _setComponentTemplate(_createTemplateFactory(
        /*
          hello
        */
        \\"precompiled(hello)\\"), _emberComponentTemplateOnly(\\"foo-bar\\", \\"_fooBar\\"));"
      `);
    });

    it('works with templates assigned to classes', function () {
      let transpiled = transform(
        preprocessEmbeddedTemplates(
          `
            import { hbs } from 'ember-template-imports';

            class Foo {
              static template = hbs\`hello\`;
            }
          `,
          TEMPLATE_LITERAL_CONFIG
        ).output
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
        preprocessEmbeddedTemplates(
          `
            import { hbs } from 'ember-template-imports';

            const Foo = class {
              static template = hbs\`hello\`;
            }
          `,
          TEMPLATE_LITERAL_CONFIG
        ).output
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
        preprocessEmbeddedTemplates(
          `
            import { hbs } from 'ember-template-imports';

            export class Foo {
              static template = hbs\`hello\`;
            }
          `,
          TEMPLATE_LITERAL_CONFIG
        ).output
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
        preprocessEmbeddedTemplates(
          `
            import { hbs } from 'ember-template-imports';

            export default class Foo {
              static template = hbs\`hello\`;
            }
          `,
          TEMPLATE_LITERAL_CONFIG
        ).output
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
      let source = '<div>{{foo}} {{bar}} <Baz/></div>';
      transform(
        preprocessEmbeddedTemplates(
          `
            import { hbs } from 'ember-template-imports';
            import Baz from 'qux';

            let foo = 123;
            const bar = 456;

            export default hbs\`${source}\`;
          `,
          TEMPLATE_LITERAL_CONFIG
        ).output
      );

      expect(optionsReceived).toEqual({
        contents: source,
        isProduction: undefined,
        locals: ['Baz', 'foo', 'bar'],
        strictMode: true,
        meta: {
          moduleName: FILENAME,
        },
      });
    });

    it('works if used in an arbitrary expression statement', function () {
      let transpiled = transform(
        preprocessEmbeddedTemplates(
          "import { hbs } from 'ember-template-imports';\nhbs`hello`;",
          TEMPLATE_LITERAL_CONFIG
        ).output
      );

      expect(transpiled).toMatchInlineSnapshot(`
        "import _emberComponentTemplateOnly from \\"@ember/component/template-only\\";
        import { setComponentTemplate as _setComponentTemplate } from \\"@ember/component\\";
        import { createTemplateFactory as _createTemplateFactory } from \\"@ember/template-factory\\";

        _setComponentTemplate(_createTemplateFactory(
        /*
          hello
        */
        \\"precompiled(hello)\\"), _emberComponentTemplateOnly(\\"foo-bar\\", \\"_fooBar\\"));"
      `);
    });

    it('works when passed directly to a function', function () {
      let transpiled = transform(
        preprocessEmbeddedTemplates(
          "import { hbs } from 'ember-template-imports';\nfunc(hbs`hello`);",
          TEMPLATE_LITERAL_CONFIG
        ).output
      );

      expect(transpiled).toMatchInlineSnapshot(`
        "import _emberComponentTemplateOnly from \\"@ember/component/template-only\\";
        import { setComponentTemplate as _setComponentTemplate } from \\"@ember/component\\";
        import { createTemplateFactory as _createTemplateFactory } from \\"@ember/template-factory\\";
        func(_setComponentTemplate(_createTemplateFactory(
        /*
          hello
        */
        \\"precompiled(hello)\\"), _emberComponentTemplateOnly(\\"foo-bar\\", \\"_fooBar\\")));"
      `);
    });
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
        "const Foo = Ember._setComponentTemplate(Ember.HTMLBars.template(
        /*
          hello
        */
        \\"precompiled(hello)\\"), Ember._templateOnlyComponent(\\"foo-bar\\", \\"Foo\\"));"
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
        "export default Ember._setComponentTemplate(Ember.HTMLBars.template(
        /*
          hello
        */
        \\"precompiled(hello)\\"), Ember._templateOnlyComponent(\\"foo-bar\\", \\"_fooBar\\"));"
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

          const Foo = Ember._setComponentTemplate(Ember.HTMLBars.template(
          /*
            hello
          */
          \\"precompiled(hello)\\"), Ember._templateOnlyComponent(\\"foo-bar\\", \\"Foo\\"));

          const Bar = Ember._setComponentTemplate(Ember.HTMLBars.template(
          /*
            hello
          */
          \\"precompiled(hello)\\"), Ember._templateOnlyComponent(\\"foo-bar\\", \\"Bar\\"));
        });"
      `);
    });
  });
});
