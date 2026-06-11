module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
    // Fluid scaling: convert px → rem in the generated CSS so the whole UI
    // scales with the root font-size (which is viewport-fluid in globals.css).
    // Scoped to sizing + typography ONLY — never borders, shadows, positioning,
    // or media-query breakpoints, which must stay in px to render crisply and
    // keep responsive breakpoints firing at real widths.
    "postcss-pxtorem": {
      rootValue: 16,
      unitPrecision: 5,
      propList: [
        "font-size", "line-height", "letter-spacing", "word-spacing",
        "width", "min-width", "max-width",
        "height", "min-height", "max-height",
        "padding", "padding-top", "padding-right", "padding-bottom", "padding-left",
        "margin", "margin-top", "margin-right", "margin-bottom", "margin-left",
        "gap", "row-gap", "column-gap", "border-radius", "flex-basis",
      ],
      selectorBlackList: ["html", ":root"],
      replace: true,
      mediaQuery: false,
      minPixelValue: 2,
    },
  },
};
