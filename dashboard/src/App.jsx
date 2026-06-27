import { useEffect, useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  Line, CartesianGrid, ComposedChart
} from 'recharts';
import { supabase } from './supabaseClient';

// ─── Palette ────────────────────────────────────────────────────────────────
const COLORS = ['#2563EB','#14B8A6','#7C3AED','#F59E0B','#DC2626','#0EA5E9','#10B981','#6366F1'];

// ─── Theme tokens ────────────────────────────────────────────────────────────
const T = {
  bg:          '#F8FAFC',
  card:        '#FFFFFF',
  border:      '#E2E8F0',
  text:        '#0F172A',
  sub:         '#475569',
  muted:       '#64748B',
  faint:       '#94A3B8',
  goldText:    '#2563EB',
  goldBg:      '#EFF6FF',
  goldBorder:  '#BFDBFE',
  greenText:   '#0D9488',
  greenBg:     '#F0FDFA',
  greenBorder: '#99F6E4',
  redText:     '#DC2626',
  redBg:       '#FEF2F2',
  redBorder:   '#FECACA',
  upcoming:    '#F0F9FF',
};

// ─── i18n ────────────────────────────────────────────────────────────────────
const DAYS_PT   = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
const MONTHS_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

// ─── Service aliases ─────────────────────────────────────────────────────────
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

function normalizeServiceKey(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Formatters ──────────────────────────────────────────────────────────────
function fmt(n) {
  return new Intl.NumberFormat('pt-PT', { style:'currency', currency:'EUR', maximumFractionDigits:0 }).format(n);
}
function fmtDec(n) {
  return new Intl.NumberFormat('pt-PT', { style:'currency', currency:'EUR', minimumFractionDigits:2, maximumFractionDigits:2 }).format(n);
}
function fmtDT(dt) {
  if (!dt) return '—';
  const d = new Date(dt);
  return d.toLocaleDateString('pt-PT',{day:'2-digit',month:'short',year:'numeric'})
    + ' ' + d.toLocaleTimeString('pt-PT',{hour:'2-digit',minute:'2-digit'});
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label, prefix='' }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,padding:'8px 12px',fontSize:12,color:T.text,boxShadow:'0 4px 12px rgba(0,0,0,0.10)'}}>
      <div style={{color:T.goldText,marginBottom:4,fontWeight:600}}>{label}</div>
      {payload.map((p,i) => (
        <div key={i} style={{color:p.color||T.text,marginTop:2}}>{p.name}: {prefix}{p.value}</div>
      ))}
    </div>
  );
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KPI({ label, value, sub, type }) {
  const variants = {
    gold:  { bg: T.goldBg,  border: T.goldBorder,  val: T.goldText,  sub: '#A07030' },
    green: { bg: T.greenBg, border: T.greenBorder, val: T.greenText, sub: '#2A6040' },
    red:   { bg: T.redBg,   border: T.redBorder,   val: T.redText,   sub: '#803030' },
    plain: { bg: T.card,    border: T.border,       val: T.text,      sub: T.muted  },
  };
  const v = variants[type] || variants.plain;
  return (
    <div style={{background:v.bg,border:`1px solid ${v.border}`,borderRadius:12,padding:'20px 22px',boxShadow:'0 1px 4px rgba(0,0,0,0.06)'}}>
      <div style={{fontSize:11,color:T.muted,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:10,fontWeight:600}}>{label}</div>
      <div style={{fontSize:28,color:v.val,fontWeight:700,letterSpacing:'-0.03em',lineHeight:1}}>{value}</div>
      {sub && <div style={{fontSize:12,color:v.sub,marginTop:8}}>{sub}</div>}
    </div>
  );
}

// ─── Insight tile ─────────────────────────────────────────────────────────────
function Tile({ label, value, sub }) {
  return (
    <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'16px 18px',boxShadow:'0 1px 3px rgba(0,0,0,0.05)'}}>
      <div style={{fontSize:10,color:T.muted,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8,fontWeight:600}}>{label}</div>
      <div style={{fontSize:18,color:T.text,fontWeight:700,letterSpacing:'-0.02em'}}>{value}</div>
      {sub && <div style={{fontSize:12,color:T.sub,marginTop:4}}>{sub}</div>}
    </div>
  );
}

// ─── Section card ─────────────────────────────────────────────────────────────
function Section({ title, children, style={} }) {
  return (
    <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:'22px 24px',marginBottom:16,boxShadow:'0 1px 4px rgba(0,0,0,0.05)',...style}}>
      {title && <div style={{fontSize:11,color:T.muted,textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:18,fontWeight:600}}>{title}</div>}
      {children}
    </div>
  );
}

// ─── Legend ──────────────────────────────────────────────────────────────────
function Legend({ items }) {
  return (
    <div style={{display:'flex',flexWrap:'wrap',gap:10,marginBottom:12}}>
      {items.map(({label,color},i) => (
        <span key={i} style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:T.sub}}>
          <span style={{width:8,height:8,borderRadius:2,background:color,flexShrink:0}} />
          {label}
        </span>
      ))}
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────
const BADGE = {
  confirmed: { bg: T.greenBg,  border: '#B0DCC8', color: T.greenText, label:'Confirmado' },
  cancelled: { bg: T.redBg,    border: '#E8B0B0', color: T.redText,   label:'Cancelado'  },
  default:   { bg: '#FFF8E8',  border: '#E8D890', color: '#907830',   label:'Pendente'   },
};

