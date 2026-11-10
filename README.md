 # Mother and Child Health Care Center Website

 ## Project Overview
 A simple static website for the Mātes un bērna veselības aprūpes centrs (Mother and Child Health Care Center) offering:
 - Multilingual support (English / Latvian)
 - Sections: Home, Services, Price List, About Us, Contacts, Gallery
 - Dynamic content rendering using vanilla JavaScript
 - Responsive design (mobile, tablet, desktop)

 ## Features
 - **Navigation**: Shareable hash routes (`#home`, `#services`, `#pricelist`, `#gallery`, `#about`, `#contacts`) with browser Back/Forward support and a compact mobile menu
 - **Services & Price List**: Localized text via a `translations` object
 - **Contacts**: Homepage booking action and opening hours; clickable phone, email, and directions links; embedded Google Maps on Contacts
 - **Gallery**:
   - Lazy-loaded WebP thumbnails with larger photos loaded on demand
   - Native dialog with previous/next buttons, arrow keys, Escape, and focus restoration
   - Hover lift effect matching service items
 - **Accessibility**: Keyboard controls, skip link, visible focus, descriptive image labels, reduced-motion support, and matching document language for English and Latvian
 - **Images**: Responsive homepage sources and compressed portraits; originals preserved for future editing

 ## Installation & Usage
 1. Clone this repository.
 2. Open `index.html` in any modern browser.
 3. No build tools or additional servers required.

 ## Dependencies & Licenses
 - No runtime JavaScript, font, or icon dependencies. No server-side code or build step.
 - Google Maps is embedded on the Contacts page.

 ## Development Checks
 - JavaScript syntax: `node --check script.js`
 - Browser regression checks: with Playwright and its Chromium browser installed, run `node tests/smoke.cjs`. The test starts and stops its own local server. `PLAYWRIGHT_MODULE` and `BROWSER_EXECUTABLE` can point to existing installations; `SCREENSHOT_DIR` optionally saves visual review images.
 - Rebuild image derivatives: with Python and Pillow installed, run `python tools/optimize_images.py`. This writes WebP files and their dimensions to `assets/images/` without modifying the originals.

 ## Compliance & Policy
 - All code is original or uses permissively licensed assets. No proprietary or restricted libraries are included.
 - No secrets, credentials, or personal data appear in the repository.
 - Conforms to GitHub Terms of Service and Community Guidelines: no malware, no copyrighted content without permission.
 - Follows best practices for static HTML/CSS/JS projects and respects user privacy (no analytics or tracking).

 ## Contributing
 1. Fork the repository and create a feature branch.
 2. Follow existing coding style and add meaningful commit messages.
 3. Submit a pull request for review.

 ## License
 This repository does not include an explicit license file. By contributing, you agree that your changes can be distributed under the same permissive terms as the existing code.
