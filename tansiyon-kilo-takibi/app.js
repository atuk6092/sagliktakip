/* Tansiyon Kilo Takibi - PWA + opsiyonel Firebase senkron */
(() => {
  const STORAGE_KEY = 'tansiyonKiloTakibi.records.v1';
  const state = { records: [], filter: 'all', type: 'bp', user: null, cloudReady: false, unsub: null, db: null, fb: null, deferredInstall: null };

  const $ = (id) => document.getElementById(id);
  const els = {
    form: $('entryForm'), dateTime: $('dateTime'), type: $('entryType'), tabs: document.querySelectorAll('.tab'),
    statusCard: $('statusCard'), statusText: $('statusText'), syncBtn: $('syncBtn'), logoutBtn: $('logoutBtn'), installBtn: $('installBtn'),
    filterType: $('filterType'), records: $('records'), tpl: $('recordTemplate'), exportBtn: $('exportBtn'), importFile: $('importFile'), clearBtn: $('clearBtn'),
    lastBp: $('lastBp'), lastBpMeta: $('lastBpMeta'), lastWeight: $('lastWeight'), lastWeightMeta: $('lastWeightMeta'), weekWalk: $('weekWalk'), weekSteps: $('weekSteps'), todayMeals: $('todayMeals'), todayCalories: $('todayCalories'),
    bpChart: $('bpChart'), weightChart: $('weightChart')
  };

  const typeConfig = {
    bp: { label: 'Tansiyon', icon: '❤', color: '#dc2626' },
    weight: { label: 'Kilo', icon: '⚖', color: '#0f766e' },
    walk: { label: 'Yürüyüş', icon: '👟', color: '#16a34a' },
    meal: { label: 'Yeme', icon: '🍽', color: '#d97706' }
  };

  function nowLocalInputValue(date = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
  function formatDate(iso) {
    return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  }
  function dateKey(iso) {
    const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function getLocalRecords() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
  }
  function saveLocal() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.records));
  }
  function sorted(records = state.records) {
    return [...records].sort((a,b) => new Date(b.dateTime) - new Date(a.dateTime));
  }
  function setStatus(text, online = false) {
    els.statusText.textContent = text;
    els.statusCard.classList.toggle('online', online);
  }

  function setType(type) {
    state.type = type; els.type.value = type;
    els.tabs.forEach(t => t.classList.toggle('active', t.dataset.type === type));
    ['bp','weight','walk','meal'].forEach(t => $(`${t}Fields`).classList.toggle('hidden', t !== type));
  }

  function readForm() {
    const type = els.type.value;
    const base = { id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), type, dateTime: new Date(els.dateTime.value).toISOString(), note: $('note').value.trim(), createdAt: new Date().toISOString() };
    if (type === 'bp') {
      const systolic = Number($('systolic').value), diastolic = Number($('diastolic').value), pulse = Number($('pulse').value || 0);
      if (!systolic || !diastolic) throw new Error('Büyük ve küçük tansiyon zorunlu.');
      return { ...base, systolic, diastolic, pulse };
    }
    if (type === 'weight') {
      const weight = Number($('weight').value); if (!weight) throw new Error('Kilo değeri zorunlu.');
      return { ...base, weight };
    }
    if (type === 'walk') {
      const minutes = Number($('walkMinutes').value), steps = Number($('steps').value || 0), distance = Number($('distance').value || 0);
      if (!minutes && !steps && !distance) throw new Error('En az bir yürüyüş değeri girin.');
      return { ...base, minutes, steps, distance };
    }
    const calories = Number($('calories').value || 0), food = $('food').value.trim(), mealType = $('mealType').value;
    if (!food && !calories) throw new Error('Yeme kaydı için yiyecek veya kalori girin.');
    return { ...base, mealType, calories, food };
  }

  async function addRecord(record) {
    state.records = [record, ...state.records.filter(r => r.id !== record.id)];
    saveLocal(); render();
    if (state.user && state.db && state.fb) {
      const { doc, setDoc } = state.fb.firestore;
      await setDoc(doc(state.db, 'users', state.user.uid, 'records', record.id), record);
    }
  }

  async function deleteRecord(id) {
    state.records = state.records.filter(r => r.id !== id); saveLocal(); render();
    if (state.user && state.db && state.fb) {
      const { doc, deleteDoc } = state.fb.firestore;
      await deleteDoc(doc(state.db, 'users', state.user.uid, 'records', id));
    }
  }

  function titleFor(r) {
    if (r.type === 'bp') return `${r.systolic}/${r.diastolic} mmHg${r.pulse ? ` • Nabız ${r.pulse}` : ''}`;
    if (r.type === 'weight') return `${Number(r.weight).toFixed(1)} kg`;
    if (r.type === 'walk') return `${r.minutes || 0} dk • ${r.steps || 0} adım${r.distance ? ` • ${r.distance} km` : ''}`;
    return `${r.mealType || 'Öğün'}${r.food ? ` • ${r.food}` : ''}${r.calories ? ` • ${r.calories} kcal` : ''}`;
  }

  function renderStats() {
    const bp = sorted(state.records.filter(r => r.type === 'bp'))[0];
    els.lastBp.textContent = bp ? `${bp.systolic}/${bp.diastolic}` : '—';
    els.lastBpMeta.textContent = bp ? `${formatDate(bp.dateTime)}${bp.pulse ? ` • ${bp.pulse} nabız` : ''}` : 'Kayıt yok';
    const w = sorted(state.records.filter(r => r.type === 'weight'))[0];
    els.lastWeight.textContent = w ? `${Number(w.weight).toFixed(1)} kg` : '—';
    els.lastWeightMeta.textContent = w ? formatDate(w.dateTime) : 'Kayıt yok';
    const sevenAgo = new Date(); sevenAgo.setDate(sevenAgo.getDate() - 6); sevenAgo.setHours(0,0,0,0);
    const walks = state.records.filter(r => r.type === 'walk' && new Date(r.dateTime) >= sevenAgo);
    els.weekWalk.textContent = `${walks.reduce((s,r)=>s+(Number(r.minutes)||0),0)} dk`;
    els.weekSteps.textContent = `${walks.reduce((s,r)=>s+(Number(r.steps)||0),0).toLocaleString('tr-TR')} adım`;
    const today = dateKey(new Date().toISOString());
    const meals = state.records.filter(r => r.type === 'meal' && dateKey(r.dateTime) === today);
    els.todayMeals.textContent = meals.length;
    els.todayCalories.textContent = `${meals.reduce((s,r)=>s+(Number(r.calories)||0),0)} kcal`;
  }

  function drawChart(canvas, items, series) {
    const ctx = canvas.getContext('2d'); const W = canvas.width, H = canvas.height; ctx.clearRect(0,0,W,H);
    ctx.fillStyle = '#f8fafc'; ctx.fillRect(0,0,W,H);
    ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1;
    for (let i=0;i<5;i++){ const y=28+i*(H-58)/4; ctx.beginPath(); ctx.moveTo(42,y); ctx.lineTo(W-16,y); ctx.stroke(); }
    if (!items.length) { ctx.fillStyle='#64748b'; ctx.font='16px system-ui'; ctx.fillText('Henüz veri yok', W/2-48, H/2); return; }
    const data = items.slice(-12);
    const vals = data.flatMap(r => series.map(s => Number(r[s.key])).filter(Boolean));
    const min = Math.min(...vals), max = Math.max(...vals); const pad = Math.max(5, (max-min)*0.15); const lo = min-pad, hi = max+pad;
    const x = i => 48 + i * ((W-78) / Math.max(1, data.length-1)); const y = v => 22 + (hi-v) * ((H-58)/(hi-lo || 1));
    ctx.fillStyle='#64748b'; ctx.font='12px system-ui'; ctx.fillText(Math.round(hi), 8, 32); ctx.fillText(Math.round(lo), 8, H-30);
    series.forEach(s => {
      ctx.strokeStyle=s.color; ctx.fillStyle=s.color; ctx.lineWidth=3; ctx.beginPath();
      data.forEach((r,i)=>{ const xx=x(i), yy=y(Number(r[s.key])); if(i===0)ctx.moveTo(xx,yy); else ctx.lineTo(xx,yy); }); ctx.stroke();
      data.forEach((r,i)=>{ ctx.beginPath(); ctx.arc(x(i), y(Number(r[s.key])), 4, 0, Math.PI*2); ctx.fill(); });
    });
  }

  function renderCharts() {
    drawChart(els.bpChart, state.records.filter(r=>r.type==='bp').sort((a,b)=>new Date(a.dateTime)-new Date(b.dateTime)), [
      { key:'systolic', color:'#dc2626' }, { key:'diastolic', color:'#2563eb' }
    ]);
    drawChart(els.weightChart, state.records.filter(r=>r.type==='weight').sort((a,b)=>new Date(a.dateTime)-new Date(b.dateTime)), [
      { key:'weight', color:'#0f766e' }
    ]);
  }

  function renderRecords() {
    const records = sorted(state.records).filter(r => state.filter === 'all' || r.type === state.filter);
    els.records.innerHTML = '';
    if (!records.length) { els.records.innerHTML = '<div class="empty">Bu filtrede kayıt yok. Soldaki formdan ilk kaydını ekleyebilirsin.</div>'; return; }
    records.forEach(r => {
      const node = els.tpl.content.cloneNode(true); const cfg = typeConfig[r.type] || typeConfig.bp;
      node.querySelector('.record-icon').textContent = cfg.icon; node.querySelector('.record-icon').style.background = cfg.color;
      node.querySelector('.record-title').textContent = titleFor(r);
      node.querySelector('.record-meta').textContent = `${cfg.label} • ${formatDate(r.dateTime)}`;
      node.querySelector('.record-note').textContent = r.note || '';
      node.querySelector('.delete-btn').addEventListener('click', () => { if(confirm('Bu kayıt silinsin mi?')) deleteRecord(r.id); });
      els.records.appendChild(node);
    });
  }
  function render() { renderStats(); renderCharts(); renderRecords(); }

  async function initFirebase() {
    if (!window.FIREBASE_CONFIG || !window.FIREBASE_CONFIG.apiKey) {
      alert('Google ile giriş için firebase-config.js dosyasına Firebase ayarlarınızı girmeniz gerekiyor. Yerel mod kullanıma hazır.');
      return;
    }
    try {
      const [appMod, authMod, fsMod] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js'),
        import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js')
      ]);
      state.fb = { app: appMod, auth: authMod, firestore: fsMod };
      const app = appMod.initializeApp(window.FIREBASE_CONFIG);
      const auth = authMod.getAuth(app); state.db = fsMod.getFirestore(app);
      authMod.onAuthStateChanged(auth, async (user) => {
        state.user = user;
        els.logoutBtn.classList.toggle('hidden', !user); els.syncBtn.textContent = user ? (user.displayName || 'Google Bağlı') : 'Google ile Giriş';
        if (state.unsub) { state.unsub(); state.unsub = null; }
        if (user) {
          setStatus(`Bulut mod: ${user.email} hesabı ile senkronize.`, true);
          await uploadLocalToCloud(); subscribeCloud();
        } else setStatus('Yerel mod: Veriler bu cihazda saklanıyor.', false);
      });
      const provider = new authMod.GoogleAuthProvider();
      await authMod.signInWithPopup(auth, provider);
    } catch (e) {
      console.error(e); alert('Google girişi başlatılamadı: ' + e.message);
    }
  }

  async function uploadLocalToCloud() {
    if (!state.user || !state.db || !state.records.length) return;
    const { doc, setDoc } = state.fb.firestore;
    await Promise.all(state.records.map(r => setDoc(doc(state.db, 'users', state.user.uid, 'records', r.id), r)));
  }
  function subscribeCloud() {
    const { collection, onSnapshot } = state.fb.firestore;
    state.unsub = onSnapshot(collection(state.db, 'users', state.user.uid, 'records'), (snap) => {
      state.records = snap.docs.map(d => ({ id: d.id, ...d.data() })); saveLocal(); render();
    });
  }

  function wireEvents() {
    els.tabs.forEach(t => t.addEventListener('click', () => setType(t.dataset.type)));
    els.form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      try { await addRecord(readForm()); els.form.reset(); els.dateTime.value = nowLocalInputValue(); setType(state.type); }
      catch(e) { alert(e.message); }
    });
    els.filterType.addEventListener('change', e => { state.filter = e.target.value; renderRecords(); });
    els.exportBtn.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(state.records, null, 2)], { type:'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `saglik-kayitlari-${dateKey(new Date().toISOString())}.json`; a.click(); URL.revokeObjectURL(a.href);
    });
    els.importFile.addEventListener('change', async (e) => {
      const file = e.target.files[0]; if (!file) return;
      try {
        const imported = JSON.parse(await file.text()); if (!Array.isArray(imported)) throw new Error('Dosya formatı uygun değil.');
        const byId = new Map([...state.records, ...imported].filter(r => r.id && r.type).map(r => [r.id, r]));
        state.records = [...byId.values()]; saveLocal(); render(); if (state.user) await uploadLocalToCloud();
      } catch(err) { alert('İçe aktarma başarısız: ' + err.message); }
      e.target.value = '';
    });
    els.clearBtn.addEventListener('click', () => { if(confirm('Bu cihazdaki tüm kayıtlar silinsin mi? Bulut hesabınız açıksa bulut kayıtları silinmez.')) { state.records = []; saveLocal(); render(); } });
    els.syncBtn.addEventListener('click', initFirebase);
    els.logoutBtn.addEventListener('click', async () => { if (state.fb && state.fb.auth) await state.fb.auth.signOut(state.fb.auth.getAuth()); });
    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); state.deferredInstall = e; els.installBtn.classList.remove('hidden'); });
    els.installBtn.addEventListener('click', async () => { if (!state.deferredInstall) return; state.deferredInstall.prompt(); await state.deferredInstall.userChoice; state.deferredInstall = null; els.installBtn.classList.add('hidden'); });
  }

  function registerSW() {
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('./sw.js').catch(console.warn);
    }
  }

  function seedIfEmpty() {
    if (state.records.length) return;
    // Uygulama boş başlar; örnek veri isterseniz aşağıdaki satırı false yapıp kendiniz ekleyin.
  }

  function init() {
    els.dateTime.value = nowLocalInputValue(); state.records = getLocalRecords(); seedIfEmpty(); wireEvents(); setType('bp'); render(); registerSW();
  }
  document.addEventListener('DOMContentLoaded', init);
})();
