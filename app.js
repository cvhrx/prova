const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const pad = n => String(n).padStart(2,'0');
const MINUTES = ['00','30'];
const HOURS = Array.from({length:24},(_,i)=>pad(i));
const todayISO = ()=> new Date().toISOString().slice(0,10);

// Firebase init
const firebaseConfig = {
  apiKey: "AIzaSyA49NgSPeAVUg9vfnnCUj4joXXbgsAsKbA",
  authDomain: "fattureglf.firebaseapp.com",
  projectId: "fattureglf",
  storageBucket: "fattureglf.firebasestorage.app",
  messagingSenderId: "556158613585",
  appId: "1:556158613585:web:a88fa2f37a668d9b6c6070",
};
const appFB = Firebase.initializeApp(firebaseConfig);
const auth   = Firebase.getAuth(appFB);
const db     = Firebase.getFirestore(appFB);

// UI helpers
function fill(sel, arr){ sel.innerHTML = arr.map(v=>`<option value="${v}">${v}</option>`).join(''); }
function initTime(){
  [['#in1_h','#in1_m'],['#out1_h','#out1_m'],['#in2_h','#in2_m'],['#out2_h','#out2_m']].forEach(([h,m])=>{
    fill($(h),HOURS); fill($(m),MINUTES);
  });
}

const authUI = {
  card: $('#auth'), app: $('#app'),
  email: $('#login_email'), pass: $('#login_pass'),
  btnLogin: $('#btnLogin'), toggleReg: $('#toggleReg'), regPanel: $('#regPanel'), authMsg: $('#authMsg'),
  r_nome: $('#r_nome'), r_cognome: $('#r_cognome'), r_ragsoc: $('#r_ragsoc'),
  r_piva: $('#r_piva'), r_indir: $('#r_indir'), r_citta: $('#r_citta'),
  r_emailAz: $('#r_emailAz'), r_tel: $('#r_tel'), r_sdi: $('#r_sdi'),
  r_email: $('#r_email'), r_pass: $('#r_pass'), btnRegister: $('#btnRegister')
};

authUI.toggleReg.addEventListener('click',()=>authUI.regPanel.classList.toggle('hidden'));
authUI.btnLogin.addEventListener('click', async ()=>{
  try{ await Firebase.signInWithEmailAndPassword(auth, authUI.email.value, authUI.pass.value); }
  catch(e){ authUI.authMsg.textContent = e.message; }
});
authUI.btnRegister.addEventListener('click', async ()=>{
  try{
    const cred = await Firebase.createUserWithEmailAndPassword(auth, authUI.r_email.value, authUI.r_pass.value);
    const uid = cred.user.uid;
    await Firebase.updateProfile(cred.user, { displayName: `${authUI.r_nome.value} ${authUI.r_cognome.value}`.trim() });
    await Firebase.setDoc(Firebase.doc(db, "users", uid, "company", "profile"), {
      nome: authUI.r_nome.value, cognome: authUI.r_cognome.value, ragioneSociale: authUI.r_ragsoc.value,
      piva: authUI.r_piva.value, indirizzo: authUI.r_indir.value, cittaProv: authUI.r_citta.value,
      emailAziendale: authUI.r_emailAz.value, telefono: authUI.r_tel.value, sdipec: authUI.r_sdi.value,
      createdAt: new Date().toISOString()
    });
    await Firebase.setDoc(Firebase.doc(db, "users", uid, "settings", "tariffe"), { ord:12, str:25, km:0.4, trasferta:50, pernotto:80, updatedAt:new Date().toISOString() }, { merge:true });
    authUI.authMsg.textContent = "Registrazione completata. Ora puoi accedere.";
  }catch(e){ authUI.authMsg.textContent = e.message; }
});

Firebase.onAuthStateChanged(auth, async (user)=>{
  if(!user){ authUI.card.hidden = false; authUI.app.hidden = true; return; }
  authUI.card.hidden = true; authUI.app.hidden = false;
  await ensureBootstrap(user.uid);
  bootApp();
});

async function ensureBootstrap(uid){
  const tRef = Firebase.doc(db, "users", uid, "settings", "tariffe");
  const snap = await Firebase.getDoc(tRef);
  if(!snap.exists()){
    await Firebase.setDoc(tRef, { ord:12, str:25, km:0.4, trasferta:50, pernotto:80, updatedAt: new Date().toISOString() });
  }
}

// Calc helpers
function minutes(h1,m1,h2,m2){ return Math.max(0,(+h2*60+ +m2) - (+h1*60+ +m1)); }
function totalOrd(e){
  if(!e) return 0;
  let m=0; if(e.in1&&e.out1){let[a,b]=e.in1.split(':'),[c,d]=e.out1.split(':');m+=minutes(a,b,c,d)}
  if(e.in2&&e.out2){let[a,b]=e.in2.split(':') , [c,d]=e.out2.split(':');m+=minutes(a,b,c,d)}
  return m/60;
}
function totalStr(e){const o=totalOrd(e);return Math.max(0,o-8);}

