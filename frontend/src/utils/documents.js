import { createUploadUrl, registerDocument, getDocumentUrl } from '../api/api'

export const MAX_FILE_SIZE = 25 * 1024 * 1024
export const ACCEPTED_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv']
export const ACCEPT_ATTR = ACCEPTED_EXTENSIONS.map(e => `.${e}`).join(',')

export const DOC_TYPES = ['Procedimiento', 'Manual', 'Formato', 'Instructivo', 'Política', 'Registro', 'Acta', 'Otro']

export const STATUS_META = {
  vigente: { label: 'Vigente', cls: 'b-ok' },
  en_revision: { label: 'En revisión', cls: 'b-warn' },
  vencido: { label: 'Vencido', cls: 'b-err' },
  archivado: { label: 'Archivado', cls: 'b-gray' },
}

export const CLAUSE_STATUS_META = {
  completo: { label: 'Completo', cls: 'b-ok', color: '#16A34A' },
  en_progreso: { label: 'En progreso', cls: 'b-warn', color: '#F59E0B' },
  pendiente: { label: 'Pendiente', cls: 'b-gray', color: '#9CA3AF' },
}

export const fmtSize = (bytes) => {
  if (!bytes && bytes !== 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export const fmtDate = (value) => {
  if (!value) return '—'
  const iso = String(value).slice(0, 10)
  const [y, m, d] = iso.split('-').map(Number)
  if (!y) return '—'
  return new Date(y, m - 1, d).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })
}

export const fmtDateTime = (value) => {
  if (!value) return '—'
  return new Date(value).toLocaleString('es-MX', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export const timeAgo = (value) => {
  if (!value) return ''
  const seconds = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 1000))
  if (seconds < 60) return 'hace un momento'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.round(hours / 24)
  if (days < 7) return `hace ${days} d`
  return fmtDate(value)
}

export const fileExtension = (name = '') => (name.split('.').pop() || '').toLowerCase()

export const validateFile = (file) => {
  if (!file) return 'Selecciona un archivo'
  if (!ACCEPTED_EXTENSIONS.includes(fileExtension(file.name))) {
    return `Formato no permitido. Usa: ${ACCEPTED_EXTENSIONS.join(', ')}`
  }
  if (file.size > MAX_FILE_SIZE) return `El archivo pesa ${fmtSize(file.size)} y el máximo es 25 MB`
  if (file.size === 0) return 'El archivo está vacío'
  return null
}

// 'pdf' | 'image' | 'text' | null (null = sin vista previa, solo descarga)
export const previewKind = (mimetype = '') => {
  if (mimetype === 'application/pdf') return 'pdf'
  if (mimetype.startsWith('image/')) return 'image'
  if (mimetype === 'text/plain' || mimetype === 'text/csv') return 'text'
  return null
}

export const errorMessage = (error, fallback = 'Ocurrió un error inesperado') =>
  error?.response?.data?.message || error?.message || fallback

// El navegador envía el archivo directo a Supabase Storage (Vercel limita el cuerpo de una
// función a 4.5 MB); con XMLHttpRequest se puede mostrar el progreso real de la subida.
const putToStorage = (signedUrl, blob, onProgress) =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', signedUrl)
    xhr.setRequestHeader('x-upsert', 'false')
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve()
      let detail = ''
      try { detail = JSON.parse(xhr.responseText)?.message || '' } catch { /* respuesta sin JSON */ }
      reject(new Error(detail || `El almacenamiento rechazó el archivo (${xhr.status})`))
    }
    xhr.onerror = () => reject(new Error('No se pudo conectar con el almacenamiento. Revisa tu conexión.'))
    const form = new FormData()
    form.append('cacheControl', '3600')
    form.append('', blob)
    xhr.send(form)
  })

export async function uploadDocumentFile(file, metadata, onProgress) {
  const invalid = validateFile(file)
  if (invalid) throw new Error(invalid)

  const { data } = await createUploadUrl({ filename: file.name, size: file.size })
  const info = data.data
  await putToStorage(info.signedUrl, new Blob([file], { type: info.contentType }), onProgress)
  const res = await registerDocument({ ...metadata, storagePath: info.storagePath, originalName: file.name })
  return res.data.data.document
}

// Baja el archivo como Blob (para la vista previa: un iframe con la URL de Storage queda bloqueado por su CSP).
export async function fetchDocumentBlob(id) {
  const { data } = await getDocumentUrl(id)
  const { url, mimetype, filename } = data.data
  const response = await fetch(url)
  if (!response.ok) throw new Error('No se pudo descargar el archivo')
  const blob = await response.blob()
  return { blob: new Blob([blob], { type: mimetype || blob.type }), filename, mimetype }
}

export async function downloadDocumentFile(id) {
  const { data } = await getDocumentUrl(id, true)
  const link = document.createElement('a')
  link.href = data.data.url
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// Aplana el árbol ISO: [{ code, title, level, mainCode, mainTitle }] solo de subcláusulas (nivel >= 2).
export const flattenSelectableClauses = (tree = []) => {
  const out = []
  const walk = (node, main) => {
    if (node.level >= 2) out.push({ code: node.code, title: node.title, level: node.level, mainCode: main.code, mainTitle: main.title })
    node.children.forEach(child => walk(child, main))
  }
  tree.forEach(main => main.children.forEach(child => walk(child, main)))
  return out
}
