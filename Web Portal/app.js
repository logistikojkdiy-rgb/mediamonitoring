const STORAGE_KEY = 'ojk_diy_medmon_pin_v1';

const state = {
  pin: '',
  index: null,
  currentEditionId: null,
  editionData: null,
  filterBidang: 'Semua',
  filterTone: 'Semua',
  searchQuery: ''
};

const els = {
  gate: document.getElementById('gate'),
  app: document.getElementById('app'),
  unlockForm: document.getElementById('unlock-form'),
  pinInput: document.getElementById('pin-input'),
  togglePin: document.getElementById('toggle-pin'),
  rememberPin: document.getElementById('remember-pin'),
  gateError: document.getElementById('gate-error'),
  unlockBtn: document.getElementById('unlock-btn'),
  lockBtn: document.getElementById('lock-btn'),
  editionSelect: document.getElementById('edition-select'),
  editionTitle: document.getElementById('edition-title'),
  editionSubtitle: document.getElementById('edition-subtitle'),
  toneMeterBar: document.getElementById('tone-meter-bar'),
  toneLegend: document.getElementById('tone-legend'),
  searchInput: document.getElementById('search-input'),
  toneFilters: document.getElementById('tone-filters'),
  bidangTabs: document.getElementById('bidang-tabs'),
  leadSection: document.getElementById('lead-section'),
  newsFeed: document.getElementById('news-feed'),
  conclusionBody: document.getElementById('conclusion-body'),
  mediaTbody: document.getElementById('media-tbody'),
  footerUpdated: document.getElementById('footer-updated'),
  drawerBackdrop: document.getElementById('reader-backdrop'),
  drawer: document.getElementById('reader-drawer'),
  drawerClose: document.getElementById('drawer-close'),
  drawerKanal: document.getElementById('drawer-kanal'),
  drawerBidang: document.getElementById('drawer-bidang'),
  drawerThumbWrap: document.getElementById('drawer-thumb-wrap'),
  drawerTitle: document.getElementById('drawer-title'),
  drawerMeta: document.getElementById('drawer-meta'),
  drawerBody: document.getElementById('drawer-body'),
  drawerTone: document.getElementById('drawer-tone'),
  drawerUrl: document.getElementById('drawer-url')
};

function b64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function decryptPayload(encObj, passphrase) {
  const salt = b64ToBytes(encObj.salt);
  const iv = b64ToBytes(encObj.iv);
  const ct = b64ToBytes(encObj.ct);
  const macExpected = b64ToBytes(encObj.mac);

  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: encObj.iter || 100000, hash: 'SHA-256' },
    baseKey,
    512
  );
  const rawBytes = new Uint8Array(bits);
  const aesKeyBytes = rawBytes.slice(0, 32);
  const macKeyBytes = rawBytes.slice(32, 64);

  // Verifikasi HMAC-SHA256 terlebih dahulu (Encrypt-then-MAC)
  const macInput = new Uint8Array(iv.length + ct.length);
  macInput.set(iv, 0);
  macInput.set(ct, iv.length);

  const macKey = await crypto.subtle.importKey(
    'raw',
    macKeyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
  const valid = await crypto.subtle.verify('HMAC', macKey, macExpected, macInput);
  if (!valid) throw new Error('Kode akses tidak cocok.');

  const aesKey = await crypto.subtle.importKey(
    'raw',
    aesKeyBytes,
    { name: 'AES-CBC' },
    false,
    ['decrypt']
  );
  const plainBuf = await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, aesKey, ct);
  return JSON.parse(new TextDecoder().decode(plainBuf));
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toneClass(tone) {
  if (tone === 'Positif') return 'tone-Positif';
  if (tone === 'Cenderung Negatif') return 'tone-CenderungNegatif';
  if (tone === 'Negatif') return 'tone-Negatif';
  return 'tone-Netral';
}

