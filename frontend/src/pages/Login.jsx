import { useState, useContext, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
// 1. Importa tu contexto y la función de la API
import { AuthContext } from '../context/AuthContext'
import { loginRequest, demoLoginRequest, demoStatusRequest, publicStatsRequest } from '../api/auth'

class Particle {
  constructor(canvas) {
    this.canvas = canvas
    this.reset()
  }
  reset() {
    this.x = Math.random() * this.canvas.width
    this.y = Math.random() * this.canvas.height
    this.vx = (Math.random() - 0.5) * 0.8 // Un poco más de movimiento
    this.vy = (Math.random() - 0.5) * 0.8
    this.radius = Math.random() * 2 + 1
  }
  update(mouse) {
    this.x += this.vx
    this.y += this.vy
    
    // Efecto rebote suave
    if (this.x < 0 || this.x > this.canvas.width) this.vx *= -1
    if (this.y < 0 || this.y > this.canvas.height) this.vy *= -1

    // Interacción con mouse (opcional: las partículas se alejan un poco)
    if (mouse.x !== null) {
        const dx = this.x - mouse.x
        const dy = this.y - mouse.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < mouse.radius) {
            const force = (mouse.radius - dist) / mouse.radius
            this.x += dx * force * 0.02
            this.y += dy * force * 0.02
        }
    }
  }
  draw(ctx) {
    ctx.beginPath()
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(212, 175, 55, 0.8)' // Gold
    ctx.fill()
  }
}

