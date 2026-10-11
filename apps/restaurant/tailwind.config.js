/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ["./index.html","./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#F5C923", dark: "#E4B719", light: "#F9DE6B" },
        surface: "#FFFFFF"
      }
    }
  },
  plugins: []
}
