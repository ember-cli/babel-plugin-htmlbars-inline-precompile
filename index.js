module.exports = function(babel) {
  var t = babel.types;

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
        var node = path.node;
        if (t.isLiteral(node.source, { value: "htmlbars-inline-precompile" })) {
          var first = node.specifiers && node.specifiers[0];
          if (!t.isImportDefaultSpecifier(first)) {
            var input = state.file.code;
            var usedImportStatement = input.slice(node.start, node.end);
            var msg = "Only `import hbs from 'htmlbars-inline-precompile'` is supported. You used: `" + usedImportStatement + "`";
            throw path.buildCodeFrameError(msg);
          }

          state.hbsImports.push(path);
        }
      },

      Identifier: function(path, state) {
        if (path.referencesImport('htmlbars-inline-precompile', 'default')) {
          var parent = path.parentPath;

          var template;
          if (parent.isCallExpression({ callee: path.node })) {
            var argumentErrorMsg = "hbs should be invoked with a single argument: the template string";
            if (parent.node.arguments.length !== 1) {
              throw parent.buildCodeFrameError(argumentErrorMsg);
            }

            template = parent.node.arguments[0].value;
            if (typeof template !== "string") {
              throw parent.buildCodeFrameError(argumentErrorMsg);
            }

          } else if (parent.isTaggedTemplateExpression({ tag: path.node })) {
            if (parent.node.quasi.expressions.length) {
              throw parent.buildCodeFrameError("placeholders inside a tagged template string are not supported");
            }

            template = parent.node.quasi.quasis.map(function(quasi) {
              return quasi.value.cooked;
            }).join("");

          } else {
            return;
          }

          var compiledTemplateString = "Ember.HTMLBars.template(" + state.opts.precompile(template) + ")";

          parent.replaceWithSourceString(compiledTemplateString);
        }
      },
    }
  };
};
