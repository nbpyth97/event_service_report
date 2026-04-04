import { useEffect, useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { supabase } from './supabaseClient';

const COLORS = ['#534AB7','#1D9E75','#D85A30','#D4537E','#378ADD','#BA7517','#E24B4A','#3B6D11'];
const DAYS_PT = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
const MONTHS_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const ALIASES = {
  'P.I':'Perna Inteira','PI':'Perna Inteira','M.P':'Meia Perna','MP':'Meia Perna',
  'SOB':'Sobrancelha','SOB.':'Sobrancelha','AX':'Axila','V':'Virilha',
  'TUTAL':'Virilha Completa','TOTAL':'Virilha Completa','ROSTO':'Rosto Completo',
  'R':'Rosto Completo','MÃOS':'Mãos','MAOS':'Mãos','PÉS':'Pés','PES':'Pés',
  'BANHO':'Banho','MASSAGEM':'Massagem','TUDO':'Tudo','PEITO':'Peito','COSTAS':'Costas'
};
const SORTED_ALIASES = Object.keys(ALIASES).sort((a,b) => b.length - a.length);

function parseSvc(summary = '') {
  const parts = summary.toUpperCase().replace(/,/g,' ').replace(/;/g,' ').split(/\s+/);
  const found = [], nameParts = [], seen = new Set();
  for (const p of parts) {
    let matched = false;
    for (const a of SORTED_ALIASES) {
      if (p === a) {
        const f = ALIASES[a];
        if (!seen.has(f)) { seen.add(f); found.push(f); }
        matched = true; break;
      }
    }
    if (!matched && p) nameParts.push(p.charAt(0) + p.slice(1).toLowerCase());
  }
  return { services: found, client: nameParts.join(' ') };
}

function fmt(n) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

function fmtDT(dt) {
  if (!dt) return '—';
  const d = new Date(dt);
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
}

function Metric({ label, value, sub, variant }) {
  const styles = {
    default: { bg: 'var(--m-bg)', lbl: 'var(--text-3)', val: 'var(--text-1)', sub: 'var(--text-3)' },
    accent:  { bg: 'var(--accent-bg)', lbl: 'var(--accent-sub)', val: 'var(--accent-txt)', sub: 'var(--accent-sub)' },
    green:   { bg: 'var(--green-bg)', lbl: 'var(--green-sub)', val: 'var(--green-txt)', sub: 'var(--green-sub)' },
  }[variant || 'default'];
  return (
    <div style={{ background: styles.bg, borderRadius: 8, padding: '14px 16px' }}>
      <div style={{ fontSize: 11, color: styles.lbl, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'sans-serif' }}>{label}</div>
      <div style={{ fontSize: 22, color: styles.val, letterSpacing: '-0.02em' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: styles.sub, marginTop: 3, fontFamily: 'sans-serif' }}>{sub}</div>}
    </div>
  );
}

function Insight({ title, value, sub }) {
  return (
    <div style={{ background: 'var(--card-bg)', border: '0.5px solid var(--border)', borderRadius: 8, padding: '12px 14px' }}>
      <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, fontFamily: 'sans-serif' }}>{title}</div>
      <div style={{ fontSize: 16, color: 'var(--text-1)' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3, fontFamily: 'sans-serif' }}>{sub}</div>}
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div style={{ background: 'var(--card-bg)', border: '0.5px solid var(--border)', borderRadius: 12, padding: '18px 20px', marginBottom: 14 }}>
      {title && <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14, fontFamily: 'sans-serif' }}>{title}</div>}
      {children}
    </div>
  );
}

function Legend({ items }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
      {items.map(({ label, color }, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-2)', fontFamily: 'sans-serif' }}>
          <span style={{ width: 9, height: 9, borderRadius: 2, background: color, flexShrink: 0 }} />
          {label}
        </span>
      ))}
    </div>
  );
}

const STATUS_LABELS = { confirmed: 'Confirmado', cancelled: 'Cancelado' };
const STATUS_STYLES = {
  confirmed: { background: 'var(--badge-green-bg)', color: 'var(--badge-green-txt)' },
  cancelled: { background: 'var(--badge-red-bg)',   color: 'var(--badge-red-txt)' },
  default:   { background: 'var(--badge-amber-bg)', color: 'var(--badge-amber-txt)' },
};

