'use strict';

const parseModuleName = require('../lib/parse-module-name');

describe('parse-module-name helper', function() {
  it('should return applicaiton template when using a route local -component', function() {
    expect(parseModuleName('emberconf/src/ui/routes/application/-components/footer-prompt/component-test.js')).toEqual('src/ui/routes/application.hbs');
  })

  it('should return the parent component when using a component local component', function() {
    expect(parseModuleName('emberconf/src/ui/components/icon-emberconf/facey-face/component-test.js')).toEqual('src/ui/components/icon-emberconf/template.hbs');
  })
})
