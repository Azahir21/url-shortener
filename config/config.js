require("dotenv").config();

const config = {
  // Application settings
  app: {
    port: process.env.PORT || 5000,
    environment: process.env.NODE_ENV || "development",
  },

  // Database settings
  db: {
    uri: process.env.MONGODB_URI || "mongodb://localhost:27017/url-shortener",
  },

  // Authentication settings
  auth: {
    jwtSecret: process.env.JWT_SECRET || "5c4230b128255ff18a774565347596cd8fddcdd6a6b33ff202dd2daab56d4813",
    tokenExpiry: "7d",
    cookieOptions: {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    },
  },

  // URL settings
  urls: {
    baseUrl: process.env.BASE_URL || "http://localhost:5000",
    protectedPaths: [
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
    ],
  },
};

module.exports = config;
