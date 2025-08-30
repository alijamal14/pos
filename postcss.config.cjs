// postcss.config.cjs for Tailwind v4+ (CommonJS)
module.exports = {
  plugins: [
    require('@tailwindcss/postcss')(),
    require('autoprefixer'),
  ],
};
