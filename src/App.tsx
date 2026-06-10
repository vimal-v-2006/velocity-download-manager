import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Bolt, CheckCircle2, Download, FolderOpen, Gauge, Pause, Play, Plus, Rocket, Trash2, Wifi } from 'lucide-react';
import type { AriaSnapshot, DownloadItem } from './types';
import { fileNameFromItem, formatBytes, formatEta, formatSpeed, progressPercent } from './lib/format';

const mockSnapshot: AriaSnapshot = { active: [], waiting: [], stopped: [], globalStat: { downloadSpeed: '0', numActive: '0', numWaiting: '0', numStopped: '0' }, version: { version: '1.37.0', enabledFeatures: ['HTTPS','BitTorrent','Metalink','SFTP'] } };

function useVelocity() {
  const [snapshot, setSnapshot] = useState<AriaSnapshot>(mockSnapshot);
  const [error, setError] = useState<string | null>(null);
  const refresh = async () => { try { if (!window.velocity) return; setSnapshot(await window.velocity.status()); setError(null); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } };
  useEffect(() => { refresh(); const id = setInterval(refresh, 1000); return () => clearInterval(id); }, []);
  return { snapshot, error, refresh };
}

function DownloadCard({ item, onRefresh }: { item: DownloadItem; onRefresh: () => void }) {
  const percent = progressPercent(item.completedLength, item.totalLength);
  const fullPath = item.files?.[0]?.path;
  const running = item.status === 'active';
  const done = item.status === 'complete';
  const statusClass = done ? 'done' : item.status === 'error' ? 'danger' : running ? 'hot' : 'idle';
  async function action(kind: 'pause'|'resume'|'remove') { if (!window.velocity) return; await window.velocity[kind](item.gid); onRefresh(); }
  return <motion.article layout initial={{ opacity: 0, y: 20, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: .96 }} className="download-card">
    <div className="card-glow" />
    <div className="download-main">
      <div className={`status-orb ${statusClass}`}><Download size={22}/></div>
      <div className="download-info">
        <div className="download-title-row"><h3>{fileNameFromItem(item)}</h3><span className={`pill ${statusClass}`}>{item.status}</span></div>
        <p className="path">{fullPath || item.dir || 'Preparing file...'}</p>
        <div className="progress-shell"><motion.div className="progress-fill" animate={{ width: `${percent}%` }} transition={{ type: 'spring', stiffness: 80, damping: 18 }} /></div>
        <div className="metrics"><span>{percent.toFixed(1)}%</span><span>{formatBytes(item.completedLength)} / {formatBytes(item.totalLength)}</span><span>{formatSpeed(item.downloadSpeed)}</span><span>ETA {formatEta(item.completedLength, item.totalLength, item.downloadSpeed)}</span><span>{item.connections || 0} connections</span></div>
        {item.errorMessage && <p className="error-line">{item.errorMessage}</p>}
      </div>
    </div>
    <div className="card-actions">
      {running ? <button onClick={() => action('pause')}><Pause size={16}/> Pause</button> : !done && <button onClick={() => action('resume')}><Play size={16}/> Resume</button>}
      {fullPath && <button onClick={() => window.velocity?.openPath(fullPath)}><FolderOpen size={16}/> Open</button>}
      <button className="danger-btn" onClick={() => action('remove')}><Trash2 size={16}/> Remove</button>
    </div>
  </motion.article>;
}

