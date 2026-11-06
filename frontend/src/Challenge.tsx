import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, Check, Lightbulb, RotateCcw, Share2, Undo2 } from 'lucide-react';
import type { Edge, Entity } from './exploration';

type Choice = { edge: Edge; entity: Entity };
export type Game = {
  token: string; id: string; graph_version: string; start: Entity; destination: Entity; current: Entity;
  path: Edge[]; visited: Entity[]; choices: Choice[]; steps: number; hints_used: number; complete: boolean;
  max_steps: number; hint_edge_id: string | null; daily_date: string | null; model: string; snapshot_date: string;
};
const STORAGE = 'rabbithole-challenge-v1';
async function api<T>(endpoint: string, signal: AbortSignal, body?: object): Promise<T> {
  const response = await fetch('/api/challenges/' + endpoint, { signal, ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  if (!response.ok) throw new Error((await response.json()).detail || 'Could not load the challenge. Please retry.');
  return response.json();
}

export function Challenge({ onExplore }: { onExplore: (id: string) => void }) {
  const [game, setGame] = useState<Game | null>(null);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [start, setStart] = useState('Q7251');
  const [destination, setDestination] = useState('Q35794');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const pending = useRef<AbortController | null>(null);
  const retry = useRef<(() => void) | null>(null);

  async function run(endpoint: string, body?: object) {
    pending.current?.abort();
    const controller = new AbortController(); pending.current = controller;
    setBusy(true); setError(''); setNotice('');
    retry.current = () => { void run(endpoint, body); };
    try {
      const next = await api<Game>(endpoint, controller.signal, body);
      if (controller.signal.aborted) return;
      setGame(next);
      try { sessionStorage.setItem(STORAGE, next.token); } catch { /* The game remains playable without storage. */ }
    } catch (e) {
      if (!controller.signal.aborted) setError((e as Error).message);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void api<{ entities: Entity[] }>('collection', controller.signal).then(data => setEntities(data.entities)).catch(() => {});
    let saved: string | null = null;
    try { saved = sessionStorage.getItem(STORAGE); } catch { /* Optional session storage. */ }
    void run(saved ? 'verify-path' : 'daily', saved ? { token: saved } : undefined);
    return () => { controller.abort(); pending.current?.abort(); };
  }, []);

  async function share() {
    if (!game?.complete) return;
    const result = `RabbitHole — ${game.start.label} → ${game.destination.label}\n${game.steps} steps · ${game.hints_used} hints\n${game.visited.map(n => n.label).join(' → ')}\n${location.origin}/challenge`;
    try { await navigator.clipboard.writeText(result); setNotice('Result copied. Invite someone to try the challenge.'); }
    catch { setNotice(result); }
  }
  const move = (edgeId: string) => { if (game) void run('validate-move', { token: game.token, edge_id: edgeId }); };
  return <section className="challenge" aria-busy={busy}>
    <div className="challengeintro"><div className="eyebrow">CONNECTION CHALLENGE · {game?.daily_date ? `${game.daily_date} UTC` : 'PRACTICE'}</div><h1>Find your way<br/><em>between ideas.</em></h1><p>Two topics. Real connections. Follow the evidence to reach your destination.</p></div>
    {busy && <p role="status" className="gamestatus">{game ? 'Checking your next connection…' : 'Preparing your challenge…'}</p>}
    {error && <div role="alert" className="gameerror"><p>{error}</p><button disabled={busy} onClick={() => retry.current?.()}>Retry</button><button disabled={busy} onClick={() => void run('daily')}>Start daily challenge</button></div>}
    {game && <>
      <div className="gameroute"><div><span className="eyebrow">START HERE</span><h2>{game.start.label}</h2><span>{game.start.id}</span></div><ArrowRight size={25}/><div><span className="eyebrow">YOUR DESTINATION</span><h2>{game.destination.label}</h2><span>{game.destination.id}</span></div></div>
      <div className="gamecolumns"><div className="gameplay">
        <div className="gameprogress"><span>{game.steps} / {game.max_steps} steps</span><span>{game.hints_used} {game.hints_used === 1 ? 'hint' : 'hints'} used</span><span className="collectionbadge">OFFLINE-READY</span></div>
        {game.complete ? <div className="gamecomplete" role="status"><div className="winmark"><Check size={32}/></div><div className="eyebrow">CONNECTION FOUND</div><h2>You followed the thread.</h2><p>{game.start.label} to {game.destination.label}, in {game.steps} steps.</p><p>Your route has been validated against the saved Wikidata statements.</p><div className="gameactions"><button className="primary" onClick={share}><Share2 size={16}/> Share result</button><button onClick={() => onExplore(game.destination.id)}>Keep exploring <ArrowUpRight size={16}/></button></div></div> : <>
          <div className="eyebrow">YOU ARE EXPLORING</div><h2 className="currenttopic">{game.current.label}</h2><p>{game.current.description}</p><h3>Which connection will you follow?</h3>
          {!game.choices.length && <div className="deadend"><strong>{game.steps >= game.max_steps ? 'Step limit reached.' : 'You found a dead end.'}</strong><p>Undo your last move and try another connection.</p></div>}
          <div className="gamechoices">{game.choices.map(choice => <article className={choice.edge.id === game.hint_edge_id ? 'gamechoice hinted' : 'gamechoice'} key={choice.edge.id}><button disabled={busy} onClick={() => move(choice.edge.id)}><span><small>{choice.edge.label} →</small><strong>{choice.entity.label}</strong>{choice.edge.id === game.hint_edge_id && <em><Lightbulb size={13}/> Suggested by your hint</em>}</span><ArrowRight size={18}/></button><details><summary>Connection source</summary><p>{game.current.label} → {choice.edge.label} → {choice.entity.label}</p><p>{choice.edge.references.length ? `${choice.edge.references.length} reference(s) recorded. Review the original statement.` : 'No supporting references recorded; this is a Wikidata assertion.'}</p><a href={choice.edge.source_url} target="_blank" rel="noreferrer">Inspect Wikidata statement ↗</a></details></article>)}</div>
        </>}
        <div className="gameactions"><button disabled={busy || !game.steps} onClick={() => void run('undo', { token: game.token })}><Undo2 size={16}/> Undo last move</button>{!game.complete && <button disabled={busy || !game.choices.length} onClick={() => void run('hint', { token: game.token })}><Lightbulb size={16}/> Get a hint</button>}<button disabled={busy} onClick={() => void run(game.daily_date ? 'daily' : 'custom', game.daily_date ? undefined : { start: game.start.id, destination: game.destination.id })}><RotateCcw size={16}/> Restart</button></div>
      </div><div className="gameaside"><div className="eyebrow">YOUR CONNECTION TRAIL</div><ol className="gametrail">{game.visited.map((node, index) => <li key={index}>{index > 0 && <span>{game.path[index - 1].label} ↓</span>}<strong>{node.label}</strong>{index > 0 && <a href={game.path[index - 1].source_url} target="_blank" rel="noreferrer">View statement ↗</a>}</li>)}</ol><hr/><h3>Every step has a source.</h3><p>{game.model}</p><p>This small collection uses a saved Wikidata snapshot from {game.snapshot_date}. A statement may lack references. Source links are provided for review.</p><p>Hints search only this collection. There is no global shortest-path score or leaderboard.</p><details><summary>Collection details</summary><p>Graph version: {game.graph_version}</p><p>The starter daily puzzle repeats until more reviewed puzzles are added. Daily dates use UTC. Signed game progress expires after 24 hours.</p></details></div></div>
    </>}
    {notice && <p className="gamenotice" role="status">{notice}</p>}
    <section className="practice"><div><div className="eyebrow">TAKE ANOTHER TURN</div><h2>Make your own connection.</h2><p>Choose two topics in the saved collection. We’ll check that a directed route exists before you begin.</p></div><form onSubmit={e => { e.preventDefault(); void run('custom', { start, destination }); }}><label>Starting topic<select value={start} onChange={e => setStart(e.target.value)}>{entities.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}</select></label><label>Destination<select value={destination} onChange={e => setDestination(e.target.value)}>{entities.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}</select></label><button className="primary" disabled={busy || !entities.length}>Start practice <ArrowRight size={16}/></button></form></section>
  </section>;
}
