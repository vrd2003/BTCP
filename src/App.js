import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { BrowserProvider, Contract, formatEther, getAddress } from 'ethers';
import { BrowserRouter, useLocation, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import FlightRouteMap from './FlightRouteMap';
import flightSureAbi from './chain/FlightSure.json';
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, BadgeCheck, Bell,
  ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clock3,
  Copy, CreditCard, Fingerprint, Globe2, LayoutDashboard, LockKeyhole,
  ExternalLink, Menu, Plane, Plus, Radar, Search, Settings, Shield, ShieldCheck,
  Sparkles, Users, Wallet, Wind, X, Zap
} from 'lucide-react';
import { apiRequest, useApiQuery } from './api';
import AuthScreen from './AuthScreen';
import './App.css';

const navigation = [
  { label: 'Overview', icon: LayoutDashboard, group: 'Workspace' },
  { label: 'Find flights', icon: Search },
  { label: 'AI predictions', icon: Sparkles },
  { label: 'My insurance', icon: Shield },
  { label: 'Flight tracking', icon: Radar },
  { label: 'Verification', icon: Fingerprint, group: 'Transparency' },
  { label: 'Compensation', icon: CreditCard },
  { label: 'Wallet', icon: Wallet, group: 'Account' },
  { label: 'Settings', icon: Settings },
  { label: 'Admin dashboard', icon: Users, group: 'Admin tools', adminOnly: true }
];

const pageRoutes = {
  '/': 'Landing',
  '/app/overview': 'Overview',
  '/app/find-flights': 'Find flights',
  '/app/ai-predictions': 'AI predictions',
  '/app/my-insurance': 'My insurance',
  '/app/flight-tracking': 'Flight tracking',
  '/app/verification': 'Verification',
  '/app/compensation': 'Compensation',
  '/app/wallet': 'Wallet',
  '/app/settings': 'Settings',
  '/app/admin-dashboard': 'Admin dashboard'
};
const routePaths = Object.fromEntries(Object.entries(pageRoutes).map(([path, label]) => [label, path]));
const reveal = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: .45, ease: [.22, 1, .36, 1] } }
};

function Logo({ small = false }) {
  return <span className={`brand-lockup ${small ? 'brand-small' : ''}`}><span className="brand-mark"><ShieldCheck size={19} strokeWidth={2.2} /><i /></span><span className="brand-word">flight<span>sure</span></span></span>;
}

function StatusPill({ children, tone = 'cyan', dot = true }) {
  return <span className={`status-pill pill-${tone}`}>{dot && <i />}{children}</span>;
}

function ApiMessage({ loading, error, empty, children }) {
  if (loading) return <div className="api-state"><span className="api-spinner" />Connecting to FlightSure services…</div>;
  if (error) return <div className="api-state api-error-state"><CircleHelp size={17} /><span><strong>{error.message}</strong>{error.code === 'BACKEND_UNAVAILABLE' && <small>Start the backend and database, then try again.</small>}{error.code === 'FLIGHT_PROVIDER_UNAVAILABLE' && <small>The backend could not reach AviationStack. Check your provider access and API key; no flight data was stored.</small>}{error.code === 'FLIGHT_PROVIDER_DATE_FILTER_RESTRICTED' && <small>This AviationStack plan blocks date filtering. Try flight-number search or check your provider plan; no flight data was stored.</small>}</span></div>;
  if (empty) return <div className="api-state api-empty-state">{empty}</div>;
  return children;
}

function Toast({ message, onClose }) {
  return <motion.div className="toast" initial={{ opacity: 0, y: 12, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }}><span className="toast-icon"><BadgeCheck size={16} /></span><span>{message}</span><button className="icon-button toast-close" onClick={onClose} aria-label="Dismiss notification"><X size={15} /></button></motion.div>;
}

function Landing({ onEnter }) {
  const reduceMotion = useReducedMotion();
  const { data: readiness, loading, error } = useApiQuery('/health/ready', null);
  const flightConfigured = readiness?.flightSearchConfigured === true;
  return <main className="landing">
    <div className="landing-aurora" />
    <header className="landing-nav"><Logo /><nav className="landing-links"><a href="#how">How it works</a><a href="#technology">Our technology</a><a href="#trust">Trust & transparency</a></nav><button className="button button-outline nav-cta" onClick={onEnter}>Open app <ArrowUpRight size={15} /></button></header>
    <section className="hero"><div className="hero-grid" /><div className="hero-copy">
      <motion.div className="eyebrow hero-eyebrow" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}><span className="live-dot" /> FLIGHT PROTECTION, BUILT AROUND EVIDENCE</motion.div>
      <motion.h1 initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: .11 } } }}><motion.span variants={reveal}>Your flight delayed.</motion.span><motion.span className="gradient-heading" variants={reveal}>Your compensation secured.</motion.span></motion.h1>
      <motion.p className="hero-description" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .5 }}>A smarter way to travel protected. FlightSure connects live flight data, advisory AI and independent verification—with policy terms in control of every outcome.</motion.p>
      <motion.div className="hero-actions" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .65 }}><button className="button button-primary button-large" onClick={onEnter}>Explore FlightSure <ArrowRight size={16} /></button><a className="button button-quiet button-large" href="#how"><span className="play-icon">↓</span> See how it works</a></motion.div>
      <motion.div className="hero-proof" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .9 }}><span className="proof-lock"><LockKeyhole size={12} /> No prediction-triggered payouts</span><span className="proof-separator">·</span><span className="proof-lock"><Fingerprint size={12} /> Evidence before eligibility</span></motion.div>
    </div>
    <div className="sky-scene" aria-label="Illustration of an aircraft crossing a glowing flight path"><div className="sky-glow" /><div className="sky-orb orb-one" /><div className="sky-orb orb-two" /><div className="flight-path"><svg viewBox="0 0 690 345" preserveAspectRatio="none"><path d="M22 283 C173 242 147 115 320 158 S475 270 655 47" /><path className="path-dash" d="M22 283 C173 242 147 115 320 158 S475 270 655 47" /></svg></div><div className="path-beacon beacon-one" /><div className="path-beacon beacon-two" /><motion.div className="hero-plane" animate={reduceMotion ? {} : { x: [0, 22, 0], y: [0, -9, 0], rotate: [-9, -5, -9] }} transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}><Plane size={40} fill="currentColor" strokeWidth={1.2} /></motion.div><div className="cloud cloud-a" /><div className="cloud cloud-b" /><div className="runway"><span /><span /><span /><span /><span /><span /></div>
      <motion.div className="flight-float-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }}><div className="float-top"><span className="float-label"><span className="live-dot" /> FLIGHTSURE SERVICES</span><span className="service-dot"><i className={loading ? '' : error || !readiness?.status ? 'service-offline' : 'service-online'} /></span></div><div className="service-state-title">Route intelligence</div><div className="service-state-copy">{flightConfigured ? 'Flight data provider configured' : 'Waiting for flight data provider'}</div><div className="service-status-row"><span><Globe2 size={12} /> MongoDB API</span><StatusPill tone={loading ? 'slate' : error || !readiness?.status ? 'amber' : 'green'}>{loading ? 'Checking' : error || !readiness?.status ? 'Unavailable' : 'Ready'}</StatusPill></div></motion.div>
      <div className="sky-caption">PREDICT <span>·</span> VERIFY <span>·</span> RESOLVE</div><div className="scene-coordinates">FLIGHTSure · EVIDENCE FIRST</div>
    </div><div className="hero-bottom-note"><span>SCROLL TO EXPLORE</span><span className="scroll-line" /></div></section>
    <section className="trust-strip" id="trust"><span>TRUSTED DATA. CLEAR OUTCOMES.</span><div><span><Globe2 size={16} /> CONNECTED FLIGHT DATA</span><span><Fingerprint size={16} /> VERIFIABLE BY DESIGN</span><span><Shield size={16} /> POLICY-FIRST PROTECTION</span></div></section>
    <section className="landing-section how-section" id="how"><div className="section-intro"><span className="eyebrow"><span className="section-index">01</span> SIMPLE BY DESIGN</span><h2>Protection that moves<br />at the speed of <span className="text-gradient">travel.</span></h2><p>No forms after the fact. No chasing claims. A clear path from flight search to a verifiable policy outcome.</p></div><div className="steps-grid">{[[Search,'Find your flight','Search connected flight schedules and choose coverage when an eligible policy is available.'],[Sparkles,'Understand risk','Groq can provide an uncalibrated informational estimate from stored provider data.'],[Fingerprint,'Verify the facts','Authenticated, fresh independent data must agree before an event is verified.'],[Zap,'Apply policy terms','Compensation uses the terms fixed when an active policy is purchased.']].map(([Icon,title,copy],i)=><motion.article className="step-card" key={title} initial="hidden" whileInView="show" viewport={{ once:true,amount:.35 }} variants={reveal} transition={{ delay:i*.1 }}><span className="step-top"><span>{String(i+1).padStart(2,'0')} / 04</span><Icon size={18}/></span><div className="step-icon"><Icon size={19}/></div><h3>{title}</h3><p>{copy}</p><span className="step-connector"/></motion.article>)}</div></section>
    <section className="landing-section feature-section" id="technology"><div className="feature-heading"><span className="eyebrow"><span className="section-index">02</span> BUILT DIFFERENT</span><h2>More certainty.<br/><span className="text-gradient">Less turbulence.</span></h2><p>Intelligence, independent verification, and clear policy terms work together—not against you.</p></div><div className="feature-grid">{[{title:'A little more foresight.',tag:'PREDICT',copy:'Groq provides uncalibrated advisory estimates from stored provider data when configured.',accent:'violet',visual:<div className="feature-orbit"><span/><span/><Sparkles size={20}/></div>},{title:'Protection that is clear.',tag:'PROTECT',copy:'See configured coverage terms and your own policy status—never an invented policy.',accent:'cyan',visual:<div className="feature-shield"><ShieldCheck size={38}/><span>POLICY TERMS</span></div>},{title:'Evidence you can follow.',tag:'VERIFY',copy:'Independent reports are freshness-checked and compared before consensus can be stated.',accent:'green',visual:<div className="feature-nodes"><i/><i/><i/><span>INDEPENDENT DATA</span></div>}].map((item,i)=><motion.article key={item.title} className={`feature-card feature-${item.accent}`} initial="hidden" whileInView="show" viewport={{once:true}} variants={reveal} transition={{delay:i*.12}}><div className="feature-visual">{item.visual}</div><div className="feature-card-copy"><span className="eyebrow">{item.tag}</span><h3>{item.title}</h3><p>{item.copy}</p></div><ArrowUpRight size={16} className="feature-arrow"/></motion.article>)}</div></section>
    <section className="landing-cta"><div className="cta-glow"/><span className="eyebrow"><span className="live-dot"/> YOUR NEXT JOURNEY, REIMAGINED</span><h2>Go further.<br/><span className="text-gradient">Worry less.</span></h2><p>Sign in to see connected account data and service availability.</p><button className="button button-primary button-large" onClick={onEnter}>Explore FlightSure <ArrowRight size={16}/></button><span className="demo-note">No flight, policy, verification or payout records are preloaded.</span></section>
    <footer className="landing-footer"><Logo small/><span>FlightSure · Travel with a little more certainty.</span><span className="footer-demo"><i/> SERVICE-CONNECTED PREVIEW</span></footer>
  </main>;
}

