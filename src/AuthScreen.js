import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, LockKeyhole, ShieldCheck } from 'lucide-react';
import { apiRequest } from './api';
import './AuthScreen.css';

export default function AuthScreen({ onAuthenticated, onBack }) {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async event => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await apiRequest(`/auth/${mode === 'login' ? 'login' : 'register'}`, {
        method: 'POST',
        body: mode === 'login' ? { email, password } : { name, email, password }
      });
      onAuthenticated(result);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return <main className="auth-page">
    <div className="auth-glow" />
    <header className="auth-topbar"><button className="auth-brand" onClick={onBack} aria-label="Return to FlightSure home"><span className="brand-mark"><ShieldCheck size={19} /><i /></span><span className="brand-word">flight<span>sure</span></span></button><span className="auth-top-note"><LockKeyhole size={13} /> SECURE ACCOUNT ACCESS</span></header>
    <section className="auth-card">
      <div className="auth-card-icon"><ShieldCheck size={19} /></div>
      <div className="eyebrow"><span className="live-dot" /> YOUR JOURNEY STARTS HERE</div>
      <AnimatePresence mode="wait"><motion.div key={mode} initial={{ opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: .18 }}>
        <h1>{mode === 'login' ? 'Welcome back.' : 'Make room for certainty.'}</h1>
        <p>{mode === 'login' ? 'Sign in to see your flights, coverage, and account.' : 'Create your passenger account to get started.'}</p>
        <form className="auth-form" onSubmit={submit}>
          {mode === 'register' && <label>Your name<input autoComplete="name" value={name} onChange={event => setName(event.target.value)} required minLength={1} maxLength={100} /></label>}
          <label>Email address<input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required maxLength={254} /></label>
          <label>Password<input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={event => setPassword(event.target.value)} required minLength={mode === 'login' ? 1 : 12} maxLength={128} />{mode === 'register' && <small>Use at least 12 characters.</small>}</label>
          {error && <div className="auth-error" role="alert">{error}</div>}
          <button className="button button-primary auth-submit" disabled={busy}>{busy ? <><span className="button-spinner" />Connecting securely...</> : <>{mode === 'login' ? 'Sign in' : 'Create account'} <ArrowRight size={15} /></>}</button>
        </form>
        <div className="auth-mode-toggle"><span>{mode === 'login' ? 'New to FlightSure?' : 'Already have an account?'}</span><button onClick={() => { setError(''); setMode(mode === 'login' ? 'register' : 'login'); }}>{mode === 'login' ? 'Create account' : 'Sign in'}</button></div>
      </motion.div></AnimatePresence>
    </section>
    <footer className="auth-footer"><button onClick={onBack}><ArrowLeft size={13} /> Back to FlightSure</button><span>Passwords are hashed on the server. Wallets never need private keys.</span></footer>
  </main>;
}
