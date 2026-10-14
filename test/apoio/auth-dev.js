const cds = require('@sap/cds');

const PADRAO = 'superusuario';

const PERSONAS = {
  // Persona padrão do desenvolvimento local (demonstração): todos os papéis de usuário humano.
  superusuario: ['GestorTratativa', 'Administrador', 'ValidadorTecnico', 'LeitorAnalitico'],
  'app-origem-a': ['AplicativoOrigem'],
  'app-origem-b': ['AplicativoOrigem'],
  'app-revogado': ['AplicativoOrigem'],
  admin: ['Administrador'],
  usuario: [],
  gestor: ['GestorTratativa'],
  'leitor-analitico': ['LeitorAnalitico'],
  validador: ['ValidadorTecnico'],
  'validador-b': ['ValidadorTecnico'],
  'M1001': [],
  'M2002': [],
};

module.exports = function authDev(req, _res, next) {
  const escolhido = process.env.DEV_USER || process.env.CDS_DEV_USER || PADRAO;
  const id = Object.hasOwn(PERSONAS, escolhido) ? escolhido : PADRAO;
  const user = new cds.User({ id, roles: PERSONAS[id] });

  req.user = user;
  if (cds.context) cds.context.user = user;
  next();
};