const QUICK_ROLES = [
  { role: 'SUPER_ADMIN', label: 'Super Admin', desc: 'Control total del sistema', path: '/superadmin/dashboard',
    icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
  { role: 'ADMIN', label: 'Administrador', desc: 'Calidad, documentos y auditorías', path: '/admin/dashboard',
    icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
  { role: 'COLABORADOR', label: 'Colaborador', desc: 'Tareas, documentos y hallazgos', path: '/colaborador/mipanel',
    icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
  { role: 'CONSULTOR', label: 'Consultor', desc: 'Auditoría y análisis (lectura)', path: '/consultor/panel',
    icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
]

const ROLE_HOME = Object.fromEntries(QUICK_ROLES.map(r => [r.role, r.path]))

export default function Login() {
  const navigate = useNavigate()
  const { login } = useContext(AuthContext)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMsg, setErrorMsg] = useState(null)
  const [demoEnabled, setDemoEnabled] = useState(false)
  const [demoRoles, setDemoRoles] = useState([])
  const [demoLoading, setDemoLoading] = useState(null)
  const [stats, setStats] = useState(null)
  
  // Referencia para el canvas de partículas
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let animationFrameId
    
    let particles = []
    const particleCount = 80 // Más densidad
    const connectionDistance = 150 // Más rango
    const mouse = { x: null, y: null, radius: 200 } // Radio de interacción del mouse

    const setCanvasSize = () => {
      canvas.width = canvas.parentElement.offsetWidth
      canvas.height = canvas.parentElement.offsetHeight
    }

    const init = () => {
      setCanvasSize()
      particles = []
      for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle(canvas))
      }
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        p.update(mouse)
        p.draw(ctx)

        // Conexión entre partículas
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j]
          const dx = p.x - p2.x
          const dy = p.y - p2.y
          const dist = Math.sqrt(dx * dx + dy * dy)

          if (dist < connectionDistance) {
            ctx.beginPath()
            ctx.strokeStyle = `rgba(212, 175, 55, ${0.4 * (1 - dist / connectionDistance)})`
            ctx.lineWidth = 0.8
            ctx.moveTo(p.x, p.y)
            ctx.lineTo(p2.x, p2.y)
            ctx.stroke()
          }
        }

        // CONEXIÓN CON EL CURSOR (Lo que pediste: líneas al pasar el cursor)
        if (mouse.x !== null) {
            const dxMouse = p.x - mouse.x
            const dyMouse = p.y - mouse.y
            const distMouse = Math.sqrt(dxMouse * dxMouse + dyMouse * dyMouse)
            
            if (distMouse < mouse.radius) {
                ctx.beginPath()
                ctx.strokeStyle = `rgba(212, 175, 55, ${0.6 * (1 - distMouse / mouse.radius)})`
                ctx.lineWidth = 1.2 // Línea más fuerte con el mouse
                ctx.moveTo(p.x, p.y)
                ctx.lineTo(mouse.x, mouse.y)
                ctx.stroke()
            }
        }
      }
      animationFrameId = requestAnimationFrame(animate)
    }

    window.addEventListener('resize', init)
    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect()
      mouse.x = e.clientX - rect.left
      mouse.y = e.clientY - rect.top
    }
    
    canvas.parentElement.addEventListener('mousemove', handleMouseMove)

    init()
    animate()

    return () => {
      window.removeEventListener('resize', init)
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  // Botones de acceso rápido y cifras reales del sistema (no dependen de que haya sesión).
  useEffect(() => {
    let cancelled = false
    demoStatusRequest()
      .then(res => {
        if (cancelled) return
        setDemoEnabled(Boolean(res.data?.data?.enabled))
        setDemoRoles(res.data?.data?.roles || [])
      })
      .catch(() => {})
    publicStatsRequest()
      .then(res => { if (!cancelled) setStats(res.data?.data || null) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const finishLogin = (data) => {
    login(data)
    const home = ROLE_HOME[data.user?.role]
    if (home) navigate(home)
  }

  const handleQuickLogin = async (role) => {
    setErrorMsg(null)
    setDemoLoading(role)
    try {
      const res = await demoLoginRequest(role)
      finishLogin(res.data)
    } catch (error) {
      setErrorMsg(error.response?.data?.message || 'No se pudo iniciar el acceso rápido. Intenta de nuevo.')
      setDemoLoading(null)
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setErrorMsg(null)

    try {
      const res = await loginRequest({ email, password });
      finishLogin(res.data);
    } catch (error) {
      setErrorMsg(error.response?.data?.message || "Error al iniciar sesión.");
    }
  }

  return (
    <div className="shell" style={{ display: 'flex', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif", background: 'var(--red-k)', overflow: 'hidden' }}>
      <style>
        {`
          @keyframes goldSweep {
            0% { background-position: -150% center; }
            100% { background-position: 150% center; }
          }
          .role-quick { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: #fff; border: 1px solid var(--border2); border-radius: 8px; cursor: pointer; transition: all .2s; font-family: inherit; }
          .role-quick:hover:not(:disabled) { border-color: var(--gold); box-shadow: 0 4px 14px rgba(123,30,34,.12); transform: translateY(-1px); }
          .role-quick:disabled { opacity: .6; cursor: wait; }
          .role-quick-ico { width: 34px; height: 34px; border-radius: 8px; background: linear-gradient(135deg,var(--red-m),var(--red)); color: var(--gold-l); display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
          .shimmer-text {
            background: linear-gradient(
              90deg, 
              var(--gold) 0%, 
              var(--gold) 35%, 
              #FFE182 50%, 
              var(--gold) 65%, 
              var(--gold) 100%
            );
            background-size: 200% auto;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            /* El barrido es más lento y suave para mayor elegancia */
            animation: goldSweep 5s infinite ease-in-out;
            display: inline-block;
          }
        `}
      </style>

      {/* Hero */}
      <div className="hero" style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '5rem', overflow: 'hidden', minHeight: '100vh' }}>
        {/* Constellation Canvas */}
        <canvas 
          ref={canvasRef}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 3, pointerEvents: 'none' }}
        />

        <div style={{ position: 'absolute', inset: 0, zIndex: 1, background: 'linear-gradient(to top,var(--red-k) 10%,rgba(61,14,17,.85) 50%,rgba(30,6,8,.6) 100%)' }} />
        <div style={{ position: 'absolute', zIndex: 2, bottom: '-10%', left: '-5%', width: '60%', height: '60%', background: 'radial-gradient(ellipse,rgba(201,168,76,.15) 0%,transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, zIndex: 10, background: 'linear-gradient(to bottom,transparent 0%,var(--red-b) 30%,var(--gold) 70%,transparent 100%)' }} />
        <div style={{ position: 'absolute', top: '2rem', left: '2rem', width: 32, height: 32, borderTop: '1.5px solid rgba(201,168,76,.5)', borderLeft: '1.5px solid rgba(201,168,76,.5)', zIndex: 4, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '2rem', right: '2rem', width: 32, height: 32, borderBottom: '1.5px solid rgba(201,168,76,.5)', borderRight: '1.5px solid rgba(201,168,76,.5)', zIndex: 4, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', right: '-1rem', top: '50%', transform: 'translateY(-52%)', fontFamily: "'Playfair Display', serif", fontSize: 'clamp(14rem,22vw,28rem)', fontWeight: 900, color: 'rgba(123,30,34,.1)', zIndex: 2, pointerEvents: 'none', userSelect: 'none', lineHeight: 1 }}>I</div>

        <div style={{ position: 'relative', zIndex: 5, maxWidth: 600, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ marginBottom: '2.5rem' }}>
            <div style={{ width: 64, height: 64, background: 'linear-gradient(135deg,var(--red-m),var(--red))', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', border: '1px solid rgba(201,168,76,.3)' }}>
              <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.6rem', fontWeight: 900, color: 'var(--gold-l)' }}>IO</span>
            </div>
          </div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(2.4rem,4vw,5rem)', fontWeight: 900, lineHeight: .95, letterSpacing: '-.02em', color: '#fff', marginBottom: '1.5rem' }}>
            Sistema<br />
            <em className="shimmer-text" style={{ display: 'block', fontStyle: 'italic', fontWeight: 400 }}>Operativo</em>
          </h1>
          <p style={{ fontSize: '1rem', fontWeight: 300, color: 'rgba(255,255,255,.7)', lineHeight: 1.8, maxWidth: 480, marginBottom: '2.5rem' }}>
            Gestión integrada de <strong style={{ color: 'rgba(255,255,255,.9)', fontWeight: 500 }}>calidad, documentos y auditorías</strong> bajo la norma ISO 9001:2015.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: '2.5rem', width: '100%', maxWidth: 250 }}>
            <div style={{ flex: 1, height: 2, background: 'linear-gradient(to left,var(--red-b),transparent)' }} />
            <div style={{ width: 5, height: 5, background: 'var(--gold)', transform: 'rotate(45deg)', flexShrink: 0 }} />
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right,rgba(201,168,76,.6),transparent)' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 0 }}>
            {[{ num: stats ? String(stats.documentsActive) : '—', label: 'Docs. Vigentes' }, { num: stats ? `${stats.compliance}%` : '—', label: 'Cumplimiento ISO' }, { num: stats ? String(stats.audits) : '—', label: 'Auditorías' }].map((s, i, arr) => (
              <div key={i} style={{ padding: '0 1.8rem 0 0', borderRight: i < arr.length - 1 ? '1px solid rgba(201,168,76,.2)' : 'none', paddingLeft: i > 0 ? '1.8rem' : 0 }}>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', fontWeight: 700, color: 'var(--gold-l)', lineHeight: 1, marginBottom: '.35rem' }}>{s.num}</div>
                <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: '.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,.4)', lineHeight: 1.5 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Panel */}
      <div style={{ width: '45%', minWidth: 420, maxWidth: 650, flexShrink: 0, background: 'var(--off-white)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem 4rem', position: 'relative', overflowY: 'auto', boxShadow: '-40px 0 100px rgba(0,0,0,.8),-1px 0 0 rgba(201,168,76,.2)' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(to right,var(--red-d),var(--red),var(--gold),var(--red),var(--red-d))' }} />
        <div style={{ position: 'absolute', top: '-30%', left: '50%', transform: 'translateX(-50%)', width: '120%', height: '50%', background: 'radial-gradient(ellipse,rgba(123,30,34,.07) 0%,transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

        <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 400 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '2rem' }}>
            <div style={{ width: 22, height: 1.5, background: 'var(--gold)' }} />
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--gold-d)' }}>Acceso Seguro</span>
          </div>

          <div style={{ marginBottom: '1.6rem' }}>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '2.4rem', fontWeight: 900, color: 'var(--ink)', letterSpacing: '-.02em', lineHeight: 1.05 }}>
              Iniciar <em style={{ fontStyle: 'italic', fontWeight: 400, color: 'var(--red)' }}>Sesión</em>
            </h2>
            <p style={{ fontSize: '.85rem', color: 'var(--ash)', marginTop: '.5rem', lineHeight: 1.55 }}>Ingresa tus credenciales para acceder al portal Indusecc.</p>
          </div>

          {/* 5. Mostramos un mensaje de error si el login falla */}
          {errorMsg && (
            <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#ffebee', color: '#c62828', borderRadius: 8, fontSize: '0.85rem', border: '1px solid #ef9a9a' }}>
              {errorMsg}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '1.6rem 0 2rem' }}>
            <div style={{ width: 18, height: 2, background: 'var(--red)', flexShrink: 0 }} />
            <div style={{ width: 4, height: 4, background: 'var(--gold)', transform: 'rotate(45deg)', flexShrink: 0 }} />
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right,var(--gold),rgba(201,168,76,.1))' }} />
          </div>

          {demoEnabled && (
            <div style={{ marginBottom: '1.6rem' }}>
              <div style={{ fontSize: '.73rem', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ash)', marginBottom: '.7rem' }}>Entrar con un clic</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.6rem' }}>
                {QUICK_ROLES.filter(r => demoRoles.includes(r.role)).map(r => (
                  <button
                    key={r.role}
                    type="button"
                    className="role-quick"
                    onClick={() => handleQuickLogin(r.role)}
                    disabled={demoLoading !== null}
                    aria-label={`Entrar como ${r.label}`}
                  >
                    <span className="role-quick-ico">
                      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" width="18"><path strokeLinecap="round" strokeLinejoin="round" d={r.icon} /></svg>
                    </span>
                    <span style={{ textAlign: 'left', minWidth: 0 }}>
                      <span style={{ display: 'block', fontWeight: 700, fontSize: '.85rem', color: 'var(--ink)' }}>{demoLoading === r.role ? 'Entrando…' : r.label}</span>
                      <span style={{ display: 'block', fontSize: '.68rem', color: 'var(--ash)', lineHeight: 1.3 }}>{r.desc}</span>
                    </span>
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '1.2rem 0 0' }}>
                <div style={{ flex: 1, height: 1, background: 'var(--border2)' }} />
                <span style={{ fontSize: '.7rem', color: 'var(--ash)', fontWeight: 600 }}>o con tu correo</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border2)' }} />
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {/* ELIMINÉ EL SIMULADOR DE ROLES DE AQUÍ */}

            <div style={{ marginBottom: '1.4rem' }}>
              <label style={{ fontSize: '.73rem', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ash)', display: 'block', marginBottom: '.5rem' }}>Correo electrónico</label>
              <input 
                className="finput" 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)} // Guardamos lo que escribe
                placeholder="usuario@indusecc.com" 
                required
              />
            </div>

            <div style={{ marginBottom: '1.8rem' }}>
              <label style={{ fontSize: '.73rem', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ash)', display: 'block', marginBottom: '.5rem' }}>Contraseña</label>
              <input 
                className="finput" 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)} // Guardamos lo que escribe
                placeholder="Tu contraseña segura" 
                required
              />
              <div style={{ textAlign: 'right', marginTop: '.5rem' }}>
                <span onClick={() => navigate('/forgot-password')} style={{ fontSize: '.78rem', color: 'var(--red)', fontWeight: 600, cursor: 'pointer' }}>¿Olvidaste tu contraseña?</span>
              </div>
            </div>

            <button type="submit" className="btn btn-red" style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: '.9rem', letterSpacing: '.02em' }}>
              Ingresar al Sistema
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" width="20"><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
            <p style={{ fontSize: '.82rem', color: 'var(--ash)' }}>¿No tienes cuenta? <span onClick={() => navigate('/register')} style={{ color: 'var(--red)', fontWeight: 600, cursor: 'pointer' }}>Solicitar acceso</span></p>
          </div>

          <div style={{ marginTop: '2.5rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" width="14" style={{ color: 'var(--ash-l)', flexShrink: 0 }}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
            <span style={{ fontSize: '.72rem', color: 'var(--ash)', lineHeight: 1.5 }}>Acceso protegido · Indusecc SGC © 2026</span>
          </div>
        </div>
      </div>
    </div>
  )
}