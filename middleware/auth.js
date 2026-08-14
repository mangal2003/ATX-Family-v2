// Ensure user is authenticated
function ensureAuth(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  req.flash("error_msg", "Please log in to access this page.");
  res.redirect("/auth/google");
}

// Ensure user has admin privileges
function ensureAdmin(req, res, next) {
  if (req.isAuthenticated() && req.user.role === "admin") {
    return next();
  }
  req.flash("error_msg", "Access denied. Administrator privileges required.");
  res.redirect("/");
}

module.exports = { ensureAuth, ensureAdmin };
