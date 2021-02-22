'use strict';

module.exports = function (babel) {
  let t = babel.types;

  const runtimeErrorIIFE = babel.template(
    `(function() {\n  throw new Error('ERROR_MESSAGE');\n})();`
  );

  function parseExpression(buildError, name, node) {
    switch (node.type) {
      case 'ObjectExpression':
        return parseObjectExpression(buildError, name, node);
      case 'ArrayExpression': {
        return parseArrayExpression(buildError, name, node);
      }
      case 'StringLiteral':
      case 'BooleanLiteral':
      case 'NumericLiteral':
        return node.value;
      default:
        throw buildError(
          `${name} can only accept static options but you passed ${JSON.stringify(node)}`
        );
    }
  }

  function parseArrayExpression(buildError, name, node) {
    let result = node.elements.map((element) => parseExpression(buildError, name, element));

    return result;
  }

  function parseScopeObject(buildError, name, node) {
    if (node.type !== 'ObjectExpression') {
      throw buildError(
        `Scope objects for \`${name}\` must be an object expression containing only references to in-scope values`
      );
    }

    return node.properties.map((prop) => {
      let { key, value } = prop;

      if (value.type !== 'Identifier' || value.name !== key.name) {
        throw buildError(
          `Scope objects for \`${name}\` may only contain direct references to in-scope values, e.g. { ${key.name} } or { ${key.name}: ${key.name} }`
        );
      }

      return key.name;
    });
  }

  function parseObjectExpression(buildError, name, node, shouldParseScope = false) {
    let result = {};

    node.properties.forEach((property) => {
      if (property.computed || !['Identifier', 'StringLiteral'].includes(property.key.type)) {
        throw buildError(`${name} can only accept static options`);
      }

      let propertyName =
        property.key.type === 'Identifier' ? property.key.name : property.key.value;

      let value;

      if (shouldParseScope && propertyName === 'scope') {
        value = parseScopeObject(buildError, name, property.value);
      } else {
        value = parseExpression(buildError, name, property.value);
      }

      result[propertyName] = value;
    });

    return result;
  }

  function compileTemplate(precompile, template, emberIdentifier, _options) {
    let options = Object.assign({ contents: template }, _options);

    let precompileResultString;

    if (options.insertRuntimeErrors) {
      try {
        precompileResultString = precompile(template, options);
      } catch (error) {
        return runtimeErrorIIFE({ ERROR_MESSAGE: error.message });
      }
    } else {
      precompileResultString = precompile(template, options);
    }

    let precompileResultAST = babel.parse(`var precompileResult = ${precompileResultString};`);

    let templateExpression = precompileResultAST.program.body[0].declarations[0].init;

    t.addComment(
      templateExpression,
      'leading',
      `\n  ${template.replace(/\*\//g, '*\\/')}\n`,
      /* line comment? */ false
    );

    return t.callExpression(
      t.memberExpression(
        t.memberExpression(emberIdentifier, t.identifier('HTMLBars')),
        t.identifier('template')
      ),
      [templateExpression]
    );
  }

  return {
    visitor: {
      Program(path, state) {
        let options = state.opts || {};

        // Find/setup Ember global identifier
        let useEmberModule = Boolean(options.useEmberModule);

        let importDeclarations = path.get('body').filter((n) => n.type === 'ImportDeclaration');

        let preexistingEmberImportDeclaration = importDeclarations.find(
          (n) => n.get('source').get('value').node === 'ember'
        );

        if (
          // an import was found
          preexistingEmberImportDeclaration &&
          // this accounts for `import from 'ember'` without a local identifier
          preexistingEmberImportDeclaration.node.specifiers.length > 0
        ) {
          state.emberIdentifier = preexistingEmberImportDeclaration.node.specifiers[0].local;
        }

        state.ensureEmberImport = () => {
          if (!useEmberModule) {
            // ensures that we can always assume `state.emberIdentifier` is set
            state.emberIdentifier = t.identifier('Ember');
            return;
          }

          if (state.emberIdentifier) return;

          state.emberIdentifier = path.scope.generateUidIdentifier('Ember');

          let emberImport = t.importDeclaration(
            [t.importDefaultSpecifier(state.emberIdentifier)],
            t.stringLiteral('ember')
          );

          path.unshiftContainer('body', emberImport);
        };

        // Setup other module options and create cache for values
        let modules = state.opts.modules || {
          'htmlbars-inline-precompile': { export: 'default', shouldParseScope: false },
        };

        if (state.opts.modulePaths) {
          let modulePaths = state.opts.modulePaths;

          modulePaths.forEach((path) => (modules[path] = { export: 'default' }));
        }

        let presentModules = new Map();

        for (let module in modules) {
          let paths = importDeclarations.filter(
            (path) => !path.removed && path.get('source').get('value').node === module
          );

          for (let path of paths) {
            let { node } = path;
            let options = modules[module];

            if (typeof options === 'string') {
              // Normalize 'moduleName': 'importSpecifier'
              options = { export: options };
            } else {
              // else clone options so we don't mutate it
              options = Object.assign({}, options);
            }

            let modulePathExport = options.export;

            let first = node.specifiers && node.specifiers[0];
            let localName = first.local.name;

            if (modulePathExport === 'default') {
              let importDefaultSpecifier = node.specifiers.find((n) =>
                t.isImportDefaultSpecifier(n)
              );

              if (!importDefaultSpecifier) {
                let input = state.file.code;
                let usedImportStatement = input.slice(node.start, node.end);
                let msg = `Only \`import ${
                  options.defaultName || localName
                } from '${module}'\` is supported. You used: \`${usedImportStatement}\``;
                throw path.buildCodeFrameError(msg);
              }
            } else {
              if (!t.isImportSpecifier(first) || modulePathExport !== first.imported.name) {
                let input = state.file.code;
                let usedImportStatement = input.slice(node.start, node.end);
                let msg = `Only \`import { ${modulePathExport} } from '${module}'\` is supported. You used: \`${usedImportStatement}\``;

                throw path.buildCodeFrameError(msg);
              }
            }

            options.modulePath = module;
            options.originalName = localName;
            let localImportId = path.scope.generateUidIdentifierBasedOnNode(path.node.id);

            path.scope.rename(localName, localImportId);

            path.remove();

            presentModules.set(localImportId, options);
          }
        }

        state.presentModules = presentModules;
      },

      TaggedTemplateExpression(path, state) {
        let tagPath = path.get('tag');
        let options = state.presentModules.get(tagPath.node.name);

        if (!options) {
          return;
        }

        if (options.disableTemplateLiteral) {
          throw path.buildCodeFrameError(
            `Attempted to use \`${options.originalName}\` as a template tag, but it can only be called as a function with a string passed to it: ${options.originalName}('content here')`
          );
        }

        if (path.node.quasi.expressions.length) {
          throw path.buildCodeFrameError(
            'placeholders inside a tagged template string are not supported'
          );
        }

        let template = path.node.quasi.quasis.map((quasi) => quasi.value.cooked).join('');

        let { precompile, isProduction } = state.opts;

        state.ensureEmberImport();

        path.replaceWith(
          compileTemplate(precompile, template, state.emberIdentifier, { isProduction })
        );
      },

      CallExpression(path, state) {
        let calleePath = path.get('callee');
        let options = state.presentModules.get(calleePath.node.name);

        if (!options) {
          return;
        }

        if (options.disableFunctionCall) {
          throw path.buildCodeFrameError(
            `Attempted to use \`${options.originalName}\` as a function call, but it can only be used as a template tag: ${options.originalName}\`content here\``
          );
        }

        let args = path.node.arguments;

        let template;

        switch (args[0] && args[0].type) {
          case 'StringLiteral':
            template = args[0].value;
            break;
          case 'TemplateLiteral':
            if (args[0].expressions.length) {
              throw path.buildCodeFrameError(
                'placeholders inside a template string are not supported'
              );
            } else {
              template = args[0].quasis.map((quasi) => quasi.value.cooked).join('');
            }
            break;
          case 'TaggedTemplateExpression':
            throw path.buildCodeFrameError(
              `tagged template strings inside ${options.originalName} are not supported`
            );
          default:
            throw path.buildCodeFrameError(
              'hbs should be invoked with at least a single argument: the template string'
            );
        }

        let compilerOptions;

        switch (args.length) {
          case 1:
            compilerOptions = {};
            break;
          case 2: {
            if (args[1].type !== 'ObjectExpression') {
              throw path.buildCodeFrameError(
                'hbs can only be invoked with 2 arguments: the template string, and any static options'
              );
            }

            compilerOptions = parseObjectExpression(
              path.buildCodeFrameError.bind(path),
              options.originalName,
              args[1],
              true
            );

            break;
          }
          default:
            throw path.buildCodeFrameError(
              'hbs can only be invoked with 2 arguments: the template string, and any static options'
            );
        }

        let { precompile, isProduction } = state.opts;

        // allow the user specified value to "win" over ours
        if (!('isProduction' in compilerOptions)) {
          compilerOptions.isProduction = isProduction;
        }

        state.ensureEmberImport();

        path.replaceWith(
          compileTemplate(precompile, template, state.emberIdentifier, compilerOptions)
        );
      },
    },
  };
};

module.exports._parallelBabel = {
  requireFile: __filename,
};

module.exports.baseDir = function () {
  return __dirname;
};
