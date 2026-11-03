/* Tela Início: salto de data do calendário, painéis laterais, anotações (editor de blocos) e informações contábeis. */
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  var ICONES = document.body.dataset.icones || "/static/icones.svg";

  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function ic(nome, cls) {
    var s = document.createElementNS(NS, "svg"), u = document.createElementNS(NS, "use");
    s.setAttribute("class", "ic" + (cls ? " " + cls : "")); s.setAttribute("aria-hidden", "true"); u.setAttribute("href", ICONES + "#i-" + nome); s.appendChild(u);
    return s;
  }
  function lerJson(id, padrao) { try { return JSON.parse(document.getElementById(id).textContent); } catch (e) { return padrao; } }
  function novoId() { return "b" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function clonar(x) { return JSON.parse(JSON.stringify(x)); }
  function guarda(chave, valor) { try { localStorage.setItem(chave, valor); } catch (e) {} }
  function le(chave) { try { return localStorage.getItem(chave); } catch (e) { return null; } }

  /* grava com a versão que a tela viu; 409 = outro aparelho gravou antes */
  function enviar(url, corpo, saindo) {
    return fetch(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo), credentials: "same-origin", keepalive: !!saindo })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, json: j }; }); });
  }

  /* ---------- calendário: salto para uma data ---------- */
  [].forEach.call(document.querySelectorAll("input[data-navega]"), function (inp) {
    inp.addEventListener("change", function () {
      if (/^\d{4}-\d{2}-\d{2}$/.test(inp.value)) location.href = inp.dataset.navega + inp.value + (inp.dataset.ancora || "");
    });
  });

  /* ---------- painéis laterais que recolhem (Avisos, Infos contábeis) ---------- */
  function recolhivel(painel, grade, chave) {
    if (!painel || !grade) return;
    var btn = painel.querySelector("[data-alternar]"), fechado = le(chave) === "1";
    function aplica() {
      painel.classList.toggle("fechado", fechado); grade.classList.toggle("recolhido", fechado);
      btn.setAttribute("aria-expanded", fechado ? "false" : "true"); btn.setAttribute("aria-label", fechado ? "Abrir painel" : "Recolher painel");
    }
    btn.addEventListener("click", function () { fechado = !fechado; guarda(chave, fechado ? "1" : "0"); aplica(); });
    aplica();
  }
  recolhivel(document.getElementById("avisos"), document.getElementById("linha-calendario"), "frota-painel-avisos-recolhido");
  recolhivel(document.getElementById("infos"), document.getElementById("notas-grade"), "frota-infos-recolhido");

  /* ---------- menu flutuante (seletor de tipo de bloco) ----------
     Fica posicionado no documento, então rola junto com a página: NADA fecha o menu por rolagem.
     (Fechar ao rolar era o defeito: a própria seta para baixo rola a lista e o menu sumia.) */
  var menuAberto = null;
  function fechaMenu() { if (menuAberto) { menuAberto.remove(); menuAberto = null; } }
  document.addEventListener("mousedown", function (e) {
    if (menuAberto && !menuAberto.contains(e.target) && !e.target.closest("[data-abre-menu]")) fechaMenu();
  });
  document.addEventListener("keydown", function (e) {
    if (!menuAberto) return;
    var k = e.key, m = menuAberto;
    if (k === "ArrowDown" || k === "ArrowUp" || (m.classList.contains("grade") && (k === "ArrowRight" || k === "ArrowLeft"))) {
      e.preventDefault(); e.stopPropagation(); m.mover(k === "ArrowDown" || k === "ArrowRight" ? 1 : -1);
    } else if (k === "Enter" || k === "Tab") {
      if (m.ativo >= 0) { e.preventDefault(); e.stopPropagation(); m.escolherAtivo(); }
    } else if (k === "Escape") { e.preventDefault(); e.stopPropagation(); fechaMenu(); }
  }, true);

  function abreMenu(ancora, itens, aoEscolher, opcoes) {
    opcoes = opcoes || {}; fechaMenu();
    var m = el("div", "menu-flutuante" + (opcoes.grade ? " grade" : "")); m.setAttribute("role", "menu"); menuAberto = m;
    var botoes = [];
    itens.forEach(function (it) {
      if (it === "-") { m.appendChild(el("hr")); return; }
      if (it.titulo) { m.appendChild(el("div", "titulo-menu", it.titulo)); return; }
      var b = el("button"); b.type = "button"; b.setAttribute("role", "menuitem");
      if (it.icone) b.appendChild(ic(it.icone));
      var tx = el("span", "txt"); tx.appendChild(el("span", "", it.rotulo)); if (it.dica) tx.appendChild(el("small", "", it.dica)); b.appendChild(tx);
      if (it.perigo) b.classList.add("perigo-item");
      b.addEventListener("mouseenter", function () { marca(botoes.length ? botoes.map(function (x) { return x.b; }).indexOf(b) : -1, true); });
      b.addEventListener("click", function () { fechaMenu(); aoEscolher(it); });
      m.appendChild(b); botoes.push({ b: b, it: it });
    });
    if (!botoes.length) m.appendChild(el("div", "vazio-menu", "Nenhum tipo encontrado"));
    document.body.appendChild(m);
    var r = ancora.getBoundingClientRect(), mw = m.offsetWidth, mh = m.offsetHeight;
    var topo = r.bottom + scrollY + 6, esq = Math.min(r.left + scrollX, scrollX + innerWidth - mw - 8);
    if (r.bottom + mh > innerHeight - 8 && r.top > mh + 8) topo = r.top + scrollY - mh - 6;
    m.style.top = topo + "px"; m.style.left = Math.max(8, esq) + "px";
    function rolaAte(b) {  // rola só dentro do menu (scrollIntoView rolaria a página inteira)
      var t = b.offsetTop, h = b.offsetHeight;
      if (t < m.scrollTop) m.scrollTop = Math.max(0, t - 4); else if (t + h > m.scrollTop + m.clientHeight) m.scrollTop = t + h - m.clientHeight + 4;
    }
    function marca(i, doMouse) {
      botoes.forEach(function (x, k) { x.b.classList.toggle("ativa", k === i); });
      m.ativo = i; if (i >= 0 && !doMouse) rolaAte(botoes[i].b);
    }
    m.ativo = -1;
    m.mover = function (d) { if (botoes.length) marca(m.ativo < 0 ? (d > 0 ? 0 : botoes.length - 1) : (m.ativo + d + botoes.length) % botoes.length); };
    m.escolherAtivo = function () { if (m.ativo >= 0) botoes[m.ativo].b.click(); };
    if (opcoes.marcarPrimeiro && botoes.length) marca(0);
    return m;
  }

  /* ---------- editor de blocos das anotações (os mesmos blocos do CRM) ---------- */
  var TONS = [["info", "Informação"], ["sucesso", "Sucesso"], ["atencao", "Atenção"]];
  var CELULAS_SWOT = ["Forças", "Fraquezas", "Oportunidades", "Ameaças"];
  var TIPOS = {
    titulo: { nome: "Título", desc: "Título de uma seção", icone: "text-h-one", cor: "azul", novo: function () { return { nivel: 1, texto: "" }; }, resumo: function (b) { return b.texto; } },
    texto: { nome: "Texto", desc: "Parágrafo livre", icone: "text-t", cor: "azul", novo: function () { return { texto: "" }; }, resumo: function (b) { return b.texto; } },
    destaque: { nome: "Destaque", desc: "Aviso colorido em evidência", icone: "lightbulb", cor: "ambar", novo: function () { return { tom: "info", texto: "" }; }, resumo: function (b) { return b.texto; } },
    lista: { nome: "Lista", desc: "Marcadores, numerada ou tarefas", icone: "list-bullets", cor: "verde", novo: function () { return { estilo: "marcadores", itens: [{ texto: "", feito: false }] }; }, resumo: function (b) { return b.itens.length + " item(ns)" + (b.itens[0] && b.itens[0].texto ? " · " + b.itens[0].texto : ""); } },
    cards: { nome: "Cartões", desc: "Título e texto lado a lado", icone: "cards", cor: "verde", novo: function () { return { itens: [{ titulo: "", texto: "" }] }; }, resumo: function (b) { return b.itens.length + " cartão(ões)"; } },
    metricas: { nome: "Números", desc: "Valores grandes em destaque", icone: "chart-bar", cor: "teal", novo: function () { return { itens: [{ rotulo: "", valor: "", detalhe: "" }] }; }, resumo: function (b) { return b.itens.map(function (x) { return x.rotulo + " " + x.valor; }).join(" · "); } },
    "antes-depois": { nome: "Antes e depois", desc: "Duas colunas para comparar", icone: "arrows-left-right", cor: "rosa", novo: function () { return { antes: { titulo: "Antes", texto: "" }, depois: { titulo: "Depois", texto: "" } }; }, resumo: function (b) { return b.antes.titulo + " × " + b.depois.titulo; } },
    links: { nome: "Links", desc: "Lista de endereços úteis", icone: "link", cor: "verde", novo: function () { return { itens: [{ rotulo: "", url: "" }] }; }, resumo: function (b) { return b.itens.length + " link(s)"; } },
    citacao: { nome: "Citação", desc: "Frase com autoria", icone: "quotes", cor: "ambar", novo: function () { return { texto: "", autor: "" }; }, resumo: function (b) { return b.texto; } },
    fluxo: { nome: "Fluxo", desc: "Passos em sequência", icone: "flow-arrow", cor: "verde", novo: function () { return { itens: [{ titulo: "", texto: "" }] }; }, resumo: function (b) { return b.itens.map(function (x) { return x.titulo; }).filter(Boolean).join(" → "); } },
    matriz: { nome: "Matriz 2×2", desc: "SWOT ou quatro quadrantes", icone: "squares-four", cor: "rosa", novo: function () { return { estilo: "swot", celulas: CELULAS_SWOT.map(function (t) { return { titulo: t, texto: "" }; }) }; }, resumo: function (b) { return b.estilo === "swot" ? "SWOT" : "Quatro quadrantes"; } },
    tabela: { nome: "Tabela", desc: "Linhas e colunas", icone: "table", cor: "teal", novo: function () { return { colunas: ["", ""], linhas: [["", ""], ["", ""]] }; }, resumo: function (b) { return b.colunas.filter(Boolean).join(" · ") || (b.linhas.length + " linha(s)"); } },
    separador: { nome: "Divisória", desc: "Linha para separar partes", icone: "minus", cor: "cinza", novo: function () { return {}; }, resumo: function () { return ""; } }
  };
  var ORDEM = ["titulo", "texto", "destaque", "lista", "cards", "metricas", "antes-depois", "links", "citacao", "fluxo", "matriz", "tabela", "separador"];

  function editor() {
    var raiz = document.getElementById("editor");
    if (!raiz) return;
    var dados = lerJson("dados-anotacoes", { versao: 0, blocos: [] });
    var blocos = (dados.blocos || []).filter(function (b) { return TIPOS[b.tipo]; });
    var versao = dados.versao || 0;
    var estado = document.getElementById("estado-anotacoes"), aviso = document.getElementById("aviso-conflito-anotacoes");
    var btnDesfazer = document.getElementById("desfazer"), btnRefazer = document.getElementById("refazer");
    var sujo = false, salvando = false, pendente = false, timer = null, travado = false;
    var abertos = {}; blocos.forEach(function (b) { abertos[b.id] = true; });
    var ultimoNovo = null, pedeFoco = null;

    /* ----- gravação automática ----- */
    function rotuloEstado(txt, erro) { estado.textContent = txt; estado.classList.toggle("erro", !!erro); }
    function marcaSujo() { sujo = true; rotuloEstado("Salvando…"); clearTimeout(timer); timer = setTimeout(salvar, 700); }
    function salvar(saindo) {
      if (travado || !sujo) return;
      if (salvando) { pendente = true; return; }
      salvando = true; sujo = false;
      enviar("/api/inicio/anotacoes", { versao: versao, blocos: blocos }, saindo === "saindo").then(function (r) {
        salvando = false;
        if (r.status === 200) { versao = r.json.versao; rotuloEstado(sujo ? "Salvando…" : "Salvo"); if (sujo || pendente) { pendente = false; salvar(); } }
        else if (r.status === 409) { travado = true; aviso.hidden = false; rotuloEstado("Não salvo", true); }
        else { sujo = true; rotuloEstado("Erro ao salvar. Tentando de novo…", true); timer = setTimeout(salvar, 4000); }
      }).catch(function () { salvando = false; sujo = true; rotuloEstado("Sem conexão. Tentando de novo…", true); timer = setTimeout(salvar, 4000); });
    }
    document.getElementById("recarregar-anotacoes").addEventListener("click", function () { location.reload(); });
    addEventListener("pagehide", function () { if (sujo && !travado) { clearTimeout(timer); salvar("saindo"); } });
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden" && sujo && !travado) { clearTimeout(timer); salvar(); } });

    /* ----- desfazer / refazer (Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y) ----- */
    var hist = [JSON.stringify(blocos)], pos = 0, ultimaChave = null, ultimoT = 0;
    function atualizaBotoes() { btnDesfazer.disabled = pos <= 0; btnRefazer.disabled = pos >= hist.length - 1; }
    function registra(chave) {  // chave igual em sequência = a mesma digitação, um passo só
      var snap = JSON.stringify(blocos); if (snap === hist[pos]) return;
      var junta = chave && chave === ultimaChave && Date.now() - ultimoT < 1200 && pos === hist.length - 1 && pos > 0;
      if (junta) hist[pos] = snap;
      else { hist.length = pos + 1; hist.push(snap); pos++; if (hist.length > 150) { hist.shift(); pos--; } }
      ultimaChave = chave || null; ultimoT = Date.now(); atualizaBotoes();
    }
    function vai(d) {
      var alvo = pos + d; if (alvo < 0 || alvo >= hist.length) return;
      pos = alvo; blocos = JSON.parse(hist[pos]); ultimaChave = null;
      blocos.forEach(function (b) { if (abertos[b.id] === undefined) abertos[b.id] = true; });
      fechaMenu(); render(); atualizaBotoes(); marcaSujo(); raiz.focus({ preventScroll: true });
    }
    btnDesfazer.addEventListener("click", function () { vai(-1); });
    btnRefazer.addEventListener("click", function () { vai(1); });
    raiz.tabIndex = -1;
    // Vale com o foco dentro do editor ou solto na página (depois de remover um bloco, o botão some e o foco se perde);
    // com o foco em OUTRO campo da página (infos, busca…), o Ctrl+Z continua sendo daquele campo.
    document.addEventListener("keydown", function (e) {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      var k = e.key.toLowerCase(); if (k !== "z" && k !== "y") return;
      var t = e.target, solto = t === document.body || t === document.documentElement;
      if (!raiz.contains(t) && !solto) return;
      if (k === "z" && !e.shiftKey) { e.preventDefault(); vai(-1); } else if ((k === "z" && e.shiftKey) || k === "y") { e.preventDefault(); vai(1); }
    }, true);

    /* ----- mudanças ----- */
    function alterou(chave) { registra(chave); marcaSujo(); }
    function estrutura(foco) { registra(null); marcaSujo(); pedeFoco = foco || null; render(); }
    function idx(id) { for (var i = 0; i < blocos.length; i++) if (blocos[i].id === id) return i; return -1; }
    function criaBloco(tipo, id) { var b = TIPOS[tipo].novo(); b.id = id || novoId(); b.tipo = tipo; return b; }
    function adicionar(tipo) { var b = criaBloco(tipo); blocos.push(b); abertos[b.id] = true; ultimoNovo = b.id; estrutura({ id: b.id, sel: ".t, input, textarea" }); }
    function mover(i, d) { var j = i + d; if (j < 0 || j >= blocos.length) return; var x = blocos.splice(i, 1)[0]; blocos.splice(j, 0, x); estrutura(); }
    function duplicar(i) { var c = clonar(blocos[i]); c.id = novoId(); blocos.splice(i + 1, 0, c); abertos[c.id] = abertos[blocos[i].id]; ultimoNovo = c.id; estrutura(); }
    function remover(i) { blocos.splice(i, 1); estrutura(); }

    /* ----- campos dos formulários ----- */
    function campo(rotulo, controle) { var c = el("label", "cp"); c.appendChild(el("span", "", rotulo)); c.appendChild(controle); return c; }
    function entrada(obj, chave, o) {
      o = o || {}; var i = o.multi ? el("textarea", "t") : el("input", "t"); if (!o.multi) i.type = "text";
      i.value = obj[chave] || ""; if (o.ph) i.placeholder = o.ph; if (o.max) i.maxLength = o.max; if (o.rotulo) i.setAttribute("aria-label", o.rotulo);
      if (o.multi) { var ajusta = function () { i.style.height = "auto"; i.style.height = Math.max(84, i.scrollHeight + 2) + "px"; }; i.addEventListener("input", ajusta); setTimeout(ajusta, 0); }
      i.addEventListener("input", function () { obj[chave] = i.value; if (o.aoDigitar) o.aoDigitar(i); alterou(o.chave || (obj.id || "") + ":" + chave); });
      if (o.aoTecla) i.addEventListener("keydown", function (e) { o.aoTecla(e, i); });
      return i;
    }
    function escolha(obj, chave, opcoes, rotulo, aoTrocar) {
      var s = el("select"); s.setAttribute("aria-label", rotulo);
      opcoes.forEach(function (op) { var o = el("option", "", op[1]); o.value = op[0]; if (String(obj[chave]) === String(op[0])) o.selected = true; s.appendChild(o); });
      s.addEventListener("change", function () { var v = s.value; obj[chave] = /^\d+$/.test(v) ? Number(v) : v; if (aoTrocar) aoTrocar(); else { registra(null); marcaSujo(); } });
      var c = el("div", "cp"); c.append(el("span", "", rotulo), s); return c;  // div, não label: o clique na lista não pode "vazar" para o rótulo
    }
    function botaoX(rotulo, aoClicar) { var b = el("button", "x"); b.type = "button"; b.setAttribute("aria-label", rotulo); b.title = rotulo; b.appendChild(ic("trash")); b.addEventListener("click", aoClicar); return b; }
    // lista de itens: adicionar, remover; Enter cria o próximo, Backspace em item vazio remove
    function repetidor(b, chave, vazio, max, desenhaItem, rotuloAdd, opcoes) {
      opcoes = opcoes || {}; var arr = b[chave], rep = el("div", "rep");
      arr.forEach(function (item, i) {
        var linha = el("div", "rep-item" + (opcoes.simples ? " linha-simples" : "")), campos = desenhaItem(item, i);
        linha.append(campos, botaoX("Remover", function () { if (arr.length > 1 || opcoes.podeVazio) { arr.splice(i, 1); estrutura(); } else { arr[0] = vazio(); estrutura({ id: b.id, sel: "input, textarea" }); } }));
        rep.appendChild(linha);
      });
      if (arr.length < max) {
        var add = el("button", "sec pequeno rep-add"); add.type = "button"; add.append(ic("plus", "p"), document.createTextNode(rotuloAdd));
        add.addEventListener("click", function () { arr.push(vazio()); estrutura({ id: b.id, sel: ".rep-item:last-of-type input, .rep-item:last-of-type textarea" }); });
        rep.appendChild(add);
      }
      return rep;
    }

    var FORM = {
      titulo: function (b) { return [escolha(b, "nivel", [[1, "Grande"], [2, "Médio"], [3, "Pequeno"]], "Tamanho"), campo("Título", entrada(b, "texto", { max: 200, ph: "Título" }))]; },
      texto: function (b) {
        return [campo("Texto", entrada(b, "texto", { multi: true, max: 5000, ph: "Escreva aqui. Em um bloco vazio, digite / para trocar o tipo.", aoDigitar: function (i) { slash(b, i); } }))];
      },
      destaque: function (b) { return [escolha(b, "tom", TONS, "Tom"), campo("Texto", entrada(b, "texto", { multi: true, max: 5000 }))]; },
      lista: function (b) {
        var estilo = escolha(b, "estilo", [["marcadores", "Marcadores"], ["numerada", "Numerada"], ["check", "Tarefas"]], "Estilo", function () { estrutura(); });
        var rep = repetidor(b, "itens", function () { return { texto: "", feito: false }; }, 60, function (item, i) {
          var linha = el("div", "check-linha" + (b.estilo === "check" && item.feito ? " feito" : ""));
          if (b.estilo === "check") { var cb = el("input"); cb.type = "checkbox"; cb.checked = !!item.feito; cb.setAttribute("aria-label", "Concluído"); cb.addEventListener("change", function () { item.feito = cb.checked; linha.classList.toggle("feito", cb.checked); registra(null); marcaSujo(); }); linha.appendChild(cb); }
          if (b.estilo === "numerada") linha.appendChild(el("span", "num-item", (i + 1) + "."));
          if (b.estilo === "marcadores") linha.appendChild(el("span", "num-item", "•"));
          linha.appendChild(entrada(item, "texto", { max: 300, ph: "Item", rotulo: "Item " + (i + 1), chave: b.id + ":item" + i, aoTecla: function (e, inp) {
            if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); b.itens.splice(i + 1, 0, { texto: "", feito: false }); estrutura({ id: b.id, sel: ".rep-item:nth-of-type(" + (i + 2) + ") input[type=text]" }); }
            else if (e.key === "Backspace" && inp.value === "" && b.itens.length > 1) { e.preventDefault(); b.itens.splice(i, 1); estrutura({ id: b.id, sel: ".rep-item:nth-of-type(" + Math.max(1, i) + ") input[type=text]" }); }
          } }));
          return linha;
        }, "Item", { simples: true });
        return [estilo, rep];
      },
      cards: function (b) {
        return [repetidor(b, "itens", function () { return { titulo: "", texto: "" }; }, 12, function (c) {
          var w = el("div", "rep-campos"); w.append(entrada(c, "titulo", { max: 120, ph: "Título do cartão", rotulo: "Título" }), entrada(c, "texto", { multi: true, max: 1200, ph: "Texto", rotulo: "Texto" })); return w;
        }, "Cartão")];
      },
      metricas: function (b) {
        return [repetidor(b, "itens", function () { return { rotulo: "", valor: "", detalhe: "" }; }, 8, function (n) {
          var w = el("div", "rep-campos"); w.append(entrada(n, "rotulo", { max: 120, ph: "Nome (ex.: Veículos)", rotulo: "Nome" }), entrada(n, "valor", { max: 40, ph: "Valor (ex.: 25)", rotulo: "Valor" }), entrada(n, "detalhe", { max: 200, ph: "Detalhe", rotulo: "Detalhe" })); return w;
        }, "Número")];
      },
      "antes-depois": function (b) {
        function lado(rot, o) { var w = el("div", "rep-campos"); w.appendChild(el("b", "", rot)); w.append(entrada(o, "titulo", { max: 120, ph: "Título", rotulo: rot + ": título", chave: b.id + ":" + rot + "t" }), entrada(o, "texto", { multi: true, max: 1500, ph: "Texto", rotulo: rot + ": texto", chave: b.id + ":" + rot + "x" })); return w; }
        var d = el("div", "dupla"); d.append(lado("Antes", b.antes), lado("Depois", b.depois)); return [d];
      },
      links: function (b) {
        return [repetidor(b, "itens", function () { return { rotulo: "", url: "" }; }, 30, function (l) {
          var w = el("div", "rep-campos");
          var u = entrada(l, "url", { max: 500, ph: "https://…", rotulo: "Endereço" });
          u.addEventListener("blur", function () { var v = u.value.trim(); if (v && !/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) { u.value = "https://" + v; l.url = u.value; alterou(null); } });
          w.append(entrada(l, "rotulo", { max: 120, ph: "Nome do link", rotulo: "Nome" }), u); return w;
        }, "Link")];
      },
      citacao: function (b) { return [campo("Citação", entrada(b, "texto", { multi: true, max: 1000 })), campo("Autor", entrada(b, "autor", { max: 120, ph: "Quem disse" }))]; },
      fluxo: function (b) {
        return [repetidor(b, "itens", function () { return { titulo: "", texto: "" }; }, 24, function (p, i) {
          var w = el("div", "rep-campos"); w.append(entrada(p, "titulo", { max: 120, ph: "Passo " + (i + 1), rotulo: "Passo " + (i + 1) }), entrada(p, "texto", { max: 200, ph: "Detalhe", rotulo: "Detalhe do passo " + (i + 1) })); return w;
        }, "Passo")];
      },
      matriz: function (b) {
        var g = el("div", "matriz-ed");
        b.celulas.forEach(function (c, i) {
          var w = el("div", "rep-campos"); w.append(entrada(c, "titulo", { max: 120, rotulo: "Quadrante " + (i + 1), ph: b.estilo === "swot" ? CELULAS_SWOT[i] : "Título" }), entrada(c, "texto", { multi: true, max: 1500, ph: "Texto", rotulo: "Texto do quadrante " + (i + 1) })); g.appendChild(w);
        });
        return [escolha(b, "estilo", [["swot", "SWOT"], ["neutro", "Neutra"]], "Estilo", function () { registra(null); marcaSujo(); }), g];
      },
      tabela: function (b) {
        var larg = b.colunas.length, rolar = el("div", "tab-rolar"), t = el("table", "tab-ed"), cab = el("thead"), corpo = el("tbody");
        var xs = el("tr"); b.colunas.forEach(function (_, j) { var td = el("td"), x = el("button", "xx"); x.type = "button"; x.setAttribute("aria-label", "Remover coluna " + (j + 1)); x.appendChild(ic("x")); x.addEventListener("click", function () { if (larg > 1) { b.colunas.splice(j, 1); b.linhas.forEach(function (l) { l.splice(j, 1); }); estrutura({ id: b.id, sel: "input" }); } }); td.appendChild(x); xs.appendChild(td); }); xs.appendChild(el("td"));
        var hr = el("tr"); b.colunas.forEach(function (c, j) { var td = el("td"), i = el("input"); i.type = "text"; i.value = c; i.maxLength = 60; i.placeholder = "Coluna " + (j + 1); i.setAttribute("aria-label", "Título da coluna " + (j + 1)); i.addEventListener("input", function () { b.colunas[j] = i.value; alterou(b.id + ":c" + j); }); td.appendChild(i); hr.appendChild(td); }); hr.appendChild(el("td"));
        cab.append(xs, hr);
        b.linhas.forEach(function (l, i) {
          while (l.length < larg) l.push("");
          var tr = el("tr"); l.forEach(function (v, j) { var td = el("td"), inp = el("input"); inp.type = "text"; inp.value = v; inp.maxLength = 300; inp.setAttribute("aria-label", "Linha " + (i + 1) + ", coluna " + (j + 1)); inp.addEventListener("input", function () { l[j] = inp.value; alterou(b.id + ":" + i + "," + j); }); td.appendChild(inp); tr.appendChild(td); });
          var tdx = el("td"), x = el("button", "xx"); x.type = "button"; x.setAttribute("aria-label", "Remover linha " + (i + 1)); x.appendChild(ic("x")); x.addEventListener("click", function () { b.linhas.splice(i, 1); estrutura(); }); tdx.appendChild(x); tr.appendChild(tdx); corpo.appendChild(tr);
        });
        t.append(cab, corpo); rolar.appendChild(t);
        var ac = el("div", "acoes"), aL = el("button", "sec pequeno"), aC = el("button", "sec pequeno"); aL.type = aC.type = "button";
        aL.append(ic("plus", "p"), document.createTextNode("Linha")); aC.append(ic("plus", "p"), document.createTextNode("Coluna"));
        aL.addEventListener("click", function () { if (b.linhas.length < 40) { b.linhas.push(new Array(larg).fill("")); estrutura({ id: b.id, sel: "tbody tr:last-child input" }); } });
        aC.addEventListener("click", function () { if (larg < 8) { b.colunas.push(""); b.linhas.forEach(function (l) { l.push(""); }); estrutura({ id: b.id, sel: "thead tr:nth-child(2) td:last-of-type input" }); } });
        ac.append(aL, aC); return [rolar, ac];
      },
      separador: function () { return []; }
    };

    /* ----- "/" no bloco de texto: troca o tipo do bloco ----- */
    function slash(b, area) {
      var v = area.value;
      if (v.charAt(0) === "/" && !/[\s]/.test(v)) {
        var f = v.slice(1).toLowerCase();
        var lista = ORDEM.filter(function (t) { return t !== "texto" && (!f || TIPOS[t].nome.toLowerCase().indexOf(f) >= 0 || t.indexOf(f) >= 0); });
        abreMenu(area, lista.map(function (t) { return { rotulo: TIPOS[t].nome, dica: TIPOS[t].desc, icone: TIPOS[t].icone, tipo: t }; }), function (it) {
          var i = idx(b.id); if (i < 0) return; var novo = criaBloco(it.tipo, b.id); blocos[i] = novo; abertos[b.id] = true;
          estrutura({ id: b.id, sel: ".t, input, textarea" });
        }, { marcarPrimeiro: true });
      } else if (menuAberto) fechaMenu();
    }

    /* ----- desenho ----- */
    function render() {
      fechaMenu(); raiz.textContent = "";
      var qtdAbertos = blocos.filter(function (b) { return abertos[b.id]; }).length;
      if (blocos.length > 1) {
        var topo = el("div", "editor-topo"), a = el("button", "sec pequeno", "Abrir todos"), f = el("button", "sec pequeno", "Fechar todos");
        a.type = f.type = "button"; topo.append(el("span", "conta", qtdAbertos + "/" + blocos.length + " abertos"), a, f);
        a.addEventListener("click", function () { blocos.forEach(function (b) { abertos[b.id] = true; }); render(); });
        f.addEventListener("click", function () { blocos.forEach(function (b) { abertos[b.id] = false; }); render(); });
        raiz.appendChild(topo);
      }
      blocos.forEach(function (b, i) {
        var T = TIPOS[b.tipo], aberto = !!abertos[b.id] && b.tipo !== "separador";
        var sec = el("section", "blc cor-" + T.cor + (b.id === ultimoNovo ? " novo" : "")); sec.dataset.id = b.id; sec.setAttribute("aria-label", T.nome + " " + (i + 1));
        var cab = el("div", "blc-cab"), alterna = el("button", "alterna"); alterna.type = "button"; alterna.setAttribute("aria-expanded", aberto ? "true" : "false");
        if (b.tipo !== "separador") alterna.appendChild(ic(aberto ? "caret-down" : "caret-right"));
        alterna.appendChild(el("span", "blc-tag", T.nome));
        if (!aberto) alterna.appendChild(el("span", "blc-resumo", b.tipo === "separador" ? "— — —" : T.resumo(b)));
        alterna.addEventListener("click", function () { if (b.tipo === "separador") return; abertos[b.id] = !abertos[b.id]; render(); });
        var bt = el("div", "blc-botoes");
        function icone(nome, rot, fn, off, perigo) { var x = el("button", perigo ? "perigo" : ""); x.type = "button"; x.setAttribute("aria-label", rot); x.title = rot; x.disabled = !!off; x.appendChild(ic(nome)); x.addEventListener("click", fn); bt.appendChild(x); }
        icone("caret-up", "Mover para cima", function () { mover(i, -1); }, i === 0);
        icone("caret-down", "Mover para baixo", function () { mover(i, 1); }, i === blocos.length - 1);
        icone("copy", "Duplicar bloco", function () { duplicar(i); });
        icone("trash", "Remover bloco", function () { remover(i); }, false, true);
        cab.append(alterna, bt); sec.appendChild(cab);
        if (aberto) { var corpo = el("div", "blc-corpo"); FORM[b.tipo](b).forEach(function (n) { corpo.appendChild(n); }); sec.appendChild(corpo); }
        raiz.appendChild(sec);
      });
      var add = el("button", "add-bloco"); add.type = "button"; add.dataset.abreMenu = "1"; add.setAttribute("aria-haspopup", "menu");
      add.append(ic("plus"), document.createTextNode("Adicionar bloco"));
      add.addEventListener("click", function () {
        if (menuAberto) { fechaMenu(); return; }
        abreMenu(add, ORDEM.map(function (t) { return { rotulo: TIPOS[t].nome, dica: TIPOS[t].desc, icone: TIPOS[t].icone, tipo: t }; }), function (it) { adicionar(it.tipo); }, { grade: true, marcarPrimeiro: true });
      });
      raiz.appendChild(add);
      window.frotaUI && window.frotaUI.melhora(raiz);  // troca os <select> pelas listas do app
      ultimoNovo = null;
      var tinhaFoco = !!pedeFoco;
      if (pedeFoco) {
        var alvo = raiz.querySelector('[data-id="' + pedeFoco.id + '"] ' + pedeFoco.sel.split(",").map(function (s) { return s.trim(); }).join(', [data-id="' + pedeFoco.id + '"] '));
        pedeFoco = null; if (alvo) { alvo.focus({ preventScroll: false }); if (alvo.setSelectionRange && alvo.type !== "checkbox") { try { alvo.setSelectionRange(alvo.value.length, alvo.value.length); } catch (e) {} } }
      }
      if (!tinhaFoco && !raiz.contains(document.activeElement)) raiz.focus({ preventScroll: true });  // o foco não se perde: Ctrl+Z segue valendo
    }
    if (!blocos.length) { var b0 = criaBloco("texto"); blocos.push(b0); abertos[b0.id] = true; hist = [JSON.stringify(blocos)]; }
    render(); atualizaBotoes();
  }

  /* ---------- informações contábeis (com grupos) ---------- */
  var SUGESTOES = ["Razão social", "CNPJ", "Inscrição estadual", "Endereço fiscal", "Banco", "Agência", "Conta", "Chave PIX", "E-mail financeiro", "Contador"];
  function infos() {
    var corpo = document.getElementById("corpo-infos"); if (!corpo) return;
    var dados = lerJson("dados-infos", { versao: 0, itens: [] }), versao = dados.versao || 0;
    function norm(x) {
      return x.tipo === "grupo" ? { tipo: "grupo", rotulo: x.rotulo || "", valor: "", itens: (x.itens || []).map(function (s) { return { rotulo: s.rotulo || "", valor: s.valor || "" }; }) }
        : { tipo: "info", rotulo: x.rotulo || "", valor: x.valor || "", itens: [] };
    }
    var itens = (dados.itens || []).map(norm), rascunho = null;
    var btnEditar = document.getElementById("editar-infos"), aviso = document.getElementById("aviso-conflito-infos");
    document.getElementById("recarregar-infos").addEventListener("click", function () { location.reload(); });

    function copia(texto, btn) {
      var original = btn.textContent;
      function ok() { btn.textContent = "Copiado"; setTimeout(function () { btn.textContent = original; }, 1200); }
      function sel() { var alvo = btn.closest("dd") || btn.closest("summary"); if (alvo) { var r = document.createRange(); r.selectNodeContents(alvo.firstChild); getSelection().removeAllRanges(); getSelection().addRange(r); } }
      try { navigator.clipboard.writeText(texto).then(ok, sel); } catch (e) { sel(); }
    }
    function linhaInfo(x) {
      var d = el("div", "info-item"), dd = el("dd"), cp = el("button", "fantasma pequeno", "Copiar"); cp.type = "button";
      cp.setAttribute("aria-label", "Copiar " + x.rotulo); cp.addEventListener("click", function () { copia(x.valor, cp); });
      dd.append(document.createTextNode(x.valor || "—"), cp); d.append(el("dt", "", x.rotulo || "Sem nome"), dd); return d;
    }
    var abertosGrupos = {}; try { abertosGrupos = JSON.parse(le("frota-infos-grupos-abertos") || "{}"); } catch (e) {}
    function ver() {
      corpo.textContent = ""; rascunho = null; btnEditar.textContent = "Editar"; btnEditar.className = "sec pequeno";
      var visiveis = itens.filter(function (x) { return x.tipo === "grupo" ? (x.rotulo || x.itens.length) : (x.rotulo || x.valor); });
      if (!visiveis.length) {
        var v = el("div", "vazio"); v.append(ic("receipt"), el("b", "", "Nada guardado ainda"), el("p", "", "Razão social, CNPJ, dados bancários e outras informações fixas ficam aqui, soltas ou em grupos. Aperte Editar para preencher."));
        corpo.appendChild(v); return;
      }
      var dl = el("div", "info-lista");
      visiveis.forEach(function (x) {
        if (x.tipo !== "grupo") { dl.appendChild(linhaInfo(x)); return; }
        var det = el("details", "info-grupo"), sm = el("summary"), nome = x.rotulo || "Grupo";
        det.open = !!abertosGrupos[nome];
        var tudo = el("button", "fantasma pequeno copiar-tudo", "Copiar tudo"); tudo.type = "button"; tudo.setAttribute("aria-label", "Copiar todas as informações de " + nome);
        tudo.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); copia(x.itens.map(function (s) { return (s.rotulo ? s.rotulo + ": " : "") + s.valor; }).join("\n"), tudo); });
        sm.append(ic("caret-right", "seta"), el("span", "nome", nome), el("span", "contagem", String(x.itens.length)), tudo); det.appendChild(sm);
        det.addEventListener("toggle", function () { if (det.open) abertosGrupos[nome] = true; else delete abertosGrupos[nome]; guarda("frota-infos-grupos-abertos", JSON.stringify(abertosGrupos)); });
        var lista = el("div", "info-lista"); x.itens.filter(function (s) { return s.rotulo || s.valor; }).forEach(function (s) { lista.appendChild(linhaInfo(s)); });
        if (!lista.childNodes.length) lista.appendChild(el("p", "caption", "Grupo vazio. Aperte Editar para adicionar informações."));
        det.appendChild(lista); dl.appendChild(det);
      });
      corpo.appendChild(dl);
    }

    // ---- edição ----
    function opcoesDeLocal() {
      var o = [["top", "Fora de grupos"]]; rascunho.forEach(function (x, i) { if (x.tipo === "grupo") o.push(["g" + i, x.rotulo || "Grupo " + (i + 1)]); }); return o;
    }
    function seletorMover(atual, aoMover) {
      var s = el("select"); s.setAttribute("aria-label", "Mover para o grupo");
      opcoesDeLocal().forEach(function (op) { var o = el("option", "", op[1]); o.value = op[0]; if (op[0] === atual) o.selected = true; s.appendChild(o); });
      s.addEventListener("change", function () { aoMover(s.value); });
      var w = el("div", "mover"); w.appendChild(s); return w;
    }
    function linhaEdicao(x, rotuloPh, aoRemover, local, aoMover) {
      var l = el("div", "linha-edicao"), r = el("input"), v = el("input", "valor-ed"), rm = el("button", "fantasma icone-so pequeno"); rm.type = "button";
      r.placeholder = rotuloPh; r.value = x.rotulo; r.maxLength = 80; r.setAttribute("aria-label", "Nome do campo");
      v.placeholder = "Valor"; v.value = x.valor; v.maxLength = 600; v.setAttribute("aria-label", "Valor do campo");
      rm.setAttribute("aria-label", "Remover campo"); rm.appendChild(ic("trash"));
      r.addEventListener("input", function () { x.rotulo = r.value; }); v.addEventListener("input", function () { x.valor = v.value; });
      rm.addEventListener("click", aoRemover); l.append(r, rm, v);
      if (rascunho.some(function (g) { return g.tipo === "grupo"; })) l.appendChild(seletorMover(local, aoMover));
      return l;
    }
    function mover(de, i, j, para) {  // de: "top" ou índice do grupo; para: "top" ou "g<índice>"
      var item = de === "top" ? rascunho[i] : rascunho[de].itens[j];
      if (de === "top") rascunho.splice(i, 1); else rascunho[de].itens.splice(j, 1);
      var alvo = para === "top" ? null : rascunho[Number(para.slice(1)) - (de === "top" && Number(para.slice(1)) > i ? 1 : 0)];
      if (alvo) alvo.itens.push({ rotulo: item.rotulo, valor: item.valor }); else rascunho.push({ tipo: "info", rotulo: item.rotulo, valor: item.valor, itens: [] });
      editar();
    }
    function foco(sel) { var e = corpo.querySelectorAll(sel); if (e.length) e[e.length - 1].focus(); }
    function editar() {
      if (!rascunho) rascunho = clonar(itens);
      btnEditar.textContent = "Cancelar"; btnEditar.className = "fantasma pequeno";
      corpo.textContent = ""; var f = el("div", "info-edicao");
      rascunho.forEach(function (x, i) {
        if (x.tipo === "grupo") {
          var g = el("div", "grupo-ed"), cab = el("div", "cab-grupo"), nome = el("input"), rm = el("button", "fantasma icone-so pequeno"); rm.type = "button";
          nome.placeholder = "Nome do grupo (ex.: Dados bancários)"; nome.value = x.rotulo; nome.maxLength = 80; nome.setAttribute("aria-label", "Nome do grupo");
          nome.addEventListener("input", function () { x.rotulo = nome.value; });
          rm.setAttribute("aria-label", "Remover grupo e as informações dentro dele"); rm.appendChild(ic("trash"));
          rm.addEventListener("click", function () { if (!x.itens.length || confirmaRemocao(x)) { rascunho.splice(i, 1); editar(); } });
          cab.append(nome, rm); g.appendChild(cab);
          x.itens.forEach(function (s, j) { g.appendChild(linhaEdicao(s, "Nome (ex.: Banco)", function () { x.itens.splice(j, 1); editar(); }, "g" + i, function (para) { mover(i, null, j, para); })); });
          var add = el("button", "sec pequeno", "+ Informação neste grupo"); add.type = "button"; add.style.justifySelf = "start";
          add.addEventListener("click", function () { x.itens.push({ rotulo: "", valor: "" }); editar(); var ls = corpo.querySelectorAll(".grupo-ed")[rascunho.slice(0, i + 1).filter(function (y) { return y.tipo === "grupo"; }).length - 1].querySelectorAll(".linha-edicao input:first-child"); ls[ls.length - 1].focus(); });
          g.appendChild(add); f.appendChild(g);
        } else f.appendChild(linhaEdicao(x, "Nome (ex.: CNPJ)", function () { rascunho.splice(i, 1); editar(); }, "top", function (para) { mover("top", i, null, para); }));
      });
      var sug = el("div", "sugestoes"), usados = rascunho.map(function (x) { return (x.rotulo || "").toLowerCase(); });
      var novoGrupo = el("button", "", "+ Grupo"); novoGrupo.type = "button";
      novoGrupo.addEventListener("click", function () { rascunho.push({ tipo: "grupo", rotulo: "", valor: "", itens: [{ rotulo: "", valor: "" }] }); editar(); foco(".grupo-ed .cab-grupo input"); });
      sug.appendChild(novoGrupo);
      SUGESTOES.filter(function (s) { return usados.indexOf(s.toLowerCase()) < 0; }).forEach(function (s) {
        var b = el("button", "sec", "+ " + s); b.type = "button"; b.addEventListener("click", function () { rascunho.push({ tipo: "info", rotulo: s, valor: "", itens: [] }); editar(); foco(".info-edicao > .linha-edicao .valor-ed"); }); sug.appendChild(b);
      });
      var vazio = el("button", "sec", "+ Campo em branco"); vazio.type = "button"; vazio.addEventListener("click", function () { rascunho.push({ tipo: "info", rotulo: "", valor: "", itens: [] }); editar(); foco(".info-edicao > .linha-edicao input:first-child"); }); sug.appendChild(vazio);
      var acoes = el("div", "acoes"), salvar = el("button", "", "Salvar"), msg = el("span", "caption"); salvar.type = "button";
      salvar.addEventListener("click", function () {
        var limpo = rascunho.map(function (x) {
          if (x.tipo === "grupo") return { tipo: "grupo", rotulo: x.rotulo.trim(), valor: "", itens: x.itens.filter(function (s) { return s.rotulo.trim() || s.valor.trim(); }).map(function (s) { return { rotulo: s.rotulo.trim(), valor: s.valor.trim() }; }) };
          return { tipo: "info", rotulo: x.rotulo.trim(), valor: x.valor.trim(), itens: [] };
        }).filter(function (x) { return x.tipo === "grupo" ? (x.rotulo || x.itens.length) : (x.rotulo || x.valor); });
        salvar.disabled = true; msg.textContent = "Salvando…";
        enviar("/api/inicio/infos", { versao: versao, itens: limpo }).then(function (r) {
          salvar.disabled = false;
          if (r.status === 200) { versao = r.json.versao; itens = limpo; ver(); }
          else if (r.status === 409) { aviso.hidden = false; msg.textContent = "Não salvo."; }
          else msg.textContent = "Erro ao salvar. Tente de novo.";
        }).catch(function () { salvar.disabled = false; msg.textContent = "Sem conexão. Tente de novo."; });
      });
      acoes.append(salvar, msg);
      corpo.append(f, el("p", "caption", "Adicionar:"), sug, acoes);
      window.frotaUI && window.frotaUI.melhora(corpo);
    }
    function confirmaRemocao(g) { return window.confirm ? window.confirm("Remover o grupo “" + (g.rotulo || "sem nome") + "” e as " + g.itens.length + " informações dentro dele?") : true; }
    btnEditar.addEventListener("click", function () { if (rascunho) ver(); else editar(); });
    ver();
  }

  editor(); infos();
})();
