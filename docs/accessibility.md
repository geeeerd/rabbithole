# Accessibility and performance checks

## Implemented

- A skip link and named search combobox.
- Search result announcements, arrow-key selection, Enter activation, Escape dismissal, request cancellation, no-results states and retry.
- A focusable graph with arrow-key topic selection, plus/minus zoom and zero-to-fit. Equivalent native topic buttons and relationship inspection remain available beside the canvas.
- Selected topics expose pressed state in the accessible list; filtered relationship lists match the graph's filtered edges.
- Reduced-motion preference disables graph centering animation. Selecting a topic does not rebuild the graph renderer or rerun its layout.
- Story chapter changes move focus to the chapter heading. Previous/next, progress buttons, source links and image attribution work with native controls.
- Dark and light themes retain a local preference across navigation. Route/graph load failures show a recovery view; graph failures leave the adjacent lists usable.

## Automated checks

`npm test` covers combobox keyboard interaction, stale response cancellation, list-based graph exploration, renderer event/keyboard behavior, selected-profile stability, filtered edges, challenge play and story navigation. Axe checks the homepage and explorer evidence view in jsdom with color-contrast disabled, because jsdom does not provide a reliable visual layout/contrast engine.

These checks do not establish WCAG conformance. Screen-reader testing, contrast measurement in a real browser, narrow-viewport/device testing and a complete manual audit remain outstanding. The browser playthrough checks normal desktop interactions; renderer lifecycle tests use a mocked Cytoscape instance.

## Initial JavaScript budget

`npm run build` generates Vite's dependency manifest and runs `scripts/check-bundle.mjs`. It measures the gzip size of the entry and its static JavaScript imports, fails above 110 KiB, and fails if the graph engine is statically included. Dynamic route modules and the graph renderer load on demand. This is a build-size regression check, not a measured Core Web Vitals or device-performance result.

Current measured initial JavaScript is approximately 77 KiB gzip. The graph engine is about 142 KiB gzip and is deferred until exploration. Images, stylesheets, font requests and transport headers are not included in that JavaScript figure. Images load only in story routes; library images use native lazy loading.
