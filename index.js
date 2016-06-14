module.exports = function(babel) {
  var t = babel.types;

  var replaceNodeWithPrecompiledTemplate = function(precompile, path, template) {
    var compiledTemplateString = "Ember.HTMLBars.template(" + precompile(template) + ")";

    path.replaceWithSourceString(compiledTemplateString);
  };

  return {
    visitor: {
      ImportDeclaration: function(path, state) {
        var node = path.node;
        var file = state.file;
        if (t.isLiteral(node.source, { value: "htmlbars-inline-precompile" })) {
          var first = node.specifiers && node.specifiers[0];
          if (t.isImportDefaultSpecifier(first)) {
            file.importSpecifier = first.local.name;
          } else {
            var input = file.code;
            var usedImportStatement = input.slice(node.start, node.end);
            var msg = "Only `import hbs from 'htmlbars-inline-precompile'` is supported. You used: `" + usedImportStatement + "`";
            throw path.buildCodeFrameError(msg);
          }

          path.remove();
        }
      },

      CallExpression: function(path, state) {
        var node = path.node;
        var file = state.file;
        if (t.isIdentifier(node.callee, { name: file.importSpecifier })) {
          var argumentErrorMsg = "hbs should be invoked with a single argument: the template string";
          if (node.arguments.length !== 1) {
            throw path.buildCodeFrameError(argumentErrorMsg);
          }

          var template = node.arguments[0].value;
          if (typeof template !== "string") {
            throw path.buildCodeFrameError(argumentErrorMsg);
          }

          return replaceNodeWithPrecompiledTemplate(state.opts.precompile, path, template);
        }
      },

      TaggedTemplateExpression: function(path, state) {
        var node = path.node;
        var file = state.file;
        if (t.isIdentifier(node.tag, { name: file.importSpecifier })) {
          if (node.quasi.expressions.length) {
            throw path.buildCodeFrameError("placeholders inside a tagged template string are not supported");
          }

          var template = node.quasi.quasis.map(function(quasi) {
            return quasi.value.cooked;
          }).join("");

          return replaceNodeWithPrecompiledTemplate(state.opts.precompile, path, template);
        }
      }
    }
  };
};
