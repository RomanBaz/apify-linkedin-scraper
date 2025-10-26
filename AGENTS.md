# Apify Actor Development Guide

## Commands

```bash
# Development
apify run                              # Run Actor locally
npm start                              # Alternative local run
npm run format                         # Format code with Prettier
npm run format:check                   # Check formatting
npm run lint                           # ESLint check
npm run lint:fix                       # Auto-fix ESLint issues
npm test                               # Run tests (currently none)

# Deployment
apify login                            # Authenticate account
apify push                             # Deploy to Apify platform
```

## Code Style

- ESM modules only - use file extensions in imports: `import { router } from './routes.js'`
- ESLint with @apify/eslint-config + Prettier formatting
- Use PlaywrightCrawler with Camoufox for anti-detection
- Router pattern: `createPlaywrightRouter()` with labeled handlers
- Async/await everywhere, proper error handling
- Use Dataset.pushData() for output, Actor.getInput() for input

## Project Structure

src/
├── main.js # Actor entry point with crawler setup
└── routes.js # Router handlers for different page types
Dockerfile # Container definition
package.json # Dependencies and scripts
eslint.config.mjs # ESLint configuration

## Key Dependencies

- apify: Core SDK for Actors
- crawlee: Web scraping framework (PlaywrightCrawler)
- playwright: Browser automation
- camoufox-js: Anti-detection browser fingerprinting

## Development Notes

- Node.js >=20.0.0 required
- ESM modules - always use file extensions in imports
- Postinstall runs `npx camoufox-js fetch` to setup browser
- Firefox launcher with Camoufox for stealth scraping
- Use Actor.createProxyConfiguration() for proxy setup

## Safety & Permissions

Allowed: Actor.getValue(), Actor.pushData(), Actor.setValue(), enqueueLinks(), apify run
Ask first: npm installs, apify push, proxy changes, Dockerfile changes, deleting storage
