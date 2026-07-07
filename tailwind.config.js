module.exports = {
  darkMode: 'class',
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}', './routes/**/*.{js,jsx}', './providers/**/*.{js,jsx}', './store/**/*.{js,jsx}', './services/**/*.{js,jsx}', './data/**/*.{js,jsx}', './utils/**/*.{js,jsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#8cc63e',
      },
      spacing: {
        'container-margin': '1rem',
        gutter: '1rem',
        'section-gap': '1.5rem',
        'card-padding': '1.25rem',
        'drawer-width': '80%',
      },
    },
  },
  plugins: [],
};
