import { useState, type FormEvent } from 'react';
import { ArrowRight, CalendarDays, ChartNoAxesCombined, Coffee, ShieldCheck, X } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';

type AuthMode = 'signin' | 'signup';

export function LandingPage() {
  const { signIn, signUp, persistenceMode } = useWorkspace();
  const [mode, setMode] = useState<AuthMode>('signup');
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const showAuth = (next: AuthMode) => {
    setMode(next);
    setError('');
    setNotice('');
    setOpen(true);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setNotice('');
    if (mode === 'signup' && name.trim().length < 2) {
      setError('Please enter your name.');
      return;
    }
    if (password.length < 6) {
      setError('Password must contain at least 6 characters.');
      return;
    }
    setBusy(true);
    try {
      const result = mode === 'signin'
        ? await signIn(email.trim(), password)
        : await signUp(name.trim(), email.trim(), password);
      if (!result.ok) {
        setError(result.error);
      } else if (mode === 'signup') {
        setNotice('Account request successful. If email confirmation is enabled, check your inbox to verify your address, then sign in.');
      } else {
        setOpen(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen overflow-hidden bg-[#0d0e10] text-[#f7f7f5]">
      <header className="mx-auto flex h-[78px] w-[min(1200px,calc(100%-40px))] items-center justify-between border-b border-white/10">
        <a href="#" className="flex items-center gap-3 text-xl font-semibold tracking-tight">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#f6d5c3] text-lg font-black text-[#24201e]">B</span>
          BunkBuddy<span className="text-[#f6d5c3]">.</span>
        </a>
        <nav className="flex items-center gap-5 text-sm">
          <button onClick={() => showAuth('signin')} className="text-white/70 transition hover:text-[#f6d5c3]">Sign In</button>
          <button onClick={() => showAuth('signup')} className="inline-flex items-center gap-3 rounded-md bg-[#f6d5c3] px-4 py-2.5 font-semibold text-[#24201e] transition hover:-translate-y-0.5 hover:bg-[#ffe4d5]">Sign Up <ArrowRight size={16} /></button>
        </nav>
      </header>

      <main>
        <section className="relative mx-auto grid min-h-[560px] w-[min(1200px,calc(100%-40px))] items-center gap-12 py-20 lg:grid-cols-[1fr_0.95fr]">
          <div className="relative z-10">
            <div className="mb-7 flex items-center gap-3 text-[10px] font-semibold tracking-[0.2em] text-white/60">
              <span className="h-2 w-2 rounded-full bg-[#a9bba5] shadow-[0_0_0_5px_#a9bba51a]" />
              YOUR ATTENDANCE SURVIVAL KIT
            </div>
            <h1 className="max-w-2xl text-5xl font-medium leading-[1.08] tracking-[-0.055em] sm:text-6xl lg:text-[76px]">Bunk the class.<br /><span className="text-[#f6d5c3]">Not your attendance.</span></h1>
            <p className="mt-7 max-w-lg text-base leading-8 text-white/60">Track your classes, plan your breaks, and stay ahead of attendance shortages — all in one place.</p>
            <div className="mt-9 flex flex-wrap items-center gap-6">
              <button onClick={() => showAuth('signup')} className="inline-flex min-h-12 items-center gap-6 rounded-md border border-[#f6d5c3] bg-[#f6d5c3] px-6 text-sm font-semibold text-[#24201e] transition hover:-translate-y-0.5 hover:bg-[#ffe4d5]">Get Started <ArrowRight size={17} /></button>
              <button onClick={() => showAuth('signin')} className="text-sm text-white/55 transition hover:text-[#f6d5c3]">Already a member? <span className="font-semibold text-white">Sign In ↗</span></button>
            </div>
            <div className="mt-6 flex items-center gap-2 text-xs text-white/40"><ShieldCheck size={15} /> A little clarity. A lot more college life.</div>
          </div>

          <div className="relative">
            <div className="absolute -inset-8 rounded-full bg-[#f6d5c3]/[0.06] blur-3xl" />
            <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#151619] shadow-[0_30px_100px_#0008]">
              <div className="flex h-11 items-center justify-between border-b border-white/10 bg-white/[0.025] px-5 text-[10px] tracking-wide text-white/40"><span>● &nbsp;● &nbsp;●</span><span>BUNKBUDDY / OVERVIEW</span><span>↗</span></div>
              <div className="p-6 sm:p-8">
                <div className="flex items-start justify-between gap-4"><div><div className="text-[9px] tracking-[0.2em] text-white/40">A LITTLE CHECK-IN</div><h2 className="mt-2 text-2xl font-medium">Your semester, at a glance.</h2><p className="mt-1 text-xs text-white/40">A calmer way to stay on top of college.</p></div><span className="rounded-md border border-white/10 px-3 py-2 text-[10px] text-white/55">SEMESTER 04</span></div>
                <div className="mt-7 grid grid-cols-3 gap-3">
                  <div className="rounded-lg border border-white/10 bg-white/[0.025] p-3"><ChartNoAxesCombined className="mb-4 h-4 w-4 text-[#a9bba5]" /><div className="text-3xl font-medium">82<span className="text-base text-white/40">%</span></div><div className="mt-2 text-[9px] text-white/45">Attendance</div><div className="mt-3 h-1 rounded bg-white/10"><div className="h-1 w-[82%] rounded bg-[#a9bba5]" /></div></div>
                  <div className="rounded-lg border border-white/10 bg-white/[0.025] p-3"><Coffee className="mb-4 h-4 w-4 text-[#f6d5c3]" /><div className="text-3xl font-medium">03</div><div className="mt-2 text-[9px] text-white/45">Safe bunks</div><div className="mt-4 text-[9px] text-[#a9bba5]">A little breathing room</div></div>
                  <div className="rounded-lg border border-white/10 bg-white/[0.025] p-3"><CalendarDays className="mb-4 h-4 w-4 text-[#c3b7d7]" /><div className="text-lg font-medium">Spring</div><div className="mt-1 text-[9px] text-white/45">Next break</div><div className="mt-4 text-[9px] text-[#f6d5c3]">23 MAR</div></div>
                </div>
                <div className="mt-7 flex items-center justify-between border-b border-white/10 pb-3 text-xs"><span className="font-medium">Subject attendance</span><span className="text-[10px] text-white/40">THIS SEMESTER</span></div>
                {[
                  ['Mathematics', '85%', 'w-[85%]'],
                  ['Data Structures', '78%', 'w-[78%]'],
                  ['Physics', '92%', 'w-[92%]'],
                ].map(([subject, value, width]) => (
                  <div key={subject} className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-white/[0.06] py-4 text-xs"><span className="text-white/65">{subject}</span><span className="text-white/80">{value}</span><div className="col-span-2 h-1 rounded bg-white/10"><div className={`h-1 rounded bg-[#a9bba5] ${width}`} /></div></div>
                ))}
                <div className="mt-5 flex items-center gap-2 rounded-md bg-[#a9bba5]/10 px-3 py-3 text-[10px] text-[#b9cbb5]"><ShieldCheck size={14} /> Keep your attendance above your required minimum.</div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto w-[min(1200px,calc(100%-40px))] border-t border-white/10 py-16">
          <div className="text-[10px] tracking-[0.2em] text-white/40">LESS MATH. MORE FREEDOM.</div>
          <h2 className="mt-4 text-3xl font-medium tracking-tight sm:text-4xl">Everything you need to bunk smarter<span className="text-[#f6d5c3]">.</span></h2>
          <div className="mt-10 grid gap-8 border-y border-white/10 py-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['01', 'Track Attendance', 'Know exactly where you stand.'],
              ['02', 'Plan Your Bunks', 'Check your limits before skipping.'],
              ['03', 'Manage Holidays', 'Plan around your academic calendar.'],
              ['04', 'Avoid Danger Zones', 'Know when attendance needs attention.'],
            ].map(([number, title, body]) => <article key={number}><div className="text-xs text-[#f6d5c3]">{number}</div><h3 className="mt-4 font-medium">{title}</h3><p className="mt-2 text-xs leading-6 text-white/45">{body}</p></article>)}
          </div>
        </section>
      </main>

      <footer className="mx-auto flex w-[min(1200px,calc(100%-40px))] flex-wrap items-center justify-between gap-3 border-t border-white/10 py-8 text-xs text-white/40"><span className="font-semibold text-white/70">BunkBuddy.</span><span>Bunk responsibly. Live a little.</span><span>© {new Date().getFullYear()} BunkBuddy</span></footer>

      {open && <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="auth-heading" className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#17181b] p-7 text-[#f7f7f5] shadow-2xl sm:p-9">
          <button onClick={() => setOpen(false)} aria-label="Close" className="absolute right-4 top-4 rounded-full p-2 text-white/50 hover:bg-white/10 hover:text-white"><X size={18} /></button>
          <div className="mb-6 grid h-10 w-10 place-items-center rounded-xl bg-[#f6d5c3] font-black text-[#24201e]">B</div>
          <div className="text-[9px] tracking-[0.2em] text-white/45">YOUR ATTENDANCE SURVIVAL KIT</div>
          <h2 id="auth-heading" className="mt-3 text-2xl font-medium">{mode === 'signin' ? 'Welcome back.' : 'Create your account.'}</h2>
          <p className="mt-2 text-xs leading-6 text-white/50">{mode === 'signin' ? 'Sign in to continue to your BunkBuddy workspace.' : 'Start planning your semester with a little more clarity.'}</p>
          <div className="mt-6 grid grid-cols-2 rounded-lg bg-white/[0.05] p-1 text-xs">
            <button onClick={() => { setMode('signin'); setError(''); setNotice(''); }} className={`rounded-md py-2.5 ${mode === 'signin' ? 'bg-[#f6d5c3] font-semibold text-[#24201e]' : 'text-white/55'}`}>Sign In</button>
            <button onClick={() => { setMode('signup'); setError(''); setNotice(''); }} className={`rounded-md py-2.5 ${mode === 'signup' ? 'bg-[#f6d5c3] font-semibold text-[#24201e]' : 'text-white/55'}`}>Create Account</button>
          </div>
          <form onSubmit={(event) => void submit(event)} className="mt-5 space-y-4">
            {mode === 'signup' && <label className="block text-xs text-white/65">Your name<input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none transition focus:border-[#f6d5c3]" placeholder="Alex Morgan" /></label>}
            <label className="block text-xs text-white/65">Email address<input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none transition focus:border-[#f6d5c3]" placeholder="you@example.com" /></label>
            <label className="block text-xs text-white/65">Password<input type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none transition focus:border-[#f6d5c3]" placeholder="At least 6 characters" /></label>
            {error && <p role="alert" className="rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-2 text-xs text-red-200">{error}</p>}
            {notice && <p role="status" className="rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-xs leading-5 text-emerald-200">{notice}</p>}
            <button disabled={busy} className="flex h-12 w-full items-center justify-center gap-3 rounded-lg bg-[#f6d5c3] text-sm font-semibold text-[#24201e] transition hover:bg-[#ffe4d5] disabled:cursor-wait disabled:opacity-60">{busy ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account'} <ArrowRight size={16} /></button>
          </form>
          <p className="mt-5 text-center text-[10px] leading-5 text-white/35">{persistenceMode === 'supabase' ? 'Your account is securely managed by Supabase.' : 'Local development mode is active.'}</p>
        </section>
      </div>}
    </div>
  );
}
