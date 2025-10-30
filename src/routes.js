import { createPlaywrightRouter, Dataset } from "crawlee";

export const router = createPlaywrightRouter();

// Helper function to validate company URLs
function isValidCompanyUrl(url) {
  if (!url || typeof url !== "string") return false;

  // Must be a LinkedIn company URL
  if (!url.includes("linkedin.com/company/")) return false;

  // Exclude job, post, and people URLs
  if (
    url.includes("/jobs/") ||
    url.includes("/posts/") ||
    url.includes("/people/")
  )
    return false;

  // Exclude search and filter URLs
  if (url.includes("?") && (url.includes("f_C=") || url.includes("f_T=")))
    return false;

  return true;
}

// Helper function to clean company URLs
function cleanCompanyUrl(url) {
  if (!url) return "";

  // Remove query parameters and fragments
  let cleanUrl = url.split("?")[0].split("#")[0];

  // Remove trailing slashes
  cleanUrl = cleanUrl.replace(/\/+$/, "");

  return cleanUrl;
}

router.addDefaultHandler(async ({ page, log, input }) => {
  const includeCompanyUrl = input?.includeCompanyUrl || false;
  const maxResults = input?.maxResults || 50;

  // Set random viewport size to vary fingerprint
  const viewports = [
    { width: 1920, height: 1080 },
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
    { width: 1536, height: 864 },
  ];
  const randomViewport =
    viewports[Math.floor(Math.random() * viewports.length)];
  await page.setViewportSize(randomViewport);

  // Random mouse movements to simulate human behavior
  await simulateHumanBehavior(page);

  // Wait for page to load with shorter timeout
  try {
    await page.waitForLoadState("domcontentloaded", { timeout: 15000 });
  } catch {
    // Continue even if timeout
  }
  await randomDelay(2000, 3000);

  // Try multiple selectors for job cards
  await autoScroll(page);

  // Extract job listings with multiple fallback selectors
  const jobs = await extractJobListings(page, includeCompanyUrl, maxResults);

  // If company URLs are requested, visit individual job pages to extract them
  log.info(
    `🔍 Debug: includeCompanyUrl = ${includeCompanyUrl}, jobs.length = ${jobs.length}`,
  );
  if (includeCompanyUrl && jobs.length > 0) {
    await extractCompanyUrlsFromJobPages(jobs, page, log);
  }

  if (jobs.length > 0) {
    await Dataset.pushData(jobs);
    const withCompanyUrls = jobs.filter((job) => job.companyUrl).length;
    log.info(
      `✅ Extracted ${jobs.length} jobs${includeCompanyUrl ? ` (${withCompanyUrls} with company URLs)` : ""}`,
    );
  } else {
    log.warning(
      "❌ No job listings found - LinkedIn may require authentication",
    );
  }

  // Random delay before closing
  await randomDelay(1000, 3000);
});

async function simulateHumanBehavior(page) {
  // Random mouse movements
  const viewport = page.viewportSize();
  for (let i = 0; i < 3; i++) {
    await page.mouse.move(
      Math.random() * viewport.width,
      Math.random() * viewport.height,
    );
    await randomDelay(100, 500);
  }
}

async function randomDelay(min, max) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  await new Promise((resolve) => {
    setTimeout(resolve, delay);
  });
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = Math.random() * 200 + 100; // Random scroll distance
      const timer = setInterval(
        () => {
          const { scrollHeight } = document.body;
          window.scrollBy(0, distance);
          totalHeight += distance;

          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        },
        Math.random() * 200 + 100,
      ); // Random scroll speed
    });
  });

  // Wait a bit for any lazy-loaded content
  await randomDelay(2000, 4000);
}

