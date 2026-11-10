# Contributing

Run the setup and checks in README.md. Keep changes focused and describe validation in your pull request. Preserve source identifiers and relationship direction. Add fixture-based tests for normalization, caching and upstream failures; never require live Wikimedia calls in CI. Avoid new infrastructure until a measured need exists. Do not add claims, stories or media without traceable sources and appropriate licenses.

For a source correction, include the topic ID, original statement ID or source URL, and supporting references. Keep a statement's recorded direction, date precision and calendar when presenting it. Record missing evidence where it matters to the interpretation.

The release build includes browser dependency notices copied from the installed packages. When the frontend lockfile changes, run `node scripts/collect-web-licenses.mjs --refresh` after `npm ci`. The release verifies the notices against the installed packages. Record licenses and sources for data and media separately from the software license.