function App() {
  return <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AppShell/></BrowserRouter>;
}

function AppShell() {
  const location = useLocation();
  const routerNavigate = useNavigate();
  const page = pageRoutes[location.pathname] || 'Landing';
  const reduceMotion = useReducedMotion();
  const [token, setToken] = useState(() => sessionStorage.getItem('accessToken') || '');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [toast, setToast] = useState('');
  const [modal, setModal] = useState('');
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationsRefresh, setNotificationsRefresh] = useState(0);
  const [socketConnected, setSocketConnected] = useState(false);
  const [walletSession, setWalletSession] = useState(null);
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [userPatch, setUserPatch] = useState({});
  const session = useApiQuery(token ? '/auth/me' : null, token);
  const notifications = useApiQuery(token && notificationOpen ? '/notifications' : null, token, notificationsRefresh);
  const user = session.data?.user ? { ...session.data.user, ...userPatch } : null;

  const notify = useCallback(message => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3500);
  }, []);
  const navigate = label => {
    routerNavigate(routePaths[label] || '/');
    setMobileSidebar(false);
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  };
  const acceptAuthentication = result => {
    sessionStorage.setItem('accessToken', result.accessToken);
    setUserPatch({});
    setToken(result.accessToken);
    routerNavigate(routePaths.Overview);
  };
  const signOut = async () => {
    try {
      await apiRequest('/auth/logout', { token, method: 'POST' });
    } catch (error) {
      notify(`The server could not invalidate the session: ${error.message}`);
    } finally {
      sessionStorage.removeItem('accessToken');
      setToken('');
      setWalletSession(null);
      setSelectedFlight(null);
      setUserPatch({});
      routerNavigate('/');
    }
  };
  const connectWallet = async () => {
    if (!window.ethereum) {
      notify('No browser wallet detected. Install MetaMask to connect.');
      return;
    }
    try {
      const provider = new BrowserProvider(window.ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      if (!accounts.length) throw new Error('The wallet returned no accounts.');
      const address = getAddress(accounts[0]);
      const challenge = await apiRequest('/wallet/nonce', { token, method: 'POST', body: { address } });
      const signer = await provider.getSigner(address);
      const signature = await signer.signMessage(challenge.message);
      const verified = await apiRequest('/wallet/verify', { token, method: 'POST', body: { address, signature } });
      const [balance, network] = await Promise.all([provider.getBalance(address), provider.getNetwork()]);
      setWalletSession({ address, network: `${network.name === 'unknown' ? 'Chain' : network.name} · ${network.chainId}`, balance: `${Number(formatEther(balance)).toFixed(4)} ${network.name === 'homestead' ? 'ETH' : 'native'}` });
      setModal('');
      notify(`Wallet ownership verified: ${address.slice(0,6)}…${address.slice(-4)}`);
      if (verified.user) window.dispatchEvent(new CustomEvent('flightsure:user-updated', { detail: verified.user }));
    } catch (error) {
      notify(error.code === 4001 ? 'Wallet connection was declined.' : `Wallet connection failed: ${error.message}`);
    }
  };
  useEffect(() => {
    const injected = window.ethereum;
    if (!injected || !user?.walletAddress) return undefined;
    let active = true;
    const refresh = async accounts => {
      if (!active) return;
      if (!accounts.some(account => account.toLowerCase() === user.walletAddress.toLowerCase())) {
        setWalletSession(null);
        return;
      }
      try {
        const provider = new BrowserProvider(injected);
        const address = getAddress(accounts[0]);
        const [balance, network] = await Promise.all([provider.getBalance(address), provider.getNetwork()]);
        if (active) setWalletSession({ address, network: `${network.name === 'unknown' ? 'Chain' : network.name} · ${network.chainId}`, balance: `${Number(formatEther(balance)).toFixed(4)} ${network.name === 'homestead' ? 'ETH' : 'native'}` });
      } catch (error) {
        notify(`Wallet balance refresh failed: ${error.message}`);
      }
    };
    injected.request({ method: 'eth_accounts' }).then(refresh).catch(error => notify(`Wallet status could not be refreshed: ${error.message}`));
    const refreshNetwork = () => injected.request({ method: 'eth_accounts' }).then(refresh).catch(error => notify(`Wallet status could not be refreshed: ${error.message}`));
    injected.on?.('accountsChanged', refresh);
    injected.on?.('chainChanged', refreshNetwork);
    return () => { active = false; injected.removeListener?.('accountsChanged', refresh); injected.removeListener?.('chainChanged', refreshNetwork); };
  }, [user?.walletAddress, notify]);
  useEffect(() => {
    if (session.error?.status === 401) {
      sessionStorage.removeItem('accessToken');
      setToken('');
      setWalletSession(null);
    }
  }, [session.error]);
  useEffect(() => {
    const updateUser = event => setUserPatch(event.detail);
    window.addEventListener('flightsure:user-updated', updateUser);
    return () => window.removeEventListener('flightsure:user-updated', updateUser);
  }, []);
  useEffect(() => {
    if (!token) return undefined;
    const socket = io(process.env.REACT_APP_SOCKET_URL || 'http://localhost:4000', {
      auth: { token },
      reconnectionAttempts: 5,
      timeout: 5000
    });
    socket.on('connect', () => setSocketConnected(true));
    socket.on('disconnect', () => setSocketConnected(false));
    socket.on('connect_error', () => setSocketConnected(false));
    socket.on('notification:new', notification => {
      setNotificationsRefresh(value => value + 1);
      setToast(notification.title || 'Your account has a new update.');
      window.setTimeout(() => setToast(''), 3500);
    });
    return () => {
      socket.disconnect();
      setSocketConnected(false);
    };
  }, [token]);

  if (page === 'Landing') return <><Landing onEnter={() => navigate('Overview')}/>{toast&&<AnimatePresence><Toast message={toast} onClose={()=>setToast('')}/></AnimatePresence>}</>;
  if (!token) return <AuthScreen onAuthenticated={acceptAuthentication} onBack={()=>navigate('Landing')}/>;
  if (session.loading || (!user && !session.error)) return <div className="app-loading"><span className="api-spinner"/>Loading your account…</div>;
  if (session.error && session.error.status !== 401) return <div className="app-loading app-loading-error"><CircleHelp size={18}/><strong>{session.error.message}</strong><button className="button button-outline" onClick={()=>window.location.reload()}>Retry</button><button className="text-button" onClick={signOut}>Sign out</button></div>;
  if (!user) return <AuthScreen onAuthenticated={acceptAuthentication} onBack={()=>navigate('Landing')}/>;
  const isAdmin = user.role === 'Admin';
  const visibleNavigation = navigation.filter(item => !item.adminOnly || isAdmin);
  const markRead = async notification => {
    try {
      await apiRequest(`/notifications/${notification._id}/read`, { token, method: 'PATCH' });
      setNotificationOpen(false);
      notify('Notification marked as read.');
    } catch (error) {
      notify(error.message);
    }
  };
  return <div className={`app-shell ${sidebarOpen?'':'sidebar-collapsed'}`}>
    <AnimatePresence>{mobileSidebar&&<motion.div className="mobile-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>setMobileSidebar(false)}/>}</AnimatePresence>
    <aside className={`sidebar ${mobileSidebar?'mobile-open':''}`}><div className="sidebar-brand"><button className="brand-button" onClick={()=>navigate('Landing')} aria-label="Go to FlightSure home"><Logo/></button><button className="icon-button sidebar-collapse" onClick={()=>setSidebarOpen(!sidebarOpen)} aria-label="Collapse sidebar"><ChevronLeft size={16}/></button></div>
      <button className="workspace-switch" onClick={()=>navigate(isAdmin&&page!=='Admin dashboard'?'Admin dashboard':'Overview')}><span className="workspace-avatar"><Plane size={15}/></span><span className="workspace-label"><strong>{isAdmin?'FlightSure workspace':'Passenger space'}</strong><small>{isAdmin?'Admin access':user.email}</small></span><ChevronDown size={14}/></button>
      <div className="sidebar-nav">{visibleNavigation.map((item,index)=><div key={item.label}>{item.group&&<div className={`nav-group ${index?'':'nav-group-first'}`}>{item.group}</div>}<button className={`nav-item ${page===item.label?'nav-active':''}`} onClick={()=>navigate(item.label)} title={item.label}><item.icon size={16} strokeWidth={1.8}/><span>{item.label}</span></button></div>)}</div>
      <div className="sidebar-bottom"><button className="help-card" onClick={()=>setModal('help')}><span className="help-icon"><CircleHelp size={15}/></span><span><strong>Need a hand?</strong><small>Explore API-backed help</small></span><ArrowUpRight size={13}/></button><button className="profile-button" onClick={()=>navigate('Settings')}><span className="profile-avatar">{user.name?.slice(0,1).toUpperCase()}</span><span><strong>{user.name}</strong><small>{user.role}</small></span><ChevronDown size={14}/></button></div>
    </aside>
    <main className="app-main"><header className="topbar"><div className="topbar-left"><button className="icon-button mobile-menu" onClick={()=>setMobileSidebar(true)} aria-label="Open menu"><Menu size={18}/></button><div className="breadcrumbs"><button onClick={()=>navigate('Overview')}>Workspace</button><ChevronRight size={13}/><span>{page}</span></div></div><div className="topbar-actions"><span className="environment-badge"><i className={socketConnected?'connection-online':''}/>{socketConnected?'REAL-TIME CONNECTED':'ACCOUNT DATA'}</span><span className="top-divider"/><button className="icon-button notification-button" aria-label="Notifications" onClick={()=>setNotificationOpen(!notificationOpen)}><Bell size={17}/></button><button className="wallet-connect" onClick={()=>walletSession?navigate('Wallet'):setModal('wallet')}><Wallet size={15}/>{walletSession?`${walletSession.address.slice(0,6)}…${walletSession.address.slice(-4)}`:user.walletAddress?'Verify linked wallet':'Connect wallet'}</button>
      {notificationOpen&&<div className="notification-popover"><strong>Notifications</strong><ApiMessage loading={notifications.loading} error={notifications.error} empty={notifications.data?.notifications?.length===0?'No notifications yet.':null}>{notifications.data?.notifications?.map(item=><button className="notification-item" key={item._id} onClick={()=>markRead(item)}><span className={item.read?'':'notification-unread'}/><span><b>{item.title}</b><small>{item.message}</small></span></button>)}</ApiMessage></div>}
    </div></header>
      <div className="page-content"><AnimatePresence mode="wait"><motion.div key={page} className="page-transition" initial={{opacity:0,y:reduceMotion?0:7}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-4}} transition={{duration:.22}}>
        {page==='Overview'&&<Overview token={token} user={user} navigate={navigate}/>}
        {page==='Find flights'&&<FlightSearch token={token} onSelectFlight={flight=>{setSelectedFlight(flight);navigate('AI predictions');}}/>}
        {page==='AI predictions'&&<Predictions token={token} selectedFlight={selectedFlight}/>}
        {page==='My insurance'&&<Insurance token={token} notify={notify} selectedFlight={selectedFlight} user={user} connectWallet={()=>setModal('wallet')}/>}
        {page==='Flight tracking'&&<Tracking token={token}/>}
        {page==='Verification'&&<Verification token={token}/>}
        {page==='Compensation'&&<Compensation token={token} notify={notify}/>}
        {page==='Wallet'&&<WalletPage token={token} walletSession={walletSession} user={user} setModal={setModal} connectWallet={connectWallet} notify={notify}/>}
        {page==='Settings'&&<SettingsPage token={token} user={user} signOut={signOut} notify={notify}/>}
        {page==='Admin dashboard'&&isAdmin&&<AdminDashboard token={token} notify={notify}/>}
        {page==='Admin dashboard'&&!isAdmin&&<AccessDenied/>}
      </motion.div></AnimatePresence></div>
    </main>
    <AnimatePresence>{toast&&<Toast message={toast} onClose={()=>setToast('')}/>}</AnimatePresence>
    <AnimatePresence>{modal&&<Modal type={modal} onClose={()=>setModal('')} connectWallet={connectWallet} user={user}/>}</AnimatePresence>
  </div>;
}

