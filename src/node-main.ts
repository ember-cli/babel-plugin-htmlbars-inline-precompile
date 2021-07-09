import { resolve } from 'path';
import htmlbarsInlinePrecompile from './plugin';

(htmlbarsInlinePrecompile as any)._parallelBabel = {
  requireFile: __filename,
};

(htmlbarsInlinePrecompile as any).baseDir = function () {
  return resolve(__dirname, '..');
};

export default htmlbarsInlinePrecompile;
export { Options } from './plugin';
