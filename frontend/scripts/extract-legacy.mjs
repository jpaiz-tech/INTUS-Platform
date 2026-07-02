// Extracts the legacy INTUS Platform single-file HTML app (reference/intus_platform_1.html)
// into ES modules under src/legacy/ and src/data/, preserving the original code byte-for-byte.
// Slices are delimited by unique marker strings; import/export headers are prepended/appended.
// Re-runnable: overwrites the generated files each time.
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const HTML = path.resolve(ROOT, '..', 'reference', 'intus_platform_1.html');

const html = readFileSync(HTML, 'utf8');

// --- isolate the babel script body ---
const scriptOpen = '<script type="text/babel">';
const start = html.indexOf(scriptOpen);
if (start < 0) throw new Error('babel script tag not found');
const end = html.lastIndexOf('</script>');
const code = html.slice(start + scriptOpen.length, end);

// --- markers (must each appear exactly once) ---
const M = {
  logo: 'const IntusLogo=',
  cd: 'const CD={18:',
  pot: 'const POT_POLYS=',
  highestZone: '// Get highest zone',
  icons: 'const Ic=(',
  mapView: 'const MapView=({projects',
  platform: 'const Platform=({pjs',
  referenciales: 'const ReferencialesView=()',
  hub: 'const HubView=({pjs',
  app: 'function App(){',
};
const pos = {};
for (const [k, m] of Object.entries(M)) {
  const i = code.indexOf(m);
  if (i < 0) throw new Error(`marker not found: ${k} (${m})`);
  if (code.indexOf(m, i + 1) >= 0) throw new Error(`marker not unique: ${k} (${m})`);
  pos[k] = i;
}

const slice = (a, b) => code.slice(pos[a], b ? pos[b] : undefined);

const HOOKS = `import {useState,useEffect,useCallback,useMemo,useRef} from 'react';\n`;

// --- src/data/potPolygons.js ---
let potSrc = slice('pot', 'highestZone');
potSrc = potSrc.replace('const POT_POLYS=', 'export const POT_POLYS=');
if (!potSrc.startsWith('export const POT_POLYS=')) throw new Error('POT export rewrite failed');

// --- src/legacy/core.js --- (CD..calcIE + getHighestZone; pure logic + data + storage)
const coreBody = slice('cd', 'pot') + slice('highestZone', 'icons');
const coreHead = `import {POT_POLYS} from '../data/potPolygons.js';\n`;
const coreFoot = `\nexport {CD,gCD,calc,D,SK,f0,f2,f1,fp,fd,idbGet,idbSet,idbDel,idbAll,storage,ZG,ZONES,POT_COLORS,POT_SCALE,INCS,decodePoly,ptInPoly,detectZoneKML,calcIncPE,calcIE,getHighestZone};\n`;

// --- src/legacy/ui.jsx --- (IntusLogo + icons + shared UI components + TerrainTable)
const uiBody = slice('logo', 'cd') + slice('icons', 'mapView');
const uiHead =
  HOOKS +
  `import {f0,f1,f2,fp,fd,ZG,ZONES,POT_COLORS,calc,D} from './core.js';\n`;
const uiFoot = `\nexport {IntusLogo,Ic,ic,fmtNum,parseNum,In,R,Card,Sub,MC,PL,Toggle,TerrainTable};\n`;

// --- src/legacy/MapView.jsx ---
const mapBody = slice('mapView', 'platform');
const mapHead =
  HOOKS +
  `import L from 'leaflet';\n` +
  `import 'leaflet/dist/leaflet.css';\n` +
  `import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';\n` +
  `import markerIcon from 'leaflet/dist/images/marker-icon.png';\n` +
  `import markerShadow from 'leaflet/dist/images/marker-shadow.png';\n` +
  `import {calc,D,f0,f1,f2,fp,fd,ZG,POT_COLORS,detectZoneKML,decodePoly} from './core.js';\n` +
  `import {POT_POLYS} from '../data/potPolygons.js';\n` +
  `import {Ic,ic} from './ui.jsx';\n` +
  `// Vite bundling breaks Leaflet's default icon URL detection — restore explicitly\n` +
  `delete L.Icon.Default.prototype._getIconUrl;\n` +
  `L.Icon.Default.mergeOptions({iconRetinaUrl:markerIcon2x,iconUrl:markerIcon,shadowUrl:markerShadow});\n`;
const mapFoot = `\nexport {MapView};\n`;

// --- src/legacy/Platform.jsx ---
const platBody = slice('platform', 'referenciales');
const platHead =
  HOOKS +
  `import {CD,gCD,calc,D,SK,f0,f1,f2,fp,fd,ZG,ZONES,POT_COLORS,INCS,calcIncPE,calcIE,getHighestZone} from './core.js';\n` +
  `import {IntusLogo,Ic,ic,fmtNum,parseNum,In,R,Card,Sub,MC,PL,Toggle,TerrainTable} from './ui.jsx';\n`;
// REF_DATA + label/category tables live between Platform and ReferencialesView
// in the source, so they land in this slice — export them for Referenciales.jsx.
const platFoot = `\nexport {Platform,REF_DATA,REF_CATEGORIES,REF_CONST_LABELS,REF_EQUIP_LABELS,REF_TECH_LABELS,REF_CHAR_LABELS};\n`;

// --- src/legacy/Referenciales.jsx ---
const refBody = slice('referenciales', 'hub');
const refHead =
  HOOKS +
  `import {f0,f1,f2,fp,fd} from './core.js';\n` +
  `import {Ic,ic,Card,Sub} from './ui.jsx';\n` +
  `import {REF_DATA,REF_CATEGORIES,REF_CONST_LABELS,REF_EQUIP_LABELS,REF_TECH_LABELS,REF_CHAR_LABELS} from './Platform.jsx';\n`;
const refFoot = `\nexport {ReferencialesView};\n`;

// --- src/legacy/Hub.jsx ---
const hubBody = slice('hub', 'app');
const hubHead =
  HOOKS +
  `import {calc,D,f0,f1,f2,fp,fd} from './core.js';\n` +
  `import {IntusLogo,Ic,ic} from './ui.jsx';\n`;
const hubFoot = `\nexport {HubView};\n`;

mkdirSync(path.join(ROOT, 'src', 'data'), { recursive: true });
mkdirSync(path.join(ROOT, 'src', 'legacy'), { recursive: true });

const out = [
  ['src/data/potPolygons.js', potSrc],
  ['src/legacy/core.js', coreHead + coreBody + coreFoot],
  ['src/legacy/ui.jsx', uiHead + uiBody + uiFoot],
  ['src/legacy/MapView.jsx', mapHead + mapBody + mapFoot],
  ['src/legacy/Platform.jsx', platHead + platBody + platFoot],
  ['src/legacy/Referenciales.jsx', refHead + refBody + refFoot],
  ['src/legacy/Hub.jsx', hubHead + hubBody + hubFoot],
];
for (const [rel, content] of out) {
  writeFileSync(path.join(ROOT, rel), content, 'utf8');
  console.log(`wrote ${rel} (${(content.length / 1024).toFixed(1)}KB)`);
}
console.log('extract OK');
