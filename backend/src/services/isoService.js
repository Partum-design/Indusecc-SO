const { supabaseAdmin } = require('../config/supabaseClient');
const { buildIsoCompliance } = require('../utils/isoStats');

const PAGE = 1000;

// PostgREST limita las respuestas (1000 filas por defecto): se pagina para no truncar en silencio.
const fetchAll = async (table, columns) => {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabaseAdmin.from(table).select(columns).range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
};

const loadIsoInputs = async () => {
  const [clauses, documents, signatures] = await Promise.all([
    fetchAll('iso_clauses', 'code, parent_code, level, title, description, sort_order'),
    fetchAll('documents', 'id, code, title, clause, status, expiry_date, uploaded_by'),
    fetchAll('document_signatures', 'document_id, signer_id, status'),
  ]);
  return { clauses, documents, signatures };
};

const getIsoCompliance = async () => {
  const { clauses, documents, signatures } = await loadIsoInputs();
  return { ...buildIsoCompliance(clauses, documents, signatures), clauses, documents, signatures };
};

// Busca un nodo (por código) dentro del árbol calculado.
const findNode = (tree, code) => {
  for (const node of tree) {
    if (node.code === code) return node;
    const inChild = findNode(node.children, code);
    if (inChild) return inChild;
  }
  return null;
};

module.exports = { fetchAll, loadIsoInputs, getIsoCompliance, findNode };
