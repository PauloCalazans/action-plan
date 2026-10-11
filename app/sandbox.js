globalThis["sap-ushell-config"] = {
  defaultRenderer: "fiori2",
  renderers: {
    fiori2: {
      applications: {
        "Tratativa-manage": {
          title: "Gestão de Tratativas",
          subtitle: "Plataforma de Ação",
          icon: "sap-icon://task",
          additionalInformation: "SAPUI5.Component=br.com.calazanstec.actionplan.tratativas",
          applicationType: "URL",
          url: "./tratativas/webapp"
        },
        "MinhasPendencias-display": {
          title: "Minhas Pendências",
          subtitle: "Ações e Ocorrências",
          icon: "sap-icon://user-edit",
          additionalInformation: "SAPUI5.Component=br.com.calazanstec.actionplan.minhaspendencias",
          applicationType: "URL",
          url: "./minhas-pendencias/webapp"
        },
        "AdministracaoPlataforma-manage": {
          title: "Administração da Plataforma",
          subtitle: "Parâmetros e Alertas",
          icon: "sap-icon://settings",
          additionalInformation: "SAPUI5.Component=br.com.calazanstec.actionplan.administracao",
          applicationType: "URL",
          url: "./administracao/webapp"
        }
      }
    }
  },
  services: {
    NavTargetResolution: {
      config: {
        enableClientSideTargetResolution: true
      }
    }
  }
};
