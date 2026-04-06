import { useState, useEffect, useCallback, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, getDocs, deleteDoc, collection, query, where, orderBy, serverTimestamp, updateDoc, addDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDKQnzG2J1wtWpENtFf2b9-XNnfte1niR0",
  authDomain: "attendtrack-3a9dc.firebaseapp.com",
  projectId: "attendtrack-3a9dc",
  storageBucket: "attendtrack-3a9dc.firebasestorage.app",
  messagingSenderId: "532454978373",
  appId: "1:532454978373:web:4137905a0e0bdd94b4c42c",
};

const OFFICE_LAT = 23.2402;
const OFFICE_LNG = 91.1239;
const OFFICE_RADIUS_METERS = 100;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const todayStr = () => new Date().toISOString().split("T")[0];
const fmtTime = (d) => d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const fmtDate = (s) => new Date(s + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
const toMin = (s) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function getWS(w, now = new Date()) {
  const cur = now.getHours() * 60 + now.getMinutes();
  const s = toMin(w.start), l = toMin(w.lateAfter), e = toMin(w.end);
  if (cur < s) return "early";
  if (cur >= s && cur <= l) return "on_time";
  if (cur > l && cur <= e) return "late";
  return "closed";
}

function calcDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Mono&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#0a0f1e;--surf:#111827;--surf2:#1a2235;--surf3:#243050;--brd:rgba(255,255,255,0.08);--brd2:rgba(255,255,255,0.14);--txt:#f0f4ff;--txt2:#94a3b8;--txt3:#64748b;--acc:#4f8ef7;--acc2:#6366f1;--grn:#22c55e;--ylw:#f59e0b;--red:#ef4444;--font:'DM Sans',sans-serif;--mono:'Space Mono',monospace;--rad:14px;--radsm:8px}
html,body,#root{height:100%}
body{font-family:var(--font);background:var(--bg);color:var(--txt);-webkit-font-smoothing:antialiased}
input,button,select{font-family:var(--font)}
::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:var(--surf)}::-webkit-scrollbar-thumb{background:var(--surf3);border-radius:3px}
@keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@keyframes spin{to{transform:rotate(360deg)}}
.fi{animation:fadeIn .35s ease both}
.spin{width:20px;height:20px;border:2px solid rgba(255,255,255,.2);border-top-color:white;border-radius:50%;animation:spin .7s linear infinite;display:inline-block}
.gbg{background-image:linear-gradient(rgba(79,142,247,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(79,142,247,.04) 1px,transparent 1px);background-size:48px 48px}
.card{background:var(--surf);border:1px solid var(--brd);border-radius:var(--rad);padding:20px}
.badge{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600}
.bg{background:rgba(34,197,94,.15);color:var(--grn)}.by{background:rgba(245,158,11,.15);color:var(--ylw)}.br{background:rgba(239,68,68,.15);color:var(--red)}.bb{background:rgba(79,142,247,.15);color:var(--acc)}.bp{background:rgba(168,85,247,.15);color:#a855f7}
table{width:100%;border-collapse:collapse}
th{text-align:left;font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--txt3);padding:9px 14px;border-bottom:1px solid var(--brd)}
td{padding:11px 14px;font-size:13px;border-bottom:1px solid var(--brd);color:var(--txt2)}
tr:last-child td{border-bottom:none}tr:hover td{background:rgba(255,255,255,.015)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:9px 18px;border-radius:var(--radsm);font-size:13px;font-weight:600;cursor:pointer;transition:all .15s;border:none;outline:none;white-space:nowrap}
.btn:disabled{opacity:.45;cursor:not-allowed}
.btn-p{background:linear-gradient(135deg,var(--acc),var(--acc2));color:white}.btn-p:hover:not(:disabled){opacity:.88;transform:translateY(-1px)}
.btn-g{background:transparent;color:var(--txt2);border:1px solid var(--brd2)}.btn-g:hover:not(:disabled){background:var(--surf2);color:var(--txt)}
.btn-sm{padding:5px 12px;font-size:20px;border-radius:6px}
.inp{background:var(--surf2);border:1px solid var(--brd2);border-radius:var(--radsm);padding:10px 13px;color:var(--txt);font-size:13px;width:100%;outline:none;transition:border-color .2s}
.inp:focus{border-color:var(--acc);box-shadow:0 0 0 3px rgba(79,142,247,.12)}.inp::placeholder{color:var(--txt3)}
.lbl{font-size:12px;font-weight:500;color:var(--txt2);display:block;margin-bottom:5px}
#tw{position:fixed;top:16px;right:16px;z-index:9999;display:flex;flex-direction:column;gap:7px}
.toast{display:flex;align-items:center;gap:8px;padding:10px 16px;border-radius:var(--radsm);font-size:13px;font-weight:500;color:white;animation:fadeIn .25s ease both;max-width:340px}
.ts{background:#16a34a}.te{background:#dc2626}.ti{background:var(--acc)}
.cam video{width:100%;display:block;border-radius:12px;transform:scaleX(-1)}
.cam canvas{display:none}
.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;z-index:999}
.modal{background:var(--surf);border-radius:16px;padding:24px;width:90%;max-width:440px;max-height:90vh;overflow-y:auto}
@media(max-width:768px){.hm{display:none!important}.card{padding:14px}}
`;

let _toast = null;
const toast = {
  s: m => _toast?.({ id: Date.now(), t: "s", m }),
  e: m => _toast?.({ id: Date.now(), t: "e", m }),
  i: m => _toast?.({ id: Date.now(), t: "i", m }),
};

function Toasts() {
  const [list, setList] = useState([]);
  useEffect(() => {
    _toast = x => { setList(p => [...p, x]); setTimeout(() => setList(p => p.filter(y => y.id !== x.id)), 3800); };
    return () => { _toast = null; };
  }, []);
  return <div id="tw">{list.map(x => <div key={x.id} className={`toast t${x.t}`}>{x.t==="s"?"✓":x.t==="e"?"✗":"ℹ"} {x.m}</div>)}</div>;
}

function Nav({ user, now }) {
  return (
    <nav style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"13px 20px",borderBottom:"1px solid var(--brd)",background:"rgba(10,15,30,.92)",backdropFilter:"blur(12px)",position:"sticky",top:0,zIndex:100}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:34,height:34,borderRadius:9,background:"linear-gradient(135deg,var(--acc),var(--acc2))",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>📋</div>
        <div>
          <div style={{fontWeight:700,fontSize:15}}>AttendTrack{user.role==="admin"&&<span style={{fontSize:10,background:"rgba(99,102,241,.2)",color:"#818cf8",padding:"2px 6px",borderRadius:4,marginLeft:7,fontWeight:700}}>ADMIN</span>}</div>
          <div style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--txt3)"}}>{fmtTime(now)}</div>
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <span className="hm" style={{fontSize:12,color:"var(--txt2)"}}>{user.name}</span>
        <button className="btn btn-g" onClick={()=>signOut(auth)} style={{padding:"6px 12px",fontSize:12}}>Sign Out</button>
      </div>
    </nav>
  );
}

function Login() {
  const [email,setEmail]=useState("");
  const [pass,setPass]=useState("");
  const [loading,setLoading]=useState(false);
  const [now,setNow]=useState(new Date());
  useEffect(()=>{const t=setInterval(()=>setNow(new Date()),1000);return()=>clearInterval(t);},[]);
  const handle=async e=>{
    e.preventDefault();setLoading(true);
    try{await signInWithEmailAndPassword(auth,email,pass);toast.s("স্বাগতম!");}
    catch{toast.e("Email বা Password ভুল");}
    finally{setLoading(false);}
  };
  return(
    <div className="gbg" style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div className="fi" style={{width:"100%",maxWidth:400}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{width:60,height:60,borderRadius:15,background:"linear-gradient(135deg,var(--acc),var(--acc2))",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",fontSize:26}}>🔐</div>
          <h1 style={{fontSize:26,fontWeight:700,letterSpacing:"-.02em"}}>AttendTrack</h1>
          <p style={{color:"var(--txt2)",marginTop:5,fontSize:13}}>Workforce Attendance Management</p>
          <div style={{fontFamily:"var(--mono)",fontSize:12,color:"var(--acc)",marginTop:8}}>{fmtTime(now)}</div>
        </div>
        <div className="card">
          <h2 style={{fontSize:17,fontWeight:600,marginBottom:20}}>Sign In</h2>
          <form onSubmit={handle} style={{display:"flex",flexDirection:"column",gap:14}}>
            <div><label className="lbl">Email</label><input className="inp" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com" required/></div>
            <div><label className="lbl">Password</label><input className="inp" type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••" required/></div>
            <button className="btn btn-p" type="submit" disabled={loading} style={{padding:12,fontSize:14,borderRadius:10,marginTop:4}}>{loading?<span className="spin"/>:"Sign In →"}</button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Camera({onCapture,onCancel}){
  const vidRef=useRef(null);
  const canRef=useRef(null);
  const streamRef=useRef(null);
  const [captured,setCaptured]=useState(null);
  const [err,setErr]=useState(false);
  useEffect(()=>{
    let active=true;
    navigator.mediaDevices.getUserMedia({video:{facingMode:"user"}})
      .then(s=>{if(!active){s.getTracks().forEach(t=>t.stop());return;}streamRef.current=s;if(vidRef.current)vidRef.current.srcObject=s;})
      .catch(()=>setErr(true));
    return()=>{active=false;streamRef.current?.getTracks().forEach(t=>t.stop());};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  const snap=()=>{
    const v=vidRef.current,c=canRef.current;if(!v||!c)return;
    c.width=v.videoWidth;c.height=v.videoHeight;
    const ctx=c.getContext("2d");ctx.translate(c.width,0);ctx.scale(-1,1);ctx.drawImage(v,0,0);
    setCaptured(c.toDataURL("image/jpeg",0.4));streamRef.current?.getTracks().forEach(t=>t.stop());
  };
  if(err)return(<div style={{textAlign:"center",padding:20}}><div style={{fontSize:36,marginBottom:10}}>📷</div><p style={{color:"var(--red)",marginBottom:10,fontSize:13}}>Camera access পাওয়া যায়নি!</p><button className="btn btn-g" onClick={onCancel}>বাতিল</button></div>);
  return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:14}}>
      {!captured?(
        <>
          <div className="cam" style={{width:"100%",maxWidth:320,border:"2px solid var(--acc)",borderRadius:14,overflow:"hidden"}}><video ref={vidRef} autoPlay playsInline muted/><canvas ref={canRef} style={{display:"none"}}/></div>
          <p style={{color:"var(--txt2)",fontSize:12}}>Camera তে মুখ রাখুন তারপর Selfie তুলুন</p>
          <div style={{display:"flex",gap:8}}><button className="btn btn-g" onClick={onCancel}>বাতিল</button><button className="btn btn-p" onClick={snap} style={{padding:"10px 28px"}}>📸 Selfie তুলুন</button></div>
        </>
      ):(
        <>
          <img src={captured} alt="selfie" style={{width:"100%",maxWidth:320,borderRadius:14,border:"2px solid var(--grn)"}}/>
          <p style={{color:"var(--grn)",fontSize:12}}>✓ Selfie তোলা হয়েছে!</p>
          <div style={{display:"flex",gap:8}}><button className="btn btn-g" onClick={()=>setCaptured(null)}>🔄 আবার তুলুন</button><button className="btn btn-p" onClick={()=>onCapture(captured)} style={{padding:"10px 28px"}}>✓ Confirm</button></div>
        </>
      )}
    </div>
  );
}

function EmpDash({user}){
  const [now,setNow]=useState(new Date());
  const [win,setWin]=useState(null);
  const [rec,setRec]=useState(null);
  const [hist,setHist]=useState([]);
  const [marking,setMarking]=useState(false);
  const [showCam,setShowCam]=useState(false);
  const [locStatus,setLocStatus]=useState(null);
  const [distance,setDistance]=useState(null);
  const [onLeave,setOnLeave]=useState(false);

  useEffect(()=>{const t=setInterval(()=>setNow(new Date()),1000);return()=>clearInterval(t);},[]);

  const load=useCallback(async()=>{
    try{
      // Check for custom window first, fallback to global
      const empDoc=await getDoc(doc(db,"employees",user.uid));
      if(empDoc.exists()&&empDoc.data().customWindow){
        setWin(empDoc.data().customWindow);
      } else {
        const wDoc=await getDoc(doc(db,"settings","attendance_window"));
        if(wDoc.exists())setWin(wDoc.data());
      }
      const today=todayStr();
      const rDoc=await getDoc(doc(db,"attendance",`${user.uid}_${today}`));
      if(rDoc.exists())setRec(rDoc.data());
      const q=query(collection(db,"attendance"),where("uid","==",user.uid),orderBy("date","desc"));
      const snap=await getDocs(q);
      setHist(snap.docs.slice(0,30).map(d=>d.data()));
    }catch{toast.e("Data load হয়নি");}
  },[user.uid]);

  useEffect(()=>{load();loadLeave();},[load,loadLeave]);

  const loadLeave=useCallback(async()=>{
    try{
      const today=todayStr();
      const q=query(collection(db,"leaves"),where("uid","==",user.uid));
      const snap=await getDocs(q);
      const isOnLeave=snap.docs.some(d=>{const l=d.data();return l.startDate<=today&&l.endDate>=today;});
      setOnLeave(isOnLeave);
    }catch{}
  },[user.uid]);

  const ws=win?getWS(win,now):null;
  const wsC={early:"bb",on_time:"bg",late:"by",closed:"br"};
  const wsT={early:"⏳ খোলেনি",on_time:"● Open",late:"● Late",closed:"● বন্ধ"};

  const checkLocation=()=>new Promise((resolve,reject)=>{
    if(!navigator.geolocation){reject("GPS supported নয়");return;}
    setLocStatus("checking");
    navigator.geolocation.getCurrentPosition(
      pos=>{
        const dist=Math.round(calcDistance(pos.coords.latitude,pos.coords.longitude,OFFICE_LAT,OFFICE_LNG));
        setDistance(dist);
        if(dist<=OFFICE_RADIUS_METERS){setLocStatus("ok");resolve(dist);}
        else{setLocStatus("far");reject(`Office থেকে ${dist}m দূরে! (সর্বোচ্চ ${OFFICE_RADIUS_METERS}m)`);}
      },
      ()=>{setLocStatus("error");reject("Location access দেওয়া হয়নি!");},
      {timeout:10000,maximumAge:60000}
    );
  });

  const handleBtn=async()=>{
    if(!win)return toast.i("Time window set নেই");
    if(ws==="early")return toast.i("Window এখনো খোলেনি");
    if(ws==="closed")return toast.e("Window বন্ধ");
    try{await checkLocation();setShowCam(true);}
    catch(msg){toast.e(String(msg));}
  };

  const handleCapture=async(selfie)=>{
    setShowCam(false);setMarking(true);
    try{
      const today=todayStr();
      const status=ws==="on_time"?"present":"late";
      await setDoc(doc(db,"attendance",`${user.uid}_${today}`),{
        uid:user.uid,name:user.name,email:user.email,
        date:today,time:fmtTime(now),status,selfie,
        distance:distance||0,timestamp:serverTimestamp(),
      });
      setRec({date:today,time:fmtTime(now),status,selfie});
      toast.s(status==="present"?"✓ উপস্থিত — On Time!":"⚠ উপস্থিত — Late");
      load();
    }catch(e){toast.e("Mark হয়নি: "+e.message);}
    finally{setMarking(false);}
  };

  const thisMonth=new Date().getMonth();
  const thisYear=new Date().getFullYear();
  const monthHist=hist.filter(r=>{const d=new Date(r.date+"T00:00:00");return d.getMonth()===thisMonth&&d.getFullYear()===thisYear;});

  return(
    <div className="gbg" style={{minHeight:"100vh",display:"flex",flexDirection:"column"}}>
      <Nav user={user} now={now}/>
      <main style={{flex:1,padding:"22px 16px"}}>
        <div className="fi" style={{maxWidth:820,margin:"0 auto",display:"grid",gap:16}}>
          <div>
            <h1 style={{fontSize:22,fontWeight:700}}>{now.getHours()<12?"সুপ্রভাত":now.getHours()<17?"শুভ অপরাহ্ন":"শুভ সন্ধ্যা"}, {user.name.split(" ")[0]} 👋</h1>
            <p style={{color:"var(--txt2)",marginTop:3,fontSize:12}}>{new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</p>
          </div>

          {win&&(
            <div className="card" style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:40,height:40,borderRadius:9,background:"rgba(79,142,247,.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>🕐</div>
              <div style={{flex:1}}>
                <div style={{fontSize:11,color:"var(--txt3)",marginBottom:2}}>
                  আপনার Attendance Window {win.isCustom&&<span className="badge bp" style={{marginLeft:6}}>Custom</span>}
                </div>
                <div style={{fontWeight:600,fontSize:13}}>{win.start} — {win.end} · Late after {win.lateAfter}</div>
              </div>
              {ws&&<span className={`badge ${wsC[ws]}`}>{wsT[ws]}</span>}
            </div>
          )}

          {locStatus&&(
            <div className="card" style={{display:"flex",alignItems:"center",gap:12,background:locStatus==="ok"?"rgba(34,197,94,.08)":locStatus==="far"?"rgba(239,68,68,.08)":"rgba(79,142,247,.08)",borderColor:"transparent"}}>
              <span style={{fontSize:22}}>{locStatus==="checking"?"🔍":locStatus==="ok"?"📍":locStatus==="far"?"⚠️":"❌"}</span>
              <div>
                <div style={{fontWeight:600,fontSize:13,color:locStatus==="ok"?"var(--grn)":locStatus==="far"?"var(--red)":"var(--acc)"}}>
                  {locStatus==="checking"?"Location check হচ্ছে...":locStatus==="ok"?`✓ Office এর মধ্যে আছেন (${distance}m)`:locStatus==="far"?`✗ Office থেকে ${distance}m দূরে!`:"Location access পাওয়া যায়নি"}
                </div>
              </div>
            </div>
          )}

          <div className="card" style={{padding:"32px 20px"}}>
            {onLeave?(
              <div style={{textAlign:"center"}}>
                <div style={{width:64,height:64,borderRadius:"50%",background:"rgba(34,197,94,.14)",border:"2px solid var(--grn)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px",fontSize:32}}>🏖</div>
                <h2 style={{fontSize:18,fontWeight:700,marginBottom:6,color:"var(--grn)"}}>🏖️ আপনি এখন ছুটিতে আছেন</h2>
                <p style={{color:"var(--txt2)",fontSize:12}}>আজ attendance mark করার দরকার নেই</p>
              </div>
            ):showCam?(
              <Camera onCapture={handleCapture} onCancel={()=>setShowCam(false)}/>
            ):rec?(
              <div style={{textAlign:"center"}}>
                <div style={{width:64,height:64,borderRadius:"50%",background:rec.status==="present"?"rgba(34,197,94,.14)":"rgba(245,158,11,.14)",border:`2px solid ${rec.status==="present"?"var(--grn)":"var(--ylw)"}`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px",fontSize:24}}>{rec.status==="present"?"✓":"⚠"}</div>
                <h2 style={{fontSize:18,fontWeight:700,marginBottom:6}}>Attendance Recorded</h2>
                <p style={{color:"var(--txt2)",marginBottom:12,fontSize:12}}>Marked at <strong style={{color:"var(--txt)"}}>{rec.time}</strong></p>
                <span className={`badge ${rec.status==="present"?"bg":"by"}`} style={{fontSize:12,padding:"4px 14px"}}>{rec.status==="present"?"✓ On Time":"⚠ Late"}</span>
                {rec.selfie&&<div style={{marginTop:16}}><p style={{fontSize:11,color:"var(--txt3)",marginBottom:6}}>আজকের Selfie</p><img src={rec.selfie} alt="selfie" style={{width:90,height:90,borderRadius:"50%",objectFit:"cover",border:"3px solid var(--grn)",margin:"0 auto",display:"block"}}/></div>}
              </div>
            ):(
              <div style={{textAlign:"center"}}>
                <div style={{width:64,height:64,borderRadius:"50%",background:"rgba(79,142,247,.1)",border:"2px solid rgba(79,142,247,.25)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px",fontSize:26}}>📸</div>
                <h2 style={{fontSize:18,fontWeight:700,marginBottom:6}}>Selfie দিয়ে Attendance দিন</h2>
                <p style={{color:"var(--txt2)",marginBottom:20,fontSize:12,maxWidth:300,margin:"0 auto 20px"}}>
                  {ws==="early"?"Window এখনো খোলেনি":ws==="on_time"?"📍 Location verify হবে, তারপর Selfie":ws==="late"?"দেরি হয়েছে — Late হিসেবে record হবে":"Window বন্ধ হয়ে গেছে"}
                </p>
                <button className="btn" onClick={handleBtn} disabled={marking||!ws||ws==="early"||ws==="closed"} style={{padding:"11px 36px",fontSize:14,borderRadius:10,border:"none",color:"white",background:ws==="on_time"?"linear-gradient(135deg,var(--acc),var(--acc2))":ws==="late"?"linear-gradient(135deg,var(--ylw),#d97706)":"var(--surf3)"}}>
                  {marking?<span className="spin"/>:locStatus==="checking"?"📍 Location check...":"📸 Attendance দিন"}
                </button>
              </div>
            )}
          </div>

          <div className="card" style={{padding:"16px 20px"}}>
            <div style={{fontSize:12,color:"var(--txt3)",marginBottom:12,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em"}}>{MONTHS[thisMonth]} {thisYear} — এই মাস</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
              {[{l:"Present",v:monthHist.filter(r=>r.status==="present").length,c:"var(--grn)"},{l:"Late",v:monthHist.filter(r=>r.status==="late").length,c:"var(--ylw)"},{l:"এই মাস",v:monthHist.length,c:"var(--acc)"},{l:"All Time",v:hist.length,c:"var(--txt2)"}].map(s=>(
                <div key={s.l} style={{textAlign:"center"}}>
                  <div style={{fontSize:24,fontWeight:700,color:s.c,fontFamily:"var(--mono)"}}>{s.v}</div>
                  <div style={{fontSize:11,color:"var(--txt3)",marginTop:3}}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          {hist.length>0&&(
            <div className="card" style={{padding:0,overflow:"hidden"}}>
              <div style={{padding:"12px 16px",borderBottom:"1px solid var(--brd)",fontWeight:600,fontSize:13}}>Attendance History</div>
              <div style={{maxHeight:320,overflowY:"auto"}}>
                <table>
                  <thead><tr><th>Date</th><th>Time</th><th>Selfie</th><th>Status</th></tr></thead>
                  <tbody>
                    {hist.map((r,i)=>(
                      <tr key={i}>
                        <td style={{color:"var(--txt)",fontWeight:500}}>{fmtDate(r.date)}</td>
                        <td style={{fontFamily:"var(--mono)",fontSize:12}}>{r.time}</td>
                        <td>{r.selfie?<img src={r.selfie} alt="s" style={{width:32,height:32,borderRadius:"50%",objectFit:"cover",border:"2px solid var(--brd2)"}}/>:<span style={{color:"var(--txt3)",fontSize:11}}>—</span>}</td>
                        <td><span className={`badge ${r.status==="present"?"bg":"by"}`}>{r.status==="present"?"On Time":"Late"}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function AdminDash({user}){
  const [tab,setTab]=useState("overview");
  const [employees,setEmployees]=useState([]);
  const [attendance,setAttendance]=useState([]);
  const [allAttendance,setAllAttendance]=useState([]);
  const [filterDate,setFilterDate]=useState(todayStr());
  const [filterMonth,setFilterMonth]=useState(new Date().getMonth());
  const [filterYear,setFilterYear]=useState(new Date().getFullYear());
  const [win,setWin]=useState({start:"09:00",end:"09:30",lateAfter:"09:15"});
  const [newEmp,setNewEmp]=useState({name:"",email:"",password:""});
  const [loading,setLoading]=useState(false);
  const [saving,setSaving]=useState(false);
  const [adding,setAdding]=useState(false);
  const [now,setNow]=useState(new Date());
  const [pop,setPop]=useState(null);
  const [empReport,setEmpReport]=useState(null);
  const [customWinModal,setCustomWinModal]=useState(null);
  const [customWinData,setCustomWinData]=useState({start:"09:00",lateAfter:"09:15",end:"09:30",enabled:false});
  const [savingCustom,setSavingCustom]=useState(false);
  const [leaves,setLeaves]=useState([]);
  const [newLeave,setNewLeave]=useState({uid:"",employeeName:"",startDate:"",endDate:"",reason:""});
  const [savingLeave,setSavingLeave]=useState(false);

  useEffect(()=>{const t=setInterval(()=>setNow(new Date()),1000);return()=>clearInterval(t);},[]);

  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const [eSnap,aSnap,allSnap,wDoc]=await Promise.all([
        getDocs(collection(db,"employees")),
        getDocs(query(collection(db,"attendance"),where("date","==",filterDate),orderBy("timestamp","asc"))),
        getDocs(query(collection(db,"attendance"),orderBy("date","desc"))),
        getDoc(doc(db,"settings","attendance_window")),
      ]);
      setEmployees(eSnap.docs.map(d=>({id:d.id,...d.data()})).filter(e=>e.role!=="admin"));
      setAttendance(aSnap.docs.map(d=>d.data()));
      setAllAttendance(allSnap.docs.map(d=>d.data()));
      if(wDoc.exists())setWin(wDoc.data());
      // Load leaves
      const lSnap=await getDocs(collection(db,"leaves"));
      setLeaves(lSnap.docs.map(d=>({id:d.id,...d.data()})));
    }catch{toast.e("Data load হয়নি");}
    finally{setLoading(false);}
  },[filterDate]);

  useEffect(()=>{load();},[load]);

  const saveWin=async()=>{
    setSaving(true);
    try{await setDoc(doc(db,"settings","attendance_window"),win);toast.s("Settings saved!");}
    catch{toast.e("Save হয়নি");}
    finally{setSaving(false);}
  };

  const addEmp=async e=>{
    e.preventDefault();setAdding(true);
    try{
      const cred=await createUserWithEmailAndPassword(auth,newEmp.email,newEmp.password);
      await setDoc(doc(db,"employees",cred.user.uid),{name:newEmp.name,email:newEmp.email,role:"employee",createdAt:serverTimestamp()});
      setNewEmp({name:"",email:"",password:""});
      toast.s(`${newEmp.name} যোগ হয়েছে!`);
      load();
    }catch(err){toast.e(err.message.replace("Firebase: ",""));}
    finally{setAdding(false);}
  };

  const openCustomWin=async(emp)=>{
    setCustomWinModal(emp);
    const empDoc=await getDoc(doc(db,"employees",emp.id));
    if(empDoc.exists()&&empDoc.data().customWindow){
      setCustomWinData({...empDoc.data().customWindow,enabled:true});
    } else {
      setCustomWinData({start:win.start,lateAfter:win.lateAfter,end:win.end,enabled:false});
    }
  };

  const saveCustomWin=async()=>{
    if(!customWinModal)return;
    setSavingCustom(true);
    try{
      if(customWinData.enabled){
        await updateDoc(doc(db,"employees",customWinModal.id),{
          customWindow:{start:customWinData.start,lateAfter:customWinData.lateAfter,end:customWinData.end,isCustom:true}
        });
        toast.s(`${customWinModal.name} এর custom time saved!`);
      } else {
        await updateDoc(doc(db,"employees",customWinModal.id),{customWindow:null});
        toast.s(`${customWinModal.name} এর custom time সরানো হয়েছে — Global time apply হবে`);
      }
      setCustomWinModal(null);
      load();
    }catch{toast.e("Save হয়নি");}
    finally{setSavingCustom(false);}
  };

  const deleteEmployee=async(emp)=>{
    if(!window.confirm(`"${emp.name}" কে delete করবেন? তার সব attendance data মুছে যাবে!`))return;
    try{
      // Delete all attendance records
      const aSnap=await getDocs(query(collection(db,"attendance"),where("uid","==",emp.id)));
      await Promise.all(aSnap.docs.map(d=>deleteDoc(d.ref)));
      // Delete employee document
      await deleteDoc(doc(db,"employees",emp.id));
      toast.s(`${emp.name} delete হয়েছে!`);
      load();
    }catch{toast.e("Delete হয়নি!");}
  };

  const exportCSV=()=>{
    let csv="Name,Email,Date,Time,Status\n";
    employees.forEach(emp=>{const r=attendance.find(a=>a.uid===emp.id);csv+=`${emp.name},${emp.email},${filterDate},${r?r.time:"-"},${r?r.status:"absent"}\n`;});
    const a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
    a.download=`attendance_${filterDate}.csv`;a.click();
    toast.s("CSV exported!");
  };

  const exportMonthCSV=()=>{
    const prefix=`${filterYear}-${String(filterMonth+1).padStart(2,"0")}`;
    let csv="Name,Email,Date,Time,Status\n";
    employees.forEach(emp=>{
      const empRecs=allAttendance.filter(r=>r.uid===emp.id&&r.date.startsWith(prefix));
      if(empRecs.length>0)empRecs.forEach(r=>{csv+=`${emp.name},${emp.email},${r.date},${r.time},${r.status}\n`;});
      else csv+=`${emp.name},${emp.email},${prefix},-,no_record\n`;
    });
    const a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
    a.download=`monthly_${prefix}.csv`;a.click();
    toast.s("Monthly CSV exported!");
  };

  const addLeave=async e=>{
    e.preventDefault();
    if(!newLeave.uid)return toast.i("Employee select করুন");
    if(!newLeave.startDate||!newLeave.endDate)return toast.i("Start এবং End date দিন");
    if(newLeave.startDate>newLeave.endDate)return toast.e("Start date, End date এর পরে হতে পারে না");
    setSavingLeave(true);
    try{
      const emp=employees.find(x=>x.id===newLeave.uid);
      await addDoc(collection(db,"leaves"),{
        uid:newLeave.uid,
        employeeName:emp?.name||newLeave.employeeName,
        startDate:newLeave.startDate,
        endDate:newLeave.endDate,
        reason:newLeave.reason,
        createdAt:serverTimestamp(),
      });
      toast.s("Leave যোগ হয়েছে!");
      setNewLeave({uid:"",employeeName:"",startDate:"",endDate:"",reason:""});
      const lSnap=await getDocs(collection(db,"leaves"));
      setLeaves(lSnap.docs.map(d=>({id:d.id,...d.data()})));
    }catch{toast.e("Save হয়নি!");}
    finally{setSavingLeave(false);}
  };

  const deleteLeave=async(id)=>{
    if(!window.confirm("এই leave টি delete করবেন?"))return;
    try{
      await deleteDoc(doc(db,"leaves",id));
      toast.s("Leave delete হয়েছে!");
      setLeaves(p=>p.filter(l=>l.id!==id));
    }catch{toast.e("Delete হয়নি!");}
  };

  const pN=attendance.filter(r=>r.status==="present").length;
  const lN=attendance.filter(r=>r.status==="late").length;
  const aN=Math.max(0,employees.length-attendance.length);
  const rate=employees.length?Math.round((attendance.length/employees.length)*100):0;
  const monthPrefix=`${filterYear}-${String(filterMonth+1).padStart(2,"0")}`;
  const monthlyData=employees.map(emp=>{
    const recs=allAttendance.filter(r=>r.uid===emp.id&&r.date.startsWith(monthPrefix));
    return{...emp,presentC:recs.filter(r=>r.status==="present").length,lateC:recs.filter(r=>r.status==="late").length,totalC:recs.length};
  });
  const absentEmps=employees.filter(emp=>!attendance.find(a=>a.uid===emp.id));
  const lateCountData=employees.map(emp=>({...emp,lateCount:allAttendance.filter(r=>r.uid===emp.id&&r.status==="late").length})).sort((a,b)=>b.lateCount-a.lateCount);

  // Employee report data
  const empReportData=empReport?allAttendance.filter(r=>r.uid===empReport.id).sort((a,b)=>b.date.localeCompare(a.date)):[];

  const TABS=[
    {id:"overview",l:"📊 Overview"},
    {id:"attendance",l:"📅 Attendance"},
    {id:"employee_report",l:"👤 Employee Report"},
    {id:"absent",l:"❌ Absent Report"},
    {id:"monthly",l:"📅 Monthly"},
    {id:"late",l:"🕐 Late Count"},
    {id:"employees",l:"👥 Employees"},
    {id:"settings",l:"⚙️ Settings"},
    {id:"leave",l:"🏖️ Leave"},
  ];

  const Thumb=({r,emp})=>r?.selfie
    ?<img onClick={()=>setPop({...r,name:emp.name})} src={r.selfie} alt="s" style={{width:36,height:36,borderRadius:"50%",objectFit:"cover",border:"2px solid var(--grn)",cursor:"pointer"}}/>
    :<span style={{color:"var(--txt3)",fontSize:11}}>—</span>;

  return(
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column"}}>
      <Nav user={user} now={now}/>

      {/* Selfie Popup */}
      {pop&&(
        <div className="modal-bg" onClick={()=>setPop(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <span style={{fontWeight:600,fontSize:14}}>{pop.name} এর Selfie</span>
              <button onClick={()=>setPop(null)} className="btn btn-g btn-sm">✕</button>
            </div>
            <img src={pop.selfie} alt="selfie" style={{width:"100%",borderRadius:10}}/>
            <div style={{marginTop:10,fontSize:12,color:"var(--txt2)",textAlign:"center"}}>
              {pop.time} · <span className={`badge ${pop.status==="present"?"bg":"by"}`}>{pop.status==="present"?"On Time":"Late"}</span>
              {pop.distance&&<span style={{marginLeft:8,color:"var(--txt3)"}}>📍 {pop.distance}m</span>}
            </div>
          </div>
        </div>
      )}

      {/* Custom Window Modal */}
      {customWinModal&&(
        <div className="modal-bg" onClick={()=>setCustomWinModal(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <div>
                <div style={{fontWeight:700,fontSize:16}}>⏰ Custom Time</div>
                <div style={{fontSize:12,color:"var(--txt2)",marginTop:2}}>{customWinModal.name}</div>
              </div>
              <button onClick={()=>setCustomWinModal(null)} className="btn btn-g btn-sm">✕</button>
            </div>

            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18,padding:"12px 14px",background:"var(--surf2)",borderRadius:10}}>
              <span style={{fontSize:18}}>🌐</span>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:600,color:"var(--txt)"}}>Global time ব্যবহার করুন</div>
                <div style={{fontSize:11,color:"var(--txt3)"}}>Default: {win.start} – {win.lateAfter} – {win.end}</div>
              </div>
              <button onClick={()=>setCustomWinData(p=>({...p,enabled:!p.enabled}))} className={`btn btn-sm ${customWinData.enabled?"btn-g":"btn-p"}`}>
                {customWinData.enabled?"Custom আছে":"Global চালু"}
              </button>
            </div>

            {customWinData.enabled&&(
              <div style={{display:"grid",gap:12,marginBottom:18}}>
                <div style={{padding:"10px 14px",background:"rgba(99,102,241,.1)",borderRadius:8,fontSize:12,color:"#818cf8",fontWeight:500}}>
                  ✓ {customWinModal.name} এর জন্য আলাদা time চালু আছে
                </div>
                {[{l:"Window শুরু",k:"start"},{l:"Late হবে এর পর",k:"lateAfter"},{l:"Window শেষ",k:"end"}].map(f=>(
                  <div key={f.k}><label className="lbl">{f.l}</label><input className="inp" type="time" value={customWinData[f.k]} onChange={e=>setCustomWinData(p=>({...p,[f.k]:e.target.value}))}/></div>
                ))}
                <div style={{background:"var(--surf2)",borderRadius:8,padding:"10px 12px",fontSize:12,color:"var(--txt2)"}}>
                  ℹ️ {customWinData.start}–{customWinData.lateAfter} = <span style={{color:"var(--grn)"}}>On Time</span> · {customWinData.lateAfter}–{customWinData.end} = <span style={{color:"var(--ylw)"}}>Late</span>
                </div>
              </div>
            )}

            <button className="btn btn-p" onClick={saveCustomWin} disabled={savingCustom} style={{width:"100%",padding:12}}>
              {savingCustom?<span className="spin"/>:"Save করুন"}
            </button>
          </div>
        </div>
      )}

      <div style={{display:"flex",flex:1}}>
        <aside className="hm" style={{width:210,borderRight:"1px solid var(--brd)",padding:"18px 10px",background:"var(--surf)",flexShrink:0,overflowY:"auto"}}>
          {TABS.map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={{display:"flex",alignItems:"center",gap:7,padding:"9px 12px",borderRadius:7,border:"none",cursor:"pointer",fontFamily:"var(--font)",fontSize:12,fontWeight:500,textAlign:"left",width:"100%",marginBottom:2,background:tab===t.id?"rgba(79,142,247,.12)":"transparent",color:tab===t.id?"var(--acc)":"var(--txt2)"}}>{t.l}</button>)}
        </aside>

        <main style={{flex:1,padding:"20px 16px",overflowY:"auto"}} className="gbg">
          <div style={{display:"flex",gap:4,marginBottom:18,overflowX:"auto",paddingBottom:3}}>
            {TABS.map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"6px 11px",borderRadius:7,border:"1px solid var(--brd)",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"var(--font)",flexShrink:0,background:tab===t.id?"var(--acc)":"var(--surf)",color:tab===t.id?"white":"var(--txt2)"}}>{t.l}</button>)}
          </div>

          <div className="fi" style={{maxWidth:900,margin:"0 auto"}}>

            {/* OVERVIEW */}
            {tab==="overview"&&(
              <div style={{display:"grid",gap:16}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
                  <div><h1 style={{fontSize:20,fontWeight:700}}>Dashboard</h1><p style={{color:"var(--txt2)",fontSize:12,marginTop:2}}>{fmtDate(filterDate)}</p></div>
                  <div style={{display:"flex",gap:7}}>
                    <input className="inp" type="date" value={filterDate} onChange={e=>setFilterDate(e.target.value)} style={{width:"auto"}}/>
                    <button className="btn btn-g" onClick={load} style={{padding:"8px 12px"}}>{loading?<span className="spin"/>:"↺"}</button>
                    <button className="btn btn-g" onClick={exportCSV} style={{padding:"8px 12px"}}>↓ CSV</button>
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12}}>
                  {[{l:"Total",v:employees.length,c:"var(--acc)",bg:"rgba(79,142,247,.08)"},{l:"Present",v:pN,c:"var(--grn)",bg:"rgba(34,197,94,.08)"},{l:"Late",v:lN,c:"var(--ylw)",bg:"rgba(245,158,11,.08)"},{l:"Absent",v:aN,c:"var(--red)",bg:"rgba(239,68,68,.08)"}].map(s=>(
                    <div key={s.l} className="card" style={{background:s.bg,borderColor:"transparent"}}>
                      <div style={{fontSize:32,fontWeight:700,color:s.c,fontFamily:"var(--mono)",lineHeight:1}}>{s.v}</div>
                      <div style={{fontSize:12,color:"var(--txt2)",marginTop:5}}>{s.l}</div>
                    </div>
                  ))}
                </div>
                {employees.length>0&&(
                  <div className="card">
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><span style={{fontWeight:600,fontSize:13}}>Attendance Rate</span><span style={{fontFamily:"var(--mono)",color:"var(--acc)",fontWeight:700,fontSize:13}}>{rate}%</span></div>
                    <div style={{height:7,background:"var(--surf2)",borderRadius:4,overflow:"hidden"}}><div style={{height:"100%",borderRadius:4,background:"linear-gradient(90deg,var(--grn),var(--acc))",width:`${rate}%`,transition:"width .5s"}}/></div>
                  </div>
                )}
                <div className="card" style={{padding:0,overflow:"hidden"}}>
                  <div style={{padding:"12px 16px",borderBottom:"1px solid var(--brd)",fontWeight:600,fontSize:13}}>আজকের Status</div>
                  <table>
                    <thead><tr><th>Employee</th><th>Custom Time</th><th>Selfie</th><th>Time</th><th>Status</th></tr></thead>
                    <tbody>
                      {employees.map(emp=>{const r=attendance.find(a=>a.uid===emp.id);return(
                        <tr key={emp.id}>
                          <td><div style={{fontWeight:600,color:"var(--txt)",fontSize:13}}>{emp.name}</div><div style={{fontSize:11,color:"var(--txt3)"}}>{emp.email}</div></td>
                          <td>{emp.customWindow?<span className="badge bp">⏰ Custom</span>:<span style={{color:"var(--txt3)",fontSize:11}}>Global</span>}</td>
                          <td><Thumb r={r} emp={emp}/></td>
                          <td style={{fontFamily:"var(--mono)",fontSize:12}}>{r?r.time:"—"}</td>
                          <td>{r?<span className={`badge ${r.status==="present"?"bg":"by"}`}>{r.status==="present"?"✓ On Time":"⚠ Late"}</span>:<span className="badge br">✗ Absent</span>}</td>
                        </tr>
                      );})}
                      {employees.length===0&&<tr><td colSpan={5} style={{textAlign:"center",color:"var(--txt3)",padding:28}}>কোনো employee নেই</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ATTENDANCE */}
            {tab==="attendance"&&(
              <div style={{display:"grid",gap:16}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
                  <h2 style={{fontSize:18,fontWeight:700}}>Attendance Records</h2>
                  <div style={{display:"flex",gap:7}}><input className="inp" type="date" value={filterDate} onChange={e=>setFilterDate(e.target.value)} style={{width:"auto"}}/><button className="btn btn-g" onClick={exportCSV} style={{padding:"8px 12px"}}>↓ CSV</button></div>
                </div>
                <div className="card" style={{padding:0,overflow:"hidden"}}>
                  <table>
                    <thead><tr><th>Employee</th><th>Selfie</th><th>Time</th><th>Distance</th><th>Status</th></tr></thead>
                    <tbody>
                      {employees.map(emp=>{const r=attendance.find(a=>a.uid===emp.id);return(
                        <tr key={emp.id}>
                          <td style={{fontWeight:600,color:"var(--txt)"}}>{emp.name}</td>
                          <td><Thumb r={r} emp={emp}/></td>
                          <td style={{fontFamily:"var(--mono)",fontSize:12}}>{r?r.time:"—"}</td>
                          <td style={{fontSize:12}}>{r?.distance?`📍 ${r.distance}m`:"—"}</td>
                          <td>{r?<span className={`badge ${r.status==="present"?"bg":"by"}`}>{r.status==="present"?"On Time":"Late"}</span>:<span className="badge br">Absent</span>}</td>
                        </tr>
                      );})}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* EMPLOYEE REPORT */}
            {tab==="employee_report"&&(
              <div style={{display:"grid",gap:16}}>
                <h2 style={{fontSize:18,fontWeight:700}}>👤 Employee Report</h2>
                <div className="card">
                  <label className="lbl">Employee select করুন</label>
                  <select className="inp" value={empReport?.id||""} onChange={e=>{const emp=employees.find(x=>x.id===e.target.value);setEmpReport(emp||null);}}>
                    <option value="">— Select Employee —</option>
                    {employees.map(emp=><option key={emp.id} value={emp.id}>{emp.name} ({emp.email})</option>)}
                  </select>
                </div>

                {empReport&&(
                  <>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:12}}>
                      {[
                        {l:"Present",v:empReportData.filter(r=>r.status==="present").length,c:"var(--grn)",bg:"rgba(34,197,94,.08)"},
                        {l:"Late",v:empReportData.filter(r=>r.status==="late").length,c:"var(--ylw)",bg:"rgba(245,158,11,.08)"},
                        {l:"Total Days",v:empReportData.length,c:"var(--acc)",bg:"rgba(79,142,247,.08)"},
                      ].map(s=>(
                        <div key={s.l} className="card" style={{background:s.bg,borderColor:"transparent",textAlign:"center"}}>
                          <div style={{fontSize:28,fontWeight:700,color:s.c,fontFamily:"var(--mono)"}}>{s.v}</div>
                          <div style={{fontSize:12,color:"var(--txt2)",marginTop:4}}>{s.l}</div>
                        </div>
                      ))}
                    </div>

                    <div className="card" style={{padding:0,overflow:"hidden"}}>
                      <div style={{padding:"12px 16px",borderBottom:"1px solid var(--brd)",fontWeight:600,fontSize:13}}>{empReport.name} — সব Attendance Record</div>
                      <div style={{maxHeight:400,overflowY:"auto"}}>
                        <table>
                          <thead><tr><th>Date</th><th>Time</th><th>Selfie</th><th>Distance</th><th>Status</th></tr></thead>
                          <tbody>
                            {empReportData.map((r,i)=>(
                              <tr key={i}>
                                <td style={{color:"var(--txt)",fontWeight:500}}>{fmtDate(r.date)}</td>
                                <td style={{fontFamily:"var(--mono)",fontSize:12}}>{r.time}</td>
                                <td>{r.selfie?<img onClick={()=>setPop({...r,name:empReport.name})} src={r.selfie} alt="s" style={{width:32,height:32,borderRadius:"50%",objectFit:"cover",border:"2px solid var(--grn)",cursor:"pointer"}}/>:<span style={{color:"var(--txt3)",fontSize:11}}>—</span>}</td>
                                <td style={{fontSize:12}}>{r.distance?`📍 ${r.distance}m`:"—"}</td>
                                <td><span className={`badge ${r.status==="present"?"bg":"by"}`}>{r.status==="present"?"On Time":"Late"}</span></td>
                              </tr>
                            ))}
                            {empReportData.length===0&&<tr><td colSpan={5} style={{textAlign:"center",color:"var(--txt3)",padding:28}}>কোনো record নেই</td></tr>}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ABSENT REPORT */}
            {tab==="absent"&&(
              <div style={{display:"grid",gap:16}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
                  <div><h2 style={{fontSize:18,fontWeight:700}}>❌ Absent Report</h2><p style={{color:"var(--txt2)",fontSize:12,marginTop:2}}>{fmtDate(filterDate)}</p></div>
                  <input className="inp" type="date" value={filterDate} onChange={e=>setFilterDate(e.target.value)} style={{width:"auto"}}/>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
                  {[{l:"Absent",v:aN,c:"var(--red)",bg:"rgba(239,68,68,.08)"},{l:"Present",v:pN,c:"var(--grn)",bg:"rgba(34,197,94,.08)"},{l:"Late",v:lN,c:"var(--ylw)",bg:"rgba(245,158,11,.08)"}].map(s=>(
                    <div key={s.l} className="card" style={{background:s.bg,borderColor:"transparent",textAlign:"center"}}>
                      <div style={{fontSize:28,fontWeight:700,color:s.c,fontFamily:"var(--mono)"}}>{s.v}</div>
                      <div style={{fontSize:12,color:"var(--txt2)",marginTop:4}}>{s.l}</div>
                    </div>
                  ))}
                </div>
                {absentEmps.length>0?(
                  <div className="card" style={{padding:0,overflow:"hidden"}}>
                    <div style={{padding:"12px 16px",borderBottom:"1px solid var(--brd)",fontWeight:600,fontSize:13,color:"var(--red)"}}>✗ Absent List ({absentEmps.length} জন)</div>
                    <table>
                      <thead><tr><th>#</th><th>নাম</th><th>Email</th></tr></thead>
                      <tbody>
                        {absentEmps.map((emp,i)=>(
                          <tr key={emp.id}>
                            <td style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--txt3)"}}>{String(i+1).padStart(2,"0")}</td>
                            <td style={{fontWeight:600,color:"var(--txt)"}}>{emp.name}</td>
                            <td>{emp.email}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ):(
                  <div className="card" style={{textAlign:"center",padding:40}}>
                    <div style={{fontSize:36,marginBottom:10}}>🎉</div>
                    <div style={{fontWeight:600,color:"var(--grn)"}}>সবাই উপস্থিত!</div>
                  </div>
                )}
              </div>
            )}

            {/* MONTHLY */}
            {tab==="monthly"&&(
              <div style={{display:"grid",gap:16}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
                  <h2 style={{fontSize:18,fontWeight:700}}>📅 Monthly Report</h2>
                  <div style={{display:"flex",gap:7,alignItems:"center"}}>
                    <select className="inp" value={filterMonth} onChange={e=>setFilterMonth(Number(e.target.value))} style={{width:"auto"}}>
                      {MONTHS.map((m,i)=><option key={i} value={i}>{m}</option>)}
                    </select>
                    <select className="inp" value={filterYear} onChange={e=>setFilterYear(Number(e.target.value))} style={{width:"auto"}}>
                      {[2024,2025,2026].map(y=><option key={y} value={y}>{y}</option>)}
                    </select>
                    <button className="btn btn-g" onClick={exportMonthCSV} style={{padding:"8px 12px"}}>↓ CSV</button>
                  </div>
                </div>
                <div className="card" style={{padding:0,overflow:"hidden"}}>
                  <div style={{padding:"12px 16px",borderBottom:"1px solid var(--brd)",fontWeight:600,fontSize:13}}>{MONTHS[filterMonth]} {filterYear}</div>
                  <table>
                    <thead><tr><th>Employee</th><th>Present</th><th>Late</th><th>Total</th><th>Rate</th></tr></thead>
                    <tbody>
                      {monthlyData.map(emp=>(
                        <tr key={emp.id}>
                          <td><div style={{fontWeight:600,color:"var(--txt)"}}>{emp.name}</div></td>
                          <td><span style={{color:"var(--grn)",fontWeight:600,fontFamily:"var(--mono)"}}>{emp.presentC}</span></td>
                          <td><span style={{color:"var(--ylw)",fontWeight:600,fontFamily:"var(--mono)"}}>{emp.lateC}</span></td>
                          <td><span style={{fontFamily:"var(--mono)"}}>{emp.totalC}</span></td>
                          <td>
                            <div style={{display:"flex",alignItems:"center",gap:8}}>
                              <div style={{flex:1,height:6,background:"var(--surf2)",borderRadius:3,overflow:"hidden",minWidth:60}}>
                                <div style={{height:"100%",borderRadius:3,background:"var(--grn)",width:`${emp.totalC>0?Math.round((emp.presentC/emp.totalC)*100):0}%`}}/>
                              </div>
                              <span style={{fontSize:11,color:"var(--txt3)",fontFamily:"var(--mono)"}}>{emp.totalC>0?Math.round((emp.presentC/emp.totalC)*100):0}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* LATE COUNT */}
            {tab==="late"&&(
              <div style={{display:"grid",gap:16}}>
                <h2 style={{fontSize:18,fontWeight:700}}>🕐 Late Count</h2>
                <div className="card" style={{padding:0,overflow:"hidden"}}>
                  <table>
                    <thead><tr><th>Rank</th><th>Employee</th><th>Late Count</th><th>Status</th></tr></thead>
                    <tbody>
                      {lateCountData.map((emp,i)=>(
                        <tr key={emp.id}>
                          <td style={{fontFamily:"var(--mono)",fontWeight:700,color:i===0?"var(--red)":i===1?"var(--ylw)":"var(--txt3)"}}>#{i+1}</td>
                          <td><div style={{fontWeight:600,color:"var(--txt)"}}>{emp.name}</div></td>
                          <td><span style={{fontFamily:"var(--mono)",fontSize:18,fontWeight:700,color:emp.lateCount>5?"var(--red)":emp.lateCount>2?"var(--ylw)":"var(--grn)"}}>{emp.lateCount}</span></td>
                          <td><span className={`badge ${emp.lateCount>5?"br":emp.lateCount>2?"by":"bg"}`}>{emp.lateCount>5?"⚠ বেশি":emp.lateCount>2?"সতর্ক":"✓ ভালো"}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* EMPLOYEES */}
            {tab==="employees"&&(
              <div style={{display:"grid",gap:16}}>
                <h2 style={{fontSize:18,fontWeight:700}}>Manage Employees</h2>
                <div className="card">
                  <h3 style={{fontWeight:600,marginBottom:12,fontSize:14}}>নতুন Employee যোগ করুন</h3>
                  <form onSubmit={addEmp} style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr auto",gap:8,alignItems:"end"}}>
                    <div><label className="lbl">নাম</label><input className="inp" value={newEmp.name} onChange={e=>setNewEmp(p=>({...p,name:e.target.value}))} placeholder="Jane Doe" required/></div>
                    <div><label className="lbl">Email</label><input className="inp" type="email" value={newEmp.email} onChange={e=>setNewEmp(p=>({...p,email:e.target.value}))} placeholder="jane@co.com" required/></div>
                    <div><label className="lbl">Password</label><input className="inp" type="password" value={newEmp.password} onChange={e=>setNewEmp(p=>({...p,password:e.target.value}))} placeholder="Min 6" required minLength={6}/></div>
                    <button className="btn btn-p" type="submit" disabled={adding} style={{height:40}}>{adding?<span className="spin"/>:"+ Add"}</button>
                  </form>
                </div>
                <div className="card" style={{padding:0,overflow:"hidden"}}>
                  <div style={{padding:"12px 16px",borderBottom:"1px solid var(--brd)",fontWeight:600,fontSize:13}}>সব Employees ({employees.length})</div>
                  <table>
                    <thead><tr><th>#</th><th>নাম</th><th>Email</th><th>Time Window</th><th>Action</th></tr></thead>
                    <tbody>
                      {employees.map((emp,i)=>(
                        <tr key={emp.id}>
                          <td style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--txt3)"}}>{String(i+1).padStart(2,"0")}</td>
                          <td style={{fontWeight:600,color:"var(--txt)"}}>{emp.name}</td>
                          <td style={{fontSize:12}}>{emp.email}</td>
                          <td>
                            {emp.customWindow?(
                              <div>
                                <span className="badge bp" style={{marginBottom:3}}>⏰ Custom</span>
                                <div style={{fontSize:11,color:"var(--txt3)",marginTop:2}}>{emp.customWindow.start}–{emp.customWindow.end}</div>
                              </div>
                            ):(
                              <span style={{fontSize:11,color:"var(--txt3)"}}>🌐 Global ({win.start}–{win.end})</span>
                            )}
                          </td>
                          <td>
                            <div style={{display:"flex",gap:6}}>
                              <button className="btn btn-g btn-sm" onClick={()=>openCustomWin(emp)}>⏰ Time Set</button>
                              <button className="btn btn-sm" onClick={()=>deleteEmployee(emp)} style={{background:"rgba(239,68,68,.12)",color:"var(--red)",border:"1px solid rgba(239,68,68,.25)"}}>🗑 Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {employees.length===0&&<tr><td colSpan={5} style={{textAlign:"center",color:"var(--txt3)",padding:28}}>এখনো কেউ নেই</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* LEAVE */}
            {tab==="leave"&&(
              <div style={{display:"grid",gap:16}}>
                <h2 style={{fontSize:18,fontWeight:700}}>🏖️ Leave Management</h2>
                <div className="card">
                  <h3 style={{fontWeight:600,marginBottom:12,fontSize:14}}>নতুন Leave যোগ করুন</h3>
                  <form onSubmit={addLeave} style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr auto",gap:8,alignItems:"end"}}>
                    <div>
                      <label className="lbl">Employee</label>
                      <select className="inp" value={newLeave.uid} onChange={e=>{const emp=employees.find(x=>x.id===e.target.value);setNewLeave(p=>({...p,uid:e.target.value,employeeName:emp?.name||""}));}} required>
                        <option value="">— Select —</option>
                        {employees.map(emp=><option key={emp.id} value={emp.id}>{emp.name}</option>)}
                      </select>
                    </div>
                    <div><label className="lbl">Start Date</label><input className="inp" type="date" value={newLeave.startDate} onChange={e=>setNewLeave(p=>({...p,startDate:e.target.value}))} required/></div>
                    <div><label className="lbl">End Date</label><input className="inp" type="date" value={newLeave.endDate} onChange={e=>setNewLeave(p=>({...p,endDate:e.target.value}))} required/></div>
                    <button className="btn btn-p" type="submit" disabled={savingLeave} style={{height:40}}>{savingLeave?<span className="spin"/>:"+ Add Leave"}</button>
                  </form>
                  <div style={{marginTop:10}}>
                    <label className="lbl">Reason (optional)</label>
                    <input className="inp" value={newLeave.reason} onChange={e=>setNewLeave(p=>({...p,reason:e.target.value}))} placeholder="ছুটির কারণ লিখুন..."/>
                  </div>
                </div>

                {leaves.length>0?(
                  <div className="card" style={{padding:0,overflow:"hidden"}}>
                    <div style={{padding:"12px 16px",borderBottom:"1px solid var(--brd)",fontWeight:600,fontSize:13}}>সব Leave ({leaves.length})</div>
                    <div style={{maxHeight:400,overflowY:"auto"}}>
                      <table>
                        <thead><tr><th>Employee</th><th>Start Date</th><th>End Date</th><th>Reason</th><th>Action</th></tr></thead>
                        <tbody>
                          {leaves.map(l=>(
                            <tr key={l.id}>
                              <td style={{fontWeight:600,color:"var(--txt)"}}>{l.employeeName}</td>
                              <td style={{fontFamily:"var(--mono)",fontSize:12}}>{fmtDate(l.startDate)}</td>
                              <td style={{fontFamily:"var(--mono)",fontSize:12}}>{fmtDate(l.endDate)}</td>
                              <td style={{fontSize:12,fontStyle:"italic"}}>{l.reason||"—"}</td>
                              <td><button className="btn btn-sm" onClick={()=>deleteLeave(l.id)} style={{background:"rgba(239,68,68,.12)",color:"var(--red)",border:"1px solid rgba(239,68,68,.25)"}}>🗑 Delete</button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ):(
                  <div className="card" style={{textAlign:"center",padding:40}}>
                    <div style={{fontSize:36,marginBottom:10}}>🏖</div>
                    <div style={{color:"var(--txt3)",fontSize:13}}>কোনো leave নেই</div>
                  </div>
                )}
              </div>
            )}

            {/* SETTINGS */}
            {tab==="settings"&&(
              <div style={{display:"grid",gap:16}}>
                <h2 style={{fontSize:18,fontWeight:700}}>Settings</h2>
                <div className="card" style={{maxWidth:440}}>
                  <h3 style={{fontWeight:600,marginBottom:4,fontSize:14}}>🌐 Global Attendance Window</h3>
                  <p style={{fontSize:12,color:"var(--txt3)",marginBottom:14}}>যাদের Custom time নেই তাদের জন্য এই time apply হবে</p>
                  <div style={{display:"grid",gap:12}}>
                    {[{l:"Window শুরু",k:"start"},{l:"Late হবে এর পর",k:"lateAfter"},{l:"Window শেষ",k:"end"}].map(f=>(
                      <div key={f.k}><label className="lbl">{f.l}</label><input className="inp" type="time" value={win[f.k]} onChange={e=>setWin(p=>({...p,[f.k]:e.target.value}))}/></div>
                    ))}
                    <div style={{background:"var(--surf2)",borderRadius:8,padding:"10px 12px",fontSize:12,color:"var(--txt2)"}}>ℹ️ {win.start}–{win.lateAfter} = <span style={{color:"var(--grn)"}}>On Time</span> · {win.lateAfter}–{win.end} = <span style={{color:"var(--ylw)"}}>Late</span></div>
                    <button className="btn btn-p" onClick={saveWin} disabled={saving} style={{width:"fit-content"}}>{saving?<span className="spin"/>:"Save Settings"}</button>
                  </div>
                </div>
                <div className="card" style={{maxWidth:440}}>
                  <h3 style={{fontWeight:600,marginBottom:8,fontSize:14}}>📍 Office Location</h3>
                  <div style={{background:"var(--surf2)",borderRadius:8,padding:"12px 14px",fontSize:13}}>
                    <div style={{color:"var(--txt2)",marginBottom:6}}>Latitude: <span style={{color:"var(--txt)",fontFamily:"var(--mono)"}}>{OFFICE_LAT}</span></div>
                    <div style={{color:"var(--txt2)",marginBottom:6}}>Longitude: <span style={{color:"var(--txt)",fontFamily:"var(--mono)"}}>{OFFICE_LNG}</span></div>
                    <div style={{color:"var(--txt2)"}}>Radius: <span style={{color:"var(--acc)",fontFamily:"var(--mono)"}}>{OFFICE_RADIUS_METERS}m</span></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function App(){
  const [user,setUser]=useState(null);
  const [userData,setUserData]=useState(null);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    return onAuthStateChanged(auth,async fbUser=>{
      if(fbUser){
        try{const d=await getDoc(doc(db,"employees",fbUser.uid));if(d.exists()){setUserData({uid:fbUser.uid,...d.data()});setUser(fbUser);}}
        catch{}
      }else{setUser(null);setUserData(null);}
      setLoading(false);
    });
  },[]);
  if(loading)return(
    <div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"var(--bg)"}}>
      <div style={{textAlign:"center"}}><div className="spin" style={{width:36,height:36,margin:"0 auto 14px",borderWidth:3}}/><div style={{color:"var(--txt3)",fontSize:13}}>Loading…</div></div>
    </div>
  );
  return<><style>{CSS}</style><Toasts/>{!user?<Login/>:userData?.role==="admin"?<AdminDash user={userData}/>:<EmpDash user={userData}/>}</>;
}