async function extractJobListings(page, _includeCompanyUrl, _maxResults) {
  return await page.evaluate(
    ({ includeCompanyUrl, maxResults }) => {
      const jobs = [];

      // Try multiple LinkedIn job card selectors (updated for 2024/2025 layout)
      const selectors = [
        "[data-occludable-job-id]",
        ".jobs-search__results-list .job-card-container",
        ".job-search-card",
        "[data-job-id]",
        ".base-card",
        ".job-card-list__title",
        // New 2024/2025 LinkedIn selectors
        ".jobs-search-results-list .job-card-container",
        ".job-search-card__contents",
        "[data-test-id*='job-card']",
        ".job-search-card__contents-wrapper",
        ".base-search-card",
        ".jobs-search-two-pane__job-card-container",
        ".job-card-container",
        ".job-card",
        // Fallback - any element with job data
        "[data-occludable-entity-urn]",
        "[data-control-name='job_card']",
      ];

      let jobCards = [];
      for (const selector of selectors) {
        jobCards = document.querySelectorAll(selector);
        if (jobCards.length > 0) break;
      }

      // Found job cards with selector
      log.info(
        `🔍 Debug: Found ${jobCards.length} job cards with selector: ${selectors.find((s) => document.querySelectorAll(s).length > 0) || "none"}`,
      );

      jobCards.forEach((card, index) => {
        // Stop if we've reached maxResults
        if (jobs.length >= maxResults) {
          return;
        }
        try {
          const jobId =
            card.getAttribute("data-occludable-job-id") ||
            card.getAttribute("data-job-id") ||
            `job_${index}`;

          // Try multiple title selectors (updated for 2024/2025)
          const titleElement =
            card.querySelector(".base-card__full-link") ||
            card.querySelector("h3 a") ||
            card.querySelector(".job-card-list__title") ||
            card.querySelector(".job-search-card__title") ||
            card.querySelector("a[data-control-name]") ||
            card.querySelector("h3") ||
            card.querySelector("a") ||
            card.querySelector(".job-card-container__link") ||
            card.querySelector(".base-search-card__title") ||
            card.querySelector("[data-test-id*='job-title']");

          // Try multiple company selectors (updated for 2024/2025)
          const companyElement =
            card.querySelector(".hidden-nested-link") ||
            card.querySelector(".job-search-card__subtitle-link") ||
            card.querySelector(".job-card-container__company-name") ||
            card.querySelector(".job-card-company-name") ||
            card.querySelector(
              "[data-field='experience-company-logo'] + span",
            ) ||
            card.querySelector(".job-card-container__company-name a") ||
            card.querySelector(".base-search-card__subtitle") ||
            card.querySelector("[data-test-id*='company-name']");

          // Try multiple location selectors (updated for 2024/2025)
          const locationElement =
            card.querySelector(".job-search-card__location") ||
            card.querySelector(".job-result-card__location") ||
            card.querySelector(".job-card-container__metadata-item") ||
            card.querySelector(".job-card-location") ||
            card.querySelector(".job-card-container__metadata-item") ||
            card.querySelector(".base-search-card__location") ||
            card.querySelector("[data-test-id*='location']");

          // Try multiple date selectors (updated for 2024/2025)
          const postedDateElement =
            card.querySelector(".job-search-card__listdate") ||
            card.querySelector("time") ||
            card.querySelector(".job-card-container__footer-job-time") ||
            card.querySelector(".job-card-container__time-posted") ||
            card.querySelector("[data-test-id*='posted-date']");

          // Try multiple link selectors (updated for 2024/2025)
          const linkElement =
            card.querySelector(".base-card__full-link") ||
            card.querySelector("h3 a") ||
            card.querySelector("a[data-control-name]") ||
            card.querySelector("a") ||
            card.querySelector(".job-card-container__link") ||
            card.querySelector(".base-search-card__title") ||
            card.querySelector("[data-test-id*='job-title'] a");

          // Extract company LinkedIn URL if requested
          let companyUrl = "";
          if (includeCompanyUrl) {
            // Enhanced selectors for company links in job cards
            const companySelectors = [
              // Primary selectors for company name links
              ".hidden-nested-link",
              ".job-search-card__subtitle-link",
              ".job-card-container__company-name a",
              ".job-card-company-name a",
              ".base-card__subtitle a",

              // Company logo links
              "a[data-field='experience-company-logo']",
              "[data-test-id*='company-logo'] a",
              "[data-test-id*='company-name'] a",

              // New LinkedIn layout selectors
              ".job-creator-module a",
              ".company-details-link",
              ".top-card-layout__card a[href*='/company/']",

              // Generic company link selectors
              "a[href*='/company/']",
              "a[aria-label*='company']",
              "a[aria-label*='Company']",

              // Fallback selectors
              companyElement?.querySelector("a"),
              "span[class*='company'] a",
              "div[class*='company'] a",
              "span[class*='Company'] a",
              "div[class*='Company'] a",
            ];

            // Try each selector to find company link
            for (const selector of companySelectors) {
              try {
                const element = card.querySelector(selector);
                if (element?.href) {
                  const { href } = element;
                  // Validate and clean the company URL
                  if (isValidCompanyUrl(href)) {
                    companyUrl = cleanCompanyUrl(href);
                    break;
                  }
                }
              } catch {
                // Continue with next selector on error
              }
            }

            // Additional approach: search all links in the card
            if (!companyUrl) {
              const allLinks = card.querySelectorAll("a");
              for (const link of allLinks) {
                if (link.href && isValidCompanyUrl(link.href)) {
                  companyUrl = cleanCompanyUrl(link.href);
                  break;
                }
              }
            }

            // Last resort: look for company name and find nearby links
            if (!companyUrl && companyElement) {
              const companyText = companyElement.textContent?.trim();
              if (companyText) {
                const { parentElement } = companyElement;
                if (parentElement) {
                  const nearbyLink = parentElement.querySelector(
                    "a[href*='/company/']",
                  );
                  if (nearbyLink?.href && isValidCompanyUrl(nearbyLink.href)) {
                    companyUrl = cleanCompanyUrl(nearbyLink.href);
                  }
                }
              }
            }
          }

          const title = titleElement?.textContent?.trim() || "";
          const company = companyElement?.textContent?.trim() || "";

          // Debug logging for job filtering
          log.info(
            `🔍 Debug: Job found - Title: "${title}", Company: "${company}"`,
          );

          // Temporarily remove title filtering to test extraction
          if (title) {
            const job = {
              id: jobId,
              title,
              company,
              location: locationElement?.textContent?.trim() || "",
              postedDate:
                postedDateElement?.textContent?.trim() ||
                postedDateElement?.getAttribute("datetime") ||
                "",
              url: linkElement?.href || "",
              scrapedAt: new Date().toISOString(),
            };

            // Add company URL if requested and found
            if (includeCompanyUrl && companyUrl) {
              job.companyUrl = companyUrl;
            }

            jobs.push(job);
          }
        } catch {
          // Error extracting job - continue with next
        }
      });

      // Successfully extracted jobs
      return jobs;
    },
    { includeCompanyUrl: _includeCompanyUrl, maxResults: _maxResults },
  );
}

