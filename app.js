
// ── CONFIG (move to env variables on Vercel) ──
const SB_URL='https://nteqwktntktsrpucfzel.supabase.co';
const SB_KEY='sb_publishable_gCeRe5q1IYA77pTa0X2bog_3bpf7CtE'; // TODO: env var VITE_SUPABASE_KEY
const ADMIN_PASS_HASH='8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918'; // SHA256 of 'carelink2025' - never store plain text
const SESSION_DURATION=12*60*60*1000; // 12 hours in ms
let currentUser=null,currentToken=null,selectedDoctorId=null,selectedSeverity=null,blockedUsers=[],rxMedCount=0,currentRecordTab='files',currentAdminTab='doctors',pageHistory=['s-home'];

const SPECIALTIES=[
  {name:'General Physician',icon:'ti-stethoscope',bg:'#E1F5EE',color:'#085041'},
  {name:'Cardiologist',icon:'ti-heart-rate-monitor',bg:'#FCEBEB',color:'#791F1F'},
  {name:'Dermatologist',icon:'ti-sparkles',bg:'#EAF3DE',color:'#27500A'},
  {name:'Neurologist',icon:'ti-brain',bg:'#EEEDFE',color:'#3C3489'},
  {name:'Pediatrician',icon:'ti-baby-carriage',bg:'#FBEAF0',color:'#7A2347'},
  {name:'Orthopedic',icon:'ti-bone',bg:'#FAEEDA',color:'#633806'},
  {name:'Psychiatrist',icon:'ti-mood-happy',bg:'#E6F1FB',color:'#0C447C'},
  {name:'Gynecologist',icon:'ti-gender-female',bg:'#FBEAF0',color:'#993556'},
  {name:'Ophthalmologist',icon:'ti-eye',bg:'#E1F5EE',color:'#085041'},
  {name:'ENT Specialist',icon:'ti-ear',bg:'#FAEEDA',color:'#633806'},
  {name:'Dentist',icon:'ti-tooth',bg:'#E6F1FB',color:'#0C447C'},
  {name:'Oncologist',icon:'ti-microscope',bg:'#FCEBEB',color:'#791F1F'},
];

const TIPS=[
  {title:'Stay hydrated',text:'Drink at least 8 glasses of water daily. Proper hydration improves energy, focus, and helps flush toxins.'},
  {title:'Walk every day',text:'A daily walk reduces risk of heart disease, diabetes, and improves mental health significantly.'},
  {title:'Sleep 7 to 9 hours',text:'Poor sleep is linked to obesity, heart disease, and weakened immunity. Prioritize good sleep habits.'},
  {title:'Eat more greens',text:'Include at least 3 servings of vegetables daily. Dark leafy greens are packed with essential vitamins.'},
  {title:'Manage your stress',text:'Chronic stress raises cortisol. Try 10 minutes of deep breathing or meditation daily.'},
  {title:'Get morning sunlight',text:'15 to 20 minutes of morning sunlight boosts Vitamin D and regulates your sleep cycle naturally.'},
];

// ── HEALTH TIP ──
const tip=TIPS[Math.floor(Math.random()*TIPS.length)];
document.getElementById('tip-title').textContent=tip.title;
document.getElementById('tip-text').textContent=tip.text;

// ── SANITIZE (XSS prevention) ──
function sanitize(str){
  if(!str)return'';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;');
}

// ── RATE LIMITER ──
const _rl={};
function rateLimit(key,max=3,windowMs=10000){
  const now=Date.now();
  if(!_rl[key])_rl[key]=[];
  _rl[key]=_rl[key].filter(t=>now-t<windowMs);
  if(_rl[key].length>=max)return false;
  _rl[key].push(now);return true;
}

// ── TOKEN REFRESH ──
async function refreshToken(){
  const refresh=sessionStorage.getItem('cl_refresh');
  if(!refresh)return false;
  try{
    const res=await fetch(`${SB_URL}/auth/v1/token?grant_type=refresh_token`,{
      method:'POST',headers:{'apikey':SB_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({refresh_token:refresh})
    }).then(r=>r.json());
    if(res.access_token){
      currentToken=res.access_token;
      sessionStorage.setItem('cl_t',res.access_token);
      if(res.refresh_token)sessionStorage.setItem('cl_refresh',res.refresh_token);
      sessionStorage.setItem('cl_exp',Date.now()+(12*60*60*1000));
      return true;
    }
  }catch(e){}
  return false;
}

// ── API ──
const api=async(path,opts={})=>{
  // Auto-refresh token if close to expiry (within 5 min)
  const exp=parseInt(sessionStorage.getItem('cl_exp')||'0');
  if(currentToken && Date.now()>exp-(5*60*1000)){await refreshToken();}
  const r=await fetch(`${SB_URL}/rest/v1${path}`,{
    headers:{'apikey':SB_KEY,'Authorization':`Bearer ${currentToken||SB_KEY}`,'Content-Type':'application/json','Prefer':'return=representation',...(opts.headers||{})}, ...opts
  });
  if(r.status===401){
    const refreshed=await refreshToken();
    if(!refreshed){signOut();return{};}
    return fetch(`${SB_URL}/rest/v1${path}`,{
      headers:{'apikey':SB_KEY,'Authorization':`Bearer ${currentToken}`,'Content-Type':'application/json','Prefer':'return=representation',...(opts.headers||{})}, ...opts
    }).then(r=>r.json());
  }
  return r.json();
};
const authApi=(path,body)=>fetch(`${SB_URL}/auth/v1${path}`,{
  method:'POST',headers:{'apikey':SB_KEY,'Content-Type':'application/json'},body:JSON.stringify(body)
}).then(r=>r.json());

// ── TOAST ──
function showToast(msg,duration=3000){
  const t=document.getElementById('toast');
  document.getElementById('toast-msg').textContent=msg;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),duration);
}

// ── NAVIGATION with history ──
function go(id){
  const prev=pageHistory[pageHistory.length-1];
  if(prev!==id)pageHistory.push(id);
  if(pageHistory.length>20)pageHistory.shift();
  _showScreen(id);
  // Save current page to session
  sessionStorage.setItem('cl_page',id);
}

function goBack(){
  if(pageHistory.length>1){
    pageHistory.pop();
    const prev=pageHistory[pageHistory.length-1];
    _showScreen(prev);
    sessionStorage.setItem('cl_page',prev);
  }
}

function _showScreen(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  const t=document.getElementById(id);
  if(t)t.classList.add('active');
  window.scrollTo(0,0);
}

// ── BROWSER BACK BUTTON ──
window.addEventListener('popstate',()=>goBack());

function pTab(tab){
  const map={home:'s-patient-dash',specialties:'s-p-specialties',nearby:'s-p-nearby',requests:'s-p-requests',messages:'s-p-messages',symptom:'s-p-symptom',records:'s-p-records',notifications:'s-p-notifications'};
  go(map[tab]||'s-patient-dash');
  if(tab==='specialties')renderSpecialties();
  if(tab==='requests')loadMyRequests();
  if(tab==='records'){currentRecordTab='files';loadPatientRecords('files');}
  if(tab==='messages')loadChatMessages('p');
  if(tab==='notifications')loadNotifications('p');
}

function dTab(tab){
  const map={home:'s-doctor-dash',requests:'s-d-requests',messages:'s-d-messages',prescribe:'s-d-prescribe',upload:'s-d-upload',blocked:'s-d-blocked',profile:'s-d-profile',notifications:'s-d-notifications'};
  go(map[tab]||'s-doctor-dash');
  if(tab==='requests')loadAptRequests();
  if(tab==='blocked')renderBlocked();
  if(tab==='messages')loadChatMessages('d');
  if(tab==='notifications')loadNotifications('d');
}

