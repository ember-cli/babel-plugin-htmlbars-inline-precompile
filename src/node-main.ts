import { resolve } from 'path';
import makePlugin from './plugin';
import type * as Babel from '@babel/core';

import { Options as PluginOptions, EmberPrecompile } from './plugin';

export interface Options extends PluginOptions {
  // The on-disk path to a module that provides a `precompile` function as
  // defined below. You need to either set `precompilePath` or set `precompile`.
  precompilerPath?: string;

  // A precompile function that invokes Ember's template compiler.
  //
  // Options handling rules:
  //
  //  - we add `content`, which is the original string form of the template
  //  - we have special parsing for `scope` which becomes `locals` when passed
  //    to your precompile
  //  - anything else the user passes to `precompileTemplate` will be passed
  //    through to your `precompile`.
  precompile?: EmberPrecompile;
}

const htmlbarsInlinePrecompile = makePlugin(function (opts: Options) {
  if (opts.precompilerPath) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    let mod: any = require(opts.precompilerPath);
    return mod.precompile;
  } else if (opts.precompile) {
    return opts.precompile;
  }
}) as {
  (babel: typeof Babel): Babel.PluginObj<Options>;
  _parallelBabel: { requireFile: string };
  baseDir(): string;
};

htmlbarsInlinePrecompile._parallelBabel = {
  requireFile: __filename,
};

htmlbarsInlinePrecompile.baseDir = function () {
  return resolve(__dirname, '..');
};

export default htmlbarsInlinePrecompile;
