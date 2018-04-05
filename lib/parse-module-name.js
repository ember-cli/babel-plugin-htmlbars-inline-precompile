'use strict';

module.exports = function (filename) {
  const parts = filename.split('/');

  // remove application name
  parts.splice(0, 1);

  const componentsIndex = parts.indexOf('-components');

  if (componentsIndex > 0) {
    parts.splice(componentsIndex);
  } else if (parts[2] === 'components' && parts.length > 5) {
    parts.splice(parts.length - 2);
  } else {
    return null
  }

  parts.push('template');

  return parts.join('/') + '.hbs';
}
