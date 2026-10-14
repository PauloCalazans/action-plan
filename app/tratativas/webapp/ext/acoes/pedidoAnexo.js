sap.ui.define([], function () { // eslint-disable-line no-undef
  "use strict";

  // Módulo puro (sem DOM nem UI5): monta o pedido de Anexar Evidência a partir do arquivo escolhido e das
  // regras do servidor (GET regrasAnexoEvidencia()). A interface não tem lista própria de formatos.

  /** Extensão em minúsculas, com o ponto, a partir do último ponto do nome ("" se não houver). */
  function extensaoDe(nome) {
    var texto = String(nome === undefined || nome === null ? "" : nome);
    var posicao = texto.lastIndexOf(".");
    return posicao < 0 ? "" : texto.slice(posicao).toLowerCase();
  }

  function formatoDe(nome, regras) {
    var extensao = extensaoDe(nome);
    var formatos = (regras && regras.formatos) || [];
    for (var i = 0; i < formatos.length; i++) {
      if (formatos[i].extensao === extensao) {
        return formatos[i];
      }
    }
    return undefined;
  }

  /** null, "formato" (extensão fora da lista) ou "tamanho" (acima do limite). O servidor continua sendo a verificação que vale. */
  function avisoDoArquivo(arquivo, regras) {
    if (!formatoDe(arquivo.nome, regras)) {
      return "formato";
    }
    if (arquivo.tamanho > regras.tamanhoMaximo) {
      return "tamanho";
    }
    return null;
  }

  /** Tipo informado pelo equipamento, nunca corrigido; só se vier vazio é completado pelo primeiro Tipo da extensão. */
  function tipoParaEnvio(nome, tipoInformado, regras) {
    if (tipoInformado) {
      return tipoInformado;
    }
    var formato = formatoDe(nome, regras);
    return formato && formato.tipos.length ? formato.tipos[0] : "";
  }

  /** parameterValues de Anexar Evidência; o Nome segue sem sanitizar (a sanitização é do servidor). */
  function montarPedidoAnexo(arquivo, regras) {
    var conteudo = arquivo.conteudo === undefined || arquivo.conteudo === null ? "" : arquivo.conteudo;
    var descricao = arquivo.descricao === undefined || arquivo.descricao === null ? "" : arquivo.descricao;
    return [
      { name: "nomeArquivo", value: arquivo.nome },
      { name: "mimeType", value: tipoParaEnvio(arquivo.nome, arquivo.tipo, regras) },
      { name: "conteudo", value: conteudo },
      { name: "descricao", value: descricao }
    ];
  }

  return {
    extensaoDe: extensaoDe,
    avisoDoArquivo: avisoDoArquivo,
    tipoParaEnvio: tipoParaEnvio,
    montarPedidoAnexo: montarPedidoAnexo
  };
});
