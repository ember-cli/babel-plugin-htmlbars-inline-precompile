'use strict';

const babel = require('@babel/core');
const HTMLBarsInlinePrecompile = require('../index');
const TransformModules = require('@babel/plugin-transform-modules-amd');
const { join } = require('path');

const { preprocessEmbeddedTemplates } = HTMLBarsInlinePrecompile;

const TEMPLATE_TAG_CONFIG = {
  getTemplateLocalsRequirePath: require.resolve('@glimmer/syntax'),
  getTemplateLocalsExportPath: 'getTemplateLocals',

  templateTag: 'template',
  templateTagReplacement: 'GLIMMER_TEMPLATE',

  relativePath: '/foo/bar.gjs',
  includeSourceMaps: false,
  includeTemplateTokens: true,
};

const FILENAME = join(process.cwd(), 'foo-bar.js');

describe('htmlbars-inline-precompile: useTemplateTagProposalSemantics', function () {
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

      const Foo = _setComponentTemplate(_createTemplateFactory(
      /*
        hello
      */
      \\"precompiled(hello)\\"), _emberComponentTemplateOnly(\\"foo-bar\\", \\"Foo\\"));"
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
      export const Foo = _setComponentTemplate(_createTemplateFactory(
      /*
        hello
      */
      \\"precompiled(hello)\\"), _emberComponentTemplateOnly(\\"foo-bar\\", \\"Foo\\"));"
    `);
  });

  it('works with templates exported as the default', function () {
    let transpiled = transform(
      `
        export default [GLIMMER_TEMPLATE(\`hello\`)];
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

  it('works with templates defined at the top level', function () {
    let transpiled = transform(
      `
        [GLIMMER_TEMPLATE(\`hello\`)];
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
      locals: ['baz', 'foo', 'bar'],
      strictMode: true,
      meta: {
        moduleName: FILENAME,
      },
    });
  });

  it('works when passed directly to a function', function () {
    let transpiled = transform("func([GLIMMER_TEMPLATE('hello')]);");

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

      const Foo = _setComponentTemplate(_createTemplateFactory(
      /*
        hello
      */
      \\"precompiled(hello)\\"), _emberComponentTemplateOnly(\\"foo-bar\\", \\"Foo\\"));

      const Bar = _setComponentTemplate(_createTemplateFactory(
      /*
        hello
      */
      \\"precompiled(hello)\\"), _emberComponentTemplateOnly(\\"foo-bar\\", \\"Bar\\"));"
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
            const Foo = <template>hello</template>
          `,
          TEMPLATE_TAG_CONFIG
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

    it('works with templates exported as variables', function () {
      let transpiled = transform(
        preprocessEmbeddedTemplates(
          `
            export const Foo = <template>hello</template>
          `,
          TEMPLATE_TAG_CONFIG
        ).output
      );

      expect(transpiled).toMatchInlineSnapshot(`
        "import _emberComponentTemplateOnly from \\"@ember/component/template-only\\";
        import { setComponentTemplate as _setComponentTemplate } from \\"@ember/component\\";
        import { createTemplateFactory as _createTemplateFactory } from \\"@ember/template-factory\\";
        export const Foo = _setComponentTemplate(_createTemplateFactory(
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
            export default <template>hello</template>
          `,
          TEMPLATE_TAG_CONFIG
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

    it('works with templates defined at the top level', function () {
      let transpiled = transform(
        preprocessEmbeddedTemplates(
          `
            <template>hello</template>
          `,
          TEMPLATE_TAG_CONFIG
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
            class Foo {
              <template>hello</template>
            }
          `,
          TEMPLATE_TAG_CONFIG
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

    it('works with templates assigned to export classes', function () {
      let transpiled = transform(
        preprocessEmbeddedTemplates(
          `
            export class Foo {
              <template>hello</template>
            }
          `,
          TEMPLATE_TAG_CONFIG
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
            export default class Foo {
              <template>hello</template>
            }
          `,
          TEMPLATE_TAG_CONFIG
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

    it('works with templates assigned to class expressions', function () {
      let transpiled = transform(
        preprocessEmbeddedTemplates(
          `
            const Foo = class {
              <template>hello</template>
            }
          `,
          TEMPLATE_TAG_CONFIG
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

    it('correctly handles scope', function () {
      let source = '<div>{{foo}} {{bar}} <Baz/></div>';
      transform(
        preprocessEmbeddedTemplates(
          `
            import Baz from 'qux';

            let foo = 123;
            const bar = 456;

            <template>${source}</template>
          `,
          TEMPLATE_TAG_CONFIG
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

    it('works when passed directly to a function', function () {
      let transpiled = transform(
        preprocessEmbeddedTemplates('func(<template>hello</template>);', TEMPLATE_TAG_CONFIG).output
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
          const Foo = [GLIMMER_TEMPLATE(\`hello\`)];
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

    it('works with templates exported as variables', function () {
      let transpiled = transform(
        `
          export const Foo = [GLIMMER_TEMPLATE(\`hello\`)];
        `
      );

      expect(transpiled).toMatchInlineSnapshot(`
        "export const Foo = Ember._setComponentTemplate(Ember.HTMLBars.template(
        /*
          hello
        */
        \\"precompiled(hello)\\"), Ember._templateOnlyComponent(\\"foo-bar\\", \\"Foo\\"));"
      `);
    });

    it('works with templates exported as the default', function () {
      let transpiled = transform(
        `
          export default [GLIMMER_TEMPLATE(\`hello\`)];
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

    it('works with templates defined at the top level', function () {
      let transpiled = transform(
        `
          [GLIMMER_TEMPLATE(\`hello\`)];
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
