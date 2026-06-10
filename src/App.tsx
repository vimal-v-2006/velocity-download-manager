import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { Activity, Bolt, CheckCircle2, Download, FolderOpen, Gauge, Pause, Play, Plus, Rocket, Trash2, Wifi, Waves } from 'lucide-react';
import type { AriaSnapshot, DownloadItem } from './types';
import { bytes, fileNameFromItem, formatBytes, formatEta, formatSpeed, progressPercent } from './lib/format';

const mockSnapshot: AriaSnapshot = { active: [], waiting: [], stopped: [], globalStat: { downloadSpeed: '0', numActive: '0', numWaiting: '0', numStopped: '0' }, version: { version: '1.37.0', enabledFeatures: ['HTTPS','BitTorrent','Metalink','SFTP'] } };
const particleSeeds = Array.from({ length: 34 }, (_, index) => ({ index, left: `${(index * 29) % 100}%`, delay: `${(index * 0.37) % 8}s`, size: 2 + (index % 5), duration: 9 + (index % 7) }));
const speedBars = Array.from({ length: 28 }, (_, index) => index);

function useVelocity() {
  const [snapshot, setSnapshot] = useState<AriaSnapshot>(mockSnapshot);
  const [error, setError] = useState<string | null>(null);
  const refresh = async () => { try { if (!window.velocity) return; setSnapshot(await window.velocity.status()); setError(null); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } };
  useEffect(() => { refresh(); const id = setInterval(refresh, 1000); return () => clearInterval(id); }, []);
  return { snapshot, error, refresh };
}

