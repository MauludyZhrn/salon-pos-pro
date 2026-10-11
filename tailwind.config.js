/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        bg: "#0F0F12",
        surface: "#17171C",
        surfaceAlt: "#1F1F26",
        border: "#2A2A33",
        primary: "#C9A24B",
        primaryMuted: "#8A702F",
        accent: "#5B8C73",
        danger: "#C25B4A",
        warn: "#D6A24C",
        textPrimary: "#F4F3EF",
        textSecondary: "#A6A5AD",
        textMuted: "#6B6A74",
      },
      fontFamily: {
        display: ["PlayfairDisplay_600SemiBold"],
        sans: ["Inter_400Regular"],
        "sans-medium": ["Inter_500Medium"],
        "sans-semibold": ["Inter_600SemiBold"],
      },
      borderRadius: {
        xl2: "20px",
      },
    },
  },
  plugins: [],
};