async function extractCompanyUrlsFromJobPages(jobs, page, log) {
  // Process all jobs that don't have company URLs yet
  const jobsNeedingUrls = jobs.filter((job) => !job.companyUrl && job.url);
  log.info(
    `🔍 Extracting company URLs from ${jobsNeedingUrls.length} job pages...`,
  );
  log.info(`🔍 Debug: Total jobs available: ${jobs.length}`);

  for (let i = 0; i < jobsNeedingUrls.length; i++) {
    const job = jobsNeedingUrls[i];
    if (!job.url) {
      log.warning(`⚠️  No URL for job: ${job.title}`);
      continue;
    }

    try {
      log.info(
        `📄 Visiting job page ${i + 1}/${jobsNeedingUrls.length}: ${job.title}`,
      );

      // Navigate to job page
      await page.goto(job.url, {
        waitUntil: "domcontentloaded",
        timeout: 15000,
      });
      await randomDelay(2000, 4000);

      // Extract company URL from job detail page
      const companyUrl = await page.evaluate(() => {
        // Debug: Log page title and URL
        // eslint-disable-next-line no-console
        console.log("Debug: Page title:", document.title);
        // eslint-disable-next-line no-console
        console.log("Debug: Page URL:", window.location.href);

        // Comprehensive selectors for company links
        const selectors = [
          // Primary selectors
          'a[href*="/company/"]',
          '.top-card-layout__card a[href*="/company/"]',
          '.jobs-company__link[href*="/company/"]',
          '[data-field="company-details-link"]',
          '.ember-view a[href*="/company/"]',

          // Additional selectors for different LinkedIn layouts
          '.topcard__org-name-link[href*="/company/"]',
          '.job-details-company__link[href*="/company/"]',
          '.company-name-link[href*="/company/"]',
          '.org-nav-item a[href*="/company/"]',
          'div[data-test-id="entity-name"] a[href*="/company/"]',
          'span[aria-label*="Company"] a[href*="/company/"]',
          '.puppeteer_test_company_link[href*="/company/"]',

          // Fallback: any link containing /company/ in href
          'a[href*="linkedin.com/company/"]',
        ];

        // eslint-disable-next-line no-console
        console.log("Debug: Trying selectors...");

        // Try each selector
        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          // eslint-disable-next-line no-console
          console.log(
            `Debug: Selector "${selector}" found ${elements.length} elements`,
          );

          for (const element of elements) {
            // eslint-disable-next-line no-console
            console.log(`Debug: Element href: ${element.href}`);
            if (
              element &&
              element.href &&
              element.href.includes("linkedin.com/company/") &&
              !element.href.includes("/jobs/") &&
              !element.href.includes("/posts/") &&
              !element.href.includes("/people/")
            ) {
              // eslint-disable-next-line no-console
              console.log(`Debug: Found valid company URL: ${element.href}`);
              return element.href.split("?")[0]; // Remove query parameters
            }
          }
        }

        // Debug: Look for any links on the page
        const allLinks = document.querySelectorAll("a");
        // eslint-disable-next-line no-console
        console.log(`Debug: Total links found: ${allLinks.length}`);
        const companyLinks = Array.from(allLinks).filter(
          (link) => link.href && link.href.includes("linkedin.com/company/"),
        );
        // eslint-disable-next-line no-console
        console.log(`Debug: Company links found: ${companyLinks.length}`);
        companyLinks.forEach((link, index) => {
          // eslint-disable-next-line no-console
          console.log(`Debug: Company link ${index}: ${link.href}`);
        });

        // Last resort: look for any company-related text and find nearby links
        const companyTexts = document.querySelectorAll("*");
        for (const element of companyTexts) {
          if (
            element.textContent &&
            (element.textContent.includes("Company") ||
              element.textContent.includes("View page"))
          ) {
            const nearbyLink = element.querySelector('a[href*="/company/"]');
            if (
              nearbyLink &&
              nearbyLink.href.includes("linkedin.com/company/")
            ) {
              // eslint-disable-next-line no-console
              console.log(
                `Debug: Found company link via text search: ${nearbyLink.href}`,
              );
              return nearbyLink.href.split("?")[0];
            }
          }
        }

        // eslint-disable-next-line no-console
        console.log("Debug: No company URL found");
        return "";
      });

      if (companyUrl) {
        job.companyUrl = companyUrl;
        log.info(`✅ Found company URL for ${job.company}: ${companyUrl}`);
      } else {
        log.warning(`❌ No company URL found for ${job.company}`);
      }

      // Random delay between requests
      await randomDelay(3000, 6000);
    } catch (error) {
      log.warning(
        `⚠️  Failed to extract company URL for ${job.title}: ${error.message}`,
      );
    }
  }

  const withCompanyUrls = jobs.filter((job) => job.companyUrl).length;
  log.info(
    `📊 Company URL extraction complete: ${withCompanyUrls}/${jobs.length} jobs have company URLs`,
  );
}
