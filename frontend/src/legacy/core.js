import {POT_POLYS} from '../data/potPolygons.js';
const CD={18:[.10,.03,.03,.03,.04,.04,.04,.06,.08,.06,.05,.05,.05,.07,.07,.08,.06,.06],19:[.10,.01,.02,.03,.03,.04,.04,.06,.07,.06,.04,.05,.06,.06,.07,.08,.07,.06,.05],20:[.10,.01,.01,.02,.03,.04,.04,.07,.06,.05,.04,.05,.06,.06,.06,.07,.06,.06,.05,.06],21:[.10,.01,.01,.01,.02,.03,.04,.05,.07,.06,.06,.05,.04,.05,.05,.06,.07,.06,.05,.06,.05],22:[.10,.01,.01,.02,.02,.02,.03,.03,.04,.05,.07,.06,.05,.04,.05,.06,.07,.07,.05,.06,.05,.04],23:[.10,.01,.01,.01,.02,.02,.03,.03,.04,.04,.05,.07,.06,.05,.05,.04,.05,.06,.07,.05,.04,.05,.05],24:[.10,.01,.01,.01,.02,.02,.02,.03,.03,.03,.04,.07,.05,.06,.05,.04,.04,.05,.06,.07,.05,.04,.05,.05],25:[.10,.01,.01,.01,.01,.01,.02,.02,.02,.05,.03,.07,.05,.05,.05,.04,.04,.05,.06,.07,.05,.04,.05,.05,.04],26:[.10,.01,.01,.01,.01,.01,.02,.02,.03,.05,.03,.06,.05,.04,.04,.03,.05,.05,.06,.07,.05,.04,.05,.03,.04,.04],27:[.10,.005,.01,.005,.01,.01,.02,.02,.03,.04,.03,.06,.05,.03,.04,.04,.05,.05,.05,.06,.05,.04,.04,.03,.04,.04,.05],28:[.10,.005,.01,.005,.01,.01,.02,.02,.03,.03,.03,.04,.05,.07,.02,.05,.04,.03,.03,.04,.04,.05,.07,.03,.04,.04,.05,.04],29:[.10,.005,.01,.005,.01,.01,.02,.02,.02,.03,.03,.04,.05,.06,.02,.05,.04,.04,.03,.03,.04,.04,.05,.06,.04,.03,.04,.04,.04],30:[.10,.005,.01,.005,.01,.02,.02,.02,.03,.03,.04,.05,.06,.04,.04,.03,.03,.02,.02,.03,.03,.04,.04,.05,.06,.04,.03,.03,.03,.04],31:[.10,.005,.005,.005,.005,.01,.02,.02,.03,.03,.03,.04,.05,.03,.03,.03,.03,.03,.02,.03,.04,.04,.05,.06,.07,.04,.03,.03,.03,.04,.02],32:[.10,.005,.005,.005,.005,.01,.02,.02,.03,.03,.03,.04,.05,.03,.03,.03,.03,.03,.02,.03,.04,.04,.05,.06,.07,.04,.03,.03,.02,.03,.03,.01],33:[.10,.005,.005,.005,.005,.01,.01,.02,.025,.03,.035,.04,.05,.03,.03,.03,.03,.03,.02,.03,.04,.04,.05,.06,.07,.04,.03,.03,.02,.03,.03,.01,.01],34:[.10,.005,.005,.005,.005,.01,.01,.015,.02,.025,.03,.035,.04,.02,.025,.025,.03,.03,.03,.035,.04,.045,.055,.06,.07,.05,.03,.03,.02,.03,.03,.02,.01,.01],35:[.10,.005,.005,.005,.005,.01,.01,.015,.02,.025,.03,.035,.04,.02,.025,.025,.03,.03,.03,.035,.04,.045,.055,.06,.07,.05,.03,.03,.02,.03,.03,.02,.01,.005,.005],36:[.10,.005,.005,.005,.005,.01,.01,.015,.02,.025,.03,.035,.04,.02,.025,.025,.03,.03,.03,.035,.04,.04,.045,.05,.06,.06,.05,.03,.02,.03,.03,.02,.01,.005,.005,.005]};
const gCD=d=>{const ks=Object.keys(CD).map(Number).sort((a,b)=>a-b);let b=ks[0];for(const k of ks){if(k<=d)b=k;else break;}return CD[b]||CD[28];};