export default function Dashboard() {
  const [events, setEvents]   = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState('all');
  const [darkMode, setDarkMode] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = e => setDarkMode(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    (async () => {
      const [evRes, clRes] = await Promise.all([
        supabase.from('events').select('*').order('event_start_time', { ascending: false }),
        supabase.from('clients').select('*'),
      ]);
      setEvents(evRes.data || []);
      setClients(clRes.data || []);
      setLoading(false);
    })();
  }, []);

  const now    = useMemo(() => new Date(), []);
  const in30   = useMemo(() => new Date(now.getTime() + 30*24*60*60*1000), [now]);
  const in48   = useMemo(() => new Date(now.getTime() + 48*60*60*1000), [now]);
  const weekStart = useMemo(() => { const d = new Date(now); d.setDate(now.getDate() - now.getDay()); return d; }, [now]);

  const pastEvts   = useMemo(() => events.filter(e => e.event_start_time && new Date(e.event_start_time) <= now), [events, now]);
  const futureEvts = useMemo(() => events.filter(e => e.event_start_time && new Date(e.event_start_time) > now), [events, now]);
  const next30     = useMemo(() => futureEvts.filter(e => new Date(e.event_start_time) <= in30), [futureEvts, in30]);
  const next48     = useMemo(() => futureEvts.filter(e => new Date(e.event_start_time) <= in48), [futureEvts, in48]);
  const thisWeek   = useMemo(() => events.filter(e => { const d = new Date(e.event_start_time); return d >= weekStart && d <= now; }), [events, weekStart, now]);

  const revDone   = useMemo(() => pastEvts.reduce((s,e) => s + Number(e.service_price||0), 0), [pastEvts]);
  const revFuture = useMemo(() => next30.reduce((s,e) => s + Number(e.service_price||0), 0), [next30]);
  const weekRev   = useMemo(() => thisWeek.reduce((s,e) => s + Number(e.service_price||0), 0), [thisWeek]);
  const avgPrice  = useMemo(() => pastEvts.length ? revDone / pastEvts.length : 0, [pastEvts, revDone]);
  const uniqueClients = useMemo(() => new Set(clients.map(c => c.client_name)).size, [clients]);

  const svcCounts = useMemo(() => {
    const counts = {};
    events.forEach(e => {
      const svcs = parseSvc(e.service || e.summary || '').services;
      (svcs.length ? svcs : ['Outro']).forEach(s => { counts[s] = (counts[s]||0) + 1; });
    });
    return Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0,7);
  }, [events]);

  const svcRevenue = useMemo(() => {
    const rev = {};
    events.forEach(e => {
      const svcs = parseSvc(e.service || e.summary || '').services;
      const price = Number(e.service_price||0);
      (svcs.length ? svcs : ['Outro']).forEach(s => { rev[s] = (rev[s]||0) + price / (svcs.length||1); });
    });
    return Object.entries(rev).sort((a,b) => b[1]-a[1]).slice(0,7);
  }, [events]);

  const monthData = useMemo(() => {
    const counts = {};
    events.forEach(e => {
      if (!e.event_start_time) return;
      const d = new Date(e.event_start_time);
      const k = `${MONTHS_PT[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
      counts[k] = (counts[k]||0) + 1;
    });
    return Object.entries(counts).slice(-12).map(([k,v]) => ({ name: k, value: v }));
  }, [events]);

  const hourData = useMemo(() => {
    const counts = Array(24).fill(0);
    events.forEach(e => { if (e.event_start_time) counts[new Date(e.event_start_time).getHours()]++; });
    return Array.from({length:13}, (_,i) => ({ name: `${i+8}h`, value: counts[i+8] }));
  }, [events]);

  const busyDay  = useMemo(() => { const c = Array(7).fill(0); events.forEach(e => { if (e.event_start_time) c[new Date(e.event_start_time).getDay()]++; }); return DAYS_PT[c.indexOf(Math.max(...c))] || '—'; }, [events]);
  const peakHour = useMemo(() => { const c = Array(24).fill(0); events.forEach(e => { if (e.event_start_time) c[new Date(e.event_start_time).getHours()]++; }); const h = c.indexOf(Math.max(...c)); return h > 0 ? `${h}h00` : '—'; }, [events]);
  const topSvc   = useMemo(() => svcCounts[0] || ['—', 0], [svcCounts]);

  const tableRows = useMemo(() => {
    if (filter === 'past')      return events.filter(e => new Date(e.event_start_time) < now);
    if (filter === 'upcoming')  return events.filter(e => new Date(e.event_start_time) >= now);
    if (filter === 'confirmed') return events.filter(e => e.status === 'confirmed');
    if (filter === 'cancelled') return events.filter(e => e.status === 'cancelled');
    return events;
  }, [events, filter, now]);

  const today = now.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const css = darkMode ? `
    --bg: #18181a; --card-bg: #1c1c1e; --m-bg: #242426;
    --text-1: #f0efe9; --text-2: #a8a79f; --text-3: #6a6a64;
    --border: rgba(255,255,255,0.08);
    --accent-bg: #26215C; --accent-txt: #CECBF6; --accent-sub: #AFA9EC;
    --green-bg: #085041;  --green-txt: #9FE1CB;  --green-sub: #5DCAA5;
    --badge-green-bg: #085041; --badge-green-txt: #9FE1CB;
    --badge-red-bg: #501313;   --badge-red-txt: #F09595;
    --badge-amber-bg: #412402; --badge-amber-txt: #FAC775;
    --row-future: rgba(29,158,117,0.06);
  ` : `
    --bg: #eeede9; --card-bg: #ffffff; --m-bg: #f5f5f4;
    --text-1: #1a1a18; --text-2: #5f5e5a; --text-3: #888780;
    --border: rgba(0,0,0,0.1);
    --accent-bg: #EEEDFE; --accent-txt: #3C3489; --accent-sub: #7F77DD;
    --green-bg: #EAF3DE;  --green-txt: #27500A;  --green-sub: #639922;
    --badge-green-bg: #EAF3DE; --badge-green-txt: #27500A;
    --badge-red-bg: #FCEBEB;   --badge-red-txt: #791F1F;
    --badge-amber-bg: #FAEEDA; --badge-amber-txt: #633806;
    --row-future: rgba(29,158,117,0.05);
  `;

  const TABS = [
    { key: 'all', label: 'Todas' },
    { key: 'past', label: 'Passadas' },
    { key: 'upcoming', label: 'Futuras' },
    { key: 'confirmed', label: 'Confirmadas' },
    { key: 'cancelled', label: 'Canceladas' },
  ];

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--text-3)', fontFamily: 'sans-serif', fontSize: 14 }}>
      A carregar dados…
    </div>
  );

  return (
    <div style={{ '--font': 'Georgia, serif', ...Object.fromEntries(css.trim().split('\n').map(l => l.trim().replace(';','').split(': '))) }}>
      <style>{`:root { ${css} } body { background: var(--bg); }`}</style>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1.5rem 3rem', fontFamily: 'Georgia, serif', color: 'var(--text-1)' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', paddingBottom: '1.25rem', borderBottom: '0.5px solid var(--border)' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 'normal', letterSpacing: '-0.01em' }}>Anabela Castelôa Gil</h1>
            <p style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 3, fontFamily: 'sans-serif' }}>Paivas · Estúdio de Beleza e Depilação</p>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'sans-serif', textAlign: 'right', paddingTop: 4 }}>{today}</div>
        </div>

        {/* Metric cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10, marginBottom: 14 }}>
          <Metric label="Receita realizada" value={fmt(revDone)} sub="até hoje" variant="accent" />
          <Metric label="Receita prevista" value={fmt(revFuture)} sub="próximos 30 dias" variant="green" />
          <Metric label="Marcações totais" value={events.length} sub={`${pastEvts.length} realizadas · ${futureEvts.length} futuras`} />
          <Metric label="Clientes únicos" value={uniqueClients} sub={`${clients.length} registos no total`} />
        </div>

        {/* Insights */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10, marginBottom: 14 }}>
          <Insight title="Esta semana" value={`${thisWeek.length} marcações`} sub={`${fmt(weekRev)} esta semana`} />
          <Insight title="Próximas 48h" value={next48.length} sub="marcações agendadas" />
          <Insight title="Serviço mais popular" value={topSvc[0]} sub={`${topSvc[1]} vezes`} />
          <Insight title="Média por marcação" value={fmt(Math.round(avgPrice))} sub="receita média estimada" />
          <Insight title="Dia mais movimentado" value={busyDay} sub="historicamente" />
          <Insight title="Hora de pico" value={peakHour} sub="mais marcações" />
        </div>

        {/* Charts row 1 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 14, marginBottom: 14 }}>
          <Card title="Serviços mais pedidos">
            <Legend items={svcCounts.map(([label],i) => ({ label, color: COLORS[i%COLORS.length] }))} />
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={svcCounts.map(([name,value]) => ({name,value}))} margin={{top:4,right:4,left:-20,bottom:40}}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-3)' }} angle={-35} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-3)' }} />
                <Tooltip formatter={v => [v, 'Marcações']} contentStyle={{ background: 'var(--card-bg)', border: '0.5px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="value" radius={[4,4,0,0]}>
                  {svcCounts.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Receita por serviço (€)">
            <Legend items={svcRevenue.map(([label],i) => ({ label, color: COLORS[i%COLORS.length] }))} />
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={svcRevenue.map(([name,value]) => ({name, value: Math.round(value)}))} margin={{top:4,right:4,left:-20,bottom:40}}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-3)' }} angle={-35} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-3)' }} />
                <Tooltip formatter={v => [`€${v}`, 'Receita']} contentStyle={{ background: 'var(--card-bg)', border: '0.5px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="value" radius={[4,4,0,0]}>
                  {svcRevenue.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Charts row 2 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 14, marginBottom: 14 }}>
          <Card title="Marcações por mês">
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={monthData} margin={{top:4,right:4,left:-20,bottom:20}}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-3)' }} angle={-35} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-3)' }} />
                <Tooltip contentStyle={{ background: 'var(--card-bg)', border: '0.5px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="value" fill="#534AB7" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Hora de início mais frequente">
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={hourData} margin={{top:4,right:4,left:-20,bottom:10}}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-3)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-3)' }} />
                <Tooltip contentStyle={{ background: 'var(--card-bg)', border: '0.5px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="value" fill="#1D9E75" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Table */}
        <Card title="Marcações">
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setFilter(t.key)}
                style={{
                  background: filter === t.key ? 'var(--m-bg)' : 'transparent',
                  border: '0.5px solid var(--border)',
                  borderRadius: 8,
                  padding: '5px 12px',
                  fontSize: 11,
                  cursor: 'pointer',
                  color: filter === t.key ? 'var(--text-1)' : 'var(--text-2)',
                  fontFamily: 'sans-serif',
                  fontWeight: filter === t.key ? 500 : 400,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed', fontFamily: 'sans-serif' }}>
              <thead>
                <tr>
                  {['Cliente','Serviços','Data e hora','Preço','Estado'].map((h,i) => (
                    <th key={i} style={{ textAlign: 'left', fontWeight: 'normal', color: 'var(--text-3)', borderBottom: '0.5px solid var(--border)', padding: '6px 8px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', width: ['22%','30%','22%','13%','13%'][i] }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.slice(0,40).map((r, i) => {
                  const p = parseSvc(r.service || r.summary || '');
                  const svcs = p.services.slice(0,3).join(', ') || '—';
                  const isFuture = new Date(r.event_start_time) >= now;
                  const bStyle = STATUS_STYLES[r.status] || STATUS_STYLES.default;
                  const stateLabel = STATUS_LABELS[r.status] || 'Pendente';
                  return (
                    <tr key={i} style={{ background: isFuture ? 'var(--row-future)' : 'transparent' }}>
                      <td style={{ padding: '9px 8px', borderBottom: '0.5px solid var(--border)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.client || '—'}</td>
                      <td style={{ padding: '9px 8px', borderBottom: '0.5px solid var(--border)', color: 'var(--text-2)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{svcs}</td>
                      <td style={{ padding: '9px 8px', borderBottom: '0.5px solid var(--border)', color: 'var(--text-2)', fontSize: 12 }}>{fmtDT(r.event_start_time)}</td>
                      <td style={{ padding: '9px 8px', borderBottom: '0.5px solid var(--border)' }}>{fmt(Number(r.service_price||0))}</td>
                      <td style={{ padding: '9px 8px', borderBottom: '0.5px solid var(--border)' }}>
                        <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 10, letterSpacing: '0.02em', ...bStyle }}>{stateLabel}</span>
                      </td>
                    </tr>
                  );
                })}
                {tableRows.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: '14px 8px', color: 'var(--text-3)' }}>Sem marcações.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

      </div>
    </div>
  );
}