function PageHeading({eyebrow,title,copy,action}) {
  return <div className="page-heading"><div><div className="eyebrow"><span className="live-dot"/>{eyebrow}</div><h1>{title}</h1>{copy&&<p>{copy}</p>}</div>{action}</div>;
}

function Metric({label,value,note,icon:Icon,tone='cyan'}) {
  return <motion.article className="metric-card" whileHover={{y:-3,transition:{duration:.18}}}><div className="metric-top"><span>{label}</span><span className={`metric-icon metric-${tone}`}><Icon size={15}/></span></div><div className="metric-value">{value}</div><div className="metric-note">{note}</div></motion.article>;
}

function formatTime(value) {
  return value ? new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit',timeZone:'UTC'}).format(new Date(value)) : '—';
}
function formatDate(value) {
  return value ? new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(value)) : 'Date unavailable';
}
function formatMoneyMinor(amountMinor,currency) {
  if (!Number.isFinite(amountMinor)||!currency) return '—';
  if (currency === 'ETH') return `${formatEther(BigInt(amountMinor))} ETH`;
  return new Intl.NumberFormat(undefined,{style:'currency',currency}).format(amountMinor/100);
}
function statusTone(value) {
  if (['ACTIVE','CONFIRMED','ARRIVED','LANDED','VERIFIED','ELIGIBLE'].includes(String(value).toUpperCase())) return 'green';
  if (['FAILED','CANCELLED','REJECTED','INELIGIBLE'].includes(String(value).toUpperCase())) return 'amber';
  return 'slate';
}

function Overview({token,user,navigate}) {
  const {data,error,loading}=useApiQuery('/dashboard/overview',token);
  const overview=data||{};
  const flights=overview.flights||[];
  const policies=overview.policies||[];
  const metrics=overview.metrics||{};
  const today=new Intl.DateTimeFormat(undefined,{weekday:'long',month:'long',day:'numeric'}).format(new Date());
  return <div className="overview-page"><PageHeading eyebrow={today.toUpperCase()} title={`Welcome, ${user.name}.`} copy="Your account overview, retrieved from FlightSure services." action={<button className="button button-primary" onClick={()=>navigate('Find flights')}><Plus size={16}/> Find a flight</button>}/>
    <ApiMessage loading={loading} error={error}><div className="metrics-grid"><Metric label="Active policies" value={metrics.activePolicies??'—'} note="From your account records" icon={ShieldCheck} tone="cyan"/><Metric label="Monitored flights" value={metrics.monitoredFlights??'—'} note="Flights linked to your policies" icon={Radar} tone="violet"/><Metric label="Confirmed compensation" value={metrics.confirmedCompensation?.length?metrics.confirmedCompensation.map(item=>formatMoneyMinor(item.totalMinor,item._id)).join(' · '):'—'} note="Only confirmed transactions" icon={CreditCard} tone="green"/><Metric label="Pending verification" value={metrics.pendingVerification??'—'} note="Awaiting verified sources" icon={Fingerprint} tone="amber"/></div>
      <div className="content-grid overview-grid"><section className="panel upcoming-panel"><div className="panel-heading"><div><span className="eyebrow">YOUR TRAVEL</span><h2>Policy flights <span className="heading-count">{flights.length}</span></h2></div><button className="text-button" onClick={()=>navigate('My insurance')}>View policies <ArrowRight size={14}/></button></div>
        {flights.length?flights.map(flight=><FlightCard key={flight._id} flight={flight} policy={policies.find(item=>item.flightId?._id===flight._id)} onTrack={()=>navigate('Flight tracking')}/>):<div className="panel-empty"><Plane size={17}/><strong>No insured flights yet</strong><span>Search for a flight; coverage appears here only after a policy is confirmed.</span><button className="text-button" onClick={()=>navigate('Find flights')}>Find flights <ArrowRight size={13}/></button></div>}
        <button className="add-flight-row" onClick={()=>navigate('Find flights')}><span><Plus size={15}/></span>Find a flight</button></section>
        <section className="panel prediction-panel"><div className="panel-heading"><div><span className="eyebrow">HISTORY FROM YOUR ACCOUNT</span><h2>Delay history</h2></div><span className="service-chip">API DATA</span></div><div className="history-empty"><Activity size={18}/><strong>{overview.delayHistory?.length?'History available':'No delay history yet'}</strong><span>{overview.delayHistory?.length?'Historical records are available through the flight history API.':'This chart will appear when real, verified flight observations are available.'}</span></div><div className="chart-footnote"><span><Wind size={13}/> Verified observations only</span><span>No synthetic series</span></div></section></div>
      <div className="content-grid lower-grid"><section className="panel activity-panel"><div className="panel-heading"><div><span className="eyebrow">ACCOUNT UPDATES</span><h2>Recent activity</h2></div><button className="text-button" onClick={()=>navigate('Compensation')}>Compensation <ArrowRight size={14}/></button></div>{overview.recentActivity?.length?<div className="activity-list">{overview.recentActivity.map(item=><div className="activity-item" key={item._id}><span className="activity-icon activity-cyan"><Activity size={14}/></span><span className="activity-copy"><strong>{item.title}</strong><small>{item.message}</small></span><span className="activity-time">{formatDate(item.createdAt)}</span></div>)}</div>:<div className="activity-empty">No activity has been recorded for this account.</div>}</section>
        <section className="panel trust-panel"><div className="panel-heading"><div><span className="eyebrow">THE FLIGHTSURE WAY</span><h2>Built on trust, not guesses.</h2></div></div><p>Predictions can be helpful. But they never decide a payout. Only timely, independent and agreed flight data can support verification against your policy.</p><div className="trust-steps"><span><i>01</i> Predict risk</span><ArrowRight size={13}/><span><i>02</i> Verify facts</span><ArrowRight size={13}/><span><i>03</i> Apply policy</span></div><button className="text-button" onClick={()=>navigate('Verification')}>Explore verification <ArrowRight size={14}/></button></section></div>
    </ApiMessage>
  </div>;
}

