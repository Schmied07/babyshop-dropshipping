module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  theme: {
    extend: {
      colors: {
        border: "#E4E4E7",
        input: "#E4E4E7",
        ring: "#002FA7",
        background: "#F4F4F5",
        foreground: "#09090B",
        primary: {
          DEFAULT: "#002FA7",
          hover: "#002280",
          foreground: "#FFFFFF",
        },
        panel: "#FFFFFF",
        sidebar: "#09090B",
        muted: {
          DEFAULT: "#FAFAFA",
          foreground: "#71717A",
        },
        accent: {
          DEFAULT: "#FF2A2A",
          foreground: "#FFFFFF",
        },
        success: "#00A86B",
        warning: "#FFC800",
        critical: "#FF2A2A",
      },
      fontFamily: {
        heading: ["Cabinet Grotesk", "system-ui", "sans-serif"],
        body: ["Satoshi", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"],
      },
      borderRadius: {
        sm: "2px",
        DEFAULT: "4px",
        md: "4px",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
