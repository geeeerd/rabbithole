export function DataPrivacy() {
  return <section className="timeline-page data-privacy">
    <div className="storyintro">
      <h1>Data and privacy</h1>
      <p>RabbitHole lets you explore, read stories and play challenges without an account.</p>
    </div>
    <h2>In your browser</h2>
    <p>Saved Trails and your theme preference use browser storage. Browser history holds exploration state, and session storage keeps your signed challenge progress. Clear the site’s browser data to remove those records.</p>
    <h2>Search and sources</h2>
    <p>RabbitHole forwards search terms and topic requests to Wikimedia to find records. Fonts load from Google Fonts. Opening a source link takes you to the publisher’s site.</p>
    <h2>Service operation</h2>
    <p>The server uses connection addresses in memory to limit request rates. It counts response times, upstream errors and browser rendering failures. Rendering reports carry an empty body. The app logs aggregate counts by route type. A hosting provider may keep separate infrastructure logs.</p>
    <p>For questions about the app, use the public project feedback channel.</p>
    <a className="source" href="https://github.com/geeeerd/rabbithole/issues">Project feedback ↗</a>
  </section>;
}