function FlightCard({flight,policy,onTrack}) {
  return <article className="flight-card"><div className="flight-card-top"><div className="airline-mark"><Plane size={16}/></div><div className="airline-info"><strong>{flight.airline||flight.flightNumber}</strong><small>{flight.flightNumber} <span>·</span> {formatDate(flight.scheduledDeparture)}</small></div><StatusPill tone={statusTone(flight.status)}>{flight.status||'Status unavailable'}</StatusPill></div><div className="flight-route-row"><div><strong>{flight.origin||'—'}</strong><small>{formatTime(flight.scheduledDeparture)}</small></div><div className="route-track"><span/><i><Plane size={12}/></i><span/></div><div className="route-arrival"><strong>{flight.destination||'—'}</strong><small>{formatTime(flight.scheduledArrival)}</small></div></div><div className="flight-card-footer"><span><ShieldCheck size={13}/>{policy?.status||'No active policy'}</span><button className="icon-button flight-open" onClick={onTrack} aria-label={`View ${flight.flightNumber} status`}><ArrowUpRight size={14}/></button></div></article>;
}

function FlightSearch({token,onSelectFlight}) {
  const [origin,setOrigin]=useState('');
  const [destination,setDestination]=useState('');
  const [date,setDate]=useState('');
  const [flightNumber,setFlightNumber]=useState('');
  const [searchMode,setSearchMode]=useState('route');
  const [search,setSearch]=useState(null);
  const [query,setQuery]=useState('');
  const [validationError,setValidationError]=useState('');
  const params=useMemo(()=>search?`/flights/search?${new URLSearchParams(search)}`:null,[search]);
  const {data,error,loading}=useApiQuery(params,token);
  const results=(data?.flights||[]).filter(flight=>`${flight.airline||''} ${flight.flightNumber||''}`.toLowerCase().includes(query.toLowerCase()));
  const submit=event=>{event.preventDefault();setValidationError('');if(searchMode==='flight'){const normalized=flightNumber.replace(/\s+/g,'').toUpperCase();if(!/^[A-Z0-9]{2,3}\d{1,4}[A-Z]?$/.test(normalized)){setValidationError('Enter a flight number such as BA117 or U2123.');return;}setSearch({flightNumber:normalized});return;}if(!/^[A-Z]{3}$/.test(origin)||!/^[A-Z]{3}$/.test(destination)||!date){setValidationError('Enter valid three-letter airport codes and a departure date.');return;}setSearch({origin,destination,date});};
  const changeMode=mode=>{setSearchMode(mode);setSearch(null);setValidationError('');};
  return <div className="search-page"><PageHeading eyebrow="CONNECTED FLIGHT SEARCH" title="Find your flight." copy="Search the configured flight-data provider. Provider limitations and missing schedule data are reported explicitly."/>
    <form className="search-panel panel" onSubmit={submit}><div className="search-panel-top"><div><span className="eyebrow">FLIGHT SEARCH</span><h2>Find a flight by route or number.</h2></div><span className="service-chip">LIVE PROVIDER</span></div><div className="flight-search-modes" role="group" aria-label="Flight search mode"><button type="button" className={`search-mode-button ${searchMode==='route'?'active':''}`} aria-pressed={searchMode==='route'} onClick={()=>changeMode('route')}>Route and date</button><button type="button" className={`search-mode-button ${searchMode==='flight'?'active':''}`} aria-pressed={searchMode==='flight'} onClick={()=>changeMode('flight')}>Flight number</button></div>{searchMode==='route'?<><div className="search-fields"><AirportInput label="FROM" value={origin} onChange={setOrigin}/><span className="search-route-arrow"><ArrowRight size={15}/></span><AirportInput label="TO" value={destination} onChange={setDestination}/><div className="date-picker"><label htmlFor="flight-departure-date">DEPARTURE</label><input id="flight-departure-date" type="date" value={date} onChange={event=>setDate(event.target.value)} required/></div></div><p className="flight-search-note">If your provider plan restricts date searches, try flight-number search instead.</p></>:<div className="flight-number-search"><label htmlFor="flight-number-search">FLIGHT NUMBER</label><input id="flight-number-search" placeholder="e.g. BA117" autoComplete="off" maxLength={12} value={flightNumber} onChange={event=>setFlightNumber(event.target.value.toUpperCase())} required/><small>Schedules and status are shown as returned by the provider; no travel date is assumed.</small></div>}{validationError&&<div className="auth-error" role="alert">{validationError}</div>}<div className="search-action-row"><span><LockKeyhole size={13}/>Flight availability depends on your configured provider.</span><button className="button button-primary" disabled={loading}>{loading?<><span className="button-spinner"/>Searching…</>:<>Search flights <ArrowRight size={15}/></>}</button></div></form>
    <div className="results-heading"><div><span className="eyebrow">PROVIDER RESULTS</span><h2>{search?(search.flightNumber?`Flight ${search.flightNumber}`:`${origin} to ${destination}`):'Search to view flights'} <span className="heading-count">{results.length}</span></h2></div>{data?.flights?.length>0&&<label className="flight-filter"><Search size={14}/><input placeholder="Filter airline or flight" value={query} onChange={event=>setQuery(event.target.value)}/></label>}</div>
    <ApiMessage loading={loading} error={error} empty={search&&!error&&!loading&&!data?.flights?.length?'The configured provider returned no matching flights. Try another date or route.' : !search?'Search results will appear here after you query a connected provider.':null}><div className="search-results">{results.map(flight=><FlightResult key={flight._id} flight={flight} onSelect={() => onSelectFlight(flight)}/>)}</div></ApiMessage>
    <div className="route-visual panel"><div className="route-visual-copy"><span className="eyebrow">OPEN MAP ROUTE</span><h3>{origin||'---'} <span>to</span> {destination||'---'}</h3><p>Airport coordinates come from a bundled open airport directory. No live aircraft position is implied.</p></div><FlightRouteMap origin={origin} destination={destination}/></div>
  </div>;
}

function AirportInput({label,value,onChange}) {
  return <div className="airport-picker"><label>{label}</label><input className="airport-code-input" aria-label={`${label} airport code`} autoComplete="off" maxLength={3} minLength={3} pattern="[A-Za-z]{3}" placeholder="IATA" value={value} onChange={event=>onChange(event.target.value.toUpperCase())} required/><span className="airport-code-help">Airport code, e.g. JFK (not a country)</span></div>;
}

function FlightResult({flight,onSelect}) {
  return <article className="result-card panel"><div className="result-airline"><Plane size={17}/></div><div className="result-airline-name"><strong>{flight.airline||'Airline unavailable'}</strong><small>{flight.flightNumber}</small></div><div className="result-time"><strong>{formatTime(flight.scheduledDeparture)}</strong><span>{flight.origin||'—'}</span></div><div className="result-duration"><span>{flight.scheduledDeparture&&flight.scheduledArrival?`${Math.max(0,Math.round((new Date(flight.scheduledArrival)-new Date(flight.scheduledDeparture))/60000))} min`:'—'}</span><div><i/><span/><i/></div><small>SCHEDULE</small></div><div className="result-time"><strong>{formatTime(flight.scheduledArrival)}</strong><span>{flight.destination||'—'}</span></div><div className="result-risk"><span className="risk-dot risk-slate"/>{flight.status||'Status unavailable'}<small>{flight.lastFetchedAt?`Updated ${formatDate(flight.lastFetchedAt)}`:'Provider timestamp unavailable'}</small></div><button className="button button-outline result-button" onClick={onSelect}>Assess delay risk <ArrowRight size={13}/></button></article>;
}

