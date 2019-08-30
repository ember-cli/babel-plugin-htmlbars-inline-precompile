'use strict';

module.exports = function(babel) {
  let t = babel.types;

  function compileTemplate(precompile, template, _options) {
    let options = Object.assign({ contents: template }, _options);

    let compiledTemplateString = `Ember.HTMLBars.template(${precompile(template, options)})`;

    return compiledTemplateString;
  }

  function parseObjectExpression(buildError, node) {
    let result = {};

    node.properties.forEach(property => {
      if (property.computed || property.key.type !== "Identifier") {
        throw buildError("hbs can only accept static options");
      }

      let value;
      if (property.value.type === "ObjectExpression") {
        value = parseObjectExpression(buildError, property.value);
      } else if (["StringLiteral", "NumericLiteral", "BooleanLiteral"].indexOf(property.value.type) > -1) {
        value = property.value.value;
      } else {
        throw buildError("hbs can only accept static options");
      }

      result[property.key.name] = value;
    });

    return result;
  }

  return {
    visitor: {
      ImportDeclaration(path, state) {
        let node = path.node;

        let modulePaths = state.opts.modulePaths || ["htmlbars-inline-precompile"];
        let matchingModulePath = modulePaths.find(value => t.isLiteral(node.source, { value }));

        if (matchingModulePath) {
          let first = node.specifiers && node.specifiers[0];
          if (!t.isImportDefaultSpecifier(first)) {
            let input = state.file.code;
            let usedImportStatement = input.slice(node.start, node.end);
            let msg = `Only \`import hbs from '${matchingModulePath}'\` is supported. You used: \`${usedImportStatement}\``;
            throw path.buildCodeFrameError(msg);
          }

          state.importId = state.importId || path.scope.generateUidIdentifierBasedOnNode(path.node.id);
          path.scope.rename(first.local.name, state.importId.name);
          path.remove();
        }
      },

      TaggedTemplateExpression(path, state) {
        if (!state.importId) { return; }

        let tagPath = path.get('tag');
        if (tagPath.node.name !== state.importId.name) {
          return;
        }

        if (path.node.quasi.expressions.length) {
          throw path.buildCodeFrameError("placeholders inside a tagged template string are not supported");
        }

        let template = path.node.quasi.quasis.map(quasi => quasi.value.cooked).join('');

        path.replaceWithSourceString(compileTemplate(state.opts.precompile, template));
      },

      CallExpression(path, state) {
        if (!state.importId) { return; }

        let calleePath = path.get('callee');
        if (calleePath.node.name !== state.importId.name) {
          return;
        }

        let options;

        let template = path.node.arguments[0];
        if (template === undefined || typeof template.value !== "string") {
          throw path.buildCodeFrameError("hbs should be invoked with at least a single argument: the template string");
        }

        switch (path.node.arguments.length) {
          case 0:
            throw path.buildCodeFrameError("hbs should be invoked with at least a single argument: the template string");
          case 1:
            break;
          case 2: {
            let astOptions = path.node.arguments[1];
            if (astOptions.type !== "ObjectExpression") {
              throw path.buildCodeFrameError("hbs can only be invoked with 2 arguments: the template string, and any static options");
            }

            options = parseObjectExpression(path.buildCodeFrameError.bind(path), astOptions);

            break;
          }
          default:
            throw path.buildCodeFrameError("hbs can only be invoked with 2 arguments: the template string, and any static options");
        }

        let { precompile } = state.opts;

        path.replaceWithSourceString(compileTemplate(precompile, template.value, options));
      },
    }
  };
};

module.exports._parallelBabel = {
  requireFile: __filename
};

module.exports.baseDir = function() {
  return __dirname;
};
