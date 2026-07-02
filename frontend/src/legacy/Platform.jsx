import {useState,useEffect,useCallback,useMemo,useRef} from 'react';
import {CD,gCD,calc,D,SK,f0,f1,f2,fp,fd,ZG,ZONES,POT_COLORS,INCS,calcIncPE,calcIE,getHighestZone} from './core.js';
import {IntusLogo,Ic,ic,fmtNum,parseNum,In,R,Card,Sub,MC,PL,Toggle,TerrainTable} from './ui.jsx';
const Platform=({pjs,setPjs,sv,initialProject,onClearInitial})=>{
  const [cid,setCid]=useState(null);
  const [inp,setInp]=useState({...D});
  const [vw,setVw]=useState("input");
  const [st,setSt]=useState(0);

  useEffect(()=>{
    if(initialProject){
      setInp({...D,...initialProject.inputs});
      setCid(initialProject.id);
      setVw("input");
      setSt(0);
      onClearInitial();
    }
  },[initialProject]);

  const res=useMemo(()=>{try{return calc(inp);}catch(e){console.error(e);return null;}},[inp]);
  const u=(k,v)=>setInp(p=>({...p,[k]:v}));
  const saveP=async()=>{const p={id:cid||Date.now(),inputs:{...inp},at:new Date().toISOString()};sv(cid?pjs.map(x=>x.id===cid?p:x):[...pjs,p]);setCid(p.id);};
  const loadP=p=>{setInp({...D,...p.inputs});setCid(p.id);setVw("input");setSt(0);};
  const newP=()=>{setInp({...D});setCid(null);setVw("input");setSt(0);};
  const delP=id=>{sv(pjs.filter(p=>p.id!==id));if(cid===id)newP();};

  // Compute effective zone and IE from terrains + incentives
  const effZone=getHighestZone(inp.terrenos);
  const peResult=calcIncPE(effZone,inp.incState||{O4:true},inp.incValues||{});
  const ieResult=calcIE(effZone,peResult.pe);
  // IE Aumentado calculation
  const zData=ZG[effZone]||{};
  const iauActive=!!(inp.iauActive)&&!!zData.iau;
  const iauP1=+(inp.iauP1)||0;
  const iauVC=+(inp.iauVC)||0;
  const iauIE=iauActive&&iauP1>0?Math.min(iauP1,zData.iau||99):0;
  const iauAP=iauActive&&iauP1>ieResult.ie&&iauVC>0&&zData.ib>0?iauVC*((iauP1-ieResult.ie)/zData.ib)*0.5:0;
  // Effective IE: if useIECalc, use calculated IE (or IAU if active)
  const effectiveIE=inp.useIECalc?(iauActive&&iauIE>0?iauIE:ieResult.ie):inp.edificabilidad;
  useEffect(()=>{if(inp.useIECalc){u("edificabilidad",effectiveIE);}},[effectiveIE,inp.useIECalc]);
  // Mix de producto
  const mixMdls=inp.mixModels||[];
  const rentableArea=res?.aApt||0;
  // Calculate units: use manual override if set, otherwise floor(assigned/m2)
  const mixCalc=mixMdls.map(m=>{
    const m2=+m.m2||0,pctR=+m.pctRent||0,pk=+m.pk||0;
    const m2Assigned=rentableArea*(pctR/100);
    const autoUnits=m2>0?Math.floor(m2Assigned/m2):0;
    const units=(m.manualUn!=null&&m.manualUn!=='')?+m.manualUn:autoUnits;
    const m2Used=units*m2;
    return{...m,m2Assigned,autoUnits,units,m2Used,pk};
  });
  const mixTotalUn=mixCalc.reduce((s,m)=>s+m.units,0);
  const mixTotalPctR=mixCalc.reduce((s,m)=>s+(+m.pctRent||0),0);
  const mixTotalM2=mixCalc.reduce((s,m)=>s+m.m2Assigned,0);
  const mixTotalM2Used=mixCalc.reduce((s,m)=>s+m.m2Used,0);
  const mixDeficit=rentableArea-mixTotalM2Used;
  const mixAdjPctVend=res?.aE>0?(mixTotalM2Used/res.aE*100):0;
  const mixPondM2=mixTotalUn>0?mixCalc.reduce((a,m)=>a+m.units*(+m.m2||0),0)/mixTotalUn:0;
  const mixTotalPk=mixCalc.reduce((s,m)=>s+m.units*(+m.pk||0),0);
  const mixPkPerApt=mixTotalUn>0?mixTotalPk/mixTotalUn:0;
  // CHANGE 2: Auto-feed mix producto → producto (tamApto + parqApto)
  useEffect(()=>{if(mixMdls.length>0&&mixPondM2>0&&mixTotalUn>0){u("tamApto",Math.round(mixPondM2*100)/100);u("parqApto",Math.round(mixPkPerApt*1000)/1000);u("mixNApt",mixTotalUn);u("mixNPk",Math.ceil(mixTotalPk));}else{u("mixNApt",0);u("mixNPk",0);}},[mixPondM2,mixPkPerApt,mixTotalUn,mixTotalPk,mixMdls.length]);
  // CHANGE 3: Permeability from incentive O5
  const permFromInc=!!(inp.incState||{}).O5&&((inp.incValues||{}).O5p||0)>0;
  const permPct=permFromInc?((inp.incValues||{}).O5p||0):0;
  useEffect(()=>{u("perm",permFromInc?"Si":"No");},[permFromInc]);
  // Auto-feed IAU cost into inputs for calc engine (licencias)
  useEffect(()=>{u("iauCost",iauActive?iauAP:0);},[iauAP,iauActive]);

  const steps=[
    {name:"Terreno",short:"Terreno",icon:ic.terrain},
    {name:"Edificabilidad",short:"Edific.",icon:ic.ruler},
    {name:"Compra Terreno",short:"Compra",icon:ic.land},
    {name:"Producto",short:"Producto",icon:ic.bldg},
    {name:"Ventas",short:"Ventas",icon:ic.dollar},
    {name:"Costos",short:"Costos",icon:ic.hammer},
    {name:"Financiamiento",short:"Capital",icon:ic.dollar},
    {name:"Resultados",short:"Resultado",icon:ic.chart},
    {name:"Cuotas",short:"Cuotas",icon:ic.dollar},
  ];
  const iS=v=>v>0.15?"good":v>0.10?"warn":v!=null?"bad":null;
  const mS=v=>v>1.5?"good":v>1.2?"warn":v!=null?"bad":null;

  return (
    <div>
      {/* Sub header */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-2 flex items-center gap-2">
          <button onClick={()=>setVw(vw==="list"?"input":"list")} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg ${vw==="list"?"bg-slate-800 text-white":"text-slate-500 hover:bg-slate-100"}`}>
            <Ic d={ic.list} s={14}/><span className="hidden sm:inline">Proyectos</span>
            <span className="bg-slate-200 text-slate-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{pjs.length}</span>
          </button>
          <button onClick={newP} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm">
            <Ic d={ic.plus} s={14}/><span className="hidden sm:inline">Nuevo</span>
          </button>
        </div>
      </div>

      {/* PROJECT LIST */}
      {vw==="list"&&(
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Proyectos guardados</h2>
          {pjs.length===0
            ? <div className="text-center py-16 bg-white rounded-2xl border border-slate-200"><div className="text-4xl mb-3 opacity-30">📋</div><div className="text-sm text-slate-400 mb-3">Sin proyectos</div><button onClick={newP} className="px-4 py-2 bg-emerald-500 text-white font-semibold rounded-lg text-sm">Crear análisis</button></div>
            : <div className="space-y-2">{pjs.map(p=>{
                const r=(()=>{try{return calc({...D,...p.inputs});}catch{return null;}})();
                return (
                  <div key={p.id} className="bg-white rounded-xl border border-slate-200 px-5 py-4 flex items-center justify-between hover:shadow-md cursor-pointer group" onClick={()=>loadP(p)}>
                    <div className="flex-1">
                      <div className="text-base font-semibold text-slate-800 group-hover:text-emerald-700">{p.inputs.nombre||"Sin nombre"}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{p.inputs.ubicacion||""}{p.inputs.equipo?' · '+p.inputs.equipo:''} · {new Date(p.at).toLocaleDateString()}</div>
                      {r&&<div className="flex gap-4 mt-2">
                        <span className="text-xs"><span className="text-slate-400">TIR: </span><span className={`font-mono font-bold ${r.airrBT>0.15?"text-emerald-600":"text-red-500"}`}>{r.airrBT?fp(r.airrBT):"—"}</span></span>
                        <span className="text-xs"><span className="text-slate-400">MOIC: </span><span className="font-mono font-bold">{f2(r.moicBT)}x</span></span>
                      </div>}
                    </div>
                    <button onClick={e=>{e.stopPropagation();delP(p.id);}} className="p-2 text-slate-300 hover:text-red-500 rounded-lg"><Ic d={ic.trash} s={16}/></button>
                  </div>
                );
              })}</div>
          }
        </div>
      )}

      {/* MAIN EDITOR */}
      {vw!=="list"&&(
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
            <div className="flex-1 flex flex-col gap-2 w-full">
              <div className="flex items-center gap-3">
                <input value={inp.nombre} onChange={e=>u("nombre",e.target.value)} placeholder="Nombre del proyecto" className="text-lg font-bold text-slate-800 bg-transparent border-b-2 border-transparent hover:border-slate-200 focus:border-emerald-500 outline-none py-1 flex-1"/>
                <input value={inp.ubicacion} onChange={e=>u("ubicacion",e.target.value)} placeholder="Ubicación" className="text-sm text-slate-500 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-emerald-500 outline-none py-1 w-36"/>
              </div>
              <div className="flex items-center gap-3">
                <select value={inp.equipo||''} onChange={e=>u("equipo",e.target.value)} className="text-xs text-slate-500 bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-emerald-400">
                  <option value="">Equipo evaluador...</option>
                  <option>Intus Capital</option>
                  <option>Intus Inteligencia de Mercado</option>
                  <option>Intus Avalúos</option>
                  <option>Intus Comercialización</option>
                  <option>Intus Desarrollo</option>
                </select>
                <input value={inp.desarrollador||''} onChange={e=>u("desarrollador",e.target.value)} placeholder="Desarrollador / cliente" className="text-xs text-slate-500 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-emerald-400 outline-none py-1 flex-1"/>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="number" value={inp.lat} onChange={e=>u("lat",parseFloat(e.target.value)||0)} placeholder="Lat" className="w-24 px-2 py-1.5 text-xs text-slate-500 border border-slate-200 rounded-lg focus:outline-none" step="0.0001"/>
              <input type="number" value={inp.lng} onChange={e=>u("lng",parseFloat(e.target.value)||0)} placeholder="Lng" className="w-24 px-2 py-1.5 text-xs text-slate-500 border border-slate-200 rounded-lg focus:outline-none" step="0.0001"/>
              <button onClick={saveP} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white text-xs font-bold rounded-lg hover:bg-slate-700 shadow-sm"><Ic d={ic.save} s={14}/>Guardar</button>
            </div>
          </div>

          <div className="flex gap-1 mb-4 bg-white rounded-xl p-1 border border-slate-200 overflow-x-auto">
            {steps.map((s,idx)=>(
              <button key={idx} onClick={()=>setSt(idx)} className={`flex-1 flex items-center justify-center gap-1.5 min-w-0 px-1.5 py-2.5 rounded-lg text-xs font-semibold whitespace-nowrap ${st===idx?"bg-emerald-500 text-white shadow-sm":"text-slate-400 hover:bg-slate-50"}`}>
                <Ic d={s.icon} s={13}/><span className="hidden md:inline">{s.name}</span><span className="md:hidden">{s.short}</span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-8 space-y-4">
              {/* STEP 0 */}
              {st===0&&<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card t="Terrenos del proyecto" icon={ic.terrain} ch={<>
                  <div className="px-3 mb-2">
                    <div className="grid grid-cols-12 gap-1 text-[9px] font-bold text-slate-400 uppercase mb-1"><span className="col-span-1">#</span><span className="col-span-3">Nombre</span><span className="col-span-2 text-center">Área m²</span><span className="col-span-2 text-center">Área v²</span><span className="col-span-2 text-center">POT</span><span className="col-span-2"></span></div>
                    {(inp.terrenos||[]).map((t,i)=>{
                      const av2=(t.areaM2||0)*1.43115;
                      return(<div key={t.id||i} className="grid grid-cols-12 gap-1 items-center mb-1">
                        <span className="col-span-1 text-xs font-mono text-slate-400">{i+1}</span>
                        <input className="col-span-3 px-2 py-1 border border-slate-200 rounded text-xs font-semibold" value={t.nombre||''} onChange={e=>{const ts=[...(inp.terrenos||[])];ts[i]={...ts[i],nombre:e.target.value};u("terrenos",ts);}}/>
                        <input type="number" className="col-span-2 px-1 py-1 border border-slate-200 rounded text-xs text-center" value={t.areaM2||''} placeholder="m²" onChange={e=>{const ts=[...(inp.terrenos||[])];ts[i]={...ts[i],areaM2:+e.target.value||0};u("terrenos",ts);}}/>
                        <span className="col-span-2 text-center text-xs font-mono text-slate-400">{av2>0?f0(av2):''}</span>
                        <select className="col-span-2 px-1 py-1 border border-slate-200 rounded text-xs text-center font-mono font-bold" value={t.potZone||'G4'} onChange={e=>{const ts=[...(inp.terrenos||[])];ts[i]={...ts[i],potZone:e.target.value,pot:e.target.value};u("terrenos",ts);}}>
                          {ZONES.map(z=><option key={z} value={z}>{z}</option>)}
                        </select>
                        <div className="col-span-2 flex justify-end">{(inp.terrenos||[]).length>1&&<button onClick={()=>{const ts=(inp.terrenos||[]).filter((_,j)=>j!==i);u("terrenos",ts);}} className="px-2 py-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded text-xs" title="Eliminar terreno">×</button>}</div>
                      </div>);
                    })}
                    <button onClick={()=>{const ts=[...(inp.terrenos||[])];ts.push({id:Date.now(),nombre:'Terreno '+(ts.length+1),areaM2:0,pot:'G4',potZone:effZone,precioVara:0,pagos:[]});u("terrenos",ts);}} className="w-full py-1.5 border-2 border-dashed border-slate-200 rounded-lg text-xs font-semibold text-slate-400 hover:border-emerald-300 hover:text-emerald-500 mt-2">+ Agregar terreno</button>
                  </div>
                  <div className="px-3 py-2 bg-slate-50 rounded-lg mx-3"><div className="flex justify-between text-xs"><span className="text-slate-500">Área total</span><span className="font-bold">{f0(res?.aTerrTotal)} m² / {f0((res?.aTerrTotal||0)*1.43115)} v²</span></div>
                  <div className="flex justify-between text-xs mt-1"><span className="text-slate-500">Zona POT efectiva (más alta)</span><span className="font-bold text-emerald-600 font-mono">{effZone} — {ZG[effZone]?.n}</span></div></div>
                  <Sub t="Parámetros de zona"/>
                  <div className="px-3 py-2 bg-emerald-50 rounded-lg mx-3"><div className="grid grid-cols-3 gap-2 text-[10px]"><div><span className="text-slate-400">IE Base</span><div className="font-bold">{zData.ib}</div></div><div><span className="text-emerald-600">IE Ampliado</span><div className="font-bold text-emerald-600">{zData.ia}</div></div><div><span className="text-amber-600">IE Aumentado</span><div className="font-bold text-amber-600">{zData.iau||'N/A'}</div></div></div><div className="grid grid-cols-3 gap-2 text-[10px] mt-2"><div><span className="text-slate-400">Altura base</span><div className="font-bold">{zData.hb}m</div></div><div><span className="text-slate-400">Altura amp.</span><div className="font-bold">{zData.ha}m</div></div><div><span className="text-slate-400">Altura aum.</span><div className="font-bold">{zData.hau?zData.hau+'m':'N/A'}</div></div></div></div>
                </>}/>
                <Card t="Dimensiones y Edificabilidad" icon={ic.ruler} ch={<><In l="Frente" v={inp.frente} o={v=>u("frente",v)} sfx="m"/><In l="Fondo" v={inp.fondo} o={v=>u("fondo",v)} sfx="m"/><R l="Área terreno (frente × fondo)" v={`${f0(res?.aT)} m²`} b a/><Sub t="Índice de edificabilidad"/><div className="px-3 mb-2"><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={inp.useIECalc||false} onChange={e=>u("useIECalc",e.target.checked)} className="accent-emerald-500"/><span className="text-xs text-slate-500">Calcular IE desde incentivos (pestaña Edificabilidad)</span></label></div>{!(inp.useIECalc)&&<In l="Índice manual" v={inp.edificabilidad} o={v=>u("edificabilidad",v)}/>}{inp.useIECalc&&<R l={iauActive?"IE Aumentado":"IE Ampliado"} v={`${f2(effectiveIE)} ${iauActive?'(aumentado)':'('+peResult.pe.toFixed(1)+' PE)'}`} b a/>}<In l="Permeabilidad" v={inp.perm} o={v=>u("perm",v)} opts={["Si","No"]}/>{permFromInc&&<div className="px-3 -mt-1 mb-1"><span className="text-[9px] text-emerald-600">← Incentivo O-5 activo ({permPct}%)</span></div>}<R l="Área edificable" v={`${f0(res?.aE)} m²`} b a/><Sub t="Huella del edificio"/><In l="Huella edificio" v={inp.huellaEdificio} o={v=>u("huellaEdificio",v)} sfx="m²" ph="0=auto"/><R l="Niveles" v={f0(res?.niveles)} b a/><In l="Altura por losa" v={inp.alturaLosa} o={v=>u("alturaLosa",v)} sfx="m" step="0.1"/><R l="Altura total" v={`${f1(res?.alturaTotal)} m`} b a/>{inp.useIECalc&&<R l="Altura máx. permitida" v={`${iauActive&&zData.hau?zData.hau:ieResult.ha} m`} a/>}<Sub t="Huella del sótano"/><In l="Huella sótano" v={inp.huellaSotano} o={v=>u("huellaSotano",v)} sfx="m²" ph="0=auto"/><R l="Sótanos" v={f2(res?.cSot)} b a/></>}/>
                <Card t="Distribución por Uso" icon={ic.bldg} ch={<><Sub t="% del área edificable"/><In l="Comercio" v={inp.pctComercio} o={v=>u("pctComercio",v)} sfx="%" step="0.5"/><In l="Oficinas" v={inp.pctOficinas} o={v=>u("pctOficinas",v)} sfx="%" step="0.5"/><R l="Apartamentos" v={`${f0(res?.pctA)}%`}/><Sub t="% vendible por uso"/><In l="Comercio" v={inp.pctVendCom} o={v=>u("pctVendCom",v)} sfx="%"/><In l="Oficinas" v={inp.pctVendOfi} o={v=>u("pctVendOfi",v)} sfx="%"/><In l="Apartamentos" v={inp.pctVendApt} o={v=>u("pctVendApt",v)} sfx="%"/><Sub t="Áreas resultantes"/><R l="Comercio" v={`${f0(res?.aCom)} m²`}/><R l="Oficinas" v={`${f0(res?.aOfi)} m²`}/><R l="Aptos" v={`${f0(res?.aApt)} m²`}/><R l="Total vendible" v={`${f0(res?.totalVend)} m²`} b a bd/></>}/>
              </div>}
              {/* STEP 1 — EDIFICABILIDAD */}
              {st===1&&<div className="space-y-4">
                <Card t="Índice de Edificabilidad — Incentivos POT" icon={ic.ruler} ch={<>
                  <div className="px-3 py-3 bg-emerald-50 rounded-lg mb-3">
                    <div className="flex items-center justify-between mb-1"><span className="text-2xl font-bold text-emerald-600" style={{fontFamily:"monospace"}}>{peResult.pe.toFixed(1)} <span className="text-xs font-normal text-slate-400">PE</span></span><span className="text-xs text-slate-400">/ 100 máx.</span></div>
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full transition-all" style={{width:Math.min(peResult.pe,100)+'%'}}/></div>
                    {new Date()<new Date('2026-12-19')&&<div className="text-[10px] text-emerald-600 mt-1">+20% bono Art. 74 · Base: {peResult.raw.toFixed(1)} PE</div>}
                    <div className="grid grid-cols-3 gap-3 mt-3">
                      <div className="text-center p-2 bg-white rounded border border-slate-100"><div className="text-[10px] text-slate-400">IE Base</div><div className="text-sm font-bold">{ZG[effZone]?.ib}</div></div>
                      <div className="text-center p-2 bg-white rounded border border-emerald-200"><div className="text-[10px] text-emerald-600">IE Ampliado</div><div className="text-sm font-bold text-emerald-600">{ieResult.ie}</div></div>
                      <div className="text-center p-2 bg-white rounded border border-slate-100"><div className="text-[10px] text-slate-400">IE Aumentado</div><div className="text-sm font-bold text-amber-600">{ZG[effZone]?.iau||'N/A'}</div></div>
                    </div>
                  </div>
                  <Sub t="Prácticas incentivables — COM-48-2024"/>
                  {INCS.map(inc=>{
                    const isOn=!!(inp.incState||{})[inc.c];
                    const togInc=()=>{const ns={...(inp.incState||{O4:true})};ns[inc.c]=!ns[inc.c];u("incState",ns);};
                    const updVal=(k,v)=>{const nv={...(inp.incValues||{})};nv[k]=parseFloat(v)||0;u("incValues",nv);};
                    const pts=isOn?calcIncPE(effZone,{[inc.c]:true},inp.incValues||{}).raw:0;
                    return(<div key={inc.c} className={`border rounded-lg mb-1.5 overflow-hidden transition-all ${isOn?'border-emerald-200 bg-emerald-50':'border-slate-100'}`}>
                      <div className="flex items-center gap-2 px-3 py-2 cursor-pointer" onClick={inc.auto?undefined:togInc}>
                        <div className={`w-4 h-4 rounded flex items-center justify-center text-white text-[10px] ${isOn?'bg-emerald-500':'border border-slate-300'}`}>{isOn&&'✓'}</div>
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded" style={{fontFamily:'monospace'}}>{inc.cd}</span>
                        <span className="flex-1 text-xs font-medium text-slate-700">{inc.n}</span>
                        <span className={`text-xs font-bold ${isOn?'text-emerald-600':'text-slate-300'}`} style={{fontFamily:'monospace'}}>{pts.toFixed(1)} PE</span>
                      </div>
                      {isOn&&inc.fields&&<div className="px-3 pb-2 grid grid-cols-2 gap-2">
                        {inc.fields.map(f=>f.t==='select'?
                          <div key={f.id} className="text-xs"><label className="text-[10px] text-slate-500 block mb-0.5">{f.l}</label><select value={(inp.incValues||{})[f.id]||0} onChange={e=>updVal(f.id,e.target.value)} className="w-full px-2 py-1 border border-slate-200 rounded text-xs">{f.opts.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
                          :<div key={f.id} className="text-xs"><label className="text-[10px] text-slate-500 block mb-0.5">{f.l}</label><input type="number" value={(inp.incValues||{})[f.id]||''} onChange={e=>updVal(f.id,e.target.value)} className="w-full px-2 py-1 border border-slate-200 rounded text-xs"/></div>
                        )}
                      </div>}
                      {isOn&&inc.auto&&<div className="px-3 pb-2 text-[10px] text-slate-400 italic">Automático según zona — fijo para {effZone}</div>}
                    </div>);
                  })}
                </>}/>
                {zData.iau&&<Card t="IE Aumentado — Aportación Art. 19" icon={ic.dollar} ch={<>
                  <div className="px-3 mb-2">
                    <label className="flex items-center gap-2 cursor-pointer py-2">
                      <input type="checkbox" checked={iauActive} onChange={e=>u("iauActive",e.target.checked)} className="accent-amber-500 w-4 h-4"/>
                      <span className="text-sm font-semibold text-slate-700">Activar IE Aumentado</span>
                      <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-mono">máx. {zData.iau}</span>
                    </label>
                    <div className="text-[10px] text-slate-400 mb-3">Permite superar el IE Ampliado ({ieResult.ie.toFixed(2)}) hasta el IE Aumentado ({zData.iau}) mediante una aportación económica al municipio.</div>
                  </div>
                  {iauActive&&<>
                    <div className="px-3 py-2 bg-slate-50 rounded-lg mx-3 mb-3 text-[10px] font-mono text-slate-500" style={{lineHeight:'1.8'}}>AP = VC × ((P1 − P2) / P3) × 0.5<br/>P1 = IE solicitado · P2 = IE ampliado actual ({ieResult.ie.toFixed(2)}) · P3 = IE base ({zData.ib}) · FOD = 0.5</div>
                    <div className="px-3"><In l="IE solicitado (P1)" v={inp.iauP1} o={v=>u("iauP1",v)} step="0.1"/></div>
                    <div className="px-3"><In l="Valor comercial del terreno ($)" v={inp.iauVC} o={v=>u("iauVC",v)}/></div>
                    <div className="px-3 py-2 bg-amber-50 rounded-lg mx-3 mt-2">
                      <div className="flex justify-between text-xs mb-1"><span className="text-slate-500">IE Ampliado actual (P2)</span><span className="font-mono font-bold">{ieResult.ie.toFixed(2)}</span></div>
                      <div className="flex justify-between text-xs mb-1"><span className="text-slate-500">IE Base zona (P3)</span><span className="font-mono font-bold">{zData.ib}</span></div>
                      <div className="flex justify-between text-xs mb-1"><span className="text-slate-500">IE Aumentado máx.</span><span className="font-mono font-bold text-amber-600">{zData.iau}</span></div>
                      <div className="flex justify-between text-xs mb-1"><span className="text-slate-500">IE que se usará</span><span className="font-mono font-bold text-amber-700">{iauIE>0?iauIE.toFixed(2):'—'}</span></div>
                      <div className="flex justify-between text-xs pt-2 border-t border-amber-200"><span className="font-semibold text-slate-700">Aportación a pagar (AP)</span><span className="font-mono font-bold text-amber-700 text-base">{iauAP>0?fd(iauAP):'—'}</span></div>
                    </div>
                  </>}
                  {!iauActive&&<div className="px-3 py-4 text-center text-xs text-slate-400">Activa esta opción para calcular la aportación y usar un IE superior al ampliado.</div>}
                </>}/>}
              </div>}
              {/* STEP 2 — Compra Terreno */}
              {st===2&&<TerrainTable terrenos={inp.terrenos||[]} onChange={v=>u("terrenos",v)} timbresIusi={inp.timbresIusi} onTimbresChange={v=>u("timbresIusi",v)} terrAport={inp.terrAport} onTerrAportChange={v=>u("terrAport",v)} tipoPart={inp.tipoPart} onTipoPartChange={v=>u("tipoPart",v)} computedTimbres={res?.timbresIusi} computedCTerr={res?.cTerr} vProy={res?.vProy||0}/>}
              {/* STEP 3 — Producto */}
              {st===3&&<div className="space-y-4">
                <Card t="Tiempos del Proyecto" icon={ic.clock} ch={<><In l="Planificación" v={inp.planif} o={v=>u("planif",v)} sfx="m"/><In l="Construcción" v={inp.const} o={v=>u("const",v)} sfx="m"/><In l="Post construcción" v={inp.postConst} o={v=>u("postConst",v)} sfx="m"/><R l="Duración total" v={`${res?.dur} meses`} b a/></>}/>
                <Card t="Mix de Apartamentos" icon={ic.bldg} ch={<>
                  <div className="px-3 py-2 bg-slate-50 rounded-lg mb-3">
                    <div className="grid grid-cols-4 gap-3">
                      <div><div className="text-[10px] text-slate-400">Área edificable</div><div className="text-sm font-bold">{f0(res?.aE)} m²</div></div>
                      <div><div className="text-[10px] text-slate-400">% Aptos</div><div className="text-sm font-bold">{f0(res?.pctA)}%</div></div>
                      <div><div className="text-[10px] text-slate-400">% Vendible</div><div className="text-sm font-bold">{inp.pctVendApt}%</div></div>
                      <div><div className="text-[10px] text-emerald-600 font-semibold">Área Aptos</div><div className="text-sm font-bold text-emerald-700">{f0(rentableArea)} m²</div></div>
                    </div>
                    <div className="text-[9px] text-slate-400 mt-1">← Calculado desde Distribución por Uso (pestaña Terreno)</div>
                  </div>
                  <Sub t="Modelos de apartamentos"/>
                  <div className="px-3 mb-2">
                    <div className="grid grid-cols-12 gap-1 text-[8px] font-bold text-slate-400 uppercase mb-1 px-1"><span className="col-span-2">Modelo</span><span className="col-span-1 text-center">m²/apt</span><span className="col-span-1 text-center">% Rent</span><span className="col-span-2 text-center">m² asig.</span><span className="col-span-1 text-center">{inp.mixAdjust?'Uds ✎':'Uds'}</span><span className="col-span-1 text-center">m² real</span><span className="col-span-1 text-center">% mix</span><span className="col-span-2 text-center">Pk/apt</span><span className="col-span-1"/></div>
                    {mixCalc.map((mc,i)=>{
                      const pctMix=mixTotalUn>0?(mc.units/mixTotalUn*100):0;
                      const hasOverride=mc.manualUn!=null&&mc.manualUn!=='';
                      return(<div key={mc.id||i}>
                        <div className="grid grid-cols-12 gap-1 items-center mb-1">
                          <input className="col-span-2 px-1 py-1 border border-slate-200 rounded text-[10px] font-semibold" value={mc.name||''} onChange={e=>{const nm=[...mixMdls];nm[i]={...nm[i],name:e.target.value};u('mixModels',nm);}}/>
                          <input type="number" className="col-span-1 px-1 py-1 border border-slate-200 rounded text-[10px] text-center" value={mc.m2||''} placeholder="m²" onChange={e=>{const nm=[...mixMdls];nm[i]={...nm[i],m2:+e.target.value||0};u('mixModels',nm);}}/>
                          <input type="number" className="col-span-1 px-1 py-1 border border-emerald-200 bg-emerald-50 rounded text-[10px] text-center font-semibold text-emerald-700" value={mc.pctRent||''} placeholder="%" step="0.5" onChange={e=>{const nm=[...mixMdls];nm[i]={...nm[i],pctRent:+e.target.value||0};u('mixModels',nm);}}/>
                          <span className="col-span-2 text-center text-[9px] font-mono text-slate-400">{mc.m2Assigned>0?f0(mc.m2Assigned):''}</span>
                          {inp.mixAdjust?<input type="number" className={`col-span-1 px-1 py-1 border rounded text-[10px] text-center font-bold ${hasOverride?'border-amber-300 bg-amber-50 text-amber-700':'border-slate-200 text-emerald-600'}`} value={hasOverride?mc.manualUn:mc.autoUnits} onChange={e=>{const nm=[...mixMdls];nm[i]={...nm[i],manualUn:e.target.value===''?null:+e.target.value};u('mixModels',nm);}}/>:<span className={`col-span-1 text-center text-[10px] font-mono font-bold ${mc.units>0?'text-emerald-600':'text-slate-300'}`}>{mc.units||'—'}</span>}
                          <span className="col-span-1 text-center text-[9px] font-mono text-slate-400">{mc.m2Used>0?f0(mc.m2Used):''}</span>
                          <span className="col-span-1 text-center text-[9px] font-mono text-slate-400">{pctMix>0?pctMix.toFixed(0)+'%':''}</span>
                          <input type="number" className="col-span-2 px-1 py-1 border border-slate-200 rounded text-[10px] text-center" value={mc.pk||''} placeholder="pk" step="0.25" onChange={e=>{const nm=[...mixMdls];nm[i]={...nm[i],pk:+e.target.value||0};u('mixModels',nm);}}/>
                          <button className="col-span-1 text-slate-300 hover:text-red-500 text-center" onClick={()=>{const nm=mixMdls.filter((_,j)=>j!==i);u('mixModels',nm);}}>×</button>
                        </div>
                      </div>);
                    })}
                    <div className="flex gap-2 mt-2">
                      <button onClick={()=>{const nm=[...mixMdls,{id:Date.now(),name:'Modelo '+'ABCDEFGH'[mixMdls.length%8],m2:0,pctRent:0,pk:1}];u('mixModels',nm);}} className="flex-1 py-2 border-2 border-dashed border-slate-200 rounded-lg text-xs font-semibold text-slate-400 hover:border-emerald-300 hover:text-emerald-500">+ Modelo</button>
                      <button onClick={()=>{if(!mixMdls.length)return;const share=Math.round(100/mixMdls.length*10)/10;const nm=mixMdls.map(m=>({...m,pctRent:share}));u('mixModels',nm);}} className="px-3 py-2 border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100">⟳ Auto %</button>
                    </div>
                  </div>
                  {mixMdls.length>0&&<>
                    {/* Summary */}
                    <div className="px-3 py-2 bg-slate-50 rounded-lg mx-3 mt-2">
                      <div className="flex justify-between text-xs mb-1"><span className="text-slate-500">% rentable asignado</span><span className={`font-bold font-mono ${Math.abs(mixTotalPctR-100)<0.5?'text-emerald-600':mixTotalPctR>100?'text-red-500':'text-amber-500'}`}>{mixTotalPctR.toFixed(1)}%{Math.abs(mixTotalPctR-100)<0.5?' ✓':mixTotalPctR>100?' — excede 100%':''}</span></div>
                      <div className="flex justify-between text-xs mb-1"><span className="text-slate-500">m² realmente utilizados</span><span className="font-bold font-mono">{f0(mixTotalM2Used)} / {f0(rentableArea)} m²</span></div>
                      <div className="flex justify-between text-xs mb-1"><span className="text-slate-500">Déficit de área</span><span className={`font-bold font-mono ${Math.abs(mixDeficit)<10?'text-emerald-600':mixDeficit>0?'text-amber-500':'text-red-500'}`}>{Math.abs(mixDeficit)<10?'0 m² ✓':mixDeficit>0?f0(mixDeficit)+' m² sin usar':f0(Math.abs(mixDeficit))+' m² excedido'}</span></div>
                      <div className="flex justify-between text-xs mb-1"><span className="text-slate-500">Unidades totales</span><span className="font-bold text-emerald-600 text-base font-mono">{mixTotalUn||'—'}</span></div>
                      <div className="flex justify-between text-xs"><span className="text-slate-500">Parqueos totales</span><span className="font-bold font-mono">{f0(Math.ceil(mixTotalPk))}</span></div>
                    </div>
                    {/* Adjustment controls */}
                    <div className="px-3 mx-3 mt-2 py-2 bg-white rounded-lg border border-slate-200">
                      <label className="flex items-center gap-2 cursor-pointer mb-2"><input type="checkbox" checked={inp.mixAdjust||false} onChange={e=>u("mixAdjust",e.target.checked)} className="accent-amber-500 w-3.5 h-3.5"/><span className="text-xs text-slate-600">Ajustar unidades manualmente</span></label>
                      {inp.mixAdjust&&<div className="text-[9px] text-amber-600 mb-2 pl-5">Edita las unidades directamente en la columna "Uds". Deja vacío para usar el cálculo automático.</div>}
                      {mixDeficit>10&&<><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={inp.mixUseAdjPct||false} onChange={e=>{u("mixUseAdjPct",e.target.checked);if(e.target.checked)u("pctVendApt",Math.round(mixAdjPctVend*100)/100);}} className="accent-indigo-500 w-3.5 h-3.5"/><span className="text-xs text-slate-600">Usar % vendible ajustado</span><span className="text-[10px] font-mono font-bold text-indigo-600 ml-1">{mixAdjPctVend.toFixed(2)}%</span></label>
                      <div className="text-[9px] text-slate-400 pl-5 mt-1">Ajusta el % vendible de aptos de {inp.pctVendApt}% a {mixAdjPctVend.toFixed(2)}% para reflejar el área realmente utilizada ({f0(mixTotalM2Used)} m²) sobre el área edificable ({f0(res?.aE)} m²).</div></>}
                    </div>
                    {/* Feeding indicator */}
                    <div className="px-3 py-2 bg-emerald-50 rounded-lg mx-3 mt-2 border border-emerald-200">
                      <div className="flex justify-between text-xs mb-1"><span className="text-emerald-700 font-semibold">→ Alimentando Producto</span></div>
                      <div className="flex justify-between text-[10px]"><span className="text-slate-500">m² prom. ponderado</span><span className="font-bold text-emerald-700 font-mono">{mixPondM2>0?mixPondM2.toFixed(1)+' m²':'—'}</span></div>
                      <div className="flex justify-between text-[10px]"><span className="text-slate-500">Pk/apto</span><span className="font-bold text-emerald-700 font-mono">{mixPkPerApt>0?mixPkPerApt.toFixed(3):'—'}</span></div>
                    </div>
                  </>}
                </>}/>
              
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card t="Apartamentos" icon={ic.bldg} ch={<>
                  {mixMdls.length>0&&<div className="mx-3 mb-2 px-3 py-2 bg-emerald-50 rounded-lg border border-emerald-200"><div className="text-[10px] text-emerald-600 font-semibold mb-1">← Alimentado desde Mix Producto</div><div className="flex justify-between text-xs"><span className="text-slate-500">m² ponderado</span><span className="font-mono font-bold text-emerald-600">{mixPondM2.toFixed(1)}</span></div><div className="flex justify-between text-xs"><span className="text-slate-500">Pk/apto</span><span className="font-mono font-bold text-emerald-600">{mixPkPerApt.toFixed(3)}</span></div></div>}
                  <In l="Tamaño promedio" v={inp.tamApto} o={v=>u("tamApto",v)} sfx="m²"/>
                  <In l="Parqueos por apto" v={inp.parqApto} o={v=>u("parqApto",v)} step="0.001"/>
                  <Sub t="Resultados"/>
                  <R l="Área aptos" v={`${f0(res?.aApt)} m²`}/>
                  <R l="Número de aptos" v={f0(res?.nApt)} b a/>
                  <R l="Parqueos aptos" v={f0(res?.pApt)}/>
                  <R l="Parqueos visitas" v={f0(res?.pVis)}/>
                </>}/>
                <Card t="Comercio y Oficinas" icon={ic.bldg} ch={<>
                  <Sub t="Comercio"/>
                  <R l="Área comercio" v={`${f0(res?.aCom)} m²`}/>
                  <In l="Parqueos comercio" v={inp.nPkCom} o={v=>u("nPkCom",v)}/>
                  <R l="m² rentable/parqueo" v={res?.m2PerPkCom>0?f1(res.m2PerPkCom)+' m²/pk':'—'}/>
                  <Sub t="Oficinas"/>
                  <R l="Área oficinas" v={`${f0(res?.aOfi)} m²`}/>
                  <In l="Unidades oficinas" v={inp.uniOfi} o={v=>u("uniOfi",v)}/>
                  <In l="Parqueos oficinas" v={inp.nPkOfi} o={v=>u("nPkOfi",v)}/>
                  <R l="m² rentable/parqueo" v={res?.m2PerPkOfi>0?f1(res.m2PerPkOfi)+' m²/pk':'—'}/>
                </>}/>
                <Card t="Sótanos y Protección" icon={ic.ruler} ch={<>
                  <Sub t="Eficiencia de sótanos"/>
                  <In l="m² por parqueo (eficiencia sótano)" v={inp.efSot} o={v=>u("efSot",v)} sfx="m²/pk"/>
                  <Sub t="Protección"/>
                  <In l="SN frente" v={inp.snFrente} o={v=>u("snFrente",v)}/>
                  <In l="SN fondo" v={inp.snFondo} o={v=>u("snFondo",v)}/>
                  <In l="Pilotes frente" v={inp.pilFrente} o={v=>u("pilFrente",v)}/>
                  <In l="Pilotes fondo" v={inp.pilFondo} o={v=>u("pilFondo",v)}/>
                  <Sub t="Resumen parqueos y sótanos"/>
                  <R l="Pk aptos" v={f0(res?.pApt)}/>
                  <R l="Pk comercio" v={f0(res?.pCom)}/>
                  <R l="Pk oficinas" v={f0(res?.pOfi)}/>
                  <R l="Pk visitas" v={f0(res?.pVis)}/>
                  <R l="Total parqueos" v={f0(res?.tParq)} b a/>
                  <R l="Área sótanos" v={`${f0(res?.aSot)} m²`}/>
                  <R l="Niveles sótano" v={f2(res?.cSot)} b a/>
                </>}/>
                </div>
              </div>}
              {/* STEP 4 — Ventas */}
              {st===4&&<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card t="Ventas — Aptos" icon={ic.dollar} ch={<><In l="Mes inicio ventas" v={inp.mesIniVtas} o={v=>u("mesIniVtas",v)}/><In l="Ritmo (aptos/mes)" v={inp.ritmoVtas} o={v=>u("ritmoVtas",v)}/><In l="Reserva" v={inp.reserva} o={v=>u("reserva",v)} sfx="%" step="0.1"/><In l="Enganche" v={inp.engApt} o={v=>u("engApt",v)} sfx="%"/><In l="Precio $/m²" v={inp.pvM2} o={v=>u("pvM2",v)} pfx="$"/><In l="Precio parqueo" v={inp.pvParq} o={v=>u("pvParq",v)} pfx="$"/><R l="Venta aptos" v={fd(res?.vAptSinImp)} b a bd/></>}/>
                <Card t="Comercio" icon={ic.bldg} ch={<><R l="Área comercio" v={`${f0(res?.aCom)} m²`}/><In l="Renta $/m²/mes" v={inp.rentaM2} o={v=>u("rentaM2",v)} pfx="$"/><In l="OPEX $/m²" v={inp.opexM2} o={v=>u("opexM2",v)} pfx="$"/><In l="Renta pq/mes" v={inp.rentaParq} o={v=>u("rentaParq",v)} pfx="$"/><In l="Costo pq/mes" v={inp.costoParq} o={v=>u("costoParq",v)} pfx="$"/><In l="Cap Rate" v={inp.capRate} o={v=>u("capRate",v)} sfx="%"/><Sub t="Resultados"/><R l="NOI" v={fd(res?.noi)} b a/><R l="Valor comercio" v={fd(res?.vComSinImp)} b a bd/></>}/>
                <Card t="Oficinas" icon={ic.bldg} ch={<><R l="Área oficinas" v={`${f0(res?.aOfi)} m²`}/><R l="Unidades" v={f0(res?.nOfi)}/><R l="m² por unidad" v={res?.aOfiUni>0?f0(res.aOfiUni)+' m²':'—'}/><In l="Ritmo ofi/mes" v={inp.ritmoOfi} o={v=>u("ritmoOfi",v)}/><In l="Enganche" v={inp.engOfi} o={v=>u("engOfi",v)} sfx="%"/><In l="Precio $/m²" v={inp.pvOfiM2} o={v=>u("pvOfiM2",v)} pfx="$"/><In l="Precio parqueo" v={inp.pvParqOfi} o={v=>u("pvParqOfi",v)} pfx="$"/><Sub t="Resultados"/><R l="Venta oficinas" v={fd(res?.vOfiSinImp)} b a bd/></>}/>
              </div>}
              {/* STEP 5 — Costos */}
              {st===5&&<div className="space-y-4">
                <div className="flex items-center gap-2 bg-white rounded-xl p-1 border border-slate-200 w-fit">
                  <button onClick={()=>u("costoMode","detallado")} className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${inp.costoMode!=="estimado"?"bg-emerald-500 text-white shadow-sm":"text-slate-400 hover:bg-slate-50"}`}>Detallado por rubro</button>
                  <button onClick={()=>u("costoMode","estimado")} className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${inp.costoMode==="estimado"?"bg-emerald-500 text-white shadow-sm":"text-slate-400 hover:bg-slate-50"}`}>Estimado por m²</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {inp.costoMode==="estimado"
                  ? <Card t="Costo Estimado" icon={ic.hammer} ch={<>
                      <div className="px-3 py-2 text-xs text-slate-400">Ingresa un costo global por m² de construcción (sin IVA)</div>
                      <In l="Costo por m²" v={inp.costoM2Est} o={v=>u("costoM2Est",v)} pfx="$" step="1"/>
                      <R l="Área de construcción" v={`${f0(res?.aConst)} m²`}/>
                      <R l="Costo sin IVA" v={fd(res?.cConstBase)} bd/>
                      <R l="Costo con IVA" v={fd(res?.cConst)} b a/>
                      <In l="Anticipo" v={inp.anticipo} o={v=>u("anticipo",v)} sfx="%"/>
                    </>}/>
                  : <Card t="Construcción ($/m²)" icon={ic.hammer} ch={<>{[["Acabados com/ofi","acabComOfi"],["Acabados amenid.","acabAmen"],["Acabados aptos","acabApt"],["Acabados sótanos","acabSot"],["Excavación","excCosto"],["Cimentación","ciment"],["Equipamiento","equip"],["Extracción","extrac"],["Inst. eléctricas","instElec"],["Inst. hidrosanit.","instHidro"],["Obra primaria","obraPrim"],["Obra secundaria","obraSec"],["Preliminar","prelim"],["Soil nailing","snCosto"],["Pilotes","pilCosto"]].map(([l,k])=><In key={k} l={l} v={inp[k]} o={v=>u(k,v)}/>)}<In l="Anticipo" v={inp.anticipo} o={v=>u("anticipo",v)} sfx="%"/><R l="Costo total (con IVA)" v={fd(res?.cConst)} b a bd/><R l="$/m² total" v={res?.aConst>0?'$'+f0(res.cConstBase/res.aConst)+'/m²':'—'} b/></>}/>
                }
                <Card t="Equipo y Mobiliario" icon={ic.hammer} ch={<><div className="px-3 py-1 text-xs text-slate-400">$/m² construcción</div>{[["Lobby","eqLobby","eqLobbyCost"],["Terraza","eqTerraza","eqTerrazaCost"],["Electrodomésticos","eqElectro","eqElectroCost"],["Cocinas/Closets/Baños","eqCocinas","eqCocinasCost"],["CCTV","eqCCTV","eqCCTVCost"],["Espejos/Mamparas","eqEspejos","eqEspejosCost"],["Jardinización","eqJardin","eqJardinCost"],["Señalización","eqSenal","eqSenalCost"],["Ornato/mejoras","eqOrnato","eqOrnatoCost"]].map(([l,kb,kc])=><Toggle key={kb} l={l} ck={inp[kb]} oc={v=>u(kb,v)} cost={inp[kc]} occ={v=>u(kc,v)}/>)}<R l="Costo total (con IVA)" v={fd(res?.cEquip)} b a bd/><R l="$/m² total" v={res?.aConst>0?'$'+f0(res.cEquipBase/res.aConst)+'/m²':'—'} b/></>}/>
                <Card t="Gastos Operativos" icon={ic.chart} ch={<><div className="px-3 py-1 text-xs text-slate-400">% sobre ventas sin impuestos</div>{[["Admin desarrollo","pctAdminDes","opAdminSI"],["Gastos técnicos","pctGasTec","opTecSI"],["Gastos legales","pctGasLeg","opLegSI"],["Mercadeo","pctMerc","opMercSI"],["Admin ventas","pctAdmVtas","opAdmVSI"],["Comercialización","pctComz","opComzSI"]].map(([l,k,rk])=><div key={k} className="group flex items-center justify-between gap-2 py-2 px-3 rounded-lg hover:bg-emerald-50/40"><span className="text-xs text-slate-600 leading-tight min-w-0">{l}</span><div className="flex items-center gap-1 shrink-0"><input type="number" value={inp[k]} step="0.5" onChange={e=>u(k,parseFloat(e.target.value)||0)} className="w-14 px-1.5 py-1.5 text-xs font-semibold text-emerald-800 bg-white border border-slate-200 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-emerald-400/40"/><span className="text-[10px] text-slate-400 w-4">%</span><span className="text-[10px] font-mono text-slate-400 w-16 text-right">{res&&res[rk]?fd(res[rk]):''}</span></div></div>)}<In l="Licencias" v={inp.pctLic} o={v=>u("pctLic",v)} sfx="%" step="0.25"/>{iauActive&&iauAP>0&&<R l="+ Edif. aumentada (AP)" v={fd(iauAP)} a/>}<R l="Total licencias (sin IVA)" v={fd(res?.opLicSI)} b/><R l="Total con IVA" v={fd(res?.tOpEx)} b a bd/></>}/>
              </div></div>}
              {/* STEP 6 — Financiamiento */}
              {st===6&&<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card t="Capital y Deuda" icon={ic.dollar} ch={<>
                  <In l="Capital (equity)" v={inp.capital} o={v=>u("capital",v)} pfx="$" wide/>
                  {res&&res.suggestedCapital>0&&<div className={`mx-3 mb-2 px-3 py-2 rounded-lg border ${inp.capital>=res.suggestedCapital*0.95?'bg-emerald-50 border-emerald-200':inp.capital>=res.suggestedCapital*0.7?'bg-amber-50 border-amber-200':'bg-red-50 border-red-200'}`}>
                    <div className="text-[10px] font-semibold text-slate-500 mb-2">Capital estimado — fase de planificación ({inp.planif} meses)</div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-500">Egresos en planificación</span>
                      <span className="text-xs font-mono font-bold">{fd(res.costDuringPlan)}</span>
                    </div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-500">(-) Enganches recibidos</span>
                      <span className="text-xs font-mono font-bold text-emerald-600">{fd(res.engDuringPlan)}</span>
                    </div>
                    <div className="flex items-center justify-between mb-2 pt-1 border-t border-slate-200">
                      <span className="text-xs font-semibold text-slate-700">Capital necesario estimado</span>
                      <span className="text-sm font-bold font-mono text-slate-800">{fd(res.suggestedCapital)}</span>
                    </div>
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden mb-1"><div className="h-full rounded-full transition-all" style={{width:Math.min(inp.capital/Math.max(res.suggestedCapital,1)*100,100)+'%',background:inp.capital>=res.suggestedCapital*0.95?'#10b981':inp.capital>=res.suggestedCapital*0.7?'#f59e0b':'#ef4444'}}/></div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-slate-400">Tu capital: {fd(inp.capital)}</span>
                      <span className={`font-semibold ${inp.capital>=res.suggestedCapital*0.95?'text-emerald-600':inp.capital>=res.suggestedCapital*0.7?'text-amber-600':'text-red-600'}`}>
                        {inp.capital>=res.suggestedCapital*0.95?'✓ Suficiente':inp.capital>=res.suggestedCapital*0.7?'⚠ Ajustado':'✕ Insuficiente'}
                      </span>
                    </div>
                    <div className="text-[9px] text-slate-400 mt-1">Déficit neto antes del primer desembolso bancario (mes {inp.planif+1}, inicio construcción).</div>
                  </div>}
                  <In l="Tasa interés" v={inp.tasaInt} o={v=>u("tasaInt",v)} sfx="%" step="0.25"/>
                  <In l="Retorno pref." v={inp.retPref} o={v=>u("retPref",v)} sfx="%"/>
                  <In l="Promote fee" v={inp.promoteFee} o={v=>u("promoteFee",v)} sfx="%"/>
                  <Sub t="Fuentes de financiamiento"/>
                  <R l="Capital (cash equity)" v={fd(res?.capUsed)} b/>
                  {res?.isAportado&&<R l="Terreno (aportación)" v={fd(res?.terrFundUsed)} b/>}
                  <R l="Préstamo bancario" v={fd(res?.prest)}/>
                  <R l="Total fuentes" v={fd((res?.capUsed||0)+(res?.terrFundUsed||0)+(res?.prest||0))} b a bd/>
                  <R l="Intereses totales" v={fd(res?.totInt)}/>
                </>}/>
                <div className="space-y-4">
                  <Card t="Resumen de Costos" icon={ic.chart} ch={<><R l="Terreno" v={fd(res?.cTerr)}/><R l="Construcción" v={fd(res?.cConst)}/><R l="Equipo" v={fd(res?.cEquip)}/><R l="Gastos op." v={fd(res?.tOpEx)}/><R l="TOTAL" v={fd(res?.tCostos)} b a bd/><R l="Intereses" v={fd(res?.totInt)}/><R l="Impuestos" v={fd(res?.totalTax)}/></>}/>
                  {res&&res.tCostos>0&&<Card t="Estructura de Capital" icon={ic.dollar} ch={<>
                    {(()=>{
                      const totalCosts=res.tCostos+res.totInt;
                      const cap=res.capUsed||0;
                      const terrF=res.terrFundUsed||0;
                      const debt=res.prest||0;
                      const eng=Math.max(totalCosts-cap-terrF-debt,0);
                      const total=totalCosts;if(!total)return null;
                      const slices=[{v:cap,c:'#10b981',l:'Capital'},{v:terrF,c:'#8b5cf6',l:'Terreno aportado'},{v:eng,c:'#f59e0b',l:'Enganches'},{v:debt,c:'#6366f1',l:'Deuda'}].filter(s=>s.v>0);
                      let cum=0;
                      return(<div className="px-3 py-2">
                        <svg viewBox="0 0 200 200" className="w-40 h-40 mx-auto mb-3">
                          {slices.map((s,i)=>{const pct=s.v/total;const start=cum;cum+=pct;const startA=start*2*Math.PI-Math.PI/2;const endA=(start+pct)*2*Math.PI-Math.PI/2;const large=pct>0.5?1:0;const x1=100+80*Math.cos(startA),y1=100+80*Math.sin(startA);const x2=100+80*Math.cos(endA),y2=100+80*Math.sin(endA);return pct>=0.999?<circle key={i} cx="100" cy="100" r="80" fill={s.c}/>:<path key={i} d={`M100,100 L${x1},${y1} A80,80 0 ${large},1 ${x2},${y2} Z`} fill={s.c}/>;})}
                          <circle cx="100" cy="100" r="45" fill="white"/>
                          <text x="100" y="96" textAnchor="middle" fontSize="10" fontWeight="700" fill="#334155">{fd(total)}</text>
                          <text x="100" y="109" textAnchor="middle" fontSize="7" fill="#94a3b8">Costo total proyecto</text>
                        </svg>
                        <div className="space-y-1">{slices.map((s,i)=><div key={i} className="flex items-center justify-between text-xs"><div className="flex items-center gap-2"><div style={{width:10,height:10,borderRadius:3,background:s.c}}/><span className="text-slate-600">{s.l}</span></div><span className="font-mono font-bold">{fd(s.v)} <span className="text-slate-400 font-normal">({(s.v/total*100).toFixed(0)}%)</span></span></div>)}</div>
                      </div>);
                    })()}
                  </>}/>}
                </div>
              </div>}
              {/* STEP 7 — Resultados */}
              {st===7&&res&&<div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card t="Estado de Resultados" icon={ic.chart} ch={<>
                  <div className="px-3 py-1 mb-1 flex items-center justify-between"><span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">Sin impuestos · Sin IVA</span><span className="text-[10px] text-slate-400 font-mono">Monto / % Ventas</span></div>
                  <PL l="Ventas" amt={res.vProy} vtas={res.vProy} b/>
                  <PL l="(-) Construcción" amt={-res.cConstBase} vtas={res.vProy}/>
                  <PL l="(-) Equipo" amt={-res.cEquipBase} vtas={res.vProy}/>
                  <PL l="(-) Terreno" amt={-res.cTerr} vtas={res.vProy}/>
                  <PL l="Margen bruto" amt={res.vProy-res.cConstBase-res.cEquipBase-res.cTerr} vtas={res.vProy} b a bd/>
                  <PL l="(-) Admin desarrollo" amt={-res.opAdminSI} vtas={res.vProy}/>
                  <PL l="(-) Gastos técnicos" amt={-res.opTecSI} vtas={res.vProy}/>
                  <PL l={`(-) Licencias (${f2(inp.pctLic)}%${iauActive&&iauAP>0?' + AP':''})`} amt={-res.opLicSI} vtas={res.vProy}/>
                  <PL l="(-) Gastos legales" amt={-res.opLegSI} vtas={res.vProy}/>
                  <PL l="(-) Mercadeo" amt={-res.opMercSI} vtas={res.vProy}/>
                  <PL l="(-) Admin ventas" amt={-res.opAdmVSI} vtas={res.vProy}/>
                  <PL l="(-) Comercialización" amt={-res.opComzSI} vtas={res.vProy}/>
                  <PL l="EBIT" amt={res.ebitAbs} vtas={res.vProy} b a bd/>
                  <PL l="(-) Intereses" amt={-res.totInt} vtas={res.vProy}/>
                  <PL l="Utilidad antes imp." amt={res.utilAntesImp} vtas={res.vProy} b a bd/>
                  <PL l="(-) ISR + ISO (3%)" amt={-res.isrIso} vtas={res.vProy}/>
                  <PL l="Utilidad neta" amt={res.utilDespImp} vtas={res.vProy} b a bd/>
                </>}/>
                <div className="space-y-4">
                  <Card t="Valor del Proyecto" icon={ic.dollar} ch={<><R l="Apartamentos" v={fd(res.vAptSinImp)}/><R l="Comercio" v={fd(res.vComSinImp)}/><R l="Oficinas" v={fd(res.vOfiSinImp)}/><R l="TOTAL (sin imp)" v={fd(res.vProy)} b a bd/><R l="Con impuestos" v={fd(res.vProyConImp)}/></>}/>
                  <Card t="Costos Flujo de Caja" icon={ic.hammer} ch={<><R l="Terreno" v={fd(res.cTerr)}/><R l="Construcción" v={fd(res.cConst)}/><R l="Equipo" v={fd(res.cEquip)}/><R l="Gastos op." v={fd(res.tOpEx)}/><R l="Timbres" v={fd(res.timbres)}/><R l="TOTAL" v={fd(res.tCostos)} b a bd/></>}/>
                </div>
                </div>
                {/* Charts — full width */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Waterfall Chart — P&L */}
                <Card t="Cascada de Rentabilidad" icon={ic.chart} ch={<>
                  {(()=>{
                    const steps=[
                      {l:'Ventas',v:res.vProy,type:'total'},
                      {l:'Construcción',v:-res.cConstBase-res.cEquipBase},
                      {l:'Terreno',v:-res.cTerr},
                      {l:'Gastos Op.',v:-res.tOpExSI},
                      {l:'Intereses',v:-res.totInt},
                      {l:'Utilidad AI',v:res.utilAntesImp,type:'total'},
                    ];
                    // Compute waterfall positions
                    let running=0;const bars=steps.map(s=>{
                      if(s.type==='total'){const b={...s,y:Math.min(s.v,0),h:Math.abs(s.v),bottom:Math.min(s.v,0)};running=s.v;return b;}
                      const top=running;running+=s.v;
                      return{...s,y:Math.min(top,running),h:Math.abs(s.v),bottom:Math.min(top,running)};
                    });
                    const allVals=bars.flatMap(b=>[b.y,b.y+b.h]);
                    const maxV=Math.max(...allVals,1);const minV=Math.min(...allVals,0);
                    const range=maxV-minV||1;
                    const svgH=180,svgW=400,pad=50,barW=40,gap=(svgW-pad*2-barW*bars.length)/(bars.length-1);
                    const yScale=v=>(maxV-v)/range*(svgH-40)+20;
                    return(<div className="px-2 py-2 overflow-x-auto">
                      <svg viewBox={`0 0 ${svgW} ${svgH+25}`} className="w-full" style={{minWidth:360}}>
                        {/* Grid lines */}
                        {[0,0.25,0.5,0.75,1].map((f,i)=>{const y=20+f*(svgH-40);return (<g key={i}><line x1={pad-5} y1={y} x2={svgW-10} y2={y} stroke="#e2e8f0" strokeWidth="0.5"/><text x={pad-8} y={y+3} textAnchor="end" fontSize="7" fill="#94a3b8">{fd(maxV-f*range)}</text></g>);})}
                        {/* Zero line */}
                        {minV<0&&<line x1={pad-5} y1={yScale(0)} x2={svgW-10} y2={yScale(0)} stroke="#334155" strokeWidth="0.8" strokeDasharray="3,2"/>}
                        {/* Bars + connectors */}
                        {bars.map((b,i)=>{
                          const x=pad+i*(barW+gap);
                          const yTop=yScale(b.y+b.h);
                          const barH=Math.max((b.h/range)*(svgH-40),2);
                          const isPos=b.v>=0;const isTotal=b.type==='total';
                          const color=isTotal?(isPos?'#059669':'#dc2626'):(isPos?'#10b981':'#ef4444');
                          return(<g key={i}>
                            <rect x={x} y={yTop} width={barW} height={barH} fill={color} rx="3" opacity={isTotal?1:0.75}/>
                            {i>0&&i<bars.length-1&&<line x1={x-gap/2} y1={yScale(bars[i].y+(bars[i].v>=0?bars[i].h:0))} x2={x} y2={yScale(bars[i].y+(bars[i].v>=0?bars[i].h:0))} stroke="#cbd5e1" strokeWidth="0.8" strokeDasharray="2,2"/>}
                            <text x={x+barW/2} y={yTop-4} textAnchor="middle" fontSize="7" fontWeight="700" fill={color}>{fd(Math.abs(b.v))}</text>
                            <text x={x+barW/2} y={svgH+12} textAnchor="middle" fontSize="7" fill="#64748b">{b.l}</text>
                          </g>);
                        })}
                      </svg>
                    </div>);
                  })()}
                </>}/>
                </div>
              </div>}
              {/* STEP 8 — Cuotas */}
              {st===8&&<div className="space-y-4">
                <Card t="Parámetros de Financiamiento" icon={ic.dollar} ch={<>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-3 py-2">
                    <div><div className="text-[10px] text-slate-500 mb-1">Enganche (%)</div><div className="px-3 py-1.5 bg-slate-50 rounded-lg text-xs font-bold text-slate-700 text-center">{inp.engApt}%<div className="text-[9px] text-slate-400 font-normal">← Ventas</div></div></div>
                    <div><div className="text-[10px] text-slate-500 mb-1">Tasa financiar (%)</div><input type="number" value={inp.tasaFin} step="0.1" onChange={e=>u("tasaFin",parseFloat(e.target.value)||0)} className="w-full px-3 py-1.5 text-xs font-bold text-emerald-800 bg-white border border-slate-200 rounded-lg text-center focus:outline-none"/></div>
                    <div><div className="text-[10px] text-slate-500 mb-1">Plazo (meses)</div><input type="number" value={inp.plazoMeses} onChange={e=>u("plazoMeses",parseInt(e.target.value)||0)} className="w-full px-3 py-1.5 text-xs font-bold text-emerald-800 bg-white border border-slate-200 rounded-lg text-center focus:outline-none"/></div>
                    <div><div className="text-[10px] text-slate-500 mb-1">Tipo cambio Q/$</div><input type="number" value={inp.tipoCambio} step="0.01" onChange={e=>u("tipoCambio",parseFloat(e.target.value)||0)} className="w-full px-3 py-1.5 text-xs font-bold text-emerald-800 bg-white border border-slate-200 rounded-lg text-center focus:outline-none"/></div>
                  </div>
                </>}/>
                <Card t="Análisis por Modelo" icon={ic.bldg} ch={<>
                  {(()=>{
                    const mdls=mixCalc.filter(m=>m.m2>0&&m.units>0);
                    if(!mdls.length) return <div className="px-3 py-4 text-center text-xs text-slate-400">Agrega modelos en Mix Producto para ver el análisis de cuotas.</div>;
                    const r=inp.tasaFin/100/12;const n=inp.plazoMeses||300;const tc=inp.tipoCambio||7.7;
                    const pmt=(monto)=>r>0&&n>0?monto*r*Math.pow(1+r,n)/(Math.pow(1+r,n)-1):0;
                    const segmento=(ifr)=>ifr<=6000?'D':ifr<=9000?'D+':ifr<=12000?'C-':ifr<=18000?'C':ifr<=25000?'C+':ifr<=35000?'B-':ifr<=50000?'B':ifr<=70000?'B+':ifr<=100000?'A-':'A';
                    return(<div className="px-3 py-2">
                      <div className="grid gap-3" style={{gridTemplateColumns:`repeat(${Math.min(mdls.length,4)},1fr)`}}>
                        {mdls.map((m,i)=>{
                          const pxApt=m.m2*inp.pvM2;const pxPk=(+m.pk||0)*inp.pvParq;
                          const plt=pxApt+pxPk;const pci=plt*1.093;
                          const eng=pci*(inp.engApt/100);const montoFin=pci-eng;
                          const cuotaUSD=pmt(montoFin);const cuotaQ=cuotaUSD*tc;const ifr=cuotaQ*3;
                          return(<div key={m.id||i} className="bg-slate-50 rounded-xl border border-slate-200 p-3">
                            <div className="text-xs font-bold text-slate-700 mb-2 pb-1 border-b border-slate-200">{m.name||'Modelo '+(i+1)}</div>
                            <div className="space-y-1 text-[10px]">
                              <div className="flex justify-between"><span className="text-slate-400">Tamaño</span><span className="font-mono font-bold">{m.m2} m²</span></div>
                              <div className="flex justify-between"><span className="text-slate-400">Precio apto ($)</span><span className="font-mono">{fd(pxApt)}</span></div>
                              <div className="flex justify-between"><span className="text-slate-400">Precio pk ($)</span><span className="font-mono">{fd(pxPk)}</span></div>
                              <div className="flex justify-between border-t border-slate-200 pt-1"><span className="text-slate-500 font-semibold">Precio limpio</span><span className="font-mono font-bold">{fd(plt)}</span></div>
                              <div className="flex justify-between"><span className="text-slate-500 font-semibold">Con impuestos</span><span className="font-mono font-bold">{fd(pci)}</span></div>
                              <div className="flex justify-between border-t border-slate-200 pt-1"><span className="text-slate-400">Enganche ({inp.engApt}%)</span><span className="font-mono">{fd(eng)}</span></div>
                              <div className="flex justify-between"><span className="text-slate-400">Monto a financiar</span><span className="font-mono">{fd(montoFin)}</span></div>
                              <div className="flex justify-between border-t border-emerald-200 pt-1 mt-1"><span className="text-emerald-700 font-semibold">Cuota mensual ($)</span><span className="font-mono font-bold text-emerald-700">{fd(cuotaUSD)}</span></div>
                              <div className="flex justify-between"><span className="text-slate-500">Cuota mensual (Q)</span><span className="font-mono font-bold">{fd(cuotaQ)}</span></div>
                              <div className="flex justify-between"><span className="text-slate-500">Ingreso fam. (Q)</span><span className="font-mono font-bold">{fd(ifr)}</span></div>
                              <div className="flex justify-between border-t border-slate-200 pt-1"><span className="text-slate-400">Segmento</span><span className="font-bold text-indigo-600">{segmento(ifr)}</span></div>
                              <div className="flex justify-between"><span className="text-slate-400">Unidades</span><span className="font-mono">{m.units}</span></div>
                            </div>
                          </div>);
                        })}
                      </div>
                    </div>);
                  })()}
                </>}/>
              </div>}
            </div>

            {/* SIDEBAR */}
            <div className="lg:col-span-4"><div className="sticky top-20 space-y-4">
              <div className="bg-slate-900 rounded-2xl p-5 text-white shadow-xl">
                <div className="text-xs text-slate-400 font-bold tracking-widest uppercase mb-3">Métricas Clave</div>
                <div className="grid grid-cols-2 gap-2.5">
                  <MC l="TIR antes imp." v={res?.airrBT?fp(res.airrBT):"—"} st={res?.airrBT!=null?iS(res.airrBT):null}/>
                  <MC l="TIR después imp." v={res?.airrAT?fp(res.airrAT):"—"} st={res?.airrAT!=null?iS(res.airrAT):null}/>
                  <MC l="MOIC antes imp." v={res?.moicBT?f2(res.moicBT)+"x":"—"} st={res?.moicBT!=null?mS(res.moicBT):null}/>
                  <MC l="MOIC después imp." v={res?.moicAT?f2(res.moicAT)+"x":"—"} st={res?.moicAT!=null?mS(res.moicAT):null}/>
                  <MC l="Utilidad antes imp." v={fd(res?.utilAntesImp)} sub={res?.pctUtilAntImp!=null?`${fp(res.pctUtilAntImp)} s/ventas`:""} st={res?.utilAntesImp>0?"good":res?.utilAntesImp!=null?"bad":null}/>
                  <MC l="Utilidad neta" v={fd(res?.utilDespImp)} sub={res?.pctUtilDespImp!=null?`${fp(res.pctUtilDespImp)} s/ventas`:""} st={res?.utilDespImp>0?"good":res?.utilDespImp!=null?"bad":null}/>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Resumen</div>
                <R l="Área terreno" v={`${f0(res?.aT*1.43115)} v²`}/>
                <R l="Área edificable" v={`${f0(res?.aE)} m²`}/>
                <R l="Área vendible" v={`${f0(res?.totalVend)} m²`}/>
                <R l="Área sótanos" v={`${f0(res?.aSot)} m²`}/>
                <R l="Área construcción" v={`${f0(res?.aConst)} m²`}/>
                <R l="Sótanos" v={f2(res?.cSot)}/>
                {res?.niveles>0&&<R l="Niveles" v={f1(res?.niveles)}/>}
                {res?.alturaTotal>0&&<R l="Altura" v={`${f1(res?.alturaTotal)} m`}/>}
                <R l="Duración" v={`${res?.dur||"—"} meses`} bd/>
                <R l="Valor del proyecto" v={fd(res?.vProy)} b a/>
                <R l="EBIT" v={fp(res?.mEBIT)} b a/>
                <R l="Capital total" v={fd(res?.tCap)}/>
                <R l="Préstamo" v={fd(res?.prest)}/>
              </div>
              <div className="flex gap-2">
                <button onClick={()=>setSt(Math.max(0,st-1))} disabled={st===0} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold rounded-xl bg-white border border-slate-200 text-slate-600 disabled:opacity-30 hover:bg-slate-50"><Ic d={ic.chevL} s={14}/>Anterior</button>
                <button onClick={()=>setSt(Math.min(8,st+1))} disabled={st===8} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold rounded-xl bg-emerald-500 text-white disabled:opacity-30 hover:bg-emerald-600 shadow-sm">Siguiente<Ic d={ic.chevR} s={14}/></button>
              </div>
            </div></div>
          </div>
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════
// REFERENCIALES DATA (from Excel - $/m2 con IVA)
// ══════════════════════════════════════════
const REF_CATEGORIES=["A++ / Elite","A+/ Select","A / Prime","A- / Entry Premium","B+","B","B-","C+","C","C-","D"];
const REF_CONST_LABELS={acabAmen:"Acabados amenidades",acabApt:"Acabados apartamentos",acabSot:"Acabados sótanos",ciment:"Cimentación",equip:"Equipamiento obra",exc:"Excavación",extrac:"Extracción",instElec:"Inst. eléctricas",instHidro:"Inst. hidrosanitarias",obraPrim:"Obra primaria",obraSec:"Obra secundaria",prelim:"Preliminar",protPilotes:"Protección pilotes",protSN:"Protección soil nailing"};
const REF_EQUIP_LABELS={eqLobby:"Lobby",eqTerraza:"Terraza",eqElectro:"Electrodomésticos",eqCocinas:"Cocinas/closets/baños",eqCCTV:"CCTV",eqEspejos:"Espejos y mamparas",eqJardin:"Jardinización",eqSenal:"Señalización",eqOrnato:"Ornato y mejoras",eqImprevistos:"Imprevistos"};
const REF_TECH_LABELS={suelos:"Suelos",topografia:"Topografía",arquitectura:"Arquitectura",estructural:"Estructural",hidraulico:"Hidráulico y mecánico",ptratamiento:"Planta tratamiento",electrico:"Eléctrico",supervision:"Supervisión técnica",consultoria:"Consultoría varias",imprevistos:"Imprevistos",piscina:"Piscina"};
const REF_CHAR_LABELS={constructora:"Constructora",year:"Año",uso:"Uso",ubicacion:"Ubicación",sotanos:"Sótanos",niveles:"Niveles",unidades:"Unidades",torres:"Torres",aptosPorNivel:"Aptos/nivel",m2Const:"m² construcción",m2Planta:"m² planta típica",altura:"Altura",parqueos:"Parqueos",tiempoEjec:"Tiempo ejecución"};
const REF_DATA=[
{name:"MENARA",categoria:"A / Prime",construccion:{acabAmen:321.37,acabApt:311.55,acabSot:18.9,ciment:9.66,equip:13.39,exc:13.8,extrac:1.54,instElec:43.34,instHidro:43.62,obraPrim:161.35,obraSec:66.58,prelim:10.75,protPilotes:242.77,protSN:152.69,total:597.11},equipo:{},tecnico:{},caracteristicas:{constructora:"GDU",year:2021,uso:"RESIDENCIAL",ubicacion:"ZONA 15",sotanos:4,niveles:13,unidades:22,torres:1,aptosPorNivel:2,m2Const:"8,577 m2",m2Planta:"452 m2",altura:"44.70 mts",parqueos:"65 plazas"}},
{name:"VERDÚ",categoria:"C+",construccion:{acabAmen:116.5,acabApt:339.26,acabSot:11.23,ciment:15.1,equip:10.03,exc:11.91,extrac:8.69,instElec:53.48,instHidro:47.71,obraPrim:214.56,obraSec:72.03,prelim:27.17,protSN:137.74,total:651.3},equipo:{eqLobby:12.49,eqTerraza:4.68,eqElectro:17.35,eqCocinas:31.22,eqCCTV:1.12,eqEspejos:1.13,eqJardin:0.84,eqSenal:1.07,eqOrnato:0.41,eqImprevistos:1.41,total:71.71},tecnico:{suelos:0.35,topografia:0.06,arquitectura:8.88,estructural:2.37,hidraulico:1.23,ptratamiento:0.05,electrico:0.69,supervision:0.74,consultoria:1.07,piscina:0.03,total:15.48},caracteristicas:{constructora:"GDU",year:2024,uso:"RESIDENCIAL",ubicacion:"ZONA 13",sotanos:6,niveles:19,unidades:208,torres:2,aptosPorNivel:14,m2Const:"28,034 m2",m2Planta:"908 m2",tiempoEjec:"28 meses"}},
{name:"VILÉ",categoria:"C+",construccion:{acabAmen:93.61,acabApt:355.69,acabSot:18.03,ciment:23.08,equip:13.06,exc:17.64,extrac:27.21,instElec:61.89,instHidro:50.42,obraPrim:209.68,obraSec:73.87,prelim:53.46,protPilotes:267.98,protSN:134.3,total:709.25},equipo:{},tecnico:{},caracteristicas:{constructora:"GDU",year:2024,uso:"RESIDENCIAL",ubicacion:"ZONA 10",sotanos:5,niveles:13,unidades:111,torres:1,aptosPorNivel:9,m2Const:"15,598 m2",m2Planta:"736 m2",tiempoEjec:"20 meses"}},
{name:"VILÉ V2",categoria:"C+",construccion:{acabAmen:181.11,acabApt:367.42,acabSot:25.15,ciment:21.74,equip:13.64,exc:14.07,extrac:14.17,instElec:49.99,instHidro:51.1,obraPrim:202.93,obraSec:64.11,prelim:31.34,protSN:205.27,total:686.9},equipo:{eqLobby:4.14,eqTerraza:3.26,eqElectro:19.84,eqCocinas:23.66,eqCCTV:3.55,eqEspejos:3.39,eqJardin:1.65,eqSenal:1.16,eqImprevistos:2.81,total:63.47},tecnico:{suelos:0.61,topografia:0.09,arquitectura:6.84,estructural:1.65,hidraulico:0.86,ptratamiento:0.11,electrico:0.6,supervision:1.35,consultoria:0.65,imprevistos:0.03,total:12.83},caracteristicas:{constructora:"GDU",year:2025,uso:"RESIDENCIAL",ubicacion:"ZONA 10",sotanos:5,niveles:13,unidades:111,torres:1,aptosPorNivel:9,m2Const:"15,598 m2",m2Planta:"736 m2",tiempoEjec:"20 meses"}},
{name:"ARU",categoria:"C",construccion:{acabAmen:449.64,acabApt:268.68,acabSot:21.6,ciment:16.83,equip:17.26,exc:32.04,extrac:25.7,instElec:57.25,instHidro:52.98,obraPrim:206.49,obraSec:76.45,prelim:29.87,protPilotes:267.69,protSN:134.15,total:716.76},equipo:{},tecnico:{},caracteristicas:{constructora:"GDU",year:2023,uso:"RESIDENCIAL",ubicacion:"ZONA 15"}},
{name:"ARU V2",categoria:"C",construccion:{acabAmen:162.78,acabApt:336.88,acabSot:28.5,ciment:23.19,equip:15.1,exc:30.89,extrac:34.62,instElec:75.88,instHidro:47.13,obraPrim:204.99,obraSec:75.28,prelim:55.15,protPilotes:292.29,protSN:186.7,total:769.79},equipo:{},tecnico:{},caracteristicas:{constructora:"GDU",year:2023,uso:"RESIDENCIAL",ubicacion:"ZONA 15"}},
{name:"AURANA",categoria:"B",construccion:{acabAmen:158.56,acabApt:312.19,acabSot:17.57,ciment:32.35,equip:11.75,exc:17.44,extrac:15.76,instElec:46.06,instHidro:45.26,obraPrim:218.12,obraSec:62.01,prelim:45.38,protPilotes:305.38,protSN:246.64,total:687.14},equipo:{eqLobby:0.77,eqTerraza:7.54,eqElectro:15.67,eqCocinas:26.43,eqCCTV:3.63,eqEspejos:5.96,eqJardin:1.46,eqSenal:2.28,total:63.73},tecnico:{suelos:0.32,topografia:0.04,arquitectura:5.69,estructural:2.21,hidraulico:0.49,ptratamiento:0.07,electrico:0.5,supervision:1.08,consultoria:0.1,imprevistos:0.21,total:10.71},caracteristicas:{constructora:"GDU",year:2023,uso:"RESIDENCIAL",ubicacion:"ZONA 10"}},
{name:"SALOMÉ",categoria:"C-",construccion:{acabAmen:740.8,acabApt:286.44,acabSot:6.98,ciment:32.58,equip:10.11,exc:10.0,extrac:11.74,instElec:26.94,instHidro:25.09,obraPrim:169.61,obraSec:46.12,prelim:15.02,total:527.5},equipo:{},tecnico:{},caracteristicas:{constructora:"MACRO",year:2023,uso:"RESIDENCIAL",ubicacion:"ZONA 1",sotanos:8,niveles:12,unidades:250,torres:1,aptosPorNivel:8,m2Const:"29,133 m2",m2Planta:"1,372 m2",tiempoEjec:"22 meses"}},
{name:"ESENTA",categoria:"C-",construccion:{acabApt:153.49,acabSot:30.34,ciment:64.34,equip:29.37,exc:11.12,extrac:5.09,instElec:60.03,instHidro:49.5,obraPrim:166.63,obraSec:35.39,prelim:1.48,protPilotes:426.62,protSN:106.47,total:491.45},equipo:{},tecnico:{},caracteristicas:{constructora:"CPM",uso:"RESIDENCIAL",ubicacion:"ZONA 12",sotanos:7,niveles:14}},
{name:"TORRE CARRA",categoria:"A+/ Select",construccion:{acabAmen:215.67,acabApt:426.6,acabSot:13.87,equip:44.45,instElec:24.65,instHidro:17.32,obraPrim:315.06,obraSec:29.98,prelim:15.38,protSN:269.03,total:776.64},equipo:{},tecnico:{},caracteristicas:{constructora:"CPM",uso:"RESIDENCIAL",ubicacion:"ZONA 12",sotanos:7,niveles:14}},
{name:"ABITARE",categoria:"C+",construccion:{obraPrim:95.14,obraSec:17.11,prelim:2.33,total:129.51},equipo:{},tecnico:{},caracteristicas:{}},
{name:"INARA CUATRO",categoria:"C+",construccion:{ciment:11.08,exc:7.4,obraPrim:176.89,prelim:3.3,protSN:204.92,total:200.06},equipo:{},tecnico:{},caracteristicas:{constructora:"COMOSA",year:2023,uso:"RESIDENCIAL",ubicacion:"ZONA 13",sotanos:7,niveles:21,torres:2,m2Const:"51,654 m2",m2Planta:"918 m2"}}
];

// ══════════════════════════════════════════
// REFERENCIALES VIEW COMPONENT
// ══════════════════════════════════════════

export {Platform};
