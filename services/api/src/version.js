//
// NOTE:
// This file will be overwritten during build so that it exports the
// package.json version concatenated with the abbreviated git SHA of HEAD
//

const pkg = require('../package.json')

exports.version = pkg.version
