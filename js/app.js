// Standalone Molekül Stüdyosu Mantığı
const STORAGE_KEY = 'molekul_study_lab_v1';
let glViewer = null;
let activeModel = null;
let currentSdfData = '';
let currentStyle = 'ballAndStick';
let isSpinning = true;
let currentMolInfo = {
  name: 'Caffeine',
  trName: 'Kafein',
  formula: 'C8H10N4O2',
  weight: '194.19 g/mol',
  iupac: '1,3,7-trimethylpurine-2,6-dione',
  cid: 2519
};

// 1. 3Dmol Sahnesini Başlat
function init3DmolViewer() {
  const container = document.getElementById('g3d-viewport');
  if (!container || typeof $3Dmol === 'undefined') return;

  container.innerHTML = '';
  const config = { backgroundColor: '#ffffff' };
  glViewer = $3Dmol.createViewer(container, config);
}

// 2. Molekül Verisi Çek ve Yükle (Doğrudan PubChem API)
async function loadMolecule(name, trName = '') {
  showLoading(true, `"${trName || name}" 3D koordinatları PubChem'den çekiliyor...`);

  try {
    const cleanName = (name || '').trim();
    if (!cleanName) throw new Error('Geçersiz molekül adı');

    const encoded = encodeURIComponent(cleanName);

    // Tarayıcı fetch kuralları gereği User-Agent başlığı gönderilmez (Forbidden Header).
    // Doğrudan PubChem açık API'sine CORS üzerinden erişim:
    const propUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encoded}/property/MolecularFormula,MolecularWeight,IUPACName,CanonicalSMILES/JSON`;
    const sdfUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encoded}/SDF?record_type=3d`;

    const [propRes, sdfRes] = await Promise.all([
      fetch(propUrl),
      fetch(sdfUrl)
    ]);

    if (!sdfRes.ok) {
      throw new Error(`PubChem'de "${cleanName}" için 3D koordinat bulunamadı (HTTP ${sdfRes.status})`);
    }

    const sdfText = await sdfRes.text();
    let propData = {};
    if (propRes.ok) {
      try {
        propData = await propRes.json();
      } catch (e) {
        console.warn('Property JSON parse error:', e);
      }
    }

    const p = propData.PropertyTable?.Properties?.[0] || {};

    currentSdfData = sdfText;
    currentMolInfo = {
      name: cleanName,
      trName: trName || cleanName,
      formula: p.MolecularFormula || 'Bileşik',
      weight: p.MolecularWeight ? p.MolecularWeight + ' g/mol' : '-',
      iupac: p.IUPACName || cleanName,
      cid: p.CID || '-'
    };

    updateInfoCard();
    renderModelInViewer(sdfText);
    updateSaveButtonState();
  } catch(err) {
    console.error('loadMolecule error:', err);
    showToast('Molekül yüklenemedi: ' + err.message);
  } finally {
    showLoading(false);
  }
}

function renderModelInViewer(sdf) {
  if (!glViewer) init3DmolViewer();
  if (!glViewer) return;

  glViewer.clear();
  activeModel = glViewer.addModel(sdf, 'sdf');
  applyCurrentStyle();
  glViewer.zoomTo();
  glViewer.render();

  if (isSpinning) {
    glViewer.spin('y', 1.0);
  }
}

function applyCurrentStyle() {
  if (!glViewer || !activeModel) return;

  activeModel.setStyle({}, {}); // Temizle

  if (currentStyle === 'ballAndStick') {
    activeModel.setStyle({}, {
      stick: { radius: 0.16, colorscheme: 'Jmol' },
      sphere: { scale: 0.32, colorscheme: 'Jmol' }
    });
  } else if (currentStyle === 'sphere') {
    activeModel.setStyle({}, {
      sphere: { scale: 0.85, colorscheme: 'Jmol' }
    });
  } else if (currentStyle === 'stick') {
    activeModel.setStyle({}, {
      stick: { radius: 0.28, colorscheme: 'Jmol' }
    });
  } else if (currentStyle === 'wireframe') {
    activeModel.setStyle({}, {
      line: { linewidth: 2.5, colorscheme: 'Jmol' }
    });
  }

  glViewer.render();
}

