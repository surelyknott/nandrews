module.exports = function eleventyConfig(config) {
  config.addPassthroughCopy({ 'src/assets': 'assets' });
  config.addPassthroughCopy({ shared: 'shared' });
  config.addPassthroughCopy('robots.txt');
  config.addPassthroughCopy('sitemap.xml');

  return {
    dir: {
      input: 'src',
      includes: '_includes',
      data: '_data',
      output: 'dist'
    },
    markdownTemplateEngine: 'njk',
    htmlTemplateEngine: 'njk'
  };
};
