sap.ui.define([ // eslint-disable-line no-undef
  "sap/ui/core/mvc/ControllerExtension",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageBox",
  "sap/m/MessageToast"
], function (ControllerExtension, JSONModel, MessageBox, MessageToast) {
  "use strict";

  var ACAO_DEFINIR = "TratativaAppService.definirMetodologia";
  var ACAO_DERIVAR = "TratativaAppService.derivarAcaoDaMetodologia";
  var PROPRIEDADES = [
    "metodologia", "categoriaCausaRaiz", "metodologiaData", "podeDefinirMetodologia", "podeDerivarAcao"
  ];
  // Chaves deriváveis, uma por botão `metodologiaDerivar-<chave>` do fragmento (decisão 1 do design).
  var CHAVES_DERIVAVEIS = [
    "oQue", "porque1", "porque2", "porque3", "porque4", "porque5", "conclusao",
    "porQue", "como", "planejar", "executar", "checar", "agir"
  ];

  // ID real das subseções customizadas no Fiori elements (medido no navegador): fe::CustomSubSection::<seção>--<id>.
  var PREFIXO_ID = "fe::CustomSubSection::MetodologiaSection--";

  function modeloVazio() {
    return {
      visivel: false,
      podeVer: false,
      editavel: false,
      podeRemover: false,
      podeDerivar: false,
      ferramenta: "",
      ferramentaGravada: "",
      dadosGravados: {},
      categoria: "",
      dados: {}
    };
  }

  function lerDados(texto) {
    if (!texto) {
      return {};
    }
    try {
      return JSON.parse(texto);
    } catch {
      return {};
    }
  }

  return ControllerExtension.extend("br.com.calazanstec.actionplan.tratativas.ext.controller.MetodologiaExtension", {
    override: {
      routing: {
        // A seção é instanciada pelo Fiori elements; os handlers são ligados por ID estável (DC-13), uma vez por instância.
        onAfterBinding: function (contexto) {
          var visao = this.base.getView();
          if (!this._modelo) {
            this._modelo = new JSONModel(modeloVazio());
            visao.setModel(this._modelo, "metodologia");
          }
          this._ligar();
          this._carregar(contexto);
        }
      }
    },

    _ligar: function () {
      if (this._ligado) {
        return;
      }
      var api = this.base.getExtensionAPI();
      var salvar = api.byId(PREFIXO_ID + "metodologiaSalvar");
      var remover = api.byId(PREFIXO_ID + "metodologiaRemover");
      if (!salvar || !remover) {
        // Seção ainda não instanciada: a ligação é refeita no próximo onAfterBinding.
        return;
      }
      var ferramenta = api.byId(PREFIXO_ID + "metodologiaFerramenta");
      if (ferramenta) {
        ferramenta.attachChange(this.onTrocarFerramenta, this);
      }
      salvar.attachPress(this.onSalvar, this);
      remover.attachPress(this.onRemover, this);
      CHAVES_DERIVAVEIS.forEach(function (chave) {
        var botao = api.byId(PREFIXO_ID + "metodologiaDerivar-" + chave);
        if (botao) {
          botao.attachPress(function () {
            this.onDerivar(chave);
          }, this);
        }
      }, this);
      this._ligado = true;
    },

    _carregar: function (contexto) {
      var modelo = this._modelo;
      if (!contexto || !modelo) {
        return Promise.resolve();
      }
      return contexto.requestProperty(PROPRIEDADES).then(function (valores) {
        var ferramenta = valores[0] || "";
        var texto = valores[2];
        modelo.setData({
          visivel: true,
          podeVer: !ferramenta || texto !== null,
          editavel: !!valores[3],
          podeRemover: !!valores[3] && !!ferramenta,
          podeDerivar: !!valores[4] && !!ferramenta,
          ferramenta: ferramenta,
          ferramentaGravada: ferramenta,
          categoria: valores[1] || "",
          dados: lerDados(texto),
          dadosGravados: lerDados(texto)
        });
      }).catch(function () {
        modelo.setData(modeloVazio());
      });
    },

    // Trocar a ferramenta descarta os campos da anterior (chaves de outra ferramenta seriam recusadas, R3).
    onTrocarFerramenta: function () {
      var modelo = this._modelo;
      var igualGravada = modelo.getProperty("/ferramenta") === modelo.getProperty("/ferramentaGravada");
      modelo.setProperty("/dados", igualGravada ? Object.assign({}, modelo.getProperty("/dadosGravados")) : {});
    },

    _falhou: function (erro) {
      // Mensagens do servidor já são exibidas pelo Fiori elements; aqui só o aviso geral (cancelar o diálogo não é erro).
      if (erro && erro.message !== "Dialog cancelled") {
        MessageToast.show(this._texto("errorTitle"));
      }
    },

    _texto: function (chave) {
      return this.base.getView().getModel("i18n").getResourceBundle().getText(chave);
    },

    _contexto: function () {
      return this.base.getView().getBindingContext();
    },

    _invocar: function (acao, opcoes) {
      var edicao = this.base.getExtensionAPI().getEditFlow();
      return edicao.invokeAction(acao, Object.assign({ contexts: [this._contexto()] }, opcoes));
    },

    _depoisDeGravar: function (mensagem) {
      MessageToast.show(this._texto(mensagem));
      this.base.getExtensionAPI().refresh();
      return this._carregar(this._contexto());
    },

    _gravar: function (ferramenta, confirmarSubstituicao, mensagem) {
      var dados = this._modelo.getProperty("/dados") || {};
      return this._invocar(ACAO_DEFINIR, {
        parameterValues: [
          { name: "ferramenta", value: ferramenta },
          { name: "categoriaCausaRaiz", value: this._modelo.getProperty("/categoria") || "" },
          { name: "dados", value: JSON.stringify(dados) },
          { name: "confirmarSubstituicao", value: confirmarSubstituicao }
        ],
        skipParameterDialog: true,
        label: this._texto("metodologiaSalvar")
      }).then(function () {
        return this._depoisDeGravar(mensagem);
      }.bind(this)).catch(this._falhou.bind(this));
    },

    onSalvar: function () {
      var ferramenta = this._modelo.getProperty("/ferramenta");
      var gravada = this._modelo.getProperty("/ferramentaGravada");
      if (gravada && ferramenta !== gravada) {
        // R3: ferramenta diferente da gravada exige confirmação da substituição.
        MessageBox.confirm(this._texto("metodologiaConfirmarTroca"), {
          title: this._texto("metodologiaConfirmarTitulo"),
          onClose: function (resposta) {
            if (resposta === MessageBox.Action.OK) {
              this._gravar(ferramenta, true, "metodologiaSalva");
            }
          }.bind(this)
        });
        return;
      }
      this._gravar(ferramenta, false, "metodologiaSalva");
    },

    onRemover: function () {
      MessageBox.confirm(this._texto("metodologiaConfirmarRemocao"), {
        title: this._texto("metodologiaRemover"),
        onClose: function (resposta) {
          if (resposta === MessageBox.Action.OK) {
            this._gravar("", true, "metodologiaRemovida");
          }
        }.bind(this)
      });
    },

    // Derivação com revisão (CA14): sem skipParameterDialog, o Gestor revisa Descrição e preenche os demais campos.
    onDerivar: function (chave) {
      var sugestao = this._modelo.getProperty("/dados/" + chave) || "";
      this._invocar(ACAO_DERIVAR, {
        parameterValues: [
          { name: "causaIdentificador", value: chave },
          { name: "descricao", value: String(sugestao).slice(0, 500) }
        ],
        label: this._texto("metodologiaDerivarTitulo")
      }).then(function () {
        this.base.getExtensionAPI().refresh();
      }.bind(this)).catch(this._falhou.bind(this));
    }
  });
});
