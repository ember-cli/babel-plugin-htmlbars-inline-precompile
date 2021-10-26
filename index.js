'use strict';
const { replaceTemplateLiteralProposal } = require('./src/template-literal-transform');
const { replaceTemplateTagProposal } = require('./src/template-tag-transform');
const { registerRefs } = require('./src/util');
const { setupState, processImportDeclaration } = require('babel-plugin-ember-modules-api-polyfill');

module.exports = function (babel) {
  let t = babel.types;

  const runtimeErrorIIFE = babel.template(
    `(function() {\n  throw new Error('ERROR_MESSAGE');\n})();`
  );

  function parseExpression(state, buildError, name, node) {
    switch (node.type) {
      case 'ObjectExpression':
        return parseObjectExpression(state, buildError, name, node);
      case 'ArrayExpression': {
        return parseArrayExpression(state, buildError, name, node);
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

  function parseArrayExpression(state, buildError, name, node) {
    let result = node.elements.map((element) => parseExpression(state, buildError, name, element));

    return result;
  }

  function parseScope(state, buildError, name, node) {
    let body;

    if (node.type === 'ObjectMethod') {
      body = node.body;
    } else if (node.value.type === 'ObjectExpression') {
      console.warn(
        `Passing an object as the \`scope\` property to inline templates has been deprecated. Please pass a function that returns an object expression instead. Usage in: ${state.file.opts.filename}`
      );

      body = node.value;
    } else {
      body = node.value.body;
    }

    let objExpression;

    if (body && body.type === 'ObjectExpression') {
      objExpression = body;
    } else if (body && body.type === 'BlockStatement') {
      let returnStatement = body.body[0];

      if (body.body.length !== 1 || returnStatement.type !== 'ReturnStatement') {
        throw new Error(
          'Scope functions can only consist of a single return statement which returns an object expression containing references to in-scope values'
        );
      }

      objExpression = returnStatement.argument;
    }

    if (!objExpression || objExpression.type !== 'ObjectExpression') {
      throw buildError(
        `Scope objects for \`${name}\` must be an object expression containing only references to in-scope values, or a function that returns an object expression containing only references to in-scope values`
      );
    }

    return objExpression.properties.map((prop) => {
      let { key, value } = prop;

      if (value.type !== 'Identifier' || value.name !== key.name) {
        throw buildError(
          `Scope objects for \`${name}\` may only contain direct references to in-scope values, e.g. { ${key.name} } or { ${key.name}: ${key.name} }`
        );
      }

      return key.name;
    });
  }

  function parseObjectExpression(state, buildError, name, node, shouldParseScope = false) {
    let result = {};

    node.properties.forEach((property) => {
      if (property.computed || !['Identifier', 'StringLiteral'].includes(property.key.type)) {
        throw buildError(`${name} can only accept static options`);
      }

      let propertyName =
        property.key.type === 'Identifier' ? property.key.name : property.key.value;

      if (shouldParseScope && propertyName === 'scope') {
        result.locals = parseScope(state, buildError, name, property);
      } else {
        result[propertyName] = parseExpression(state, buildError, name, property.value);
      }
    });

    return result;
  }

  function compileTemplate(precompile, template, templateCompilerIdentifier, _options) {
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

    let precompileResultAST = babel.parse(`var precompileResult = ${precompileResultString};`, {
      babelrc: false,
      configFile: false,
    });

    let templateExpression = precompileResultAST.program.body[0].declarations[0].init;

    t.addComment(
      templateExpression,
      'leading',
      `\n  ${template.replace(/\*\//g, '*\\/')}\n`,
      /* line comment? */ false
    );

    return t.callExpression(templateCompilerIdentifier, [templateExpression]);
  }

  function getScope(scope) {
    let names = [];

    while (scope) {
      for (let binding in scope.bindings) {
        names.push(binding);
      }

      scope = scope.parent;
    }

    return names;
  }

  function shouldUseAutomaticScope(options) {
    return options.useTemplateLiteralProposalSemantics || options.useTemplateTagProposalSemantics;
  }

  function shouldUseStrictMode(options) {
    return (
      Boolean(options.useTemplateLiteralProposalSemantics) ||
      Boolean(options.useTemplateTagProposalSemantics)
    );
  }

  function replacePath(path, state, compiled, options) {
    if (options.useTemplateLiteralProposalSemantics) {
      replaceTemplateLiteralProposal(t, path, state, compiled, options);
    } else if (options.useTemplateTagProposalSemantics) {
      replaceTemplateTagProposal(t, path, state, compiled, options);
    } else {
      registerRefs(path.replaceWith(compiled), (newPath) => {
        // If we use `insertRuntimeErrors` then the node won't exist
        return newPath.node ? [newPath.get('callee')] : [];
      });
    }

    if (state.opts.ensureModuleApiPolyfill) {
      processModuleApiPolyfill(state);
    }
  }

  function processModuleApiPolyfill(state) {
    for (let module in state.allAddedImports) {
      let addedImports = state.allAddedImports[module];

      for (let addedImport in addedImports) {
        let { path } = addedImports[addedImport];

        if (path && path.node) {
          processImportDeclaration(t, path, state);

          if (path.removed) {
            delete addedImports[addedImport];
          }
        }
      }
    }
  }

  let precompile;

  let visitor = {
    Program(path, state) {
      state.opts.ensureModuleApiPolyfill =
        'ensureModuleApiPolyfill' in state.opts ? state.opts.ensureModuleApiPolyfill : true;

      if (state.opts.templateCompilerPath) {
        let templateCompiler = require(state.opts.templateCompilerPath);

        precompile = templateCompiler.precompile;
      } else {
        precompile = state.opts.precompile;
      }

      if (state.opts.ensureModuleApiPolyfill) {
        // Setup state for the module API polyfill
        setupState(t, path, state);
      }

      let options = state.opts || {};

      // Find/setup Ember global identifier
      let useEmberModule = Boolean(options.useEmberModule);
      let moduleOverrides = options.moduleOverrides;

      state.allAddedImports = Object.create(null);

      state.ensureImport = (exportName, moduleName) => {
        let addedImports = (state.allAddedImports[moduleName] =
          state.allAddedImports[moduleName] || {});

        if (addedImports[exportName]) return t.identifier(addedImports[exportName].id.name);

        if (moduleOverrides) {
          let glimmerModule = moduleOverrides[moduleName];
          let glimmerExport = glimmerModule && glimmerModule[exportName];

          if (glimmerExport) {
            exportName = glimmerExport[0];
            moduleName = glimmerExport[1];
          }
        }

        if (exportName === 'default' && moduleName === 'ember' && !useEmberModule) {
          addedImports[exportName] = { id: t.identifier('Ember') };

          return addedImports[exportName].id;
        }

        let importDeclarations = path.get('body').filter((n) => n.type === 'ImportDeclaration');

        let preexistingImportDeclaration = importDeclarations.find(
          (n) => n.get('source').get('value').node === moduleName
        );

        if (preexistingImportDeclaration) {
          let importSpecifier = preexistingImportDeclaration.get('specifiers').find(({ node }) => {
            return exportName === 'default'
              ? t.isImportDefaultSpecifier(node)
              : node.imported && node.imported.name === exportName;
          });

          if (importSpecifier) {
            addedImports[exportName] = { id: importSpecifier.node.local };
          }
        }

        if (!addedImports[exportName]) {
          let uid = path.scope.generateUidIdentifier(
            exportName === 'default' ? moduleName : exportName
          );

          let newImportSpecifier =
            exportName === 'default'
              ? t.importDefaultSpecifier(uid)
              : t.importSpecifier(uid, t.identifier(exportName));

          let newImport = t.importDeclaration([newImportSpecifier], t.stringLiteral(moduleName));
          path.unshiftContainer('body', newImport);
          path.scope.registerBinding('module', path.get('body.0.specifiers.0'));

          addedImports[exportName] = {
            id: uid,
            path: path.get('body.0'),
          };
        }

        return t.identifier(addedImports[exportName].id.name);
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
      let importDeclarations = path.get('body').filter((n) => n.type === 'ImportDeclaration');

      for (let module in modules) {
        let options = modules[module];

        if (options.useTemplateTagProposalSemantics) {
          if (options.useTemplateLiteralProposalSemantics) {
            throw path.buildCodeFrameError(
              'Cannot use both the template literal and template tag syntax proposals together'
            );
          }

          // template tags don't have an import
          presentModules.set(
            options.export,
            Object.assign({}, options, {
              modulePath: module,
              originalName: options.export,
            })
          );

          continue;
        }

        let paths = importDeclarations.filter(
          (path) => !path.removed && path.get('source').get('value').node === module
        );

        for (let path of paths) {
          let options = modules[module];

          if (typeof options === 'string') {
            // Normalize 'moduleName': 'importSpecifier'
            options = { export: options };
          } else {
            // else clone options so we don't mutate it
            options = Object.assign({}, options);
          }

          let modulePathExport = options.export;
          let importSpecifierPath = path
            .get('specifiers')
            .find(({ node }) =>
              modulePathExport === 'default'
                ? t.isImportDefaultSpecifier(node)
                : node.imported && node.imported.name === modulePathExport
            );

          if (importSpecifierPath) {
            let localName = importSpecifierPath.node.local.name;

            options.modulePath = module;
            options.originalName = localName;
            let localImportId = path.scope.generateUidIdentifierBasedOnNode(path.node.id);

            path.scope.rename(localName, localImportId);

            // If it was the only specifier, remove the whole import, else
            // remove the specifier
            if (path.node.specifiers.length === 1) {
              path.remove();
            } else {
              importSpecifierPath.remove();
            }

            presentModules.set(localImportId, options);
          }
        }
      }

      state.presentModules = presentModules;
    },

    Class(path, state) {
      // Processing classes this way allows us to process ClassProperty nodes
      // before other transforms, such as the class-properties transform
      path.get('body.body').forEach((path) => {
        if (path.type !== 'ClassProperty') return;

        let keyPath = path.get('key');
        let valuePath = path.get('value');

        if (keyPath && visitor[keyPath.type]) {
          visitor[keyPath.type](keyPath, state);
        }

        if (valuePath && visitor[valuePath.type]) {
          visitor[valuePath.type](valuePath, state);
        }
      });
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

      let { isProduction } = state.opts;
      let locals = shouldUseAutomaticScope(options) ? getScope(path.scope) : null;
      let strictMode = shouldUseStrictMode(options);

      let emberIdentifier = state.ensureImport('createTemplateFactory', '@ember/template-factory');

      replacePath(
        path,
        state,
        compileTemplate(precompile, template, emberIdentifier, {
          isProduction,
          locals,
          strictMode,
        }),
        options
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
            state,
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

      let { isProduction } = state.opts;

      // allow the user specified value to "win" over ours
      if (!('isProduction' in compilerOptions)) {
        compilerOptions.isProduction = isProduction;
      }

      if (shouldUseAutomaticScope(options)) {
        // If using the transform semantics, then users are not expected to pass
        // options, so we override any existing scope
        compilerOptions.locals = getScope(path.scope);
      }

      if (shouldUseStrictMode(options)) {
        // If using the transform semantics, then users are not expected to pass
        // options, so we override any existing strict option
        compilerOptions.strictMode = true;
      }

      replacePath(
        path,
        state,
        compileTemplate(
          precompile,
          template,
          state.ensureImport('createTemplateFactory', '@ember/template-factory'),
          compilerOptions
        ),
        options
      );
    },
  };

  return { visitor };
};

module.exports._parallelBabel = {
  requireFile: __filename,
};

module.exports.baseDir = function () {
  return __dirname;
};

module.exports.preprocessEmbeddedTemplates = require('./dist/preprocess-embedded-templates').default;
