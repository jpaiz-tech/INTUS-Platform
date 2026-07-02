import {useState,useEffect,useCallback,useMemo,useRef} from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import {calc,D,f0,f1,f2,fp,fd,ZG,POT_COLORS,detectZoneKML,decodePoly} from './core.js';
import {POT_POLYS} from '../data/potPolygons.js';
import {Ic,ic} from './ui.jsx';
// Vite bundling breaks Leaflet's default icon URL detection — restore explicitly
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({iconRetinaUrl:markerIcon2x,iconUrl:markerIcon,shadowUrl:markerShadow});
const MapView=({projects,onOpenProject})=>{
  const [potOn,setPotOn]=useState(true);
  const [satOn,setSatOn]=useState(true);
  const [drawing,setDrawing]=useState(false);
  const [measuring,setMeasuring]=useState(false);
  const [searchQ,setSearchQ]=useState('');
  const [searchResults,setSearchResults]=useState([]);
  const [clickInfo,setClickInfo]=useState(null);
  const [cursorPos,setCursorPos]=useState(null);
  const [polygons,setPolygons]=useState([]);
  const [activeVertices,setActiveVertices]=useState([]);
  const [measurePts,setMeasurePts]=useState([]);
  const [prediosOn,setPrediosOn]=useState(false);
  const potRef=useRef(null);
  const satRef=useRef(null);
  const mapRef=useRef(null);
  const mapInstance=useRef(null);
  const drawLayerRef=useRef(null);
  const activePolyRef=useRef(null);
  const activeMarkersRef=useRef([]);
  const labelLayerRef=useRef(null);
  const measureLayerRef=useRef(null);
  const searchMarkerRef=useRef(null);

  // Haversine distance in meters
  const haversine=(a,b)=>{const R=6371000,dLat=(b[0]-a[0])*Math.PI/180,dLng=(b[1]-a[1])*Math.PI/180;const x=Math.sin(dLat/2)**2+Math.cos(a[0]*Math.PI/180)*Math.cos(b[0]*Math.PI/180)*Math.sin(dLng/2)**2;return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));};
  // Polygon area using Shoelace on projected coords (meters)
  const polyAreaM2=(pts)=>{if(pts.length<3)return 0;const R=6371000;const rad=pts.map(p=>[p[0]*Math.PI/180,p[1]*Math.PI/180]);const ref=rad[0];const proj=rad.map(p=>[R*(p[1]-ref[1])*Math.cos(ref[0]),R*(p[0]-ref[0])]);let a=0;for(let i=0;i<proj.length;i++){const j=(i+1)%proj.length;a+=proj[i][0]*proj[j][1]-proj[j][0]*proj[i][1];}return Math.abs(a/2);};
  const fmtDist=m=>m>=1000?(m/1000).toFixed(2)+' km':m.toFixed(1)+' m';
  const fmtArea=m2=>m2>=10000?(m2/10000).toFixed(2)+' ha':m2.toFixed(0)+' m²';

  // Init map - matches v8 vanilla pattern
  useEffect(()=>{
    if(!mapRef.current||mapInstance.current)return;
    const map=L.map(mapRef.current,{doubleClickZoom:false,center:[14.6349,-90.5069],zoom:14,zoomControl:true});
    // Base layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',{maxZoom:20}).addTo(map);
    // ArcGIS satellite (same URL as v8 — opacity 0.6 so base shows through)
    const sat=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:20,opacity:0.6});
    sat.addTo(map);
    satRef.current=sat;
    // POT polygons on top
    try{
      const pg=L.layerGroup();
      for(const[z,rings]of POT_POLYS){const col=POT_COLORS[z]||'#888';
        const lr=rings.map(r=>{const pts=decodePoly(r);return pts.map(([lng,lat])=>[lat,lng]);});
        L.polygon(lr,{color:col,weight:0.8,opacity:0.7,fillColor:col,fillOpacity:0.35,interactive:false}).addTo(pg);
      }
      pg.addTo(map);potRef.current=pg;
      pg.bringToFront();
    }catch(e){console.warn('POT err',e);}
    drawLayerRef.current=L.layerGroup().addTo(map);
    labelLayerRef.current=L.layerGroup().addTo(map);
    measureLayerRef.current=L.layerGroup().addTo(map);
    map.on('mousemove',e=>setCursorPos([e.latlng.lat.toFixed(6),e.latlng.lng.toFixed(6)]));
    mapInstance.current=map;
    setTimeout(()=>map.invalidateSize(),300);
  },[]);

  // Project markers
  useEffect(()=>{
    const map=mapInstance.current;if(!map)return;
    map.eachLayer(l=>{if(l instanceof L.Marker&&!l._isSearch)map.removeLayer(l);});
    projects.forEach(p=>{
      const lat=p.inputs?.lat||0,lng=p.inputs?.lng||0;
      if(!lat||!lng)return;
      let r=null;try{r=calc({...D,...p.inputs});}catch{}
      const marker=L.marker([lat,lng]).addTo(map);
      const nm=p.inputs.nombre||'Sin nombre';
      const terrenos=p.inputs.terrenos||[];
      const pots=[...new Set(terrenos.map(t=>t.potZone||t.pot).filter(Boolean))].join(', ');
      const equipo=p.inputs.equipo||'';const dev=p.inputs.desarrollador||'';const areaV2=r?f0((r.aTerrTotal||0)*1.43115):'—';
      const avgPrecio=terrenos.length>0?terrenos.reduce((s,t)=>s+t.precioVara,0)/terrenos.length:0;
      marker.bindPopup(`<div style="font-family:'DM Sans',sans-serif;min-width:240px"><div style="font-weight:700;font-size:13px;color:#1e293b">${nm}</div><div style="font-size:10px;color:#94a3b8;margin-bottom:2px">${p.inputs.ubicacion||''}</div>${equipo||dev?`<div style="font-size:10px;color:#64748b;margin-bottom:4px">${equipo}${equipo&&dev?' · ':''}${dev}</div>`:''}<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:8px 10px;margin-bottom:8px"><div style="font-size:10px;color:#16a34a;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px">Precio por vara</div><div style="font-size:20px;font-weight:800;color:#15803d;font-family:'JetBrains Mono',monospace">$${avgPrecio.toFixed(0)}/v²</div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:3px;font-size:10px"><div>Fecha: <b>${new Date(p.at).toLocaleDateString()}</b></div><div>POT: <b>${pots||'—'}</b></div><div>Valor: <b>${r?fd(r.vProy):'—'}</b></div><div>Área edif.: <b>${r?f0(r.aE)+' m²':'—'}</b></div><div>TIR: <b style="color:${r&&r.airrBT>0.15?'#059669':'#dc2626'}">${r&&r.airrBT?fp(r.airrBT):'—'}</b></div><div>MOIC: <b>${r&&r.moicBT?f2(r.moicBT)+'x':'—'}</b></div></div><button onclick="window.__openProject('${p.id}')" style="width:100%;margin-top:8px;padding:5px;background:#059669;color:white;border:none;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer">Abrir proyecto</button></div>`);
    });
  },[projects]);

  // Drawing handler
  useEffect(()=>{
    const map=mapInstance.current;if(!map)return;
    const onClick=e=>{
      if(drawing){
        const pt=[e.latlng.lat,e.latlng.lng];
        setActiveVertices(prev=>{
          const nv=[...prev,pt];
          // Redraw active polygon preview
          if(activePolyRef.current){map.removeLayer(activePolyRef.current);}
          activeMarkersRef.current.forEach(m=>map.removeLayer(m));activeMarkersRef.current=[];
          if(nv.length>=2){
            activePolyRef.current=L.polygon(nv,{color:'#34D399',weight:2,fillOpacity:0.15,dashArray:'5,5'}).addTo(map);
          }
          // Vertex markers + distance labels
          nv.forEach((v,i)=>{
            const m=L.circleMarker(v,{radius:5,color:'#059669',fillColor:'#34D399',fillOpacity:1,weight:2}).addTo(map);
            activeMarkersRef.current.push(m);
            if(i>0){
              const d=haversine(nv[i-1],v);
              const mid=[(nv[i-1][0]+v[0])/2,(nv[i-1][1]+v[1])/2];
              const lbl=L.tooltip({permanent:true,direction:'center',className:'dist-label'}).setLatLng(mid).setContent(fmtDist(d)).addTo(map);
              activeMarkersRef.current.push(lbl);
            }
          });
          // Area label
          if(nv.length>=3){
            const area=polyAreaM2(nv);
            const centroid=[nv.reduce((s,p)=>s+p[0],0)/nv.length,nv.reduce((s,p)=>s+p[1],0)/nv.length];
            const aLbl=L.tooltip({permanent:true,direction:'center',className:'area-label'}).setLatLng(centroid).setContent(fmtArea(area)+' · '+fmtArea(area*1.43115).replace('m²','v²')).addTo(map);
            activeMarkersRef.current.push(aLbl);
          }
          return nv;
        });
      } else if(measuring){
        const pt=[e.latlng.lat,e.latlng.lng];
        setMeasurePts(prev=>{
          const np=[...prev,pt];
          const mLayer=measureLayerRef.current;if(!mLayer)return np;
          mLayer.clearLayers();
          np.forEach((v,i)=>{
            L.circleMarker(v,{radius:4,color:'#f59e0b',fillColor:'#fbbf24',fillOpacity:1,weight:2}).addTo(mLayer);
            if(i>0){
              L.polyline([np[i-1],v],{color:'#f59e0b',weight:2,dashArray:'4,4'}).addTo(mLayer);
              const d=haversine(np[i-1],v);
              const mid=[(np[i-1][0]+v[0])/2,(np[i-1][1]+v[1])/2];
              L.tooltip({permanent:true,direction:'center',className:'dist-label'}).setLatLng(mid).setContent(fmtDist(d)).addTo(mLayer);
            }
          });
          if(np.length>=2){
            const total=np.reduce((s,v,i)=>i>0?s+haversine(np[i-1],v):0,0);
            L.tooltip({permanent:true,direction:'top',className:'area-label'}).setLatLng(np[np.length-1]).setContent('Total: '+fmtDist(total)).addTo(mLayer);
          }
          return np;
        });
      } else {
        // POT zone identify
        const z=detectZoneKML(e.latlng.lng,e.latlng.lat);
        if(z){
          const zd=ZG[z];
          setClickInfo({lat:e.latlng.lat.toFixed(6),lng:e.latlng.lng.toFixed(6),zone:z,name:zd?.n,ib:zd?.ib,ia:zd?.ia,iau:zd?.iau,hb:zd?.hb,ha:zd?.ha});
        }else{
          setClickInfo({lat:e.latlng.lat.toFixed(6),lng:e.latlng.lng.toFixed(6),zone:null});
        }
      }
    };
    map.on('click',onClick);
    return()=>map.off('click',onClick);
  },[drawing,measuring]);

  // Finish polygon
  const finishPolygon=()=>{
    if(activeVertices.length<3)return;
    const map=mapInstance.current;if(!map)return;
    const area=polyAreaM2(activeVertices);
    const perim=activeVertices.reduce((s,v,i)=>i>0?s+haversine(activeVertices[i-1],v):0,0)+haversine(activeVertices[activeVertices.length-1],activeVertices[0]);
    const zone=detectZoneKML((activeVertices[0][1]+activeVertices[activeVertices.length-1][1])/2,(activeVertices[0][0]+activeVertices[activeVertices.length-1][0])/2);
    // Clean active drawing
    if(activePolyRef.current)map.removeLayer(activePolyRef.current);activePolyRef.current=null;
    activeMarkersRef.current.forEach(m=>map.removeLayer(m));activeMarkersRef.current=[];
    // Create permanent polygon
    const drawLayer=drawLayerRef.current;
    const poly=L.polygon(activeVertices,{color:'#059669',weight:2.5,fillColor:'#34D399',fillOpacity:0.25}).addTo(drawLayer);
    // Labels
    activeVertices.forEach((v,i)=>{
      if(i>0){
        const d=haversine(activeVertices[i-1],v);
        const mid=[(activeVertices[i-1][0]+v[0])/2,(activeVertices[i-1][1]+v[1])/2];
        L.tooltip({permanent:true,direction:'center',className:'dist-label'}).setLatLng(mid).setContent(fmtDist(d)).addTo(drawLayer);
      }
    });
    // Closing segment
    const dClose=haversine(activeVertices[activeVertices.length-1],activeVertices[0]);
    const midClose=[(activeVertices[activeVertices.length-1][0]+activeVertices[0][0])/2,(activeVertices[activeVertices.length-1][1]+activeVertices[0][1])/2];
    L.tooltip({permanent:true,direction:'center',className:'dist-label'}).setLatLng(midClose).setContent(fmtDist(dClose)).addTo(drawLayer);
    // Area label
    const centroid=[activeVertices.reduce((s,p)=>s+p[0],0)/activeVertices.length,activeVertices.reduce((s,p)=>s+p[1],0)/activeVertices.length];
    L.tooltip({permanent:true,direction:'center',className:'area-label'}).setLatLng(centroid).setContent(fmtArea(area)).addTo(drawLayer);
    const id=Date.now();
    setPolygons(prev=>[...prev,{id,vertices:[...activeVertices],area,perim,zone,layerIds:[poly._leaflet_id]}]);
    setActiveVertices([]);
    setDrawing(false);
  };

  const cancelDraw=()=>{
    const map=mapInstance.current;if(!map)return;
    if(activePolyRef.current)map.removeLayer(activePolyRef.current);activePolyRef.current=null;
    activeMarkersRef.current.forEach(m=>map.removeLayer(m));activeMarkersRef.current=[];
    setActiveVertices([]);setDrawing(false);
  };

  const clearAllPolygons=()=>{
    if(drawLayerRef.current)drawLayerRef.current.clearLayers();
    setPolygons([]);
  };

  const clearMeasure=()=>{
    if(measureLayerRef.current)measureLayerRef.current.clearLayers();
    setMeasurePts([]);setMeasuring(false);
  };

  // Search
  const doSearch=async()=>{
    if(!searchQ.trim())return;
    try{
      const r=await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQ+', Guatemala')}&limit=5`);
      const data=await r.json();
      setSearchResults(data.map(d=>({name:d.display_name,lat:+d.lat,lng:+d.lon})));
    }catch{setSearchResults([]);}
  };
  const goToResult=(r)=>{
    const map=mapInstance.current;if(!map)return;
    map.setView([r.lat,r.lng],16);
    if(searchMarkerRef.current)map.removeLayer(searchMarkerRef.current);
    const m=L.marker([r.lat,r.lng]).addTo(map);m._isSearch=true;
    const z=detectZoneKML(r.lng,r.lat);
    m.bindPopup(`<div style="font-family:'DM Sans',sans-serif"><div style="font-weight:700;font-size:12px;margin-bottom:4px">${r.name.split(',')[0]}</div><div style="font-size:11px;color:#64748b">${r.lat.toFixed(5)}, ${r.lng.toFixed(5)}</div>${z?`<div style="margin-top:4px;padding:4px 8px;background:${POT_COLORS[z]};color:white;border-radius:4px;font-size:11px;font-weight:700;text-align:center">${z} — ${ZG[z]?.n}</div>`:''}</div>`).openPopup();
    searchMarkerRef.current=m;
    setSearchResults([]);setSearchQ('');
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Mapa Estratégico</h2>
          <p className="text-xs text-slate-400">Análisis geoespacial · POT Guatemala · {projects.length} proyecto{projects.length!==1?'s':''}</p>
        </div>
        {/* Search */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} onKeyDown={e=>e.key==='Enter'&&doSearch()} placeholder="Buscar ubicación..." className="w-56 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-400 pr-8"/>
            <button onClick={doSearch} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-500"><Ic d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" s={14}/></button>
            {searchResults.length>0&&<div className="absolute top-full mt-1 right-0 w-72 bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-60 overflow-y-auto">{searchResults.map((r,i)=><button key={i} onClick={()=>goToResult(r)} className="w-full text-left px-3 py-2 text-xs hover:bg-emerald-50 border-b border-slate-100 last:border-0"><div className="font-medium text-slate-700 truncate">{r.name.split(',').slice(0,3).join(',')}</div><div className="text-[10px] text-slate-400">{r.lat.toFixed(5)}, {r.lng.toFixed(5)}</div></button>)}</div>}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <button onClick={()=>{const m=mapInstance.current;if(potRef.current&&m){if(potOn)potRef.current.remove();else{potRef.current.addTo(m);}setPotOn(!potOn);}}} className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg border ${potOn?'bg-emerald-50 border-emerald-300 text-emerald-700':'border-slate-200 text-slate-400'}`}>
          POT {potOn?'✓':''}
        </button>
        <button onClick={()=>{const m=mapInstance.current;if(!m||!satRef.current)return;if(satOn){satRef.current.remove();}else{satRef.current.addTo(m);if(potRef.current&&potOn)potRef.current.bringToFront();}setSatOn(!satOn);}} className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg border ${satOn?'bg-blue-50 border-blue-300 text-blue-700':'border-slate-200 text-slate-400'}`}>
          Satélite {satOn?'✓':''}
        </button>
        <button onClick={()=>setPrediosOn(!prediosOn)} className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg border ${prediosOn?'bg-indigo-50 border-indigo-300 text-indigo-700':'border-slate-200 text-slate-400'}`}>
          <span className="inline-flex items-center gap-1"><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="1" width="10" height="10" rx="1.5"/><path d="M4 1v10M8 1v10M1 4h10M1 8h10"/></svg>Predios {prediosOn?'✓':''}</span>
        </button>
        <div className="w-px h-5 bg-slate-200"/>
        {!drawing&&!measuring&&<button onClick={()=>{setDrawing(true);setClickInfo(null);}} className="px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100">
          <span className="inline-flex items-center gap-1"><Ic d="M4 6h16M4 12h8m-8 6h16" s={12}/>Dibujar polígono</span>
        </button>}
        {drawing&&<>
          <span className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-emerald-500 text-white animate-pulse">Dibujando... ({activeVertices.length} pts)</span>
          {activeVertices.length>=3&&<button onClick={finishPolygon} className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">✓ Cerrar polígono</button>}
          <button onClick={cancelDraw} className="px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-red-300 text-red-600 hover:bg-red-50">Cancelar</button>
        </>}
        {!drawing&&!measuring&&<button onClick={()=>{setMeasuring(true);setMeasurePts([]);setClickInfo(null);}} className="px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100">
          <span className="inline-flex items-center gap-1"><Ic d="M3 3h18v18H3z" s={12}/>Medir distancia</span>
        </button>}
        {measuring&&<>
          <span className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-amber-500 text-white animate-pulse">Midiendo... ({measurePts.length} pts)</span>
          <button onClick={clearMeasure} className="px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-red-300 text-red-600 hover:bg-red-50">Terminar</button>
        </>}
        {polygons.length>0&&!drawing&&<button onClick={clearAllPolygons} className="px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-red-200 text-red-500 hover:bg-red-50">Borrar polígonos ({polygons.length})</button>}
        <div className="ml-auto flex gap-2">{Object.entries(POT_COLORS).map(([z,c])=><div key={z} title={z+' — '+ZG[z]?.n} className="flex items-center gap-0.5"><div style={{width:8,height:8,borderRadius:2,background:c}}/><span className="text-[9px] text-slate-400 font-mono">{z}</span></div>)}</div>
      </div>

      {/* Map */}
      <div className="relative">
        <div ref={mapRef} style={{height:'calc(100vh - 220px)',minHeight:450}} className="rounded-2xl border border-slate-200 shadow-sm"/>
        {/* Predios iframe overlay */}
        {prediosOn&&<div className="absolute inset-0 z-[600] flex flex-col rounded-2xl overflow-hidden border border-slate-200 shadow-lg">
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-900 shrink-0">
            <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="rgba(255,255,255,.6)" strokeWidth="1.5"><rect x="1" y="1" width="10" height="10" rx="1.5"/><path d="M4 1v10M8 1v10M1 4h10M1 8h10"/></svg>
            <span className="text-[11px] text-white/70 flex-1">Visor Municipalidad · Consulta de predios, Ciudad de Guatemala</span>
            <button onClick={()=>setPrediosOn(false)} className="px-3 py-1 bg-emerald-500 hover:bg-emerald-600 rounded text-white text-[11px] font-semibold flex items-center gap-1">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="2"><line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/></svg>
              Volver al mapa
            </button>
          </div>
          <iframe src="https://sig.muniguate.com/portal/home/webmap/viewer.html?layers=1f8c3c4e0e3b4094a363825960f389d5" className="flex-1 w-full border-0" allow="geolocation"/>
        </div>}
        {/* Cursor coords */}
        {cursorPos&&<div className="absolute bottom-2 left-2 z-[500] bg-white/90 backdrop-blur-sm px-2 py-1 rounded text-[10px] font-mono text-slate-500 border border-slate-200">{cursorPos[0]}, {cursorPos[1]}</div>}
        {/* Click info panel */}
        {clickInfo&&!drawing&&!measuring&&<div className="absolute top-3 left-3 z-[500] bg-white rounded-xl shadow-lg border border-slate-200 p-3 w-56">
          <div className="flex items-center justify-between mb-2"><span className="text-xs font-bold text-slate-700">Punto seleccionado</span><button onClick={()=>setClickInfo(null)} className="text-slate-300 hover:text-slate-500 text-xs">✕</button></div>
          <div className="text-[10px] font-mono text-slate-400 mb-2">{clickInfo.lat}, {clickInfo.lng}</div>
          {clickInfo.zone?<>
            <div className="px-3 py-2 rounded-lg text-center mb-2" style={{background:POT_COLORS[clickInfo.zone]+'22',border:`1.5px solid ${POT_COLORS[clickInfo.zone]}`}}>
              <div className="text-lg font-bold" style={{color:POT_COLORS[clickInfo.zone],fontFamily:'monospace'}}>{clickInfo.zone}</div>
              <div className="text-[10px] text-slate-600">{clickInfo.name}</div>
            </div>
            <div className="grid grid-cols-3 gap-1 text-[10px]">
              <div className="text-center"><div className="text-slate-400">IE Base</div><div className="font-bold">{clickInfo.ib}</div></div>
              <div className="text-center"><div className="text-slate-400">Ampliado</div><div className="font-bold text-emerald-600">{clickInfo.ia}</div></div>
              <div className="text-center"><div className="text-slate-400">Aumentado</div><div className="font-bold text-amber-600">{clickInfo.iau||'N/A'}</div></div>
            </div>
            <div className="grid grid-cols-2 gap-1 text-[10px] mt-1">
              <div className="text-center"><div className="text-slate-400">Altura base</div><div className="font-bold">{clickInfo.hb}m</div></div>
              <div className="text-center"><div className="text-slate-400">Altura amp.</div><div className="font-bold">{clickInfo.ha}m</div></div>
            </div>
          </>:<div className="text-xs text-slate-400 text-center py-2">Fuera de cobertura POT</div>}
        </div>}
      </div>

      {/* Polygons panel */}
      {polygons.length>0&&<div className="mt-3 bg-white rounded-xl border border-slate-200 p-3">
        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Polígonos dibujados</div>
        <div className="space-y-1">{polygons.map((p,i)=>(
          <div key={p.id} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-emerald-600">Polígono {i+1}</span>
              {p.zone&&<span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded" style={{background:POT_COLORS[p.zone]+'22',color:POT_COLORS[p.zone]}}>{p.zone}</span>}
            </div>
            <div className="flex items-center gap-4 text-[10px] font-mono text-slate-500">
              <span>{fmtArea(p.area)}</span>
              <span>{f0(p.area*1.43115)} v²</span>
              <span>Perímetro: {fmtDist(p.perim)}</span>
              <span>{p.vertices.length} vértices</span>
            </div>
          </div>
        ))}</div>
      </div>}
    </div>
  );
};


// ══════════════════════════════════════════
// PLATFORM (main feasibility tool)
// ══════════════════════════════════════════

export {MapView};
