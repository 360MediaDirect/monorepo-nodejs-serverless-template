const version = require('./version').version

function buildResponse(statusCode, body) {
  return {
    statusCode: statusCode,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true
    },
    body: JSON.stringify(body)
  }
}

exports.versionHandler = function versionHandler(_event, _context) {
  return Promise.resolve(buildResponse(200, { version }))
}
