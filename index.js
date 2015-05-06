module.exports = function(precompile) {
  return function(babel) {
    var t = babel.types;

    return new babel.Transformer('htmlbars-inline-precompile', {
      ImportDeclaration: function(node, parent, scope, file) {
        if (t.isLiteral(node.source, { value: "htmlbars-inline-precompile" })) {
          var first = node.specifiers && node.specifiers[0];
          if (t.isImportDefaultSpecifier(first)) {
            file.importSpecifier = first.local.name;
          } else {
            var input = file.code;
            var usedImportStatement = input.slice(node.start, node.end);
            var msg = "Only `import hbs from 'htmlbars-inline-precompile'` is supported. You used: `" + usedImportStatement + "`";
            throw file.errorWithNode(node, msg);
          }

          this.remove();
        }
      },

      TaggedTemplateExpression: function(node, parent, scope, file) {
        if (t.isIdentifier(node.tag, { name: file.importSpecifier })) {
          var template = node.quasi.quasis.map(function(quasi) {
            return quasi.value.cooked;
          }).join("");

          return "Ember.HTMLBars.template(" + precompile(template) + ")";
        }
      }
    });
  }
};
