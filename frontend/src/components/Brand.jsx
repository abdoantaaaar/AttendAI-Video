import { ScanFace } from 'lucide-react'

export default function Brand({ compact = false }) {
  return (
    <div className="brand">
      <div className="brand-mark"><ScanFace size={20} strokeWidth={2.2} /></div>
      {!compact && (
        <div>
          <strong>AttendAI</strong>
          <span>Smart presence, verified.</span>
        </div>
      )}
    </div>
  )
}
