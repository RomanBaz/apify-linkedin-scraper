import { createPlaywrightRouter, Dataset } from "crawlee";

export const router = createPlaywrightRouter();

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

      // Try multiple LinkedIn job card selectors
      const selectors = [
        "[data-occludable-job-id]",
        ".jobs-search__results-list .job-card-container",
        ".job-search-card",
        "[data-job-id]",
        ".base-card",
        ".job-card-list__title",
      ];

      let jobCards = [];
      for (const selector of selectors) {
        jobCards = document.querySelectorAll(selector);
        if (jobCards.length > 0) break;
      }

      // Found job cards with selector

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

          // Try multiple title selectors
          const titleElement =
            card.querySelector(".base-card__full-link") ||
            card.querySelector("h3 a") ||
            card.querySelector(".job-card-list__title") ||
            card.querySelector(".job-search-card__title") ||
            card.querySelector("a[data-control-name]") ||
            card.querySelector("h3") ||
            card.querySelector("a");

          // Try multiple company selectors
          const companyElement =
            card.querySelector(".hidden-nested-link") ||
            card.querySelector(".job-search-card__subtitle-link") ||
            card.querySelector(".job-card-container__company-name") ||
            card.querySelector(".job-card-company-name") ||
            card.querySelector("[data-field='experience-company-logo'] + span");

          // Try multiple location selectors
          const locationElement =
            card.querySelector(".job-search-card__location") ||
            card.querySelector(".job-result-card__location") ||
            card.querySelector(".job-card-container__metadata-item") ||
            card.querySelector(".job-card-location");

          // Try multiple date selectors
          const postedDateElement =
            card.querySelector(".job-search-card__listdate") ||
            card.querySelector("time") ||
            card.querySelector(".job-card-container__footer-job-time");

          // Try multiple link selectors
          const linkElement =
            card.querySelector(".base-card__full-link") ||
            card.querySelector("h3 a") ||
            card.querySelector("a[data-control-name]") ||
            card.querySelector("a");

          // Extract company LinkedIn URL if requested
          let companyUrl = "";
          if (includeCompanyUrl) {
            // Try multiple approaches to find company LinkedIn URL
            const companyLinkElement =
              card.querySelector(".hidden-nested-link") ||
              card.querySelector(".job-search-card__subtitle-link") ||
              card.querySelector("a[href*='/company/']") ||
              card.querySelector("a[aria-label*='company']") ||
              card.querySelector("a[data-field='experience-company-logo']") ||
              companyElement?.querySelector("a") ||
              card.querySelector("span[class*='company'] a") ||
              card.querySelector("div[class*='company'] a") ||
              card.querySelector(".base-card__subtitle a") ||
              card.querySelector(".job-card-container__company-name a") ||
              card.querySelector(".job-card-company-name a");

            if (companyLinkElement?.href) {
              companyUrl = companyLinkElement.href;
              // Ensure it's a LinkedIn company URL and clean it
              if (companyUrl.includes("linkedin.com/company/")) {
                companyUrl = companyUrl.split("?")[0]; // Remove query parameters
              } else {
                companyUrl = "";
              }
            }

            // Additional approach: look for any link that contains company name
            if (!companyUrl) {
              const allLinks = card.querySelectorAll("a");
              for (const link of allLinks) {
                if (
                  link.href &&
                  link.href.includes("linkedin.com/company/") &&
                  !link.href.includes("/jobs/") &&
                  !link.href.includes("/posts/")
                ) {
                  companyUrl = link.href.split("?")[0];
                  break;
                }
              }
            }
          }

          const title = titleElement?.textContent?.trim() || "";
          const company = companyElement?.textContent?.trim() || "";

          if (
            title &&
            (title.toLowerCase().includes("developer") ||
              title.toLowerCase().includes("engineer") ||
              title.toLowerCase().includes("manager") ||
              title.toLowerCase().includes("analyst") ||
              title.toLowerCase().includes("specialist"))
          ) {
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
  const maxJobsToProcess = Math.min(jobs.length, 10); // Process up to 10 jobs
  log.info(`🔍 Extracting company URLs from ${maxJobsToProcess} job pages...`);
  log.info(`🔍 Debug: Total jobs available: ${jobs.length}`);
  log.info(`🔍 Debug: First job sample: ${JSON.stringify(jobs[0], null, 2)}`);

  for (let i = 0; i < maxJobsToProcess; i++) {
    const job = jobs[i];
    if (!job.url) {
      log.warning(`⚠️  No URL for job: ${job.title}`);
      continue;
    }

    try {
      log.info(
        `📄 Visiting job page ${i + 1}/${maxJobsToProcess}: ${job.title}`,
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
        console.log("Debug: Page title:", document.title);
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

        console.log("Debug: Trying selectors...");

        // Try each selector
        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          console.log(
            `Debug: Selector "${selector}" found ${elements.length} elements`,
          );

          for (const element of elements) {
            console.log(`Debug: Element href: ${element.href}`);
            if (
              element &&
              element.href &&
              element.href.includes("linkedin.com/company/") &&
              !element.href.includes("/jobs/") &&
              !element.href.includes("/posts/") &&
              !element.href.includes("/people/")
            ) {
              console.log(`Debug: Found valid company URL: ${element.href}`);
              return element.href.split("?")[0]; // Remove query parameters
            }
          }
        }

        // Debug: Look for any links on the page
        const allLinks = document.querySelectorAll("a");
        console.log(`Debug: Total links found: ${allLinks.length}`);
        const companyLinks = Array.from(allLinks).filter(
          (link) => link.href && link.href.includes("linkedin.com/company/"),
        );
        console.log(`Debug: Company links found: ${companyLinks.length}`);
        companyLinks.forEach((link, i) => {
          console.log(`Debug: Company link ${i}: ${link.href}`);
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
              console.log(
                `Debug: Found company link via text search: ${nearbyLink.href}`,
              );
              return nearbyLink.href.split("?")[0];
            }
          }
        }

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
    `📊 Company URL extraction complete: ${withCompanyUrls}/${maxJobsToProcess} jobs have company URLs`,
  );
}