function setRenderStyle(style) {
  currentStyle = style;
  ['ballAndStick', 'sphere', 'stick', 'wireframe'].forEach(s => {
    const btn = document.getElementById('btn-st-' + s);
    if (!btn) return;
    if (s === style) {
      btn.className = 'style-btn px-3 py-1 rounded-lg font-bold bg-teal-500 text-slate-950 transition shadow';
    } else {
      btn.className = 'style-btn px-3 py-1 rounded-lg font-bold text-mistral-slate hover:text-white transition';
    }
  });
  applyCurrentStyle();
}

function toggleSpin() {
  if (!glViewer) return;
  isSpinning = !isSpinning;
  const label = document.getElementById('label-spin');

  if (isSpinning) {
    glViewer.spin('y', 1.0);
    if (label) label.innerText = 'Döndür: Açık';
  } else {
    glViewer.spin(false);
    if (label) label.innerText = 'Döndür: Kapalı';
  }
}

function resetCamera() {
  if (!glViewer) return;
  glViewer.zoomTo();
  glViewer.render();
}

// 3. Bilgi Kartlarını Güncelle
function updateInfoCard() {
  const elDisplayName = document.getElementById('mol-display-name');
  const elDisplayIupac = document.getElementById('mol-display-iupac');
  const elBadgeFormula = document.getElementById('mol-badge-formula');
  const elBadgeWeight = document.getElementById('mol-badge-weight');
  const elStatFormula = document.getElementById('stat-formula');
  const elStatWeight = document.getElementById('stat-weight');
  const elStatCid = document.getElementById('stat-cid');
  const elStatAtoms = document.getElementById('stat-atoms');

  if (elDisplayName) elDisplayName.innerText = currentMolInfo.trName || currentMolInfo.name;
  if (elDisplayIupac) elDisplayIupac.innerText = currentMolInfo.iupac;
  if (elBadgeFormula) elBadgeFormula.innerText = currentMolInfo.formula;
  if (elBadgeWeight) elBadgeWeight.innerText = currentMolInfo.weight;
  if (elStatFormula) elStatFormula.innerText = currentMolInfo.formula;
  if (elStatWeight) elStatWeight.innerText = currentMolInfo.weight;
  if (elStatCid) elStatCid.innerText = currentMolInfo.cid;

  // Atom sayısını SDF'den kabaca hesapla
  const lines = currentSdfData.split('\n');
  let atomCount = 0;
  if (lines.length > 3) {
    const countsLine = lines[3].trim().split(/\s+/);
    atomCount = parseInt(countsLine[0]) || 0;
  }
  if (elStatAtoms) elStatAtoms.innerText = atomCount > 0 ? (atomCount + ' Atom') : '3D Model';
}

function loadPresetMolecule(engName, trName, formula) {
  const input = document.getElementById('input-mol-search');
  if (input) input.value = engName;
  loadMolecule(engName, trName);
}

function searchMolecule() {
  const input = document.getElementById('input-mol-search');
  const q = (input ? input.value : '').trim();
  if (!q) return;
  loadMolecule(q, q);
}

function showLoading(show, msg = '') {
  const box = document.getElementById('mol-loading');
  const txt = document.getElementById('mol-loading-msg');
  if (!box) return;
  if (show) {
    box.classList.remove('hidden');
    if (msg && txt) txt.innerText = msg;
  } else {
    box.classList.add('hidden');
  }
}

// 4. Kişisel Laboratuvarım (LocalStorage)
function getSavedMolecules() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter(m => m && (m.name || m.trName)) : [];
  } catch(e) {
    return [];
  }
}

