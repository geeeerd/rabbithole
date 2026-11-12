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

## Safari release spot checks

- Opened the 2023 Connecticut boundary bookmark, switched to the 2020 snapshot with the keyboard and verified that source and highlight controls remained reachable after zoom triggered the narrow layout.
- Opened the Mona Lisa profile at the same narrow layout and used Right Arrow to move from Overview to Connections. Safari exposed the selected tab and statement links in its accessibility tree.
- Calculated contrast for the default, muted and accent text colors on the base and panel backgrounds. The lowest measured pair was light-theme accent text on the panel at 5.00:1. The calculations cover the theme tokens. A complete contrast audit, assistive-technology playthrough and physical-device testing remain open.

## Initial JavaScript budget

`npm run build` generates Vite's dependency manifest and runs `scripts/check-bundle.mjs`. It measures the gzip size of the entry and its static JavaScript imports, fails above 110 KiB, and fails if the graph engine is statically included. Dynamic route modules and the graph renderer load on demand. This is a build-size regression check, not a measured Core Web Vitals or device-performance result.

The measured initial JavaScript is approximately 87.4 KiB gzip. The graph engine is about 142 KiB gzip and loads on demand. The JavaScript measurement excludes images, stylesheets, font requests and transport headers. Story and profile covers use native lazy loading.
