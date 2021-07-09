import type { NodePath } from '@babel/traverse';
import type * as Babel from '@babel/core';
import type { types as t } from '@babel/core';
import { ImportUtil } from 'babel-import-util';
import { ExpressionParser } from './expression-parser';

export type EmberPrecompile = (templateString: string, options: Record<string, unknown>) => string;

export type LegacyModuleName =
  | 'ember-cli-htmlbars'
  | 'ember-cli-htmlbars-inline-precompile'
  | 'htmlbars-inline-precompile';

type ModuleName = LegacyModuleName | '@ember/template-compilation';

interface ModuleConfig {
  moduleName: ModuleName;
  export: string;
  allowTemplateLiteral: boolean;
  enableScope: boolean;
}

const INLINE_PRECOMPILE_MODULES: ModuleConfig[] = [
  {
    moduleName: 'ember-cli-htmlbars',
    export: 'hbs',
    allowTemplateLiteral: true,
    enableScope: false,
  },
  {
    moduleName: 'ember-cli-htmlbars-inline-precompile',
    export: 'default',
    allowTemplateLiteral: true,
    enableScope: false,
  },
  {
    moduleName: 'htmlbars-inline-precompile',
    export: 'default',
    allowTemplateLiteral: true,
    enableScope: false,
  },
  {
    moduleName: '@ember/template-compilation',
    export: 'precompileTemplate',
    allowTemplateLiteral: false,
    enableScope: true,
  },
];

export interface Options {
  // Allows you to remap what imports will be emitted in our compiled output. By
  // example:
  //
  //   outputModuleOverrides: {
  //     '@ember/template-factory': {
  //       createTemplateFactory: ['createTemplateFactory', '@glimmer/core'],
  //     }
  //   }
  //
  // Normal Ember apps shouldn't need this, it exists to support other
  // environments like standalone GlimmerJS
  outputModuleOverrides?: Record<string, Record<string, [string, string]>>;

  // By default, this plugin implements only Ember's stable public API for
  // template compilation, which is:
  //
  //    import { precompileTemplate } from '@ember/template-compilation';
  //
  // But historically there are several other importable syntaxes in widespread
  // use, and we can enable those too by including their module names in this
  // list.
  enableLegacyModules?: LegacyModuleName[];
}

interface State {
  opts: Options;
  util: ImportUtil;
  precompile: EmberPrecompile;
}

