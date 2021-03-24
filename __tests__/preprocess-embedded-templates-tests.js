const { preprocessEmbeddedTemplates } = require('../index');
const { stripIndent } = require('common-tags');

const getTemplateLocalsRequirePath = require.resolve('@glimmer/syntax');

const TEMPLATE_TAG_CONFIG = {
  getTemplateLocalsRequirePath,
  getTemplateLocalsExportPath: 'getTemplateLocals',

  templateTag: 'template',
  templateTagReplacement: 'GLIMMER_TEMPLATE',

  relativePath: '/foo/bar.gjs',
  includeSourceMaps: false,
  includeTemplateTokens: true,
};

const TEMPLATE_LITERAL_CONFIG = {
  getTemplateLocalsRequirePath,
  getTemplateLocalsExportPath: 'getTemplateLocals',

  importIdentifier: 'hbs',
  importPath: 'ember-template-imports',

  relativePath: '/foo/bar.js',
  includeSourceMaps: false,
  includeTemplateTokens: true,
};

describe('htmlbars-inline-precompile: preprocessEmbeddedTemplates', () => {
  describe('template tag', () => {
    it('works with basic templates', () => {
      let preprocessed = preprocessEmbeddedTemplates(
        stripIndent`
          <template>Hello, world!</template>
        `,
        TEMPLATE_TAG_CONFIG
      );

      expect(preprocessed).toMatchInlineSnapshot(`
        Object {
          "output": "[GLIMMER_TEMPLATE(\`Hello, world!\`)]",
          "replacements": Array [
            Object {
              "index": 0,
              "newLength": 19,
              "oldLength": 10,
              "originalCol": 1,
              "originalLine": 1,
              "type": "start",
            },
            Object {
              "index": 23,
              "newLength": 3,
              "oldLength": 11,
              "originalCol": 24,
              "originalLine": 1,
              "type": "end",
            },
          ],
        }
      `);
    });

    it('works with templates assigned to variables', () => {
      let preprocessed = preprocessEmbeddedTemplates(
        stripIndent`
          const Foo = <template>Hello, world!</template>
        `,
        TEMPLATE_TAG_CONFIG
      );

      expect(preprocessed).toMatchInlineSnapshot(`
        Object {
          "output": "const Foo = [GLIMMER_TEMPLATE(\`Hello, world!\`)]",
          "replacements": Array [
            Object {
              "index": 12,
              "newLength": 19,
              "oldLength": 10,
              "originalCol": 13,
              "originalLine": 1,
              "type": "start",
            },
            Object {
              "index": 35,
              "newLength": 3,
              "oldLength": 11,
              "originalCol": 36,
              "originalLine": 1,
              "type": "end",
            },
          ],
        }
      `);
    });

    it('works with nested templates', () => {
      let preprocessed = preprocessEmbeddedTemplates(
        stripIndent`
          <template>
            <template>Hello, world!</template>
          </template>
        `,
        TEMPLATE_TAG_CONFIG
      );

      expect(preprocessed).toMatchInlineSnapshot(`
        Object {
          "output": "[GLIMMER_TEMPLATE(\`
          <template>Hello, world!</template>
        \`)]",
          "replacements": Array [
            Object {
              "index": 0,
              "newLength": 19,
              "oldLength": 10,
              "originalCol": 1,
              "originalLine": 1,
              "type": "start",
            },
            Object {
              "index": 48,
              "newLength": 3,
              "oldLength": 11,
              "originalCol": 1,
              "originalLine": 3,
              "type": "end",
            },
          ],
        }
      `);
    });

    it('it does not process templates in strings', () => {
      let preprocessed = preprocessEmbeddedTemplates(
        stripIndent`
          const Foo = <template></template>
          const foo = "<template></template>";
          const Bar = <template></template>
          const bar = '<template></template>';
          const Baz = <template></template>
          const baz = \`
            <template>
              \${'<template></template>'}
              \${expr({ foo: '<template></template>' })}
              \${nested(\`
                <template></template>
              \`)}
            </template>
          \`;

          <template></template>
          const regex = /<template><\/template>/;
        `,
        TEMPLATE_TAG_CONFIG
      );

      expect(preprocessed).toMatchInlineSnapshot(`
        Object {
          "output": "const Foo = [GLIMMER_TEMPLATE(\`\`)]
        const foo = \\"<template></template>\\";
        const Bar = [GLIMMER_TEMPLATE(\`\`)]
        const bar = '<template></template>';
        const Baz = [GLIMMER_TEMPLATE(\`\`)]
        const baz = \`
          <template>
            \${'<template></template>'}
            \${expr({ foo: '<template></template>' })}
            \${nested(\`
              <template></template>
            \`)}
          </template>
        \`;

        [GLIMMER_TEMPLATE(\`\`)]
        const regex = /<template></template>/;",
          "replacements": Array [
            Object {
              "index": 12,
              "newLength": 19,
              "oldLength": 10,
              "originalCol": 13,
              "originalLine": 1,
              "type": "start",
            },
            Object {
              "index": 22,
              "newLength": 3,
              "oldLength": 11,
              "originalCol": 23,
              "originalLine": 1,
              "type": "end",
            },
            Object {
              "index": 83,
              "newLength": 19,
              "oldLength": 10,
              "originalCol": 13,
              "originalLine": 3,
              "type": "start",
            },
            Object {
              "index": 93,
              "newLength": 3,
              "oldLength": 11,
              "originalCol": 23,
              "originalLine": 3,
              "type": "end",
            },
            Object {
              "index": 154,
              "newLength": 19,
              "oldLength": 10,
              "originalCol": 13,
              "originalLine": 5,
              "type": "start",
            },
            Object {
              "index": 164,
              "newLength": 3,
              "oldLength": 11,
              "originalCol": 23,
              "originalLine": 5,
              "type": "end",
            },
            Object {
              "index": 349,
              "newLength": 19,
              "oldLength": 10,
              "originalCol": 1,
              "originalLine": 16,
              "type": "start",
            },
            Object {
              "index": 359,
              "newLength": 3,
              "oldLength": 11,
              "originalCol": 11,
              "originalLine": 16,
              "type": "end",
            },
          ],
        }
      `);
    });

    it('it does not process templates or tokens in comments', () => {
      let preprocessed = preprocessEmbeddedTemplates(
        stripIndent`
          // <template></template>
          /* <template></template> */
          /*
            <template></template>
            other tokens
            \`"'/
          */

          <template></template>
        `,
        TEMPLATE_TAG_CONFIG
      );

      expect(preprocessed).toMatchInlineSnapshot(`
        Object {
          "output": "// <template></template>
        /* <template></template> */
        /*
          <template></template>
          other tokens
          \`\\"'/
        */

        [GLIMMER_TEMPLATE(\`\`)]",
          "replacements": Array [
            Object {
              "index": 106,
              "newLength": 19,
              "oldLength": 10,
              "originalCol": 1,
              "originalLine": 9,
              "type": "start",
            },
            Object {
              "index": 116,
              "newLength": 3,
              "oldLength": 11,
              "originalCol": 11,
              "originalLine": 9,
              "type": "end",
            },
          ],
        }
      `);
    });

    it('works with class templates', () => {
      let preprocessed = preprocessEmbeddedTemplates(
        stripIndent`
          class Foo {
            <template>Hello, world!</template>
          }
        `,
        TEMPLATE_TAG_CONFIG
      );

      expect(preprocessed).toMatchInlineSnapshot(`
        Object {
          "output": "class Foo {
          [GLIMMER_TEMPLATE(\`Hello, world!\`)]
        }",
          "replacements": Array [
            Object {
              "index": 14,
              "newLength": 19,
              "oldLength": 10,
              "originalCol": 3,
              "originalLine": 2,
              "type": "start",
            },
            Object {
              "index": 37,
              "newLength": 3,
              "oldLength": 11,
              "originalCol": 26,
              "originalLine": 2,
              "type": "end",
            },
          ],
        }
      `);
    });

    it('works with basic multi-line aoeu templates', () => {
      let preprocessed = preprocessEmbeddedTemplates(
        stripIndent`
          class Foo {
            <template>
              Hello, world!
            </template>
          }
        `,
        TEMPLATE_TAG_CONFIG
      );

      expect(preprocessed).toMatchInlineSnapshot(`
        Object {
          "output": "class Foo {
          [GLIMMER_TEMPLATE(\`
            Hello, world!
          \`)]
        }",
          "replacements": Array [
            Object {
              "index": 14,
              "newLength": 19,
              "oldLength": 10,
              "originalCol": 3,
              "originalLine": 2,
              "type": "start",
            },
            Object {
              "index": 45,
              "newLength": 3,
              "oldLength": 11,
              "originalCol": 3,
              "originalLine": 4,
              "type": "end",
            },
          ],
        }
      `);
    });

    it('exposes template identifiers', () => {
      let preprocessed = preprocessEmbeddedTemplates(
        stripIndent`
          class Foo {
            <template>
              <Component/>

              <ComponentWithYield>
                <:main></:main>
              </ComponentWithYield>

              {{#if globalValue}}
                {{globalHelper 123}}
              {{/if}}

              {{#if this.localValue}}
                {{this.localHelper 123}}
              {{/if}}

              {{@arg}}
              <@argComponent />

              {{#this.dynamicBlockComponent}}
              {{/this.dynamicBlockComponent}}

              <this.dynamicAngleComponent>
              </this.dynamicAngleComponent>
            </template>
          }
        `,
        TEMPLATE_TAG_CONFIG
      );

      expect(preprocessed).toMatchInlineSnapshot(`
        Object {
          "output": "class Foo {
          [GLIMMER_TEMPLATE(\`
            <Component/>

            <ComponentWithYield>
              <:main></:main>
            </ComponentWithYield>

            {{#if globalValue}}
              {{globalHelper 123}}
            {{/if}}

            {{#if this.localValue}}
              {{this.localHelper 123}}
            {{/if}}

            {{@arg}}
            <@argComponent />

            {{#this.dynamicBlockComponent}}
            {{/this.dynamicBlockComponent}}

            <this.dynamicAngleComponent>
            </this.dynamicAngleComponent>
          \`, { scope() { return {Component,ComponentWithYield,globalValue,globalHelper}; } })]
        }",
          "replacements": Array [
            Object {
              "index": 14,
              "newLength": 19,
              "oldLength": 10,
              "originalCol": 3,
              "originalLine": 2,
              "type": "start",
            },
            Object {
              "index": 431,
              "newLength": 84,
              "oldLength": 11,
              "originalCol": 3,
              "originalLine": 25,
              "type": "end",
            },
          ],
        }
      `);
    });

    it('throws if template args are detected', () => {
      expect(() => {
        preprocessEmbeddedTemplates(
          stripIndent`
            class Foo {
              <template @foo="bar">
                Hello, world!
              </template>
            }
          `,
          TEMPLATE_TAG_CONFIG
        );
      }).toThrow(/embedded template preprocessing currently does not support passing arguments/);
    });

    it('can include sourcemaps', () => {
      let preprocessed = preprocessEmbeddedTemplates(
        stripIndent`
          class Foo {
            <template>Hello, world!</template>
          }
        `,
        Object.assign({}, TEMPLATE_TAG_CONFIG, { includeSourceMaps: true })
      );

      expect(preprocessed).toMatchInlineSnapshot(`
        Object {
          "output": "class Foo {
          [GLIMMER_TEMPLATE(\`Hello, world!\`)]
        }
        //# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFyLmpzIiwic291cmNlcyI6WyJiYXIuZ2pzIl0sInNvdXJjZXNDb250ZW50IjpbImNsYXNzIEZvbyB7XG4gIDx0ZW1wbGF0ZT5IZWxsbywgd29ybGQhPC90ZW1wbGF0ZT5cbn0iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ1gsQ0FBQyxDQUFDLG1CQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBVztBQUNwQyJ9",
          "replacements": Array [
            Object {
              "index": 14,
              "newLength": 19,
              "oldLength": 10,
              "originalCol": 3,
              "originalLine": 2,
              "type": "start",
            },
            Object {
              "index": 37,
              "newLength": 3,
              "oldLength": 11,
              "originalCol": 26,
              "originalLine": 2,
              "type": "end",
            },
          ],
        }
      `);
    });
  });

  describe('template literal', () => {
    it('works with basic templates', () => {
      let preprocessed = preprocessEmbeddedTemplates(
        stripIndent`
          import { hbs } from 'ember-template-imports';

          export default hbs\`Hello, world!\`;
        `,
        TEMPLATE_LITERAL_CONFIG
      );

      expect(preprocessed).toMatchInlineSnapshot(`
        Object {
          "output": "import { hbs } from 'ember-template-imports';

        export default hbs(\`Hello, world!\`);",
          "replacements": Array [
            Object {
              "index": 62,
              "newLength": 5,
              "oldLength": 4,
              "originalCol": 16,
              "originalLine": 3,
              "type": "start",
            },
            Object {
              "index": 79,
              "newLength": 2,
              "oldLength": 1,
              "originalCol": 33,
              "originalLine": 3,
              "type": "end",
            },
          ],
        }
      `);
    });

    it('works with templates assigned to variables', () => {
      let preprocessed = preprocessEmbeddedTemplates(
        stripIndent`
          import { hbs } from 'ember-template-imports';

          const Foo = hbs\`Hello, world!\`;
        `,
        TEMPLATE_LITERAL_CONFIG
      );

      expect(preprocessed).toMatchInlineSnapshot(`
        Object {
          "output": "import { hbs } from 'ember-template-imports';

        const Foo = hbs(\`Hello, world!\`);",
          "replacements": Array [
            Object {
              "index": 59,
              "newLength": 5,
              "oldLength": 4,
              "originalCol": 13,
              "originalLine": 3,
              "type": "start",
            },
            Object {
              "index": 76,
              "newLength": 2,
              "oldLength": 1,
              "originalCol": 30,
              "originalLine": 3,
              "type": "end",
            },
          ],
        }
      `);
    });

    it('works with class templates', () => {
      let preprocessed = preprocessEmbeddedTemplates(
        stripIndent`
          import { hbs } from 'ember-template-imports';

          class Foo {
            static template = hbs\`Hello, world!\`;
          }
        `,
        TEMPLATE_LITERAL_CONFIG
      );

      expect(preprocessed).toMatchInlineSnapshot(`
        Object {
          "output": "import { hbs } from 'ember-template-imports';

        class Foo {
          static template = hbs(\`Hello, world!\`);
        }",
          "replacements": Array [
            Object {
              "index": 79,
              "newLength": 5,
              "oldLength": 4,
              "originalCol": 21,
              "originalLine": 4,
              "type": "start",
            },
            Object {
              "index": 96,
              "newLength": 2,
              "oldLength": 1,
              "originalCol": 38,
              "originalLine": 4,
              "type": "end",
            },
          ],
        }
      `);
    });

    it('works with basic multi-line templates', () => {
      let preprocessed = preprocessEmbeddedTemplates(
        stripIndent`
          import { hbs } from 'ember-template-imports';

          class Foo {
            static template = hbs\`
              Hello, world!
            \`;
          }
        `,
        TEMPLATE_LITERAL_CONFIG
      );

      expect(preprocessed).toMatchInlineSnapshot(`
        Object {
          "output": "import { hbs } from 'ember-template-imports';

        class Foo {
          static template = hbs(\`
            Hello, world!
          \`);
        }",
          "replacements": Array [
            Object {
              "index": 79,
              "newLength": 5,
              "oldLength": 4,
              "originalCol": 21,
              "originalLine": 4,
              "type": "start",
            },
            Object {
              "index": 104,
              "newLength": 2,
              "oldLength": 1,
              "originalCol": 3,
              "originalLine": 6,
              "type": "end",
            },
          ],
        }
      `);
    });

    it('it does not process templates or tokens in comments', () => {
      let preprocessed = preprocessEmbeddedTemplates(
        stripIndent`
          import { hbs } from 'ember-template-imports';

          // hbs\`hello\`
          /* hbs\`hello\` */
          /*
            hbs\`hello\`
            other tokens
            \`"'/
          */

          export default hbs\`hello\`;
        `,
        TEMPLATE_LITERAL_CONFIG
      );

      expect(preprocessed).toMatchInlineSnapshot(`
        Object {
          "output": "import { hbs } from 'ember-template-imports';

        // hbs\`hello\`
        /* hbs\`hello\` */
        /*
          hbs\`hello\`
          other tokens
          \`\\"'/
        */

        export default hbs(\`hello\`);",
          "replacements": Array [
            Object {
              "index": 135,
              "newLength": 5,
              "oldLength": 4,
              "originalCol": 16,
              "originalLine": 11,
              "type": "start",
            },
            Object {
              "index": 144,
              "newLength": 2,
              "oldLength": 1,
              "originalCol": 25,
              "originalLine": 11,
              "type": "end",
            },
          ],
        }
      `);
    });

    it('exposes template identifiers', () => {
      let preprocessed = preprocessEmbeddedTemplates(
        stripIndent`
          import { hbs } from 'ember-template-imports';

          class Foo {
            static template = hbs\`
              <Component/>

              <ComponentWithYield>
                <:main></:main>
              </ComponentWithYield>

              {{#if globalValue}}
                {{globalHelper 123}}
              {{/if}}

              {{#if this.localValue}}
                {{this.localHelper 123}}
              {{/if}}

              {{@arg}}
              <@argComponent />

              {{#this.dynamicBlockComponent}}
              {{/this.dynamicBlockComponent}}

              <this.dynamicAngleComponent>
              </this.dynamicAngleComponent>
            \`;
          }
        `,
        TEMPLATE_LITERAL_CONFIG
      );

      expect(preprocessed).toMatchInlineSnapshot(`
        Object {
          "output": "import { hbs } from 'ember-template-imports';

        class Foo {
          static template = hbs(\`
            <Component/>

            <ComponentWithYield>
              <:main></:main>
            </ComponentWithYield>

            {{#if globalValue}}
              {{globalHelper 123}}
            {{/if}}

            {{#if this.localValue}}
              {{this.localHelper 123}}
            {{/if}}

            {{@arg}}
            <@argComponent />

            {{#this.dynamicBlockComponent}}
            {{/this.dynamicBlockComponent}}

            <this.dynamicAngleComponent>
            </this.dynamicAngleComponent>
          \`, { scope() { return {Component,ComponentWithYield,globalValue,globalHelper}; } });
        }",
          "replacements": Array [
            Object {
              "index": 79,
              "newLength": 5,
              "oldLength": 4,
              "originalCol": 21,
              "originalLine": 4,
              "type": "start",
            },
            Object {
              "index": 490,
              "newLength": 83,
              "oldLength": 1,
              "originalCol": 3,
              "originalLine": 27,
              "type": "end",
            },
          ],
        }
      `);
    });

    it('does not preprocess templates without correct import', () => {
      let preprocessed = preprocessEmbeddedTemplates(
        stripIndent`
          import { otherHbs as hbs } from 'ember-template-imports';

          class Foo {
            static template = hbs\`Hello, world!\`;
          }
        `,
        TEMPLATE_LITERAL_CONFIG
      );

      expect(preprocessed).toMatchInlineSnapshot(`
        Object {
          "output": "import { otherHbs as hbs } from 'ember-template-imports';

        class Foo {
          static template = hbs\`Hello, world!\`;
        }",
          "replacements": Array [],
        }
      `);
    });

    it('does preprocess templates based on import name', () => {
      let preprocessed = preprocessEmbeddedTemplates(
        stripIndent`
          import { hbs as otherHbs } from 'ember-template-imports';

          class Foo {
            static template = otherHbs\`Hello, world!\`;
          }
        `,
        TEMPLATE_LITERAL_CONFIG
      );

      expect(preprocessed).toMatchInlineSnapshot(`
        Object {
          "output": "import { hbs as otherHbs } from 'ember-template-imports';

        class Foo {
          static template = otherHbs(\`Hello, world!\`);
        }",
          "replacements": Array [
            Object {
              "index": 91,
              "newLength": 10,
              "oldLength": 9,
              "originalCol": 21,
              "originalLine": 4,
              "type": "start",
            },
            Object {
              "index": 113,
              "newLength": 2,
              "oldLength": 1,
              "originalCol": 43,
              "originalLine": 4,
              "type": "end",
            },
          ],
        }
      `);
    });

    it('does not preprocess templates that contain dynamic segments', () => {
      let preprocessed = preprocessEmbeddedTemplates(
        stripIndent`
          import { hbs } from 'ember-template-imports';

          class Foo {
            static template = hbs\`\${'Dynamic!'}\`;
          }
        `,
        TEMPLATE_LITERAL_CONFIG
      );

      expect(preprocessed).toMatchInlineSnapshot(`
        Object {
          "output": "import { hbs } from 'ember-template-imports';

        class Foo {
          static template = hbs\`\${'Dynamic!'}\`;
        }",
          "replacements": Array [],
        }
      `);
    });

    it('does preprocess templates that contain escaped dynamic segments', () => {
      let preprocessed = preprocessEmbeddedTemplates(
        stripIndent`
          import { hbs } from 'ember-template-imports';

          class Foo {
            static template = hbs\`\\\${'Actually not dynamic!'}\`;
          }
        `,
        TEMPLATE_LITERAL_CONFIG
      );

      expect(preprocessed).toMatchInlineSnapshot(`
        Object {
          "output": "import { hbs } from 'ember-template-imports';

        class Foo {
          static template = hbs(\`\\\\\${'Actually not dynamic!'}\`);
        }",
          "replacements": Array [
            Object {
              "index": 79,
              "newLength": 5,
              "oldLength": 4,
              "originalCol": 21,
              "originalLine": 4,
              "type": "start",
            },
            Object {
              "index": 110,
              "newLength": 2,
              "oldLength": 1,
              "originalCol": 52,
              "originalLine": 4,
              "type": "end",
            },
          ],
        }
      `);
    });

    it('correctly preprocesses templates that contain escaped backticks', () => {
      let preprocessed = preprocessEmbeddedTemplates(
        stripIndent`
          import { hbs } from 'ember-template-imports';

          class Foo {
            static template = hbs\`\\\`\`;
          }
        `,
        TEMPLATE_LITERAL_CONFIG
      );

      expect(preprocessed).toMatchInlineSnapshot(`
        Object {
          "output": "import { hbs } from 'ember-template-imports';

        class Foo {
          static template = hbs(\`\\\\\`\`);
        }",
          "replacements": Array [
            Object {
              "index": 79,
              "newLength": 5,
              "oldLength": 4,
              "originalCol": 21,
              "originalLine": 4,
              "type": "start",
            },
            Object {
              "index": 85,
              "newLength": 2,
              "oldLength": 1,
              "originalCol": 27,
              "originalLine": 4,
              "type": "end",
            },
          ],
        }
      `);
    });

    it('can include sourcemaps', () => {
      let preprocessed = preprocessEmbeddedTemplates(
        stripIndent`
          import { hbs } from 'ember-template-imports';

          class Foo {
            static template = hbs\`Hello, world!\`
          }
        `,
        Object.assign({}, TEMPLATE_LITERAL_CONFIG, { includeSourceMaps: true })
      );

      expect(preprocessed).toMatchInlineSnapshot(`
        Object {
          "output": "import { hbs } from 'ember-template-imports';

        class Foo {
          static template = hbs(\`Hello, world!\`)
        }
        //# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFyLmpzIiwic291cmNlcyI6WyJiYXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgaGJzIH0gZnJvbSAnZW1iZXItdGVtcGxhdGUtaW1wb3J0cyc7XG5cbmNsYXNzIEZvbyB7XG4gIHN0YXRpYyB0ZW1wbGF0ZSA9IGhic2BIZWxsbywgd29ybGQhYFxufSJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUM3QztBQUNBLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNYLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBQztBQUN0QyJ9",
          "replacements": Array [
            Object {
              "index": 79,
              "newLength": 5,
              "oldLength": 4,
              "originalCol": 21,
              "originalLine": 4,
              "type": "start",
            },
            Object {
              "index": 96,
              "newLength": 2,
              "oldLength": 1,
              "originalCol": 38,
              "originalLine": 4,
              "type": "end",
            },
          ],
        }
      `);
    });
  });
});
