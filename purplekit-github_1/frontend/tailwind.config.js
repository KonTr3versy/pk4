/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Custom colors if needed
        gray: {
          750: '#2d3748', // Between 700 and 800
          850: '#1a202c', // Between 800 and 900
          950: '#0d1117', // Darker than 900
        },
      },
    },
  },
  plugins: [],
}
