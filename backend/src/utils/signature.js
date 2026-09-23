const crypto = require('crypto');

const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

// Huella de una firma: liga documento + contenido exacto del archivo + firmante + instante.
// Si cambia cualquiera de esos datos, la huella deja de coincidir (ver verifyDocument).
const computeSignatureHash = ({ documentId, documentSha256, signerId, signedAt, signerName }) =>
  crypto
    .createHash('sha256')
    .update([documentId, documentSha256, signerId, new Date(signedAt).toISOString(), signerName].join('|'))
    .digest('hex');

module.exports = { sha256, computeSignatureHash };