function bootApp(){
  initTime();
  const dp=$('#dayPicker'); dp.value = todayISO();
  bindChips(); bindTabs(); bindSettings();
  $('#btnSave').addEventListener('click', saveDay);
  $('#btnPdf').addEventListener('click', exportPDF);
  dp.addEventListener('change', loadDayToForm);
  loadDayToForm();
  refreshMonthView();
}

function bindChips(){ ['chipTrasferta','chipPernotto'].forEach(id=>$('#'+id).addEventListener('click',()=>$('#'+id).classList.toggle('active'))); }

// Settings modal toggles
$('#btnSettings')?.addEventListener('click',()=>$('#settingsModal').classList.remove('hidden'));
$('#modalClose')?.addEventListener('click',()=>$('#settingsModal').classList.add('hidden'));
$$('.modal-tabs .tab').forEach(b=>b.addEventListener('click',()=>{
  $$('.modal-tabs .tab').forEach(x=>x.classList.remove('on')); b.classList.add('on');
  const t=b.dataset.tab; $('#pane-clienti').classList.toggle('hidden',t!=='clienti'); $('#pane-tariffe').classList.toggle('hidden',t!=='tariffe');
}));

// Save day
async function saveDay(){
  const user = auth.currentUser; if(!user) return alert('Non autenticato');
  const iso = $('#dayPicker').value;
  const e = {
    date: iso,
    in1: `${$('#in1_h').value}:${$('#in1_m').value}`,
    out1:`${$('#out1_h').value}:${$('#out1_m').value}`,
    in2: `${$('#in2_h').value}:${$('#in2_m').value}`,
    out2:`${$('#out2_h').value}:${$('#out2_m').value}`,
    km: +($('#km').value||0),
    trasf: $('#chipTrasferta').classList.contains('active'),
    pern: $('#chipPernotto').classList.contains('active'),
    note: $('#note').value.trim(),
    updatedAt: new Date().toISOString()
  };
  await Firebase.setDoc(Firebase.doc(db, "users", user.uid, "entries", iso), e, { merge: true });
  alert('Giornata salvata');
  await refreshMonthView();
}

// Load selected day
async function loadDayToForm(){
  const user = auth.currentUser; if(!user) return;
  const iso = $('#dayPicker').value;
  const ref = Firebase.doc(db, "users", user.uid, "entries", iso);
  const snap = await Firebase.getDoc(ref);
  const e = snap.exists() ? snap.data() : null;
  function set(val,h,m){ if(val){let[a,b]=val.split(':'), H=$(h), M=$(m); if(H)H.value=a; if(M)M.value=b;} else {$(h).value='00'; $(m).value='00';}}
  set(e?.in1,'#in1_h','#in1_m'); set(e?.out1,'#out1_h','#out1_m'); set(e?.in2,'#in2_h','#in2_m'); set(e?.out2,'#out2_h','#out2_m');
  $('#km').value = e?.km ?? 0; $('#note').value = e?.note ?? '';
  $('#chipTrasferta').classList.toggle('active', !!e?.trasf); $('#chipPernotto').classList.toggle('active', !!e?.pern);
}

