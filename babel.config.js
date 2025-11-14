module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Handle import.meta for web builds
      [
        'transform-define',
        {
          'import.meta.env': {
            NODE_ENV: process.env.NODE_ENV || 'development',
          },
        },
      ],
      // Add support for static class blocks
      '@babel/plugin-transform-class-static-block'
    ],
  };
};