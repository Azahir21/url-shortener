const mongoose = require("mongoose");
const shortId = require("shortid");

// Create a click schema for analytics
const clickSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now,
  },
  referrer: String,
  userAgent: String,
  ip: String,
  browser: String,
  device: String,
  os: String,
});

const shortUrlSchema = new mongoose.Schema({
  full: {
    type: String,
    required: true,
  },
  short: {
    type: String,
    required: true,
    default: shortId.generate,
    unique: true, // Ensure short URLs are unique
  },
  clicks: {
    type: Number,
    required: true,
    default: 0,
  },
  // Add click analytics data
  clickData: [clickSchema],
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  isCustom: {
    type: Boolean,
    default: false,
  },
  active: {
    type: Boolean,
    default: true,
  },
});

// Update the updatedAt timestamp before saving
shortUrlSchema.pre("save", function (next) {
  if (this.isModified() && !this.isNew) {
    this.updatedAt = Date.now();
  }
  next();
});

module.exports = mongoose.model("ShortUrl", shortUrlSchema);
