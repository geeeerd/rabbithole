import { useEffect, useState } from 'react';
import type { Graph } from './exploration';
import { TopicFacts } from './TopicFacts';
import { TopicBackground } from './TopicBackground';

type Cover = { url: string; file_title: string; artist: string; source_url: string; license: string; license_url: string };
type StoryLinks = { cover: Cover | null; stories: { id: string; title: string; step: number }[] };
type Dates = { entries: { id: string; label: string; date: { label: string }; source_url: string }[] };
type Tab = 'overview' | 'connections' | 'timeline' | 'further';
type Profile = { graph: Graph; dates: Dates['entries']; related: StoryLinks };

const tabs: { id: Tab; name: string }[] = [
  { id: 'overview', name: 'Overview' }, { id: 'connections', name: 'Connections' },
  { id: 'timeline', name: 'Timeline' }, { id: 'further', name: 'Explore Further' },
];

async function get<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error('This topic could not load.');
  return response.json();
}

export function TopicProfile() {
  const id = new URLSearchParams(location.search).get('entity') ?? '';
  const [requestedTab, setRequestedTab] = useState(() => new URLSearchParams(location.search).get('tab'));
  const [data, setData] = useState<Profile>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!/^Q[1-9][0-9]{0,11}$/.test(id)) {
      setError('Choose a topic in Explore to open its profile.');
      return;
    }
    const request = new AbortController();
    setError('');
    void Promise.allSettled([
      get<Graph>('/api/graph?entity=' + id, request.signal),
      get<Dates>(`/api/entities/${id}/timeline`, request.signal),
      get<StoryLinks>(`/api/stories/topics/${id}`, request.signal),
    ]).then(([graph, dates, related]) => {
      if (request.signal.aborted) return;
      if (graph.status === 'rejected' || !graph.value.nodes.some(node => node.id === id)) {
        setError('This topic could not load. Try again shortly.');
        return;
      }
      setData({ graph: graph.value, dates: dates.status === 'fulfilled' ? dates.value.entries : [],
        related: related.status === 'fulfilled' ? related.value : { cover: null, stories: [] } });
    });
    return () => request.abort();
  }, [id, attempt]);

  useEffect(() => {
    const restore = () => setRequestedTab(new URLSearchParams(location.search).get('tab'));
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);

  const subject = data?.graph.nodes.find(node => node.id === id);
  const links = data?.graph.edges.filter(edge => edge.source === id || edge.target === id) ?? [];
  const names = new Map(data?.graph.nodes.map(node => [node.id, node.label]));
  const categories = [...new Set(links.filter(edge => edge.source === id && edge.property_id === 'P31')
    .map(edge => names.get(edge.target) ?? edge.target))];
  const available = tabs.filter(tab => tab.id === 'overview' ||
    (tab.id === 'connections' && links.length) || (tab.id === 'timeline' && data?.dates.length) ||
    (tab.id === 'further' && data?.related.stories.length));
  const active = available.find(tab => tab.id === requestedTab)?.id ?? 'overview';

  function openTab(tab: Tab) {
    if (tab === active) return;
    const query = new URLSearchParams({ entity: id });
    if (tab !== 'overview') query.set('tab', tab);
    history.pushState(null, '', '/profile?' + query);
    setRequestedTab(tab);
  }

  return <section className="timeline-page topic-profile">
    <div className="storyintro">
      <div className="eyebrow">TOPIC PROFILE</div>
      <h1>{subject?.label ?? 'Topic profile'}</h1>
      {subject && <><p>{subject.description}</p><a className="source" href={'/?entity=' + id}>Open in Explore ↗</a></>}
    </div>
    {!subject && !error && <p role="status">Loading topic profile…</p>}
    {error && <div role="alert"><p>{error}</p>{id && <button onClick={() => setAttempt(value => value + 1)}>Retry</button>}</div>}
    {subject && data && <>
      <div className="profile-tabs" role="tablist" aria-label="Topic profile sections">
        {available.map((tab, index) => <button key={tab.id} id={`profile-tab-${tab.id}`} role="tab"
          aria-controls="topic-profile-panel" aria-selected={active === tab.id} tabIndex={active === tab.id ? 0 : -1}
          onClick={() => openTab(tab.id)} onKeyDown={event => {
            const last = available.length - 1;
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? last
              : event.key === 'ArrowLeft' ? (index + last) % available.length
                : event.key === 'ArrowRight' ? (index + 1) % available.length : -1;
            if (next < 0) return;
            event.preventDefault();
            openTab(available[next].id);
            document.getElementById(`profile-tab-${available[next].id}`)?.focus();
          }}>{tab.name}</button>)}
      </div>
      <div className="profile-panel" id="topic-profile-panel" role="tabpanel" aria-labelledby={`profile-tab-${active}`} tabIndex={0}>
        {active === 'overview' && <>
          {data.related.cover && <figure className="profile-cover">
            <img src={data.related.cover.url} alt={data.related.cover.file_title.replace(/^File:/, '')} loading="lazy"/>
            <figcaption>{data.related.cover.artist} · <a href={data.related.cover.source_url}>Source image</a> · <a href={data.related.cover.license_url}>{data.related.cover.license}</a></figcaption>
          </figure>}
          {categories.length > 0 && <p>Recorded categories · {categories.join(', ')}</p>}
          <a className="source" href={subject.source_url} target="_blank" rel="noreferrer">View on Wikidata ↗</a>
          <TopicFacts entityId={id}/>
          <TopicBackground entityId={id}/>
        </>}
        {active === 'connections' && <ul>{links.map(edge => <li key={edge.id}>
          {names.get(edge.source) ?? edge.source} → {edge.label} → {names.get(edge.target) ?? edge.target}{' '}
          <a href={edge.source_url} target="_blank" rel="noreferrer">Source statement ↗</a>
        </li>)}</ul>}
        {active === 'timeline' && <>
          <ul>{data.dates.slice(0, 5).map(entry => <li key={entry.id}>{entry.date.label} · {entry.label}{' '}
            <a href={entry.source_url} target="_blank" rel="noreferrer">Source statement ↗</a></li>)}</ul>
          <a className="source" href={'/timeline?entity=' + id}>Open full timeline ↗</a>
        </>}
        {active === 'further' && <ul>{data.related.stories.map(story => <li key={story.id}>
          <a href={'/stories?' + new URLSearchParams({ story: story.id, step: String(story.step) })}>{story.title} ↗</a>
        </li>)}</ul>}
      </div>
    </>}
  </section>;
}
