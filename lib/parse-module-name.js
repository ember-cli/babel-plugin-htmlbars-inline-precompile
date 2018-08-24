'use strict';

module.exports = function (filename) {
  let parts = filename.split(/[/\\]/);

  // Drop the application name from the parts
  parts.shift();

  let lastPrivateCollectionIndex = parts.lastIndexOf('-components');

  if (lastPrivateCollectionIndex !== -1) {
    // TODO: We likely do not need new array allocations for the prefix and
    // collection parts

    // Take the prefix string
    let prefixString = parts.slice(0,lastPrivateCollectionIndex).join('/');

    // Take the rest of the string starting at -collectionName (including the -)
    let collectionParts = parts.slice(lastPrivateCollectionIndex);

    // In other cases we're not sure about the semantics in your templates.
    if (collectionParts.length > 3) {
      collectionParts.splice(-2);

      return `${prefixString}/${collectionParts.join('/')}/template.hbs`;
    } else if (collectionParts.length === 3) {
      return `${prefixString}/template.hbs`;
    }
  } else {
    let componentsIndex = parts.indexOf('components');

    // We don't process anything except components
    if (componentsIndex !== -1) {
      // If we don't have 3 segments left, then there is no change to perform.
      if (parts.length - componentsIndex > 3) {
        parts.splice(-2);
        return `${parts.join('/')}/template.hbs`;
      }
    }
  }

  return null;
}
