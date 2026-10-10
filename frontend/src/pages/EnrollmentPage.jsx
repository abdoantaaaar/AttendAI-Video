import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Camera, Check, RotateCcw, UploadCloud, ImagePlus } from 'lucide-react'
import Layout from '../components/Layout'
import { api } from '../lib/api'
import { ATTENDANCE_MODE } from '../config'

export default function EnrollmentPage({ user, refreshUser }) {
  const navigate = useNavigate()
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const [cameraOn, setCameraOn] = useState(false)
  const [samples, setSamples] = useState([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const videoDemo = ATTENDANCE_MODE === 'video'

  useEffect(() => () => stopCamera(), [])

  async function startCamera() {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 960 }, height: { ideal: 720 }, facingMode: { ideal: 'user' } },
        audio: false,
      })
      streamRef.current = stream
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      setCameraOn(true)
    } catch (err) { setError(err.message) }
  }

  function stopCamera() {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    streamRef.current = null; setCameraOn(false)
  }

  async function capture() {
    if (!videoRef.current || videoRef.current.readyState < 2 || samples.length >= 8) return
    const video = videoRef.current; const canvas = canvasRef.current
    canvas.width = video.videoWidth; canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height) // no mirror transform
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92))
    setSamples(prev => [...prev, { blob, url: URL.createObjectURL(blob) }])
  }

  function addFiles(e) {
    const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('image/')).slice(0, Math.max(0, 8 - samples.length))
    const next = files.map(file => ({ blob: file, url: URL.createObjectURL(file) }))
    setSamples(prev => [...prev, ...next].slice(0, 8)); e.target.value = ''
  }

  function reset() {
    samples.forEach(s => URL.revokeObjectURL(s.url)); setSamples([]); setMessage(''); setError('')
  }

  async function save() {
    if (samples.length < 1) return setError('Add at least one clear face image first.')
    setSaving(true); setError('')
    try {
      const form = new FormData()
      samples.forEach((s, i) => form.append('files', s.blob, `reference_${i + 1}.jpg`))
      const data = await api('/api/enrollment/me', { method: 'POST', body: form })
      setMessage(`Face profile saved from ${data.sample_count} clear sample(s).`)
      if (refreshUser) await refreshUser()
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  return (
    <Layout user={user}>
      <header className="page-header compact">
        <div className="header-with-back"><button className="icon-btn" onClick={() => navigate('/student')}><ArrowLeft size={19}/></button><div><span className="eyebrow">One-time identity setup</span><h1>Face reference</h1><p>{videoDemo ? 'Upload a clear reference photo. You do not need to open your webcam in this demo version.' : 'Use the camera or upload photos. The preview and captured image are not mirrored.'}</p></div></div>
      </header>

      <section className={`enroll-grid ${videoDemo ? 'upload-only' : ''}`}>
        {!videoDemo && <div className="camera-card">
          <div className="video-stage enrollment-video">
            <video ref={videoRef} muted playsInline className="unmirrored-video" />
            {!cameraOn && <div className="camera-placeholder"><div className="scan-orb"><Camera size={36}/></div><h3>Camera capture</h3><p>Normal orientation — no selfie mirror effect is applied.</p></div>}
          </div>
          <canvas ref={canvasRef} className="hidden-canvas" />
          <div className="camera-actions">
            {!cameraOn ? <button className="primary-btn auto" onClick={startCamera}><Camera size={18}/>Open camera</button> : <><button className="primary-btn auto" onClick={capture} disabled={samples.length >= 8}><Camera size={18}/>Capture ({samples.length}/8)</button><button className="ghost-btn" onClick={stopCamera}>Stop camera</button></>}
          </div>
        </div>}

        <aside className="content-card sample-panel">
          <div><span className="eyebrow">Reference images</span><h2>{samples.length} selected</h2><p>1 image works for a demo. 3–8 clear images with small angle changes are recommended for better matching.</p></div>
          <label className="big-upload-zone">
            <ImagePlus size={28}/><strong>{videoDemo ? 'Upload your reference face photo' : 'Upload face images instead'}</strong><span>JPG / PNG · up to 8 images</span>
            <input type="file" accept="image/*" multiple onChange={addFiles} />
          </label>
          <div className="sample-grid">
            {Array.from({ length: 8 }).map((_, i) => samples[i] ? <img key={i} src={samples[i].url} alt={`Face sample ${i + 1}`} /> : <div key={i} className="sample-empty">{i + 1}</div>)}
          </div>
          <div className="inline-actions"><button className="ghost-btn" onClick={reset}><RotateCcw size={17}/>Reset</button><button className="primary-btn auto" onClick={save} disabled={saving || samples.length < 1}>{saving ? 'Building embedding…' : <><UploadCloud size={18}/>Save face profile</>}</button></div>
          {error && <div className="error-box">{error}</div>}
          {message && <div className="success-box"><Check size={17}/>{message}</div>}
        </aside>
      </section>
    </Layout>
  )
}