function toggleSaveMolecule() {
  if (!currentMolInfo || (!currentMolInfo.name && !currentMolInfo.trName)) return;
  const cName = String(currentMolInfo.name || currentMolInfo.trName).toLowerCase();
  let list = getSavedMolecules();
  const exists = list.some(m => m && String(m.name || m.trName || '').toLowerCase() === cName);

  if (exists) {
    list = list.filter(m => m && String(m.name || m.trName || '').toLowerCase() !== cName);
    showToast('Molekül laboratuvardan çıkarıldı.');
  } else {
    list.unshift({
      name: currentMolInfo.name || currentMolInfo.trName,
      trName: currentMolInfo.trName || currentMolInfo.name,
      formula: currentMolInfo.formula || '',
      cid: currentMolInfo.cid || '',
      date: new Date().toLocaleDateString('tr-TR')
    });
    showToast(`✓ "${currentMolInfo.trName || currentMolInfo.name}" laboratuvarınıza kaydedildi!`);
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  updateSaveButtonState();
  renderShelf();
}

function updateSaveButtonState() {
  const list = getSavedMolecules();
  const cName = (currentMolInfo && (currentMolInfo.name || currentMolInfo.trName)) ? String(currentMolInfo.name || currentMolInfo.trName).toLowerCase() : '';
  const exists = cName ? list.some(m => m && String(m.name || m.trName || '').toLowerCase() === cName) : false;
  const star = document.getElementById('star-icon');
  const label = document.getElementById('label-save-mol');

  if (star && label) {
    if (exists) {
      star.innerText = '✓';
      label.innerText = 'Laboratuvarınızda Kayıtlı';
    } else {
      star.innerText = '🔖';
      label.innerText = 'Laboratuvarıma Kaydet';
    }
  }
}

function renderShelf() {
  const grid = document.getElementById('mol-shelf-grid');
  const empty = document.getElementById('mol-shelf-empty');
  if (!grid) return;
  const list = getSavedMolecules();

  if (list.length === 0) {
    grid.innerHTML = '';
    if (empty) empty.classList.remove('hidden');
    return;
  }

  if (empty) empty.classList.add('hidden');
  grid.innerHTML = list.map(m => {
    const mName = String(m.name || m.trName || '').replace(/'/g, "\\'");
    const mTr = String(m.trName || m.name || '').replace(/'/g, "\\'");
    return `
      <div class="p-3 rounded-xl bg-white border border-mistral-hairline hover:border-teal-500/50 transition cursor-pointer flex flex-col justify-between" onclick="loadMolecule('${mName}', '${mTr}')">
        <div>
          <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-mistral-cream text-mistral-ink border border-mistral-beige-deep">${m.formula || '3D'}</span>
          <h4 class="font-bold text-xs text-mistral-ink truncate mt-2 hover:text-teal-600">${m.trName || m.name}</h4>
          <p class="text-[10px] text-mistral-slate font-mono mt-0.5">CID: ${m.cid || '-'}</p>
        </div>
        <div class="pt-2 border-t border-mistral-hairline flex items-center justify-between mt-2.5 text-xs">
          <span class="text-teal-600 font-bold text-[10px]">3D Aç &rarr;</span>
          <button onclick="event.stopPropagation(); removeMolecule('${mName}')" class="text-mistral-slate hover:text-rose-500 text-xs">✕</button>
        </div>
      </div>
    `;
  }).join('');
}

function removeMolecule(name) {
  if (!name) return;
  const target = String(name).toLowerCase();
  let list = getSavedMolecules();
  list = list.filter(m => m && String(m.name || m.trName || '').toLowerCase() !== target);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  updateSaveButtonState();
  renderShelf();
}

function clearSavedMolecules() {
  if (!confirm('Laboratuvarınızdaki tüm kayıtları silmek istediğinize emin misiniz?')) return;

  localStorage.removeItem(STORAGE_KEY);
  updateSaveButtonState();
  renderShelf();
  showToast('Laboratuvar temizlendi.');
}

function showToast(msg) {
  const toast = document.getElementById('mol-toast');
  if (!toast) return;
  toast.innerText = msg;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3500);
}

document.addEventListener('DOMContentLoaded', () => {
  init3DmolViewer();
  renderShelf();
  loadMolecule('caffeine', 'Kafein');
});

// Window globals for inline onclicks
window.setRenderStyle = setRenderStyle;
window.toggleSpin = toggleSpin;
window.resetCamera = resetCamera;
window.loadPresetMolecule = loadPresetMolecule;
window.searchMolecule = searchMolecule;
window.toggleSaveMolecule = toggleSaveMolecule;
window.clearSavedMolecules = clearSavedMolecules;
window.removeMolecule = removeMolecule;
window.loadMolecule = loadMolecule;
