import { useEffect, useRef, useState } from 'react'

const WIDTH = 560
const HEIGHT = 180
const SIGNATURE_FONT = '"Dancing Script", "Brush Script MT", cursive'

// Firma manuscrita: se dibuja con mouse, dedo o lápiz (pointer events) o se genera a partir del nombre.
// onChange recibe un data URL PNG (o null si el lienzo está vacío).
export default function SignaturePad({ onChange, defaultName = '' }) {
  const canvasRef = useRef(null)
  const drawing = useRef(false)
  const [mode, setMode] = useState('draw')
  const [typed, setTyped] = useState(defaultName)
  const [hasInk, setHasInk] = useState(false)

  const clear = () => {
    const canvas = canvasRef.current
    canvas.getContext('2d').clearRect(0, 0, WIDTH, HEIGHT)
    setHasInk(false)
    onChange?.(null)
  }

  // Al cambiar de pestaña el lienzo empieza limpio.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, WIDTH, HEIGHT)
    ctx.lineWidth = 2.6
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#111827'
    setHasInk(false)
    onChange?.(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  // Firma escrita: se dibuja el texto con una tipografía manuscrita.
  useEffect(() => {
    if (mode !== 'type') return undefined
    let cancelled = false
    const render = async () => {
      try { await document.fonts?.load(`44px ${SIGNATURE_FONT}`) } catch { /* si falla usa la tipografía de respaldo */ }
      if (cancelled) return
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, WIDTH, HEIGHT)
      const text = typed.trim()
      if (!text) {
        setHasInk(false)
        onChange?.(null)
        return
      }
      ctx.fillStyle = '#111827'
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'center'
      let size = 64
      ctx.font = `${size}px ${SIGNATURE_FONT}`
      while (ctx.measureText(text).width > WIDTH - 40 && size > 20) {
        size -= 4
        ctx.font = `${size}px ${SIGNATURE_FONT}`
      }
      ctx.fillText(text, WIDTH / 2, HEIGHT / 2)
      setHasInk(true)
      onChange?.(canvas.toDataURL('image/png'))
    }
    render()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typed, mode])

  const point = (event) => {
    const rect = canvasRef.current.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) / rect.width) * WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * HEIGHT,
    }
  }

  const start = (event) => {
    if (mode !== 'draw') return
    event.preventDefault()
    canvasRef.current.setPointerCapture?.(event.pointerId)
    drawing.current = true
    const ctx = canvasRef.current.getContext('2d')
    const { x, y } = point(event)
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + 0.01, y + 0.01) // un toque sin arrastrar deja un punto
    ctx.stroke()
  }

  const move = (event) => {
    if (!drawing.current) return
    event.preventDefault()
    const ctx = canvasRef.current.getContext('2d')
    const { x, y } = point(event)
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const end = () => {
    if (!drawing.current) return
    drawing.current = false
    setHasInk(true)
    onChange?.(canvasRef.current.toDataURL('image/png'))
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '.4rem', marginBottom: '.6rem' }}>
        <button type="button" className={`filter-tab${mode === 'draw' ? ' active' : ''}`} onClick={() => setMode('draw')}>Dibujar</button>
        <button type="button" className={`filter-tab${mode === 'type' ? ' active' : ''}`} onClick={() => setMode('type')}>Escribir nombre</button>
      </div>

      {mode === 'type' && (
        <input
          className="finput"
          style={{ marginBottom: '.6rem' }}
          value={typed}
          onChange={e => setTyped(e.target.value)}
          placeholder="Tu nombre completo"
          maxLength={60}
          aria-label="Nombre para la firma"
        />
      )}

      <div className="dm-sigpad">
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          onPointerLeave={end}
          style={{ touchAction: 'none', cursor: mode === 'draw' ? 'crosshair' : 'default' }}
          aria-label="Área de firma"
        />
        {!hasInk && mode === 'draw' && <span className="dm-sigpad-hint">Firma aquí con el mouse o con el dedo</span>}
        <div className="dm-sigpad-line" />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '.4rem' }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={mode === 'draw' ? clear : () => setTyped('')} disabled={!hasInk}>
          Borrar
        </button>
      </div>
    </div>
  )
}
