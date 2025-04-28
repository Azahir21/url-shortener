const express = require("express");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const ShortUrl = require("./model/shortUrl");
const User = require("./model/user");
const { isAuthenticated, generateToken } = require("./middleware/auth");
const jwt = require("jsonwebtoken");
const config = require("./config/config");
const app = express();

// Load environment variables
require("dotenv").config();

// Setup MongoDB connection
mongoose
  .connect(config.db.uri)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Setup Express middleware
app.set("view engine", "ejs");
app.use(express.json({ limit: '10mb' })); // Parse JSON bodies first
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // Parse URL-encoded bodies
app.use(cookieParser());
app.use(express.static("public")); // Serve static files from public directory

// Add CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Auth status endpoint
app.get("/api/auth/status", async (req, res) => {
  try {
    const token = req.cookies.token;
    
    if (!token) {
      return res.json({ authenticated: false });
    }

    const decoded = jwt.verify(token, process.env.TOKEN_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.json({ authenticated: false });
    }

    res.json({
      authenticated: true,
      username: user.username
    });
  } catch (error) {
    console.error('Auth status error:', error);
    res.json({ authenticated: false });
  }
});

// Get user's short URLs
app.get("/api/shortUrls", isAuthenticated, async (req, res) => {
  try {
    const shortUrls = await ShortUrl.find({ user: req.user._id })
      .sort({ createdAt: -1 });
    
    res.json({ shortUrls });
  } catch (error) {
    console.error('Error fetching URLs:', error);
    res.status(500).json({ error: 'Failed to fetch URLs' });
  }
});

// Handle server health check (for Vercel)
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// Session reset route
app.get("/reset-session", (req, res) => {
  res.clearCookie("token", config.auth.cookieOptions);
  res.redirect("/login?reset=true");
});

// Login routes
app.get("/login", (req, res) => {
  res.sendFile(__dirname + "/public/login.html");
});

app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    const user = await User.findOne({ username });

    if (!user || !(await user.isValidPassword(password))) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    // Generate JWT token
    const token = generateToken(user._id);

    // Set cookie with the token
    res.cookie("token", token, config.auth.cookieOptions);

    res.json({ success: true, redirect: "/dashboard.html" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "An error occurred during login" });
  }
});

// Logout route
app.get("/logout", (req, res) => {
  res.clearCookie("token", config.auth.cookieOptions);
  res.redirect("/login");
});

app.get("/register", (req, res) => {
  res.sendFile(__dirname + "/public/register.html");
});

app.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Check if username or email already exists
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      return res.status(400).json({ error: "Username or email already exists" });
    }

    // Create new user
    const user = await User.create({ username, email, password });

    // Generate token and log in the user
    const token = generateToken(user._id);
    res.cookie("token", token, config.auth.cookieOptions);

    res.json({ success: true, redirect: "/dashboard.html" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "An error occurred during registration" });
  }
});

// Protected routes
app.get("/", async (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

app.get("/dashboard.html", isAuthenticated, async (req, res) => {
  res.sendFile(__dirname + "/public/dashboard.html");
});

app.get("/dashboard", isAuthenticated, async (req, res) => {
  res.redirect("/dashboard.html");
});

app.post("/shortUrls", isAuthenticated, async (req, res) => {
  try {

    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: "Invalid request body" });
    }

    const { fullUrl, useCustomLink, customLink } = req.body;

    if (!fullUrl) {
      return res.status(400).json({ error: "URL is required" });
    }

    // First, validate the full URL
    let validFullUrl;
    try {
      validFullUrl = new URL(fullUrl);
    } catch (e) {
      return res.status(400).json({ error: "Please enter a valid URL including http:// or https://." });
    }

    // Custom link handling
    let shortUrl;

    // If user chose to use a custom link
    if (useCustomLink && customLink) {
      // Validate custom link format (only alphanumeric and hyphens)
      const customLinkRegex = /^[a-zA-Z0-9-]+$/;
      if (!customLinkRegex.test(customLink)) {
        return res.status(400).json({ error: "Custom link can only contain letters, numbers, and hyphens." });
      }

      // Define protected routes that cannot be used as custom short URLs
      const protectedPaths = [
        "login", "logout", "register", "dashboard", "admin", "api", "shortUrls",
        "edit", "update", "toggle-active", "user", "profile", "account", "settings",
        "password", "reset", "verify", "confirm", "auth", "oauth", "static", "assets",
        "css", "js", "img", "images", "favicon", "robots.txt", "sitemap", "404", "500", "error"
      ];

      // Check if the custom link matches any protected route
      const lowerCustomLink = customLink.toLowerCase();
      if (protectedPaths.includes(lowerCustomLink) || 
          protectedPaths.some(path => lowerCustomLink.startsWith(path + "/")) || 
          lowerCustomLink.startsWith("api/") || 
          lowerCustomLink.startsWith("admin/")) {
        return res.status(400).json({ error: "This custom link is already taken. Please choose another one." });
      }

      // Check if the custom link already exists
      const existingUrl = await ShortUrl.findOne({ short: customLink });
      if (existingUrl) {
        return res.status(400).json({ error: "This custom link is already taken. Please choose another one." });
      }

      // Create with custom short link
      shortUrl = await ShortUrl.create({
        full: fullUrl,
        short: customLink,
        user: req.user._id,
        isCustom: true
      });
    } else {
      // Create with auto-generated short link
      shortUrl = await ShortUrl.create({
        full: fullUrl,
        user: req.user._id,
        isCustom: false
      });
    }

    res.status(201).json({ success: true, shortUrl });
  } catch (error) {
    console.error('Error in /shortUrls route:', error);
    res.status(500).json({ error: "Error creating shortened URL" });
  }
});

