import { useState, useEffect, useCallback } from "react";
import { initializeApp } from "firebase/app";
import {
  getAuth, signInWithEmailAndPassword, signOut,
  onAuthStateChanged, createUserWithEmailAndPassword,
} from "firebase/auth";
import {
  getFirestore, doc, setDoc, getDoc, getDocs,
  collection, query, where, orderBy, serverTimestamp,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDKQnzG2J1wtWpENtFf2b9-XNnfte1niR0",
  authDomain: "attendtrack-3a9dc.firebaseapp.com",
  projectId: "attendtrack-3a9dc",
  storageBucket: "attendtrack-3a9dc.firebasestorage.app",
  messagingSenderId: "532454978373",
  appId: "1:532454978373:web:4137905a0e0bdd94b4c42c",
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app, "default");

// ─── UTILS ─────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().split("T")[0];
const formatTime = (d) => d.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
const formatDate = (s) => new Date(s+"T00:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",year:"numeric"});
const toMin = (s) => { const [h,m]=s.split(":").map(Number); return h*60+m; };

function getWindowStatus(w, now=new Date()){
  const cur = now.getHours()*60+now.getMinutes();
  const s=toMin(w.start), l=toMin(w.lateAfter), e=toMin(w.end);
  if(cur<s) return "early";
  if(cur>=s && cur<=l) return "on_time";
  if(cur>l && cur<=e) return "late";
  return "closed";
}

