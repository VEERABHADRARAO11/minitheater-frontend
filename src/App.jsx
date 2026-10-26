import {useEffect,useMemo,useRef,useState} from 'react';
import {io} from 'socket.io-client';
import './styles.css';

const cid=(()=>{let c=localStorage.cid;if(!c)c=localStorage.cid=Math.random().toString(36).slice(2);return c})();
const sock=io({autoConnect:false});
const post=(u,b)=>fetch(u,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}).then(r=>r.json());
const upload=async f=>{const d=new FormData();d.append('file',f);return(await fetch('/api/upload',{method:'POST',body:d}).then(r=>r.json())).url};
const ytId=u=>(u.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/)||[])[1];
const ROWS='ABCDEFGH'.split(''),COLS=8,EMO=['🔥','👏','😂','😍','😭','🎉','🥳','💀'];

/* ════════════════════════════════ APP ROOT ════════════════════════════════ */
export default function App(){
  const m=location.pathname.match(/\/join\/(\w+)/);
  const [view,setView]=useState(m?'join':'home'),[s,setS]=useState(null);
  const [code,setCode]=useState(m?m[1].toUpperCase():'');
  const enter=(c,name,host)=>new Promise(res=>{
    sock.off('connect');
    sock.on('connect',()=>sock.emit('join',{code:c,name,cid,host},a=>{
      if(a.error)return res(a.error);
      setS(a);setView('theater');res();
    }));
    sock.disconnect();sock.connect();
  });
  if(view==='theater')return <Theater s={s}/>;
  if(view==='create')return <Create enter={enter} back={()=>setView('home')}/>;
  if(view==='join')return <Join code={code} setCode={setCode} enter={enter} back={()=>setView('home')}/>;
  return(
    <div className="wrap hero">
      <h1>Mini<br/>Theater</h1>
      <p className="sub">Your friends. Your movie. Your FDFS. 🎬</p>
      <div className="hero-btns">
        <button onClick={()=>setView('create')}>🎭 Create Room</button>
        <button className="ghost" onClick={()=>setView('join')}>🎟 Join with Code</button>
      </div>
    </div>
  );
}

/* ════════════════════════════════ CREATE ════════════════════════════════ */
function Create({enter,back}){
  const [name,setName]=useState(''),[kind,setKind]=useState('yt'),[mv,setMv]=useState('');
  const [fanKind,setFanKind]=useState('yt'),[fan,setFan]=useState(null),[fanYt,setFanYt]=useState('');
  const [busy,setBusy]=useState(false),[err,setErr]=useState('');
  const go=async()=>{
    if(!name.trim()||!mv)return setErr('Add your name and a movie');
    if(kind==='yt'&&!ytId(mv))return setErr('Invalid YouTube link');
    if(fanKind==='yt'&&fanYt&&!ytId(fanYt))return setErr('Fan edit YouTube link is invalid');
    setBusy(true);setErr('');
    try{
      const movie=kind==='yt'?{type:'yt',url:mv}:{type:'file',url:await upload(mv)};
      let fanData=null;
      if(fanKind==='yt'&&fanYt)fanData={type:'yt',url:fanYt};
      else if(fanKind==='file'&&fan)fanData={type:'file',url:await upload(fan)};
      const {code}=await post('/api/rooms',{host:name,movie,fan:fanData});
      const e=await enter(code,name,true);if(e)setErr(e);
    }catch{setErr('Something went wrong. Is the server running?')}
    setBusy(false);
  };
  return(
    <div className="wrap">
      <div className="page-header"><h2>Create Room</h2><p>Set up your private theater</p></div>
      <label>Your name</label>
      <input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Bhadra"/>

      <label>Movie</label>
      <div className="tabs">
        <button className={kind==='yt'?'':'ghost'} onClick={()=>{setKind('yt');setMv('')}}>▶ YouTube Link</button>
        <button className={kind==='file'?'':'ghost'} onClick={()=>{setKind('file');setMv('')}}>📁 Upload File</button>
      </div>
      {kind==='yt'
        ?<input placeholder="https://youtube.com/watch?v=..." value={mv} onChange={e=>setMv(e.target.value)}/>
        :<input type="file" accept="video/*" onChange={e=>setMv(e.target.files[0])}/>}

      <label>Fan Edits Video (plays first — optional)</label>
      <div className="tabs">
        <button className={fanKind==='yt'?'':'ghost'} onClick={()=>{setFanKind('yt');setFan(null)}}>▶ YouTube Link</button>
        <button className={fanKind==='file'?'':'ghost'} onClick={()=>{setFanKind('file');setFanYt('')}}>📁 Upload File</button>
      </div>
      {fanKind==='yt'
        ?<input placeholder="https://youtube.com/watch?v=... (optional)" value={fanYt} onChange={e=>setFanYt(e.target.value)}/>
        :<input type="file" accept="video/*" onChange={e=>setFan(e.target.files[0])}/>}

      {err&&<p className="err">{err}</p>}
      <div className="form-btns">
        <button disabled={busy} onClick={go}>{busy?'⏳ Uploading...':'🎬 Create Room'}</button>
        <button className="ghost" onClick={back}>← Back</button>
      </div>
    </div>
  );
}