export default function makePlugin<O>(
  // receives the Babel plugin options, returns Ember's precompiler
  loadPrecompiler: (opts: O) => EmberPrecompile
) {
  return function htmlbarsInlinePrecompile(babel: typeof Babel): Babel.PluginObj<State> {
    let t = babel.types;

    function compileTemplate(
      precompile: EmberPrecompile,
      template: string,
      templateCompilerIdentifier: t.Identifier,
      userTypedOptions: Record<string, unknown>
    ): t.Expression {
      let options = Object.assign({ contents: template }, userTypedOptions);

      let precompileResultString: string;

      if (options.insertRuntimeErrors) {
        try {
          precompileResultString = precompile(template, options);
        } catch (error) {
          return runtimeErrorIIFE(babel, { ERROR_MESSAGE: error.message });
        }
      } else {
        precompileResultString = precompile(template, options);
      }

      let precompileResultAST = babel.parse(
        `var precompileResult = ${precompileResultString};`
      ) as t.File;

      let templateExpression = (precompileResultAST.program.body[0] as t.VariableDeclaration)
        .declarations[0].init;

      t.addComment(
        templateExpression!,
        'leading',
        `\n  ${template.replace(/\*\//g, '*\\/')}\n`,
        /* line comment? */ false
      );

      return t.callExpression(templateCompilerIdentifier, [templateExpression!]);
    }

    function ensureImport(
      target: NodePath<t.Node>,
      moduleName: string,
      exportName: string,
      state: State
    ): t.Identifier {
      let moduleOverrides = state.opts.outputModuleOverrides;
      if (moduleOverrides) {
        let glimmerModule = moduleOverrides[moduleName];
        let glimmerExport = glimmerModule?.[exportName];

        if (glimmerExport) {
          exportName = glimmerExport[0];
          moduleName = glimmerExport[1];
        }
      }
      return state.util.import(target, moduleName, exportName);
    }

    return {
      visitor: {
        Program: {
          enter(path: NodePath<t.Program>, state: State) {
            state.util = new ImportUtil(t, path);
            state.precompile = loadPrecompiler(state.opts as O);
          },
          exit(_path: NodePath<t.Program>, state: State) {
            for (let { moduleName, export: exportName } of configuredModules(state)) {
              state.util.removeImport(moduleName, exportName);
            }
          },
        },

        TaggedTemplateExpression(path: NodePath<t.TaggedTemplateExpression>, state: State) {
          let tagPath = path.get('tag');

          if (!tagPath.isIdentifier()) {
            return;
          }
          let options = referencesInlineCompiler(tagPath, state);
          if (!options) {
            return;
          }

          if (!options.allowTemplateLiteral) {
            throw path.buildCodeFrameError(
              `Attempted to use \`${tagPath.node.name}\` as a template tag, but it can only be called as a function with a string passed to it: ${tagPath.node.name}('content here')`
            );
          }

          if (path.node.quasi.expressions.length) {
            throw path.buildCodeFrameError(
              'placeholders inside a tagged template string are not supported'
            );
          }

          let template = path.node.quasi.quasis.map((quasi) => quasi.value.cooked).join('');

          let emberIdentifier = ensureImport(
            path,
            '@ember/template-factory',
            'createTemplateFactory',
            state
          );

          path.replaceWith(compileTemplate(state.precompile, template, emberIdentifier, {}));
        },

        CallExpression(path: NodePath<t.CallExpression>, state: State) {
          let calleePath = path.get('callee');

          if (!calleePath.isIdentifier()) {
            return;
          }
          let options = referencesInlineCompiler(calleePath, state);
          if (!options) {
            return;
          }

          let [firstArg, secondArg, ...restArgs] = path.get('arguments');

          let template;

          switch (firstArg?.node.type) {
            case 'StringLiteral':
              template = firstArg.node.value;
              break;
            case 'TemplateLiteral':
              if (firstArg.node.expressions.length) {
                throw path.buildCodeFrameError(
                  'placeholders inside a template string are not supported'
                );
              } else {
                template = firstArg.node.quasis.map((quasi) => quasi.value.cooked).join('');
              }
              break;
            case 'TaggedTemplateExpression':
              throw path.buildCodeFrameError(
                `tagged template strings inside ${calleePath.node.name} are not supported`
              );
            default:
              throw path.buildCodeFrameError(
                `${calleePath.node.name} should be invoked with at least a single argument (the template string)`
              );
          }

          let userTypedOptions: Record<string, unknown>;

          if (!secondArg) {
            userTypedOptions = {};
          } else {
            if (!secondArg.isObjectExpression()) {
              throw path.buildCodeFrameError(
                `${calleePath.node.name} can only be invoked with 2 arguments: the template string, and any static options`
              );
            }

            userTypedOptions = new ExpressionParser(babel).parseObjectExpression(
              calleePath.node.name,
              secondArg,
              true
            );
          }
          if (restArgs.length > 0) {
            throw path.buildCodeFrameError(
              `${calleePath.node.name} can only be invoked with 2 arguments: the template string, and any static options`
            );
          }

          path.replaceWith(
            compileTemplate(
              state.precompile,
              template,
              ensureImport(path, '@ember/template-factory', 'createTemplateFactory', state),
              userTypedOptions
            )
          );
        },
      },
    };
  };
}

function* configuredModules(state: State) {
  for (let moduleConfig of INLINE_PRECOMPILE_MODULES) {
    if (
      moduleConfig.moduleName !== '@ember/template-compilation' &&
      !state.opts.enableLegacyModules?.includes(moduleConfig.moduleName)
    ) {
      continue;
    }
    yield moduleConfig;
  }
}

function referencesInlineCompiler(
  path: NodePath<t.Identifier>,
  state: State
): ModuleConfig | undefined {
  for (let moduleConfig of configuredModules(state)) {
    if (path.referencesImport(moduleConfig.moduleName, moduleConfig.export)) {
      return moduleConfig;
    }
  }
  return undefined;
}

function runtimeErrorIIFE(babel: typeof Babel, replacements: { ERROR_MESSAGE: string }) {
  let statement = babel.template(`(function() {\n  throw new Error('ERROR_MESSAGE');\n})();`)(
    replacements
  ) as t.ExpressionStatement;
  return statement.expression;
}
