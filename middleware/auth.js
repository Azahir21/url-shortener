const jwt = require("jsonwebtoken");
const User = require("../model/user");
const config = require("../config/config");

// Generate token function
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, config.auth.jwtSecret, {
    expiresIn: config.auth.tokenExpiry,
  });
};

// Authentication middleware
const isAuthenticated = async (req, res, next) => {
  try {
    const token = req.cookies.token;

    if (!token) {
      return res.redirect("/login");
    }

    const decoded = jwt.verify(token, config.auth.jwtSecret);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.redirect("/login");
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Authentication error:", error);
    res.clearCookie("token", config.auth.cookieOptions);
    res.redirect("/login");
  }
};

module.exports = { isAuthenticated, generateToken };