function PoliciesFlightPicker({policies,onSelect,value}) {
  const flights=[...new Map((policies||[]).filter(item=>item.flightId?._id).map(item=>[item.flightId._id,item.flightId])).values()];
  if(!flights.length)return <div className="api-state api-empty-state">No policy-linked flights are available for this account.</div>;
  return <select className="select-small flight-picker-select" value={value||''} onChange={event=>onSelect(event.target.value)}><option value="" disabled>Select a policy flight</option>{flights.map(flight=><option key={flight._id} value={flight._id}>{flight.flightNumber} · {flight.origin} → {flight.destination}</option>)}</select>;
}

function Predictions({token,selectedFlight}) {
  const recent=useApiQuery('/flights/recent?limit=50',token);
  const history=useApiQuery('/predictions/history',token);
  const [flightId,setFlightId]=useState(selectedFlight?._id||'');
  const [prediction,setPrediction]=useState(null);
  const [requestError,setRequestError]=useState(null);
  const [busy,setBusy]=useState(false);
  const validFlightId=/^[a-f\d]{24}$/i.test(flightId);
  const submit=async()=>{if(!validFlightId){setRequestError({message:'Select a stored flight before requesting a prediction.'});return;}setBusy(true);setRequestError(null);try{const result=await apiRequest('/predictions',{token,method:'POST',body:{flightId}});setPrediction(result.prediction);}catch(error){setRequestError(error);}finally{setBusy(false);}};
  const selected=recent.data?.flights?.find(flight=>flight._id===flightId) || (selectedFlight?._id===flightId?selectedFlight:null);
  const weather=useApiQuery(selected?`/flights/${selected._id}/weather`:null,token);
  const current=prediction||history.data?.predictions?.[0];
  return <div className="predictions-page">
    <PageHeading eyebrow="INTELLIGENCE, WITH CONTEXT" title="A signal, not a promise." copy="Groq provides a heuristic estimate from stored flight-provider data; it is not trained, calibrated, or used to decide compensation."/>
    <section className="panel prediction-request">
      <div className="panel-heading"><div><span className="eyebrow">GROQ ESTIMATE</span><h2>Choose a recently fetched flight.</h2></div><span className="service-chip">UNCALIBRATED · INFORMATIONAL</span></div>
      <div className="prediction-form">
        <ApiMessage loading={recent.loading} error={recent.error}>
          <select className="select-small flight-picker-select" value={flightId} onChange={event=>{setFlightId(event.target.value);setRequestError(null);}}>
            <option value="">Select a fetched flight</option>
            {recent.data?.flights?.map(flight=><option key={flight._id} value={flight._id}>{flight.flightNumber} · {flight.origin} → {flight.destination} · {formatDate(flight.scheduledDeparture)}</option>)}
          </select>
        </ApiMessage>
        <button className="button button-primary" onClick={submit} disabled={!validFlightId||busy}>
          {busy?<><span className="button-spinner"/>Requesting Groq estimate…</>:<>Request Groq estimate <ArrowRight size={14}/></>}
        </button>
      </div>
      {requestError&&<div className="auth-error" role="alert">{requestError.message}</div>}
      {selected&&weather.error?.code==='WEATHER_NOT_CONFIGURED'&&<small className="weather-unavailable">Current airport weather context is not configured. It is not included in this estimate.</small>}
    </section>
    <div className="prediction-layout">
      <section className="panel risk-panel">
        <div className="panel-heading"><div><span className="eyebrow">GROQ HEURISTIC · NOT CALIBRATED</span><h2>{selected?.flightNumber||current?.flightId?.flightNumber||'No selected flight'}</h2></div><span className="service-chip">INFORMATIONAL</span></div>
        <ApiMessage loading={history.loading} error={history.error} empty={!current?'No Groq estimate is available yet. Select a stored flight and request an estimate to see it here.':null}>
          {current&&<div className="prediction-output">
            <div className="prediction-number">{Math.round(current.delayProbability*100)}<span>%</span></div>
            <StatusPill tone={current.riskLevel==='HIGH'?'amber':current.riskLevel==='LOW'?'green':'violet'}>{current.riskLevel}</StatusPill>
            <div className="confidence-row"><span>Model</span><strong>{current.modelVersion}</strong></div>
            <div className="confidence-row"><span>Estimate type</span><strong>{['GROQ_HEURISTIC','GROK_HEURISTIC'].includes(current.modelMode)?'Uncalibrated heuristic':current.modelMode}</strong></div>
            <div className="confidence-row"><span>Requested at</span><strong>{formatDate(current.predictionTime)}</strong></div>
            {current.rationale&&<p className="prediction-rationale">{current.rationale}</p>}
          </div>}
        </ApiMessage>
      </section>
      <section className="panel factors-panel">
        <div className="panel-heading"><div><span className="eyebrow">PREDICTION HISTORY</span><h2>Your Groq estimates</h2></div></div>
        <ApiMessage loading={history.loading} error={history.error} empty={!history.data?.predictions?.length?'No estimates recorded. They never establish a verified flight event.':null}>
          {history.data?.predictions?.map(item=><div className="factor-row" key={item._id}><div className="factor-icon"><Sparkles size={15}/></div><div className="factor-copy"><strong>{item.flightId?.flightNumber||'Flight'}</strong><small>{item.modelVersion} · {formatDate(item.predictionTime)}</small></div><StatusPill dot={false} tone={item.riskLevel==='HIGH'?'amber':'cyan'}>{item.riskLevel} · {Math.round(item.delayProbability*100)}%</StatusPill></div>)}
        </ApiMessage>
      </section>
    </div>
    <WeatherContext weather={weather}/>
    <div className="prediction-disclaimer"><span><CircleHelp size={16}/></span><div><strong>Groq estimates are not calibrated flight forecasts.</strong><p>They use only the stored flight-provider record and may be inaccurate. Current weather and historical delay statistics are not included. Compensation is determined only by verified flight events and the active policy; Groq never triggers compensation.</p></div></div>
  </div>;
}

function WeatherContext({weather}) {
  if (!weather.data && !weather.loading && (!weather.error || weather.error.code === 'WEATHER_NOT_CONFIGURED')) return null;
  return <section className="panel weather-context">
    <div className="panel-heading"><div><span className="eyebrow">OPENWEATHER · OBSERVED CONDITIONS</span><h2>Airport weather context</h2></div><span className="service-chip">NOT A FLIGHT FORECAST</span></div>
    <ApiMessage loading={weather.loading} error={weather.error}>
      <div className="weather-airports">{weather.data?.weather?.airports?.map(report=><article className="weather-airport" key={report.airport}><span className="eyebrow">{report.airport} · {report.city||'Airport'}</span><strong>{report.temperatureC}°C · {report.condition}</strong><span>{report.description} · Wind {report.windSpeedMps} m/s</span><small>{report.freshness==='CURRENT'?'Observed':'Stale observation'} · {formatDate(report.observedAt)} · {formatTime(report.observedAt)} UTC</small></article>)}</div>
    </ApiMessage>
    <p>These are current observations near the airports, not weather at the scheduled flight time and not inputs to compensation eligibility.</p>
  </section>;
}