// ══════════════════════════════════════════
// FINANCIAL ENGINE (identical to v6)
// ══════════════════════════════════════════
const calc=(i)=>{
  const aT=i.frente*i.fondo, aE=aT*i.edificabilidad;
  const pctA=100-i.pctComercio-i.pctOficinas;
  const aCom=aE*(i.pctComercio/100)*(i.pctVendCom/100);
  const aOfi=aE*(i.pctOficinas/100)*(i.pctVendOfi/100);
  const aApt=aE*(pctA/100)*(i.pctVendApt/100);
  const totalVend=aCom+aOfi+aApt, aAmen=aE-totalVend;
  const nApt=i.mixNApt>0?i.mixNApt:Math.floor(aApt/i.tamApto), pApt=i.mixNPk>0?i.mixNPk:Math.floor(i.parqApto*nApt);
  const nOfi=i.uniOfi, aOfiUni=nOfi>0?aOfi/nOfi:0;
  const pOfi=+(i.nPkOfi)||0;
  const pCom=+(i.nPkCom)||0;
  const m2PerPkCom=pCom>0?aCom/pCom:0;
  const m2PerPkOfi=pOfi>0?aOfi/pOfi:0;
  const pVis=Math.ceil(aApt/800*1.5), tParq=pApt+pCom+pOfi+pVis;
  const aSot=i.efSot*tParq;
  const pF=i.perm==="Si"?0.9:1;
  const huellaSotEff=i.huellaSotano>0?i.huellaSotano:aT*pF;
  const cSot=Math.ceil((aSot/huellaSotEff)*2)/2;
  const aConst=aE+aSot, exc=huellaSotEff*cSot*3.2;
  const huellaEdifEff=i.huellaEdificio>0?i.huellaEdificio:aT;
  const niveles=huellaEdifEff>0?Math.ceil(aE/huellaEdifEff):0;
  const alturaTotal=niveles*i.alturaLosa;
  const terrenos=(i.terrenos||[]).map(t=>({...t,areaV2:t.areaM2*1.43115,costo:t.areaM2*1.43115*t.precioVara}));
  const precioTerreno=terrenos.reduce((s,t)=>s+t.costo,0);
  const aTerrTotal=terrenos.reduce((s,t)=>s+t.areaM2,0);
  const cConstBase=i.costoMode==="estimado"
    ? i.costoM2Est * aConst
    : i.acabComOfi*(aCom+aOfi)+i.acabAmen*aAmen+i.acabApt*aApt+i.acabSot*aSot+i.excCosto*exc+(i.ciment+i.equip+i.extrac+i.instElec+i.instHidro+i.obraPrim+i.obraSec)*aConst+i.prelim*aT+(i.frente*i.snFrente+i.fondo*i.snFondo)*3.2*cSot*i.snCosto+(i.frente*i.pilFrente+i.fondo*i.pilFondo)*3.2*cSot*i.pilCosto;
  const cConst=cConstBase*1.12;
  const eqItems=[[i.eqLobby,i.eqLobbyCost],[i.eqTerraza,i.eqTerrazaCost],[i.eqElectro,i.eqElectroCost],[i.eqCocinas,i.eqCocinasCost],[i.eqCCTV,i.eqCCTVCost],[i.eqEspejos,i.eqEspejosCost],[i.eqJardin,i.eqJardinCost],[i.eqSenal,i.eqSenalCost],[i.eqOrnato,i.eqOrnatoCost]];
  const cEquipBase=eqItems.reduce((s,[on,c])=>s+(on?c:0),0)*aConst;
  const cEquip=cEquipBase*1.12;
  const vAptSinImp=i.tamApto*nApt*i.pvM2+pApt*i.pvParq;
  const noi=(((i.rentaM2-i.opexM2)*aCom)+((i.rentaParq-i.costoParq)*pCom))*12;
  const vComSinImp=aCom>0?noi/(i.capRate/100):0;
  const vOfiSinImp=nOfi>0?aOfiUni*nOfi*i.pvOfiM2+pOfi*i.pvParqOfi:0;
  const vProy=vAptSinImp+vComSinImp+vOfiSinImp;
  const vAptConImp=vAptSinImp*1.093,vComConImp=vComSinImp,vOfiConImp=vOfiSinImp*1.093;
  const vProyConImp=vAptConImp+vComConImp+vOfiConImp;
  const timbresIusi=(i.timbresIusi/100)*vProy;
  const cTerr=precioTerreno+timbresIusi;
  const opAdminSI=(i.pctAdminDes/100)*vProy,opTecSI=(i.pctGasTec/100)*vProy,opLicSI=((i.pctLic||1.75)/100)*vProy+(i.iauCost||0);
  const opLegSI=(i.pctGasLeg/100)*vProy,opMercSI=(i.pctMerc/100)*vProy,opAdmVSI=(i.pctAdmVtas/100)*vProy;
  const opComzSI=(i.pctComz/100)*(vAptSinImp+vOfiSinImp);
  const tOpExSI=opAdminSI+opTecSI+opLicSI+opLegSI+opMercSI+opAdmVSI+opComzSI;
  const opAdmin=opAdminSI*1.12,opTec=opTecSI*1.12,opLic=opLicSI;
  const opLeg=opLegSI*1.12,opMerc=opMercSI*1.12,opAdmV=opAdmVSI*1.12,opComz=opComzSI*1.12;
  const tOpEx=opAdmin+opTec+opLic+opLeg+opMerc+opAdmV+opComz;
  const tCostos=cTerr+cConst+cEquip+tOpEx;
  const dur=i.planif+i.const+i.postConst;
  const mBruto=vProy>0?(vProy-cConstBase-cEquipBase-cTerr)/vProy:0;
  const ebitAbs=vProy-cConstBase-cEquipBase-cTerr-tOpExSI;
  const mEBIT=vProy>0?ebitAbs/vProy:0;
  const taxBase=(vAptConImp+vOfiConImp)/1.093;
  const timbres=0.009*taxBase,isrIso=0.03*taxBase,totalTax=timbres+isrIso;
  const isAportado=i.terrAport==="Si";
  const terrAport=isAportado?cTerr:0;
  const tCap=i.capital+terrAport;
  const months=dur+10;
  const mIC=i.planif,mFC=i.planif+i.const,mIV=i.mesIniVtas-1;
  const mesesVta=Math.ceil(nApt/Math.max(i.ritmoVtas,1));
  const costM=new Array(months).fill(0),incM=new Array(months).fill(0);
  const terrPurchM=new Array(months).fill(0); // Track terrain PURCHASE payments separately
  // ALWAYS add terrain purchase payments to cash flow
  for(const t of terrenos){const pagos=t.pagos||[];if(pagos.length>0){for(const p of pagos){const m=p.mes-1;if(m>=0&&m<months){costM[m]+=t.costo*(p.pct/100);terrPurchM[m]+=t.costo*(p.pct/100);}}}else{if(months>0){costM[0]+=t.costo;terrPurchM[0]+=t.costo;}}}
  // IUSI: ALWAYS paid by developer (even when aportado)
  {const iM=Math.max(dur-1,1);const iusiPM=timbresIusi/iM;for(let m=1;m<dur&&m<months;m++)costM[m]+=iusiPM;}
  // Admin desarrollo: evenly across months 0 to mFC-1
  {const admPM=opAdmin/Math.max(mFC,1);for(let m=0;m<mFC&&m<months;m++)costM[m]+=admPM;}
  // Construction distribution curve
  const cd=gCD(i.const);
  // Gastos técnicos: 85% during planning, 15% during construction (matches Excel pattern)
  {const tecPlan=opTec*0.85;const tecConst=opTec*0.15;
  const tecPlanPM=tecPlan/Math.max(mIC,1);for(let m=0;m<mIC&&m<months;m++)costM[m]+=tecPlanPM;
  for(let ci=0;ci<cd.length&&(mIC+ci)<months;ci++)costM[mIC+ci]+=tecConst*cd[ci];}
  // Licencias: opLic/360 per month during planning, bulk at start of construction
  {const licMonthly=opLic/360;for(let m=0;m<Math.min(mIC,months);m++)costM[m]+=licMonthly;
  const licBulk=opLic-licMonthly*mIC;if(mIC<months)costM[mIC]+=Math.max(licBulk,0);}
  // Construction: distributed by CD curve
  for(let ci=0;ci<cd.length&&(mIC+ci)<months;ci++){costM[mIC+ci]+=cConst*cd[ci];}
  // Equipo: last third of construction
  {const eqMonths=Math.max(Math.ceil(i.const/3),1);const eqStart=mFC-eqMonths;const eqPM=cEquip/eqMonths;
  for(let m=Math.max(eqStart,mIC);m<mFC&&m<months;m++)costM[m]+=eqPM;}
  // Gastos legales: during construction period
  {const legPM=opLeg/Math.max(i.const,1);for(let m=mIC;m<mFC&&m<months;m++)costM[m]+=legPM;}
  // Mercadeo: pre-launch + pre-sales + during sales
  if(months>0)costM[0]+=opMerc*0.093;if(mIV-2>=0&&mIV-2<months)costM[mIV-2]+=opMerc*0.185;
  {const mercPM=opMerc*0.722/Math.max(mesesVta,1);for(let m=mIV;m<Math.min(mIV+mesesVta,months);m++)costM[m]+=mercPM;}
  // Admin ventas: evenly from mIV to mFC-1
  {const admSpan=Math.max(mFC-mIV,1);const admvPM=opAdmV/admSpan;for(let m=mIV;m<mFC&&m<months;m++)costM[m]+=admvPM;}
  // Comercialización: 30% reserva / 50% enganche / 20% contra entrega per batch
  {const comApt=(i.pctComz/100)*vAptSinImp*1.12;const cPA=nApt>0?comApt/nApt:0;
  for(let m=mIV;m<Math.min(mIV+mesesVta,months);m++){const sold=Math.min(i.ritmoVtas,nApt-(m-mIV)*i.ritmoVtas);if(sold<=0)break;const bc=sold*cPA;
  costM[m]+=bc*0.30;const mTE=Math.max(mFC-m-1,1);for(let em=m+1;em<Math.min(m+mTE+1,months);em++)costM[em]+=(bc*0.50)/mTE;
  if(mFC-1>=0&&mFC-1<months)costM[mFC-1]+=bc*0.20;}}
  const mVO=Math.ceil(nOfi/Math.max(i.ritmoOfi,1));
  {const comOfi=(i.pctComz/100)*vOfiSinImp*1.12;const cPO=nOfi>0?comOfi/nOfi:0;
  for(let m=mIV;m<Math.min(mIV+mVO,months);m++){const sold=Math.min(i.ritmoOfi,nOfi-(m-mIV)*i.ritmoOfi);if(sold<=0)break;const bc=sold*cPO;
  costM[m]+=bc*0.30;const mTE=Math.max(mFC-m-1,1);for(let em=m+1;em<Math.min(m+mTE+1,months);em++)costM[em]+=(bc*0.50)/mTE;
  if(mFC-1>=0&&mFC-1<months)costM[mFC-1]+=bc*0.20;}}
  const unitPC=nApt>0?vAptConImp/nApt:0;
  // Apt income: reserva + enganche spread + contra entrega by batch across post-construction
  for(let m=mIV;m<Math.min(mIV+mesesVta,months);m++){const sold=Math.min(i.ritmoVtas,nApt-(m-mIV)*i.ritmoVtas);if(sold<=0)break;incM[m]+=sold*unitPC*(i.reserva/100);const engNeto=sold*unitPC*(i.engApt/100)-sold*unitPC*(i.reserva/100);const mTE=Math.max(mFC-m-1,1);for(let em=m+1;em<Math.min(m+mTE+1,months);em++)incM[em]+=engNeto/mTE;const ceAmt=sold*unitPC*(1-i.engApt/100);const bIdx=m-mIV;const ceM=Math.min(mFC+Math.floor(bIdx*Math.max(i.postConst,1)/Math.max(mesesVta,1)),dur-1);if(ceM<months)incM[ceM]+=ceAmt;}
  if(vComConImp>0&&dur-1<months)incM[dur-1]+=vComConImp;
  // Office income: same pattern
  for(let m=mIV;m<Math.min(mIV+mVO,months);m++){const sold=Math.min(i.ritmoOfi,nOfi-(m-mIV)*i.ritmoOfi);if(sold<=0)break;const uP=nOfi>0?vOfiConImp/nOfi:0;incM[m]+=sold*uP*(i.reserva/100);const mTE=Math.max(mFC-m-1,1);for(let em=m+1;em<Math.min(m+mTE+1,months);em++)incM[em]+=(sold*uP*(i.engOfi/100)-sold*uP*(i.reserva/100))/mTE;const ceAmt=sold*uP*(1-i.engOfi/100);const bIdx=m-mIV;const ceM=Math.min(mFC+Math.floor(bIdx*Math.max(i.postConst,1)/Math.max(mVO,1)),dur-1);if(ceM<months)incM[ceM]+=ceAmt;}
  let loanBal=0,capUsed=0,terrFundUsed=0,totInt=0,totalLoanDrawn=0;const mRate=(i.tasaInt/100)/12;const flowBT=new Array(months).fill(0),flowAT=new Array(months).fill(0);
  // Capital estimation: net deficit during PLANNING phase only (before bank loan at mIC)
  let planDef=0,engDuringPlan=0,costDuringPlan=0;
  for(let m=0;m<Math.min(mIC,months);m++){costDuringPlan+=costM[m];engDuringPlan+=incM[m];planDef+=costM[m]-incM[m];}
  const suggestedCapital=isAportado?Math.max(Math.ceil(planDef-terrPurchM.slice(0,mIC).reduce((a,b)=>a+b,0)),0):Math.max(Math.ceil(planDef),0);
  // 3-source simulation: 1) Terrain contribution (if aportado), 2) Capital, 3) Loan
  for(let m=0;m<months;m++){const interest=loanBal*mRate;totInt+=interest;const net=costM[m]+interest-incM[m];
    if(net>0){
      let terrFund=0;
      if(isAportado){terrFund=Math.min(terrPurchM[m],precioTerreno-terrFundUsed,net);terrFundUsed+=terrFund;}
      const afterTerr=net-terrFund;
      const cd2=Math.min(afterTerr,i.capital-capUsed);capUsed+=cd2;
      const ld=afterTerr-cd2;loanBal+=ld;totalLoanDrawn+=ld;
      flowBT[m]=-(cd2+terrFund); // Project-level: both capital + terrain are equity
    }else{const surplus=-net;const repay=Math.min(surplus,loanBal);loanBal-=repay;flowBT[m]=surplus-repay;}}
  let lastPos=months-1;for(let m=months-1;m>=0;m--){if(flowBT[m]>0){lastPos=m;break;}}
  for(let m=0;m<months;m++){flowAT[m]=flowBT[m];if(m===lastPos)flowAT[m]-=totalTax;}
  const xIRR=fl=>{let last=fl.length-1;while(last>0&&Math.abs(fl[last])<0.01)last--;const f=fl.slice(0,last+1);if(f.length<2)return null;let r=0.01;for(let it=0;it<1000;it++){let npv=0,dn=0;for(let t=0;t<f.length;t++){const d=Math.pow(1+r,t);npv+=f[t]/d;dn-=t*f[t]/(d*(1+r));}if(Math.abs(dn)<1e-14)break;const nr=r-npv/dn;if(Math.abs(nr-r)<1e-10){r=nr;break;}r=nr;if(r<-0.99||r>10)return null;}return r;};
  const mBT=xIRR(flowBT),mAT=xIRR(flowAT);
  const airrBT=mBT!==null?Math.pow(1+mBT,12)-1:null,airrAT=mAT!==null?Math.pow(1+mAT,12)-1:null;
  const moicBT=tCap>0?flowBT.reduce((a,b)=>a+b,0)/tCap+1:0,moicAT=tCap>0?flowAT.reduce((a,b)=>a+b,0)/tCap+1:0;
  const utilAntesImp=vProy-cConstBase-cEquipBase-cTerr-tOpExSI-totInt;
  const utilDespImp=utilAntesImp-isrIso;
  return{aT,aE,totalVend,aCom,aOfi,aApt,aAmen,pctA,nApt,pApt,pCom,pOfi,pVis,tParq,aSot,cSot,aConst,exc,niveles,alturaTotal,huellaEdifEff,huellaSotEff,cTerr,cConst,cEquip,tOpEx,tCostos,cConstBase,cEquipBase,tOpExSI,precioTerreno,timbresIusi,aTerrTotal,terrenos,m2PerPkCom,m2PerPkOfi,opAdmin,opTec,opLic,opLeg,opMerc,opAdmV,opComz,opAdminSI,opTecSI,opLicSI,opLegSI,opMercSI,opAdmVSI,opComzSI,vAptSinImp,vComSinImp,vOfiSinImp,vProy,vAptConImp,vComConImp,vOfiConImp,vProyConImp,noi,i_capital:i.capital,terrAport,tCap,prest:totalLoanDrawn,capUsed,terrFundUsed,isAportado,totInt,dur,mBruto,ebitAbs,mEBIT,airrBT,airrAT,moicBT,moicAT,timbres,isrIso,totalTax,utilAntesImp,utilDespImp,pctUtilAntImp:vProy>0?utilAntesImp/vProy:0,pctUtilDespImp:vProy>0?utilDespImp/vProy:0,nOfi,aOfiUni,suggestedCapital,planDef,engDuringPlan,costDuringPlan,costM,incM,flowBT,flowAT,months,mIC,mFC};
};

