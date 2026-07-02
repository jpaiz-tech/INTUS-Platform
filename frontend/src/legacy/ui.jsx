import {useState,useEffect,useCallback,useMemo,useRef} from 'react';
import {f0,f1,f2,fp,fd,ZG,ZONES,POT_COLORS,calc,D} from './core.js';
const IntusLogo=({size=32})=>(
  <svg width={size*4.2} height={size} viewBox="0 0 210 50" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g transform="translate(25,25)">
      {[...Array(12)].map((_,i)=>{const a=i*30*Math.PI/180;return (
        <line key={i} x1={Math.cos(a)*7} y1={Math.sin(a)*7} x2={Math.cos(a)*18} y2={Math.sin(a)*18} stroke="#34D399" strokeWidth="3.2" strokeLinecap="round"/>
      );})}
      <circle cx="0" cy="0" r="5" fill="#111827"/><circle cx="0" cy="0" r="3.5" fill="#34D399"/>
    </g>
    <text x="52" y="34" fontFamily="'DM Sans',sans-serif" fontWeight="700" fontSize="28" letterSpacing="3" fill="#1E293B">INTUS</text>
  </svg>
);

// ══════════════════════════════════════════
// CONSTRUCTION DISTRIBUTION
// ══════════════════════════════════════════
const Ic=({d,s=16,c=""})=>(
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={c}><path d={d}/></svg>
);
const ic={terrain:"M3 17l4-4 4 4 4-8 6 8M2 20h20",bldg:"M3 21h18M9 8h1M9 12h1M9 16h1M14 8h1M14 12h1M14 16h1M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16",clock:"M12 2a10 10 0 100 20 10 10 0 000-20zM12 6v6l4 2",hammer:"M15 12l-8.5 8.5a2.12 2.12 0 01-3-3L12 9M17.64 15L22 10.64",dollar:"M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6",chart:"M18 20V10M12 20V4M6 20v-6",save:"M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2zM17 21v-8H7v8M7 3v5h8",plus:"M12 5v14M5 12h14",list:"M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",chevL:"M15 18l-6-6 6-6",chevR:"M9 18l6-6-6-6",trash:"M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2",ruler:"M21 3L3 21M3 3l7.07 7.07",land:"M1 22h22M6 18v-3M10 18V9M14 18v-6M18 18V7",chevD:"M6 9l6 6 6-6",map:"M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4zM8 2v16M16 6v16",pin:"M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0zM12 13a3 3 0 100-6 3 3 0 000 6z"};

// ══════════════════════════════════════════
// UI COMPONENTS
// ══════════════════════════════════════════
const fmtNum=v=>{const n=parseFloat(v);return isNaN(n)?'':Math.abs(n)>=1000?n.toLocaleString('en-US',{maximumFractionDigits:4}):String(v);};
const parseNum=s=>parseFloat(String(s).replace(/,/g,''))||0;
const In=({l,v,o,sfx,pfx,opts,step,wide,ph})=>{
  const [editing,setEditing]=useState(false);
  const [raw,setRaw]=useState('');
  const displayV=(!editing&&typeof v==='number'&&Math.abs(v)>=1000)?fmtNum(v):v;
  return(
  <div className="group flex items-center justify-between gap-2 py-2 px-3 rounded-lg hover:bg-emerald-50/40 transition-colors">
    <span className="text-xs text-slate-600 leading-tight min-w-0">{l}</span>
    <div className="flex items-center gap-1 shrink-0">
      {pfx&&<span className="text-[10px] font-medium text-slate-400">{pfx}</span>}
      {opts
        ? <select value={v} onChange={e=>o(e.target.value)} className={`${wide?"w-36":"w-20"} px-2 py-1.5 text-xs font-semibold text-emerald-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400/40 cursor-pointer`}>{opts.map(x=><option key={x} value={x}>{x}</option>)}</select>
        : <input type={editing?"number":"text"} value={editing?raw:displayV} step={step||"any"} placeholder={ph}
            onFocus={()=>{setEditing(true);setRaw(v);}}
            onBlur={()=>{setEditing(false);}}
            onChange={e=>{const val=e.target.value;setRaw(val);o(parseFloat(val)||0);}}
            className={`${wide?"w-32":"w-20"} px-2 py-1.5 text-xs font-semibold text-emerald-800 bg-white border border-slate-200 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-emerald-400/40`}/>
      }
      {sfx&&<span className="text-[10px] font-medium text-slate-400 w-6 text-left">{sfx}</span>}
    </div>
  </div>
);};

