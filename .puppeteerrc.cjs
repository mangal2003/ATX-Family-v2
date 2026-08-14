// .puppeteerrc.cjs
const { join } = require("path");

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Store chrome directly inside the project root so Render preserves it
  cacheDirectory: join(__dirname, ".cache", "puppeteer"),
};
