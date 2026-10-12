const cds = require('@sap/cds');

const PERSONAS = {
  'app-origem-a': ['AplicativoOrigem'],
  'app-origem-b': ['AplicativoOrigem'],
  'app-revogado': ['AplicativoOrigem'],
  admin: ['Administrador'],
  usuario: [],
  gestor: ['GestorTratativa'],
  'leitor-analitico': ['LeitorAnalitico'],
};

module.exports = function authDev(req, _res, next) {
  const escolhido = process.env.DEV_USER || process.env.CDS_DEV_USER || 'gestor';
  const id = Object.hasOwn(PERSONAS, escolhido) ? escolhido : 'gestor';
  const user = new cds.User({ id, roles: PERSONAS[id] });

  req.user = user;
  if (cds.context) cds.context.user = user;
  next();
};