// ══════════════════════════════════════════
// DEFAULTS
// ══════════════════════════════════════════
const D={
  nombre:"",ubicacion:"",equipo:"",desarrollador:"",lat:14.6349,lng:-90.5069,
  frente:75.03,fondo:75.03,edificabilidad:4,perm:"Si",
  pctComercio:0,pctOficinas:0,pctVendCom:70,pctVendOfi:85,pctVendApt:82,
  tamApto:120.65,parqApto:2,mixNApt:0,mixNPk:0,efSot:30,nPkCom:0,nPkOfi:0,snFrente:1,snFondo:1,pilFrente:1,pilFondo:1,
  huellaEdificio:0,huellaSotano:0,alturaLosa:3.2,
  planif:18,const:28,postConst:4,mesIniVtas:12,ritmoVtas:6,reserva:1.3,engApt:13,
  pvM2:2225,pvParq:19000,rentaM2:15,opexM2:7,rentaParq:135,costoParq:20,capRate:9,
  uniOfi:0,ritmoOfi:1,engOfi:20,pvOfiM2:2200,pvParqOfi:22000,
  timbresIusi:0.8,terrAport:"No",tipoPart:"% de equity",
  costoMode:"detallado",costoM2Est:650,
  terrenos:[{id:1,nombre:"Terreno 1",areaM2:5629.28,pot:"G3",potZone:"G4",precioVara:652,pagos:[{mes:1,pct:20},{mes:7,pct:40},{mes:13,pct:40}]}],
  capital:8700000,tasaInt:8,retPref:10,promoteFee:20,tasaFin:7,plazoMeses:300,tipoCambio:7.7,
  acabComOfi:0,acabAmen:160,acabApt:300,acabSot:14,excCosto:18,ciment:28.89,equip:10.49,extrac:14.07,
  instElec:42,instHidro:42,obraPrim:190,obraSec:53,prelim:40.52,snCosto:220.21,pilCosto:272.66,anticipo:10,
  eqLobby:true,eqLobbyCost:9,eqTerraza:true,eqTerrazaCost:5,eqElectro:true,eqElectroCost:18.6,
  eqCocinas:true,eqCocinasCost:30,eqCCTV:true,eqCCTVCost:2.33,eqEspejos:true,eqEspejosCost:2.26,
  eqJardin:true,eqJardinCost:1.25,eqSenal:true,eqSenalCost:1.11,eqOrnato:true,eqOrnatoCost:0.20,
  incState:{O4:true},incValues:{},mixModels:[],mixAdjust:false,mixUseAdjPct:false,useIECalc:false,iauActive:false,iauP1:0,iauVC:0,iauCost:0,pctLic:1.75,
  pctAdminDes:5.5,pctGasTec:1.5,pctGasLeg:1.5,pctMerc:1.5,pctAdmVtas:1,pctComz:4,
};