/* ════════════════════════════════ JOIN ════════════════════════════════ */
function Join({code,setCode,enter,back}){
  const [name,setName]=useState(''),[err,setErr]=useState('');
  const go=async()=>{const e=await enter(code,name,false);if(e)setErr(e)};
  return(
    <div className="wrap">
      <div className="page-header"><h2>Join Show</h2><p>Enter your room code</p></div>
      <label>Room Code</label>
      <input className="code" maxLength={6} value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="ABCDEF"/>
      <label>Your name (optional)</label>
      <input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Friend"/>
      {err&&<p className="err">{err}</p>}
      <div className="form-btns">
        <button disabled={code.length<6} onClick={go}>🎟 Join Theater</button>
        <button className="ghost" onClick={back}>← Back</button>
      </div>
    </div>
  );
}

/* ════════════════════════════════ PLAYER ════════════════════════════════ */
function Player({src,st,host,onEnd}){
  const stRef=useRef(st);stRef.current=st;
  const v=useRef(),box=useRef(),pl=useRef(),ready=useRef(false);
  const isY=src.type==='yt';
  const apply=()=>{const s=stRef.current;
    if(isY){const p=pl.current;if(!ready.current||!p)return;
      if(Math.abs(p.getCurrentTime()-s.time)>2)p.seekTo(s.time,true);
      s.playing?p.playVideo():p.pauseVideo();}
    else{const e=v.current;if(!e)return;
      if(Math.abs(e.currentTime-s.time)>1.5)e.currentTime=s.time;
      s.playing?e.play().catch(()=>{}):e.pause();}};
  useEffect(apply,[st]);
  useEffect(()=>{
    if(!isY)return;
    const make=()=>{pl.current=new window.YT.Player(box.current,{
      videoId:ytId(src.url),width:'100%',height:'100%',
      playerVars:{playsinline:1,controls:host?1:0,rel:0,disablekb:host?0:1},
      events:{
        onReady:()=>{ready.current=true;apply();},
        onStateChange:e=>{
          if(!host)return;
          if(e.data===0)onEnd();
          else if(e.data===1||e.data===2)sock.emit('ctrl',{playing:e.data===1,time:pl.current.getCurrentTime()});
        }
      }})};
    if(window.YT?.Player)make();
    else{window.onYouTubeIframeAPIReady=make;if(!document.getElementById('yta')){const t=document.createElement('script');t.id='yta';t.src='https://www.youtube.com/iframe_api';document.head.appendChild(t)}}
    return()=>pl.current?.destroy?.();
  },[]);
  if(isY)return<div className={'vid'+(host?'':' lock')}><div ref={box}/></div>;
  const emit=()=>host&&sock.emit('ctrl',{playing:!v.current.paused,time:v.current.currentTime});
  return<video ref={v} src={src.url} playsInline controls={host} className={'vid'+(host?'':' lock')}
    onEnded={host?onEnd:undefined} onPlay={emit} onPause={emit} onSeeked={emit}/>;
}

