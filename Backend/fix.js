const fs = require('fs');
let content = fs.readFileSync('utils/validator.js', 'utf8');
const oldStr = ".matches(/^\\\\+?[0-9\\\\-\\\\s]{8,20}$/).withMessage('Nomor telepon harus 8-20 digit (boleh dengan + atau -)'),";
const newStr = ".matches(/^\\+?[0-9\\-\\s]{8,20}$/).withMessage('Nomor telepon harus 8-20 digit (boleh dengan + atau -)'),";
content = content.split(oldStr).join(newStr);
fs.writeFileSync('utils/validator.js', content);