const SK="etra-intus-v8";
const f0=n=>n!=null?n.toLocaleString("en-US",{maximumFractionDigits:0}):"—";
const f2=n=>n!=null?n.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}):"—";
const f1=n=>n!=null?n.toLocaleString("en-US",{minimumFractionDigits:1,maximumFractionDigits:1}):"—";
const fp=n=>n!=null?(n*100).toFixed(1)+"%":"—";
const fd=n=>n!=null?"$"+f0(n):"—";

// ══════════════════════════════════════════
// STORAGE — IndexedDB (scalable) with localStorage fallback
// ══════════════════════════════════════════
const IDB_NAME="intus-platform",IDB_VER=1;
const idbOpen=()=>new Promise((res,rej)=>{const r=indexedDB.open(IDB_NAME,IDB_VER);r.onupgradeneeded=e=>{const db=e.target.result;if(!db.objectStoreNames.contains("kv"))db.createObjectStore("kv");};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});
const idbGet=async k=>{const db=await idbOpen();return new Promise((res)=>{const tx=db.transaction("kv","readonly");const st=tx.objectStore("kv");const r=st.get(k);r.onsuccess=()=>res(r.result!==undefined?{value:r.result}:null);r.onerror=()=>res(null);});};
const idbSet=async(k,v)=>{const db=await idbOpen();return new Promise((res)=>{const tx=db.transaction("kv","readwrite");tx.objectStore("kv").put(v,k);tx.oncomplete=()=>res(true);tx.onerror=()=>res(false);});};
const idbDel=async k=>{const db=await idbOpen();return new Promise((res)=>{const tx=db.transaction("kv","readwrite");tx.objectStore("kv").delete(k);tx.oncomplete=()=>res(true);tx.onerror=()=>res(false);});};
const idbAll=async()=>{const db=await idbOpen();return new Promise((res)=>{const tx=db.transaction("kv","readonly");const st=tx.objectStore("kv");const r=st.getAllKeys();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>res([]);});};
// Sync wrapper for backward compat during init
const storage={
  get:k=>{try{const v=localStorage.getItem(k);return v?{value:v}:null;}catch{return null;}},
  set:(k,v)=>{try{localStorage.setItem(k,v);return true;}catch{return false;}}
};
// ══════════════════════════════════════════
// POT ZONES & INCENTIVES DATA
// ══════════════════════════════════════════
const ZG={
  G0:{n:'Zona Rural',ib:.5,ia:1,iau:null,hb:8,ha:10,hau:null,fzg:.006},
  G1:{n:'Zona Suburbana',ib:1,ia:1.6,iau:null,hb:12,ha:16,hau:null,fzg:.006},
  G2:{n:'Semiurbana',ib:1.5,ia:2.4,iau:null,hb:16,ha:24,hau:null,fzg:.009},
  G3:{n:'Urbana baja',ib:2,ia:3.2,iau:null,hb:24,ha:36,hau:null,fzg:.013},
  G4:{n:'Urbana alta',ib:4,ia:6,iau:9,hb:32,ha:48,hau:96,fzg:.020},
  G5:{n:'Metropolitana',ib:6,ia:9,iau:11,hb:64,ha:96,hau:128,fzg:.030}
};
const ZONES=['G0','G1','G2','G3','G4','G5'];
const POT_COLORS={G0:'#2E7D32',G1:'#66BB6A',G2:'#C6CC3A',G3:'#FFD600',G4:'#FF9800',G5:'#E53539'};
const POT_SCALE=100000;

