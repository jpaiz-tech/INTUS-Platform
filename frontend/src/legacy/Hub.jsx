import {useState,useEffect,useCallback,useMemo,useRef} from 'react';
import {calc,D,f0,f1,f2,fp,fd} from './core.js';
import {IntusLogo,Ic,ic} from './ui.jsx';
const HubView=({pjs,refsCount,onNav})=>{
  const lastProj=pjs.length>0?pjs[pjs.length-1]:null;
  const totalAptos=pjs.reduce((s,p)=>{try{const r=calc({...D,...p});return s+(r.nApt||0);}catch{return s;}},0);

  const ModuleCard=({icon,title,desc,count,label,tab,color})=>(
    <button onClick={()=>onNav(tab)} className="bg-white rounded-2xl border border-slate-200 p-5 text-left hover:border-emerald-300 hover:shadow-md transition-all group">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Ic d={icon} s={18} className="text-white"/>
        </div>
        {count!=null&&<span className="text-2xl font-bold text-slate-800">{count}</span>}
      </div>
      <div className="text-sm font-semibold text-slate-800 mb-1">{title}</div>
      <div className="text-xs text-slate-400 mb-3">{desc}</div>
      {label&&<div className="text-[10px] text-slate-300 uppercase tracking-wider">{label}</div>}
      <div className="flex items-center gap-1 text-xs text-emerald-500 font-medium mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
        Abrir módulo <Ic d="M9 5l7 7-7 7" s={12}/>
      </div>
    </button>
  );

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800 mb-1">Bienvenido a INTUS Platform</h1>
        <p className="text-sm text-slate-400">Plataforma integral de conocimiento empresarial</p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-400 mb-1">Terrenos evaluados</div>
          <div className="text-xl font-bold text-slate-800">{pjs.length}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-400 mb-1">Apartamentos modelados</div>
          <div className="text-xl font-bold text-slate-800">{f0(totalAptos)}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-400 mb-1">Referenciales de obra</div>
          <div className="text-xl font-bold text-slate-800">{refsCount}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-400 mb-1">Último proyecto</div>
          <div className="text-sm font-semibold text-slate-800 truncate">{lastProj?.nombre||lastProj?.ubicacion||"—"}</div>
        </div>
      </div>

      {/* Module grid */}
      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Módulos</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <ModuleCard icon={ic.chart} title="Prefactibilidad" desc="Modelo financiero de desarrollo inmobiliario. TIR, MOIC, P&L, flujos." count={pjs.length} label="proyectos" tab="platform" color="bg-emerald-500"/>
        <ModuleCard icon={ic.map} title="Mapa Estratégico" desc="Análisis geoespacial, POT, medición de terrenos y zonas urbanísticas." count={pjs.filter(p=>p.inputs?.lat&&p.inputs?.lng).length} label="ubicaciones" tab="map" color="bg-indigo-500"/>
        <ModuleCard icon={ic.land} title="Referenciales de obra" desc="Benchmarks de costos de construcción, equipo y gastos técnicos." count={refsCount} label="proyectos" tab="refs" color="bg-amber-500"/>
        <ModuleCard icon={ic.dollar} title="Capital Research" desc="Investigación de industrias y mercados. Scoring de sectores, historial y Market Intel." tab="research" color="bg-teal-500"/>
      </div>

      {/* Upcoming modules */}
      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Próximamente</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {[
          {title:"Avalúos y valores",desc:"Valores de tierra por zona, historial de avalúos, tendencias.",color:"bg-orange-500"},
        ].map((m,i)=>(
          <div key={i} className="bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-5 opacity-60">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${m.color} mb-3 opacity-50`}>
              <Ic d={ic.chart} s={18} className="text-white"/>
            </div>
            <div className="text-sm font-semibold text-slate-500 mb-1">{m.title}</div>
            <div className="text-xs text-slate-400">{m.desc}</div>
            <div className="mt-3 text-[10px] text-slate-300 font-medium uppercase tracking-wider">En desarrollo</div>
          </div>
        ))}
      </div>

      {/* Export / Import */}
      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Datos</div>
      <div className="flex flex-wrap gap-3">
        <button onClick={()=>{
          const data={version:"intus-v2",exportDate:new Date().toISOString(),projects:pjs};
          const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
          const url=URL.createObjectURL(blob);const a=document.createElement("a");
          a.href=url;a.download=`intus_backup_${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(url);
        }} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:border-emerald-300 hover:text-emerald-600 transition-all">
          <Ic d="M12 10v6m0 0l-3-3m3 3l3-3M3 17v3a2 2 0 002 2h14a2 2 0 002-2v-3" s={16}/>
          Exportar datos (JSON)
        </button>
        <label className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:border-emerald-300 hover:text-emerald-600 transition-all cursor-pointer">
          <Ic d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" s={16}/>
          Importar datos
          <input type="file" accept=".json" className="hidden" onChange={e=>{
            const file=e.target.files[0];if(!file)return;
            const reader=new FileReader();
            reader.onload=ev=>{try{
              const d=JSON.parse(ev.target.result);
              if(d.projects&&Array.isArray(d.projects)){
                if(confirm(`Se encontraron ${d.projects.length} proyectos. ¿Importar y reemplazar datos actuales?`)){
                  onNav("_import",d.projects);
                }
              }else{alert("Archivo no válido");}
            }catch{alert("Error al leer archivo");}};
            reader.readAsText(file);e.target.value="";
          }}/>
        </label>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════
// ROOT APP — INTUS PLATFORM v2
// ══════════════════════════════════════════

export {HubView};