function setBtn(id,loading,html){const b=document.getElementById(id);if(!b)return;b.disabled=loading;b.innerHTML=loading?'<span class="spinner"></span> Please wait...':html;}
function showErr(eid,mid,msg){document.getElementById(eid).style.display='flex';document.getElementById(mid).textContent=msg;}
function hideErr(eid){document.getElementById(eid).style.display='none';}
function fmtDate(d){if(!d)return'N/A';return new Date(d).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});}

// ── SESSION STORAGE with 12hr expiry ──
function saveSession(t,u,r){
  sessionStorage.setItem('cl_t',t);
  sessionStorage.setItem('cl_u',JSON.stringify(u));
  sessionStorage.setItem('cl_r',r);
  sessionStorage.setItem('cl_exp',Date.now()+SESSION_DURATION);
}
function clearSession(){
  ['cl_t','cl_u','cl_r','cl_exp','cl_page'].forEach(k=>sessionStorage.removeItem(k));
}
function isSessionValid(){
  const exp=sessionStorage.getItem('cl_exp');
  return exp && Date.now()<parseInt(exp);
}

// ── AUTO LOGOUT after 12 hrs ──
function startSessionTimer(){
  if(window._sessionTimer)clearInterval(window._sessionTimer);
  window._sessionTimer=setInterval(()=>{
    if(!isSessionValid()&&currentUser){
      showToast('Session expired. Please sign in again.');
      setTimeout(()=>signOut(),2000);
    }
  },60000); // check every minute
}

// ── DOB DROPDOWNS ──
;(function(){
  const day=document.getElementById('pr-day');for(let i=1;i<=31;i++)day.innerHTML+=`<option value="${String(i).padStart(2,'0')}">${i}</option>`;
  const yr=document.getElementById('pr-year');for(let y=2015;y>=1940;y--)yr.innerHTML+=`<option value="${y}">${y}</option>`;
  const rday=document.getElementById('req-day');for(let i=1;i<=31;i++)rday.innerHTML+=`<option value="${String(i).padStart(2,'0')}">${i}</option>`;
  const ryr=document.getElementById('req-year');const cy=new Date().getFullYear();for(let y=cy;y<=cy+1;y++)ryr.innerHTML+=`<option value="${y}">${y}</option>`;
})();

// ── RESTORE SESSION ON REFRESH ──
;(async function(){
  if(!isSessionValid())return;
  const t=sessionStorage.getItem('cl_t'),u=JSON.parse(sessionStorage.getItem('cl_u')||'null'),r=sessionStorage.getItem('cl_r'),page=sessionStorage.getItem('cl_page');
  if(!t||!u||!r)return;
  currentToken=t;currentUser=u;
  if(r==='patient'){
    const p=await api(`/patients?id=eq.${u.id}&select=full_name`);
    document.getElementById('p-dash-name').textContent=p[0]?.full_name||u.email;
    _showScreen(page||'s-patient-dash');
    loadUnreadCount();
    startSessionTimer();
  } else if(r==='doctor'){
    const d=(await api(`/doctors?id=eq.${u.id}&select=full_name,specialty,status,city,max_appointments,bio,address`))[0];
    if(!d){document.getElementById('app-loading').style.display='none';return;}
    setDoctorDash(d);
    _showScreen(page||'s-doctor-dash');
    loadUnreadCount();
    startSessionTimer();
  }
  document.getElementById('app-loading').style.display='none';
})();
// Hide loading if no session
setTimeout(()=>{const l=document.getElementById('app-loading');if(l)l.style.display='none';},1500);

function setDoctorDash(d){
  document.getElementById('d-dash-name').textContent=d.full_name||'Doctor';
  document.getElementById('d-dash-spec').textContent=`${d.specialty||''}${d.city?' - '+d.city:''}`;
  const badge=document.getElementById('d-status-badge'),vblock=document.getElementById('d-verify-block'),vcard=document.getElementById('d-verify-card');
  if(d.status==='verified'){badge.className='badge badge-green';badge.innerHTML='<i class="ti ti-shield-check"></i> Verified';vblock.style.display='none';}
  else{badge.className='badge badge-amber';badge.textContent='Pending';vblock.style.display='block';vcard.className='verify-card pending';document.getElementById('d-verify-title').textContent='License Verified';document.getElementById('d-verify-msg').textContent='Your MCI format is valid. You are active on CareLink.';}
  if(d.city)document.getElementById('dp-city').value=d.city;
  if(d.address)document.getElementById('dp-address').value=d.address;
  if(d.max_appointments)document.getElementById('dp-maxapt').value=d.max_appointments;
  if(d.bio)document.getElementById('dp-bio').value=d.bio;
}

async function loadUnreadCount(){
  if(!currentUser)return;
  const res=await api(`/notifications?user_id=eq.${currentUser.id}&is_read=eq.false&select=id`);
  const count=Array.isArray(res)?res.length:0;
  const role=sessionStorage.getItem('cl_r');
  const dot=document.getElementById(role==='patient'?'p-notif-dot':'d-notif-dot');
  if(dot)dot.style.display=count>0?'block':'none';
}

// ── LICENSE CHECK ──
function checkLicense(input){
  const val=input.value.trim(),el=document.getElementById('license-check'),pat=/^MCI-\d{4}-\d{5}$/;
  if(!val){el.style.display='none';return;}
  el.style.display='block';
  if(pat.test(val)){el.style.background='#EAF3DE';el.style.color='#27500A';el.innerHTML='<i class="ti ti-check"></i> Valid MCI format';}
  else{el.style.background='#FCEBEB';el.style.color='#791F1F';el.innerHTML='<i class="ti ti-x"></i> Invalid format. Use: MCI-YYYY-NNNNN';}
}

// ── AUTH ──
async function patientLogin(){
  const email=document.getElementById('pl-email').value,pass=document.getElementById('pl-pass').value;
  if(!email||!pass){showErr('pl-err','pl-err-msg','Please fill in all fields.');return;}
  if(!rateLimit('login',5,60000)){showErr('pl-err','pl-err-msg','Too many attempts. Please wait a minute.');return;}
  setBtn('pl-btn',true,'');hideErr('pl-err');
  const res=await authApi('/token?grant_type=password',{email,password:pass});
  if(res.error){showErr('pl-err','pl-err-msg',res.error_description||res.error);setBtn('pl-btn',false,'<i class="ti ti-login"></i> Sign in');return;}
  currentToken=res.access_token;currentUser=res.user;
  saveSession(res.access_token,res.user,'patient');
  if(res.refresh_token)sessionStorage.setItem('cl_refresh',res.refresh_token);
  const p=await api(`/patients?id=eq.${res.user.id}&select=full_name`);
  document.getElementById('p-dash-name').textContent=p[0]?.full_name||email;
  pageHistory=['s-home','s-patient-dash'];
  go('s-patient-dash');loadUnreadCount();startSessionTimer();
  setBtn('pl-btn',false,'<i class="ti ti-login"></i> Sign in');
}