function Insurance({token,notify,selectedFlight,user,connectWallet}) {
  const [refreshKey,setRefreshKey]=useState(0);
  const [flightId,setFlightId]=useState(selectedFlight?._id||'');
  const [acceptedTerms,setAcceptedTerms]=useState(false);
  const [busyPlan,setBusyPlan]=useState('');
  const [error,setError]=useState('');
  const [transactionStatus,setTransactionStatus]=useState('');
  const catalog=useApiQuery('/policies/catalog',token);
  const policies=useApiQuery('/policies',token,refreshKey);
  const recent=useApiQuery('/flights/recent?limit=50',token);
  const flights=recent.data?.flights||[];
  const flight=flights.find(item=>item._id===flightId)||(selectedFlight?._id===flightId?selectedFlight:null);
  const purchase=async plan=>{
    setError('');
    setTransactionStatus('');
    if(!flight){setError('Search for and select a real provider flight before buying coverage.');return;}
    if(!user.walletAddress){setError('Link and verify a wallet before purchasing coverage.');return;}
    if(!window.ethereum){setError('No browser wallet is available. Install MetaMask to continue.');return;}
    if(!plan.purchaseEnabled){setError('Sepolia purchase is unavailable until the deployed contract and RPC are configured in the backend.');return;}
    setBusyPlan(plan.planId);
    try{
      const idempotencyKey=window.crypto.randomUUID();
      const intent=await apiRequest('/policies',{token,method:'POST',body:{planId:plan.planId,flightId:flight._id,idempotencyKey}});
      const provider=new BrowserProvider(window.ethereum);
      const network=await provider.getNetwork();
      if(network.chainId!==BigInt(intent.chainId))throw new Error(`Switch your wallet to Sepolia (chain ${intent.chainId}) before continuing.`);
      const signer=await provider.getSigner();
      const address=getAddress(await signer.getAddress());
      if(address.toLowerCase()!==user.walletAddress.toLowerCase())throw new Error('The active wallet does not match your verified FlightSure wallet.');
      const contract=new Contract(intent.contractAddress,flightSureAbi,signer);
      const transaction=await contract.purchasePolicy(
        intent.flightKey,
        intent.scheduledArrival,
        intent.scheduledDeparture,
        intent.scheduledArrival,
        intent.coverageThresholdMinutes,
        intent.maximumPayoutWei,
        intent.tierDelayMinutes,
        intent.tierAmountsWei,
        {value:intent.premiumWei}
      );
      setTransactionStatus(`Transaction submitted: ${transaction.hash}`);
      const receipt=await transaction.wait(1);
      if(receipt.status!==1)throw new Error('The policy transaction was not confirmed successfully.');
      const result=await apiRequest('/policies/confirm',{token,method:'POST',body:{planId:plan.planId,flightId:flight._id,idempotencyKey,transactionHash:receipt.hash}});
      setTransactionStatus(`Policy ${result.policy.policyId} confirmed on Sepolia.`);
      setRefreshKey(value=>value+1);
      notify('Policy purchase confirmed on Sepolia.');
    }catch(purchaseError){
      setError(purchaseError.code===4001?'Wallet transaction was declined.':purchaseError.message);
    }finally{
      setBusyPlan('');
    }
  };
  return <div className="insurance-page"><PageHeading eyebrow="COVER THAT MAKES SENSE" title="Your policy terms." copy="Policy offers are loaded from the backend. Purchases require your verified wallet and a confirmed Sepolia contract transaction."/>
    <section className="panel tracking-selector"><div><span className="eyebrow">COVERED FLIGHT</span><p>Select a provider-sourced flight scheduled in the future.</p></div><select className="select-small flight-picker-select" value={flightId} onChange={event=>{setFlightId(event.target.value);setAcceptedTerms(false);}}><option value="">Select a fetched flight</option>{selectedFlight&&!flights.some(item=>item._id===selectedFlight._id)&&<option value={selectedFlight._id}>{selectedFlight.flightNumber} · {selectedFlight.origin} → {selectedFlight.destination}</option>}{flights.map(item=><option key={item._id} value={item._id}>{item.flightNumber} · {item.origin} → {item.destination} · {formatDate(item.scheduledDeparture)}</option>)}</select></section>
    {flight&&<div className="panel policy-flight"><span className="airline-mark"><Plane size={16}/></span><div><span className="eyebrow">PROVIDER FLIGHT</span><strong>{flight.flightNumber} <span>· {flight.origin} → {flight.destination}</span></strong></div><span className="policy-date">{formatDate(flight.scheduledDeparture)}</span></div>}
    <section className="panel terms-panel"><div className="panel-heading"><div><span className="eyebrow">CONFIGURED POLICY CATALOG</span><h2>Available coverage</h2></div><span className="service-chip">VERSIONED TERMS</span></div><ApiMessage loading={catalog.loading} error={catalog.error} empty={!catalog.data?.catalog?.length?'No policy catalog is configured. The backend will not invent prices or coverage terms.':null}><div className="plan-grid">{catalog.data?.catalog?.map(plan=><article className="plan-card" key={`${plan.planId}:${plan.policyTerms.version}`}><div className="plan-card-top"><span className="plan-name">{plan.name}</span><span className="service-chip">{plan.policyTerms.version}</span></div><p>Terms version {plan.policyTerms.version}</p><div className="plan-price">{formatMoneyMinor(plan.premiumMinor,plan.currency)}<span> / flight</span></div><div className="plan-payout"><span>MAXIMUM PAYOUT</span><strong>{formatMoneyMinor(plan.policyTerms.maximumPayoutMinor,plan.currency)}</strong></div><div className="plan-divider"/><div className="plan-features"><span><BadgeCheck size={14}/>Delay threshold: {plan.policyTerms.coverageThresholdMinutes} minutes</span>{plan.policyTerms.tiers.map(tier=><span key={tier.minimumDelayMinutes}><BadgeCheck size={14}/>{tier.minimumDelayMinutes}+ min · {formatMoneyMinor(tier.amountMinor,tier.currency)}</span>)}</div><button className="button button-outline plan-select" disabled={!plan.purchaseEnabled||!flightId||!acceptedTerms||Boolean(busyPlan)} onClick={()=>purchase(plan)}>{busyPlan===plan.planId?<><span className="button-spinner"/>Waiting for confirmation…</>:plan.purchaseEnabled?'Purchase with wallet':'Sepolia contract unavailable'}</button></article>)}</div></ApiMessage>
      {catalog.data?.catalog?.length>0&&<label className="terms-accept"><input type="checkbox" checked={acceptedTerms} onChange={event=>setAcceptedTerms(event.target.checked)}/><span>I reviewed the selected flight and versioned policy terms. A purchase is final on Sepolia; coverage is governed by the stored terms.</span></label>}
      {!user.walletAddress&&<button className="button button-outline" onClick={connectWallet}>Link and verify wallet <Wallet size={14}/></button>}
      {error&&<div className="auth-error" role="alert">{error}</div>}
      {transactionStatus&&<div className="api-state" role="status">{transactionStatus}</div>}
      <p className="policy-legal-note">Only a mined, verified contract event activates coverage. A submitted or pending transaction is not shown as an active policy.</p>
    </section>
    <section className="panel wallet-history"><div className="panel-heading"><div><span className="eyebrow">YOUR ACCOUNT</span><h2>Existing policies</h2></div></div><ApiMessage loading={policies.loading} error={policies.error} empty={!policies.data?.policies?.length?'No policies are recorded for this account.':null}><div className="policy-list">{policies.data?.policies?.map(policy=><article className="policy-list-item" key={policy._id}><span className="activity-icon activity-cyan"><ShieldCheck size={14}/></span><span><strong>{policy.policyId}</strong><small>{policy.flightId?.flightNumber||'Flight unavailable'} · Terms {policy.policyTermsSnapshot?.version}</small></span><StatusPill tone={statusTone(policy.status)}>{policy.status}</StatusPill></article>)}</div></ApiMessage></section>
  </div>;
}

function Tracking({token}) {
  const policies=useApiQuery('/policies',token);
  const [flightId,setFlightId]=useState('');
  const status=useApiQuery(flightId?`/flights/${flightId}/status`:null,token);
  const flight=policies.data?.policies?.find(item=>item.flightId?._id===flightId)?.flightId;
  return <div className="tracking-page"><PageHeading eyebrow="FLIGHT STATUS FROM YOUR PROVIDER" title="Every mile, in view." copy="Flight status comes from your configured provider; the map shows verified airport locations, not a live aircraft position."/>
    <section className="panel tracking-selector"><div><span className="eyebrow">CHOOSE A POLICY FLIGHT</span><p>Select a flight linked to an account policy.</p></div><ApiMessage loading={policies.loading} error={policies.error}><PoliciesFlightPicker policies={policies.data?.policies} value={flightId} onSelect={setFlightId}/></ApiMessage></section>
    <div className="tracking-map panel"><FlightRouteMap origin={flight?.origin} destination={flight?.destination}/></div>
    <div className="tracking-meta"><section className="panel route-status-panel"><div className="panel-heading"><div><span className="eyebrow">PROVIDER STATUS</span><h2>{flight?.flightNumber||'No flight selected'}</h2></div>{status.data?.status&&<StatusPill tone={statusTone(status.data.status)}>{status.data.status}</StatusPill>}</div><ApiMessage loading={policies.loading||status.loading} error={policies.error||status.error} empty={!flight?'No policy-linked flight is available.':null}>{flight&&status.data&&<><div className="route-times"><div><strong>{formatTime(status.data.scheduledDeparture)}</strong><span>Scheduled departure</span><small>{flight.origin}</small></div><div className="time-connector"><Plane size={14}/><span>Provider schedule</span></div><div><strong>{formatTime(status.data.scheduledArrival)}</strong><span>Scheduled arrival</span><small>{flight.destination}</small></div></div><div className="actual-times"><span>Actual arrival</span><strong>{status.data.actualArrival?formatTime(status.data.actualArrival):'Not reported'}</strong><small>Last provider update: {status.data.lastFetchedAt?formatDate(status.data.lastFetchedAt):'Not available'}</small></div></>}</ApiMessage></section><section className="panel timeline-panel"><div className="panel-heading"><div><span className="eyebrow">SOURCE RECORDS</span><h2>Flight history</h2></div>{flight&&<a className="text-button" href={`${process.env.REACT_APP_API_BASE_URL||'http://localhost:4000/api'}/flights/${flight._id}/history`} target="_blank" rel="noreferrer">API history <ExternalLink size={12}/></a>}</div><p className="tracking-source-note">Historical observations are available only when returned by the flight service.</p><div className="last-updated"><Clock3 size={12}/>{status.data?.lastFetchedAt?`Last updated ${formatDate(status.data.lastFetchedAt)}`:'No provider timestamp recorded'}</div></section></div>
  </div>;
}

