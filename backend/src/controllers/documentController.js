const { randomUUID } = require('crypto');
const { supabaseAdmin } = require('../config/supabaseClient');
const logger = require('../utils/logger');

const BUCKET = 'documents';

const toApiDocument = (doc) => ({
  id: doc.id,
  _id: doc.id, // alias de compatibilidad: el frontend aun referencia _id (estilo Mongo) en varias vistas
  code: doc.code,
  title: doc.title,
  filename: doc.storage_path,
  originalName: doc.original_name,
  mimetype: doc.mimetype,
  size: doc.size_bytes,
  type: doc.type,
  category: doc.category,
  clause: doc.clause,
  responsible: doc.responsible,
  description: doc.description,
  status: doc.status,
  uploadedBy: doc.uploaded_by,
  expiryDate: doc.expiry_date,
  createdAt: doc.created_at,
  updatedAt: doc.updated_at,
});

const resolveDocumentFields = (req) => {
  const uploadedFile = req.file;
  const body = req.body || {};

  const originalName = uploadedFile?.originalname || body.originalName || body.title || 'documento';
  const title = body.title || body.name || originalName;
  const type = body.type || body.category || 'Documento';
  const clause = body.clause || body.clausula || '';
  const responsible = body.responsible || body.resp || '';
  const expiryDate = body.expiryDate || body.vigencia || null;

  return {
    code: body.code || '',
    title,
    originalName,
    mimetype: uploadedFile?.mimetype || 'application/octet-stream',
    size: uploadedFile?.size || 0,
    type,
    category: body.category || type,
    clause,
    responsible,
    description: body.description || '',
    expiryDate,
  };
};

const createDocument = async (req, res) => {
  try {
    const uploadedBy = req.user.id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Archivo requerido',
        code: 'MISSING_FILENAME'
      });
    }

    const payload = resolveDocumentFields(req);
    const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${uploadedBy}/${randomUUID()}-${safeName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storagePath, req.file.buffer, { contentType: payload.mimetype, upsert: false });

    if (uploadError) throw uploadError;

    const { data: document, error: insertError } = await supabaseAdmin
      .from('documents')
      .insert({
        code: payload.code,
        title: payload.title,
        original_name: payload.originalName,
        storage_path: storagePath,
        mimetype: payload.mimetype,
        size_bytes: payload.size,
        type: payload.type,
        category: payload.category,
        clause: payload.clause,
        responsible: payload.responsible,
        description: payload.description,
        uploaded_by: uploadedBy,
        expiry_date: payload.expiryDate,
        status: 'vigente'
      })
      .select('*')
      .single();

    if (insertError) {
      await supabaseAdmin.storage.from(BUCKET).remove([storagePath]);
      throw insertError;
    }

    logger.info(`Documento creado: ${document.storage_path} por usuario ${uploadedBy}`);

    res.status(201).json({
      success: true,
      message: 'Documento cargado exitosamente',
      data: { document: toApiDocument(document) }
    });
  } catch (error) {
    logger.error('Error al crear documento:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cargar documento',
      code: 'CREATE_DOCUMENT_ERROR'
    });
  }
};

const getDocuments = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 100);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabaseAdmin
      .from('documents')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (req.query.status) query = query.eq('status', req.query.status);
    if (req.query.category) query = query.eq('category', req.query.category);
    if (req.query.search) {
      query = query.or(`code.ilike.%${req.query.search}%,title.ilike.%${req.query.search}%,original_name.ilike.%${req.query.search}%`);
    }

    const { data: documents, count, error } = await query;
    if (error) throw error;

    res.json({
      success: true,
      message: 'Documentos obtenidos exitosamente',
      data: {
        documents: documents.map(toApiDocument),
        pagination: {
          page,
          limit,
          total: count || 0,
          pages: Math.ceil((count || 0) / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Error al obtener documentos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener documentos',
      code: 'GET_DOCUMENTS_ERROR'
    });
  }
};

const getDocumentById = async (req, res) => {
  try {
    const { data: document, error } = await supabaseAdmin
      .from('documents')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();

    if (error) throw error;
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Documento no encontrado',
        code: 'DOCUMENT_NOT_FOUND'
      });
    }

    res.json({ success: true, data: { document: toApiDocument(document) } });
  } catch (error) {
    logger.error('Error al obtener documento:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener documento',
      code: 'GET_DOCUMENT_ERROR'
    });
  }
};

