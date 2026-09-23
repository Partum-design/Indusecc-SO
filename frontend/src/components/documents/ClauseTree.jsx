import { useState } from 'react'
import { CLAUSE_STATUS_META, STATUS_META } from '../../utils/documents'

const Chevron = ({ open }) => (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" width="14" height="14" style={{ transition: 'transform .2s', transform: open ? 'rotate(90deg)' : 'none', flexShrink: 0 }}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
)

function DocLine({ doc, inherited, onOpenDoc }) {
  const meta = STATUS_META[doc.status] || STATUS_META.vigente
  return (
    <button type="button" className="dm-docline" onClick={() => onOpenDoc(doc)} title="Abrir documento">
      <span className="dm-docline-code">{doc.code}</span>
      <span className="dm-docline-title">{doc.title}</span>
      {inherited && <span className="dm-chip">de {doc.clause}</span>}
      <span className={`badge ${meta.cls}`}>{meta.label}</span>
      <span className="dm-chip" title="Firmas emitidas">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" width="11" height="11"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a4 4 0 01-1.414.94L6 18l1.232-4.414A4 4 0 018.172 12.172z" /></svg>
        {doc.signatures.signed}
      </span>
    </button>
  )
}

function ClauseNode({ node, depth, docsByClause, inheritedDocs, expanded, toggle, onUpload, onOpenDoc, readOnly }) {
  const meta = CLAUSE_STATUS_META[node.status]
  const isOpen = Boolean(expanded[node.code])
  const ownDocs = docsByClause.get(node.code) || []
  const hasChildren = node.children.length > 0
  const passDown = [...inheritedDocs, ...ownDocs]
  const canExpand = hasChildren || ownDocs.length > 0 || inheritedDocs.length > 0

  return (
    <div className={`dm-node dm-depth-${Math.min(depth, 3)}`}>
      <div className="dm-row" onClick={() => canExpand && toggle(node.code)}>
        {canExpand ? (
          <button type="button" className="dm-row-chev" aria-expanded={isOpen} aria-label={`${isOpen ? 'Contraer' : 'Expandir'} ${node.code}`}
            onClick={e => { e.stopPropagation(); toggle(node.code) }}>
            <Chevron open={isOpen} />
          </button>
        ) : <span className="dm-row-chev" aria-hidden="true" />}
        <span className="dm-row-code">{node.code}</span>
        <span className="dm-row-title">
          {node.title}
          {node.description && depth >= 1 && <span className="dm-row-desc">{node.description}</span>}
        </span>
        <span className="dm-row-meta">
          {hasChildren && <span className="dm-chip" title="Requisitos completos / total">{node.leafCompleted}/{node.leafCount} req.</span>}
          {node.docCount > 0 && <span className="dm-chip" title="Documentos relacionados">{node.docCount} doc.</span>}
        </span>
        <span className="dm-row-prog" title={`${node.completion}% de cumplimiento`}>
          <span className="dm-prog"><span className="dm-prog-fill" style={{ width: `${node.completion}%`, background: meta.color }} /></span>
          <span className="dm-prog-num">{node.completion}%</span>
        </span>
        <span className={`badge ${meta.cls} dm-row-status`}>{meta.label}</span>
        {!readOnly && depth >= 1 && (
          <button type="button" className="btn btn-out btn-sm dm-row-upload" onClick={e => { e.stopPropagation(); onUpload(node.code) }} title={`Subir documento para ${node.code}`}>
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Subir
          </button>
        )}
      </div>

      {isOpen && (canExpand) && (
        <div className="dm-children">
          {(ownDocs.length > 0 || (!hasChildren && inheritedDocs.length > 0)) && (
            <div className="dm-docs">
              {ownDocs.map(doc => <DocLine key={doc.id} doc={doc} onOpenDoc={onOpenDoc} />)}
              {!hasChildren && inheritedDocs.map(doc => <DocLine key={`i-${doc.id}`} doc={doc} inherited onOpenDoc={onOpenDoc} />)}
            </div>
          )}
          {node.children.map(child => (
            <ClauseNode key={child.code} node={child} depth={depth + 1} docsByClause={docsByClause} inheritedDocs={passDown}
              expanded={expanded} toggle={toggle} onUpload={onUpload} onOpenDoc={onOpenDoc} readOnly={readOnly} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function ClauseTree({ tree, docsByClause, onUpload, onOpenDoc, readOnly = false }) {
  const [expanded, setExpanded] = useState({})
  const toggle = (code) => setExpanded(prev => ({ ...prev, [code]: !prev[code] }))
  const setAll = (value) => {
    const next = {}
    const walk = (node) => { next[node.code] = value; node.children.forEach(walk) }
    tree.forEach(walk)
    setExpanded(next)
  }

  return (
    <div>
      <div className="dm-tree-tools">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAll(true)}>Expandir todo</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAll(false)}>Contraer todo</button>
      </div>
      <div className="dm-tree">
        {tree.map(main => (
          <div key={main.code} className="card dm-main">
            <ClauseNode node={main} depth={0} docsByClause={docsByClause} inheritedDocs={[]} expanded={expanded} toggle={toggle}
              onUpload={onUpload} onOpenDoc={onOpenDoc} readOnly={readOnly} />
          </div>
        ))}
      </div>
    </div>
  )
}
