/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './content/**/*.{html,md}',
    './layouts/**/*.html',
    './themes/careercanvas/layouts/**/*.html',
    './themes/careercanvas/assets/**/*.{js,css}',
  ],
  darkMode: 'class',
  theme: {
    extend: {},
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};
