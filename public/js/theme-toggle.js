document.addEventListener("DOMContentLoaded", () => {
  const themeSelector = document.getElementById("themeSelector");
  const savedTheme = localStorage.getItem("atx_theme") || "cyber-dark";

  document.documentElement.setAttribute("data-theme", savedTheme);
  if (themeSelector) themeSelector.value = savedTheme;

  if (themeSelector) {
    themeSelector.addEventListener("change", (e) => {
      const selectedTheme = e.target.value;
      document.documentElement.setAttribute("data-theme", selectedTheme);
      localStorage.setItem("atx_theme", selectedTheme);
    });
  }
});
