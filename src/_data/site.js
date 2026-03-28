const templateConfig = require('../../shared/template-config');

module.exports = {
  ...templateConfig.site,
  booking: templateConfig.booking,
  copy: templateConfig.copy,
  year: new Date().getFullYear()
};
