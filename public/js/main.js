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

  // 6. AUTO-SLIDING PROFILE SHOWCASE REEL
  const profileSlides = document.querySelectorAll(".profile-showcase-card");
  const profileDots = document.querySelectorAll(".p-dot");
  const profileWrapper = document.getElementById("profileCarousel");
  let currentProfileIndex = 0;
  let profileTimer = null;

  function showProfileSlide(index) {
    if (!profileSlides.length) return;

    if (index >= profileSlides.length) currentProfileIndex = 0;
    else if (index < 0) currentProfileIndex = profileSlides.length - 1;
    else currentProfileIndex = index;

    profileSlides.forEach((slide, i) => {
      slide.classList.toggle("active", i === currentProfileIndex);
    });

    profileDots.forEach((dot, i) => {
      dot.classList.toggle("active", i === currentProfileIndex);
    });
  }

  function startProfileAutoplay() {
    stopProfileAutoplay();
    if (profileSlides.length > 1) {
      profileTimer = setInterval(() => {
        showProfileSlide(currentProfileIndex + 1);
      }, 4500); // Transitions smoothly every 4.5 seconds
    }
  }

  function stopProfileAutoplay() {
    if (profileTimer) clearInterval(profileTimer);
  }

  profileDots.forEach((dot, i) => {
    dot.addEventListener("click", () => {
      stopProfileAutoplay();
      showProfileSlide(i);
      startProfileAutoplay();
    });
  });

  // Touch Swipe Support for Mobile
  if (profileWrapper) {
    let touchStartX = 0;
    let touchEndX = 0;

    profileWrapper.addEventListener(
      "touchstart",
      (e) => {
        touchStartX = e.changedTouches[0].screenX;
        stopProfileAutoplay();
      },
      { passive: true },
    );

    profileWrapper.addEventListener(
      "touchend",
      (e) => {
        touchEndX = e.changedTouches[0].screenX;
        if (touchStartX - touchEndX > 40) {
          showProfileSlide(currentProfileIndex + 1); // Swipe left
        } else if (touchEndX - touchStartX > 40) {
          showProfileSlide(currentProfileIndex - 1); // Swipe right
        }
        startProfileAutoplay();
      },
      { passive: true },
    );
  }

  startProfileAutoplay();
});
