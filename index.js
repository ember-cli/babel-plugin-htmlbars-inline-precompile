'use strict';

module.exports = function (babel) {
  let t = babel.types;

  const runtimeErrorIIFE = babel.template(
    `(function() {\n  throw new Error('ERROR_MESSAGE');\n})();`
  );

  function parseExpression(buildError, node) {
    switch (node.type) {
      case 'ObjectExpression':
        return parseObjectExpression(buildError, node);
      case 'ArrayExpression': {
        return parseArrayExpression(buildError, node);
      }
      case 'StringLiteral':
      case 'BooleanLiteral':
      case 'NumericLiteral':
        return node.value;
      default:
        throw buildError(
          `hbs can only accept static options but you passed ${JSON.stringify(node)}`
        );
    }
  }

  function parseArrayExpression(buildError, node) {
    let result = node.elements.map((element) => parseExpression(buildError, element));

    return result;
  }

  function parseObjectExpression(buildError, node) {
    let result = {};

    node.properties.forEach((property) => {
      if (property.computed || !['Identifier', 'StringLiteral'].includes(property.key.type)) {
        throw buildError('hbs can only accept static options');
      }

      let propertyName =
        property.key.type === 'Identifier' ? property.key.name : property.key.value;

      let value = parseExpression(buildError, property.value);

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
        let useEmberModule = Boolean(options.useEmberModule);

        let preexistingEmberImportDeclaration = path
          .get('body')
          .filter((n) => n.type === 'ImportDeclaration')
          .find((n) => n.get('source').get('value').node === 'ember');

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
      },

      ImportDeclaration(path, state) {
        let node = path.node;

        let modules = state.opts.modules || {
          'ember-cli-htmlbars': 'hbs',
          'ember-cli-htmlbars-inline-precompile': 'default',
          'htmlbars-inline-precompile': 'default',
        };

        if (state.opts.modulePaths) {
          let modulePaths = state.opts.modulePaths;

          modulePaths.forEach((path) => (modules[path] = 'default'));
        }

        let modulePaths = Object.keys(modules);
        let matchingModulePath = modulePaths.find((value) => t.isLiteral(node.source, { value }));
        let modulePathExport = modules[matchingModulePath];

        if (matchingModulePath) {
          let first = node.specifiers && node.specifiers[0];
          let localName = first.local.name;

          if (modulePathExport === 'default') {
            if (!t.isImportDefaultSpecifier(first)) {
              let input = state.file.code;
              let usedImportStatement = input.slice(node.start, node.end);
              let msg = `Only \`import hbs from '${matchingModulePath}'\` is supported. You used: \`${usedImportStatement}\``;
              throw path.buildCodeFrameError(msg);
            }
          } else if (!t.isImportSpecifier(first) || modulePathExport !== first.imported.name) {
            let input = state.file.code;
            let usedImportStatement = input.slice(node.start, node.end);
            let msg = `Only \`import { ${modulePathExport} } from '${matchingModulePath}'\` is supported. You used: \`${usedImportStatement}\``;

            throw path.buildCodeFrameError(msg);
          }

          state.importId =
            state.importId || path.scope.generateUidIdentifierBasedOnNode(path.node.id);

          path.scope.rename(localName, state.importId.name);

          path.remove();
        }
      },

      TaggedTemplateExpression(path, state) {
        if (!state.importId) {
          return;
        }

        let tagPath = path.get('tag');
        if (tagPath.node.name !== state.importId.name) {
          return;
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
        if (!state.importId) {
          return;
        }

        let calleePath = path.get('callee');
        if (calleePath.node.name !== state.importId.name) {
          return;
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
            throw path.buildCodeFrameError('tagged template strings inside hbs are not supported');
          default:
            throw path.buildCodeFrameError(
              'hbs should be invoked with at least a single argument: the template string'
            );
        }

        let options;

        switch (args.length) {
          case 1:
            options = {};
            break;
          case 2: {
            if (args[1].type !== 'ObjectExpression') {
              throw path.buildCodeFrameError(
                'hbs can only be invoked with 2 arguments: the template string, and any static options'
              );
            }

            options = parseObjectExpression(path.buildCodeFrameError.bind(path), args[1]);

            break;
          }
          default:
            throw path.buildCodeFrameError(
              'hbs can only be invoked with 2 arguments: the template string, and any static options'
            );
        }

        let { precompile, isProduction } = state.opts;

        // allow the user specified value to "win" over ours
        if (!('isProduction' in options)) {
          options.isProduction = isProduction;
        }

        state.ensureEmberImport();

        path.replaceWith(compileTemplate(precompile, template, state.emberIdentifier, options));
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