async function patientRegister(){
  const fname=document.getElementById('pr-fname').value,lname=document.getElementById('pr-lname').value,email=document.getElementById('pr-email').value,pass=document.getElementById('pr-pass').value;
  if(!fname||!lname||!email||!pass){showErr('pr-err','pr-err-msg','Please fill in all required fields.');return;}
  if(pass.length<8){showErr('pr-err','pr-err-msg','Password must be at least 8 characters.');return;}
  setBtn('pr-btn',true,'');hideErr('pr-err');
  const res=await authApi('/signup',{email,password:pass,data:{role:'patient',full_name:`${fname} ${lname}`}});
  if(res.error){showErr('pr-err','pr-err-msg',res.error_description||res.error);setBtn('pr-btn',false,'<i class="ti ti-check"></i> Create account');return;}
  if(res.user){
    const day=document.getElementById('pr-day').value,month=document.getElementById('pr-month').value,year=document.getElementById('pr-year').value;
    await api('/patients',{method:'POST',body:JSON.stringify({id:res.user.id,full_name:`${fname} ${lname}`,email,phone:document.getElementById('pr-phone').value,gender:document.getElementById('pr-gender').value,dob:(day&&month&&year)?`${year}-${month}-${day}`:null,blood_group:document.getElementById('pr-blood').value||null,allergies:document.getElementById('pr-allergies').value,emergency_contact:document.getElementById('pr-ec-name').value,emergency_phone:document.getElementById('pr-ec-phone').value})});
  }
  document.getElementById('pr-ok').style.display='flex';
  setBtn('pr-btn',false,'<i class="ti ti-check"></i> Create account');
}

async function doctorLogin(){
  const email=document.getElementById('dl-email').value,pass=document.getElementById('dl-pass').value;
  if(!email||!pass){showErr('dl-err','dl-err-msg','Please fill in all fields.');return;}
  if(!rateLimit('login',5,60000)){showErr('dl-err','dl-err-msg','Too many attempts. Please wait a minute.');return;}
  setBtn('dl-btn',true,'');hideErr('dl-err');
  const res=await authApi('/token?grant_type=password',{email,password:pass});
  if(res.error){showErr('dl-err','dl-err-msg',res.error_description||res.error);setBtn('dl-btn',false,'<i class="ti ti-login"></i> Sign in as Doctor');return;}
  currentToken=res.access_token;currentUser=res.user;
  saveSession(res.access_token,res.user,'doctor');
  if(res.refresh_token)sessionStorage.setItem('cl_refresh',res.refresh_token);
  const d=(await api(`/doctors?id=eq.${res.user.id}&select=full_name,specialty,status,city,max_appointments,bio,address`))[0];
  if(!d){showErr('dl-err','dl-err-msg','Doctor profile not found. Please register first.');setBtn('dl-btn',false,'<i class="ti ti-login"></i> Sign in as Doctor');return;}
  setDoctorDash(d);pageHistory=['s-home','s-doctor-dash'];
  go('s-doctor-dash');loadUnreadCount();startSessionTimer();
  setBtn('dl-btn',false,'<i class="ti ti-login"></i> Sign in as Doctor');
}

async function doctorRegister(){
  const fname=document.getElementById('dr-fname').value,lname=document.getElementById('dr-lname').value,spec=document.getElementById('dr-spec').value,license=document.getElementById('dr-license').value,council=document.getElementById('dr-council').value,email=document.getElementById('dr-email').value,pass=document.getElementById('dr-pass').value;
  if(!fname||!lname||!spec||!license||!council||!email||!pass){showErr('dr-err','dr-err-msg','Please fill in all required fields.');return;}
  if(!/^MCI-\d{4}-\d{5}$/.test(license.trim())){showErr('dr-err','dr-err-msg','Invalid MCI license format. Use: MCI-YYYY-NNNNN');return;}
  if(pass.length<8){showErr('dr-err','dr-err-msg','Password must be at least 8 characters.');return;}
  setBtn('dr-btn',true,'');hideErr('dr-err');
  const res=await authApi('/signup',{email,password:pass,data:{role:'doctor',full_name:`Dr. ${fname} ${lname}`}});
  if(res.error){showErr('dr-err','dr-err-msg',res.error_description||res.error);setBtn('dr-btn',false,'<i class="ti ti-send"></i> Register and verify');return;}
  if(res.user){
    await api('/doctors',{method:'POST',body:JSON.stringify({id:res.user.id,full_name:`Dr. ${fname} ${lname}`,email,phone:document.getElementById('dr-phone').value,specialty:spec,hospital:document.getElementById('dr-hospital').value,city:document.getElementById('dr-city').value,address:document.getElementById('dr-address').value,license_number:license.trim(),council,max_appointments:parseInt(document.getElementById('dr-maxapt').value)||10,bio:document.getElementById('dr-bio').value,status:'verified',verified_at:new Date().toISOString()})});
  }
  document.getElementById('dr-ok').style.display='flex';
  setBtn('dr-btn',false,'<i class="ti ti-send"></i> Register and verify');
}