const updateDocument = async (req, res) => {
  try {
    const { code, title, type, category, clause, responsible, description, expiryDate, vigencia, status } = req.body;

    const updateData = {};
    if (code !== undefined) updateData.code = code;
    if (title !== undefined) updateData.title = title;
    if (type !== undefined) updateData.type = type;
    if (category !== undefined) updateData.category = category;
    if (clause !== undefined) updateData.clause = clause;
    if (responsible !== undefined) updateData.responsible = responsible;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status;
    if (expiryDate || vigencia) updateData.expiry_date = expiryDate || vigencia;

    const { data: document, error } = await supabaseAdmin
      .from('documents')
      .update(updateData)
      .eq('id', req.params.id)
      .select('*')
      .maybeSingle();

    if (error) throw error;
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Documento no encontrado',
        code: 'DOCUMENT_NOT_FOUND'
      });
    }

    logger.info(`Documento actualizado: ${document.storage_path}`);

    res.json({
      success: true,
      message: 'Documento actualizado exitosamente',
      data: { document: toApiDocument(document) }
    });
  } catch (error) {
    logger.error('Error al actualizar documento:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar documento',
      code: 'UPDATE_DOCUMENT_ERROR'
    });
  }
};

const deleteDocument = async (req, res) => {
  try {
    const { data: document, error } = await supabaseAdmin
      .from('documents')
      .delete()
      .eq('id', req.params.id)
      .select('*')
      .maybeSingle();

    if (error) throw error;
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Documento no encontrado',
        code: 'DOCUMENT_NOT_FOUND'
      });
    }

    await supabaseAdmin.storage.from(BUCKET).remove([document.storage_path]);

    logger.info(`Documento eliminado: ${document.storage_path}`);

    res.json({ success: true, message: 'Documento eliminado exitosamente' });
  } catch (error) {
    logger.error('Error al eliminar documento:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar documento',
      code: 'DELETE_DOCUMENT_ERROR'
    });
  }
};

const streamDocument = async (req, res, disposition) => {
  const { data: document, error } = await supabaseAdmin
    .from('documents')
    .select('*')
    .eq('id', req.params.id)
    .maybeSingle();

  if (error) throw error;
  if (!document) {
    return res.status(404).json({
      success: false,
      message: 'Documento no encontrado',
      code: 'DOCUMENT_NOT_FOUND'
    });
  }

  const { data: fileBlob, error: downloadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .download(document.storage_path);

  if (downloadError || !fileBlob) {
    return res.status(404).json({
      success: false,
      message: 'Archivo no encontrado en el almacenamiento',
      code: 'FILE_NOT_FOUND'
    });
  }

  const buffer = Buffer.from(await fileBlob.arrayBuffer());
  res.setHeader('Content-Disposition', `${disposition}; filename="${document.original_name}"`);
  res.setHeader('Content-Type', document.mimetype || 'application/octet-stream');
  res.send(buffer);
};

const downloadDocument = async (req, res) => {
  try {
    await streamDocument(req, res, 'attachment');
    logger.info(`Documento descargado: ${req.params.id}`);
  } catch (error) {
    logger.error('Error al descargar documento:', error);
    res.status(500).json({
      success: false,
      message: 'Error al descargar documento',
      code: 'DOWNLOAD_DOCUMENT_ERROR'
    });
  }
};

const viewDocument = async (req, res) => {
  try {
    await streamDocument(req, res, 'inline');
    logger.info(`Documento visualizado: ${req.params.id}`);
  } catch (error) {
    logger.error('Error al visualizar documento:', error);
    res.status(500).json({
      success: false,
      message: 'Error al visualizar documento',
      code: 'VIEW_DOCUMENT_ERROR'
    });
  }
};

module.exports = {
  createDocument,
  getDocuments,
  getDocumentById,
  updateDocument,
  deleteDocument,
  downloadDocument,
  viewDocument
};
