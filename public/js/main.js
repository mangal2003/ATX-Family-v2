document.addEventListener("DOMContentLoaded", () => {
  const themeSwitchers = document.querySelectorAll(".theme-switcher");
  const storedTheme = localStorage.getItem("atx_theme") || "cyber-dark";

  // 1. Apply active theme to document root
  function applyTheme(themeName) {
    document.documentElement.setAttribute("data-theme", themeName);
    if (themeName === "light-white") {
      document.body.classList.add("light-mode");
    } else {
      document.body.classList.remove("light-mode");
    }

    localStorage.setItem("atx_theme", themeName);

    // Sync all theme dropdown controls on page
    themeSwitchers.forEach((select) => {
      select.value = themeName;
    });
  }

  // 2. Initialize saved theme
  applyTheme(storedTheme);

  // 3. Listen to dropdown change events
  themeSwitchers.forEach((select) => {
    select.addEventListener("change", (e) => {
      applyTheme(e.target.value);
    });
  });

  // 4. Mobile Drawer Nav Toggle & Auto-Close on Outside Click
  const navToggle = document.getElementById("navToggle");
  const mobileDrawer = document.getElementById("mobileDrawer");

  if (navToggle && mobileDrawer) {
    // Toggle drawer when hamburger icon is clicked
    navToggle.addEventListener("click", (e) => {
      e.stopPropagation(); // Prevents click from bubbling to document
      mobileDrawer.classList.toggle("active");
    });

    // Prevent clicks inside the drawer (e.g. changing the theme) from closing it
    mobileDrawer.addEventListener("click", (e) => {
      e.stopPropagation();
    });

    // Auto-close when clicking outside anywhere on the document
    document.addEventListener("click", () => {
      if (mobileDrawer.classList.contains("active")) {
        mobileDrawer.classList.remove("active");
      }
    });

    // Close drawer when any navigation link inside it is clicked
    const drawerLinks = mobileDrawer.querySelectorAll(".drawer-item");
    drawerLinks.forEach((link) => {
      link.addEventListener("click", () => {
        mobileDrawer.classList.remove("active");
      });
    });
  }
});