function useReactiveTilt() {
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const springX = useSpring(rotateX, { stiffness: 160, damping: 22 });
  const springY = useSpring(rotateY, { stiffness: 160, damping: 22 });
  function onPointerMove(event: React.PointerEvent<HTMLElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    rotateY.set(px * 7);
    rotateX.set(py * -7);
    event.currentTarget.style.setProperty('--local-x', `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty('--local-y', `${event.clientY - rect.top}px`);
  }
  function onPointerLeave() { rotateX.set(0); rotateY.set(0); }
  return { style: { rotateX: springX, rotateY: springY }, onPointerMove, onPointerLeave };
}

function SpeedSculpture({ speed }: { speed: string }) {
  const speedBytes = bytes(speed);
  const intensity = Math.min(1, speedBytes / (8 * 1024 * 1024));
  const fill = Math.max(8, intensity * 100);
  const liquidY = useMotionValue(100 - fill);
  useEffect(() => { liquidY.set(100 - fill); }, [fill, liquidY]);
  const smoothY = useSpring(liquidY, { stiffness: 70, damping: 18 });
  const clipPath = useTransform(smoothY, (value) => `inset(${value}% 0 0 0 round 32px)`);
  return <motion.div className="speed-sculpture magnetic" whileHover={{ scale: 1.025 }} transition={{ type: 'spring', stiffness: 180, damping: 18 }}>
    <div className="speed-grid" />
    <motion.div className="liquid-fill" style={{ clipPath }} />
    <div className="orbital-ring ring-one" />
    <div className="orbital-ring ring-two" />
    <div className="speed-content">
      <Activity size={24}/>
      <motion.strong key={speed} initial={{ y: 10, opacity: 0, filter: 'blur(8px)' }} animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}>{formatSpeed(speed)}</motion.strong>
      <span>live flow speed</span>
    </div>
    <div className="speed-bars">{speedBars.map((bar) => <span key={bar} style={{ animationDelay: `${bar * 0.055}s`, height: `${18 + ((bar * 17) % 58)}%` }} />)}</div>
  </motion.div>;
}

function DownloadCard({ item, onRefresh }: { item: DownloadItem; onRefresh: () => void }) {
  const tilt = useReactiveTilt();
  const percent = progressPercent(item.completedLength, item.totalLength);
  const fullPath = item.files?.[0]?.path;
  const running = item.status === 'active';
  const done = item.status === 'complete';
  const statusClass = done ? 'done' : item.status === 'error' ? 'danger' : running ? 'hot' : 'idle';
  async function action(kind: 'pause'|'resume'|'remove') { if (!window.velocity) return; await window.velocity[kind](item.gid); onRefresh(); }
  return <motion.article layout initial={{ opacity: 0, y: 22, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: .96 }} className="download-card reactive-card" {...tilt}>
    <div className="card-spotlight" />
    <div className="download-main">
      <motion.div className={`status-orb ${statusClass}`} animate={running ? { scale: [1, 1.08, 1], rotate: [0, 2, -2, 0] } : { scale: 1 }} transition={{ duration: 1.6, repeat: running ? Infinity : 0 }}><Download size={22}/></motion.div>
      <div className="download-info">
        <div className="download-title-row"><h3>{fileNameFromItem(item)}</h3><span className={`pill ${statusClass}`}>{item.status}</span></div>
        <p className="path">{fullPath || item.dir || 'Preparing file...'}</p>
        <div className="progress-shell"><motion.div className="progress-fill" animate={{ width: `${percent}%` }} transition={{ type: 'spring', stiffness: 80, damping: 18 }}><span /></motion.div></div>
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
  const tilt = useReactiveTilt();
  const [url, setUrl] = useState(''); const [dir, setDir] = useState(''); const [split, setSplit] = useState(16); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  async function add() { setBusy(true); setMessage(''); try { new URL(url); await window.velocity?.addDownload({ url, dir: dir || undefined, split, connections: split }); setUrl(''); setMessage('Download added to Velocity queue.'); onAdded(); } catch (e) { setMessage(e instanceof Error ? e.message : 'Invalid URL or aria2 error'); } finally { setBusy(false); } }
  async function choose() { const chosen = await window.velocity?.chooseDir(); if (chosen) setDir(chosen); }
  return <motion.section initial={{ opacity:0, y:-12 }} animate={{ opacity:1, y:0 }} className="add-panel reactive-card" {...tilt}>
    <div className="card-spotlight" />
    <div className="add-copy"><h2><Plus size={24}/> Add high-speed download</h2><p>Fastest Mode uses segmented range requests. If a link fails or shows TLS/connection errors, retry with <strong>1 split</strong>; some hosts block 16-split downloads.</p></div>
    <div className="add-grid"><input value={url} onChange={e=>setUrl(e.target.value)} placeholder="Paste HTTP/HTTPS, magnet, torrent or metalink URL" onKeyDown={e=>{ if(e.key==='Enter') add(); }} /><button onClick={choose}><FolderOpen size={17}/> {dir ? 'Folder selected' : 'Save folder'}</button><label className="range">Splits <strong>{split}</strong><input type="range" min="1" max="16" value={split} onChange={e=>setSplit(Number(e.target.value))}/></label><button className="primary" disabled={busy || !url} onClick={add}><Rocket size={18}/> Start</button></div>
    {dir && <p className="hint">Folder: {dir}</p>}{message && <p className="hint">{message}</p>}
  </motion.section>;
}

export default function App() {
  const { snapshot, error, refresh } = useVelocity();
  const [filter, setFilter] = useState<'all'|'active'|'waiting'|'complete'|'error'>('all');
  const shellRef = useRef<HTMLDivElement>(null);
  const all = useMemo(() => [...snapshot.active, ...snapshot.waiting, ...snapshot.stopped], [snapshot]);
  const filtered = filter === 'all' ? all : all.filter(d => d.status === filter || (filter === 'waiting' && d.status === 'paused'));
  function moveSpotlight(event: React.PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    shellRef.current?.style.setProperty('--mouse-x', `${event.clientX - rect.left}px`);
    shellRef.current?.style.setProperty('--mouse-y', `${event.clientY - rect.top}px`);
  }
  return <div ref={shellRef} className="app-shell" onPointerMove={moveSpotlight}>
    <div className="interactive-light" />
    <div className="grain" />
    <div className="fluid-field"><span/><span/><span/></div>
    <div className="particle-field">{particleSeeds.map((p) => <span key={p.index} style={{ left: p.left, animationDelay: p.delay, width: p.size, height: p.size, animationDuration: `${p.duration}s` }} />)}</div>
    <aside className="sidebar"><div className="brand"><motion.div className="brand-mark" whileHover={{ rotate: 180, scale: 1.08 }} transition={{ type: 'spring', stiffness: 180, damping: 12 }}><Bolt/></motion.div><div><h1>Velocity</h1><span>Monochrome Split Manager</span></div></div>
      <nav>{['all','active','waiting','complete','error'].map((f)=><motion.button whileHover={{ x: 6 }} whileTap={{ scale: .98 }} key={f} className={filter===f?'selected':''} onClick={()=>setFilter(f as typeof filter)}>{f}</motion.button>)}</nav>
      <div className="engine-card"><Wifi/><strong>aria2 engine</strong><span>v{snapshot.version.version}</span><small>{snapshot.version.enabledFeatures.slice(0,4).join(' • ')}</small></div>
    </aside>
    <main className="workspace"><header className="hero"><div><motion.p initial={{opacity:0, y: 8}} animate={{opacity:1, y: 0}} className="eyebrow"><Gauge size={18}/> monochrome fastest mode</motion.p><motion.h1 initial={{ opacity: 0, y: 20, filter: 'blur(12px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: .8 }}>Fluid black-and-white download control.</motion.h1><p>Trackpad-reactive panels, flowing particles, live speed sculpture, and user-controlled split downloads for Linux.</p></div><SpeedSculpture speed={snapshot.globalStat.downloadSpeed}/></header>
      <section className="stats"><motion.div whileHover={{ y: -6 }}><strong>{snapshot.globalStat.numActive}</strong><span>Active streams</span></motion.div><motion.div whileHover={{ y: -6 }}><strong>{snapshot.globalStat.numWaiting}</strong><span>Queued flow</span></motion.div><motion.div whileHover={{ y: -6 }}><strong>{snapshot.globalStat.numStopped}</strong><span>Finished/Stopped</span></motion.div><motion.div whileHover={{ y: -6 }}><strong>{formatSpeed(snapshot.globalStat.downloadSpeed)}</strong><span>Now moving</span></motion.div></section>
      <AddPanel onAdded={refresh}/>{error && <div className="banner">Engine warning: {error}</div>}
      <section className="downloads"><div className="section-title"><h2><Waves size={22}/> Downloads</h2><span>{filtered.length} items</span></div><AnimatePresence>{filtered.map(item => <DownloadCard key={item.gid} item={item} onRefresh={refresh}/>)}</AnimatePresence>{filtered.length===0 && <motion.div initial={{opacity:0, y: 12}} animate={{opacity:1, y: 0}} className="empty"><CheckCircle2 size={44}/><h3>No downloads here yet</h3><p>Paste a URL above. Velocity will ask aria2 to split it across your selected number of connections.</p></motion.div>}</section>
    </main>
  </div>;
}
