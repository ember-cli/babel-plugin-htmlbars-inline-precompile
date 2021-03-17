module.exports = {
  precompile(value) {
    return `precompiledFromPath(${value})`;
  },
};
