/**
 * This template is a production ready boilerplate for developing with `PlaywrightCrawler`.
 * Use this to bootstrap your projects using the most up-to-date code.
 * If you're looking for examples or want to learn more, see README.
 */

// For more information, see https://docs.apify.com/sdk/js
import { Actor } from "apify";
import { launchOptions as camoufoxLaunchOptions } from "camoufox-js";
// For more information, see https://crawlee.dev
import { PlaywrightCrawler } from "crawlee";
import { firefox } from "playwright";

// this is ESM project, and as such, it requires you to specify extensions in your relative imports
// read more about this here: https://nodejs.org/docs/latest-v18.x/api/esm.html#mandatory-file-extensions
import { router } from "./routes.js";

// Initialize the Apify SDK
await Actor.init();

const { startUrls, slowMode = true } = (await Actor.getInput()) ?? {};

if (!startUrls || startUrls.length === 0) {
  throw new Error(
    "No start URLs provided. Please provide LinkedIn job listing URLs.",
  );
}

// Safety configuration based on mode
const safetyConfig = {
  maxRequestsPerMinute: slowMode ? 3 : 5,
  minDelay: slowMode ? 5000 : 3000,
  maxDelay: slowMode ? 15000 : 8000,
};

const proxyConfiguration = await Actor.createProxyConfiguration();

const crawler = new PlaywrightCrawler({
  proxyConfiguration,
  requestHandler: router,
  launchContext: {
    launcher: firefox,
    launchOptions: await camoufoxLaunchOptions({
      headless: true,
      proxy: await proxyConfiguration?.newUrl(),
      geoip: true,
      // Enhanced stealth options
      fonts: ["Arial", "Helvetica", "Times New Roman", "Georgia"],
      screen: {
        width: 1920,
        height: 1080,
      },
      locale: "en-US",
      timezone: "America/New_York",
      // Randomize browser fingerprint
      randomize: true,
      // Disable automation detection
      excludeSwitches: ["enable-automation"],
      ignoreDefaultArgs: ["--enable-blink-features=AutomationControlled"],
    }),
    // Use persistent context for cookies
    usePersistentContext: true,
  },
  maxRequestRetries: 2,
  requestHandlerTimeoutSecs: 120,
  // Human-like navigation
  navigationTimeoutSecs: 60,
  // Rate limiting - very conservative for LinkedIn
  maxRequestsPerMinute: safetyConfig.maxRequestsPerMinute,
  preNavigationHooks: [
    async () => {
      // Random delay before each request based on safety mode
      const delay =
        Math.floor(
          Math.random() * (safetyConfig.maxDelay - safetyConfig.minDelay + 1),
        ) + safetyConfig.minDelay;
      await new Promise((resolve) => {
        setTimeout(resolve, delay);
      });
    },
  ],
  // Post-navigation hooks for additional safety
  postNavigationHooks: [
    async ({ page }) => {
      // Remove webdriver property
      await page.addInitScript(() => {
        Object.defineProperty(navigator, "webdriver", {
          get: () => undefined,
        });
      });

      // Random delay after page load
      const delay = Math.floor(Math.random() * 3000) + 1000;
      await new Promise((resolve) => {
        setTimeout(resolve, delay);
      });
    },
  ],
});

await crawler.run(startUrls);

// Exit successfully
await Actor.exit();
