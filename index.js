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
          if (t.isImportDefaultSpecifier(first)) {
            state.hbsImportSpecifier = first.local.name;
          } else {
            var input = state.file.code;
            var usedImportStatement = input.slice(node.start, node.end);
            var msg = "Only `import hbs from 'htmlbars-inline-precompile'` is supported. You used: `" + usedImportStatement + "`";
            throw path.buildCodeFrameError(msg);
          }

          state.hbsImports.push(path);
        }
      },

      CallExpression: function(path, state) {
        var node = path.node;
        if (t.isIdentifier(node.callee, { name: state.hbsImportSpecifier })) {
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
        if (t.isIdentifier(node.tag, { name: state.hbsImportSpecifier })) {
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

function replaceNodeWithPrecompiledTemplate(precompile, path, template) {
  var compiledTemplateString = "Ember.HTMLBars.template(" + precompile(template) + ")";

  path.replaceWithSourceString(compiledTemplateString);
}