function thumbModifier(item) {
  const url = item.Thumbnail || '';
  const name = url.split('/').pop() || '';
  if (/^1COJK/i.test(name) || /logo_lldikti/i.test(name)) return 'thumb-logo';
  if (item.Kanal === 'Instagram') return 'thumb-ig';
  return '';
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Gagal memuat ${url}`);
  return res.json();
}

async function loadEdition(editionId, pin) {
  const entry = state.index.editions.find(e => e.id === editionId) || state.index.editions[0];
  if (!entry) throw new Error('Belum ada edisi laporan yang tersedia.');

  const encObj = await fetchJson(entry.file);
  const data = await decryptPayload(encObj, pin);
  state.currentEditionId = entry.id;
  state.editionData = data;
  state.filterBidang = 'Semua';
  state.filterTone = 'Semua';
  state.searchQuery = '';
  els.searchInput.value = '';

  renderEdition();
}

function renderEdition() {
  const d = state.editionData;
  els.editionSelect.value = d.id;
  els.editionTitle.textContent = `Edisi ${d.hariTanggal}`;
  els.editionSubtitle.textContent = `Rekap ${d.statistik.total} berita sektor jasa keuangan dan ekonomi Daerah Istimewa Yogyakarta.`;

  // Tone Meter
  const total = d.statistik.total || 1;
  const segs = [
    { cls: 'pos', label: 'Positif', count: d.statistik.positif || 0, dot: 'dot-pos' },
    { cls: 'net', label: 'Netral', count: d.statistik.netral || 0, dot: 'dot-net' },
    { cls: 'cneg', label: 'Cenderung Negatif', count: d.statistik.cenderungNegatif || 0, dot: 'dot-cneg' },
    { cls: 'neg', label: 'Negatif', count: d.statistik.negatif || 0, dot: 'dot-neg' }
  ].filter(s => s.count > 0);

  els.toneMeterBar.innerHTML = segs
    .map(s => `<div class="tone-seg ${s.cls}" style="width:${(s.count / total) * 100}%"></div>`)
    .join('');
  els.toneLegend.innerHTML = segs
    .map(s => `<span class="legend-item"><span class="dot ${s.dot}"></span>${s.label}: ${s.count}</span>`)
    .join('');

  // Bidang Tabs
  const bidangs = ['Semua', ...new Set(d.berita.map(b => b.Bidang))];
  els.bidangTabs.innerHTML = bidangs
    .map(b => `<button type="button" class="tab-btn ${b === state.filterBidang ? 'active' : ''}" data-bidang="${escapeHtml(b)}">${escapeHtml(b)}</button>`)
    .join('');

  // Kesimpulan
  els.conclusionBody.innerHTML = (d.kesimpulan || []).map(p => `<p>${escapeHtml(p)}</p>`).join('');

  // Tabel Media Massa
  const mediaMap = new Map();
  for (const item of d.berita) {
    if (!mediaMap.has(item.Media)) {
      mediaMap.set(item.Media, { name: item.Media, kanals: new Set(), count: 0, tones: {} });
    }
    const m = mediaMap.get(item.Media);
    m.kanals.add(item.Kanal);
    m.count += 1;
    m.tones[item.Tone] = (m.tones[item.Tone] || 0) + 1;
  }
  const mediaRows = [...mediaMap.values()].sort((a, b) => b.count - a.count);
  els.mediaTbody.innerHTML = mediaRows.map(m => {
    const domTone = Object.entries(m.tones).sort((a, b) => b[1] - a[1])[0][0];
    return `<tr>
      <td><strong>${escapeHtml(m.name)}</strong></td>
      <td>${escapeHtml([...m.kanals].join(', '))}</td>
      <td class="num-col">${m.count} Berita</td>
      <td><span class="tone-label ${toneClass(domTone)}">${escapeHtml(domTone)}</span></td>
    </tr>`;
  }).join('') + `<tr class="total-row">
    <td>Total (${mediaRows.length} Media)</td>
    <td>${escapeHtml([...new Set(d.berita.map(x => x.Kanal))].join(', '))}</td>
    <td class="num-col">${d.berita.length} Berita</td>
    <td>${segs.map(s => `${s.label} (${s.count})`).join(' · ')}</td>
  </tr>`;

  els.footerUpdated.textContent = `Diperbarui ${d.diperbarui}`;
  renderFilteredNews();
}

function renderFilteredNews() {
  const d = state.editionData;
  const q = state.searchQuery.trim().toLowerCase();

  const filtered = d.berita.filter(item => {
    if (state.filterBidang !== 'Semua' && item.Bidang !== state.filterBidang) return false;
    if (state.filterTone !== 'Semua' && item.Tone !== state.filterTone) return false;
    if (q) {
      const hay = `${item.Judul} ${item.Media} ${item.Bidang} ${item.Ringkasan1} ${item.Ringkasan2}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  // Lead Story hanya tampil jika filter default & ada berita
  const showLead = state.filterBidang === 'Semua' && state.filterTone === 'Semua' && !q && filtered.length > 0;
  let listItems = filtered;

  if (showLead) {
    const lead = filtered[0];
    listItems = filtered.slice(1);
    const tMod = thumbModifier(lead);
    els.leadSection.hidden = false;
    els.leadSection.innerHTML = `
      <article class="lead-card">
        <div>
          <div class="lead-meta-row">
            <span class="badge-kanal">${escapeHtml(lead.Kanal)}</span>
            <span class="badge-bidang">${escapeHtml(lead.Bidang)}</span>
            <span class="tone-label ${toneClass(lead.Tone)}">${escapeHtml(lead.Tone)}</span>
          </div>
          <h2 class="lead-title">${escapeHtml(lead.Judul)}</h2>
          <p class="lead-summary">${escapeHtml(lead.Ringkasan1)}</p>
          <div class="lead-actions">
            <button type="button" class="btn-primary open-reader" data-no="${lead.No}">Baca Ringkasan Lengkap</button>
            <a href="${escapeHtml(lead.Url)}" target="_blank" rel="noopener noreferrer" class="btn-secondary">Buka ${escapeHtml(lead.Media)}</a>
          </div>
        </div>
        ${lead.Thumbnail ? `<div class="lead-thumb ${tMod}"><img src="${escapeHtml(lead.Thumbnail)}" alt="${escapeHtml(lead.Judul)}" loading="lazy" /></div>` : ''}
      </article>
    `;
  } else {
    els.leadSection.hidden = true;
    els.leadSection.innerHTML = '';
  }

  if (filtered.length === 0) {
    els.newsFeed.innerHTML = `<div class="empty-state">Tidak ada berita yang cocok dengan filter atau pencarian saat ini.</div>`;
    return;
  }

  // Kelompokkan listItems berdasarkan Bidang (tetap menjaga urutan OJK teratas)
  const grouped = new Map();
  for (const it of listItems) {
    if (!grouped.has(it.Bidang)) grouped.set(it.Bidang, []);
    grouped.get(it.Bidang).push(it);
  }

  let html = '';
  for (const [bidang, arr] of grouped.entries()) {
    html += `
      <div class="bidang-group">
        <div class="bidang-header">
          <h3 class="bidang-title">${escapeHtml(bidang)}</h3>
          <span class="bidang-count">${arr.length} berita</span>
        </div>
        <div class="news-list">
          ${arr.map(it => {
            const tMod = thumbModifier(it);
            return `
              <article class="news-row">
                <div class="news-num">${String(it.No).padStart(2, '0')}</div>
                <div>
                  <div class="news-meta">
                    <span class="news-media-name">${escapeHtml(it.Media)}</span>
                    <span>·</span>
                    <span>${escapeHtml(it.Kanal)}</span>
                    <span>·</span>
                    <span class="tone-label ${toneClass(it.Tone)}">${escapeHtml(it.Tone)}</span>
                    <span>·</span>
                    <span>${escapeHtml(it.Tanggal)}</span>
                  </div>
                  <h4 class="news-headline">${escapeHtml(it.Judul)}</h4>
                  <p class="news-excerpt">${escapeHtml(it.Ringkasan1)}</p>
                  <div class="news-links">
                    <button type="button" class="link-action open-reader" data-no="${it.No}">Baca Ringkasan</button>
                    <a href="${escapeHtml(it.Url)}" target="_blank" rel="noopener noreferrer" class="link-source">
                      <span>Buka Sumber Asli</span>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M7 17 17 7" /><path d="M7 7h10v10" />
                      </svg>
                    </a>
                  </div>
                </div>
                ${it.Thumbnail ? `<div class="news-thumb ${tMod}"><img src="${escapeHtml(it.Thumbnail)}" alt="" loading="lazy" /></div>` : '<div></div>'}
              </article>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  els.newsFeed.innerHTML = html;
}

function openReader(no) {
  const item = state.editionData.berita.find(b => b.No === Number(no));
  if (!item) return;

  els.drawerKanal.textContent = item.Kanal;
  els.drawerBidang.textContent = item.Bidang;
  els.drawerTitle.textContent = item.Judul;
  els.drawerMeta.textContent = `${item.Media} · ${item.Tanggal}`;
  els.drawerBody.innerHTML = `<p>${escapeHtml(item.Ringkasan1)}</p><p>${escapeHtml(item.Ringkasan2)}</p>`;
  els.drawerTone.innerHTML = `Tone: <span class="tone-label ${toneClass(item.Tone)}">${escapeHtml(item.Tone)}</span>`;
  els.drawerUrl.href = item.Url;

  if (item.Thumbnail) {
    els.drawerThumbWrap.hidden = false;
    els.drawerThumbWrap.innerHTML = `<img src="${escapeHtml(item.Thumbnail)}" alt="${escapeHtml(item.Judul)}" />`;
  } else {
    els.drawerThumbWrap.hidden = true;
    els.drawerThumbWrap.innerHTML = '';
  }

  els.drawerBackdrop.hidden = false;
  els.drawer.hidden = false;
  document.body.style.overflow = 'hidden';
  els.drawerClose.focus();
}

function closeReader() {
  els.drawerBackdrop.hidden = true;
  els.drawer.hidden = true;
  document.body.style.overflow = '';
}

async function tryUnlock(pin, remember) {
  els.gateError.hidden = true;
  els.unlockBtn.disabled = true;
  els.unlockBtn.textContent = 'Membuka...';

  try {
    if (!state.index) {
      state.index = await fetchJson('data/indeks.json');
      els.editionSelect.innerHTML = state.index.editions
        .map(e => `<option value="${escapeHtml(e.id)}">${escapeHtml(e.hariTanggal)} (${e.total})</option>`)
        .join('');
    }
    const targetId = new URLSearchParams(window.location.search).get('edisi') || state.index.editions[0].id;
    await loadEdition(targetId, pin);
    state.pin = pin;

    if (remember) localStorage.setItem(STORAGE_KEY, pin);
    else localStorage.removeItem(STORAGE_KEY);

    els.gate.hidden = true;
    els.app.hidden = false;
  } catch (err) {
    localStorage.removeItem(STORAGE_KEY);
    els.gateError.textContent = err.message || 'Kode akses salah atau data gagal dimuat.';
    els.gateError.hidden = false;
  } finally {
    els.unlockBtn.disabled = false;
    els.unlockBtn.textContent = 'Buka Laporan';
  }
}

// Event Listeners
els.togglePin.addEventListener('click', () => {
  els.pinInput.type = els.pinInput.type === 'password' ? 'text' : 'password';
});

els.unlockForm.addEventListener('submit', e => {
  e.preventDefault();
  const pin = els.pinInput.value.trim();
  if (!pin) return;
  tryUnlock(pin, els.rememberPin.checked);
});

els.lockBtn.addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEY);
  state.pin = '';
  state.editionData = null;
  els.pinInput.value = '';
  els.app.hidden = true;
  els.gate.hidden = false;
  els.pinInput.focus();
});

