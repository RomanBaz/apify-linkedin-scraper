import { createPlaywrightRouter, Dataset } from "crawlee";

export const router = createPlaywrightRouter();

router.addDefaultHandler(async ({ request, page, log }) => {
  log.info(`Processing LinkedIn job listing: ${request.loadedUrl}`);

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

  // Wait for job listings to load with random delay
  await page.waitForLoadState("networkidle");
  await randomDelay(2000, 4000);

  // Scroll to load more jobs with human-like patterns
  await autoScroll(page);

  // Extract job listings
  const jobs = await extractJobListings(page);

  if (jobs.length > 0) {
    log.info(`Found ${jobs.length} job listings`);
    await Dataset.pushData(jobs);
  } else {
    log.warning("No job listings found");
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

async function extractJobListings(page) {
  return await page.evaluate(() => {
    const jobs = [];

    // LinkedIn job card selectors
    const jobCards = document.querySelectorAll("[data-occludable-job-id]");

    jobCards.forEach((card) => {
      try {
        const jobId = card.getAttribute("data-occludable-job-id");
        const titleElement =
          card.querySelector(".base-card__full-link") ||
          card.querySelector("h3 a");
        const companyElement =
          card.querySelector(".hidden-nested-link") ||
          card.querySelector(".job-search-card__subtitle-link");
        const locationElement =
          card.querySelector(".job-search-card__location") ||
          card.querySelector(".job-result-card__location");
        const postedDateElement =
          card.querySelector(".job-search-card__listdate") ||
          card.querySelector("time");
        const linkElement = card.querySelector(".base-card__full-link");

        if (titleElement && companyElement) {
          const job = {
            id: jobId,
            title: titleElement.textContent?.trim() || "",
            company: companyElement.textContent?.trim() || "",
            location: locationElement?.textContent?.trim() || "",
            postedDate:
              postedDateElement?.textContent?.trim() ||
              postedDateElement?.getAttribute("datetime") ||
              "",
            url: linkElement?.href || "",
            scrapedAt: new Date().toISOString(),
          };

          jobs.push(job);
        }
      } catch {
        // Error extracting job - continue with next
      }
    });

    return jobs;
  });
}