// ─── Filter tabs ──────────────────────────────────────────────────────────────
const TABS = [
  {key:'all',label:'Todas'},
  {key:'past',label:'Passadas'},
  {key:'upcoming',label:'Futuras'},
  {key:'confirmed',label:'Confirmadas'},
  {key:'cancelled',label:'Canceladas'},
];

// ─── Margin colour ────────────────────────────────────────────────────────────
function marginColor(pct) {
  if (pct >= 70) return T.greenText;
  if (pct >= 50) return T.goldText;
  return T.redText;
}

// ═════════════════════════════════════════════════════════════════════════════
export default function Dashboard() {
  const [events,       setEvents]       = useState([]);
  const [clients,      setClients]      = useState([]);
  const [serviceCosts, setServiceCosts] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [filter,       setFilter]       = useState('all');
  const [sortCol,      setSortCol]      = useState('date');
  const [sortDir,      setSortDir]      = useState('asc');

  useEffect(() => {
    (async () => {
      const [evRes, clRes, scRes] = await Promise.all([
        supabase.from('events').select('*').order('event_start_time', {ascending:false}),
        supabase.from('clients').select('*'),
        supabase.from('service_costs').select('*'),
      ]);
      setEvents(evRes.data       || []);
      setClients(clRes.data      || []);
      setServiceCosts(scRes.data || []);
      setLoading(false);
    })();
  }, []);

  // ── Cost lookup: service_name → total_cost ──────────────────────────────
  const costMap = useMemo(() => {
    const m = {};
    serviceCosts.forEach(sc => {
      m[normalizeServiceKey(sc.service_name)] = Number(sc.total_cost || 0);
    });
    return m;
  }, [serviceCosts]);

  const knownServiceMap = useMemo(() => {
    const m = {};
    serviceCosts.forEach(sc => {
      const canonical = String(sc.service_name || '').trim();
      if (canonical) m[normalizeServiceKey(canonical)] = canonical;
    });
    Object.values(ALIASES).forEach(name => {
      const canonical = String(name || '').trim();
      if (canonical && !m[normalizeServiceKey(canonical)]) {
        m[normalizeServiceKey(canonical)] = canonical;
      }
    });
    return m;
  }, [serviceCosts]);

  function getServiceCostByName(serviceName = '') {
    const key = normalizeServiceKey(serviceName);
    return Number(costMap[key] || 0);
  }

  function resolveEventServices(eventServiceName = '') {
    const raw = String(eventServiceName || '').trim();
    if (!raw) return [];

    const resolved = [];
    const seen = new Set();
    const addService = (candidate) => {
      const key = normalizeServiceKey(candidate);
      if (!key || seen.has(key)) return;
      const canonical = knownServiceMap[key] || String(candidate || '').trim();
      if (!canonical) return;
      seen.add(key);
      resolved.push(canonical);
    };

    const chunks = raw.split(/\s*[|/+;&]\s*/).map(s => s.trim()).filter(Boolean);
    if (chunks.length > 1) {
      chunks.forEach(chunk => {
        const parsed = parseSvc(chunk).services;
        if (parsed.length) parsed.forEach(addService);
        else addService(chunk);
      });
    }

    const parsedAll = parseSvc(raw).services;
    parsedAll.forEach(addService);

    if (!resolved.length && knownServiceMap[normalizeServiceKey(raw)]) {
      addService(raw);
    }

    return resolved;
  }

  function getCost(eventServiceName = '') {
    const key = normalizeServiceKey(eventServiceName);
    if (costMap[key]) return costMap[key];
    const resolved = resolveEventServices(eventServiceName);
    if (!resolved.length) return 0;
    return resolved.reduce((sum, s) => sum + getServiceCostByName(s), 0);
  }

  // ── Time helpers ───────────────────────────────────────────────────────
  const now       = useMemo(() => new Date(), []);
  const in30      = useMemo(() => new Date(now.getTime() + 30*86400000), [now]);
  const in48      = useMemo(() => new Date(now.getTime() + 48*3600000),  [now]);
  const weekStart = useMemo(() => { const d=new Date(now); const dy=d.getDay(); d.setDate(d.getDate()-(dy===0?6:dy-1)); d.setHours(0,0,0,0); return d; }, [now]);
  const weekEnd   = useMemo(() => { const d=new Date(weekStart); d.setDate(d.getDate()+6); d.setHours(23,59,59,999); return d; }, [weekStart]);

  const pastEvts   = useMemo(() => events.filter(e => e.event_start_time && new Date(e.event_start_time)<=now),  [events,now]);
  const futureEvts = useMemo(() => events.filter(e => e.event_start_time && new Date(e.event_start_time)>now),   [events,now]);
  const next30     = useMemo(() => futureEvts.filter(e => new Date(e.event_start_time)<=in30),                   [futureEvts,in30]);
  const next48     = useMemo(() => futureEvts.filter(e => new Date(e.event_start_time)<=in48),                   [futureEvts,in48]);
  const thisWeek   = useMemo(() => events.filter(e => { const d=new Date(e.event_start_time); return d>=weekStart&&d<=weekEnd; }), [events,weekStart,weekEnd]);

  const revDone    = useMemo(() => pastEvts.reduce((s,e)=>s+Number(e.service_price||0),0),  [pastEvts]);
  const revFuture  = useMemo(() => next30.reduce((s,e)=>s+Number(e.service_price||0),0),    [next30]);
  const weekRev    = useMemo(() => thisWeek.reduce((s,e)=>s+Number(e.service_price||0),0),  [thisWeek]);
  const avgPrice   = useMemo(() => pastEvts.length ? revDone/pastEvts.length : 0,           [pastEvts,revDone]);
  const uniqueClients = useMemo(() => new Set(clients.map(c=>c.client_name)).size,          [clients]);

  // ── Cost & profit totals ────────────────────────────────────────────────
  const totalCostSpent = useMemo(() =>
    pastEvts.reduce((s,e) => s + getCost(e.service||''), 0),
  [pastEvts, costMap]);

  const totalProfit   = useMemo(() => revDone - totalCostSpent, [revDone, totalCostSpent]);
  const overallMargin = useMemo(() => revDone > 0 ? (totalProfit/revDone)*100 : 0, [totalProfit, revDone]);

  // ── Per-service profitability ───────────────────────────────────────────
  const svcProfitability = useMemo(() => {
    const map = {};
    pastEvts.forEach(e => {
      const resolved = resolveEventServices(e.service || '');
      const services = resolved.length ? resolved : [e.service || 'Outro'];
      const revenueTotal = Number(e.service_price||0);
      const revenuePerService = services.length ? (revenueTotal / services.length) : 0;

      services.forEach(serviceName => {
        const normalized = serviceName || 'Outro';
        const cost = getServiceCostByName(normalized);
        const perServiceMargin = revenuePerService > 0 ? ((revenuePerService - cost) / revenuePerService) * 100 : 0;

        if (!map[normalized]) {
          map[normalized] = {
            name: normalized,
            revenue: 0,
            cost: 0,
            count: 0,
            marginSum: 0,
            marginCount: 0,
          };
        }

        map[normalized].revenue += revenuePerService;
        map[normalized].cost += cost;
        map[normalized].count += 1;
        map[normalized].marginSum += perServiceMargin;
        map[normalized].marginCount += 1;
      });
    });
    return Object.values(map).map(v => ({
      ...v,
      profit:     v.revenue - v.cost,
      margin:     v.marginCount > 0 ? Math.round(v.marginSum / v.marginCount) : 0,
      avgRevenue: v.count > 0 ? v.revenue/v.count : 0,
      avgCost:    v.count > 0 ? v.cost/v.count    : 0,
      avgProfit:  v.count > 0 ? (v.revenue-v.cost)/v.count : 0,
    })).sort((a,b) => b.profit - a.profit);
  }, [pastEvts, costMap, knownServiceMap]);

  const orderedSvcProfitability = useMemo(
    () => [...svcProfitability].sort((a, b) => b.profit - a.profit),
    [svcProfitability],
  );

  const paretoData = useMemo(() => {
    const base = orderedSvcProfitability.filter(r => r.profit > 0).slice(0, 12);
    const total = base.reduce((sum, r) => sum + r.profit, 0);
    let cumulative = 0;
    return base.map(r => {
      cumulative += r.profit;
      return {
        name: r.name,
        Lucro: Math.round(r.profit),
        Acumulado: total > 0 ? Number(((cumulative / total) * 100).toFixed(1)) : 0,
      };
    });
  }, [orderedSvcProfitability]);

  // ── Chart data ─────────────────────────────────────────────────────────
  const svcCounts = useMemo(() => {
    const counts = {};
    events.forEach(e => {
      const svcs = parseSvc(e.service||e.summary||'').services;
      (svcs.length ? svcs : ['Outro']).forEach(s => { counts[s]=(counts[s]||0)+1; });
    });
    return Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,7);
  }, [events]);

  const monthData = useMemo(() => {
    const counts = {};
    events.forEach(e => {
      if (!e.event_start_time) return;
      const d = new Date(e.event_start_time);
      const k = d.getFullYear()*100 + d.getMonth();
      const label = `${MONTHS_PT[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
      if (!counts[k]) counts[k] = { name:label, value:0 };
      counts[k].value += 1;
    });
    return Object.entries(counts).sort((a,b)=>Number(a[0])-Number(b[0])).slice(-12).map(([,v])=>v);
  }, [events]);

  const monthRevData = useMemo(() => {
    const rev = {};
    pastEvts.forEach(e => {
      if (!e.event_start_time) return;
      const d = new Date(e.event_start_time);
      const k = d.getFullYear()*100 + d.getMonth();
      const label = `${MONTHS_PT[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
      if (!rev[k]) rev[k] = { name:label, Receita:0, Custo:0, Lucro:0 };
      rev[k].Receita += Number(e.service_price||0);
      rev[k].Custo   += getCost(e.service||'');
    });
    return Object.entries(rev)
      .sort((a,b)=>Number(a[0])-Number(b[0])).slice(-12)
      .map(([,v])=>({ name:v.name, Receita:Math.round(v.Receita), Custo:Math.round(v.Custo), Lucro:Math.round(v.Receita-v.Custo) }));
  }, [pastEvts, costMap]);

  const hourData = useMemo(() => {
    const counts = Array(24).fill(0);
    events.forEach(e => { if (e.event_start_time) counts[new Date(e.event_start_time).getHours()]++; });
    return Array.from({length:13},(_,i)=>({name:`${i+8}h`,value:counts[i+8]}));
  }, [events]);

  const busyDay  = useMemo(() => { const c=Array(7).fill(0); events.forEach(e=>{if(e.event_start_time)c[new Date(e.event_start_time).getDay()]++;}); return DAYS_PT[c.indexOf(Math.max(...c))]||'—'; }, [events]);
  const peakHour = useMemo(() => { const c=Array(24).fill(0); events.forEach(e=>{if(e.event_start_time)c[new Date(e.event_start_time).getHours()]++;}); const h=c.indexOf(Math.max(...c)); return h>0?`${h}h00`:'—'; }, [events]);
  const topSvc   = useMemo(() => svcCounts[0]||['—',0], [svcCounts]);

  const todayEvts = useMemo(() => {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return events
      .filter(e => {
        if (!e.event_start_time) return false;
        const d = new Date(e.event_start_time);
        return d >= start && d <= end;
      })
      .sort((a,b)=>new Date(a.event_start_time)-new Date(b.event_start_time));
  }, [events, now]);

  const tomorrowEvts = useMemo(() => {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 59, 999);
    return events
      .filter(e => {
        if (!e.event_start_time) return false;
        const d = new Date(e.event_start_time);
        return d >= start && d <= end;
      })
      .sort((a,b)=>new Date(a.event_start_time)-new Date(b.event_start_time));
  }, [events, now]);

  const tableRows = useMemo(() => {
    let rows;
    if (filter==='past')           rows = events.filter(e=>new Date(e.event_start_time)<now);
    else if (filter==='upcoming')  rows = events.filter(e=>new Date(e.event_start_time)>=now);
    else if (filter==='confirmed') rows = events.filter(e=>e.status==='confirmed');
    else if (filter==='cancelled') rows = events.filter(e=>e.status==='cancelled');
    else rows = [...events];
    const getClientName = r => { const cl=clients.find(c=>c.event_id===r.event_id); return (cl?.client_name||parseSvc(r.service||r.summary||'').client||'').toLowerCase(); };
    rows.sort((a,b) => {
      let va,vb;
      if      (sortCol==='client')  { va=getClientName(a); vb=getClientName(b); }
      else if (sortCol==='service') { va=(a.service||'').toLowerCase(); vb=(b.service||'').toLowerCase(); }
      else if (sortCol==='price')   { va=Number(a.service_price||0); vb=Number(b.service_price||0); }
      else if (sortCol==='status')  { va=a.status||''; vb=b.status||''; }
      else { va=new Date(a.event_start_time||0); vb=new Date(b.event_start_time||0); }
      if (va<vb) return sortDir==='asc'?-1:1;
      if (va>vb) return sortDir==='asc'?1:-1;
      return 0;
    });
    return rows;
  }, [events,filter,now,sortCol,sortDir,clients]);

  const today = now.toLocaleDateString('pt-PT',{weekday:'long',day:'numeric',month:'long',year:'numeric'});

  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'80vh',background:T.bg,color:T.goldText,fontSize:16,fontWeight:600}}>
      A carregar…
    </div>
  );

  const axisStyle = { fontSize:11, fill: T.muted };

  return (
    <div style={{minHeight:'100vh',background:T.bg,color:T.text}}>
      <div style={{height:4,background:`linear-gradient(90deg,#2563EB,#14B8A6,#2563EB)`}} />

      <div style={{maxWidth:1500,margin:'0 auto',padding:'28px 28px 48px'}}>

        {/* ── Header ── */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginBottom:'28px',paddingBottom:'20px',borderBottom:`2px solid ${T.border}`}}>
          <div>
            <div style={{fontSize:12,color:T.muted,letterSpacing:'0.12em',textTransform:'uppercase',fontWeight:600,marginBottom:6}}>Estúdio de Beleza · Paivas</div>
            <h1 style={{fontSize:26,fontWeight:700,letterSpacing:'-0.02em',margin:0,color:T.text}}>Anabela Castelôa Gil</h1>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:14,color:T.sub,textTransform:'capitalize',fontWeight:500}}>{today}</div>
            <div style={{fontSize:12,color:T.muted,marginTop:4}}>Painel de gestão</div>
          </div>
        </div>

        {/* ── KPI row ── */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(6,minmax(0,1fr))',gap:12,marginBottom:12}}>
          <KPI label="Receita realizada"  value={fmt(revDone)}           sub="total até hoje"                        type="gold"  />
          <KPI label="Receita prevista"   value={fmt(revFuture)}         sub="próximos 30 dias"                      type="gold"  />
          <KPI label="Custo total"        value={fmtDec(totalCostSpent)} sub="materiais gastos"                      type="red"   />
          <KPI label="Lucro total"        value={fmt(totalProfit)}       sub={`margem ${overallMargin.toFixed(1)}%`} type="green" />
          <KPI label="Marcações totais"   value={events.length}          sub={`${pastEvts.length} passadas · ${futureEvts.length} futuras`} type="plain" />
          <KPI label="Clientes únicos"    value={uniqueClients}          sub={`${clients.length} registos totais`}  type="plain" />
        </div>

        {/* ── Insight tiles ── */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(6,minmax(0,1fr))',gap:12,marginBottom:18}}>
          <Tile label="Esta semana"          value={`${thisWeek.length} marc.`}  sub={fmt(weekRev)} />
          <Tile label="Próximas 48h"         value={`${next48.length} marc.`}    sub="agendadas" />
          <Tile label="Serviço mais popular" value={topSvc[0]}                   sub={`${topSvc[1]} vezes`} />
          <Tile label="Média por marcação"   value={fmt(Math.round(avgPrice))}   sub="receita média" />
          <Tile label="Dia mais movimentado" value={busyDay}                     sub="historicamente" />
          <Tile label="Hora de pico"         value={peakHour}                    sub="mais marcações" />
        </div>

        {/* ── Today + tomorrow panel ── */}
        {(todayEvts.length > 0 || tomorrowEvts.length > 0) && (() => {
          const todayLabel = now.toLocaleDateString('pt-PT',{weekday:'long',day:'numeric',month:'long'});
          const tmrDate = new Date(now); tmrDate.setDate(tmrDate.getDate()+1);
          const tmrLabel = tmrDate.toLocaleDateString('pt-PT',{weekday:'long',day:'numeric',month:'long'});
          return (
            <div style={{background:T.goldBg,border:`1px solid ${T.goldBorder}`,borderRadius:14,padding:'22px 24px',marginBottom:18,boxShadow:'0 1px 4px rgba(0,0,0,0.05)'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                <div>
                  <div style={{fontSize:11,color:T.goldText,textTransform:'uppercase',letterSpacing:'0.1em',fontWeight:600,marginBottom:4}}>📅 Agenda de hoje e amanhã</div>
                  <div style={{fontSize:16,color:T.text,fontWeight:700,textTransform:'capitalize'}}>{todayLabel} · {tmrLabel}</div>
                </div>
                <div style={{background:'#FFF',border:`1px solid ${T.goldBorder}`,borderRadius:20,padding:'5px 16px',fontSize:13,color:T.goldText,fontWeight:600}}>
                  {todayEvts.length + tomorrowEvts.length} marcaç{(todayEvts.length + tomorrowEvts.length)!==1?'ões':'ão'}
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(340px,1fr))',gap:14}}>
                <div style={{background:'#FFFFFF',border:`1px solid ${T.goldBorder}`,borderRadius:12,padding:'14px 14px 10px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                    <div style={{fontSize:11,color:T.goldText,textTransform:'uppercase',letterSpacing:'0.08em',fontWeight:700}}>Hoje</div>
                    <div style={{background:T.goldBg,border:`1px solid ${T.goldBorder}`,borderRadius:20,padding:'3px 10px',fontSize:12,color:T.goldText,fontWeight:700}}>
                      {todayEvts.length}
                    </div>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))',gap:10}}>
                    {todayEvts.length ? todayEvts.map((r,i) => {
                      const cl = clients.find(c=>c.event_id===r.event_id);
                      const clientName = cl?.client_name || parseSvc(r.service||r.summary||'').client || '—';
                      const hour    = new Date(r.event_start_time).toLocaleTimeString('pt-PT',{hour:'2-digit',minute:'2-digit'});
                      const endHour = r.event_end_time ? new Date(r.event_end_time).toLocaleTimeString('pt-PT',{hour:'2-digit',minute:'2-digit'}) : null;
                      return (
                        <div key={`today-${i}`} style={{background:'#FFFFFF',border:`1px solid ${T.goldBorder}`,borderRadius:10,padding:'12px 14px',boxShadow:'0 1px 3px rgba(0,0,0,0.05)'}}>
                          <div style={{fontSize:18,color:T.goldText,fontWeight:700,marginBottom:4}}>
                            {hour}{endHour && <span style={{fontSize:12,color:T.muted,fontWeight:400}}> – {endHour}</span>}
                          </div>
                          <div style={{fontSize:13,color:T.text,fontWeight:600,marginBottom:2}}>{clientName}</div>
                          <div style={{fontSize:11,color:T.sub}}>{r.service||'—'}</div>
                          {Number(r.service_price||0)>0 && <div style={{fontSize:11,color:T.goldText,fontWeight:600,marginTop:5}}>{fmt(Number(r.service_price))}</div>}
                        </div>
                      );
                    }) : <div style={{fontSize:12,color:T.muted,padding:'6px 2px'}}>Sem marcações para hoje.</div>}
                  </div>
                </div>

                <div style={{background:'#FFFFFF',border:`1px solid ${T.goldBorder}`,borderRadius:12,padding:'14px 14px 10px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                    <div style={{fontSize:11,color:T.goldText,textTransform:'uppercase',letterSpacing:'0.08em',fontWeight:700}}>Amanhã</div>
                    <div style={{background:T.goldBg,border:`1px solid ${T.goldBorder}`,borderRadius:20,padding:'3px 10px',fontSize:12,color:T.goldText,fontWeight:700}}>
                      {tomorrowEvts.length}
                    </div>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))',gap:10}}>
                    {tomorrowEvts.length ? tomorrowEvts.map((r,i) => {
                      const cl = clients.find(c=>c.event_id===r.event_id);
                      const clientName = cl?.client_name || parseSvc(r.service||r.summary||'').client || '—';
                      const hour    = new Date(r.event_start_time).toLocaleTimeString('pt-PT',{hour:'2-digit',minute:'2-digit'});
                      const endHour = r.event_end_time ? new Date(r.event_end_time).toLocaleTimeString('pt-PT',{hour:'2-digit',minute:'2-digit'}) : null;
                      return (
                        <div key={`tmr-${i}`} style={{background:'#FFFFFF',border:`1px solid ${T.goldBorder}`,borderRadius:10,padding:'12px 14px',boxShadow:'0 1px 3px rgba(0,0,0,0.05)'}}>
                          <div style={{fontSize:18,color:T.goldText,fontWeight:700,marginBottom:4}}>
                            {hour}{endHour && <span style={{fontSize:12,color:T.muted,fontWeight:400}}> – {endHour}</span>}
                          </div>
                          <div style={{fontSize:13,color:T.text,fontWeight:600,marginBottom:2}}>{clientName}</div>
                          <div style={{fontSize:11,color:T.sub}}>{r.service||'—'}</div>
                          {Number(r.service_price||0)>0 && <div style={{fontSize:11,color:T.goldText,fontWeight:600,marginTop:5}}>{fmt(Number(r.service_price))}</div>}
                        </div>
                      );
                    }) : <div style={{fontSize:12,color:T.muted,padding:'6px 2px'}}>Sem marcações para amanhã.</div>}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── Profitability table ── */}
        <Section title="Rentabilidade por serviço" style={{padding:'16px 18px'}}>
          <div style={{maxHeight:300,overflowX:'auto',overflowY:'auto',border:`1px solid ${T.border}`,borderRadius:10}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead>
                <tr style={{borderBottom:`2px solid ${T.border}`,position:'sticky',top:0,background:T.card,zIndex:1}}>
                  {['Serviço','Receita Total','Custo Total','Lucro Total','Margem %','Receita Média','Custo Médio','Lucro Médio'].map((h,i) => (
                    <th key={i} style={{textAlign:i===0?'left':'right',fontWeight:600,color:T.muted,padding:'8px 14px',fontSize:11,textTransform:'uppercase',letterSpacing:'0.06em',whiteSpace:'nowrap'}}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orderedSvcProfitability.map((row,i) => (
                  <tr key={i}
                    style={{background:i%2===0?'#FAFAF8':'#FFF',borderBottom:`1px solid ${T.border}`}}
                    onMouseEnter={e=>e.currentTarget.style.background=T.goldBg}
                    onMouseLeave={e=>e.currentTarget.style.background=i%2===0?'#FAFAF8':'#FFF'}
                  >
                    <td style={{padding:'10px 14px',color:T.text,fontWeight:600,whiteSpace:'nowrap'}}>{row.name}</td>
                    <td style={{padding:'10px 14px',color:T.goldText,textAlign:'right',fontWeight:600}}>{fmtDec(row.revenue)}</td>
                    <td style={{padding:'10px 14px',color:T.redText,textAlign:'right'}}>{fmtDec(row.cost)}</td>
                    <td style={{padding:'10px 14px',color:T.greenText,textAlign:'right',fontWeight:700}}>{fmtDec(row.profit)}</td>
                    <td style={{padding:'10px 14px',textAlign:'right'}}>
                      <span style={{display:'inline-flex',alignItems:'center',gap:7}}>
                        <span style={{width:50,height:6,borderRadius:3,background:T.border,overflow:'hidden',display:'inline-block',flexShrink:0}}>
                          <span style={{display:'block',height:'100%',width:`${Math.min(Math.max(row.margin,0),100)}%`,background:marginColor(row.margin),borderRadius:3}} />
                        </span>
                        <span style={{color:marginColor(row.margin),fontWeight:600,minWidth:36}}>{row.margin}%</span>
                      </span>
                    </td>
                    <td style={{padding:'10px 14px',color:T.sub,textAlign:'right'}}>{fmtDec(row.avgRevenue)}</td>
                    <td style={{padding:'10px 14px',color:T.redText,textAlign:'right',opacity:0.7}}>{fmtDec(row.avgCost)}</td>
                    <td style={{padding:'10px 14px',color:T.greenText,textAlign:'right'}}>{fmtDec(row.avgProfit)}</td>
                  </tr>
                ))}
                {orderedSvcProfitability.length===0 && (
                  <tr><td colSpan={8} style={{padding:'16px 14px',color:T.muted}}>Sem dados. Verifica se a tabela service_costs está preenchida.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Gráfico de Pareto (lucro por serviço)">
          {paretoData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={paretoData} margin={{top:8,right:16,left:-16,bottom:48}}>
                <CartesianGrid stroke={T.border} strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={axisStyle} angle={-35} textAnchor="end" interval={0} />
                <YAxis yAxisId="left" tick={axisStyle} />
                <YAxis yAxisId="right" orientation="right" tick={axisStyle} domain={[0,100]} unit="%" />
                <Tooltip
                  formatter={(value, name) => (
                    name === 'Acumulado' ? `${value}%` : fmtDec(Number(value))
                  )}
                />
                <Bar yAxisId="left" dataKey="Lucro" fill={T.goldText} radius={[4,4,0,0]} />
                <Line yAxisId="right" type="monotone" dataKey="Acumulado" stroke={T.greenText} strokeWidth={2.5} dot={{r:3,fill:T.greenText}} activeDot={{r:5}} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div style={{padding:'14px 2px',color:T.muted,fontSize:13}}>Sem dados suficientes para o Pareto.</div>
          )}
        </Section>

        {/* ── Charts row 1 ── */}
        <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr',gap:14,marginBottom:16}}>

          <Section title="Receita vs Custo vs Lucro por mês">
            <ResponsiveContainer width="100%" height={210}>
              <ComposedChart data={monthRevData} margin={{top:4,right:8,left:-18,bottom:28}}>
                <CartesianGrid stroke={T.border} strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={axisStyle} angle={-35} textAnchor="end" interval={0} />
                <YAxis tick={axisStyle} />
                <Tooltip content={<ChartTooltip prefix="€" />} />
                <Bar dataKey="Receita" fill={T.goldText}  radius={[3,3,0,0]} opacity={0.85} />
                <Bar dataKey="Custo"   fill={T.redText}   radius={[3,3,0,0]} opacity={0.65} />
                <Line type="monotone" dataKey="Lucro" stroke={T.greenText} strokeWidth={2.5} dot={{r:3,fill:T.greenText}} activeDot={{r:5}} />
              </ComposedChart>
            </ResponsiveContainer>
          </Section>

          <Section title="Serviços mais pedidos">
            <Legend items={svcCounts.map(([label],i)=>({label,color:COLORS[i%COLORS.length]}))} />
            <ResponsiveContainer width="100%" height={165}>
              <BarChart data={svcCounts.map(([name,value])=>({name,value}))} margin={{top:4,right:4,left:-22,bottom:44}}>
                <XAxis dataKey="name" tick={axisStyle} angle={-35} textAnchor="end" interval={0} />
                <YAxis tick={axisStyle} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="value" radius={[4,4,0,0]}>
                  {svcCounts.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Section>

          <Section title="Lucro por serviço (top 7)">
            <ResponsiveContainer width="100%" height={210}>
              <BarChart
                layout="vertical"
                data={orderedSvcProfitability.slice(0,7).map(r=>({name:r.name,Custo:Math.round(r.cost),Lucro:Math.round(r.profit)}))}
                margin={{top:4,right:8,left:0,bottom:4}}
              >
                <XAxis type="number" tick={axisStyle} />
                <YAxis type="category" dataKey="name" tick={{...axisStyle,fontSize:10}} width={85} />
                <Tooltip content={<ChartTooltip prefix="€" />} />
                <Bar dataKey="Custo" stackId="a" fill={T.redText}   opacity={0.65} />
                <Bar dataKey="Lucro" stackId="a" fill={T.greenText} radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </Section>
        </div>

        {/* ── Charts row 2 ── */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:14,marginBottom:16}}>

          <Section title="Marcações por mês">
            <ResponsiveContainer width="100%" height={175}>
              <BarChart data={monthData} margin={{top:4,right:4,left:-22,bottom:24}}>
                <XAxis dataKey="name" tick={axisStyle} angle={-35} textAnchor="end" interval={0} />
                <YAxis tick={axisStyle} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="value" fill={T.goldText} radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </Section>

          <Section title="Hora de início mais frequente">
            <ResponsiveContainer width="100%" height={175}>
              <BarChart data={hourData} margin={{top:4,right:4,left:-22,bottom:10}}>
                <XAxis dataKey="name" tick={axisStyle} />
                <YAxis tick={axisStyle} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="value" fill="#5B9BD5" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </Section>

          <Section title="Clientes recentes">
            <div style={{display:'flex',flexDirection:'column'}}>
              {clients.slice(0,7).map((c,i) => {
                const ev = events.find(e=>e.event_id===c.event_id);
                return (
                  <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:`1px solid ${T.border}`}}>
                    <div>
                      <div style={{fontSize:14,color:T.text,fontWeight:600}}>{c.client_name||'—'}</div>
                      <div style={{fontSize:11,color:T.muted,marginTop:1}}>{ev ? fmtDT(ev.event_start_time) : '—'}</div>
                    </div>
                    <div style={{fontSize:14,color:T.goldText,fontWeight:600}}>{ev ? fmt(Number(ev.service_price||0)) : '—'}</div>
                  </div>
                );
              })}
            </div>
          </Section>
        </div>

        {/* ── Appointments table ── */}
        <Section title="Marcações">
          <div style={{display:'flex',gap:8,marginBottom:18,flexWrap:'wrap'}}>
            {TABS.map(t => (
              <button key={t.key} onClick={()=>setFilter(t.key)} style={{
                background: filter===t.key ? T.goldText : T.card,
                border: `1px solid ${filter===t.key ? T.goldText : T.border}`,
                borderRadius:20, padding:'6px 16px', fontSize:12, cursor:'pointer',
                color: filter===t.key ? '#FFF' : T.sub,
                fontWeight: filter===t.key ? 600 : 400,
                transition:'all 0.15s',
              }}>{t.label}</button>
            ))}
          </div>

          <div style={{maxHeight:420,overflowX:'auto',overflowY:'auto',border:`1px solid ${T.border}`,borderRadius:10}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13,tableLayout:'fixed'}}>
              <thead>
                <tr style={{borderBottom:`2px solid ${T.border}`,position:'sticky',top:0,background:T.card,zIndex:1}}>
                  {[
                    {label:'Cliente',    col:'client',  w:'18%'},
                    {label:'Serviço',    col:'service', w:'22%'},
                    {label:'Data e hora',col:'date',    w:'18%'},
                    {label:'Preço',      col:'price',   w:'10%'},
                    {label:'Custo',      col:null,      w:'10%'},
                    {label:'Lucro',      col:null,      w:'10%'},
                    {label:'Estado',     col:'status',  w:'12%'},
                  ].map(({label,col,w},i) => {
                    const active = col && sortCol===col;
                    const arrow  = active ? (sortDir==='asc'?' ↑':' ↓') : (col?' ↕':'');
                    return (
                      <th key={i}
                        onClick={col ? ()=>{ if(active) setSortDir(d=>d==='asc'?'desc':'asc'); else { setSortCol(col); setSortDir('asc'); }} : undefined}
                        style={{
                          textAlign:'left', fontWeight:600,
                          color: active ? T.goldText : T.muted,
                          padding:'8px 10px', fontSize:11, textTransform:'uppercase', letterSpacing:'0.06em',
                          width:w, cursor:col?'pointer':'default', userSelect:'none',
                        }}
                      >{label}<span style={{opacity:active?1:0.5}}>{arrow}</span></th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {tableRows.map((r,i) => {
                  const cl         = clients.find(c=>c.event_id===r.event_id);
                  const clientName = cl?.client_name || parseSvc(r.service||r.summary||'').client || '—';
                  const svcs       = parseSvc(r.service||r.summary||'').services.slice(0,2).join(', ') || r.service || '—';
                  const isFuture   = new Date(r.event_start_time) >= now;
                  const badge      = BADGE[r.status] || BADGE.default;
                  const price      = Number(r.service_price||0);
                  const cost       = getCost(r.service||'');
                  const profit     = price - cost;
                  return (
                    <tr key={i}
                      style={{background:isFuture ? T.upcoming : (i%2===0?'#FAFAF8':'#FFF'),borderBottom:`1px solid ${T.border}`,transition:'background 0.1s'}}
                      onMouseEnter={e=>e.currentTarget.style.background=T.goldBg}
                      onMouseLeave={e=>e.currentTarget.style.background=isFuture ? T.upcoming : (i%2===0?'#FAFAF8':'#FFF')}
                    >
                      <td style={{padding:'11px 10px',color:T.text,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{clientName}</td>
                      <td style={{padding:'11px 10px',color:T.sub,fontSize:12,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{svcs}</td>
                      <td style={{padding:'11px 10px',color:T.sub,fontSize:12}}>{fmtDT(r.event_start_time)}</td>
                      <td style={{padding:'11px 10px',color:T.goldText,fontWeight:600}}>{fmt(price)}</td>
                      <td style={{padding:'11px 10px',color:cost>0?T.redText:T.faint,fontSize:12}}>{cost>0 ? fmtDec(cost) : '—'}</td>
                      <td style={{padding:'11px 10px',color:profit>0?T.greenText:profit<0?T.redText:T.faint,fontSize:12,fontWeight:600}}>{cost>0 ? fmtDec(profit) : '—'}</td>
                      <td style={{padding:'11px 10px'}}>
                        <span style={{display:'inline-block',padding:'3px 10px',borderRadius:6,fontSize:11,fontWeight:600,background:badge.bg,color:badge.color,border:`1px solid ${badge.border}`}}>{badge.label}</span>
                      </td>
                    </tr>
                  );
                })}
                {tableRows.length===0 && (
                  <tr><td colSpan={7} style={{padding:'20px 10px',color:T.muted,textAlign:'center'}}>Sem marcações.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Section>

      </div>
      <div style={{height:3,background:`linear-gradient(90deg,transparent,#2563EB,#14B8A6,transparent)`,opacity:0.4}} />
    </div>
  );
}
