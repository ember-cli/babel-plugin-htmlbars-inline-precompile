module.exports = function(precompile) {
  return function(babel) {
    var t = babel.types;

    return new babel.Transformer('htmlbars-inline-precompile', {
      ImportDeclaration: function(node, parent, scope, state) {
        if (t.isLiteral(node.source, { value: "htmlbars-inline-precompile" })) {
          var first = node.specifiers && node.specifiers[0];
          if (t.isImportDefaultSpecifier(first)) {
            state.importSpecifier = first.local.name;
          } else {
            // TODO how to get the full import statement here?
            var usedImportStatement = "TODO";
            var msg = "Only `import hbs from 'htmlbars-inline-precompile'` is supported. You used: " + usedImportStatement;
            throw state.errorWithNode(node, msg);
          }

          this.remove();
        }
      },

      TaggedTemplateExpression: function(node, parent, scope, state) {
        if (t.isIdentifier(node.tag, { name: state.importSpecifier })) {
          var template = node.quasi.quasis.map(function(quasi) {
            return quasi.value.cooked;
          }).join("");

          return "Ember.HTMLBars.template(" + precompile(template) + ")";
        }
      }
    });
  }
};