els.editionSelect.addEventListener('change', async e => {
  await loadEdition(e.target.value, state.pin);
  const url = new URL(window.location);
  url.searchParams.set('edisi', e.target.value);
  window.history.replaceState({}, '', url);
});

els.searchInput.addEventListener('input', e => {
  state.searchQuery = e.target.value;
  renderFilteredNews();
});

els.toneFilters.addEventListener('click', e => {
  const btn = e.target.closest('.pill');
  if (!btn) return;
  state.filterTone = btn.dataset.tone;
  els.toneFilters.querySelectorAll('.pill').forEach(p => p.classList.toggle('active', p === btn));
  renderFilteredNews();
});

els.bidangTabs.addEventListener('click', e => {
  const btn = e.target.closest('.tab-btn');
  if (!btn) return;
  state.filterBidang = btn.dataset.bidang;
  els.bidangTabs.querySelectorAll('.tab-btn').forEach(t => t.classList.toggle('active', t === btn));
  renderFilteredNews();
});

document.addEventListener('click', e => {
  const btn = e.target.closest('.open-reader');
  if (btn) openReader(btn.dataset.no);
});

els.drawerClose.addEventListener('click', closeReader);
els.drawerBackdrop.addEventListener('click', closeReader);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !els.drawer.hidden) closeReader();
});

// Auto-unlock jika perangkat sudah menyimpan kode akses
(async function init() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    await tryUnlock(saved, true);
  }
})();
