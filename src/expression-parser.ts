import type { NodePath } from '@babel/traverse';
import type * as Babel from '@babel/core';
import type { types as t } from '@babel/core';

export class ExpressionParser {
  constructor(private babel: typeof Babel) {}

  parseExpression(invokedName: string, path: NodePath<t.Expression>): unknown {
    switch (path.node.type) {
      case 'ObjectExpression':
        return this.parseObjectExpression(invokedName, path as NodePath<t.ObjectExpression>);
      case 'ArrayExpression': {
        return this.parseArrayExpression(invokedName, path as NodePath<t.ArrayExpression>);
      }
      case 'StringLiteral':
      case 'BooleanLiteral':
      case 'NumericLiteral':
        return path.node.value;
      default:
        throw path.buildCodeFrameError(
          `${invokedName} can only accept static options but you passed ${JSON.stringify(
            path.node
          )}`
        );
    }
  }

  parseArrayExpression(invokedName: string, path: NodePath<t.ArrayExpression>) {
    return path.get('elements').map((element) => {
      if (element.isSpreadElement()) {
        throw element.buildCodeFrameError(`spread element is not allowed here`);
      } else if (element.isExpression()) {
        return this.parseExpression(invokedName, element);
      }
    });
  }

  parseScope(invokedName: string, path: NodePath<t.ObjectProperty | t.ObjectMethod>) {
    let body: t.BlockStatement | t.Expression | undefined = undefined;

    if (path.node.type === 'ObjectMethod') {
      body = path.node.body;
    } else {
      let { value } = path.node;
      if (this.t.isObjectExpression(value)) {
        throw path.buildCodeFrameError(
          `Passing an object as the \`scope\` property to inline templates is no longer supported. Please pass a function that returns an object expression instead.`
        );
      }
      if (this.t.isFunctionExpression(value) || this.t.isArrowFunctionExpression(value)) {
        body = value.body;
      }
    }

    let objExpression: t.Expression | undefined | null = undefined;

    if (body?.type === 'ObjectExpression') {
      objExpression = body;
    } else if (body?.type === 'BlockStatement') {
      let returnStatement = body.body[0];

      if (body.body.length !== 1 || returnStatement.type !== 'ReturnStatement') {
        throw new Error(
          'Scope functions can only consist of a single return statement which returns an object expression containing references to in-scope values'
        );
      }

      objExpression = returnStatement.argument;
    }

    if (objExpression?.type !== 'ObjectExpression') {
      throw path.buildCodeFrameError(
        `Scope objects for \`${invokedName}\` must be an object expression containing only references to in-scope values, or a function that returns an object expression containing only references to in-scope values`
      );
    }

    return objExpression.properties.map((prop) => {
      if (this.t.isSpreadElement(prop)) {
        throw path.buildCodeFrameError(
          `Scope objects for \`${invokedName}\` may not contain spread elements`
        );
      }
      if (this.t.isObjectMethod(prop)) {
        throw path.buildCodeFrameError(
          `Scope objects for \`${invokedName}\` may not contain methods`
        );
      }

      let { key, value } = prop;
      if (!this.t.isStringLiteral(key) && !this.t.isIdentifier(key)) {
        throw path.buildCodeFrameError(
          `Scope objects for \`${invokedName}\` may only contain static property names`
        );
      }

      let propName = name(key);

      if (value.type !== 'Identifier' || value.name !== propName) {
        throw path.buildCodeFrameError(
          `Scope objects for \`${invokedName}\` may only contain direct references to in-scope values, e.g. { ${propName} } or { ${propName}: ${propName} }`
        );
      }

      return propName;
    });
  }

  parseObjectExpression(
    invokedName: string,
    path: NodePath<t.ObjectExpression>,
    shouldParseScope = false
  ) {
    let result: Record<string, unknown> = {};

    path.get('properties').forEach((property) => {
      let { node } = property;
      if (this.t.isSpreadElement(node)) {
        throw property.buildCodeFrameError(`${invokedName} does not allow spread element`);
      }

      if (node.computed) {
        throw property.buildCodeFrameError(`${invokedName} can only accept static property names`);
      }

      let { key } = node;
      if (!this.t.isIdentifier(key) && !this.t.isStringLiteral(key)) {
        throw property.buildCodeFrameError(`${invokedName} can only accept static property names`);
      }

      let propertyName = name(key);

      if (shouldParseScope && propertyName === 'scope') {
        result.locals = this.parseScope(invokedName, property as NodePath<typeof node>);
      } else {
        if (this.t.isObjectMethod(node)) {
          throw property.buildCodeFrameError(
            `${invokedName} does not accept a method for ${propertyName}`
          );
        }
        let valuePath = (property as NodePath<typeof node>).get('value');
        if (!valuePath.isExpression()) {
          throw valuePath.buildCodeFrameError(`must be an expression`);
        }
        result[propertyName] = this.parseExpression(invokedName, valuePath);
      }
    });

    return result;
  }

  private get t() {
    return this.babel.types;
  }
}

function name(node: t.StringLiteral | t.Identifier): string {
  if (node.type === 'StringLiteral') {
    return node.value;
  } else {
    return node.name;
  }
}
