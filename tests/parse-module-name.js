'use strict';

const parseModuleName = require('../lib/parse-module-name');

describe('parse-module-name helper', function() {
  it('should return application template when using a route local -component', function() {
    expect(
      parseModuleName('emberconf/src/ui/routes/application/-components/footer-prompt/component-test.js')
    ).toEqual('src/ui/routes/application/template.hbs');
  });

  it('should return the parent component when using a component local component', function() {
    expect(
      parseModuleName('emberconf/src/ui/components/icon-emberconf/facey-face/component-test.js')
    ).toEqual('src/ui/components/icon-emberconf/template.hbs');
  });

  it('should return the parent component when using a component local component in private collection', function() {
    expect(
      parseModuleName('emberconf/src/ui/routes/application/foo/-components/footer-prompt/component-test.js')
    ).toEqual('src/ui/routes/application/foo/template.hbs');
  });

  it('should return when using a route local -component with nested naming', function() {
    expect(
      parseModuleName('emberconf/src/ui/routes/application/-components/footer-prompt/foo/component-test.js')
    ).toEqual('src/ui/routes/application/-components/footer-prompt/template.hbs');
  });

  it('should return null for public components', function() {
    expect(
      parseModuleName('emberconf/src/ui/components/foo-bar/component-test.js')
    ).toEqual(null);
  });

  it('should return null for public components in test folder', function() {
    expect(
      parseModuleName('emberconf/tests/integration/components/foo-bar/component-test.js')
    ).toEqual(null);
  });
});
