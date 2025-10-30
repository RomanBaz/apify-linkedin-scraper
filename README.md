# LinkedIn Job Scraper with Company URLs

A powerful Apify Actor that scrapes LinkedIn job listings with comprehensive company URL extraction. Built with PlaywrightCrawler and Camoufox for advanced anti-detection capabilities.

## Features

- 🔍 **Comprehensive Job Extraction**: Extracts job titles, companies, locations, posting dates, and URLs
- 🏢 **Company URL Extraction**: Automatically finds LinkedIn company page URLs for each job posting
- 🛡️ **Anti-Detection Technology**: Uses Camoufox (stealth Firefox) with randomized fingerprints
- 🎯 **Smart Selectors**: 20+ fallback selectors handle LinkedIn's changing UI layouts
- 🔄 **Retry Logic**: Automatic retries with progressive delays for failed extractions
- 📊 **Configurable Safety**: Slow mode option for maximum stealth
- 🌐 **Proxy Support**: Built-in proxy configuration for anti-bot protection

## Output

Each job listing includes:

```json
{
  "id": "job_0",
  "title": "Senior Software Engineer",
  "company": "Tech Corp",
  "location": "San Francisco, CA",
  "postedDate": "2 days ago",
  "url": "https://www.linkedin.com/jobs/view/...",
  "companyUrl": "https://www.linkedin.com/company/tech-corp",
  "scrapedAt": "2025-10-30T20:53:02.858Z"
}
```

## Input Configuration

### Required

- **startUrls**: LinkedIn job search URLs to scrape

### Optional

- **maxResults**: Maximum number of jobs to extract (default: 50, max: 200)
- **slowMode**: Enable extra conservative mode for safety (default: true)
- **includeCompanyUrl**: Extract company LinkedIn URLs (default: true, recommended)
- **proxyConfiguration**: Proxy settings for anti-bot protection

## Technology Stack

- **PlaywrightCrawler**: Advanced web scraping with Playwright
- **Camoufox**: Stealth Firefox fork for anti-detection
- **Crawlee**: Modern scraping framework
- **Apify SDK**: Platform integration and data storage

## Usage

### Basic Usage

```javascript
const input = {
  startUrls: [
    "https://www.linkedin.com/jobs/search/?keywords=software%20developer",
  ],
  maxResults: 100,
  includeCompanyUrl: true,
  slowMode: true,
};
```

### Advanced Usage

For company research and recruitment analysis, enable `includeCompanyUrl: true` to get direct links to company LinkedIn pages alongside job postings.

## Development

This Actor is built with:

- **ESM modules** for modern JavaScript development
- **ESLint + Prettier** for code quality
- **Apify SDK v3** for platform integration
- **Crawlee** for robust web scraping

## Resources

- [Crawlee + Apify Platform guide](https://crawlee.dev/docs/guides/apify-platform)
- [Documentation](https://crawlee.dev/api/playwright-crawler/class/PlaywrightCrawler)
- [Node.js tutorials](https://docs.apify.com/academy/node-js)
- [Apify Platform documentation](https://docs.apify.com/platform)
- [Join our developer community on Discord](https://discord.com/invite/jyEM2PRvMU)

## License

ISC License - feel free to use this code for your projects!
