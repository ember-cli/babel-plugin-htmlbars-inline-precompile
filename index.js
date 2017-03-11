'use strict';

module.exports = function(babel) {
  let t = babel.types;

  return {
    visitor: {
      Program: {
        enter: function(path, state) {
          state.hbsImports = [];
        },
        exit: function(path, state) {
          state.hbsImports.forEach(function(path) {
            path.remove();
          });
        },
      },

      ImportDeclaration: function(path, state) {
        let node = path.node;
        if (t.isLiteral(node.source, { value: "htmlbars-inline-precompile" })) {
          let first = node.specifiers && node.specifiers[0];
          if (!t.isImportDefaultSpecifier(first)) {
            let input = state.file.code;
            let usedImportStatement = input.slice(node.start, node.end);
            let msg = `Only \`import hbs from 'htmlbars-inline-precompile'\` is supported. You used: \`${usedImportStatement}\``;
            throw path.buildCodeFrameError(msg);
          }

          state.hbsImports.push(path);
        }
      },

      TaggedTemplateExpression(path, state) {
        let tagPath = path.get('tag');
        if (!tagPath.referencesImport('htmlbars-inline-precompile', 'default')) {
          return;
        }

        if (path.node.quasi.expressions.length) {
          throw path.buildCodeFrameError("placeholders inside a tagged template string are not supported");
        }

        let template = path.node.quasi.quasis.map(quasi => quasi.value.cooked).join('');
        let compiledTemplateString = `Ember.HTMLBars.template(${state.opts.precompile(template)})`;

        path.replaceWithSourceString(compiledTemplateString);
      },

      CallExpression(path, state) {
        let calleePath = path.get('callee');
        if (!calleePath.referencesImport('htmlbars-inline-precompile', 'default')) {
          return;
        }

        let argumentErrorMsg = "hbs should be invoked with a single argument: the template string";
        if (path.node.arguments.length !== 1) {
          throw path.buildCodeFrameError(argumentErrorMsg);
        }

        let template = path.node.arguments[0].value;
        if (typeof template !== "string") {
          throw path.buildCodeFrameError(argumentErrorMsg);
        }

        let compiledTemplateString = `Ember.HTMLBars.template(${state.opts.precompile(template)})`;

        path.replaceWithSourceString(compiledTemplateString);
      },
    }
  };
};

module.exports.baseDir = function() { return __dirname; };
