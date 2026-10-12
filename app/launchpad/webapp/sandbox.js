/* global window */
window["sap-ushell-config"] = {
  defaultRenderer: "fiori2",
  applications: {
    "Tratativa-manage": {
      title: "Gestão de Tratativas",
      description: "Plataforma de Ação",
      additionalInformation: "SAPUI5.Component=br.com.calazanstec.actionplan.tratativas",
      applicationType: "URL",
      url: "/br.com.calazanstec.actionplan.tratativas",
    },
    "MinhasPendencias-display": {
      title: "Minhas Pendências",
      description: "Ações sob minha responsabilidade",
      additionalInformation: "SAPUI5.Component=br.com.calazanstec.actionplan.minhaspendencias",
      applicationType: "URL",
      url: "/br.com.calazanstec.actionplan.minhaspendencias",
    },
    "AdministracaoPlataforma-manage": {
      title: "Administração da Plataforma",
      description: "Parâmetros e templates",
      additionalInformation: "SAPUI5.Component=br.com.calazanstec.actionplan.administracao",
      applicationType: "URL",
      url: "/br.com.calazanstec.actionplan.administracao",
    },
  },
};