function Verification({token}) {
  const policies=useApiQuery('/policies',token);
  const [flightId,setFlightId]=useState('');
  const status=useApiQuery(flightId?`/oracle/status/${flightId}`:null,token);
  const sources=useApiQuery(flightId?`/oracle/sources/${flightId}`:null,token);
  const verification=status.data?.verification;
  const reports=sources.data?.records||[];
  const agreed=verification?.consensusStatus==='VERIFIED'&&(verification.agreeingSourceIds||[]).length>=2;
  return <div className="verification-page"><PageHeading eyebrow="OPEN, INDEPENDENT, TRACEABLE" title="Trust is built in." copy="View only provider records and consensus states recorded by the backend."/>
    <section className="panel tracking-selector"><div><span className="eyebrow">POLICY FLIGHT</span><p>Choose an account flight to inspect source records.</p></div><ApiMessage loading={policies.loading} error={policies.error}><PoliciesFlightPicker policies={policies.data?.policies} value={flightId} onSelect={setFlightId}/></ApiMessage></section>
    {flightId&&<><ApiMessage loading={status.loading} error={status.error}><div className={`verification-status panel ${agreed?'verification-confirmed':''}`}><span className="verification-pending-icon">{agreed?<BadgeCheck size={18}/>:<Clock3 size={18}/>}</span><div><span className="eyebrow">CONSENSUS STATUS</span><h2>{agreed?'Verified flight event':'Verification pending'}</h2><p>{agreed?'The backend recorded fresh, independent source consensus. This does not itself confirm a payout.':'No verified consensus is currently available for this flight.'}</p></div>{agreed&&<span className="consensus-meter"><strong>{verification.agreeingSourceIds.length} / 3</strong><small>sources agree</small></span>}</div></ApiMessage>
      <section className="pipeline-section panel"><div className="panel-heading"><div><span className="eyebrow">VERIFICATION WORKFLOW</span><h2>Evidence before policy decision.</h2></div><span className="pipeline-demo">BACKEND STATE</span></div><div className="pipeline">{[[Globe2,'Data collection','Source records'],[BadgeCheck,'Validation','Freshness & format'],[Fingerprint,'Consensus','2-of-3 required'],[ArrowUpRight,'Oracle submission','Authorized only'],[LockKeyhole,'Smart contract','Policy terms apply']].map(([Icon,title,sub],i)=><div className={`pipeline-step ${agreed&&i<3?'pipeline-done':''}`} key={title}><div className="pipeline-node"><Icon size={15}/></div><strong>{title}</strong><small>{sub}</small>{i<4&&<span className={`pipeline-connector ${agreed&&i<2?'connector-done':''}`}/>}</div>)}</div><div className="pipeline-note"><span className="live-dot"/>{agreed?'Verified evidence is recorded; no contract submission is implied.':'No source agreement is fabricated when providers have not reported.'}</div></section>
      <section className="sources-section"><div className="sources-heading"><div><span className="eyebrow">PROVIDER RECORDS</span><h2>Independent reports</h2></div></div><ApiMessage loading={sources.loading} error={sources.error} empty={!reports.length?'No source observations have been recorded for this flight.':null}><div className="source-grid">{reports.map((record,index)=><article className="source-card panel" key={`${record.sourceId}:${record._id||index}`}><div className="source-card-top"><span className="source-logo">{record.sourceId}</span><StatusPill tone={statusTone(record.status)}>{record.status}</StatusPill></div><h3>{record.sourceId}</h3><span className="source-data-label">REPORTED EVENT · {record.eventType}</span><strong className="source-status">{record.actualTime?formatTime(record.actualTime):'Actual time unavailable'}</strong><div className="source-stats"><div><span>Scheduled</span><strong>{record.scheduledTime?formatTime(record.scheduledTime):'—'}</strong></div><div><span>Delay</span><strong>{Number.isFinite(record.delayMinutes)?`${record.delayMinutes} min`:'—'}</strong></div></div><div className="source-freshness"><Clock3 size={12}/>{record.fetchedAt?formatDate(record.fetchedAt):'Timestamp unavailable'}{record.errorCode&&<span>· {record.errorCode}</span>}</div></article>)}</div></ApiMessage></section></>}
    {!flightId&&!policies.loading&&!policies.error&&<div className="panel-empty"><Fingerprint size={18}/><strong>No flight selected</strong><span>Choose an insured flight to inspect actual verification data.</span></div>}
  </div>;
}

function Compensation({token,notify}) {
  const history=useApiQuery('/compensation/history',token);
  const policies=useApiQuery('/policies',token);
  const [selectedPolicy,setSelectedPolicy]=useState('');
  const [result,setResult]=useState(null);
  const [error,setError]=useState(null);
  const [busy,setBusy]=useState(false);
  const calculate=async()=>{if(!selectedPolicy)return;setBusy(true);setError(null);setResult(null);try{setResult(await apiRequest('/compensation/calculate',{token,method:'POST',body:{policyId:selectedPolicy}}));}catch(requestError){setError(requestError);}finally{setBusy(false);}};
  const records=history.data?.compensation||[];
  const confirmed=records.filter(item=>item.payoutStatus==='CONFIRMED');
  return <div className="compensation-page"><PageHeading eyebrow="CLEAR OUTCOMES, NO SURPRISES" title="Compensation, transparently." copy="Claims and calculations are read from your account and verified flight records."/>
    <section className="panel tracking-selector"><div><span className="eyebrow">CHECK POLICY ELIGIBILITY</span><p>Calculations require active coverage and independently verified arrival data.</p></div><ApiMessage loading={policies.loading} error={policies.error}><select className="select-small flight-picker-select" value={selectedPolicy} onChange={event=>setSelectedPolicy(event.target.value)}><option value="">Select a policy</option>{policies.data?.policies?.map(policy=><option key={policy._id} value={policy.policyId}>{policy.policyId} · {policy.status}</option>)}</select></ApiMessage><button className="button button-outline" disabled={!selectedPolicy||busy} onClick={calculate}>{busy?'Checking…':'Calculate eligibility'}</button></section>
    {error&&<div className="auth-error" role="alert">{error.message}</div>}{result&&<div className="compensation-result panel"><span className="eyebrow">SERVER POLICY CALCULATION</span><h2>{formatMoneyMinor(result.amountMinor,result.currency)}</h2><p>{result.eligible?'Eligible under the stored policy terms. No payout was submitted.':'Policy terms do not establish payout eligibility.'}</p><div className="execution-list"><div><span>Verified delay</span><strong>{result.delayMinutes} min</strong></div><div><span>Terms version</span><strong>{result.policyTermsVersion}</strong></div><div><span>Payout state</span><strong>{result.payoutStatus}</strong></div></div></div>}
    <div className="compensation-hero panel"><div className="compensation-hero-glow"/><div className="compensation-copy"><span className="eyebrow"><span className="live-dot"/>CONFIRMED TRANSACTIONS</span><h2>{confirmed.length?confirmed.map(item=>formatMoneyMinor(item.compensationAmountMinor,item.currency)).join(' · '):'—'}</h2><p>{confirmed.length?'Confirmed payout amounts from recorded transactions.':'No confirmed compensation is recorded for this account.'}</p><StatusPill tone={confirmed.length?'green':'slate'}>{confirmed.length?'Confirmed on-chain':'No confirmed payout'}</StatusPill></div><div className="compensation-details"><div><span>Recorded claims</span><strong>{records.length}</strong></div><div><span>Confirmed payouts</span><strong>{confirmed.length}</strong></div><div><span>Transaction hashes</span><strong>{confirmed.filter(item=>item.transactionHash).length}</strong></div></div></div>
    <section className="panel transaction-panel"><div className="panel-heading"><div><span className="eyebrow">ACCOUNT RECORDS</span><h2>Compensation history</h2></div></div><ApiMessage loading={history.loading} error={history.error} empty={!records.length?'No compensation records are available. Nothing has been submitted or paid.':null}><div className="policy-list">{records.map(item=><article className="policy-list-item" key={item._id}><span className="activity-icon activity-cyan"><CreditCard size={14}/></span><span><strong>{formatMoneyMinor(item.compensationAmountMinor,item.currency)} · {item.delayMinutes} minutes</strong><small>{item.transactionHash||'No transaction hash recorded'}</small></span><StatusPill tone={statusTone(item.payoutStatus)}>{item.payoutStatus}</StatusPill></article>)}</div></ApiMessage></section>
  </div>;
}

