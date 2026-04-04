import { useEffect, useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, CartesianGrid, ComposedChart
} from 'recharts';
import { supabase } from './supabaseClient';

// ─── Palette ────────────────────────────────────────────────────────────────
const COLORS = ['#C9A96E','#E8C99A','#A07840','#D4B896','#8B6432','#F0DEC0','#6E4E28','#B89060'];

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
    <div style={{background:'#1A120A',border:'1px solid rgba(201,169,110,0.3)',borderRadius:6,padding:'8px 12px',fontSize:12,color:'#F5ECD7',fontFamily:'sans-serif'}}>
      <div style={{color:'#C9A96E',marginBottom:3}}>{label}</div>
      {payload.map((p,i) => (
        <div key={i} style={{color:p.color||'#F5ECD7',marginTop:2}}>{p.name}: {prefix}{p.value}</div>
      ))}
    </div>
  );
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KPI({ label, value, sub, gold, red }) {
  const bg     = gold ? 'linear-gradient(135deg,#2A1F0F 0%,#1A120A 100%)' : red ? 'linear-gradient(135deg,#1F0A0A 0%,#1A0808 100%)' : 'rgba(255,255,255,0.03)';
  const border = gold ? '1px solid rgba(201,169,110,0.5)' : red ? '1px solid rgba(200,80,80,0.4)' : '1px solid rgba(255,255,255,0.07)';
  const valCol = gold ? '#C9A96E' : red ? '#F09090' : '#F5ECD7';
  return (
    <div style={{background:bg,border,borderRadius:10,padding:'18px 20px',position:'relative',overflow:'hidden'}}>
      {(gold||red) && <div style={{position:'absolute',top:-20,right:-20,width:80,height:80,background:`radial-gradient(circle,${gold?'rgba(201,169,110,0.15)':'rgba(200,80,80,0.12)'} 0%,transparent 70%)`,pointerEvents:'none'}} />}
      <div style={{fontSize:10,color:'#8A7A66',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:8,fontFamily:'sans-serif'}}>{label}</div>
      <div style={{fontSize:24,color:valCol,fontFamily:'Georgia,serif',letterSpacing:'-0.02em'}}>{value}</div>
      {sub && <div style={{fontSize:11,color:'#6A5A4A',marginTop:5,fontFamily:'sans-serif'}}>{sub}</div>}
    </div>
  );
}

// ─── Insight tile ─────────────────────────────────────────────────────────────
function Tile({ label, value, sub }) {
  return (
    <div style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:8,padding:'14px 16px'}}>
      <div style={{fontSize:9,color:'#6A5A4A',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:6,fontFamily:'sans-serif'}}>{label}</div>
      <div style={{fontSize:17,color:'#F5ECD7',fontFamily:'Georgia,serif'}}>{value}</div>
      {sub && <div style={{fontSize:11,color:'#6A5A4A',marginTop:3,fontFamily:'sans-serif'}}>{sub}</div>}
    </div>
  );
}

// ─── Section card ─────────────────────────────────────────────────────────────
function Section({ title, children, style={} }) {
  return (
    <div style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:12,padding:'20px',marginBottom:14,...style}}>
      {title && <div style={{fontSize:9,color:'#8A7A66',textTransform:'uppercase',letterSpacing:'0.12em',marginBottom:18,fontFamily:'sans-serif'}}>{title}</div>}
      {children}
    </div>
  );
}