// ─── GLOBAL STYLES ─────────────────────────────────────────────
const GS = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Space+Mono&display=swap');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    :root{
      --bg:#0a0f1e;--surf:#111827;--surf2:#1a2235;--surf3:#243050;
      --brd:rgba(255,255,255,0.08);--brd2:rgba(255,255,255,0.14);
      --txt:#f0f4ff;--txt2:#94a3b8;--txt3:#64748b;
      --acc:#4f8ef7;--acc2:#6366f1;
      --grn:#22c55e;--ylw:#f59e0b;--red:#ef4444;
      --font:'DM Sans',sans-serif;--mono:'Space Mono',monospace;
      --rad:14px;--radsm:8px;
    }
    html,body,#root{height:100%}
    body{font-family:var(--font);background:var(--bg);color:var(--txt);line-height:1.6;-webkit-font-smoothing:antialiased}
    input,button,select{font-family:var(--font)}
    ::-webkit-scrollbar{width:6px}
    ::-webkit-scrollbar-track{background:var(--surf)}
    ::-webkit-scrollbar-thumb{background:var(--surf3);border-radius:3px}
    @keyframes fadeIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
    @keyframes spin{to{transform:rotate(360deg)}}
    .fade-in{animation:fadeIn .4s ease both}
    .spinner{width:20px;height:20px;border:2px solid rgba(255,255,255,.2);border-top-color:white;border-radius:50%;animation:spin .7s linear infinite;display:inline-block}
    .grid-bg{background-image:linear-gradient(rgba(79,142,247,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(79,142,247,.04) 1px,transparent 1px);background-size:48px 48px}
    .card{background:var(--surf);border:1px solid var(--brd);border-radius:var(--rad);padding:24px}
    .badge{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600}
    .bg{background:rgba(34,197,94,.15);color:var(--grn)}
    .by{background:rgba(245,158,11,.15);color:var(--ylw)}
    .br{background:rgba(239,68,68,.15);color:var(--red)}
    .bb{background:rgba(79,142,247,.15);color:var(--acc)}
    table{width:100%;border-collapse:collapse}
    th{text-align:left;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--txt3);padding:10px 16px;border-bottom:1px solid var(--brd)}
    td{padding:13px 16px;font-size:14px;border-bottom:1px solid var(--brd);color:var(--txt2)}
    tr:last-child td{border-bottom:none}
    tr:hover td{background:rgba(255,255,255,.02)}
    .btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:10px 20px;border-radius:var(--radsm);font-size:14px;font-weight:600;cursor:pointer;transition:all .2s;border:none;outline:none;white-space:nowrap}
    .btn:disabled{opacity:.5;cursor:not-allowed}
    .btn-p{background:var(--acc);color:white}
    .btn-p:hover:not(:disabled){background:#3d7de8;transform:translateY(-1px)}
    .btn-g{background:transparent;color:var(--txt2);border:1px solid var(--brd2)}
    .btn-g:hover:not(:disabled){background:var(--surf2);color:var(--txt)}
    .input-group{display:flex;flex-direction:column;gap:6px}
    .input-group label{font-size:13px;font-weight:500;color:var(--txt2)}
    .input{background:var(--surf2);border:1px solid var(--brd2);border-radius:var(--radsm);padding:11px 14px;color:var(--txt);font-size:14px;transition:border-color .2s,box-shadow .2s;width:100%;outline:none}
    .input:focus{border-color:var(--acc);box-shadow:0 0 0 3px rgba(79,142,247,.15)}
    .input::placeholder{color:var(--txt3)}
    #toast-wrap{position:fixed;top:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px}
    .toast{display:flex;align-items:center;gap:10px;padding:12px 18px;border-radius:var(--radsm);font-size:14px;font-weight:500;box-shadow:0 8px 30px rgba(0,0,0,.4);animation:fadeIn .3s ease both;max-width:360px;color:white}
    .t-s{background:#16a34a}.t-e{background:#dc2626}.t-i{background:var(--acc)}
    @media(max-width:768px){.hide-mobile{display:none!important}.card{padding:16px}}
  `}</style>
);

// ─── TOAST ─────────────────────────────────────────────────────
let _addToast = null;
const toast = {
  success: m => _addToast?.({id:Date.now(),type:"s",msg:m}),
  error:   m => _addToast?.({id:Date.now(),type:"e",msg:m}),
  info:    m => _addToast?.({id:Date.now(),type:"i",msg:m}),
};
const Toasts = () => {
  const [list, setList] = useState([]);
  useEffect(()=>{
    _addToast = t => { setList(p=>[...p,t]); setTimeout(()=>setList(p=>p.filter(x=>x.id!==t.id)),3500); };
    return ()=>{ _addToast=null; };
  },[]);
  return (
    <div id="toast-wrap">
      {list.map(t=>(
        <div key={t.id} className={`toast t-${t.type}`}>
          {t.type==="s"?"✓":t.type==="e"?"✗":"ℹ"} {t.msg}
        </div>
      ))}
    </div>
  );
};

// ─── NAV ───────────────────────────────────────────────────────
const Nav = ({user, now}) => (
  <nav style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 24px",borderBottom:"1px solid var(--brd)",background:"rgba(10,15,30,0.9)",backdropFilter:"blur(12px)",position:"sticky",top:0,zIndex:100}}>
    <div style={{display:"flex",alignItems:"center",gap:12}}>
      <div style={{width:36,height:36,borderRadius:10,background:"linear-gradient(135deg,var(--acc),var(--acc2))",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>📋</div>
      <div>
        <div style={{fontWeight:700,fontSize:16}}>
          AttendTrack
          {user.role==="admin" && <span style={{fontSize:11,background:"rgba(99,102,241,.2)",color:"#818cf8",padding:"2px 7px",borderRadius:5,marginLeft:8,fontWeight:700}}>ADMIN</span>}
        </div>
        <div style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--txt3)"}}>{formatTime(now)}</div>
      </div>
    </div>
    <div style={{display:"flex",alignItems:"center",gap:10}}>
      <span className="hide-mobile" style={{fontSize:13,color:"var(--txt2)"}}>{user.name}</span>
      <button className="btn btn-g" onClick={()=>signOut(auth)} style={{padding:"7px 14px",fontSize:13}}>Sign Out</button>
    </div>
  </nav>
);

// ─── LOGIN ─────────────────────────────────────────────────────
const Login = () => {
  const [email,setEmail]=useState("");
  const [pass,setPass]=useState("");
  const [loading,setLoading]=useState(false);
  const [now,setNow]=useState(new Date());
  useEffect(()=>{ const t=setInterval(()=>setNow(new Date()),1000); return ()=>clearInterval(t); },[]);

  const handle = async e => {
    e.preventDefault(); setLoading(true);
    try {
      await signInWithEmailAndPassword(auth,email,pass);
      toast.success("স্বাগতম!");
    } catch(err) {
      toast.error("Email বা Password ভুল");
    } finally { setLoading(false); }
  };

  return (
    <div className="grid-bg" style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div className="fade-in" style={{width:"100%",maxWidth:420}}>
        <div style={{textAlign:"center",marginBottom:36}}>
          <div style={{width:64,height:64,borderRadius:16,background:"linear-gradient(135deg,var(--acc),var(--acc2))",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 18px",fontSize:28}}>🔐</div>
          <h1 style={{fontSize:28,fontWeight:700,letterSpacing:"-.02em"}}>AttendTrack</h1>
          <p style={{color:"var(--txt2)",marginTop:6,fontSize:14}}>Workforce Attendance Management</p>
          <div style={{fontFamily:"var(--mono)",fontSize:13,color:"var(--acc)",marginTop:10}}>{formatTime(now)}</div>
        </div>
        <div className="card" style={{boxShadow:"0 25px 60px rgba(0,0,0,.4)"}}>
          <h2 style={{fontSize:18,fontWeight:600,marginBottom:24}}>Sign In</h2>
          <form onSubmit={handle} style={{display:"flex",flexDirection:"column",gap:16}}>
            <div className="input-group">
              <label>Email</label>
              <input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com" required/>
            </div>
            <div className="input-group">
              <label>Password</label>
              <input className="input" type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••" required/>
            </div>
            <button className="btn btn-p" type="submit" disabled={loading} style={{padding:13,fontSize:15,borderRadius:10,background:"linear-gradient(135deg,var(--acc),var(--acc2))"}}>
              {loading ? <span className="spinner"/> : "Sign In →"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

// ─── EMPLOYEE DASHBOARD ────────────────────────────────────────
const EmpDash = ({user}) => {
  const [now,setNow]=useState(new Date());
  const [win,setWin]=useState(null);
  const [rec,setRec]=useState(null);
  const [hist,setHist]=useState([]);
  const [marking,setMarking]=useState(false);

  useEffect(()=>{ const t=setInterval(()=>setNow(new Date()),1000); return ()=>clearInterval(t); },[]);

  const load = useCallback(async()=>{
    try {
      const wDoc=await getDoc(doc(db,"settings","attendance_window"));
      if(wDoc.exists()) setWin(wDoc.data());
      const today=todayStr();
      const rDoc=await getDoc(doc(db,"attendance",`${user.uid}_${today}`));
      if(rDoc.exists()) setRec(rDoc.data());
      const q=query(collection(db,"attendance"),where("uid","==",user.uid),orderBy("date","desc"));
      const snap=await getDocs(q);
      setHist(snap.docs.slice(0,14).map(d=>d.data()));
    } catch(e){ toast.error("Data load হয়নি"); }
  },[user.uid]);

  useEffect(()=>{ load(); },[load]);

  const mark = async()=>{
    if(!win) return toast.error("Time window set নেই");
    setMarking(true);
    try {
      const ws=getWindowStatus(win,now);
      if(ws==="early") return toast.info("এখনো attendance window খোলেনি");
      if(ws==="closed") return toast.error("Attendance window বন্ধ");
      const today=todayStr();
      const status=ws==="on_time"?"present":"late";
      await setDoc(doc(db,"attendance",`${user.uid}_${today}`),{
        uid:user.uid, name:user.name, email:user.email,
        date:today, time:formatTime(now), markedAt:now.toISOString(),
        status, timestamp:serverTimestamp(),
      });
      setRec({date:today,time:formatTime(now),status});
      toast.success(status==="present"?"✓ উপস্থিত — সময়মতো!":"⚠ উপস্থিত — দেরিতে");
      load();
    } catch(e){ toast.error("Mark করা যায়নি"); }
    finally { setMarking(false); }
  };

  const ws = win ? getWindowStatus(win,now) : null;
  const presentN=hist.filter(r=>r.status==="present").length;
  const lateN=hist.filter(r=>r.status==="late").length;
  const wsLabels={early:"bb",on_time:"bg",late:"by",closed:"br"};
  const wsTxt={early:"⏳ খোলেনি",on_time:"● Open",late:"● Late Window",closed:"● বন্ধ"};

  return (
    <div className="grid-bg" style={{minHeight:"100vh",display:"flex",flexDirection:"column"}}>
      <Nav user={user} now={now}/>
      <main style={{flex:1,padding:"28px 20px"}}>
        <div className="fade-in" style={{maxWidth:860,margin:"0 auto",display:"grid",gap:20}}>
          <div>
            <h1 style={{fontSize:24,fontWeight:700,letterSpacing:"-.02em"}}>
              {now.getHours()<12?"সুপ্রভাত":now.getHours()<17?"শুভ অপরাহ্ন":"শুভ সন্ধ্যা"}, {user.name.split(" ")[0]} 👋
            </h1>
            <p style={{color:"var(--txt2)",marginTop:4,fontSize:13}}>{new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</p>
          </div>

          {win && (
            <div className="card" style={{display:"flex",alignItems:"center",gap:14}}>
              <div style={{width:44,height:44,borderRadius:10,background:"rgba(79,142,247,.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>🕐</div>
              <div style={{flex:1}}>
                <div style={{fontSize:12,color:"var(--txt3)",marginBottom:2}}>আজকের Attendance Window</div>
                <div style={{fontWeight:600}}>{win.start} — {win.end} · On time before {win.lateAfter}</div>
              </div>
              {ws && <span className={`badge ${wsLabels[ws]}`}>{wsTxt[ws]}</span>}
            </div>
          )}

          <div className="card" style={{textAlign:"center",padding:"44px 24px"}}>
            {rec ? (
              <>
                <div style={{width:72,height:72,borderRadius:"50%",background:rec.status==="present"?"rgba(34,197,94,.14)":"rgba(245,158,11,.14)",border:`2px solid ${rec.status==="present"?"var(--grn)":"var(--ylw)"}`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",fontSize:28}}>{rec.status==="present"?"✓":"⚠"}</div>
                <h2 style={{fontSize:20,fontWeight:700,marginBottom:8}}>Attendance Recorded</h2>
                <p style={{color:"var(--txt2)",marginBottom:14,fontSize:13}}>Marked at <strong style={{color:"var(--txt)"}}>{rec.time}</strong></p>
                <span className={`badge ${rec.status==="present"?"bg":"by"}`} style={{fontSize:13,padding:"5px 16px"}}>{rec.status==="present"?"✓ On Time":"⚠ Late"}</span>
              </>
            ) : (
              <>
                <div style={{width:72,height:72,borderRadius:"50%",background:"rgba(79,142,247,.1)",border:"2px solid rgba(79,142,247,.25)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",fontSize:28}}>🖐</div>
                <h2 style={{fontSize:20,fontWeight:700,marginBottom:8}}>Mark Your Attendance</h2>
                <p style={{color:"var(--txt2)",marginBottom:22,fontSize:13,maxWidth:320,margin:"0 auto 22px"}}>
                  {ws==="early"?"Window এখনো খোলেনি":ws==="on_time"?"Window Open! এখনই mark করুন":ws==="late"?"দেরি হয়ে গেছে — Late হিসেবে record হবে":"Window বন্ধ হয়ে গেছে"}
                </p>
                <button
                  className="btn"
                  onClick={mark}
                  disabled={marking||!ws||ws==="early"||ws==="closed"}
                  style={{padding:"13px 40px",fontSize:15,borderRadius:12,border:"none",color:"white",cursor:ws==="on_time"||ws==="late"?"pointer":"not-allowed",background:ws==="on_time"?"linear-gradient(135deg,var(--acc),var(--acc2))":ws==="late"?"linear-gradient(135deg,var(--ylw),#d97706)":"var(--surf3)"}}
                >
                  {marking?<span className="spinner"/>:ws==="on_time"?"✓ Mark Present":ws==="late"?"⚠ Mark Late":"Unavailable"}
                </button>
              </>
            )}
          </div>

          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
            {[{l:"On Time",v:presentN,c:"var(--grn)",bg:"rgba(34,197,94,.08)"},{l:"Late",v:lateN,c:"var(--ylw)",bg:"rgba(245,158,11,.08)"},{l:"Records",v:hist.length,c:"var(--acc)",bg:"rgba(79,142,247,.08)"}].map(s=>(
              <div key={s.l} className="card" style={{textAlign:"center",background:s.bg,borderColor:"transparent"}}>
                <div style={{fontSize:30,fontWeight:700,color:s.c,fontFamily:"var(--mono)",lineHeight:1}}>{s.v}</div>
                <div style={{fontSize:12,color:"var(--txt2)",marginTop:6}}>{s.l}</div>
              </div>
            ))}
          </div>

          {hist.length>0 && (
            <div className="card" style={{padding:0,overflow:"hidden"}}>
              <div style={{padding:"14px 20px",borderBottom:"1px solid var(--brd)",fontWeight:600}}>Attendance History</div>
              <table>
                <thead><tr><th>Date</th><th>Time</th><th>Status</th></tr></thead>
                <tbody>
                  {hist.map((r,i)=>(
                    <tr key={i}>
                      <td style={{color:"var(--txt)",fontWeight:500}}>{formatDate(r.date)}</td>
                      <td style={{fontFamily:"var(--mono)",fontSize:13}}>{r.time}</td>
                      <td><span className={`badge ${r.status==="present"?"bg":"by"}`}>{r.status==="present"?"On Time":"Late"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

// ─── ADMIN DASHBOARD ───────────────────────────────────────────
const AdminDash = ({user}) => {
  const [tab,setTab]=useState("overview");
  const [employees,setEmployees]=useState([]);
  const [attendance,setAttendance]=useState([]);
  const [filterDate,setFilterDate]=useState(todayStr());
  const [win,setWin]=useState({start:"08:00",end:"08:30",lateAfter:"08:35"});
  const [newEmp,setNewEmp]=useState({name:"",email:"",password:""});
  const [loading,setLoading]=useState(false);
  const [saving,setSaving]=useState(false);
  const [adding,setAdding]=useState(false);
  const [now,setNow]=useState(new Date());

  useEffect(()=>{ const t=setInterval(()=>setNow(new Date()),1000); return ()=>clearInterval(t); },[]);

  const load = useCallback(async()=>{
    setLoading(true);
    try {
      const [eSnap,aSnap,wDoc]=await Promise.all([
        getDocs(collection(db,"employees")),
        getDocs(query(collection(db,"attendance"),where("date","==",filterDate),orderBy("timestamp","asc"))),
        getDoc(doc(db,"settings","attendance_window")),
      ]);
      setEmployees(eSnap.docs.map(d=>({id:d.id,...d.data()})).filter(e=>e.role!=="admin"));
      setAttendance(aSnap.docs.map(d=>d.data()));
      if(wDoc.exists()) setWin(wDoc.data());
    } catch(e){ toast.error("Data load হয়নি"); }
    finally { setLoading(false); }
  },[filterDate]);

  useEffect(()=>{ load(); },[load]);

  const saveWin = async()=>{
    setSaving(true);
    try { await setDoc(doc(db,"settings","attendance_window"),win); toast.success("Settings saved!"); }
    catch{ toast.error("Save হয়নি"); }
    finally { setSaving(false); }
  };

  const addEmp = async e=>{
    e.preventDefault(); setAdding(true);
    try {
      const cred=await createUserWithEmailAndPassword(auth,newEmp.email,newEmp.password);
      await setDoc(doc(db,"employees",cred.user.uid),{name:newEmp.name,email:newEmp.email,role:"employee",createdAt:serverTimestamp()});
      setNewEmp({name:"",email:"",password:""});
      toast.success(`${newEmp.name} যোগ করা হয়েছে!`);
      load();
    } catch(err){ toast.error(err.message.replace("Firebase: ","")); }
    finally { setAdding(false); }
  };

  const exportCSV = ()=>{
    let csv="Name,Email,Date,Time,Status\n";
    employees.forEach(emp=>{
      const r=attendance.find(a=>a.uid===emp.id);
      csv+=`${emp.name},${emp.email},${filterDate},${r?r.time:"-"},${r?r.status:"absent"}\n`;
    });
    const a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
    a.download=`attendance_${filterDate}.csv`; a.click();
    toast.success("CSV exported!");
  };

  const presentN=attendance.filter(r=>r.status==="present").length;
  const lateN=attendance.filter(r=>r.status==="late").length;
  const absentN=Math.max(0,employees.length-attendance.length);
  const rate=employees.length?Math.round((attendance.length/employees.length)*100):0;

  const TABS=[{id:"overview",l:"📊 Overview"},{id:"attendance",l:"📅 Attendance"},{id:"employees",l:"👥 Employees"},{id:"settings",l:"⚙️ Settings"}];

  return (
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column"}}>
      <Nav user={user} now={now}/>
      <div style={{display:"flex",flex:1}}>
        {/* Sidebar */}
        <aside className="hide-mobile" style={{width:210,borderRight:"1px solid var(--brd)",padding:"20px 12px",background:"var(--surf)",flexShrink:0}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",borderRadius:8,border:"none",cursor:"pointer",fontFamily:"var(--font)",fontSize:13,fontWeight:500,textAlign:"left",width:"100%",marginBottom:3,transition:"all .15s",background:tab===t.id?"rgba(79,142,247,.12)":"transparent",color:tab===t.id?"var(--acc)":"var(--txt2)"}}>
              {t.l}
            </button>
          ))}
        </aside>

        <main style={{flex:1,padding:"24px 20px",overflowY:"auto"}} className="grid-bg">
          {/* Mobile tabs */}
          <div style={{display:"flex",gap:4,marginBottom:20,overflowX:"auto",paddingBottom:4}}>
            {TABS.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"7px 14px",borderRadius:8,border:"1px solid var(--brd)",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"var(--font)",flexShrink:0,background:tab===t.id?"var(--acc)":"var(--surf)",color:tab===t.id?"white":"var(--txt2)"}}>
                {t.l}
              </button>
            ))}
          </div>

          <div className="fade-in" style={{maxWidth:900,margin:"0 auto"}}>

            {/* OVERVIEW */}
            {tab==="overview" && (
              <div style={{display:"grid",gap:20}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
                  <div>
                    <h1 style={{fontSize:22,fontWeight:700}}>Dashboard</h1>
                    <p style={{color:"var(--txt2)",fontSize:13,marginTop:2}}>{formatDate(filterDate)}</p>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <input className="input" type="date" value={filterDate} onChange={e=>setFilterDate(e.target.value)} style={{width:"auto"}}/>
                    <button className="btn btn-g" onClick={load}>{loading?<span className="spinner"/>:"↺"}</button>
                    <button className="btn btn-g" onClick={exportCSV}>↓ CSV</button>
                  </div>
                </div>

                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:14}}>
                  {[{l:"Total",v:employees.length,c:"var(--acc)",bg:"rgba(79,142,247,.08)"},{l:"Present",v:presentN,c:"var(--grn)",bg:"rgba(34,197,94,.08)"},{l:"Late",v:lateN,c:"var(--ylw)",bg:"rgba(245,158,11,.08)"},{l:"Absent",v:absentN,c:"var(--red)",bg:"rgba(239,68,68,.08)"}].map(s=>(
                    <div key={s.l} className="card" style={{background:s.bg,borderColor:"transparent"}}>
                      <div style={{fontSize:36,fontWeight:700,color:s.c,fontFamily:"var(--mono)",lineHeight:1}}>{s.v}</div>
                      <div style={{fontSize:13,color:"var(--txt2)",marginTop:6}}>{s.l}</div>
                    </div>
                  ))}
                </div>

                {employees.length>0 && (
                  <div className="card">
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
                      <span style={{fontWeight:600}}>Attendance Rate</span>
                      <span style={{fontFamily:"var(--mono)",color:"var(--acc)",fontWeight:700}}>{rate}%</span>
                    </div>
                    <div style={{height:8,background:"var(--surf2)",borderRadius:4,overflow:"hidden"}}>
                      <div style={{height:"100%",borderRadius:4,background:"linear-gradient(90deg,var(--grn),var(--acc))",width:`${rate}%`,transition:"width .5s ease"}}/>
                    </div>
                  </div>
                )}

                <div className="card" style={{padding:0,overflow:"hidden"}}>
                  <div style={{padding:"14px 20px",borderBottom:"1px solid var(--brd)",fontWeight:600}}>Today's Status</div>
                  <table>
                    <thead><tr><th>Employee</th><th>Time</th><th>Status</th></tr></thead>
                    <tbody>
                      {employees.map(emp=>{
                        const r=attendance.find(a=>a.uid===emp.id);
                        return(
                          <tr key={emp.id}>
                            <td><div style={{fontWeight:600,color:"var(--txt)"}}>{emp.name}</div><div style={{fontSize:12,color:"var(--txt3)"}}>{emp.email}</div></td>
                            <td style={{fontFamily:"var(--mono)",fontSize:13}}>{r?r.time:"—"}</td>
                            <td>{r?<span className={`badge ${r.status==="present"?"bg":"by"}`}>{r.status==="present"?"✓ On Time":"⚠ Late"}</span>:<span className="badge br">✗ Absent</span>}</td>
                          </tr>
                        );
                      })}
                      {employees.length===0 && <tr><td colSpan={3} style={{textAlign:"center",color:"var(--txt3)",padding:32}}>কোনো employee নেই</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ATTENDANCE */}
            {tab==="attendance" && (
              <div style={{display:"grid",gap:20}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
                  <h2 style={{fontSize:20,fontWeight:700}}>Attendance Records</h2>
                  <div style={{display:"flex",gap:8}}>
                    <input className="input" type="date" value={filterDate} onChange={e=>setFilterDate(e.target.value)} style={{width:"auto"}}/>
                    <button className="btn btn-g" onClick={exportCSV}>↓ CSV</button>
                  </div>
                </div>
                <div className="card" style={{padding:0,overflow:"hidden"}}>
                  <table>
                    <thead><tr><th>Employee</th><th>Email</th><th>Time</th><th>Status</th></tr></thead>
                    <tbody>
                      {employees.map(emp=>{
                        const r=attendance.find(a=>a.uid===emp.id);
                        return(
                          <tr key={emp.id}>
                            <td style={{fontWeight:600,color:"var(--txt)"}}>{emp.name}</td>
                            <td style={{fontSize:12}}>{emp.email}</td>
                            <td style={{fontFamily:"var(--mono)",fontSize:13}}>{r?r.time:"—"}</td>
                            <td>{r?<span className={`badge ${r.status==="present"?"bg":"by"}`}>{r.status==="present"?"On Time":"Late"}</span>:<span className="badge br">Absent</span>}</td>
                          </tr>
                        );
                      })}
                      {employees.length===0 && <tr><td colSpan={4} style={{textAlign:"center",color:"var(--txt3)",padding:32}}>কোনো employee নেই</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* EMPLOYEES */}
            {tab==="employees" && (
              <div style={{display:"grid",gap:20}}>
                <h2 style={{fontSize:20,fontWeight:700}}>Manage Employees</h2>
                <div className="card">
                  <h3 style={{fontWeight:600,marginBottom:14}}>নতুন Employee যোগ করুন</h3>
                  <form onSubmit={addEmp} style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr auto",gap:10,alignItems:"end"}}>
                    <div className="input-group"><label>নাম</label><input className="input" value={newEmp.name} onChange={e=>setNewEmp(p=>({...p,name:e.target.value}))} placeholder="Jane Doe" required/></div>
                    <div className="input-group"><label>Email</label><input className="input" type="email" value={newEmp.email} onChange={e=>setNewEmp(p=>({...p,email:e.target.value}))} placeholder="jane@company.com" required/></div>
                    <div className="input-group"><label>Password</label><input className="input" type="password" value={newEmp.password} onChange={e=>setNewEmp(p=>({...p,password:e.target.value}))} placeholder="Min 6 chars" required minLength={6}/></div>
                    <button className="btn btn-p" type="submit" disabled={adding} style={{height:44}}>{adding?<span className="spinner"/>:"+ Add"}</button>
                  </form>
                </div>
                <div className="card" style={{padding:0,overflow:"hidden"}}>
                  <div style={{padding:"14px 20px",borderBottom:"1px solid var(--brd)",fontWeight:600}}>সব Employees ({employees.length})</div>
                  <table>
                    <thead><tr><th>#</th><th>নাম</th><th>Email</th><th>Role</th></tr></thead>
                    <tbody>
                      {employees.map((e,i)=>(
                        <tr key={e.id}>
                          <td style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--txt3)"}}>{String(i+1).padStart(2,"0")}</td>
                          <td style={{fontWeight:600,color:"var(--txt)"}}>{e.name}</td>
                          <td>{e.email}</td>
                          <td><span className="badge bb">Employee</span></td>
                        </tr>
                      ))}
                      {employees.length===0 && <tr><td colSpan={4} style={{textAlign:"center",color:"var(--txt3)",padding:32}}>এখনো কেউ নেই</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SETTINGS */}
            {tab==="settings" && (
              <div style={{display:"grid",gap:20}}>
                <h2 style={{fontSize:20,fontWeight:700}}>Settings</h2>
                <div className="card" style={{maxWidth:480}}>
                  <h3 style={{fontWeight:600,marginBottom:4}}>Attendance Time Window</h3>
                  <p style={{color:"var(--txt3)",fontSize:13,marginBottom:18}}>প্রতিদিন কখন attendance নেওয়া হবে তা set করুন</p>
                  <div style={{display:"grid",gap:14}}>
                    {[{l:"Window শুরু",k:"start"},{l:"Late হবে এর পর",k:"lateAfter"},{l:"Window শেষ",k:"end"}].map(f=>(
                      <div key={f.k} className="input-group">
                        <label>{f.l}</label>
                        <input className="input" type="time" value={win[f.k]} onChange={e=>setWin(p=>({...p,[f.k]:e.target.value}))}/>
                      </div>
                    ))}
                    <div style={{background:"var(--surf2)",borderRadius:10,padding:"12px 14px",fontSize:13,color:"var(--txt2)"}}>
                      ℹ️ {win.start}–{win.lateAfter} = <span style={{color:"var(--grn)"}}>On Time</span> · {win.lateAfter}–{win.end} = <span style={{color:"var(--ylw)"}}>Late</span>
                    </div>
                    <button className="btn btn-p" onClick={saveWin} disabled={saving} style={{width:"fit-content"}}>
                      {saving?<span className="spinner"/>:"Save Settings"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

// ─── ROOT ──────────────────────────────────────────────────────
export default function App() {
  const [user,setUser]=useState(null);
  const [userData,setUserData]=useState(null);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    return onAuthStateChanged(auth, async fbUser=>{
      if(fbUser){
  const d=await getDoc(doc(db,"employees",fbUser.uid));
  if(d.exists()){ setUserData({uid:fbUser.uid,...d.data()}); setUser(fbUser); }
} else { 
  setUser(null); 
  setUserData(null); 
}
setLoading(false);
  
console.log("loading state:", loading, "user:", user);
  if(loading) return (
    <div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"var(--bg)"}}>
      <div style={{textAlign:"center"}}>
        <div className="spinner" style={{width:40,height:40,margin:"0 auto 16px",borderWidth:3}}/>
        <div style={{color:"var(--txt3)",fontSize:14}}>Loading…</div>
      </div>
    </div>
  );

  return (
    <>
      <GS/>
      <Toasts/>
      {!user ? <Login/> : userData?.role==="admin" ? <AdminDash user={userData}/> : <EmpDash user={userData}/>}
    </>
  );
}
