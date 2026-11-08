const path = require('path');
const { handler } = require(path.join(__dirname, '../../api-bundle/dist/lambda'));
exports.handler = handler;