const INCS=[
  {c:'F1',cd:'F-1',n:'Ceder inmuebles a la Muni',fields:[{id:'F1s',l:'% suelo cedido',t:'number'},{id:'F1p',l:'% prop. horizontal',t:'number'}]},
  {c:'O1',cd:'O-1',n:'Unificación de predios',fields:[{id:'O1a',l:'Área unificada (m²)',t:'number'}]},
  {c:'O2',cd:'O-2',n:'APAUP — áreas uso público',fields:[{id:'O2p',l:'% del predio',t:'number'}]},
  {c:'O3',cd:'O-3',n:'Visibilidad fachada 1er piso',fields:[{id:'O3p',l:'% transparencia',t:'number'}]},
  {c:'O4',cd:'O-4',n:'Accesibilidad CONADI',auto:true},
  {c:'O5',cd:'O-5',n:'Superficies permeables públicas',fields:[{id:'O5p',l:'% área permeable',t:'number'},{id:'O5a',l:'Acceso público',t:'select',opts:[['1','Sí'],['0.75','No (75%)']]}]},
  {c:'O6',cd:'O-6',n:'Parqueo extra visitas',fields:[{id:'O6r',l:'% adicional',t:'select',opts:[['0','Sin incentivo'],['5','+25%'],['10','+50%'],['15','+75%']]}]},
  {c:'O7',cd:'O-7',n:'Ensanche aceras',fields:[{id:'O7pr',l:'% predio ampliado',t:'number'},{id:'O7pb',l:'% acera pública',t:'number'}]},
  {c:'U1',cd:'U-1',n:'Cambio a residencial/mixto',fields:[{id:'U1p',l:'% área convertida',t:'number'},{id:'U1c',l:'Uso condicionado eliminado',t:'select',opts:[['0','No'],['10','Sí (+10)']]}]},
  {c:'U2',cd:'U-2',n:'Comercio en primer nivel',fields:[{id:'U2p',l:'% fachada con comercio',t:'number'}]},
  {c:'S1',cd:'S-1',n:'Retención aguas lluvia',fields:[{id:'S1r',l:'% retención adicional',t:'number'},{id:'S1u',l:'Reutilización ≥75%',t:'select',opts:[['0','No'],['20','Sí (+20)']]},{id:'S1i',l:'Infiltración',t:'select',opts:[['0','No'],['5','30%+ (5)'],['10','50%+ (10)'],['20','80%+ (20)']]}]},
  {c:'S2',cd:'S-2',n:'Áreas verdes al aire libre',fields:[{id:'S2p',l:'% del predio',t:'number'}]},
  {c:'S3',cd:'S-3',n:'Certificación sostenible',fields:[{id:'S3t',l:'Nivel',t:'select',opts:[['0','Sin certificación'],['10','LEED Certified / CASA 3★'],['15','LEED Plata / CASA 4★'],['25','LEED Platino / CASA 5★']]}]}
];