// ─── Legend ──────────────────────────────────────────────────────────────────
function Legend({ items }) {
  return (
    <div style={{display:'flex',flexWrap:'wrap',gap:10,marginBottom:12}}>
      {items.map(({label,color},i) => (
        <span key={i} style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'#8A7A66',fontFamily:'sans-serif'}}>
          <span style={{width:8,height:8,borderRadius:2,background:color,flexShrink:0}} />
          {label}
        </span>
      ))}
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────
const BADGE = {
  confirmed: { bg:'rgba(30,90,60,0.4)', color:'#7FD4A8', label:'Confirmado' },
  cancelled: { bg:'rgba(90,20,20,0.4)', color:'#F09595', label:'Cancelado'  },
  default:   { bg:'rgba(80,60,10,0.4)', color:'#FAC775', label:'Pendente'   },
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
  if (pct >= 70) return '#7FD4A8';
  if (pct >= 50) return '#C9A96E';
  return '#F09595';
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
    serviceCosts.forEach(sc => { m[sc.service_name.toLowerCase().trim()] = Number(sc.total_cost||0); });
    return m;
  }, [serviceCosts]);

  function getCost(eventServiceName = '') {
    const key = eventServiceName.toLowerCase().trim();
    if (costMap[key]) return costMap[key];
    const resolved = parseSvc(eventServiceName).services;
    for (const s of resolved) {
      const k = s.toLowerCase();
      if (costMap[k]) return costMap[k];
    }
    return 0;
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
      const resolved    = parseSvc(e.service||'').services;
      const displayName = resolved[0] || e.service || 'Outro';
      const revenue     = Number(e.service_price||0);
      const cost        = getCost(e.service||'');
      if (!map[displayName]) map[displayName] = { name:displayName, revenue:0, cost:0, count:0 };
      map[displayName].revenue += revenue;
      map[displayName].cost    += cost;
      map[displayName].count   += 1;
    });
    return Object.values(map).map(v => ({
      ...v,
      profit:     v.revenue - v.cost,
      margin:     v.revenue > 0 ? Math.round(((v.revenue-v.cost)/v.revenue)*100) : 0,
      avgRevenue: v.count > 0 ? v.revenue/v.count : 0,
      avgCost:    v.count > 0 ? v.cost/v.count    : 0,
      avgProfit:  v.count > 0 ? (v.revenue-v.cost)/v.count : 0,
    })).sort((a,b) => b.profit - a.profit);
  }, [pastEvts, costMap]);

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

  const tomorrowEvts = useMemo(() => {
    const t = new Date(now); t.setDate(t.getDate()+1);
    const start = new Date(t.getFullYear(),t.getMonth(),t.getDate(),0,0,0);
    const end   = new Date(t.getFullYear(),t.getMonth(),t.getDate(),23,59,59);
    return events.filter(e=>{ const d=new Date(e.event_start_time); return d>=start&&d<=end; })
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
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'80vh',background:'#100C07',color:'#C9A96E',fontFamily:'Georgia,serif',fontSize:16,letterSpacing:'0.05em'}}>
      A carregar…
    </div>
  );

  const axisStyle = { fontSize:10, fill:'#6A5A4A' };

  return (
    <div style={{minHeight:'100vh',background:'#100C07',color:'#F5ECD7',fontFamily:'Georgia,serif'}}>
      <div style={{height:3,background:'linear-gradient(90deg,transparent,#C9A96E 40%,#E8C99A 60%,transparent)'}} />

      <div style={{maxWidth:1500,margin:'0 auto',padding:'2.5rem 2.5rem 4rem'}}>

        {/* ── Header ── */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginBottom:'2.5rem',paddingBottom:'1.5rem',borderBottom:'1px solid rgba(201,169,110,0.2)'}}>
          <div>
            <div style={{fontSize:11,color:'#8A7A66',letterSpacing:'0.18em',textTransform:'uppercase',fontFamily:'sans-serif',marginBottom:6}}>Estúdio de Beleza · Paivas</div>
            <h1 style={{fontSize:28,fontWeight:'normal',letterSpacing:'-0.02em',margin:0,color:'#F5ECD7'}}>Anabela Castelôa Gil</h1>
          </div>
          <div style={{fontSize:12,color:'#6A5A4A',fontFamily:'sans-serif',textAlign:'right',paddingBottom:2,textTransform:'capitalize'}}>{today}</div>
        </div>

        {/* ── KPI row ── */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(6,minmax(0,1fr))',gap:10,marginBottom:10}}>
          <KPI label="Receita realizada"  value={fmt(revDone)}           sub="total até hoje"                         gold />
          <KPI label="Receita prevista"   value={fmt(revFuture)}         sub="próximos 30 dias"                       gold />
          <KPI label="Custo total gasto"  value={fmtDec(totalCostSpent)} sub="materiais desde o início"               red  />
          <KPI label="Lucro total"        value={fmt(totalProfit)}       sub={`margem ${overallMargin.toFixed(1)}%`}  gold />
          <KPI label="Marcações totais"   value={events.length}          sub={`${pastEvts.length} passadas · ${futureEvts.length} futuras`} />
          <KPI label="Clientes únicos"    value={uniqueClients}          sub={`${clients.length} registos`} />
        </div>

        {/* ── Insight tiles ── */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(6,minmax(0,1fr))',gap:10,marginBottom:14}}>
          <Tile label="Esta semana"          value={`${thisWeek.length} marc.`} sub={fmt(weekRev)} />
          <Tile label="Próximas 48h"         value={`${next48.length} marc.`}   sub="agendadas" />
          <Tile label="Serviço mais popular" value={topSvc[0]}                  sub={`${topSvc[1]} vezes`} />
          <Tile label="Média por marcação"   value={fmt(Math.round(avgPrice))}  sub="receita média" />
          <Tile label="Dia mais movimentado" value={busyDay}                    sub="historicamente" />
          <Tile label="Hora de pico"         value={peakHour}                   sub="mais marcações" />
        </div>

        {/* ── Profitability table ── */}
        <Section title="Rentabilidade por serviço — desde o início">
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,fontFamily:'sans-serif'}}>
              <thead>
                <tr>
                  {['Serviço','Nº','Receita Total','Custo Total','Lucro Total','Margem %','Receita Média','Custo Médio','Lucro Médio'].map((h,i) => (
                    <th key={i} style={{textAlign:i===0?'left':'right',fontWeight:'normal',color:'#6A5A4A',borderBottom:'1px solid rgba(255,255,255,0.08)',padding:'7px 14px',fontSize:10,textTransform:'uppercase',letterSpacing:'0.07em',whiteSpace:'nowrap'}}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {svcProfitability.map((row,i) => (
                  <tr key={i}
                    style={{background:i%2===0?'rgba(255,255,255,0.01)':'transparent'}}
                    onMouseEnter={e=>e.currentTarget.style.background='rgba(201,169,110,0.05)'}
                    onMouseLeave={e=>e.currentTarget.style.background=i%2===0?'rgba(255,255,255,0.01)':'transparent'}
                  >
                    <td style={{padding:'9px 14px',borderBottom:'1px solid rgba(255,255,255,0.04)',color:'#F5ECD7',fontWeight:500,whiteSpace:'nowrap'}}>{row.name}</td>
                    <td style={{padding:'9px 14px',borderBottom:'1px solid rgba(255,255,255,0.04)',color:'#8A7A66',textAlign:'right'}}>{row.count}</td>
                    <td style={{padding:'9px 14px',borderBottom:'1px solid rgba(255,255,255,0.04)',color:'#C9A96E',textAlign:'right'}}>{fmtDec(row.revenue)}</td>
                    <td style={{padding:'9px 14px',borderBottom:'1px solid rgba(255,255,255,0.04)',color:'#F09090',textAlign:'right'}}>{fmtDec(row.cost)}</td>
                    <td style={{padding:'9px 14px',borderBottom:'1px solid rgba(255,255,255,0.04)',color:'#7FD4A8',textAlign:'right',fontWeight:600}}>{fmtDec(row.profit)}</td>
                    <td style={{padding:'9px 14px',borderBottom:'1px solid rgba(255,255,255,0.04)',textAlign:'right'}}>
                      <span style={{display:'inline-flex',alignItems:'center',gap:7}}>
                        <span style={{width:44,height:5,borderRadius:3,background:'rgba(255,255,255,0.08)',overflow:'hidden',display:'inline-block',flexShrink:0}}>
                          <span style={{display:'block',height:'100%',width:`${Math.min(Math.max(row.margin,0),100)}%`,background:marginColor(row.margin),borderRadius:3}} />
                        </span>
                        <span style={{color:marginColor(row.margin),minWidth:34}}>{row.margin}%</span>
                      </span>
                    </td>
                    <td style={{padding:'9px 14px',borderBottom:'1px solid rgba(255,255,255,0.04)',color:'#B8A898',textAlign:'right'}}>{fmtDec(row.avgRevenue)}</td>
                    <td style={{padding:'9px 14px',borderBottom:'1px solid rgba(255,255,255,0.04)',color:'#F09090',textAlign:'right'}}>{fmtDec(row.avgCost)}</td>
                    <td style={{padding:'9px 14px',borderBottom:'1px solid rgba(255,255,255,0.04)',color:'#7FD4A8',textAlign:'right'}}>{fmtDec(row.avgProfit)}</td>
                  </tr>
                ))}
                {svcProfitability.length===0 && (
                  <tr><td colSpan={9} style={{padding:'16px 14px',color:'#4A3A2A'}}>Sem dados. Verifica se a tabela service_costs está preenchida.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Section>

        {/* ── Charts row 1 ── */}
        <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr',gap:14,marginBottom:14}}>

          <Section title="Receita vs Custo vs Lucro por mês">
            <ResponsiveContainer width="100%" height={210}>
              <ComposedChart data={monthRevData} margin={{top:4,right:8,left:-18,bottom:28}}>
                <CartesianGrid stroke="rgba(255,255,255,0.03)" strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{...axisStyle}} angle={-35} textAnchor="end" interval={0} />
                <YAxis tick={{...axisStyle}} />
                <Tooltip content={<ChartTooltip prefix="€" />} />
                <Bar dataKey="Receita" fill="#C9A96E" radius={[3,3,0,0]} opacity={0.85} />
                <Bar dataKey="Custo"   fill="#C05050" radius={[3,3,0,0]} opacity={0.75} />
                <Line type="monotone" dataKey="Lucro" stroke="#7FD4A8" strokeWidth={2} dot={{r:3,fill:'#7FD4A8'}} activeDot={{r:5}} />
              </ComposedChart>
            </ResponsiveContainer>
          </Section>

          <Section title="Serviços mais pedidos">
            <Legend items={svcCounts.map(([label],i)=>({label,color:COLORS[i%COLORS.length]}))} />
            <ResponsiveContainer width="100%" height={165}>
              <BarChart data={svcCounts.map(([name,value])=>({name,value}))} margin={{top:4,right:4,left:-22,bottom:44}}>
                <XAxis dataKey="name" tick={{...axisStyle}} angle={-35} textAnchor="end" interval={0} />
                <YAxis tick={{...axisStyle}} />
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
                data={svcProfitability.slice(0,7).map(r=>({name:r.name,Custo:Math.round(r.cost),Lucro:Math.round(r.profit)}))}
                margin={{top:4,right:8,left:0,bottom:4}}
              >
                <XAxis type="number" tick={{...axisStyle}} />
                <YAxis type="category" dataKey="name" tick={{...axisStyle,fontSize:9}} width={85} />
                <Tooltip content={<ChartTooltip prefix="€" />} />
                <Bar dataKey="Custo" stackId="a" fill="#C05050" />
                <Bar dataKey="Lucro" stackId="a" fill="#7FD4A8" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </Section>
        </div>

        {/* ── Charts row 2 ── */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:14,marginBottom:14}}>

          <Section title="Marcações por mês">
            <ResponsiveContainer width="100%" height={175}>
              <BarChart data={monthData} margin={{top:4,right:4,left:-22,bottom:24}}>
                <XAxis dataKey="name" tick={{...axisStyle}} angle={-35} textAnchor="end" interval={0} />
                <YAxis tick={{...axisStyle}} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="value" fill="#C9A96E" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </Section>

          <Section title="Hora de início mais frequente">
            <ResponsiveContainer width="100%" height={175}>
              <BarChart data={hourData} margin={{top:4,right:4,left:-22,bottom:10}}>
                <XAxis dataKey="name" tick={{...axisStyle}} />
                <YAxis tick={{...axisStyle}} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="value" fill="#A07840" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </Section>

          <Section title="Clientes recentes">
            <div style={{display:'flex',flexDirection:'column',gap:0}}>
              {clients.slice(0,7).map((c,i) => {
                const ev = events.find(e=>e.event_id===c.event_id);
                return (
                  <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
                    <div>
                      <div style={{fontSize:13,color:'#F5ECD7'}}>{c.client_name||'—'}</div>
                      <div style={{fontSize:11,color:'#6A5A4A',fontFamily:'sans-serif',marginTop:1}}>{ev ? fmtDT(ev.event_start_time) : '—'}</div>
                    </div>
                    <div style={{fontSize:13,color:'#C9A96E'}}>{ev ? fmt(Number(ev.service_price||0)) : '—'}</div>
                  </div>
                );
              })}
            </div>
          </Section>
        </div>

        {/* ── Tomorrow panel ── */}
        {tomorrowEvts.length > 0 && (() => {
          const tmrDate = new Date(now); tmrDate.setDate(tmrDate.getDate()+1);
          const tmrLabel = tmrDate.toLocaleDateString('pt-PT',{weekday:'long',day:'numeric',month:'long'});
          return (
            <Section style={{marginBottom:14,borderColor:'rgba(201,169,110,0.25)',background:'rgba(201,169,110,0.04)'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                <div>
                  <div style={{fontSize:9,color:'#8A7A66',textTransform:'uppercase',letterSpacing:'0.12em',fontFamily:'sans-serif',marginBottom:4}}>Agenda de amanhã</div>
                  <div style={{fontSize:15,color:'#C9A96E',fontFamily:'Georgia,serif',textTransform:'capitalize'}}>{tmrLabel}</div>
                </div>
                <div style={{background:'rgba(201,169,110,0.15)',border:'1px solid rgba(201,169,110,0.3)',borderRadius:20,padding:'4px 14px',fontSize:12,color:'#C9A96E',fontFamily:'sans-serif'}}>
                  {tomorrowEvts.length} marcação{tomorrowEvts.length!==1?'ões':''}
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))',gap:10}}>
                {tomorrowEvts.map((r,i) => {
                  const cl = clients.find(c=>c.event_id===r.event_id);
                  const clientName = cl?.client_name || parseSvc(r.service||r.summary||'').client || '—';
                  const hour    = new Date(r.event_start_time).toLocaleTimeString('pt-PT',{hour:'2-digit',minute:'2-digit'});
                  const endHour = r.event_end_time ? new Date(r.event_end_time).toLocaleTimeString('pt-PT',{hour:'2-digit',minute:'2-digit'}) : null;
                  return (
                    <div key={i} style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(201,169,110,0.15)',borderRadius:8,padding:'12px 14px'}}>
                      <div style={{fontSize:18,color:'#C9A96E',fontFamily:'Georgia,serif',marginBottom:4}}>
                        {hour}{endHour && <span style={{fontSize:12,color:'#6A5A4A'}}> – {endHour}</span>}
                      </div>
                      <div style={{fontSize:13,color:'#F5ECD7',fontWeight:500,marginBottom:2}}>{clientName}</div>
                      <div style={{fontSize:11,color:'#8A7A66',fontFamily:'sans-serif'}}>{r.service||'—'}</div>
                      {Number(r.service_price||0)>0 && <div style={{fontSize:11,color:'#A07840',fontFamily:'sans-serif',marginTop:4}}>{fmt(Number(r.service_price))}</div>}
                    </div>
                  );
                })}
              </div>
            </Section>
          );
        })()}

        {/* ── Appointments table ── */}
        <Section title="Marcações">
          <div style={{display:'flex',gap:6,marginBottom:18,flexWrap:'wrap'}}>
            {TABS.map(t => (
              <button key={t.key} onClick={()=>setFilter(t.key)} style={{
                background: filter===t.key ? 'rgba(201,169,110,0.15)' : 'transparent',
                border: filter===t.key ? '1px solid rgba(201,169,110,0.4)' : '1px solid rgba(255,255,255,0.08)',
                borderRadius:6, padding:'5px 14px', fontSize:11, cursor:'pointer',
                color: filter===t.key ? '#C9A96E' : '#6A5A4A',
                fontFamily:'sans-serif', transition:'all 0.15s',
              }}>{t.label}</button>
            ))}
          </div>

          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13,tableLayout:'fixed',fontFamily:'sans-serif'}}>
              <thead>
                <tr>
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
                          textAlign:'left', fontWeight:'normal',
                          color: active ? '#C9A96E' : '#6A5A4A',
                          borderBottom:'1px solid rgba(255,255,255,0.08)',
                          padding:'7px 10px', fontSize:10, textTransform:'uppercase', letterSpacing:'0.07em',
                          width:w, cursor:col?'pointer':'default', userSelect:'none',
                        }}
                      >{label}<span style={{opacity:active?1:0.4}}>{arrow}</span></th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {tableRows.slice(0,50).map((r,i) => {
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
                      style={{background:isFuture?'rgba(201,169,110,0.04)':'transparent',transition:'background 0.1s'}}
                      onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.03)'}
                      onMouseLeave={e=>e.currentTarget.style.background=isFuture?'rgba(201,169,110,0.04)':'transparent'}
                    >
                      <td style={{padding:'10px',borderBottom:'1px solid rgba(255,255,255,0.05)',color:'#F5ECD7',fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{clientName}</td>
                      <td style={{padding:'10px',borderBottom:'1px solid rgba(255,255,255,0.05)',color:'#B8A898',fontSize:12,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{svcs}</td>
                      <td style={{padding:'10px',borderBottom:'1px solid rgba(255,255,255,0.05)',color:'#B8A898',fontSize:12}}>{fmtDT(r.event_start_time)}</td>
                      <td style={{padding:'10px',borderBottom:'1px solid rgba(255,255,255,0.05)',color:'#C9A96E'}}>{fmt(price)}</td>
                      <td style={{padding:'10px',borderBottom:'1px solid rgba(255,255,255,0.05)',color:cost>0?'#F09090':'#3A2A2A',fontSize:12}}>{cost>0 ? fmtDec(cost) : '—'}</td>
                      <td style={{padding:'10px',borderBottom:'1px solid rgba(255,255,255,0.05)',color:profit>0?'#7FD4A8':profit<0?'#F09090':'#3A2A2A',fontSize:12,fontWeight:500}}>{cost>0 ? fmtDec(profit) : '—'}</td>
                      <td style={{padding:'10px',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
                        <span style={{display:'inline-block',padding:'2px 9px',borderRadius:4,fontSize:10,letterSpacing:'0.03em',background:badge.bg,color:badge.color}}>{badge.label}</span>
                      </td>
                    </tr>
                  );
                })}
                {tableRows.length===0 && (
                  <tr><td colSpan={7} style={{padding:'16px 10px',color:'#4A3A2A'}}>Sem marcações.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Section>

      </div>
      <div style={{height:2,background:'linear-gradient(90deg,transparent,rgba(201,169,110,0.3),transparent)'}} />
    </div>
  );
}