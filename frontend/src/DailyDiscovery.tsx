import { useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import type { Edge, Entity } from './exploration';

type Discovery = { story_id: string; source: Entity; target: Entity; edge: Edge };

export function DailyDiscovery() {
  const [discovery, setDiscovery] = useState<Discovery>();
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch('/api/stories/daily-discovery', { signal: controller.signal });
        if (!response.ok) return;
        const data: Discovery = await response.json();
        if (!controller.signal.aborted && data.story_id && data.source && data.target && data.edge) setDiscovery(data);
      } catch {
        // The story library link also works when the daily feature is unavailable.
      }
    })();
    return () => controller.abort();
  }, []);

  return <section className="storiesinvite daily-discovery" aria-labelledby="daily-discovery-title">
    <div>
      <h2 id="daily-discovery-title">Daily Discovery</h2>
      {discovery ? <>
        <p>{discovery.source.label} → <strong>{discovery.edge.label}</strong> → {discovery.target.label}</p>
        <a href={discovery.edge.source_url} target="_blank" rel="noreferrer">View source statement ↗</a>
      </> : <p>Follow a sourced connection through a Discovery Story.</p>}
    </div>
    <a href={discovery ? '/stories?' + new URLSearchParams({ story: discovery.story_id, step: '1' }) : '/stories'}>
      {discovery ? 'Follow this story' : 'Read discovery stories'} <ArrowUpRight aria-hidden="true" size={18}/>
    </a>
  </section>;
}
