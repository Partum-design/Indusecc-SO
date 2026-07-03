import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { requestRegistration } from '../api/api'

export default function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', department: '', password: '', confirmPassword: '' })
  const [errorMsg, setErrorMsg] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)
  const [loading, setLoading] = useState(false)

  const update = (key, value) => setForm(p => ({ ...p, [key]: value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)

    if (!form.name || !form.email || !form.password) {
      setErrorMsg('Nombre, correo y contraseña son obligatorios')
      return
    }
    if (form.password.length < 8) {
      setErrorMsg('La contraseña debe tener al menos 8 caracteres')
      return
    }
    if (form.password !== form.confirmPassword) {
      setErrorMsg('Las contraseñas no coinciden')
      return
    }

    try {
      setLoading(true)
      const res = await requestRegistration({
        name: form.name,
        email: form.email,
        department: form.department,
        password: form.password,
        requestedRole: 'COLABORADOR',
      })
      setSuccessMsg(res.data?.message || 'Solicitud enviada. Espera la aprobación del administrador.')
      setForm({ name: '', email: '', department: '', password: '', confirmPassword: '' })
    } catch (error) {
      setErrorMsg(error.response?.data?.message || 'Error al enviar solicitud. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif", background: 'var(--red-k)' }}>
      {/* Hero */}
      <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '5rem', overflow: 'hidden', minHeight: '100vh' }}>
        <div style={{ position: 'absolute', inset: 0, zIndex: 1, background: 'linear-gradient(to top,var(--red-k) 0%,rgba(61,14,17,.82) 40%,rgba(30,6,8,.4) 100%)' }} />
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, zIndex: 10, background: 'linear-gradient(to bottom,transparent 0%,var(--red-b) 30%,var(--gold) 70%,transparent 100%)' }} />
        <div style={{ position: 'relative', zIndex: 5, maxWidth: 600, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, background: 'linear-gradient(135deg,var(--red-m),var(--red))', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem', border: '1px solid rgba(201,168,76,.3)' }}>
            <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.6rem', fontWeight: 900, color: 'var(--gold-l)' }}>IO</span>
          </div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(2.4rem,4vw,4rem)', fontWeight: 900, lineHeight: .95, letterSpacing: '-.02em', color: '#fff', marginBottom: '1.5rem' }}>
            Únete al<br />
            <em style={{ display: 'block', fontStyle: 'italic', fontWeight: 400, background: 'linear-gradient(100deg,var(--gold) 0%,var(--gold-l) 55%,var(--gold-d) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Sistema</em>
          </h1>
          <p style={{ fontSize: '1rem', fontWeight: 300, color: 'rgba(255,255,255,.7)', lineHeight: 1.8, maxWidth: 480 }}>
            Solicita acceso al portal de gestión de calidad <strong style={{ color: 'rgba(255,255,255,.9)', fontWeight: 500 }}>Indusecc SGC</strong> y empieza a colaborar con tu equipo.
          </p>
        </div>
      </div>

      {/* Panel */}
      <div style={{ width: '45%', minWidth: 420, maxWidth: 650, flexShrink: 0, background: 'var(--off-white)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem 4rem', position: 'relative', overflowY: 'auto', boxShadow: '-40px 0 100px rgba(0,0,0,.8),-1px 0 0 rgba(201,168,76,.2)' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(to right,var(--red-d),var(--red),var(--gold),var(--red),var(--red-d))' }} />
        <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 400 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '2rem' }}>
            <div style={{ width: 22, height: 1.5, background: 'var(--gold)' }} />
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--gold-d)' }}>Nuevo Usuario</span>
          </div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '2.2rem', fontWeight: 900, color: 'var(--ink)', letterSpacing: '-.02em', lineHeight: 1.05, marginBottom: '.5rem' }}>
            Crear <em style={{ fontStyle: 'italic', fontWeight: 400, color: 'var(--red)' }}>Cuenta</em>
          </h2>
          <p style={{ fontSize: '.85rem', color: 'var(--ash)', lineHeight: 1.55, marginBottom: '1.8rem' }}>Completa el formulario para solicitar acceso al sistema.</p>

          {errorMsg && (
            <div style={{ marginBottom: '1rem', padding: '1rem', background: '#ffebee', color: '#c62828', borderRadius: 8, fontSize: '0.85rem', border: '1px solid #ef9a9a' }}>
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div style={{ marginBottom: '1rem', padding: '1rem', background: '#e8f5e9', color: '#2e7d32', borderRadius: 8, fontSize: '0.85rem', border: '1px solid #a5d6a7' }}>
              {successMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
              <label className="lbl">Nombre completo</label>
              <input className="finput" placeholder="Juan García" value={form.name} onChange={e => update('name', e.target.value)} required />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
              <label className="lbl">Correo corporativo</label>
              <input className="finput" type="email" placeholder="usuario@indusecc.com" value={form.email} onChange={e => update('email', e.target.value)} required />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
              <label className="lbl">Área / Departamento</label>
              <select className="fselect" value={form.department} onChange={e => update('department', e.target.value)}>
                <option value="">Selecciona un área</option>
                <option>Calidad</option>
                <option>Producción</option>
                <option>Compras</option>
                <option>Recursos Humanos</option>
                <option>Dirección</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
              <label className="lbl">Contraseña</label>
              <input className="finput" type="password" placeholder="Mínimo 8 caracteres" value={form.password} onChange={e => update('password', e.target.value)} required minLength={8} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
              <label className="lbl">Confirmar contraseña</label>
              <input className="finput" type="password" placeholder="Repite tu contraseña" value={form.confirmPassword} onChange={e => update('confirmPassword', e.target.value)} required minLength={8} />
            </div>

            <button type="submit" disabled={loading} className="btn btn-red" style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: '.9rem', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Enviando solicitud...' : 'Solicitar Acceso'}
              {!loading && (
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              )}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
            <p style={{ fontSize: '.82rem', color: 'var(--ash)' }}>¿Ya tienes cuenta? <span onClick={() => navigate('/login')} style={{ color: 'var(--red)', fontWeight: 600, cursor: 'pointer' }}>Iniciar sesión</span></p>
          </div>
        </div>
      </div>
    </div>
  )
}