// POT polygon helper functions
function decodePoly(flat){
  const pts=[];let x=flat[0]/POT_SCALE,y=flat[1]/POT_SCALE;pts.push([x,y]);
  for(let i=2;i<flat.length;i+=2){x+=flat[i]/POT_SCALE;y+=flat[i+1]/POT_SCALE;pts.push([x,y]);}return pts;
}
function ptInPoly(lng,lat,flat){
  let inside=false;let x0=flat[0]/POT_SCALE,y0=flat[1]/POT_SCALE;
  for(let i=2;i<flat.length;i+=2){const x1=x0+(flat[i]/POT_SCALE),y1=y0+(flat[i+1]/POT_SCALE);
    if(((y0>lat)!=(y1>lat))&&(lng<(x1-x0)*(lat-y0)/(y1-y0)+x0))inside=!inside;x0=x1;y0=y1;}return inside;
}
function detectZoneKML(lng,lat){
  for(const [z,rings] of POT_POLYS){const outer=rings[0];
    if(ptInPoly(lng,lat,outer)){let inHole=false;for(let r=1;r<rings.length;r++){if(ptInPoly(lng,lat,rings[r])){inHole=true;break;}}if(!inHole)return z;}}return null;
}

// Incentive PE calculation
function calcIncPE(zone,incState,incValues){
  const z=ZG[zone];let total=0;
  Object.keys(incState).forEach(c=>{
    if(!incState[c])return;
    const v=k=>(incValues[k]||0);let pts=0;
    if(c==='F1'){const ph=zone==='G3'?2:zone==='G5'?1.5:2.5;pts=v('F1s')*4+(v('F1p')||0)*ph;}
    else if(c==='O1'){const a=v('O1a');if(zone==='G4'){if(a>=2500)pts=25;else if(a>=1500)pts=15+((a-1500)/1000)*10;else if(a>=800)pts=5+((a-800)/700)*10;}else if(zone==='G3'){pts=a>=2500?30:a>=1500?20:a>=800?10:0;}else if(zone==='G5'){pts=a>=2500?20:a>=1500?10:a>=1000?5:0;}}
    else if(c==='O2'){pts=Math.min(v('O2p')*3,30);}
    else if(c==='O3'){const p=v('O3p'),mn=zone==='G3'?35:40,bp=zone==='G2'?10:15;if(p>=mn)pts=bp+(p-mn)*0.5;}
    else if(c==='O4'){pts=zone==='G3'?20:zone==='G5'?10:15;}
    else if(c==='O5'){pts=v('O5p')*4*(v('O5a')||1);}
    else if(c==='O6'){pts=+(v('O6r'));}
    else if(c==='O7'){pts=v('O7pr')*2.5+v('O7pb')*0.75;}
    else if(c==='U1'){const p=v('U1p'),mn=(zone==='G4'||zone==='G5')?35:50,bp=zone==='G5'?10:zone==='G4'?15:20;pts=p>=mn?bp+(v('U1c')||0):0;}
    else if(c==='U2'){const p=v('U2p'),mn=(zone==='G4'||zone==='G5')?40:30,bp=zone==='G2'?7.5:zone==='G3'?15:10;pts=p>=mn?bp:0;}
    else if(c==='S1'){pts=(v('S1r')||0)*.25+(v('S1u')||0)+(v('S1i')||0);}
    else if(c==='S2'){pts=(v('S2p')||0)*.75;}
    else if(c==='S3'){pts=v('S3t')||0;}
    total+=pts;
  });
  const bonus=new Date()<new Date('2026-12-19')?1.2:1;
  return{raw:total,pe:Math.min(total*bonus,100),bonus};
}

// Calculate effective IE from zone + PE
function calcIE(zone,pe){
  const z=ZG[zone];if(!z)return{ie:1,ha:0};
  const ie=Math.min(z.ib+pe*z.fzg,z.ia);
  const ha=z.hb+(ie-z.ib)/(z.ia-z.ib||1)*(z.ha-z.hb);
  return{ie:Math.round(ie*1000)/1000,ha:Math.round(ha),ib:z.ib,ia:z.ia,iau:z.iau,hau:z.hau};
}

// Get highest zone from multiple terrains
function getHighestZone(terrenos){
  const order=['G0','G1','G2','G3','G4','G5'];
  let maxIdx=0;
  (terrenos||[]).forEach(t=>{const idx=order.indexOf(t.potZone||'G4');if(idx>maxIdx)maxIdx=idx;});
  return order[maxIdx];
}



// ══════════════════════════════════════════
// ICONS
// ══════════════════════════════════════════

export {CD,gCD,calc,D,SK,f0,f2,f1,fp,fd,idbGet,idbSet,idbDel,idbAll,storage,ZG,ZONES,POT_COLORS,POT_SCALE,INCS,decodePoly,ptInPoly,detectZoneKML,calcIncPE,calcIE,getHighestZone};
