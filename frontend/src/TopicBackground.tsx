import React, { useEffect, useState } from 'react';

type Article = {
  title: string;
  excerpt: string;
  article_url: string;
  revision_url: string;
  contributors_url: string;
  license_url: string;
};

export function TopicBackground({ entityId }: { entityId: string }) {
  const [open, setOpen] = useState(false);
  const [article, setArticle] = useState<Article | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!open || article) return;
    const controller = new AbortController();
    setError('');
    void fetch(`/api/entities/${encodeURIComponent(entityId)}/background`, { signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'Could not load Wikipedia background.');
        if (!controller.signal.aborted) setArticle(data);
      })
      .catch(failure => {
        if (!controller.signal.aborted) setError(failure.message);
      });
    return () => controller.abort();
  }, [entityId, open, article, attempt]);

  return <details className="topic-background" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Read Wikipedia background</summary>
    {open && !article && !error && <p role="status">Loading the linked article introduction…</p>}
    {error && <div><p role="alert">{error}</p><button onClick={() => setAttempt(attempt + 1)}>Retry background</button></div>}
    {article && <>
      <p className="article-excerpt">{article.excerpt}</p>
      <p className="article-credit">From the English Wikipedia article <strong>{article.title}</strong>. The introduction was shortened for display.</p>
      <div className="article-sources" aria-label="Wikipedia attribution">
        <a href={article.article_url} target="_blank" rel="noreferrer">Read article ↗</a>
        <a href={article.revision_url} target="_blank" rel="noreferrer">Source revision ↗</a>
        <a href={article.contributors_url} target="_blank" rel="noreferrer">Contributors ↗</a>
        <a href={article.license_url} target="_blank" rel="noreferrer">CC BY-SA 4.0 ↗</a>
      </div>
    </>}
  </details>;
}