// Month views
async function refreshMonthView(){
  const user = auth.currentUser; if(!user) return;
  const d = new Date($('#dayPicker').value);
  $('#monthLabel').textContent = d.toLocaleDateString('it-IT',{year:'numeric',month:'long'});
  const year = d.getFullYear(), month = d.getMonth()+1, prefix = `${year}-${String(month).padStart(2,'0')}-`;
  const col = Firebase.collection(db, "users", user.uid, "entries");
  const snap = await Firebase.getDocs(col);
  const arr = []; snap.forEach(doc=>{ const x=doc.data(); if((x.date||'').startsWith(prefix)) arr.push(x); });
  const days = new Date(year, month, 0).getDate();
  const grid = $('#calGrid'); grid.innerHTML = '';
  for(let i=1;i<=days;i++){
    const iso = `${year}-${String(month).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
    const e = arr.find(x=>x.date===iso);
    const ord = totalOrd(e||{}), str = totalStr(e||{});
    const b=document.createElement('button'); b.className='cal-cell';
    b.innerHTML=`<div><strong>${i}</strong></div><span class="badge g">${ord.toFixed(1)}h</span><span class="badge r">${str.toFixed(1)}h</span>`;
    b.addEventListener('click',()=>{ $('#dayPicker').value=iso; loadDayToForm(); window.scrollTo({top:0,behavior:'smooth'}); });
    grid.appendChild(b);
  }
  const list=$('#listView'); list.innerHTML='';
  for(let i=1;i<=days;i++){
    const iso = `${year}-${String(month).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
    const e = arr.find(x=>x.date===iso) || {};
    const ord = totalOrd(e).toFixed(1), str = totalStr(e).toFixed(1);
    const row=document.createElement('div'); row.className='list-item';
    row.innerHTML=`<div><strong>${iso.slice(8,10)}/${iso.slice(5,7)}</strong></div><div class="list-meta"><span>Ord:${ord}</span><span>Str:${str}</span></div>`;
    row.addEventListener('click',()=>{ $('#dayPicker').value=iso; loadDayToForm(); window.scrollTo({top:0,behavior:'smooth'}); });
    list.appendChild(row);
  }
}

// PDF monthly
async function exportPDF(){
  const { jsPDF } = window.jspdf; const doc=new jsPDF({unit:'pt',format:'a4'}); const W=doc.internal.pageSize.getWidth();
  doc.setFillColor(255,10,9); doc.rect(0,0,W,70,'F');
  const img=new Image(); img.src='logo.png'; await new Promise(r=>{img.onload=r; img.onerror=r;});
  const h=36, w=h*(img.naturalWidth/img.naturalHeight); doc.addImage(img,'PNG',(W-w)/2,17,w,h);
  const d=new Date($('#dayPicker').value); doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.text(`Anno: ${d.getFullYear()}`, W-80, 90);
  const user = auth.currentUser; const year = d.getFullYear(), month = d.getMonth()+1, prefix = `${year}-${String(month).padStart(2,'0')}-`;
  const col = Firebase.collection(db, "users", user.uid, "entries"); const snap = await Firebase.getDocs(col);
  const arr = []; snap.forEach(docu=>{ const x=docu.data(); if((x.date||'').startsWith(prefix)) arr.push(x); }); arr.sort((a,b)=> (a.date>b.date?1:-1));
  const head=[['GIORNO','IN','OUT','IN','OUT','ORE / ORD','ORE / STR','ORE TOT','TRASFERTA','PERNOTTO','KM','NOTE']];
  const body = arr.map(e=>{ const o=totalOrd(e), s=totalStr(e), t=o+s;
    return [e.date.slice(8,10)+'/'+e.date.slice(5,7), e.in1||'', e.out1||'', e.in2||'', e.out2||'', o.toFixed(2), s.toFixed(2), t.toFixed(2), e.trasf?'SI':'', e.pern?'SI':'', String(e.km||0), e.note||'']; });
  doc.autoTable({head, body: body.length?body:[['-','-','-','-','-','0','0','0','','','0','']],
    startY:104, theme:'grid', styles:{fontSize:9, cellPadding:4, valign:'middle', overflow:'linebreak'},
    headStyles:{fillColor:[255,10,9], textColor:255, fontStyle:'bold', halign:'center'},
    columnStyles:{0:{cellWidth:48},1:{cellWidth:42},2:{cellWidth:42},3:{cellWidth:42},4:{cellWidth:42},5:{cellWidth:62},6:{cellWidth:62},7:{cellWidth:62},8:{cellWidth:70},9:{cellWidth:70},10:{cellWidth:48},11:{cellWidth:'auto'}},
    margin:{left:26,right:26}
  });
  let sumOrd=0,sumStr=0,sumKm=0,sumTr=0,sumPn=0; arr.forEach(e=>{ const o=totalOrd(e), s=totalStr(e); sumOrd+=o; sumStr+=s; sumKm+=e.km||0; if(e.trasf)sumTr++; if(e.pern)sumPn++; });
  const y=doc.lastAutoTable.finalY+16; doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.text('Riepilogo',26,y);
  const R={ord:12,str:25,km:0.4,trasf:50,pern:80};
  const rec=[['DESCRIZIONE','Q.tà','Prezzo','Importo'],
             ['Ore ordinarie', sumOrd.toFixed(2), R.ord.toFixed(2), (sumOrd*R.ord).toFixed(2)],
             ['Ore straordinarie', sumStr.toFixed(2), R.str.toFixed(2), (sumStr*R.str).toFixed(2)],
             ['KM', String(sumKm), R.km.toFixed(2), (sumKm*R.km).toFixed(2)],
             ['Trasferte', String(sumTr), R.trasf.toFixed(2), (sumTr*R.trasf).toFixed(2)],
             ['Pernotti', String(sumPn), R.pern.toFixed(2), (sumPn*R.pern).toFixed(2)]];
  doc.autoTable({head:[rec.shift()], body:rec, startY:y+8, theme:'grid',
    styles:{fontSize:10, cellPadding:4}, headStyles:{fillColor:[255,10,9], textColor:255, fontStyle:'bold', halign:'center'},
    alternateRowStyles:{fillColor:[245,247,251]}, margin:{left:26,right:26}
  });
  doc.save(`rapportino_${String(month).padStart(2,'0')}-${year}.pdf`);
}

document.addEventListener('DOMContentLoaded',()=>{ initTime(); });