function AddPanel({ onAdded }: { onAdded: () => void }) {
  const [url, setUrl] = useState(''); const [dir, setDir] = useState(''); const [split, setSplit] = useState(16); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  async function add() { setBusy(true); setMessage(''); try { new URL(url); await window.velocity?.addDownload({ url, dir: dir || undefined, split, connections: split }); setUrl(''); setMessage('Download added to Velocity queue.'); onAdded(); } catch (e) { setMessage(e instanceof Error ? e.message : 'Invalid URL or aria2 error'); } finally { setBusy(false); } }
  async function choose() { const chosen = await window.velocity?.chooseDir(); if (chosen) setDir(chosen); }
  return <motion.section initial={{ opacity:0, y:-12 }} animate={{ opacity:1, y:0 }} className="add-panel">
    <div><h2><Plus size={24}/> Add high-speed download</h2><p>Fastest Mode uses segmented range requests. If a link fails or shows TLS/connection errors, retry with <strong>1 split</strong>; some hosts block 16-split downloads.</p></div>
    <div className="add-grid"><input value={url} onChange={e=>setUrl(e.target.value)} placeholder="Paste HTTP/HTTPS, magnet, torrent or metalink URL" onKeyDown={e=>{ if(e.key==='Enter') add(); }} /><button onClick={choose}><FolderOpen size={17}/> {dir ? 'Folder selected' : 'Save folder'}</button><label className="range">Splits <strong>{split}</strong><input type="range" min="1" max="16" value={split} onChange={e=>setSplit(Number(e.target.value))}/></label><button className="primary" disabled={busy || !url} onClick={add}><Rocket size={18}/> Start</button></div>
    {dir && <p className="hint">Folder: {dir}</p>}{message && <p className="hint">{message}</p>}
  </motion.section>;
}

export default function App() {
  const { snapshot, error, refresh } = useVelocity();
  const [filter, setFilter] = useState<'all'|'active'|'waiting'|'complete'|'error'>('all');
  const all = useMemo(() => [...snapshot.active, ...snapshot.waiting, ...snapshot.stopped], [snapshot]);
  const filtered = filter === 'all' ? all : all.filter(d => d.status === filter || (filter === 'waiting' && d.status === 'paused'));
  return <div className="app-shell">
    <div className="aurora a1"/><div className="aurora a2"/><div className="noise"/>
    <aside className="sidebar"><div className="brand"><div className="brand-mark"><Bolt/></div><div><h1>Velocity</h1><span>Split Download Manager</span></div></div>
      <nav>{['all','active','waiting','complete','error'].map((f)=><button key={f} className={filter===f?'selected':''} onClick={()=>setFilter(f as typeof filter)}>{f}</button>)}</nav>
      <div className="engine-card"><Wifi/><strong>aria2 engine</strong><span>v{snapshot.version.version}</span><small>{snapshot.version.enabledFeatures.slice(0,4).join(' • ')}</small></div>
    </aside>
    <main className="workspace"><header className="hero"><div><motion.p initial={{opacity:0}} animate={{opacity:1}} className="eyebrow"><Gauge size={18}/> Built to be the fastest Linux download manager</motion.p><h1>Fastest Mode with animated control.</h1><p>Linux-first segmented downloads, resume support, queue control, torrent-ready engine and a premium glass UI.</p></div><div className="speed-ring"><Activity/><strong>{formatSpeed(snapshot.globalStat.downloadSpeed)}</strong><span>global speed</span></div></header>
      <section className="stats"><div><strong>{snapshot.globalStat.numActive}</strong><span>Active</span></div><div><strong>{snapshot.globalStat.numWaiting}</strong><span>Queued</span></div><div><strong>{snapshot.globalStat.numStopped}</strong><span>Finished/Stopped</span></div><div><strong>{formatSpeed(snapshot.globalStat.downloadSpeed)}</strong><span>Now</span></div></section>
      <AddPanel onAdded={refresh}/>{error && <div className="banner">Engine warning: {error}</div>}
      <section className="downloads"><div className="section-title"><h2>Downloads</h2><span>{filtered.length} items</span></div><AnimatePresence>{filtered.map(item => <DownloadCard key={item.gid} item={item} onRefresh={refresh}/>)}</AnimatePresence>{filtered.length===0 && <motion.div initial={{opacity:0}} animate={{opacity:1}} className="empty"><CheckCircle2 size={44}/><h3>No downloads here yet</h3><p>Paste a URL above. Velocity will ask aria2 to split it across parallel connections.</p></motion.div>}</section>
    </main>
  </div>;
}