app.post("/update/:id", isAuthenticated, async (req, res) => {
  try {
    const { fullUrl, short, active } = req.body;
    const urlId = req.params.id;

    // Find the URL belonging to this user
    const shortUrl = await ShortUrl.findOne({
      _id: urlId,
      user: req.user._id,
    });

    if (!shortUrl) {
      return res.status(404).json({
        success: false,
        error: "URL not found",
      });
    }

    // Check if the short URL is being changed
    if (short !== shortUrl.short) {
      // Validate custom link format (only alphanumeric and hyphens)
      const customLinkRegex = /^[a-zA-Z0-9-]+$/;
      if (!customLinkRegex.test(short)) {
        return res.status(400).json({
          success: false,
          error: "Custom link can only contain letters, numbers, and hyphens.",
        });
      }

      // Define protected routes that cannot be used as custom short URLs
      const protectedPaths = [
        "login",
        "logout",
        "register",
        "dashboard",
        "admin",
        "api",
        "shortUrls",
        "edit",
        "update",
        "toggle-active",
        "user",
        "profile",
        "account",
        "settings",
        "password",
        "reset",
        "verify",
        "confirm",
        "auth",
        "oauth",
        "static",
        "assets",
        "css",
        "js",
        "img",
        "images",
        "favicon",
        "robots.txt",
        "sitemap",
        "404",
        "500",
        "error",
      ];

      // Check if the custom link matches any protected route
      const lowerShort = short.toLowerCase();
      if (protectedPaths.includes(lowerShort) || protectedPaths.some((path) => lowerShort.startsWith(path + "/")) || lowerShort.startsWith("api/") || lowerShort.startsWith("admin/")) {
        return res.status(400).json({
          success: false,
          error: "This custom link is already taken. Please choose another one.",
        });
      }

      // Check if the new short URL already exists
      const existingUrl = await ShortUrl.findOne({
        short: short,
        _id: { $ne: urlId }, // Exclude the current URL
      });

      if (existingUrl) {
        return res.status(400).json({
          success: false,
          error: "This custom link is already taken. Please choose another one.",
        });
      }

      // Update the short URL
      shortUrl.short = short;
      shortUrl.isCustom = true;
    }

    // Update the full URL
    shortUrl.full = fullUrl;

    // Update active status
    shortUrl.active = active;

    await shortUrl.save();

    res.json({
      success: true,
      message: "URL updated successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: "Server error",
    });
  }
});

// Toggle URL active status
app.post("/toggle-active/:id", isAuthenticated, async (req, res) => {
  try {
    const shortUrl = await ShortUrl.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!shortUrl) {
      return res.status(404).json({ success: false, message: "URL not found" });
    }

    shortUrl.active = !shortUrl.active;
    await shortUrl.save();

    res.json({ success: true, active: shortUrl.active });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Update the URL redirection route (simplify it by removing analytics)
app.get("/:shortUrl", async (req, res) => {
  try {
    const shortUrl = await ShortUrl.findOne({ short: req.params.shortUrl });
    if (!shortUrl) {
      return res.status(404).render("404");
    }

    // Check if the URL is active
    if (!shortUrl.active) {
      return res.status(404).render("404", { message: "This link has been deactivated" });
    }

    // Increment click counter
    shortUrl.clicks = (shortUrl.clicks || 0) + 1;
    await shortUrl.save();

    res.redirect(shortUrl.full);
  } catch (error) {
    console.error("Redirection error:", error);
    res.status(500).send("Server error");
  }
});

// 404 handler - must be last route
app.use((req, res) => {
  res.status(404).render("404");
});

// For Vercel, export the Express app
module.exports = app;

// Only listen directly when not on Vercel
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}