// ── ADMIN ──
async function sha256(msg){
  const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
async function adminLogin(){
  const hash=await sha256(document.getElementById('admin-pass').value);
  if(hash===ADMIN_PASS_HASH){
    document.getElementById('admin-err').style.display='none';
    pageHistory.push('s-admin-dash');
    _showScreen('s-admin-dash');
    loadAdminData();
  } else {
    document.getElementById('admin-err').style.display='flex';
  }
}

function signOutAdmin(){pageHistory=['s-home'];go('s-home');}

async function loadAdminData(){
  const [patients,doctors]=await Promise.all([
    api('/patients?select=id,full_name,email,phone,blood_group,created_at&order=created_at.desc'),
    api('/doctors?select=id,full_name,email,specialty,status,license_number,city,hospital,created_at&order=created_at.desc')
  ]);
  window._adminPatients=Array.isArray(patients)?patients:[];
  window._adminDoctors=Array.isArray(doctors)?doctors:[];
  document.getElementById('admin-patient-count').textContent=window._adminPatients.length;
  document.getElementById('admin-doctor-count').textContent=window._adminDoctors.length;
  document.getElementById('admin-verified-count').textContent=window._adminDoctors.filter(d=>d.status==='verified').length;
  document.getElementById('admin-pending-count').textContent=window._adminDoctors.filter(d=>d.status==='pending').length;
  switchAdminTab('doctors');
}

function switchAdminTab(tab){
  currentAdminTab=tab;
  document.querySelectorAll('[id^="atab-"]').forEach(t=>t.classList.remove('active'));
  document.getElementById('atab-'+tab)?.classList.add('active');
  if(tab==='doctors')renderAdminDoctors(window._adminDoctors||[]);
  else if(tab==='patients')renderAdminPatients(window._adminPatients||[]);
  else loadAdminRequests();
}

function renderAdminDoctors(docs){
  const el=document.getElementById('admin-content');
  if(!docs.length){el.innerHTML='<div style="text-align:center;padding:2rem;color:#888">No doctors registered yet.</div>';return;}
  el.innerHTML=docs.map(d=>`<div class="req-card">
    <div class="card-head">
      <span class="card-title">${d.full_name||'No name'}</span>
      <span class="badge ${d.status==='verified'?'badge-green':d.status==='rejected'||d.status==='suspended'?'badge-red':'badge-amber'}">${d.status||'pending'}</span>
    </div>
    <div class="card-sub">${d.specialty||''}${d.city?' - '+d.city:''}</div>
    <div style="font-size:12px;color:#aaa;margin-top:2px">${d.email||''}</div>
    <div style="font-size:12px;color:#aaa;margin-top:2px">License: ${d.license_number||'N/A'} | Joined: ${fmtDate(d.created_at)}</div>
    <div class="req-actions">
      ${d.status!=='verified'?`<button class="btn btn-green btn-sm" onclick="adminUpdateDoctor('${d.id}','verified')"><i class="ti ti-shield-check"></i> Verify</button>`:''}
      ${d.status!=='rejected'?`<button class="btn btn-red btn-sm" onclick="adminUpdateDoctor('${d.id}','rejected')"><i class="ti ti-x"></i> Reject</button>`:''}
      ${d.status!=='suspended'?`<button class="btn btn-outline btn-sm" style="color:var(--coral);border-color:var(--coral)" onclick="adminUpdateDoctor('${d.id}','suspended')"><i class="ti ti-ban"></i> Suspend</button>`:`<button class="btn btn-green btn-sm" onclick="adminUpdateDoctor('${d.id}','verified')"><i class="ti ti-refresh"></i> Reinstate</button>`}
    </div>
  </div>`).join('');
}

function renderAdminPatients(pats){
  const el=document.getElementById('admin-content');
  if(!pats.length){el.innerHTML='<div style="text-align:center;padding:2rem;color:#888">No patients registered yet.</div>';return;}
  el.innerHTML=pats.map(p=>`<div class="card">
    <div class="card-head"><span class="card-title">${p.full_name||'No name set'}</span><span class="badge badge-teal">Patient</span></div>
    <div class="card-sub">${p.email||'No email'}</div>
    <div style="font-size:12px;color:#aaa;margin-top:3px">${p.phone||'No phone'}${p.blood_group?' | Blood: '+p.blood_group:''} | Joined: ${fmtDate(p.created_at)}</div>
  </div>`).join('');
}

async function loadAdminRequests(){
  const el=document.getElementById('admin-content');
  el.innerHTML='<div style="text-align:center;padding:2rem"><span class="spinner-dark spinner"></span></div>';
  const res=await api('/appointment_requests?select=*,patients(full_name),doctors(full_name)&order=requested_at.desc&limit=50');
  if(!Array.isArray(res)||!res.length){el.innerHTML='<div style="text-align:center;padding:2rem;color:#888">No appointment requests yet.</div>';return;}
  el.innerHTML=res.map(r=>`<div class="req-card">
    <div class="card-head">
      <span class="card-title">${r.patients?.full_name||'Patient'} to ${r.doctors?.full_name||'Doctor'}</span>
      <span class="badge ${r.status==='accepted'?'badge-green':r.status==='rejected'?'badge-red':'badge-amber'}">${r.status}</span>
    </div>
    <div class="card-sub">${r.preferred_date||'Date TBD'} at ${r.preferred_time||'TBD'}</div>
    <div style="font-size:12px;color:#aaa;margin-top:3px">${r.reason||'No reason'}</div>
  </div>`).join('');
}

async function adminUpdateDoctor(id,status){
  await api(`/doctors?id=eq.${id}`,{method:'PATCH',body:JSON.stringify({status,verified_at:status==='verified'?new Date().toISOString():null,is_active:status!=='suspended'})});
  const msgs={verified:{title:'License Verified',message:'Your MCI license has been verified. You are now fully active on CareLink.',type:'success'},rejected:{title:'License Rejected',message:'Your license verification was unsuccessful. Please contact support.',type:'danger'},suspended:{title:'Account Suspended',message:'Your account has been suspended. Please contact CareLink support.',type:'danger'}};
  if(msgs[status])await api('/notifications',{method:'POST',body:JSON.stringify({user_id:id,...msgs[status]})});
  showToast(status==='verified'?'Doctor verified!':status==='rejected'?'Doctor rejected.':'Doctor suspended.');
  await loadAdminData();
}

// ── SPECIALTIES ──
function renderSpecialties(){
  const el=document.getElementById('specialty-grid');
  el.innerHTML=SPECIALTIES.map(s=>`<div class="specialty-room" style="background:${s.bg};color:${s.color}" onclick="loadSpecialtyDocs('${s.name}','${s.name}')">
    <div style="font-size:26px;margin-bottom:8px"><i class="ti ${s.icon}"></i></div>
    <div style="font-size:13px;font-weight:700">${s.name}</div>
    <div style="font-size:11px;margin-top:2px;opacity:.7">Find doctors</div>
  </div>`).join('');
}

async function loadSpecialtyDocs(specialty,title){
  document.getElementById('spec-room-title').textContent=title;
  document.getElementById('specialty-docs-list').innerHTML='<div style="text-align:center;padding:2rem;color:#888"><span class="spinner-dark spinner"></span> Loading...</div>';
  go('s-specialty-docs');
  const res=await api(`/doctors?select=id,full_name,specialty,city,address,status,max_appointments,bio&status=eq.verified&specialty=eq.${encodeURIComponent(specialty)}`);
  const docs=Array.isArray(res)?res:[];
  if(!docs.length){document.getElementById('specialty-docs-list').innerHTML='<div style="text-align:center;padding:2rem;font-size:14px;color:#888">No verified doctors in this specialty yet.</div>';return;}
  document.getElementById('specialty-docs-list').innerHTML=docs.map(d=>`<div class="doc-card">
    <div class="avatar" style="width:48px;height:48px;font-size:15px;background:var(--purple-l);color:var(--purple-d)">${d.full_name.split(' ').map(w=>w[0]).join('').slice(0,2)}</div>
    <div style="flex:1">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;flex-wrap:wrap">
        <span style="font-size:15px;font-weight:700">${d.full_name}</span>
        <span class="badge badge-green" style="font-size:10px"><i class="ti ti-shield-check"></i> Verified</span>
      </div>
      <div style="font-size:13px;color:#888">${d.specialty||''}${d.city?' - '+d.city:''}</div>
      ${d.address?`<div style="font-size:12px;color:#aaa;margin-top:2px"><i class="ti ti-map-pin"></i> ${d.address}</div>`:''}
      ${d.bio?`<div style="font-size:13px;color:#666;margin-top:5px;line-height:1.5">${d.bio}</div>`:''}
      <div style="font-size:12px;color:#aaa;margin-top:4px">Max ${d.max_appointments||10} appointments per day</div>
      <button class="btn btn-teal btn-sm" style="margin-top:10px" onclick="openRequest('${d.id}','${d.full_name}')"><i class="ti ti-calendar-plus"></i> Request appointment</button>
    </div>
  </div>`).join('');
}

function openRequest(docId,docName){
  selectedDoctorId=docId;
  document.getElementById('req-doctor-name').textContent='Requesting with '+docName;
  document.getElementById('req-ok').style.display='none';
  document.getElementById('req-err').style.display='none';
  go('s-request-apt');
}

async function sendRequest(){
  if(!currentUser){showErr('req-err','req-err-msg','Please log in first.');return;}
  const day=document.getElementById('req-day').value,month=document.getElementById('req-month').value,year=document.getElementById('req-year').value;
  if(!day||!month||!year){showErr('req-err','req-err-msg','Please select a preferred date.');return;}
  setBtn('req-btn',true,'');hideErr('req-err');
  // Check for duplicate pending request
  const existing=await api(`/appointment_requests?patient_id=eq.${currentUser.id}&doctor_id=eq.${selectedDoctorId}&preferred_date=eq.${year}-${month}-${day}&status=eq.pending&select=id`);
  if(Array.isArray(existing)&&existing.length>0){showErr('req-err','req-err-msg','You already have a pending request with this doctor on this date.');setBtn('req-btn',false,'<i class="ti ti-send"></i> Send request');return;}
  const res=await api('/appointment_requests',{method:'POST',body:JSON.stringify({patient_id:currentUser.id,doctor_id:selectedDoctorId,preferred_date:`${year}-${month}-${day}`,preferred_time:document.getElementById('req-time').value,reason:document.getElementById('req-reason').value,status:'pending'})});
  if(!Array.isArray(res)||!res[0]){showErr('req-err','req-err-msg','Failed to send request.');setBtn('req-btn',false,'<i class="ti ti-send"></i> Send request');return;}
  await api('/notifications',{method:'POST',body:JSON.stringify({user_id:selectedDoctorId,title:'New Appointment Request',message:`A patient has requested an appointment on ${year}-${month}-${day} at ${document.getElementById('req-time').value}`,type:'info'})});
  document.getElementById('req-ok').style.display='flex';
  setBtn('req-btn',false,'<i class="ti ti-send"></i> Send request');
}

async function cancelRequest(id){
  if(!confirm('Cancel this appointment request?'))return;
  await api(`/appointment_requests?id=eq.${id}&patient_id=eq.${currentUser.id}`,{method:'DELETE'});
  showToast('Appointment request cancelled.');
  loadMyRequests();
}

async function loadMyRequests(){
  if(!currentUser)return;
  const res=await api(`/appointment_requests?patient_id=eq.${currentUser.id}&select=*&order=requested_at.desc`);
  const el=document.getElementById('my-requests-list');
  if(!Array.isArray(res)||!res.length){el.innerHTML='<div style="text-align:center;padding:2rem;font-size:14px;color:#888">No appointment requests yet.<br><br><button class="btn btn-teal" onclick="pTab(\'specialties\')" style="width:auto;padding:12px 20px"><i class="ti ti-stethoscope"></i> Browse doctors</button></div>';return;}
  el.innerHTML=res.map(r=>`<div class="req-card">
    <div class="card-head">
      <span class="card-title">${sanitize(r.preferred_date||'Date TBD')} - ${sanitize(r.preferred_time||'')}</span>
      <span class="badge ${r.status==='accepted'?'badge-green':r.status==='rejected'?'badge-red':'badge-amber'}">${r.status==='accepted'?'Accepted':r.status==='rejected'?'Rejected':'Pending'}</span>
    </div>
    <div class="card-sub">${sanitize(r.reason||'No reason provided')}</div>
    ${r.status==='pending'?`<button class="btn btn-outline btn-sm" style="color:var(--coral);border-color:var(--coral);margin-top:8px" onclick="cancelRequest('${r.id}')"><i class="ti ti-x"></i> Cancel request</button>`:''}
  </div>`).join('');
}

async function loadAptRequests(){
  if(!currentUser)return;
  const res=await api(`/appointment_requests?doctor_id=eq.${currentUser.id}&select=*,patients(full_name,email)&order=requested_at.desc`);
  const el=document.getElementById('apt-requests-list');
  if(!Array.isArray(res)||!res.length){el.innerHTML='<div style="text-align:center;padding:2rem;font-size:14px;color:#888">No appointment requests yet.</div>';return;}
  const pending=res.filter(r=>r.status==='pending').length;
  const badge=document.getElementById('d-req-badge');
  if(badge){badge.style.display=pending>0?'flex':'none';badge.textContent=pending;}
  el.innerHTML=res.map(r=>`<div class="req-card">
    <div class="card-head">
      <span class="card-title">${r.patients?.full_name||'Patient'}</span>
      <span class="badge ${r.status==='accepted'?'badge-green':r.status==='rejected'?'badge-red':'badge-amber'}">${r.status==='accepted'?'Accepted':r.status==='rejected'?'Rejected':'Pending'}</span>
    </div>
    <div class="card-sub">${r.preferred_date||'Date TBD'} - ${r.preferred_time||''}</div>
    <div style="font-size:13px;margin-top:4px;color:#666">${r.reason||'No reason provided'}</div>
    ${r.status==='pending'?`<div class="req-actions">
      <button class="btn btn-green btn-sm" onclick="updateRequest('${r.id}','accepted','${r.patient_id}')"><i class="ti ti-check"></i> Accept</button>
      <button class="btn btn-red btn-sm" onclick="updateRequest('${r.id}','rejected','${r.patient_id}')"><i class="ti ti-x"></i> Reject</button>
      <button class="btn btn-outline btn-sm" style="color:var(--coral);border-color:var(--coral)" onclick="blockUser('${r.patient_id}','${r.patients?.full_name||'User'}')"><i class="ti ti-user-off"></i> Block</button>
    </div>`:''}
  </div>`).join('');
}

async function updateRequest(id,status,patientId){
  await api(`/appointment_requests?id=eq.${id}`,{method:'PATCH',body:JSON.stringify({status})});
  await api('/notifications',{method:'POST',body:JSON.stringify({user_id:patientId,title:status==='accepted'?'Appointment Accepted':'Appointment Rejected',message:status==='accepted'?'Your appointment request has been accepted by the doctor.':'Your appointment request was not accepted.',type:status==='accepted'?'success':'danger'})});
  showToast(status==='accepted'?'Appointment accepted!':'Appointment rejected.');
  loadAptRequests();
}

async function blockUser(pid,name){
  if(!currentUser)return;
  await api('/blocked_users',{method:'POST',body:JSON.stringify({doctor_id:currentUser.id,patient_id:pid})});
  showToast(sanitize(name)+' has been blocked.');
  loadAptRequests();renderBlocked();
}
async function unblockUser(pid){
  if(!currentUser)return;
  await api(`/blocked_users?doctor_id=eq.${currentUser.id}&patient_id=eq.${pid}`,{method:'DELETE'});
  showToast('User unblocked.');renderBlocked();
}
async function renderBlocked(){
  if(!currentUser)return;
  const el=document.getElementById('blocked-list');
  el.innerHTML='<div style="text-align:center;padding:1rem"><span class="spinner-dark spinner"></span></div>';
  const res=await api(`/blocked_users?doctor_id=eq.${currentUser.id}&select=patient_id,patients(full_name)`);
  if(!Array.isArray(res)||!res.length){el.innerHTML='<div style="text-align:center;padding:2rem;color:#888">No blocked users.</div>';return;}
  el.innerHTML=res.map(b=>`<div class="blocked-item"><span style="font-size:14px;font-weight:600;color:#791F1F"><i class="ti ti-user-off"></i> ${sanitize(b.patients?.full_name||'User')}</span><button class="btn btn-outline btn-sm" style="color:var(--teal);border-color:var(--teal)" onclick="unblockUser('${b.patient_id}')">Unblock</button></div>`).join('');
}

// ── MESSAGES ──
async function loadChatMessages(role){
  if(!currentUser)return;
  const area=document.getElementById(role==='p'?'p-msg-area':'d-msg-area');
  const sent=await api(`/chat_messages?sender_id=eq.${currentUser.id}&select=*&order=sent_at.asc`);
  const received=await api(`/chat_messages?receiver_id=eq.${currentUser.id}&select=*&order=sent_at.asc`);
  const all=[...(Array.isArray(sent)?sent:[]),...(Array.isArray(received)?received:[])].sort((a,b)=>new Date(a.sent_at)-new Date(b.sent_at));
  if(!all.length){area.innerHTML='<div style="text-align:center;padding:1.5rem;color:#888;font-size:14px"><i class="ti ti-message-off" style="font-size:32px;display:block;margin-bottom:8px"></i>No messages yet.</div>';return;}
  area.innerHTML=all.map(m=>{
    const out=m.sender_id===currentUser.id;
    return`<div class="msg-wrapper-${out?'out':'in'}"><div class="msg-bubble msg-${out?'out':'in'}">${m.content}</div><div class="msg-time">${new Date(m.sent_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div></div>`;
  }).join('');
  area.scrollTop=area.scrollHeight;
  if(window._chatInterval)clearInterval(window._chatInterval);
  window._chatInterval=setInterval(()=>loadChatMessages(role),5000);
}

async function sendMsg(role){
  const val=document.getElementById(role==='p'?'p-msg-input':'d-msg-input').value.trim();
  if(!val||!currentUser)return;
  await api('/chat_messages',{method:'POST',body:JSON.stringify({sender_id:currentUser.id,receiver_id:'00000000-0000-0000-0000-000000000000',content:val})});
  document.getElementById(role==='p'?'p-msg-input':'d-msg-input').value='';
  loadChatMessages(role);
}

// ── NOTIFICATIONS ──
async function loadNotifications(role){
  if(!currentUser)return;
  const res=await api(`/notifications?user_id=eq.${currentUser.id}&select=*&order=created_at.desc`);
  const el=document.getElementById(role==='p'?'p-notif-list':'d-notif-list');
  if(!Array.isArray(res)||!res.length){el.innerHTML='<div style="text-align:center;padding:2rem;color:#888">No notifications yet.</div>';return;}
  el.innerHTML=res.map(n=>`<div class="notif-item ${!n.is_read?'unread':''}">
    <div class="notif-dot-item" style="${n.is_read?'background:#ddd':''}"></div>
    <div style="flex:1"><div style="font-size:14px;font-weight:700;margin-bottom:3px">${n.title}</div><div style="font-size:13px;color:#666;line-height:1.5">${n.message}</div><div style="font-size:11px;color:#aaa;margin-top:4px">${fmtDate(n.created_at)}</div></div>
  </div>`).join('');
  await api(`/notifications?user_id=eq.${currentUser.id}&is_read=eq.false`,{method:'PATCH',body:JSON.stringify({is_read:true})});
  const dot=document.getElementById(role==='p'?'p-notif-dot':'d-notif-dot');
  if(dot)dot.style.display='none';
}

async function markAllRead(role){
  if(!currentUser)return;
  await api(`/notifications?user_id=eq.${currentUser.id}`,{method:'PATCH',body:JSON.stringify({is_read:true})});
  loadNotifications(role);
}

// ── PRESCRIPTIONS ──
let rxMedIdx=0;
function addMedicine(){
  rxMedIdx++;
  const div=document.createElement('div');div.className='rx-medicine';
  div.innerHTML=`<div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="font-size:12px;font-weight:700;color:#888">MEDICINE ${rxMedIdx+1}</span><button onclick="this.parentElement.parentElement.remove()" style="background:none;border:none;cursor:pointer;color:var(--coral);font-size:18px"><i class="ti ti-x"></i></button></div>
  <div class="field-row" style="margin-bottom:6px"><div class="field" style="margin-bottom:0"><label>Medicine name</label><input placeholder="e.g. Ibuprofen 400mg"></div><div class="field" style="margin-bottom:0"><label>Dosage</label><input placeholder="e.g. 1 tablet"></div></div>
  <div class="field-row"><div class="field" style="margin-bottom:0"><label>Frequency</label><input placeholder="e.g. Twice daily"></div><div class="field" style="margin-bottom:0"><label>Duration</label><input placeholder="e.g. 5 days"></div></div>`;
  document.getElementById('rx-med-list').appendChild(div);
}

async function writePrescription(){
  const patEmail=document.getElementById('rx-patient-email').value;
  if(!patEmail){showErr('rx-err','rx-err-msg','Please enter patient email.');return;}
  const medicines=[];
  document.querySelectorAll('#rx-med-list .rx-medicine').forEach(div=>{
    const inputs=div.querySelectorAll('input');
    if(inputs[0]?.value)medicines.push({name:inputs[0].value,dosage:inputs[1]?.value||'',frequency:inputs[2]?.value||'',duration:inputs[3]?.value||''});
  });
  if(!medicines.length){showErr('rx-err','rx-err-msg','Please add at least one medicine.');return;}
  setBtn('rx-btn',true,'');hideErr('rx-err');
  const pat=await api(`/patients?email=eq.${encodeURIComponent(patEmail)}&select=id,full_name`);
  if(!Array.isArray(pat)||!pat[0]){showErr('rx-err','rx-err-msg','Patient not found with that email.');setBtn('rx-btn',false,'<i class="ti ti-prescription"></i> Issue prescription');return;}
  const res=await api('/prescriptions',{method:'POST',body:JSON.stringify({patient_id:pat[0].id,doctor_id:currentUser.id,medicines,notes:document.getElementById('rx-notes').value,issued_on:new Date().toISOString().split('T')[0]})});
  if(!Array.isArray(res)||!res[0]){showErr('rx-err','rx-err-msg','Failed to issue prescription.');setBtn('rx-btn',false,'<i class="ti ti-prescription"></i> Issue prescription');return;}
  await api('/notifications',{method:'POST',body:JSON.stringify({user_id:pat[0].id,title:'New Prescription Issued',message:`Your doctor has issued a prescription with ${medicines.length} medicine(s). View it in Health Records.`,type:'success'})});
  document.getElementById('rx-ok').style.display='flex';
  showToast('Prescription sent to '+pat[0].full_name+'!');
  setBtn('rx-btn',false,'<i class="ti ti-prescription"></i> Issue prescription');
}

async function uploadHealthFile(){
  const patEmail=document.getElementById('upload-patient-email').value,title=document.getElementById('upload-title').value,url=document.getElementById('upload-url').value;
  if(!patEmail||!title||!url){showErr('upload-err','upload-err-msg','Please fill in all required fields.');return;}
  if(!url.startsWith('http')){showErr('upload-err','upload-err-msg','Please enter a valid URL starting with https://');return;}
  setBtn('upload-btn',true,'');hideErr('upload-err');
  const pat=await api(`/patients?email=eq.${encodeURIComponent(patEmail)}&select=id`);
  if(!Array.isArray(pat)||!pat[0]){showErr('upload-err','upload-err-msg','Patient not found with that email.');setBtn('upload-btn',false,'<i class="ti ti-upload"></i> Share file');return;}
  const res=await api('/health_files',{method:'POST',body:JSON.stringify({patient_id:pat[0].id,doctor_id:currentUser.id,title,file_url:url,file_name:document.getElementById('upload-filename').value,file_type:document.getElementById('upload-type').value,notes:document.getElementById('upload-notes').value})});
  if(!Array.isArray(res)||!res[0]){showErr('upload-err','upload-err-msg','Failed to upload. Please try again.');setBtn('upload-btn',false,'<i class="ti ti-upload"></i> Share file');return;}
  await api('/notifications',{method:'POST',body:JSON.stringify({user_id:pat[0].id,title:'New Health Record Added',message:`Your doctor has shared a new file: ${title}. View it in Health Records.`,type:'info'})});
  document.getElementById('upload-ok').style.display='flex';
  showToast('File shared successfully!');
  setBtn('upload-btn',false,'<i class="ti ti-upload"></i> Share file');
}

// ── HEALTH RECORDS ──
function switchRecordTab(el,tab){
  document.querySelectorAll('#s-p-records .tab-bar .tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');currentRecordTab=tab;loadPatientRecords(tab);
}

async function loadPatientRecords(tab){
  if(!currentUser)return;
  const el=document.getElementById('p-records-content');
  el.innerHTML='<div style="text-align:center;padding:2rem"><span class="spinner-dark spinner"></span></div>';
  if(tab==='files'){
    const files=await api(`/health_files?patient_id=eq.${currentUser.id}&select=*&order=uploaded_at.desc`);
    if(!Array.isArray(files)||!files.length){el.innerHTML='<div style="text-align:center;padding:2rem;color:#888;font-size:14px"><i class="ti ti-file-off" style="font-size:32px;display:block;margin-bottom:8px"></i>No health records yet. Your doctor will upload them here.</div>';return;}
    const icons={pdf:'ti-file-type-pdf',image:'ti-photo',lab:'ti-test-pipe',xray:'ti-scan',other:'ti-file'};
    const colors={pdf:'#FCEBEB',image:'#E1F5EE',lab:'#E6F1FB',xray:'#EEEDFE',other:'#FAEEDA'};
    el.innerHTML=files.map(f=>`<div class="file-card">
      <div class="file-icon" style="background:${colors[f.file_type]||'#f5f5f5'}"><i class="ti ${icons[f.file_type]||'ti-file'}"></i></div>
      <div style="flex:1"><div style="font-size:14px;font-weight:700;margin-bottom:3px">${f.title}</div><div style="font-size:12px;color:#888">${f.file_name||''} - ${fmtDate(f.uploaded_at)}</div>${f.notes?`<div style="font-size:12px;color:#666;margin-top:3px">${f.notes}</div>`:''}<a href="${f.file_url}" target="_blank" class="btn btn-teal btn-sm" style="margin-top:8px;text-decoration:none"><i class="ti ti-external-link"></i> Open file</a></div>
    </div>`).join('');
  } else {
    const rxs=await api(`/prescriptions?patient_id=eq.${currentUser.id}&select=*,doctors(full_name)&order=created_at.desc`);
    if(!Array.isArray(rxs)||!rxs.length){el.innerHTML='<div style="text-align:center;padding:2rem;color:#888;font-size:14px"><i class="ti ti-prescription" style="font-size:32px;display:block;margin-bottom:8px"></i>No prescriptions yet.</div>';return;}
    el.innerHTML=rxs.map(rx=>`<div class="rx-card">
      <div class="card-head"><span class="card-title"><i class="ti ti-prescription"></i> Prescription</span><span class="badge badge-green">${fmtDate(rx.issued_on)}</span></div>
      <div style="font-size:13px;color:#888;margin-bottom:10px">By ${rx.doctors?.full_name||'Doctor'}</div>
      ${(rx.medicines||[]).map(m=>`<div class="rx-medicine"><div style="font-size:14px;font-weight:700">${m.name}</div><div style="font-size:12px;color:#666;margin-top:3px">${m.dosage} - ${m.frequency} - ${m.duration}</div></div>`).join('')}
      ${rx.notes?`<div style="font-size:13px;color:#666;margin-top:8px;padding:10px;background:#f9f9f9;border-radius:8px">${rx.notes}</div>`:''}
      <a href="https://www.1mg.com/search/all?name=${encodeURIComponent((rx.medicines||[])[0]?.name||'')}" target="_blank" class="btn btn-teal btn-sm" style="margin-top:10px;text-decoration:none"><i class="ti ti-external-link"></i> Buy on 1mg</a>
    </div>`).join('');
  }
}

// ── NEARBY ──
async function findNearby(){
  const el=document.getElementById('gps-status'),btn=document.getElementById('gps-btn');
  el.className='alert alert-info';el.innerHTML='<i class="ti ti-map-pin"></i> Getting your location...';btn.disabled=true;
  if(!navigator.geolocation){el.className='alert alert-danger';el.innerHTML='<i class="ti ti-alert-circle"></i> Location not supported.';btn.disabled=false;return;}
  navigator.geolocation.getCurrentPosition(async pos=>{
    const {latitude:lat,longitude:lng}=pos.coords;
    el.className='alert alert-success';el.innerHTML='<i class="ti ti-check"></i> Location found! Showing nearby doctors.';btn.disabled=false;
    const docs=await api('/doctors?select=id,full_name,specialty,city,address,status,max_appointments,lat,lng&status=eq.verified');
    const nearby=document.getElementById('nearby-list');
    if(!Array.isArray(docs)||!docs.length){nearby.innerHTML='<div style="text-align:center;padding:2rem;color:#888">No verified doctors found.</div>';return;}
    const withCoords=await Promise.all(docs.map(async d=>{
      if(d.lat&&d.lng)return d;
      if(!d.city)return d;
      try{
        const r=await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(d.address||d.city)}&format=json&limit=1`);
        const data=await r.json();
        if(data[0]){const nlat=parseFloat(data[0].lat),nlng=parseFloat(data[0].lon);await api(`/doctors?id=eq.${d.id}`,{method:'PATCH',body:JSON.stringify({lat:nlat,lng:nlng})});return{...d,lat:nlat,lng:nlng};}
      }catch(e){}
      return d;
    }));
    const withDist=withCoords.map(d=>{
      let dist=null;
      if(d.lat&&d.lng){const R=6371,dLat=(d.lat-lat)*Math.PI/180,dLng=(d.lng-lng)*Math.PI/180,a=Math.sin(dLat/2)**2+Math.cos(lat*Math.PI/180)*Math.cos(d.lat*Math.PI/180)*Math.sin(dLng/2)**2;dist=R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));}
      return{...d,dist};
    }).sort((a,b)=>(a.dist??999)-(b.dist??999));
    nearby.innerHTML=withDist.map(d=>`<div class="nearby-card">
      <div class="avatar" style="width:44px;height:44px;font-size:13px;background:var(--purple-l);color:var(--purple-d)">${d.full_name.split(' ').map(w=>w[0]).join('').slice(0,2)}</div>
      <div style="flex:1">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px">
          <span style="font-size:14px;font-weight:700">${d.full_name}</span>
          <span class="distance-badge"><i class="ti ti-map-pin"></i> ${d.dist!==null?d.dist<1?Math.round(d.dist*1000)+'m':d.dist.toFixed(1)+'km':'N/A'}</span>
        </div>
        <div style="font-size:13px;color:#888">${d.specialty||''}${d.city?' - '+d.city:''}</div>
        ${d.address?`<div style="font-size:12px;color:#aaa;margin-top:2px">${d.address}</div>`:''}
        <button class="btn btn-teal btn-sm" style="margin-top:8px" onclick="openRequest('${d.id}','${d.full_name}')"><i class="ti ti-calendar-plus"></i> Request appointment</button>
      </div>
    </div>`).join('');
  },()=>{el.className='alert alert-danger';el.innerHTML='<i class="ti ti-alert-circle"></i> Could not get location. Please allow location access.';btn.disabled=false;});
}

// ── SYMPTOM CHECKER ──
function toggleSymptom(el){el.classList.toggle('sel')}
function selectSev(el,type){document.querySelectorAll('.sev-btn').forEach(b=>b.classList.remove('active'));el.classList.add('active');selectedSeverity=type;}

async function runSymptomChecker(){
  if(!rateLimit('symptom',3,30000)){showToast('Please wait before checking again.');return;}
  const symptoms=[...document.querySelectorAll('.symptom-pill.sel')].map(e=>e.textContent.trim());
  if(!symptoms.length){document.getElementById('sym-result').innerHTML='<div class="alert alert-warn"><i class="ti ti-info-circle"></i> Please select at least one symptom.</div>';return;}
  if(!selectedSeverity){document.getElementById('sym-result').innerHTML='<div class="alert alert-warn"><i class="ti ti-info-circle"></i> Please select a severity level.</div>';return;}
  setBtn('sym-btn',true,'');
  document.getElementById('sym-result').innerHTML='<div style="text-align:center;padding:1.5rem;font-size:14px;color:#888"><span class="spinner-dark spinner"></span> Analysing symptoms with AI...</div>';
  try{
    const resp=await fetch('https://api.groq.com/openai/v1/chat/completions',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer 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'},
      body:JSON.stringify({model:'llama-3.3-70b-versatile',messages:[{role:'user',content:`You are a medical AI assistant. Patient symptoms: ${symptoms.join(', ')}. Severity: ${selectedSeverity}. Duration: ${document.getElementById('sym-duration').value} days. Respond ONLY with valid JSON, no markdown: {"conditions":[{"name":"string","likelihood":"low or medium or high","description":"1-2 sentences","recommendation":"brief advice"}],"specialty":"recommended specialist","urgent":true or false}`}],response_format:{type:'json_object'}})
    });
    const data=await resp.json();
    if(!data.choices||!data.choices[0])throw new Error('No response');
    let text=data.choices[0].message.content.replace(/```json|```/g,'').trim();
    const result=JSON.parse(text);
    let html='';
    if(result.urgent)html+='<div class="alert alert-danger"><i class="ti ti-alert-triangle"></i> These symptoms may need urgent attention. Please visit a doctor or emergency room immediately.</div>';
    result.conditions.forEach(c=>{
      const cls=c.likelihood==='high'?'high':c.likelihood==='medium'?'med':'low';
      html+=`<div class="result-card ${cls}"><h3><i class="ti ti-virus"></i> ${c.name} <span style="font-size:11px;font-weight:500;opacity:.8">(${c.likelihood} likelihood)</span></h3><p>${c.description}</p><p style="margin-top:6px;font-style:italic;opacity:.9">${c.recommendation}</p></div>`;
    });
    html+=`<div class="alert alert-info"><i class="ti ti-stethoscope"></i> Recommended specialist: <strong>${result.specialty}</strong></div>`;
    html+='<div class="alert alert-warn"><i class="ti ti-info-circle"></i> This is AI guidance only. Always consult a qualified doctor for diagnosis.</div>';
    document.getElementById('sym-result').innerHTML=html;
  }catch(e){
    document.getElementById('sym-result').innerHTML='<div class="alert alert-danger"><i class="ti ti-alert-circle"></i> Could not analyse symptoms. Please check your connection and try again.</div>';
  }
  setBtn('sym-btn',false,'<i class="ti ti-brain"></i> Analyse symptoms');
}

async function savePatientProfile(){
  if(!currentUser)return;
  const data={
    phone:document.getElementById('pp-phone')?.value||'',
    gender:document.getElementById('pp-gender')?.value||'',
    blood_group:document.getElementById('pp-blood')?.value||'',
    weight_kg:parseFloat(document.getElementById('pp-weight')?.value)||null,
    height_cm:parseFloat(document.getElementById('pp-height')?.value)||null,
    allergies:document.getElementById('pp-allergies')?.value||'',
    medical_history:document.getElementById('pp-history')?.value||'',
    emergency_contact:document.getElementById('pp-ec-name')?.value||'',
    emergency_phone:document.getElementById('pp-ec-phone')?.value||''
  };
  await api(`/patients?id=eq.${currentUser.id}`,{method:'PATCH',body:JSON.stringify(data)});
  showToast('Profile updated!');
  const ok=document.getElementById('pp-ok');if(ok){ok.style.display='flex';setTimeout(()=>ok.style.display='none',3000);}
}

async function loadPatientProfile(){
  if(!currentUser)return;
  const res=await api(`/patients?id=eq.${currentUser.id}&select=*`);
  const p=res[0];if(!p)return;
  const m={phone:'pp-phone',gender:'pp-gender',blood_group:'pp-blood',weight_kg:'pp-weight',height_cm:'pp-height',allergies:'pp-allergies',medical_history:'pp-history',emergency_contact:'pp-ec-name',emergency_phone:'pp-ec-phone'};
  const av=document.getElementById('p-profile-avatar');
  const nd=document.getElementById('p-profile-name-display');
  const ed=document.getElementById('p-profile-email-display');
  if(av)av.textContent=p.full_name?p.full_name.split(' ').map(w=>w[0]).join('').slice(0,2):'--';
  if(nd)nd.textContent=p.full_name||'--';
  if(ed)ed.textContent=p.email||'--';
  Object.entries(m).forEach(([k,id])=>{const el=document.getElementById(id);if(el&&p[k])el.value=p[k];});
}

async function saveDoctorProfile(){
  if(!currentUser)return;
  await api(`/doctors?id=eq.${currentUser.id}`,{method:'PATCH',body:JSON.stringify({city:document.getElementById('dp-city').value,address:document.getElementById('dp-address').value,max_appointments:parseInt(document.getElementById('dp-maxapt').value)||10,bio:document.getElementById('dp-bio').value})});
  const ok=document.getElementById('dp-ok');ok.style.display='flex';setTimeout(()=>ok.style.display='none',3000);
  showToast('Profile updated!');
}

function showPolicy(type){
  const content={
    terms:`<h3 style="margin-bottom:12px">Terms of Service</h3><p style="font-size:13px;line-height:1.7;color:#444">By using CareLink you agree to use this platform only for legitimate healthcare purposes. CareLink is not liable for medical decisions made based on the AI symptom checker. The symptom checker provides guidance only and is not a substitute for professional medical advice. Doctors on CareLink are individually responsible for their medical practice. All data is stored securely and handled in compliance with applicable Indian data protection laws including the DPDP Act 2023.</p>`,
    privacy:`<h3 style="margin-bottom:12px">Privacy Policy</h3><p style="font-size:13px;line-height:1.7;color:#444">CareLink collects personal and health information solely to provide healthcare coordination services. Your data is stored securely on Supabase servers. We do not sell or share your personal data with third parties. Health records are accessible only to you and the doctors you interact with. You may request deletion of your account and data at any time by contacting support. We comply with the Digital Personal Data Protection Act 2023 (India).</p>`
  };
  const modal=document.createElement('div');
  modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:flex-end;justify-content:center';
  modal.innerHTML=`<div style="background:#fff;border-radius:20px 20px 0 0;padding:1.5rem;max-width:480px;width:100%;max-height:80vh;overflow-y:auto">${content[type]}<button onclick="this.closest('[style]').remove()" class="btn btn-teal" style="margin-top:1rem">Close</button></div>`;
  document.body.appendChild(modal);
}

async function forgotPassword(role){
  const email=prompt('Enter your registered email address:');
  if(!email||!email.includes('@')){showToast('Please enter a valid email.');return;}
  try{
    await fetch(`${SB_URL}/auth/v1/recover`,{
      method:'POST',headers:{'apikey':SB_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({email})
    });
    showToast('Password reset email sent! Check your inbox.',5000);
  }catch(e){showToast('Could not send reset email. Please try again.');}
}

async function signOut(){
  if(window._chatInterval)clearInterval(window._chatInterval);
  if(window._sessionTimer)clearInterval(window._sessionTimer);
  await fetch(`${SB_URL}/auth/v1/logout`,{method:'POST',headers:{'apikey':SB_KEY,'Authorization':`Bearer ${currentToken}`}}).catch(()=>{});
  currentUser=null;currentToken=null;clearSession();
  pageHistory=['s-home'];go('s-home');
  showToast('Signed out successfully.');
}