/* ════════════════════════════════ THEATER ════════════════════════════════ */
function Theater({s}){
  const [room,setRoom]=useState(s.room),[st,setSt]=useState(s.room.st);
  const [tap,setTap]=useState(false),[fx,setFx]=useState([]);
  const [b,setB]=useState(0),[tk,setTk]=useState(!s.isHost);
  const [tab,setTab]=useState('react'); // 'react' | 'chat'
  const [msgs,setMsgs]=useState(s.msgs||[]);
  const [chatText,setChatText]=useState('');
  const chatEndRef=useRef();
  const stage=useRef();

  useEffect(()=>{
    const ev={
      room:setRoom,
      state:setSt,
      react:p=>{
        setFx(f=>[...f,p]);
        setTimeout(()=>setFx(f=>f.filter(q=>q.k!==p.k)),3500);
      },
      burst:()=>{setB(n=>n+1);setTimeout(()=>setB(0),3800);},
      chat:msg=>setMsgs(m=>[...m,msg]),
    };
    Object.entries(ev).forEach(([k,f])=>sock.on(k,f));
    return()=>Object.entries(ev).forEach(([k,f])=>sock.off(k,f));
  },[]);

  // Auto scroll chat
  useEffect(()=>{chatEndRef.current?.scrollIntoView({behavior:'smooth'});},[msgs]);

  const parts=useMemo(()=>Array.from({length:60},(_,i)=>({'--dx':(i%2?-1:1)*(20+Math.random()*65)+'vw','--dy':-(35+Math.random()*65)+'vh','--h':Math.random()*360,left:i%2?'auto':0,right:i%2?0:'auto'})),[b]);
  const ticket=useMemo(()=>({name:s.me.name,seat:s.me.seat,code:room.code,time:new Date().toLocaleString()}),[]);
  const by=Object.fromEntries(room.people.map(p=>[p.seat,p]));
  const link=location.origin+'/join/'+room.code;
  const fs=()=>(stage.current.requestFullscreen?.()||Promise.resolve()).then(()=>screen.orientation?.lock?.('landscape')).catch(()=>{});
  const share=()=>{const t='Join my mini theater! Code '+room.code+' '+link;navigator.share?navigator.share({text:t}).catch(()=>{}):navigator.clipboard.writeText(t)};

  const sendChat=e=>{
    e.preventDefault();
    if(!chatText.trim())return;
    sock.emit('chat',{text:chatText});
    setChatText('');
  };

  return(
    <div className="theater">
      {/* HEADER */}
      <header className="theater-hdr">
        <div className="theater-hdr-left">
          <h2>{room.host}'s Theater</h2>
          <small>Code <b>{room.code}</b> · {room.people.length} seated</small>
        </div>
        <div className="theater-hdr-right">
          <button className="ghost" onClick={()=>setTk(true)}>🎟</button>
          <button className="ghost" onClick={share}>📤</button>
          <button className="ghost" onClick={fs}>⛶</button>
        </div>
      </header>

      {/* STAGE */}
      <div className="stage-wrap">
        <div className="stage" ref={stage}>
          {st.phase==='fan'&&room.fan&&<Player key="fan" src={room.fan} st={st} host={s.isHost} onEnd={()=>sock.emit('phase','movie')}/>}
          {st.phase==='movie'&&<Player key="mv" src={room.movie} st={st} host={s.isHost} onEnd={()=>sock.emit('phase','end')}/>}
          {st.phase==='end'&&<div className="end"><h1>THE END</h1><p>Thanks for watching together 🎬</p></div>}
          <div className={'cur'+(st.phase==='lobby'?'':' open')}><i/><i/>
            <b>{s.isHost?'Wait for your friends, then open the theater':'Waiting for the host…'}</b>
          </div>
          <div className="fx">
            {fx.map(p=><em key={p.k} style={{left:((+p.seat.slice(1)-.5)/COLS*100)+'%'}}>{p.e}</em>)}
          </div>
        </div>
      </div>

      {/* HINT */}
      <p className="hint">Rotate your phone for full cinema view 📱</p>

      {/* HOST CONTROLS */}
      {s.isHost&&(
        <div className="host-ctrl">
          {st.phase==='lobby'
            ?<button className="btn-open" onClick={()=>sock.emit('open')}>OPEN THE THEATER 🎬</button>
            :<button className="ghost danger" onClick={()=>sock.emit('phase','end')}>End Show</button>}
        </div>
      )}

      {/* SEATS */}
      <div className="seats-wrap">
        <p className="seats-title">🎭 Seats</p>
        <div className="seats">
          {ROWS.map(r=>(
            <div key={r} className="row">
              <u>{r}</u>
              {Array.from({length:COLS},(_,i)=>{const id=r+(i+1),p=by[id];
                return<span key={id} title={p?.name} className={'seat'+(p?' on':'')+(id===s.me.seat?' me':'')}>{p?(p.name[0]||'?').toUpperCase():''}</span>})}
            </div>
          ))}
        </div>
      </div>

      {/* BOTTOM BAR: Reactions + Chat */}
      <div className="bottom-bar">
        <div className="bottom-tabs">
          <button className={tab==='react'?'active':''} onClick={()=>setTab('react')}>😄 Reactions</button>
          <button className={tab==='chat'?'active':''} onClick={()=>setTab('chat')}>💬 Chat</button>
        </div>
        {tab==='react'&&(
          <div className="react-row">
            {EMO.map(e=><button key={e} onClick={()=>sock.emit('react',e)}>{e}</button>)}
          </div>
        )}
        {tab==='chat'&&(
          <div className="chat-wrap">
            <div className="chat-msgs">
              {msgs.length===0&&<span style={{color:'var(--text-muted)',fontSize:12,margin:'auto',textAlign:'center'}}>No messages yet. Say hi! 👋</span>}
              {msgs.map(msg=>(
                <div key={msg.id} className={'chat-msg'+(msg.seat===s.me.seat?' me':'')}>
                  <span className="cn">{msg.name}</span>
                  <span className="ct">{msg.text}</span>
                </div>
              ))}
              <div ref={chatEndRef}/>
            </div>
            <form className="chat-form" onSubmit={sendChat}>
              <input
                value={chatText}
                onChange={e=>setChatText(e.target.value)}
                placeholder="Type a message…"
                maxLength={200}
              />
              <button type="submit">Send</button>
            </form>
          </div>
        )}
      </div>

      {/* BURST */}
      {b>0&&<div className="burst" key={b}>{parts.map((p,i)=><i key={i} style={p}/>)}</div>}

      {/* TICKET */}
      {tk&&<Ticket t={ticket} close={()=>setTk(false)}/>}

      {/* GATE */}
      {!tap&&(
        <div className="gate">
          <h1>FDFS Tonight</h1>
          <p>Seat <b>{s.me.seat}</b> · {room.host}'s Theater</p>
          <button onClick={()=>setTap(true)}>Tap to Enter Theater 🎬</button>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════ TICKET ════════════════════════════════ */
function Ticket({t,close}){
  const dl=()=>{
    const c=document.createElement('canvas');c.width=900;c.height=360;
    const x=c.getContext('2d');
    x.fillStyle='#000';x.fillRect(0,0,900,360);
    const g=x.createLinearGradient(0,0,900,360);g.addColorStop(0,'#000');g.addColorStop(.5,'#0a1a3a');g.addColorStop(1,'#000');
    x.fillStyle=g;x.fillRect(0,0,900,360);
    x.fillStyle='#00c2ff';x.font='700 20px sans-serif';x.fillText('MINI THEATER  ·  FDFS',40,56);
    x.fillStyle='#fff';x.font='700 62px sans-serif';x.fillText(t.name,40,140);
    x.fillStyle='#6880aa';x.font='26px sans-serif';x.fillText('Seat '+t.seat+'    Room '+t.code,40,200);
    x.font='18px sans-serif';x.fillText(t.time,40,248);
    x.fillStyle='#00c2ff22';for(let i=0;i<44;i++)x.fillRect(620+i*6,50,i%3?2:4,250);
    const a=document.createElement('a');a.href=c.toDataURL();a.download='ticket-'+t.seat+'.png';a.click();
  };
  return(
    <div className="modal" onClick={close}>
      <div className="ticket" onClick={e=>e.stopPropagation()}>
        <small>MINI THEATER · FDFS</small>
        <h2>{t.name}</h2>
        <div className="tr">
          <span>Seat<b>{t.seat}</b></span>
          <span>Room<b>{t.code}</b></span>
        </div>
        <small>{t.time}</small>
        <div className="bar"/>
        <div className="ticket-btns">
          <button onClick={dl}>⬇ Download</button>
          <button className="ghost" onClick={close}>Close</button>
        </div>
      </div>
    </div>
  );
}
