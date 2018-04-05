'use strict';

module.exports = function (filename) {
  const parts = filename.split('/');

  // remove application name
  parts.splice(0, 1);

  const componentsIndex = parts.indexOf('-components');

  parts.splice(componentsIndex);

  return parts.join('/') + '.hbs';
}
