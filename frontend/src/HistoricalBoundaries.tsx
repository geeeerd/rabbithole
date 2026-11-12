import { useEffect, useMemo, useState } from 'react';

type Position = [number, number];
type Region = { id: string; name: string; polygons: Position[][][] };
type Snapshot = { year: string; label: string; date: string; source_url: string; regions: Region[] };
type Dataset = { scope: string; source: string; license: string; license_url: string; notice_url: string;
  uncertainty: string; snapshots: Snapshot[] };

const readYear = () => new URLSearchParams(location.search).get('year');
const project = ([longitude, latitude]: Position): Position => [(longitude + 74) * 750, (42.2 - latitude) * 1000];

function regionPath(region: Region) {
  return region.polygons.flatMap(polygon => polygon.map(ring =>
    ring.map((point, index) => `${index === 0 ? 'M' : 'L'}${project(point).map(value => value.toFixed(2)).join(' ')}`).join(' ') + ' Z',
  )).join(' ');
}

function mapBounds(dataset: Dataset) {
  const points = dataset.snapshots.flatMap(snapshot => snapshot.regions.flatMap(region => region.polygons.flat(2))).map(project);
  const x = points.map(point => point[0]);
  const y = points.map(point => point[1]);
  return [Math.min(...x) - 30, Math.min(...y) - 30, Math.max(...x) - Math.min(...x) + 60,
    Math.max(...y) - Math.min(...y) + 60].join(' ');
}

export function HistoricalBoundaries() {
  const [data, setData] = useState<Dataset>();
  const [year, setYear] = useState(readYear);
  const [selectedId, setSelectedId] = useState('');
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const bounds = useMemo(() => data ? mapBounds(data) : undefined, [data]);
  const snapshot = data?.snapshots.find(item => item.year === year) ?? data?.snapshots[0];
  const selected = snapshot?.regions.find(region => region.id === selectedId);

  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    void (async () => {
      try {
        const response = await fetch('/maps/connecticut-boundaries.json', { signal: controller.signal });
        if (!response.ok) throw new Error('Boundary data unavailable');
        const dataset: Dataset = await response.json();
        if (!controller.signal.aborted) setData(dataset);
      } catch {
        if (!controller.signal.aborted) setError(true);
      }
    })();
    return () => controller.abort();
  }, [attempt]);

  useEffect(() => {
    const restore = () => { setYear(readYear()); setSelectedId(''); };
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);

  function selectYear(value: string) {
    history.pushState({}, '', '/map/boundaries?' + new URLSearchParams({ year: value }));
    setYear(value);
    setSelectedId('');
  }

  return <section className="timeline-page historical-boundaries">
    <div className="storyintro">
      <div className="eyebrow">TIMEATLAS · HISTORICAL BOUNDARIES</div>
      <h1>Connecticut’s changing Census boundaries</h1>
      <p>Compare the eight counties used in the 2020 Census with the nine planning regions used in 2023.</p>
      <a className="source" href="/map">Back to the topic map ↗</a>
    </div>
    {!data && !error && <p role="status">Loading dated boundaries…</p>}
    {error && <div role="alert"><p>The boundary snapshots could not load.</p>
      <button onClick={() => setAttempt(value => value + 1)}>Retry</button></div>}
    {data && snapshot && <>
      <label className="boundary-year">Boundary snapshot
        <select value={snapshot.year} onChange={event => selectYear(event.target.value)}>
          {data.snapshots.map(item => <option key={item.year} value={item.year}>{item.label}</option>)}
        </select>
      </label>
      <p role="status">{snapshot.label} · {snapshot.regions.length} regions · {data.scope}</p>
      <div className="boundary-map">
        <svg viewBox={bounds} role="img" aria-label={`${snapshot.label} in Connecticut`}>
          {snapshot.regions.map(region => <path key={region.id} d={regionPath(region)} fillRule="evenodd"
            className={region.id === selectedId ? 'selected' : undefined} onClick={() => setSelectedId(region.id)}>
            <title>{region.name}</title>
          </path>)}
        </svg>
      </div>
      <label className="boundary-year">Highlight a region
        <select value={selectedId} onChange={event => setSelectedId(event.target.value)}>
          <option value="">All regions</option>
          {snapshot.regions.map(region => <option key={region.id} value={region.id}>{region.name}</option>)}
        </select>
      </label>
      {selected && <p role="status">{selected.name} · Census GEOID {selected.id}</p>}
      <div className="sourcebox boundary-source">
        <h2>Source and coverage</h2>
        <p>As of <time dateTime={snapshot.date}>{snapshot.date}</time> · {data.scope}</p>
        <p>{data.uncertainty}</p>
        <p>Derived from {data.source}.</p>
        <a href={snapshot.source_url} target="_blank" rel="noreferrer">Original boundary layer ↗</a>
        <a href={data.notice_url} target="_blank" rel="noreferrer">Notice of the boundary change ↗</a>
        <a href={data.license_url} target="_blank" rel="noreferrer">{data.license} ↗</a>
      </div>
    </>}
  </section>;
}