function WalletPage({token,walletSession,user,setModal,connectWallet,notify}) {
  const [copied,setCopied]=useState(false);
  const transactions=useApiQuery('/blockchain/transactions',token);
  const address=walletSession?.address||user.walletAddress;
  const copy=async()=>{if(!address)return;try{await navigator.clipboard.writeText(address);setCopied(true);window.setTimeout(()=>setCopied(false),1500);}catch(error){notify(`Clipboard unavailable: ${error.message}`);}};
  return <div className="wallet-page"><PageHeading eyebrow="YOUR WALLET, YOUR CONTROL" title="Your money, made clear." copy="Wallet identity is linked only after a signed nonce is verified. Token balance comes from the connected network." action={!user.walletAddress&&<button className="button button-primary" onClick={()=>setModal('wallet')}><Wallet size={15}/>Connect wallet</button>}/>
    <div className="wallet-card panel"><div className="wallet-card-glow"/><div className="wallet-card-top"><span className="eyebrow"><span className={walletSession?'live-dot':'wallet-offline-dot'}/>{walletSession?'WALLET CONNECTED':'WALLET NOT ACTIVE'}</span><span className="network-chip"><Globe2 size={13}/>{walletSession?.network||'Connect wallet for network'}</span></div><span className="wallet-balance-label">Native-token balance</span><strong className="wallet-balance">{walletSession?.balance||'—'}</strong><span className="wallet-balance-sub">{walletSession?'Read from the connected wallet provider.':'No token balance is assumed or fabricated.'}</span><div className="wallet-address-row"><span><small>LINKED WALLET</small><strong>{address||'No wallet linked'}</strong></span>{address&&<button className="icon-button" onClick={copy} aria-label="Copy wallet address"><Copy size={14}/>{copied&&<span className="copied-label">Copied</span>}</button>}{user.walletAddress&&!walletSession&&<button className="text-button" onClick={connectWallet}>Reconnect <ArrowRight size={12}/></button>}</div></div>
    <div className="wallet-stats"><Metric label="Premium payments" value="—" note="No payment records" icon={CreditCard} tone="violet"/><Metric label="Compensation received" value="—" note="See confirmed claims" icon={ArrowDownRight} tone="green"/><Metric label="Transactions" value={transactions.data?.transactions?.length??'—'} note="Recorded by backend" icon={Activity} tone="cyan"/></div>
    <section className="panel wallet-history"><div className="panel-heading"><div><span className="eyebrow">ON-CHAIN ACTIVITY</span><h2>Transaction history</h2></div></div><ApiMessage loading={transactions.loading} error={transactions.error} empty={!transactions.data?.transactions?.length?'No transactions are recorded for this account.':null}><div className="policy-list">{transactions.data?.transactions?.map(item=><article className="policy-list-item" key={item._id}><span className="activity-icon activity-cyan"><Activity size={14}/></span><span><strong>{item.transactionType} · {item.amountMinor!==undefined?formatMoneyMinor(item.amountMinor,item.currency):'Amount unavailable'}</strong><small>{item.transactionHash}</small></span><StatusPill tone={statusTone(item.status)}>{item.status}</StatusPill></article>)}</div></ApiMessage></section>
  </div>;
}

function SettingsPage({token,user,signOut,notify}) {
  const [name,setName]=useState(user.name||'');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const save=async event=>{event.preventDefault();setBusy(true);setError('');try{const result=await apiRequest('/users/profile',{token,method:'PUT',body:{name}});window.dispatchEvent(new CustomEvent('flightsure:user-updated',{detail:result.user}));notify('Profile saved.');}catch(requestError){setError(requestError.message);}finally{setBusy(false);}};
  return <div className="settings-page"><PageHeading eyebrow="ACCOUNT AND SECURITY" title="Your account." copy="Profile changes are sent to the authenticated backend."/><section className="panel settings-panel"><div className="settings-section-title"><span className="settings-icon"><Users size={16}/></span><div><h2>Profile</h2><p>{user.email}</p></div></div><form className="profile-edit-form" onSubmit={save}><label>Display name<input value={name} onChange={event=>setName(event.target.value)} maxLength={100} required/></label>{error&&<div className="auth-error" role="alert">{error}</div>}<button className="button button-primary" disabled={busy}>{busy?'Saving…':'Save profile'}</button></form></section><section className="panel settings-panel"><div className="settings-section-title"><span className="settings-icon"><LockKeyhole size={16}/></span><div><h2>Security</h2><p>Passwords are hashed by the backend. Wallet keys are never sent to FlightSure.</p></div></div><div className="setting-row"><span><strong>Wallet ownership</strong><small>{user.walletAddress||'No wallet is linked to this account.'}</small></span><StatusPill tone={user.walletAddress?'green':'slate'}>{user.walletAddress?'Verified signature':'Not linked'}</StatusPill></div></section><button className="button button-outline signout-button" onClick={signOut}>Sign out <ArrowRight size={14}/></button></div>;
}

function AdminDashboard({token,notify}) {
  const dashboard=useApiQuery('/admin/dashboard',token);
  const flights=useApiQuery('/admin/flights?limit=20',token);
  const [filter,setFilter]=useState('');
  const info=dashboard.data;
  const rows=(flights.data?.flights||[]).filter(item=>`${item.flightNumber} ${item.origin} ${item.destination}`.toLowerCase().includes(filter.toLowerCase()));
  return <div className="admin-page"><PageHeading eyebrow="OPERATIONS · LIVE DATABASE STATE" title="The bigger picture." copy="Administrative metrics and review records are retrieved from the protected API." action={<button className="button button-outline" onClick={()=>notify('Refresh the page to reload API data.')}><Activity size={14}/>Refresh snapshot</button>}/>
    <ApiMessage loading={dashboard.loading} error={dashboard.error}><div className="metrics-grid admin-metrics"><Metric label="Total users" value={info?.users??'—'} note="Database user count" icon={Users} tone="cyan"/><Metric label="Active policies" value={info?.activePolicies??'—'} note="Confirmed active records" icon={ShieldCheck} tone="violet"/><Metric label="Monitored flights" value={info?.monitoredFlights??'—'} note="Provider records in database" icon={Radar} tone="green"/><Metric label="Pending cases" value={info?.pendingCases??'—'} note="Require source consensus" icon={Fingerprint} tone="amber"/></div>
      <div className="admin-overview-grid"><section className="panel admin-chart-panel"><div className="panel-heading"><div><span className="eyebrow">CONNECTED SERVICES</span><h2>Integration readiness</h2></div></div><div className="integration-list">{Object.entries(info?.integrations||{}).map(([key,connected])=><div className="integration-row" key={key}><span className={`integration-indicator ${connected?'integration-online':''}`}/><span><strong>{key.replace(/([A-Z])/g,' $1')}</strong><small>{connected?'Configured':'Not configured'}</small></span><StatusPill tone={connected?'green':'slate'}>{connected?'Configured':'Unavailable'}</StatusPill></div>)}</div><div className="chart-footnote"><span>Groq readiness reflects server-side API key configuration; other integrations reflect configuration.</span></div></section><section className="panel admin-controls"><div className="panel-heading"><div><span className="eyebrow">INSURANCE POOL</span><h2>Contract balance</h2></div><Wallet size={15} className="muted-icon"/></div><div className="history-empty"><strong>{info?.insurancePool?.available?`${formatEther(BigInt(info.insurancePool.balanceWei))} ETH`:'Not connected'}</strong><span>{info?.insurancePool?.reason||'Sepolia contract balance from the configured RPC.'}</span></div></section></div></ApiMessage>
    <section className="panel admin-cases"><div className="admin-cases-head"><div><span className="eyebrow">DATABASE FLIGHT RECORDS</span><h2>Flight monitoring</h2></div><label className="flight-filter"><Search size={13}/><input placeholder="Filter flights" value={filter} onChange={event=>setFilter(event.target.value)}/></label></div><ApiMessage loading={flights.loading} error={flights.error} empty={!rows.length?'No stored flight records match this filter.':null}><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>FLIGHT</th><th>ROUTE</th><th>STATUS</th><th>LAST PROVIDER UPDATE</th></tr></thead><tbody>{rows.map(item=><tr key={item._id}><td><strong>{item.flightNumber}</strong></td><td>{item.origin||'—'} → {item.destination||'—'}</td><td>{item.status||'Unavailable'}</td><td>{item.lastFetchedAt?formatDate(item.lastFetchedAt):'Not recorded'}</td></tr>)}</tbody></table></div></ApiMessage></section>
  </div>;
}

function AccessDenied() {
  return <section className="panel-empty access-denied"><LockKeyhole size={19}/><strong>Admin access required</strong><span>Your account does not have the Admin role.</span></section>;
}

function Modal({type,onClose,connectWallet,user}) {
  const isWallet=type==='wallet';
  return <motion.div className="modal-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={onClose}><motion.section className="modal-card" initial={{opacity:0,y:14,scale:.97}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:9,scale:.98}} onClick={event=>event.stopPropagation()}><button className="icon-button modal-close" onClick={onClose} aria-label="Close dialog"><X size={17}/></button><div className="modal-icon">{isWallet?<Wallet size={19}/>:<CircleHelp size={19}/>}</div><span className="eyebrow">{isWallet?'WALLET OWNERSHIP':'FLIGHTSURE SUPPORT'}</span><h2>{isWallet?'Link your wallet.':'How can we help?'}</h2><p>{isWallet?user.walletAddress?'Your account already has a verified wallet. Reconnect it to view the current network and native-token balance.':'Connect a browser wallet and sign a one-time message. FlightSure never asks for your private key or seed phrase.':'Account, flight, and policy data are served by the configured FlightSure backend.'}</p>{isWallet?<button className="button button-primary full-button" onClick={connectWallet}>Sign and verify wallet <ArrowRight size={15}/></button>:<button className="button button-primary full-button" onClick={onClose}>Got it <ArrowRight size={15}/></button>}<span className="modal-footnote"><LockKeyhole size={12}/>{isWallet?'The server verifies ownership without receiving wallet secrets.':'No support account or sample data is created.'}</span></motion.section></motion.div>;
}

export default App;