const R=({l,v,b,bd,a})=>(
  <div className={`flex justify-between items-center py-1.5 px-3 ${bd?"border-t border-slate-200 mt-2 pt-2.5":""} ${b?"font-semibold":""}`}>
    <span className={`text-sm ${b?(a?"text-emerald-700":"text-slate-800"):"text-slate-500"}`}>{l}</span>
    <span className={`text-sm font-mono tabular-nums ${b?(a?"text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md":"text-slate-800"):"text-slate-600"}`}>{v}</span>
  </div>
);

const Card=({t,icon,ch,cls=""})=>(
  <div className={`bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden ${cls}`}>
    {t&&<div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2.5">
      {icon&&<div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center"><Ic d={icon} s={14} c="text-emerald-600"/></div>}
      <h3 className="text-sm font-bold text-slate-800 tracking-wide uppercase">{t}</h3>
    </div>}
    <div className="px-1 py-2">{ch}</div>
  </div>
);

const Sub=({t})=>(<div className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-3 mb-1 mx-3 pb-1 border-b border-slate-100">{t}</div>);

const MC=({l,v,st,sub})=>{
  const bg=st==="good"?"bg-emerald-50 border-emerald-200/80":st==="warn"?"bg-amber-50 border-amber-200/80":st==="bad"?"bg-red-50 border-red-200/80":"bg-white border-slate-200";
  const txt=st==="good"?"text-emerald-700":st==="warn"?"text-amber-700":st==="bad"?"text-red-600":"text-slate-800";
  return (
    <div className={`p-3.5 rounded-xl border-2 ${bg}`}>
      <div className="text-[11px] font-medium text-slate-500 mb-0.5">{l}</div>
      <div className={`text-xl font-bold font-mono tabular-nums ${txt}`}>{v}</div>
      {sub&&<div className="text-[10px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
};

const PL=({l,amt,vtas,b,bd,a})=>{
  const pct=vtas>0?Math.abs(amt)/vtas:0;
  const dv=amt<0?fd(Math.abs(amt)):fd(amt);
  return (
    <div className={`grid grid-cols-12 items-center py-1.5 px-3 ${bd?"border-t border-slate-200 mt-2 pt-2.5":""} ${b?"font-semibold":""}`}>
      <span className={`col-span-5 text-sm ${b?(a?"text-emerald-700":"text-slate-800"):"text-slate-500"}`}>{l}</span>
      <span className={`col-span-4 text-sm font-mono tabular-nums text-right ${b?(a?"text-emerald-700":"text-slate-800"):"text-slate-600"}`}>{dv}</span>
      <span className={`col-span-3 text-xs font-mono tabular-nums text-right ${b?(a?"text-emerald-600":"text-slate-500"):"text-slate-400"}`}>{fp(pct)}</span>
    </div>
  );
};

const Toggle=({l,ck,oc,cost,occ})=>(
  <div className={`flex items-center gap-2 py-2 px-3 rounded-lg transition-all ${ck?"bg-emerald-50/50":"opacity-50"}`}>
    <button onClick={()=>oc(!ck)} className={`w-9 h-5 rounded-full relative flex-shrink-0 ${ck?"bg-emerald-500":"bg-slate-300"}`}>
      <div className={`w-4 h-4 rounded-full bg-white shadow absolute top-0.5 transition-all ${ck?"left-[18px]":"left-0.5"}`}/>
    </button>
    <span className={`text-sm flex-1 min-w-0 truncate ${ck?"text-slate-700":"text-slate-400"}`}>{l}</span>
    <span className="text-[10px] text-slate-400 flex-shrink-0">$/m²</span>
    <input type="number" value={cost} step="0.01" onChange={e=>occ(parseFloat(e.target.value)||0)} className={`w-20 px-2 py-1 text-sm font-semibold text-right rounded-lg border flex-shrink-0 ${ck?"text-emerald-800 bg-white border-slate-200":"text-slate-300 bg-slate-50 border-slate-100"} focus:outline-none`}/>
  </div>
);

// ══════════════════════════════════════════
// TERRAIN TABLE
// ══════════════════════════════════════════
const TerrainTable=({terrenos,onChange,timbresIusi,onTimbresChange,terrAport,onTerrAportChange,tipoPart,onTipoPartChange,computedTimbres,computedCTerr,vProy})=>{
  const [expanded,setExpanded]=useState(null);
  const updateTerr=(id,key,val)=>onChange(terrenos.map(t=>t.id===id?{...t,[key]:val}:t));
  const updatePago=(tId,pIdx,key,val)=>onChange(terrenos.map(t=>t.id===tId?{...t,pagos:t.pagos.map((p,j)=>j===pIdx?{...p,[key]:val}:p)}:t));
  const addPago=tId=>onChange(terrenos.map(t=>t.id===tId?{...t,pagos:[...(t.pagos||[]),{mes:1,pct:0}]}:t));
  const delPago=(tId,pIdx)=>onChange(terrenos.map(t=>t.id===tId?{...t,pagos:t.pagos.filter((_,j)=>j!==pIdx)}:t));
  const totalCosto=terrenos.reduce((s,t)=>s+t.areaM2*1.43115*(t.precioVara||0),0);
  const totalArea=terrenos.reduce((s,t)=>s+t.areaM2,0);

  return (
    <div className="space-y-4">
      <Card t="Compra de Terrenos" icon={ic.land} ch={<>
        <div className="px-3">
          <div className="grid grid-cols-12 gap-2 py-2 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            <div className="col-span-3">Terreno</div><div className="col-span-2 text-right">Área m²</div><div className="col-span-1 text-center">POT</div><div className="col-span-2 text-right">$/vara²</div><div className="col-span-2 text-right">Costo total</div><div className="col-span-2"></div>
          </div>
          {terrenos.map(t=>{
            const v2=t.areaM2*1.43115,costo=v2*(t.precioVara||0),isOpen=expanded===t.id;
            const pagoSum=(t.pagos||[]).reduce((s,p)=>s+p.pct,0);
            return (
              <div key={t.id} className="border-b border-slate-100 last:border-0">
                <div className="grid grid-cols-12 gap-2 py-2.5 items-center">
                  <div className="col-span-3 text-sm font-medium text-slate-700 px-0.5">{t.nombre||'Sin nombre'}<div className="text-[10px] text-slate-400 font-mono">{f0(v2)} v²</div></div>
                  <div className="col-span-2 text-right text-sm font-mono text-slate-500">{f0(t.areaM2)}</div>
                  <div className="col-span-1 text-center text-xs font-bold font-mono text-emerald-600">{t.potZone||t.pot||'—'}</div>
                  <div className="col-span-2"><input type="number" value={t.precioVara||''} placeholder="$/v²" onChange={e=>updateTerr(t.id,"precioVara",parseFloat(e.target.value)||0)} className="w-full text-sm font-semibold text-emerald-800 bg-white border border-slate-200 rounded-lg text-right px-2 py-1 focus:ring-2 focus:ring-emerald-400/40 focus:outline-none" step="any"/></div>
                  <div className="col-span-2 text-right text-xs font-mono text-slate-600">{costo>0?fd(costo):'-'}</div>
                  <div className="col-span-2 flex items-center justify-end gap-1">
                    <button onClick={()=>setExpanded(isOpen?null:t.id)} className={`px-2 py-1 rounded text-xs font-semibold ${isOpen?"bg-emerald-100 text-emerald-700":"text-slate-400 hover:text-slate-600 hover:bg-slate-100"}`}>{isOpen?'Cerrar':'Pagos'}</button>
                  </div>
                </div>
                {isOpen&&<div className="ml-4 mr-2 mb-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Forma de Pago</span>
                    {Math.abs(pagoSum-100)>0.1?<span className="text-[10px] text-red-500 font-medium">Suma: {pagoSum}%</span>:<span className="text-[10px] text-emerald-600 font-medium">Total: 100%</span>}
                  </div>
                  {(t.pagos||[]).map((p,pi)=>(
                    <div key={pi} className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs text-slate-400 w-10">Mes</span>
                      <input type="number" value={p.mes} min="1" onChange={e=>updatePago(t.id,pi,"mes",parseInt(e.target.value)||1)} className="w-16 px-2 py-1 text-sm font-semibold text-center bg-white border border-slate-200 rounded-lg focus:outline-none"/>
                      <span className="text-xs text-slate-400 w-8">Pago</span>
                      <input type="number" value={p.pct} step="0.1" onChange={e=>updatePago(t.id,pi,"pct",parseFloat(e.target.value)||0)} className="w-20 px-2 py-1 text-sm font-semibold text-right bg-white border border-slate-200 rounded-lg focus:outline-none"/>
                      <span className="text-xs text-slate-400">%</span>
                      <span className="text-xs font-mono text-slate-400 flex-1 text-right">{fd(costo*(p.pct/100))}</span>
                      {(t.pagos||[]).length>1&&<button onClick={()=>delPago(t.id,pi)} className="text-slate-300 hover:text-red-500"><Ic d={ic.trash} s={12}/></button>}
                    </div>
                  ))}
                  {(!t.pagos||t.pagos.length===0)&&<div className="text-xs text-slate-400 text-center py-2">Sin pagos programados. Se asume 100% en mes 1.</div>}
                  <button onClick={()=>addPago(t.id)} className="mt-2 flex items-center gap-1 text-xs text-emerald-600 font-semibold hover:text-emerald-700"><Ic d={ic.plus} s={12}/>Agregar pago</button>
                </div>}
              </div>
            );
          })}
          <div className="mt-2 pt-3 border-t-2 border-slate-200 space-y-1">
            <R l="Área total terrenos" v={`${f0(totalArea)} m² / ${f0(totalArea*1.43115)} v²`} b/>
            <R l="Costo terrenos" v={fd(totalCosto)} b a/>
            <R l="% sobre ventas" v={vProy>0?fp(totalCosto/vProy):'—'} b/>
          </div>
        </div>
      </>}/>
      <Card t="Impuestos y Aportación" icon={ic.dollar} ch={<>
        <In l="Timbres e IUSI" v={timbresIusi} o={onTimbresChange} sfx="%" step="0.1"/>
        <div className="px-3 py-1 text-[11px] text-slate-400">Se aplica sobre ventas sin impuestos</div>
        <In l="¿Terreno aportado?" v={terrAport} o={onTerrAportChange} opts={["Si","No"]}/>
        <In l="Tipo participación" v={tipoPart} o={onTipoPartChange} opts={["% de equity","Pagado + caro al final"]} wide/>
        <R l="Timbres/IUSI" v={fd(computedTimbres)}/>
        <R l="Costo total terreno" v={fd(computedCTerr)} b a bd/>
      </>}/>
    </div>
  );
};

// ══════════════════════════════════════════
// LEAFLET MAP COMPONENT
// ══════════════════════════════════════════

export {IntusLogo,Ic,ic,fmtNum,parseNum,In,R,Card,Sub,MC,PL,Toggle,TerrainTable};
