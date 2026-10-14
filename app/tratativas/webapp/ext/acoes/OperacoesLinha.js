sap.ui.define([ // eslint-disable-line no-undef
  "sap/m/MessageBox",
  "sap/m/MessageToast",
  "sap/ui/core/Fragment",
  "sap/ui/model/json/JSONModel",
  "br/com/calazanstec/actionplan/tratativas/ext/acoes/pedidoAnexo"
], function (MessageBox, MessageToast, Fragment, JSONModel, pedidoAnexo) {
  "use strict";

  // Métodos referenciados pelo manifest (press, visible, enabled) das ações das tabelas da Object Page.
  // Chamados com this = ExtensionAPI e argumentos (contexto da página, contextos selecionados).
  // As indicações pode*/oculta* vêm do servidor e são lidas por Context#requestProperty; sem matrícula.

  var SERVICO = "TratativaAppService.";
  var ID_DO_FRAGMENTO = "anexarEvidencia";
  var NOME_DO_FRAGMENTO = "br.com.calazanstec.actionplan.tratativas.ext.fragment.AnexarEvidencia";

  var regrasEmCache;
  var dialogo;
  var pedido = {};

  function texto(api, chave, argumentos) {
    return api.getModel("i18n").getResourceBundle().getText(chave, argumentos);
  }

  function propriedade(contexto, nome) {
    if (!contexto) {
      return Promise.resolve(undefined);
    }
    return contexto.requestProperty(nome).catch(function () {
      return undefined;
    });
  }

  // Fail-closed: sem resposta do servidor, o botão fica oculto.
  // O visible do manifest não é reavaliado na troca de seleção (R-06): depende só da página; o enabled é por linha.
  function visivelSeNao(nomeDaPagina) {
    return function (pagina) {
      return propriedade(pagina, nomeDaPagina).then(function (oculta) {
        return oculta === false;
      });
    };
  }

  function habilitadoSe(nome) {
    return function (pagina, selecionados) {
      if (!selecionados || selecionados.length !== 1) {
        return Promise.resolve(false);
      }
      return propriedade(selecionados[0], nome).then(function (pode) {
        return pode === true;
      });
    };
  }

  function invocar(api, acao, contexto, opcoes) {
    return api.getEditFlow().invokeAction(SERVICO + acao, Object.assign({ contexts: [contexto] }, opcoes));
  }

  // Cancelar o diálogo de parâmetros rejeita com Error("Dialog cancelled"); isso não é erro.
  // As demais recusas já são exibidas pelo Fiori elements, e a tela não muda.
  function executar(api, acao, contexto, caminhos, opcoes) {
    return invocar(api, acao, contexto, opcoes).then(function () {
      api.refresh(caminhos);
      return true;
    }).catch(function () {
      return false;
    });
  }

  // Entrega a ExtensionAPI (this do press) como primeiro argumento.
  function comApi(funcao) {
    return function (pagina, selecionados) {
      return funcao(this, pagina, selecionados);
    };
  }

  function operacao(acao, rotulo, caminhos, daPagina) {
    return function (pagina, selecionados) {
      var contexto = daPagina ? pagina : selecionados[0];
      return executar(this, acao, contexto, caminhos, { label: texto(this, rotulo) });
    };
  }

  function obterRegras(api) {
    if (regrasEmCache) {
      return Promise.resolve(regrasEmCache);
    }
    var vinculo = api.getModel().bindContext("/regrasAnexoEvidencia(...)");
    return vinculo.execute().then(function () {
      regrasEmCache = vinculo.getBoundContext().getObject();
      return regrasEmCache;
    });
  }

  function controle(id) {
    return Fragment.byId(ID_DO_FRAGMENTO, id);
  }

  function dadosIniciais(regras) {
    return {
      extensoes: regras.formatos.map(function (formato) {
        return formato.extensao.slice(1);
      }),
      tamanhoMaximoMb: regras.tamanhoMaximo / (1024 * 1024),
      descricao: "",
      avisoTexto: "",
      podeAnexar: false
    };
  }

  function mostrarAviso(motivo) {
    var modelo = dialogo.getModel("anexo");
    var api = pedido.api;
    var regras = pedido.regras;
    var aviso = "";
    if (motivo === "formato") {
      aviso = texto(api, "anexarAvisoFormato", [regras.formatos.map(function (formato) {
        return formato.extensao.slice(1).toUpperCase();
      }).join(", ")]);
    } else if (motivo === "tamanho") {
      aviso = texto(api, "anexarAvisoTamanho", [String(regras.tamanhoMaximo / (1024 * 1024))]);
    } else if (motivo) {
      aviso = texto(api, "anexarAvisoLeitura");
    }
    modelo.setProperty("/avisoTexto", aviso);
    modelo.setProperty("/podeAnexar", !motivo && !!pedido.arquivo);
  }

  // Handlers do fragmento (press, change, typeMissmatch, fileSizeExceed), passados como controller do loadFragment.
  var manipuladores = {
    onEscolherArquivo: function (evento) {
      var arquivos = evento.getParameter("files");
      var arquivo = arquivos && arquivos[0];
      pedido.arquivo = undefined;
      if (!arquivo) {
        mostrarAviso(null);
        return;
      }
      var motivo = pedidoAnexo.avisoDoArquivo({ nome: arquivo.name, tamanho: arquivo.size }, pedido.regras);
      if (motivo) {
        mostrarAviso(motivo);
        return;
      }
      var leitor = new FileReader(); // eslint-disable-line no-undef
      leitor.onload = function () {
        // Arquivo de 0 byte: o navegador pode devolver só "data:", sem vírgula; o servidor recusa com 400.
        pedido.arquivo = { nome: arquivo.name, tipo: arquivo.type, conteudo: String(leitor.result).split(",")[1] };
        mostrarAviso(null);
      };
      leitor.onerror = function () {
        mostrarAviso("leitura");
      };
      leitor.readAsDataURL(arquivo);
    },

    onAviso: function (evento) {
      pedido.arquivo = undefined;
      mostrarAviso(evento.getId() === "fileSizeExceed" ? "tamanho" : "formato");
    },

    onCancelar: function () {
      dialogo.close();
    },

    onConfirmar: function () {
      var api = pedido.api;
      var linha = pedido.linha;
      var parametros = pedidoAnexo.montarPedidoAnexo({
        nome: pedido.arquivo.nome,
        tipo: pedido.arquivo.tipo,
        conteudo: pedido.arquivo.conteudo,
        descricao: dialogo.getModel("anexo").getProperty("/descricao")
      }, pedido.regras);
      dialogo.close();
      executar(api, "anexarEvidencia", linha, ["evidencias"], {
        parameterValues: parametros,
        skipParameterDialog: true,
        label: texto(api, "acaoAnexarEvidencia")
      }).then(function (ok) {
        if (ok) {
          MessageToast.show(texto(api, "anexarConcluido"));
        }
      });
    }
  };

  // A instância só é reutilizada se não foi destruída junto com a view.
  function abrirDialogo(api) {
    var carregado = dialogo && !dialogo.isDestroyed()
      ? Promise.resolve(dialogo)
      : api.loadFragment({ id: ID_DO_FRAGMENTO, name: NOME_DO_FRAGMENTO, controller: manipuladores }).then(function (instancia) {
        dialogo = instancia;
        return dialogo;
      });
    return carregado.then(function (instancia) {
      instancia.setModel(new JSONModel(dadosIniciais(pedido.regras)), "anexo");
      var seletor = controle("arquivo");
      if (seletor) {
        seletor.clear();
      }
      instancia.open();
    });
  }

  return {
    // press
    criarAcao: operacao("criarAcao", "acaoCriarAcao", ["", "acoes"], true),
    criarSubacao: operacao("criarSubacao", "acaoCriarSubacao", ["", "acoes"]),
    delegarAcao: operacao("delegarAcao", "acaoDelegarAcao", ["acoes"]),
    comentarAcao: operacao("comentarAcao", "acaoComentarAcao", ["comentarios"]),
    iniciarAcao: operacao("iniciar", "acaoIniciarAcao", ["", "acoes"]),
    concluirAcao: operacao("concluir", "acaoConcluirAcao", ["", "acoes"]),
    comentarTratativa: operacao("comentarTratativa", "acaoComentarTratativa", ["comentarios"], true),

    anexarEvidencia: comApi(function (api, pagina, selecionados) {
      pedido = { api: api, linha: selecionados[0] };
      return obterRegras(api).then(function (regras) {
        pedido.regras = regras;
        return abrirDialogo(api);
      }).catch(function () {
        MessageToast.show(texto(api, "errorTitle"));
      });
    }),

    removerEvidencia: comApi(function (api, pagina, selecionados) {
      var linha = selecionados[0];
      return propriedade(linha, "nomeArquivo").then(function (nome) {
        MessageBox.confirm(texto(api, "removerEvidenciaConfirmar", [nome === undefined ? "" : nome]), {
          title: texto(api, "removerEvidenciaTitulo"),
          onClose: function (resposta) {
            if (resposta === MessageBox.Action.OK) {
              executar(api, "removerEvidencia", linha, ["evidencias"]).then(function (ok) {
                if (ok) {
                  MessageToast.show(texto(api, "removerEvidenciaConcluido"));
                }
              });
            }
          }
        });
      });
    }),

    // visible
    visivelGestao: function (pagina) {
      return propriedade(pagina, "ocultaGestaoAcoes").then(function (oculta) {
        return oculta === false;
      });
    },
    visivelOperacao: visivelSeNao("ocultaOperacoesDeAcao"),
    visivelRemover: visivelSeNao("ocultaOperacoesDeAcao"),

    // enabled
    habilitadoCriarSubacao: habilitadoSe("podeCriarSubacao"),
    habilitadoDelegar: habilitadoSe("podeDelegar"),
    habilitadoAnexar: habilitadoSe("podeAnexarEvidencia"),
    habilitadoComentarAcao: habilitadoSe("podeComentarAcao"),
    habilitadoIniciar: habilitadoSe("podeIniciarAcao"),
    habilitadoConcluir: habilitadoSe("podeConcluirAcao"),
    habilitadoRemover: habilitadoSe("podeRemover")
  };
});
