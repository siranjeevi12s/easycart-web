/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ["./index.html","./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#FF6B35", dark: "#E55A2B", light: "#FF8C61" },
        surface: "#FFF8F5"
      }
    }
  },
  plugins: []
}
