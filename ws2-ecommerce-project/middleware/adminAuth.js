// middleware/adminAuth.js
function isAdmin(req, res, next) {
  // Check if user is logged in
  if (!req.session || !req.session.user) {
    return res.status(401).send("You must be logged in to access this page.");
  }

  // Check if user has admin role
  if (req.session.user.role !== "admin") {
    return res.status(403).send("Access denied. Admin privileges required.");
  }

  // User is admin, proceed
  next();
}

module.exports = isAdmin;