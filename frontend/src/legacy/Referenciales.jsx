import {useState,useEffect,useCallback,useMemo,useRef} from 'react';
import {f0,f1,f2,fp,fd} from './core.js';
import {Ic,ic,Card,Sub} from './ui.jsx';
const ReferencialesView=()=>{
  const [subTab,setSubTab]=useState("construccion");
  const [selProj,setSelProj]=useState(null);
  const [filtCat,setFiltCat]=useState("all");
  const [filtZona,setFiltZona]=useState("all");
  const [filtTipo,setFiltTipo]=useState("all");

  const zonas=[...new Set(REF_DATA.map(p=>p.caracteristicas?.ubicacion).filter(Boolean))].sort();
  const tipos=["RESIDENCIAL","OFICINAS","USO MIXTO","COMERCIAL"];

  const filtered=REF_DATA.filter(p=>{
    if(filtCat!=="all"&&p.categoria!==filtCat) return false;
    if(filtZona!=="all"&&p.caracteristicas?.ubicacion!==filtZona) return false;
    if(filtTipo!=="all"&&p.caracteristicas?.uso!==filtTipo) return false;
    return true;
  });

  const getSec=(p,data)=>data==="construccion"?p.construccion:data==="equipo"?p.equipo:p.tecnico;
  const stats=(key,data)=>{const vals=filtered.map(p=>getSec(p,data)[key]).filter(v=>v!=null&&v>0);if(!vals.length)return{min:null,max:null,avg:null};return{min:Math.min(...vals),max:Math.max(...vals),avg:vals.reduce((a,b)=>a+b,0)/vals.length};};
  const statCell=(v,cls="")=>(<td className={`text-right py-2 px-2 font-mono text-xs ${cls}`}>{v!=null?`$${v.toFixed(2)}`:<span className="text-slate-300">—</span>}</td>);

  const CostTable=({data,labels})=>{
    const totals=filtered.map(p=>getSec(p,data).total).filter(v=>v!=null&&v>0);
    const tMin=totals.length?Math.min(...totals):null;
    const tMax=totals.length?Math.max(...totals):null;
    const tAvg=totals.length?totals.reduce((a,b)=>a+b,0)/totals.length:null;
    return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b-2 border-slate-200">
          <th className="text-left py-2 px-3 text-xs font-bold text-slate-400 uppercase sticky left-0 bg-white z-10">Rubro</th>
          {filtered.map(p=><th key={p.name} className="text-right py-2 px-2 text-xs font-bold text-slate-500 whitespace-nowrap min-w-[80px]">{p.name}</th>)}
          <th className="text-right py-2 px-2 text-xs font-bold text-blue-600 whitespace-nowrap min-w-[72px] bg-blue-50/50 border-l-2 border-blue-200">MÍN</th>
          <th className="text-right py-2 px-2 text-xs font-bold text-amber-600 whitespace-nowrap min-w-[72px] bg-amber-50/50">MEDIA</th>
          <th className="text-right py-2 px-2 text-xs font-bold text-red-600 whitespace-nowrap min-w-[72px] bg-red-50/50">MÁX</th>
        </tr></thead>
        <tbody>
          {Object.entries(labels).map(([key,label])=>{
            const hasAny=filtered.some(p=>getSec(p,data)[key]);
            if(!hasAny) return null;
            const s=stats(key,data);
            return (
              <tr key={key} className="border-b border-slate-100 hover:bg-emerald-50/30">
                <td className="py-2 px-3 text-slate-600 sticky left-0 bg-white">{label}</td>
                {filtered.map(p=>{const v=getSec(p,data)[key];return (
                  <td key={p.name} className="text-right py-2 px-2 font-mono text-slate-700">{v!=null?`$${v.toFixed(2)}`:<span className="text-slate-300">—</span>}</td>
                );})}
                {statCell(s.min,"text-blue-700 bg-blue-50/30 border-l-2 border-blue-100")}
                {statCell(s.avg,"text-amber-700 bg-amber-50/30")}
                {statCell(s.max,"text-red-700 bg-red-50/30")}
              </tr>
            );
          })}
          <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold">
            <td className="py-2.5 px-3 text-emerald-700 sticky left-0 bg-slate-50">TOTAL</td>
            {filtered.map(p=>{const sec=getSec(p,data);return (
              <td key={p.name} className="text-right py-2.5 px-2 font-mono text-emerald-700">{sec.total!=null?`$${sec.total.toFixed(2)}`:<span className="text-slate-300">—</span>}</td>
            );})}
            <td className="text-right py-2.5 px-2 font-mono text-blue-700 font-bold bg-blue-50/50 border-l-2 border-blue-200">{tMin!=null?`$${tMin.toFixed(2)}`:"—"}</td>
            <td className="text-right py-2.5 px-2 font-mono text-amber-700 font-bold bg-amber-50/50">{tAvg!=null?`$${tAvg.toFixed(2)}`:"—"}</td>
            <td className="text-right py-2.5 px-2 font-mono text-red-700 font-bold bg-red-50/50">{tMax!=null?`$${tMax.toFixed(2)}`:"—"}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );};

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6">
      {/* Header + Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div><h2 className="text-lg font-bold text-slate-800">Referenciales de Obras</h2><p className="text-sm text-slate-400">{filtered.length} de {REF_DATA.length} proyectos · Costos en $/m² con IVA</p></div>
        <div className="flex flex-wrap gap-2">
          <select value={filtCat} onChange={e=>setFiltCat(e.target.value)} className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg bg-white focus:outline-none">
            <option value="all">Todas las categorías</option>
            {REF_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filtZona} onChange={e=>setFiltZona(e.target.value)} className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg bg-white focus:outline-none">
            <option value="all">Todas las zonas</option>
            {zonas.map(z=><option key={z} value={z}>{z}</option>)}
          </select>
          <select value={filtTipo} onChange={e=>setFiltTipo(e.target.value)} className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg bg-white focus:outline-none">
            <option value="all">Todos los tipos</option>
            {tipos.map(t=><option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* Project pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        {filtered.map(p=>(
          <button key={p.name} onClick={()=>setSelProj(selProj===p.name?null:p.name)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${selProj===p.name?"bg-emerald-500 text-white shadow-sm":"bg-white border border-slate-200 text-slate-600 hover:border-emerald-300"}`}>
            {p.name} <span className="opacity-60">· {p.categoria||"—"}</span>
          </button>
        ))}
      </div>

      {/* Project detail card */}
      {selProj&&(()=>{const p=REF_DATA.find(x=>x.name===selProj);if(!p)return null;return (
        <div className="bg-white rounded-2xl border border-emerald-200 p-5 mb-6 shadow-sm">
          <div className="flex items-start justify-between mb-3">
            <div><h3 className="text-base font-bold text-slate-800">{p.name}</h3><span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">{p.categoria||"Sin categoría"}</span></div>
            <button onClick={()=>setSelProj(null)} className="text-slate-300 hover:text-slate-500"><Ic d={ic.trash} s={16}/></button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {Object.entries(REF_CHAR_LABELS).map(([k,label])=>{
              const v=p.caracteristicas[k];
              if(!v&&v!==0) return null;
              return <div key={k}><div className="text-[11px] text-slate-400">{label}</div><div className="text-sm font-semibold text-slate-700">{v}</div></div>;
            })}
          </div>
        </div>
      );})()}

      {/* Sub-tabs */}
      <div className="flex gap-1 mb-4 bg-white rounded-xl p-1 border border-slate-200">
        {[["construccion","Construcción"],["equipo","Equipo y Mobiliario"],["tecnico","Gastos Técnicos"]].map(([k,l])=>(
          <button key={k} onClick={()=>setSubTab(k)} className={`flex-1 py-2.5 text-xs font-semibold rounded-lg transition-all ${subTab===k?"bg-emerald-500 text-white shadow-sm":"text-slate-400 hover:bg-slate-50"}`}>{l}</button>
        ))}
      </div>

      {/* Cost tables */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {filtered.length===0
          ? <div className="text-center py-12 text-slate-400 text-sm">No hay proyectos que coincidan con los filtros</div>
          : <div className="p-4">
              {subTab==="construccion"&&<CostTable data="construccion" labels={REF_CONST_LABELS}/>}
              {subTab==="equipo"&&<CostTable data="equipo" labels={REF_EQUIP_LABELS}/>}
              {subTab==="tecnico"&&<CostTable data="tecnico" labels={REF_TECH_LABELS}/>}
            </div>
        }
      </div>
    </div>
  );
};

// ══════════════════════════════════════════
// HUB — Central Dashboard
// ══════════════════════════════════════════

export {ReferencialesView};
