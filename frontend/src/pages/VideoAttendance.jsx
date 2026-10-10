import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, CircleStop, Download, Radio, UserCheck, Users, ScanFace, RefreshCw, UploadCloud, Play, Pause, RotateCcw } from 'lucide-react'
import Layout from '../components/Layout'
import { api, API_URL, getToken } from '../lib/api'

export default function VideoAttendance({ user }) {
  const { id } = useParams(); const navigate = useNavigate()
  const videoRef = useRef(null); const canvasRef = useRef(null); const loopRef = useRef(null); const inFlight = useRef(false); const fileUrlRef = useRef(null)
  const [session, setSession] = useState(null)
  const [attendance, setAttendance] = useState({ rows: [], present: 0, absent: 0, total: 0 })
  const [videoFile, setVideoFile] = useState(null); const [processing, setProcessing] = useState(false)
  const [faces, setFaces] = useState([]); const [frameSize, setFrameSize] = useState({ width: 16, height: 9 })
  const [progress, setProgress] = useState({ current: 0, duration: 0 }); const [notice, setNotice] = useState(''); const [error, setError] = useState('')

  async function load() {
    try { const [s,a]=await Promise.all([api(`/api/sessions/${id}`),api(`/api/sessions/${id}/attendance`)]); setSession(s); setAttendance(a) }
    catch(err){setError(err.message)}
  }
  useEffect(() => { load(); return () => cleanup() }, [id])

  function cleanup() { if(loopRef.current) clearInterval(loopRef.current); loopRef.current=null; if(fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current) }

  function chooseVideo(e) {
    const file = e.target.files?.[0]; if(!file) return
    if(fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current)
    const url=URL.createObjectURL(file); fileUrlRef.current=url; setVideoFile({file,url}); setFaces([]); setProgress({current:0,duration:0}); setError('')
  }

  async function startProcessing() {
    if(!videoFile) return setError('Choose a classroom video first.')
    if(session.status==='closed') return setError('This session is closed.')
    setError(''); setProcessing(true)
    try { await videoRef.current.play(); loopRef.current=setInterval(captureAndRecognize, 1000) }
    catch(err){setProcessing(false);setError(err.message)}
  }

  function pauseProcessing() { if(loopRef.current) clearInterval(loopRef.current); loopRef.current=null; videoRef.current?.pause(); setProcessing(false) }
  function restartVideo() { pauseProcessing(); if(videoRef.current){videoRef.current.currentTime=0}; setFaces([]); setProgress(p=>({...p,current:0})) }

  async function captureAndRecognize() {
    const video=videoRef.current, canvas=canvasRef.current
    if(!video || !canvas || video.readyState<2 || video.paused || video.ended || inFlight.current) return
    inFlight.current=true
    try {
      const w=video.videoWidth,h=video.videoHeight; setFrameSize({width:w,height:h}); canvas.width=w;canvas.height=h
      const ctx=canvas.getContext('2d');ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(video,0,0,w,h)
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.84)); const form=new FormData();form.append('frame',blob,'video_frame.jpg');form.append('source','video_upload')
      const data=await api(`/api/sessions/${id}/recognize`,{method:'POST',body:form});setFaces(data.faces||[]);setFrameSize({width:data.frame_width||w,height:data.frame_height||h})
      if(data.newly_marked?.length){setNotice(`${data.newly_marked.join(', ')} marked present`);setTimeout(()=>setNotice(''),2500);setAttendance(await api(`/api/sessions/${id}/attendance`))}
    } catch(err){setError(err.message)} finally{inFlight.current=false}
  }

  async function closeSession(){pauseProcessing();try{await api(`/api/sessions/${id}/close`,{method:'POST'});await load()}catch(err){setError(err.message)}}
  async function downloadCsv(){try{const response=await fetch(`${API_URL}/api/sessions/${id}/export.csv`,{headers:{Authorization:`Bearer ${getToken()}`}});if(!response.ok)throw new Error('Could not export CSV');const blob=await response.blob();const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`attendance_session_${id}.csv`;a.click();URL.revokeObjectURL(url)}catch(err){setError(err.message)}}

  if(!session)return <Layout user={user}><div className="loading-page"><RefreshCw className="spin"/>Loading session…</div></Layout>

  return <Layout user={user}>
    <header className="page-header compact"><div className="header-with-back"><button className="icon-btn" onClick={()=>navigate('/doctor')}><ArrowLeft size={19}/></button><div><span className="eyebrow">Video attendance · {session.room_name}</span><h1>{session.course_name}</h1><p>Upload a prerecorded classroom video. No room webcam is required.</p></div></div><div className="header-actions"><button className="ghost-btn" onClick={downloadCsv}><Download size={17}/>Export CSV</button>{session.status==='open'&&<button className="danger-btn" onClick={closeSession}><CircleStop size={17}/>Close session</button>}</div></header>
    {error&&<div className="error-box roomy">{error}</div>}{notice&&<div className="toast-success">{notice}</div>}
    <section className="live-grid">
      <div className="camera-card">
        <div className="camera-toolbar"><div><span className={`live-dot ${processing?'on':''}`}></span>{processing?'Processing video':'Video ready'}</div><span>{faces.length} faces in current sample</span></div>
        <div className="video-stage" style={{aspectRatio:`${frameSize.width}/${frameSize.height}`}}>
          {videoFile ? <video ref={videoRef} src={videoFile.url} playsInline controls className="unmirrored-video" onLoadedMetadata={e=>{setFrameSize({width:e.currentTarget.videoWidth||16,height:e.currentTarget.videoHeight||9});setProgress({current:0,duration:e.currentTarget.duration||0})}} onTimeUpdate={e=>setProgress({current:e.currentTarget.currentTime,duration:e.currentTarget.duration||0})} onEnded={()=>{pauseProcessing();load()}} /> : <video ref={videoRef} playsInline className="unmirrored-video" />}
          {faces.map((face,i)=>{const[x1,y1,x2,y2]=face.bbox;const style={left:`${x1/frameSize.width*100}%`,top:`${y1/frameSize.height*100}%`,width:`${(x2-x1)/frameSize.width*100}%`,height:`${(y2-y1)/frameSize.height*100}%`};return <div key={`${face.track_id}-${i}`} className={`face-box ${face.name==='Unknown'?'unknown':''}`} style={style}><span>{face.name} · {(face.similarity*100).toFixed(0)}%</span></div>})}
          {!videoFile&&<label className="camera-placeholder selectable"><div className="scan-orb"><UploadCloud size={38}/></div><h3>Choose classroom video</h3><p>MP4 / WebM / MOV supported by your browser.</p><input type="file" accept="video/*" onChange={chooseVideo}/></label>}
        </div>
        <canvas ref={canvasRef} className="hidden-canvas" />
        <div className="camera-actions video-actions">
          <label className="ghost-btn file-button"><UploadCloud size={17}/>Choose video<input type="file" accept="video/*" onChange={chooseVideo}/></label>
          {videoFile && session.status==='open' && (!processing ? <button className="primary-btn auto" onClick={startProcessing}><Play size={17}/>Play & process</button> : <button className="ghost-btn" onClick={pauseProcessing}><Pause size={17}/>Pause</button>)}
          {videoFile&&<button className="ghost-btn" onClick={restartVideo}><RotateCcw size={17}/>Restart</button>}
          <span className="muted">{formatTime(progress.current)} / {formatTime(progress.duration)} · samples one frame about every second</span>
        </div>
      </div>
      <Roster attendance={attendance}/>
    </section>
  </Layout>
}

function formatTime(sec){if(!Number.isFinite(sec))return'00:00';const m=Math.floor(sec/60);const s=Math.floor(sec%60);return`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`}
function Roster({attendance}){return <aside className="attendance-panel"><div className="mini-stats"><div><UserCheck size={18}/><span>Present<strong>{attendance.present}</strong></span></div><div><Users size={18}/><span>Total<strong>{attendance.total}</strong></span></div></div><div className="panel-head"><div><span className="eyebrow">Course roster</span><h2>Attendance</h2></div><Radio size={20}/></div><div className="roster-list">{attendance.rows.map(row=><div className="roster-row" key={row.user_id}><div className="avatar small">{row.name?.[0]}</div><div><strong>{row.name}</strong><span>{row.student_id||'No student ID'} · {row.enrolled?'Face ready':'No face profile'}</span></div><span className={`attendance-pill ${row.status.toLowerCase()}`}>{row.status}</span></div>)}</div></aside>}
