/* Editor de blocos das anotações.
   Junta os dois editores do CRM: escrever direto em cada linha, como no Notion (notas das tarefas), e os blocos
   visuais editados no próprio bloco (páginas de estratégia). Recebe os utilitários da tela Início em `H`. */
window.frotaEditor = function (H) {
  "use strict";
  var el = H.el, ic = H.ic, clonar = H.clonar, novoId = H.novoId;
  var raiz = document.getElementById("editor");
  if (!raiz) return;

  var dados = H.lerJson("dados-anotacoes", { versao: 0, blocos: [] });
  var blocos = dados.blocos || [];
  var versao = dados.versao || 0;
  var LIMITE_NIVEIS = 5, MAX_TOTAL = 500;
  var TEXTO = { texto: 1, titulo: 1, tarefa: 1, marcador: 1, numerada: 1, toggle: 1, citacao: 1, destaque: 1 };
  var CONTINUAM = { tarefa: 1, marcador: 1, numerada: 1 };
  var SAEM_VAZIO = { tarefa: 1, marcador: 1, numerada: 1, citacao: 1, destaque: 1 };

  /* ---------- os tipos de bloco (mesmos nomes e atalhos do CRM) ---------- */
  var BASICOS = [
    { rotulo: "Título 1", glifo: "H1", tipo: "titulo", nivel: 1, atalho: "1" },
    { rotulo: "Título 2", glifo: "H2", tipo: "titulo", nivel: 2, atalho: "2" },
    { rotulo: "Título 3", glifo: "H3", tipo: "titulo", nivel: 3, atalho: "3" },
    { rotulo: "Lista de tarefas", glifo: "☑", tipo: "tarefa", atalho: "4" },
    { rotulo: "Lista com marcadores", glifo: "•", tipo: "marcador", atalho: "5" },
    { rotulo: "Lista numerada", glifo: "1.", tipo: "numerada", atalho: "6" },
    { rotulo: "Lista recolhível (toggle)", glifo: "▸", tipo: "toggle", atalho: "7" },
    { rotulo: "Citação", glifo: "❝", tipo: "citacao", atalho: "8" },
    { rotulo: "Destaque (callout)", glifo: "!", tipo: "destaque", atalho: "9" },
    { rotulo: "Texto", glifo: "Aa", tipo: "texto", atalho: "0" }
  ];
  var VISUAIS = [
    { rotulo: "Cartões", glifo: "▦", tipo: "cards" },
    { rotulo: "Números", glifo: "123", tipo: "metricas" },
    { rotulo: "Antes e depois", glifo: "⇄", tipo: "antes-depois" },
    { rotulo: "Links", glifo: "↗", tipo: "links" },
    { rotulo: "Fluxo (passo a passo)", glifo: "→", tipo: "fluxo" },
    { rotulo: "Matriz 2x2 (SWOT)", glifo: "⊞", tipo: "matriz" },
    { rotulo: "Tabela", glifo: "▥", tipo: "tabela" },
    { rotulo: "Divisória", glifo: "―", tipo: "separador" }
  ];
  var NOME_DO_TIPO = { texto: "Texto", titulo: "Título", tarefa: "Tarefa", marcador: "Marcador", numerada: "Numerada", toggle: "Recolhível", citacao: "Citação", destaque: "Destaque", cards: "Cartões", metricas: "Números", "antes-depois": "Antes e depois", links: "Links", fluxo: "Fluxo", matriz: "Matriz", tabela: "Tabela", separador: "Divisória" };
  var ROTULO_PH = { titulo: "Título", tarefa: "Tarefa", marcador: "Item da lista", numerada: "Item da lista", toggle: "Lista recolhível", citacao: "Citação", destaque: "Destaque" };
  function alvoDoAtalho(d) { for (var i = 0; i < BASICOS.length; i++) if (BASICOS[i].atalho === d) return BASICOS[i]; return null; }
  function alvoDe(tipo, nivel) { for (var i = 0; i < BASICOS.length; i++) if (BASICOS[i].tipo === tipo && (tipo !== "titulo" || BASICOS[i].nivel === nivel)) return BASICOS[i]; return null; }
  function ehOAlvo(b, a) { return b.tipo === a.tipo && (b.tipo !== "titulo" || (b.nivel || 1) === a.nivel); }
  // "# ", "- ", "1. " no começo de um bloco de texto viram o tipo, como no Notion
  var MARKDOWN = [[/^### /, "titulo", 3], [/^## /, "titulo", 2], [/^# /, "titulo", 1], [/^\[ ?\] /, "tarefa"], [/^[-*] /, "marcador"], [/^\d+\. /, "numerada"], [/^> /, "toggle"], [/^" /, "citacao"]];

  /* ---------- a árvore de blocos ---------- */
  function percorre(lista, fn, pai, nivel) {
    lista.forEach(function (b, i) { fn(b, lista, i, pai, nivel || 0); if (b.filhos && b.filhos.length) percorre(b.filhos, fn, b, (nivel || 0) + 1); });
  }
  function acha(id) { var r = null; percorre(blocos, function (b, l, i, p, n) { if (b.id === id) r = { b: b, lista: l, i: i, pai: p, nivel: n }; }); return r; }
  function visiveis() {  // ids na ordem da página (filhos de um recolhível fechado não entram)
    var out = [];
    (function f(l) { l.forEach(function (b) { out.push(b.id); if (b.filhos && b.filhos.length && (b.tipo !== "toggle" || b.aberto)) f(b.filhos); }); })(blocos);
    return out;
  }
  function total() { var n = 0; percorre(blocos, function () { n++; }); return n; }
  function altura(b) { var m = 0; (b.filhos || []).forEach(function (f) { m = Math.max(m, 1 + altura(f)); }); return m; }
  function paiDe(id) { var r = acha(id); return r && r.pai ? r.pai.id : null; }
  function topoDos(ids) {  // os escolhidos que não estão dentro de outro escolhido
    var set = {}; ids.forEach(function (i) { set[i] = 1; });
    return ids.filter(function (id) { for (var p = paiDe(id); p; p = paiDe(p)) if (set[p]) return false; return true; });
  }
  function visualNovo(tipo) {
    switch (tipo) {
      case "cards": return { itens: [{ titulo: "", texto: "" }] };
      case "metricas": return { itens: [{ rotulo: "", valor: "", detalhe: "" }] };
      case "antes-depois": return { antes: { titulo: "Antes", texto: "" }, depois: { titulo: "Depois", texto: "" } };
      case "links": return { itens: [{ rotulo: "", url: "" }] };
      case "fluxo": return { itens: [{ titulo: "", texto: "" }, { titulo: "", texto: "" }] };
      case "matriz": return { estilo: "swot", celulas: ["Forças", "Fraquezas", "Oportunidades", "Ameaças"].map(function (t) { return { titulo: t, texto: "" }; }) };
      case "tabela": return { colunas: ["", ""], linhas: [["", ""], ["", ""]] };
      default: return {};
    }
  }
  function novoBloco(tipo, texto) {
    var b = { id: novoId(), tipo: tipo };
    if (TEXTO[tipo]) {
      b.texto = texto || ""; b.filhos = [];
      if (tipo === "titulo") b.nivel = 1; if (tipo === "tarefa") b.marcado = false; if (tipo === "toggle") b.aberto = true; if (tipo === "destaque") b.tom = "info";
    } else Object.assign(b, visualNovo(tipo));
    return b;
  }
  function textoDeVisual(b) {
    var f = function (arr, ks) { return (arr || []).reduce(function (a, x) { return a.concat(ks.map(function (k) { return x[k]; })); }, []).filter(Boolean).join("\n"); };
    switch (b.tipo) {
      case "cards": case "fluxo": return f(b.itens, ["titulo", "texto"]);
      case "metricas": return f(b.itens, ["valor", "rotulo"]);
      case "links": return f(b.itens, ["rotulo"]);
      case "matriz": return f(b.celulas, ["titulo", "texto"]);
      case "antes-depois": return [b.antes.titulo, b.antes.texto, b.depois.titulo, b.depois.texto].filter(Boolean).join("\n");
      case "tabela": return b.colunas.concat([].concat.apply([], b.linhas)).filter(Boolean).join("\n");
      default: return "";
    }
  }
  /* troca o tipo mantendo o id (a seleção continua nele) e o texto que couber; tipo visual nasce em branco (Ctrl+Z devolve) */
  function converter(b, alvo) {
    var texto = TEXTO[b.tipo] ? b.texto : textoDeVisual(b);
    if (!TEXTO[alvo.tipo]) { var v = novoBloco(alvo.tipo); v.id = b.id; return v; }
    var n = { id: b.id, tipo: alvo.tipo, texto: texto, filhos: TEXTO[b.tipo] ? (b.filhos || []) : [] };
    if (alvo.tipo === "titulo") { n.nivel = alvo.nivel || 1; n.texto = texto.replace(/\n+/g, " "); }
    if (alvo.tipo === "tarefa") n.marcado = !!b.marcado;
    if (alvo.tipo === "toggle") n.aberto = b.tipo === "toggle" ? b.aberto !== false : true;
    if (alvo.tipo === "destaque") n.tom = b.tom || "info";
    if (alvo.tipo === "citacao" && b.autor) n.autor = b.autor;
    if (b.alinhamento && (alvo.tipo === "texto" || alvo.tipo === "titulo" || alvo.tipo === "citacao")) n.alinhamento = b.alinhamento;
    return n;
  }
  function propriedades(b) {
    var al = { campo: "alinhamento", rotulo: "Alinhamento", opcoes: [["esquerda", "Esquerda"], ["centro", "Centro"], ["direita", "Direita"]], atual: b.alinhamento || "esquerda" };
    if (b.tipo === "titulo" || b.tipo === "texto" || b.tipo === "citacao") return [al];
    if (b.tipo === "destaque") return [{ campo: "tom", rotulo: "Tom", opcoes: [["info", "Informação"], ["sucesso", "Conquista"], ["atencao", "Atenção"]], atual: b.tom || "info" }];
    if (b.tipo === "matriz") return [{ campo: "estilo", rotulo: "Estilo", opcoes: [["swot", "SWOT"], ["neutro", "Neutra"]], atual: b.estilo || "swot" }];
    return [];
  }

  /* ---------- gravação automática ---------- */
  var estado = document.getElementById("estado-anotacoes"), aviso = document.getElementById("aviso-conflito-anotacoes");
  var btnDesfazer = document.getElementById("desfazer"), btnRefazer = document.getElementById("refazer");
  var sujo = false, salvando = false, pendente = false, timer = null, travado = false;
  function rotuloEstado(txt, erro) { estado.textContent = txt; estado.classList.toggle("erro", !!erro); }
  function marcaSujo() { sujo = true; rotuloEstado("Salvando…"); clearTimeout(timer); timer = setTimeout(salvar, 700); }
  function salvar(saindo) {
    if (travado || !sujo) return;
    if (salvando) { pendente = true; return; }
    salvando = true; sujo = false;
    H.enviar("/api/inicio/anotacoes", { versao: versao, blocos: blocos }, saindo === "saindo").then(function (r) {
      salvando = false;
      if (r.status === 200) { versao = r.json.versao; rotuloEstado(sujo ? "Salvando…" : "Salvo"); if (sujo || pendente) { pendente = false; salvar(); } }
      else if (r.status === 409) { travado = true; aviso.hidden = false; rotuloEstado("Não salvo", true); }
      else { sujo = true; rotuloEstado("Erro ao salvar. Tentando de novo…", true); timer = setTimeout(salvar, 4000); }
    }).catch(function () { salvando = false; sujo = true; rotuloEstado("Sem conexão. Tentando de novo…", true); timer = setTimeout(salvar, 4000); });
  }
  document.getElementById("recarregar-anotacoes").addEventListener("click", function () { location.reload(); });
  addEventListener("pagehide", function () { if (sujo && !travado) { clearTimeout(timer); salvar("saindo"); } });
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden" && sujo && !travado) { clearTimeout(timer); salvar(); } });

  /* ---------- desfazer / refazer (Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y) ---------- */
  if (!blocos.length) blocos.push(novoBloco("texto"));
  var hist = [JSON.stringify(blocos)], pos = 0, ultimaChave = null, ultimoT = 0;
  function atualizaBotoes() { btnDesfazer.disabled = pos <= 0; btnRefazer.disabled = pos >= hist.length - 1; }
  function registra(chave) {  // mesma chave em sequência = a mesma digitação: um passo só
    var snap = JSON.stringify(blocos); if (snap === hist[pos]) return;
    var junta = chave && chave === ultimaChave && Date.now() - ultimoT < 1200 && pos === hist.length - 1 && pos > 0;
    if (junta) hist[pos] = snap;
    else { hist.length = pos + 1; hist.push(snap); pos++; if (hist.length > 150) { hist.shift(); pos--; } }
    ultimaChave = chave || null; ultimoT = Date.now(); atualizaBotoes();
  }
  function vai(d) {
    var alvo = pos + d; if (alvo < 0 || alvo >= hist.length) return;
    pos = alvo; blocos = JSON.parse(hist[pos]); ultimaChave = null;
    if (!blocos.length) blocos.push(novoBloco("texto"));
    render(); atualizaBotoes(); marcaSujo(); raiz.focus({ preventScroll: true });
  }
  btnDesfazer.addEventListener("click", function () { vai(-1); });
  btnRefazer.addEventListener("click", function () { vai(1); });
  raiz.tabIndex = -1;
  // Vale com o foco no editor ou solto na página (depois de apagar um bloco o foco se perde);
  // com o foco em OUTRO campo da página (infos, busca…), o Ctrl+Z continua sendo daquele campo.
  document.addEventListener("keydown", function (e) {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    var k = e.key.toLowerCase(); if (k !== "z" && k !== "y") return;
    var t = e.target, solto = t === document.body || t === document.documentElement;
    if (!raiz.contains(t) && !solto) return;
    e.preventDefault(); vai(k === "y" || e.shiftKey ? 1 : -1);
  }, true);

  function alterou(chave) { registra(chave); marcaSujo(); }
  var pedeFoco = null;
  function estrutura(foco) { registra(null); marcaSujo(); pedeFoco = foco || null; render(); }

  /* ---------- seleção de blocos ---------- */
  var sel = { ids: {}, ancora: null, ponta: null };
  var ehCampo = function (n) { return !!(n && n.closest && n.closest("textarea, input, select, [contenteditable='true']")); };
  function selecionados() { return visiveis().filter(function (id) { return sel.ids[id]; }); }
  function aplicaSelecao() {
    [].forEach.call(raiz.querySelectorAll(".nb"), function (n) { n.classList.toggle("selecionado", !!sel.ids[n.dataset.id]); });
  }
  function soltaCampo() { if (document.activeElement && ehCampo(document.activeElement)) document.activeElement.blur(); raiz.focus({ preventScroll: true }); }
  function selecionarUnico(id) { sel = { ids: (function () { var o = {}; o[id] = 1; return o; })(), ancora: id, ponta: id }; aplicaSelecao(); soltaCampo(); }
  function estender(ponta, de) {
    var ord = visiveis(), a = ord.indexOf(de || sel.ancora || ponta), b = ord.indexOf(ponta);
    if (a < 0 || b < 0) return selecionarUnico(ponta);
    var o = {}; ord.slice(Math.min(a, b), Math.max(a, b) + 1).forEach(function (i) { o[i] = 1; });
    sel = { ids: o, ancora: ord[a], ponta: ponta }; aplicaSelecao(); soltaCampo();
  }
  function alternar(id) {
    var o = Object.assign({}, sel.ids); if (o[id]) delete o[id]; else o[id] = 1;
    sel = { ids: o, ancora: id, ponta: id }; aplicaSelecao(); soltaCampo();
  }
  function limpaSelecao() { sel = { ids: {}, ancora: null, ponta: null }; aplicaSelecao(); }

  /* ---------- operações sobre blocos ---------- */
  function apagar(ids) {
    var top = topoDos(ids); if (!top.length) return;
    var antes = visiveis(), primeiro = antes.length;
    top.forEach(function (id) { primeiro = Math.min(primeiro, antes.indexOf(id)); });
    top.forEach(function (id) { var r = acha(id); if (r) r.lista.splice(r.i, 1); });
    if (!blocos.length) blocos.push(novoBloco("texto"));
    var depois = visiveis(), vizinho = depois[Math.min(primeiro, depois.length - 1)];
    sel = { ids: {}, ancora: null, ponta: null };
    estrutura(null); if (vizinho) selecionarUnico(vizinho);
  }
  function duplicarBloco(b) { var c = clonar(b); (function troca(x) { x.id = novoId(); (x.filhos || []).forEach(troca); })(c); return c; }
  function duplicar(ids) {
    var top = topoDos(ids); if (!top.length) return;
    var novos = [];
    top.forEach(function (id) { var r = acha(id); if (!r || total() + 1 > MAX_TOTAL) return; var c = duplicarBloco(r.b); r.lista.splice(r.i + 1, 0, c); novos.push(c.id); });
    estrutura(null);
    if (novos.length) { var o = {}; novos.forEach(function (i) { o[i] = 1; }); sel = { ids: o, ancora: novos[0], ponta: novos[novos.length - 1] }; aplicaSelecao(); }
  }
  function converterIds(ids, alvo) {
    ids.forEach(function (id) { var r = acha(id); if (r) r.lista[r.i] = converter(r.b, alvo); });
    estrutura(null); aplicaSelecao();
  }
  function ajustar(ids, tipo, campo, valor) {
    ids.forEach(function (id) { var r = acha(id); if (r && r.b.tipo === tipo) r.b[campo] = valor; });
    estrutura(null); aplicaSelecao();
  }
  function indentar(ids) {  // Tab: o bloco vira filho do irmão de cima
    var feito = false;
    topoDos(ids).forEach(function (id) {
      var r = acha(id); if (!r) return; var ant = r.lista[r.i - 1];
      if (!ant || !TEXTO[ant.tipo] || !TEXTO[r.b.tipo] || r.nivel + 1 + altura(r.b) > LIMITE_NIVEIS) return;
      r.lista.splice(r.i, 1); ant.filhos = (ant.filhos || []).concat([r.b]); if (ant.tipo === "toggle") ant.aberto = true; feito = true;
    });
    if (feito) { estrutura(pedeFoco); aplicaSelecao(); }
  }
  function desindentar(ids) {  // Shift+Tab: o bloco sai do pai e vai logo depois dele
    var feito = false;
    topoDos(ids).reverse().forEach(function (id) {
      var r = acha(id); if (!r || !r.pai) return; var pr = acha(r.pai.id);
      r.lista.splice(r.i, 1); pr.lista.splice(pr.i + 1, 0, r.b); feito = true;
    });
    if (feito) { estrutura(pedeFoco); aplicaSelecao(); }
  }
  function moverPara(ids, alvoId, depois) {  // arrastar: leva os blocos para junto de um irmão
    var top = topoDos(ids); if (!top.length) return;
    var alvo = acha(alvoId); if (!alvo) return;
    var movidos = top.map(function (id) { return acha(id).b; });
    if (movidos.some(function (m) { return m.id === alvoId; })) return;
    top.forEach(function (id) { var r = acha(id); r.lista.splice(r.i, 1); });
    var a2 = acha(alvoId); a2.lista.splice.apply(a2.lista, [a2.i + (depois ? 1 : 0), 0].concat(movidos));
    estrutura(null); aplicaSelecao();
  }
  function inserir(alvo, depoisDeId) {
    if (total() >= MAX_TOTAL) return;
    var r = depoisDeId ? acha(depoisDeId) : null;
    if (r && r.b.tipo === "texto" && !r.b.texto && !(r.b.filhos && r.b.filhos.length)) {  // bloco vazio: vira o escolhido
      r.lista[r.i] = converter(r.b, alvo); return estrutura({ id: r.b.id, pos: 0 });
    }
    var novo = converter(novoBloco("texto"), alvo); novo.id = novoId();
    var lista = r ? r.lista : blocos; lista.splice(r ? r.i + 1 : lista.length, 0, novo);
    estrutura({ id: novo.id, pos: 0 });
  }

  /* ---------- menus ---------- */
  function itensDeAlvos(lista, marcaAtalho, atual) {
    return lista.map(function (a) { return { rotulo: a.rotulo, glifo: a.glifo, dica: marcaAtalho && a.atalho ? "Ctrl+⇧+" + a.atalho : "", alvo: a, atual: atual ? ehOAlvo(atual, a) : false }; });
  }
  function menuInserir(ancora, depoisDeId) {
    var itens = [{ titulo: "Inserir bloco" }].concat(itensDeAlvos(BASICOS, true), [{ titulo: "Blocos visuais" }], itensDeAlvos(VISUAIS, false));
    H.abreMenu(ancora, itens, function (it) { inserir(it.alvo, depoisDeId); }, { marcarPrimeiro: true });
  }
  function menuDoBloco(ancora, id) {
    if (!sel.ids[id]) selecionarUnico(id);
    var ids = selecionados(), r = acha(id); if (!r) return;
    var b = r.b, noMenu = raiz.querySelector('.nb[data-id="' + id + '"]');
    if (noMenu) noMenu.classList.add("menu-aberto");
    var m = H.abreMenuLivre(ancora, function (m, fechar) {
      function cab(t) { m.appendChild(el("div", "titulo-menu", t)); }
      function item(glifo, rotulo, dica, fn, extra) {
        var bt = el("button"); bt.type = "button"; bt.setAttribute("role", "menuitem"); if (extra) bt.className = extra;
        bt.append(el("span", "glifo", glifo), el("span", "txt", rotulo)); if (dica) bt.appendChild(el("small", "", dica));
        bt.addEventListener("click", function () { fechar(); fn(); }); m.appendChild(bt);
      }
      cab(ids.length > 1 ? ids.length + " blocos selecionados" : NOME_DO_TIPO[b.tipo]);
      propriedades(b).forEach(function (p) {
        var w = el("div", "opcoes-menu"), g = el("div", "grupo"); w.appendChild(el("p", "rot", p.rotulo));
        p.opcoes.forEach(function (o) {
          var bt = el("button", "op", o[1]); bt.type = "button"; bt.setAttribute("aria-pressed", String(p.atual === o[0]));
          bt.addEventListener("click", function () { fechar(); ajustar(ids, b.tipo, p.campo, o[0]); }); g.appendChild(bt);
        });
        w.appendChild(g); m.appendChild(w);
      });
      m.appendChild(el("hr"));
      item("⧉", "Duplicar", "Ctrl+D", function () { duplicar(ids); });
      item("⌫", "Apagar", "Del", function () { apagar(ids); }, "perigo-item");
      m.appendChild(el("hr")); cab("Transformar em");
      itensDeAlvos(BASICOS, true, b).forEach(function (it) { item(it.glifo, it.rotulo, it.dica, function () { converterIds(ids, it.alvo); if (ids.length === 1 && TEXTO[it.alvo.tipo]) pedeFocoDepois(id); }, it.atual ? "atual" : ""); });
      cab("Blocos visuais");
      itensDeAlvos(VISUAIS, false, b).forEach(function (it) { item(it.glifo, it.rotulo, "", function () { converterIds(ids, it.alvo); }, it.atual ? "atual" : ""); });
    }, function () { if (noMenu) noMenu.classList.remove("menu-aberto"); });
    return m;
  }
  function pedeFocoDepois(id) { setTimeout(function () { focaBloco(id, "fim"); }, 0); }

  /* ---------- foco e navegação entre campos ---------- */
  function campos() { return [].slice.call(raiz.querySelectorAll("[data-campo]")); }
  function focaCampo(c, pos) {
    if (!c) return; c.focus();
    var p = pos === "fim" || pos == null ? c.value.length : Math.min(pos, c.value.length);
    try { c.setSelectionRange(p, p); } catch (e) {}
    c.scrollIntoView({ block: "nearest" });
  }
  function focaBloco(id, pos) { var c = raiz.querySelector('.nb[data-id="' + id + '"] [data-campo]'); if (c) focaCampo(c, pos); }
  function vizinho(campo, dir) {
    var cs = campos(), i = cs.indexOf(campo), alvo = cs[i + dir]; if (!alvo) return;
    focaCampo(alvo, dir < 0 ? "fim" : 0);
  }
  function ajusta(t) { t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; }
  function ajustaTodos() { [].forEach.call(raiz.querySelectorAll("textarea"), ajusta); }
  addEventListener("resize", ajustaTodos);

  /* teclas que valem em todo campo (texto ou visual) */
  function teclaComum(e, id) {
    var t = e.target, mod = e.ctrlKey || e.metaKey;
    if (mod && e.shiftKey && /^Digit\d$/.test(e.code)) {
      var a = alvoDoAtalho(e.code.slice(5));
      if (a) { e.preventDefault(); converterIds([id], a); if (TEXTO[a.tipo]) pedeFocoDepois(id); return true; }
    }
    if (e.key === "Escape") { e.preventDefault(); selecionarUnico(id); return true; }
    var ini = t.selectionStart, fim = t.selectionEnd;
    if (e.shiftKey && !mod && e.key === "ArrowUp" && ini === 0 && fim === 0) { e.preventDefault(); iniciaSelecao(id, -1); return true; }
    if (e.shiftKey && !mod && e.key === "ArrowDown" && ini === t.value.length && fim === t.value.length) { e.preventDefault(); iniciaSelecao(id, 1); return true; }
    // ↑/↓ sem Shift: se o cursor não andou (já estava na primeira/última linha), passa para o campo vizinho
    if ((e.key === "ArrowUp" || e.key === "ArrowDown") && !e.shiftKey && !mod && !e.altKey && ini === fim) {
      var dir = e.key === "ArrowUp" ? -1 : 1;
      setTimeout(function () { if (document.activeElement === t && t.selectionStart === ini && t.selectionEnd === ini) vizinho(t, dir); }, 0);
    }
    return false;
  }
  function iniciaSelecao(id, dir) {
    var ord = visiveis(), i = ord.indexOf(id), alvo = ord[i + dir];
    selecionarUnico(id); if (alvo) estender(alvo, id);
  }

  /* ---------- desenho ---------- */
  function render() {
    H.fechaMenu(); raiz.textContent = "";
    raiz.appendChild(desenhaLista(blocos, 0, null));
    var ind = el("div", "nb-solta"); ind.id = "nb-solta"; raiz.appendChild(ind);
    aplicaSelecao(); ajustaTodos();
    if (pedeFoco) {
      var f = pedeFoco, c = null; pedeFoco = null;
      if (f.ultimo) {  // o primeiro campo do último item recém-criado (cartão, linha da tabela…)
        var itens = raiz.querySelectorAll('.nb[data-id="' + f.id + '"] ' + f.ultimo), u = itens[itens.length - 1];
        c = u && (u.matches("[data-campo]") ? u : u.querySelector("[data-campo]")); if (c) focaCampo(c, 0);
      } else { c = raiz.querySelector('.nb[data-id="' + f.id + '"] [data-campo]'); if (c) focaCampo(c, f.pos); }
    } else if (!raiz.contains(document.activeElement)) raiz.focus({ preventScroll: true });
  }
  function desenhaLista(lista, nivel, pai) {
    var c = el("div", "nb-lista"), numero = 0;
    lista.forEach(function (b, i) {
      numero = b.tipo === "numerada" ? numero + 1 : 0;
      c.appendChild(desenhaBloco(b, lista, i, nivel, pai, numero, nivel === 0 && lista.length === 1));
    });
    return c;
  }
  function guia(b) {
    var g = el("div", "nb-guia"), mais = el("button", "mais"), alca = el("button", "alca");
    mais.type = alca.type = "button"; mais.dataset.abreMenu = alca.dataset.abreMenu = "1";
    mais.setAttribute("aria-label", "Inserir bloco abaixo"); mais.title = "Inserir bloco abaixo"; mais.appendChild(ic("plus"));
    alca.setAttribute("aria-label", "Arrastar ou abrir o menu do bloco"); alca.title = "Arraste para mover · clique para o menu"; alca.appendChild(ic("dots-six-vertical"));
    mais.addEventListener("click", function () { menuInserir(mais, b.id); });
    ligaAlca(alca, b.id); g.append(mais, alca); return g;
  }
  function desenhaBloco(b, lista, i, nivel, pai, numero, unico) {
    var no = el("div", "nb"); no.dataset.id = b.id;
    var linha = el("div", "nb-linha nb-" + b.tipo + (b.tipo === "titulo" ? " n" + (b.nivel || 1) : "") + (b.tipo === "tarefa" && b.marcado ? " marcado" : "") + (b.tipo === "destaque" ? " tom-" + (b.tom || "info") : "") + (b.tipo === "texto" && unico ? " unico" : ""));
    var conteudo = el("div", "nb-conteudo");
    linha.append(guia(b), conteudo); no.appendChild(linha);
    linha.addEventListener("contextmenu", function (e) {
      if (ehCampo(e.target) && window.getSelection().toString()) return;  // com texto marcado, deixa o menu do navegador (copiar)
      e.preventDefault();
      menuDoBloco({ getBoundingClientRect: function () { return { left: e.clientX, right: e.clientX, top: e.clientY, bottom: e.clientY }; } }, b.id);
    });
    if (TEXTO[b.tipo]) conteudo.appendChild(desenhaTexto(b, numero, unico));
    else if (b.tipo === "separador") {
      var c = el("div", "nb-corpo"); c.appendChild(el("hr")); c.addEventListener("click", function () { selecionarUnico(b.id); }); conteudo.appendChild(c);
    } else conteudo.appendChild(VISUAL[b.tipo](b));
    if (TEXTO[b.tipo]) {
      var visivel = b.tipo === "toggle" ? b.aberto : (b.filhos && b.filhos.length);
      if (visivel) {
        var fil = el("div", "nb-filhos");
        if (b.filhos && b.filhos.length) fil.appendChild(desenhaLista(b.filhos, nivel + 1, b));
        else {
          var v = el("button", "nb-vazio-toggle", "Vazio. Clique para adicionar um bloco aqui dentro"); v.type = "button";
          v.addEventListener("click", function () { var f = novoBloco("texto"); b.filhos = [f]; estrutura({ id: f.id, pos: 0 }); }); fil.appendChild(v);
        }
        no.appendChild(fil);
      }
    }
    return no;
  }

  function campoNoLugar(obj, chave, o) {
    o = o || {};
    var t = el("textarea", "nb-campo" + (o.cls ? " " + o.cls : "")); t.rows = 1; t.value = obj[chave] || ""; t.placeholder = o.ph || "";
    t.dataset.campo = "1"; t.setAttribute("aria-label", o.rotulo || o.ph || "Texto"); if (o.max) t.maxLength = o.max;
    t.addEventListener("input", function () {
      if (o.linha && /\n/.test(t.value)) t.value = t.value.replace(/\n+/g, " ");
      obj[chave] = t.value; ajusta(t); alterou(o.chave || (o.bloco || "") + ":" + (o.rotulo || chave));
    });
    t.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing && o.linha) { e.preventDefault(); vizinho(t, 1); return; }
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing && !o.linha && o.enterVai) { e.preventDefault(); vizinho(t, 1); return; }
      if (o.bloco) teclaComum(e, o.bloco);
    });
    if (o.aoSair) t.addEventListener("blur", function () { o.aoSair(t); });
    return t;
  }
  function botaoX(rotulo, fn) { var b = el("button", "vb-x"); b.type = "button"; b.setAttribute("aria-label", rotulo); b.title = rotulo; b.appendChild(ic("x")); b.addEventListener("click", fn); return b; }
  function botaoMais(texto, fn) { var b = el("button", "vb-mais"); b.type = "button"; b.append(ic("plus"), document.createTextNode(texto)); b.addEventListener("click", fn); return b; }
  function foco(b) { return { id: b.id }; }

  function desenhaTexto(b, numero, unico) {
    var corpo = el("div", "nb-corpo");
    if (b.tipo === "tarefa") {
      var ck = el("button", "nb-check"); ck.type = "button"; ck.setAttribute("role", "checkbox"); ck.setAttribute("aria-checked", b.marcado ? "true" : "false"); ck.setAttribute("aria-label", "Marcar como feito");
      if (b.marcado) ck.textContent = "✓";
      ck.addEventListener("click", function () { b.marcado = !b.marcado; estrutura(null); }); corpo.appendChild(ck);
    } else if (b.tipo === "marcador") corpo.appendChild(el("span", "nb-marca ponto"));
    else if (b.tipo === "numerada") corpo.appendChild(el("span", "nb-marca num", numero + "."));
    else if (b.tipo === "toggle") {
      var cr = el("button", "nb-caret"); cr.type = "button"; cr.setAttribute("aria-expanded", b.aberto ? "true" : "false"); cr.setAttribute("aria-label", b.aberto ? "Recolher" : "Expandir"); cr.appendChild(ic("caret-right"));
      cr.addEventListener("click", function () { b.aberto = !b.aberto; estrutura(null); }); corpo.appendChild(cr);
    } else if (b.tipo === "destaque") {
      var icone = el("span", "nb-icone"); icone.appendChild(ic({ info: "lightbulb", sucesso: "check-circle", atencao: "warning" }[b.tom || "info"])); corpo.appendChild(icone);
    }
    var t = el("textarea", "nb-t"); t.rows = 1; t.id = "eb-" + b.id; t.dataset.campo = "1"; t.dataset.bloco = b.id; t.value = b.texto || ""; t.maxLength = 5000;
    t.placeholder = b.tipo === "texto" ? (unico ? "Escreva aqui. Digite / para escolher um bloco" : "Digite / para escolher um bloco") : (ROTULO_PH[b.tipo] || "");
    if (b.alinhamento && b.alinhamento !== "esquerda") t.style.textAlign = b.alinhamento === "centro" ? "center" : "right";
    t.addEventListener("input", function () { aoDigitar(b, t); });
    t.addEventListener("keydown", function (e) { teclar(e, b.id); });
    t.addEventListener("paste", function (e) { colaTexto(e, b, t); });
    t.addEventListener("focus", function () { if (Object.keys(sel.ids).length) limpaSelecao(); });
    if (b.tipo === "citacao") {
      var col = el("div"); col.style.cssText = "flex:1;min-width:0;display:flex;flex-direction:column";
      var autor = campoNoLugar(b, "autor", { cls: "nb-autor", ph: "— autor", rotulo: "Autor", max: 120, linha: true, bloco: b.id, chave: b.id + ":autor" });
      col.append(t, autor); corpo.appendChild(col);
    } else corpo.appendChild(t);
    return corpo;
  }

  function aoDigitar(b, t) {
    var v = t.value; b.texto = v;
    if (b.tipo === "texto") {
      for (var i = 0; i < MARKDOWN.length; i++) {
        if (MARKDOWN[i][0].test(v.replace(/\u00a0/g, " "))) {
          var r = acha(b.id), n = converter(r.b, alvoDe(MARKDOWN[i][1], MARKDOWN[i][2]));
          n.texto = v.replace(MARKDOWN[i][0], ""); r.lista[r.i] = n; return estrutura({ id: b.id, pos: 0 });
        }
      }
      if (v === "---") {
        var rr = acha(b.id), sep = { id: b.id, tipo: "separador" }, novo = novoBloco("texto");
        rr.lista.splice(rr.i, 1, sep, novo); return estrutura({ id: novo.id, pos: 0 });
      }
      if (v.charAt(0) === "/" && !/\s/.test(v)) slash(b, t); else if (H.menuAtivo() && H.menuAtivo().dataset.slash) H.fechaMenu();
    }
    ajusta(t); alterou(b.id + ":texto");
  }
  function slash(b, t) {  // "/" no começo de um bloco vazio: a lista de blocos, com busca
    var f = t.value.slice(1).toLowerCase();
    var todos = BASICOS.filter(function (a) { return a.tipo !== "texto"; }).concat(VISUAIS);
    var lista = todos.filter(function (a) { return !f || a.rotulo.toLowerCase().indexOf(f) >= 0 || a.tipo.indexOf(f) >= 0; });
    var itens = itensDeAlvos(lista, true);
    var m = H.abreMenu(t, itens, function (it) {
      var r = acha(b.id); if (!r) return; var n = converter(r.b, it.alvo); if (TEXTO[n.tipo]) n.texto = "";
      r.lista[r.i] = n; estrutura({ id: b.id, pos: 0 });
    }, { marcarPrimeiro: true });
    m.dataset.slash = "1";
  }
  function colaTexto(e, b, t) {  // várias linhas coladas viram vários blocos
    var texto = (e.clipboardData || window.clipboardData).getData("text/plain").replace(/\r/g, "");
    var linhas = texto.split("\n").filter(function (l, i, a) { return !(l === "" && i === a.length - 1); });
    if (linhas.length <= 1) return;
    e.preventDefault();
    var r = acha(b.id), ini = t.selectionStart, fim = t.selectionEnd, antes = b.texto.slice(0, ini), depois = b.texto.slice(fim);
    b.texto = antes + linhas[0]; var tipo = CONTINUAM[b.tipo] ? b.tipo : "texto", ult = r.i, novos = [];
    for (var i = 1; i < linhas.length && total() + novos.length < MAX_TOTAL; i++) { var nb = novoBloco(tipo, linhas[i] + (i === linhas.length - 1 ? depois : "")); novos.push(nb); }
    r.lista.splice.apply(r.lista, [r.i + 1, 0].concat(novos));
    var ultimo = novos[novos.length - 1];
    estrutura({ id: ultimo.id, pos: ultimo.texto.length - depois.length });
  }

  function teclar(e, id) {
    var r = acha(id); if (!r) return; var b = r.b, t = e.target, ini = t.selectionStart, fim = t.selectionEnd, mod = e.ctrlKey || e.metaKey;
    if (teclaComum(e, id)) return;
    if (e.key === "Tab" && !mod && !e.altKey) {
      e.preventDefault(); pedeFoco = { id: id, pos: ini };
      if (e.shiftKey) desindentar([id]); else indentar([id]);
      return;
    }
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      if (!b.texto && SAEM_VAZIO[b.tipo]) {
        if (r.pai) { pedeFoco = { id: id, pos: 0 }; return desindentar([id]); }
        r.lista[r.i] = converter(b, alvoDe("texto")); return estrutura({ id: id, pos: 0 });
      }
      var antes = b.texto.slice(0, ini), depois = b.texto.slice(fim);
      if (b.tipo === "toggle" && b.aberto) {
        var filho = novoBloco("texto", depois); b.texto = antes; b.filhos = [filho].concat(b.filhos || []);
        return estrutura({ id: filho.id, pos: 0 });
      }
      var novo = novoBloco(CONTINUAM[b.tipo] ? b.tipo : "texto", depois); b.texto = antes; r.lista.splice(r.i + 1, 0, novo);
      return estrutura({ id: novo.id, pos: 0 });
    }
    if (e.key === "Backspace" && ini === 0 && fim === 0) {
      if (b.tipo !== "texto") { e.preventDefault(); r.lista[r.i] = converter(b, alvoDe("texto")); return estrutura({ id: id, pos: 0 }); }
      if (r.pai && r.i === 0) { e.preventDefault(); pedeFoco = { id: id, pos: 0 }; return desindentar([id]); }
      var ant = r.lista[r.i - 1];
      if (ant && TEXTO[ant.tipo]) {  // junta com o bloco de cima
        e.preventDefault(); var p = ant.texto.length; ant.texto += b.texto; ant.filhos = (ant.filhos || []).concat(b.filhos || []);
        r.lista.splice(r.i, 1); return estrutura({ id: ant.id, pos: p });
      }
      if (ant && !TEXTO[ant.tipo]) {  // depois de um bloco visual: apagar o vazio e selecionar o visual
        e.preventDefault();
        if (ant.tipo === "separador" || !b.texto) { r.lista.splice(ant.tipo === "separador" ? r.i - 1 : r.i, 1); if (!blocos.length) blocos.push(novoBloco("texto")); estrutura(ant.tipo === "separador" ? { id: id, pos: 0 } : null); if (ant.tipo !== "separador") selecionarUnico(ant.id); }
      }
    }
  }

  /* ---------- blocos visuais (editados no próprio bloco) ---------- */
  var VISUAL = {
    cards: function (b) {
      var v = el("div", "vb"), g = el("div", "vb-cartoes");
      b.itens.forEach(function (c, i) {
        var card = el("div", "vb-cartao vb-item");
        card.append(campoNoLugar(c, "titulo", { cls: "tit", ph: "Título do cartão", rotulo: "Título " + (i + 1), max: 120, linha: true, bloco: b.id }),
          campoNoLugar(c, "texto", { ph: "Texto", rotulo: "Texto " + (i + 1), max: 1200, bloco: b.id }),
          botaoX("Remover cartão", function () { if (b.itens.length > 1) b.itens.splice(i, 1); else b.itens[0] = { titulo: "", texto: "" }; estrutura(foco(b)); }));
        g.appendChild(card);
      });
      v.appendChild(g);
      if (b.itens.length < 12) v.appendChild(botaoMais("Cartão", function () { b.itens.push({ titulo: "", texto: "" }); estrutura({ id: b.id, ultimo: ".vb-cartao" }); }));
      v.style.display = "grid"; v.style.gap = "10px"; return v;
    },
    metricas: function (b) {
      var v = el("div", "vb"), g = el("div", "vb-metricas");
      b.itens.forEach(function (n, i) {
        var m = el("div", "vb-metrica vb-item");
        m.append(campoNoLugar(n, "valor", { cls: "valor", ph: "0", rotulo: "Valor " + (i + 1), max: 40, linha: true, bloco: b.id }),
          campoNoLugar(n, "rotulo", { cls: "rot", ph: "Nome", rotulo: "Nome " + (i + 1), max: 120, linha: true, bloco: b.id }),
          campoNoLugar(n, "detalhe", { cls: "det", ph: "Detalhe", rotulo: "Detalhe " + (i + 1), max: 200, linha: true, bloco: b.id }),
          botaoX("Remover número", function () { if (b.itens.length > 1) b.itens.splice(i, 1); else b.itens[0] = { rotulo: "", valor: "", detalhe: "" }; estrutura(foco(b)); }));
        g.appendChild(m);
      });
      v.appendChild(g);
      if (b.itens.length < 8) v.appendChild(botaoMais("Número", function () { b.itens.push({ rotulo: "", valor: "", detalhe: "" }); estrutura({ id: b.id, ultimo: ".vb-metrica" }); }));
      v.style.display = "grid"; v.style.gap = "10px"; return v;
    },
    "antes-depois": function (b) {
      var v = el("div", "vb"), g = el("div", "vb-ad");
      [["antes", "Antes"], ["depois", "Depois"]].forEach(function (p) {
        var l = el("div", "vb-lado " + p[0]), o = b[p[0]];
        l.append(el("span", "tag", p[1]), campoNoLugar(o, "titulo", { cls: "tit", ph: "Título", rotulo: p[1] + ": título", max: 120, linha: true, bloco: b.id }),
          campoNoLugar(o, "texto", { ph: "Texto", rotulo: p[1] + ": texto", max: 1500, bloco: b.id }));
        g.appendChild(l);
      });
      v.appendChild(g); return v;
    },
    links: function (b) {
      var v = el("div", "vb"), g = el("div", "vb-links");
      b.itens.forEach(function (l, i) {
        var linha = el("div", "vb-link vb-item");
        var url = campoNoLugar(l, "url", { cls: "url", ph: "https://…", rotulo: "Endereço " + (i + 1), max: 500, linha: true, bloco: b.id, aoSair: function (t) {
          var x = t.value.trim(); if (x && !/^[a-z][a-z0-9+.-]*:\/\//i.test(x)) { t.value = "https://" + x; l.url = t.value; alterou(null); }
        } });
        linha.append(ic("link"), campoNoLugar(l, "rotulo", { ph: "Nome do link", rotulo: "Nome do link " + (i + 1), max: 120, linha: true, bloco: b.id }), url,
          botaoX("Remover link", function () { if (b.itens.length > 1) b.itens.splice(i, 1); else b.itens[0] = { rotulo: "", url: "" }; estrutura(foco(b)); }));
        g.appendChild(linha);
      });
      v.appendChild(g);
      if (b.itens.length < 30) v.appendChild(botaoMais("Link", function () { b.itens.push({ rotulo: "", url: "" }); estrutura({ id: b.id, ultimo: ".vb-link" }); }));
      v.style.display = "grid"; v.style.gap = "10px"; return v;
    },
    fluxo: function (b) {
      var v = el("div", "vb"), g = el("div", "vb-fluxo");
      b.itens.forEach(function (p, i) {
        if (i > 0) { var s = el("span", "vb-seta"); s.appendChild(ic("arrow-right")); g.appendChild(s); }
        var passo = el("div", "vb-passo vb-item");
        passo.append(el("span", "n", String(i + 1)), campoNoLugar(p, "titulo", { cls: "tit", ph: "Passo " + (i + 1), rotulo: "Passo " + (i + 1), max: 120, linha: true, bloco: b.id }),
          campoNoLugar(p, "texto", { ph: "Detalhe", rotulo: "Detalhe do passo " + (i + 1), max: 200, bloco: b.id }),
          botaoX("Remover passo", function () { if (b.itens.length > 1) b.itens.splice(i, 1); else b.itens[0] = { titulo: "", texto: "" }; estrutura(foco(b)); }));
        g.appendChild(passo);
      });
      v.appendChild(g);
      if (b.itens.length < 24) v.appendChild(botaoMais("Passo", function () { b.itens.push({ titulo: "", texto: "" }); estrutura({ id: b.id, ultimo: ".vb-passo" }); }));
      v.style.display = "grid"; v.style.gap = "10px"; return v;
    },
    matriz: function (b) {
      var v = el("div", "vb"), g = el("div", "vb-matriz " + (b.estilo === "swot" ? "swot" : "neutro")), pad = ["Forças", "Fraquezas", "Oportunidades", "Ameaças"];
      while (b.celulas.length < 4) b.celulas.push({ titulo: "", texto: "" });
      b.celulas.forEach(function (c, i) {
        var q = el("div", "vb-quadrante q" + i);
        q.append(campoNoLugar(c, "titulo", { cls: "tit", ph: b.estilo === "swot" ? pad[i] : "Título", rotulo: "Quadrante " + (i + 1), max: 120, linha: true, bloco: b.id }),
          campoNoLugar(c, "texto", { ph: "Texto", rotulo: "Texto do quadrante " + (i + 1), max: 1500, bloco: b.id }));
        g.appendChild(q);
      });
      v.appendChild(g); return v;
    },
    tabela: function (b) {
      var v = el("div", "vb vb-tabela"), rolar = el("div", "rolar"), t = el("table"), cab = el("thead"), corpo = el("tbody"), larg = b.colunas.length;
      var xs = el("tr");
      b.colunas.forEach(function (_, j) {
        var td = el("td"), x = el("button", "xx"); x.type = "button"; x.setAttribute("aria-label", "Remover coluna " + (j + 1)); x.appendChild(ic("x"));
        x.addEventListener("click", function () { if (larg > 1) { b.colunas.splice(j, 1); b.linhas.forEach(function (l) { l.splice(j, 1); }); estrutura(foco(b)); } }); td.appendChild(x); xs.appendChild(td);
      }); xs.appendChild(el("td"));
      var hr = el("tr");
      b.colunas.forEach(function (c, j) { var td = el("td"); td.appendChild(campoNoLugar(b.colunas, j, { ph: "Coluna " + (j + 1), rotulo: "Título da coluna " + (j + 1), max: 60, linha: true, bloco: b.id })); hr.appendChild(td); });
      hr.appendChild(el("td")); cab.append(xs, hr);
      b.linhas.forEach(function (l, i) {
        while (l.length < larg) l.push("");
        var tr = el("tr");
        l.forEach(function (c, j) { var td = el("td"); td.appendChild(campoNoLugar(l, j, { rotulo: "Linha " + (i + 1) + ", coluna " + (j + 1), max: 300, bloco: b.id, chave: b.id + ":" + i + "," + j })); tr.appendChild(td); });
        var tdx = el("td"), x = el("button", "xx"); x.type = "button"; x.setAttribute("aria-label", "Remover linha " + (i + 1)); x.appendChild(ic("x"));
        x.addEventListener("click", function () { b.linhas.splice(i, 1); estrutura(foco(b)); }); tdx.appendChild(x); tr.appendChild(tdx); corpo.appendChild(tr);
      });
      t.append(cab, corpo); rolar.appendChild(t); v.appendChild(rolar);
      var ac = el("div", "vb-acoes");
      ac.append(botaoMais("Linha", function () { if (b.linhas.length < 40) { b.linhas.push(new Array(larg).fill("")); estrutura({ id: b.id, ultimo: "tbody tr:last-child td:first-child" }); } }),
        botaoMais("Coluna", function () { if (larg < 8) { b.colunas.push(""); b.linhas.forEach(function (l) { l.push(""); }); estrutura({ id: b.id, ultimo: "thead tr:nth-child(2) td:nth-last-child(2)" }); } }));
      v.appendChild(ac); return v;
    }
  };
  /* ---------- arrastar pela alça (mexe só entre irmãos, como no CRM) ---------- */
  var ignoraClique = false;
  function ligaAlca(btn, id) {
    var ini = null, arrastando = false, alvoId = null, depois = false;
    btn.addEventListener("pointerdown", function (e) {
      if (e.button !== 0 || e.shiftKey || e.ctrlKey || e.metaKey) return;
      ini = { x: e.clientX, y: e.clientY }; arrastando = false; try { btn.setPointerCapture(e.pointerId); } catch (x) {}
    });
    btn.addEventListener("pointermove", function (e) {
      if (!ini) return;
      if (!arrastando) { if (Math.hypot(e.clientX - ini.x, e.clientY - ini.y) < 5) return; arrastando = true; if (!sel.ids[id]) selecionarUnico(id); marcaArrasto(true); }
      var r = acha(id); if (!r) return;
      var irmaos = [].slice.call(raiz.querySelectorAll(".nb")).filter(function (n) { var x = acha(n.dataset.id); return x && x.lista === r.lista; });
      var rect = null; alvoId = null;
      for (var k = 0; k < irmaos.length; k++) { var b = irmaos[k].getBoundingClientRect(); if (e.clientY < b.top + b.height / 2) { alvoId = irmaos[k].dataset.id; depois = false; rect = b; break; } }
      if (!alvoId && irmaos.length) { alvoId = irmaos[irmaos.length - 1].dataset.id; depois = true; rect = irmaos[irmaos.length - 1].getBoundingClientRect(); }
      var ind = document.getElementById("nb-solta"), rr = raiz.getBoundingClientRect();
      if (ind && rect) { ind.style.display = "block"; ind.style.top = (depois ? rect.bottom : rect.top) - rr.top - 1 + "px"; }
    });
    btn.addEventListener("pointerup", function (e) {
      if (!ini) return; try { btn.releasePointerCapture(e.pointerId); } catch (x) {}
      var foi = arrastando; ini = null; arrastando = false;
      if (foi) {
        marcaArrasto(false); ignoraClique = true; setTimeout(function () { ignoraClique = false; }, 0);
        var ids = sel.ids[id] ? selecionados() : [id];
        if (alvoId) moverPara(ids, alvoId, depois);
      }
    });
    btn.addEventListener("click", function (e) {
      if (ignoraClique) return;
      if (e.shiftKey) { estender(id, sel.ancora || id); return; }
      if (e.ctrlKey || e.metaKey) { alternar(id); return; }
      menuDoBloco(btn, id);
    });
  }
  function marcaArrasto(ligado) {
    [].forEach.call(raiz.querySelectorAll(".nb"), function (n) { n.classList.toggle("arrastando", ligado && !!sel.ids[n.dataset.id]); });
    if (!ligado) { var ind = document.getElementById("nb-solta"); if (ind) ind.style.display = "none"; }
  }

  /* ---------- mouse: arrastar por cima de vários blocos seleciona o trecho ---------- */
  raiz.addEventListener("mousedown", function (e) {
    if (e.button !== 0) return;
    var comeco = e.target.closest && e.target.closest(".nb"); if (e.target === raiz) limpaSelecao();
    if (!comeco || e.target.closest(".nb-guia, button")) return;
    var idIni = comeco.dataset.id, ativo = false;
    function mover(m) {
      var no = document.elementFromPoint(m.clientX, m.clientY), outro = no && no.closest && no.closest(".nb");
      if (!outro || !raiz.contains(outro) || (!ativo && outro.dataset.id === idIni)) return;
      if (!ativo) { ativo = true; raiz.classList.add("arrastando-mouse"); }
      window.getSelection().removeAllRanges(); estender(outro.dataset.id, idIni);
    }
    function soltar() { document.removeEventListener("mousemove", mover); document.removeEventListener("mouseup", soltar); raiz.classList.remove("arrastando-mouse"); }
    document.addEventListener("mousemove", mover); document.addEventListener("mouseup", soltar);
  });

  /* ---------- teclado com blocos selecionados ---------- */
  raiz.addEventListener("keydown", function (e) {
    if (ehCampo(e.target)) return;  // dentro de um campo, as teclas são do próprio campo
    var mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase(), ids = selecionados();
    if (k === "escape") { if (ids.length) { e.preventDefault(); limpaSelecao(); } return; }
    if (mod && k === "a") { e.preventDefault(); var o = {}; visiveis().forEach(function (i) { o[i] = 1; }); var ord = visiveis(); sel = { ids: o, ancora: ord[0], ponta: ord[ord.length - 1] }; aplicaSelecao(); return; }
    if (!ids.length) return;
    if (k === "arrowup" || k === "arrowdown") {
      e.preventDefault(); var ordem = visiveis(), i = ordem.indexOf(sel.ponta), alvo = ordem[i + (k === "arrowup" ? -1 : 1)];
      if (!alvo) return; if (e.shiftKey) estender(alvo); else selecionarUnico(alvo);
      var n = raiz.querySelector('.nb[data-id="' + alvo + '"]'); if (n) n.scrollIntoView({ block: "nearest" }); return;
    }
    if (k === "enter" && ids.length === 1) { e.preventDefault(); var r = acha(ids[0]); if (r && TEXTO[r.b.tipo]) focaBloco(ids[0], "fim"); else focaBloco(ids[0], 0); return; }
    if (k === "backspace" || k === "delete") { e.preventDefault(); return apagar(ids); }
    if (mod && k === "d") { e.preventDefault(); return duplicar(ids); }
    if (k === "tab") { e.preventDefault(); return e.shiftKey ? desindentar(ids) : indentar(ids); }
    if (mod && e.shiftKey && /^Digit\d$/.test(e.code)) { var a = alvoDoAtalho(e.code.slice(5)); if (a) { e.preventDefault(); converterIds(ids, a); } }
  });

  /* copiar, recortar e colar blocos inteiros (a cópia vale entre abas: fica na sessão do navegador) */
  var CHAVE_COPIA = "frota:editor-blocos:copia";
  function guardaCopia(v) { try { sessionStorage.setItem(CHAVE_COPIA, JSON.stringify(v)); } catch (e) {} }
  function leCopia() { try { return JSON.parse(sessionStorage.getItem(CHAVE_COPIA) || "null"); } catch (e) { return null; } }
  function textoDe(b) { return TEXTO[b.tipo] ? b.texto : (textoDeVisual(b) || NOME_DO_TIPO[b.tipo]); }
  function copiar(e, cortar) {
    var ids = topoDos(selecionados()); if (ehCampo(e.target) || !ids.length) return;
    var escolhidos = ids.map(function (i) { return clonar(acha(i).b); }), texto = escolhidos.map(textoDe).join("\n\n");
    guardaCopia({ texto: texto, blocos: escolhidos }); e.clipboardData.setData("text/plain", texto); e.preventDefault();
    if (cortar) apagar(ids);
  }
  raiz.addEventListener("copy", function (e) { copiar(e, false); });
  raiz.addEventListener("cut", function (e) { copiar(e, true); });
  raiz.addEventListener("paste", function (e) {
    if (ehCampo(e.target)) return;
    var guardada = leCopia(), texto = e.clipboardData.getData("text/plain");
    if (!guardada || guardada.texto !== texto) return;
    e.preventDefault();
    var copias = guardada.blocos.map(duplicarBloco); if (!copias.length || total() + copias.length > MAX_TOTAL) return;
    var ids = selecionados(), ultimo = ids.length ? acha(ids[ids.length - 1]) : null;
    var lista = ultimo ? ultimo.lista : blocos, i = ultimo ? ultimo.i + 1 : lista.length;
    lista.splice.apply(lista, [i, 0].concat(copias)); estrutura(null);
    var o = {}; copias.forEach(function (c) { o[c.id] = 1; }); sel = { ids: o, ancora: copias[0].id, ponta: copias[copias.length - 1].id }; aplicaSelecao();
  });

  /* o botão "Adicionar bloco" fica fora da área do editor (as teclas de bloco não o alcançam) */
  var novo = el("button", "novo-bloco"); novo.type = "button"; novo.dataset.abreMenu = "1"; novo.setAttribute("aria-haspopup", "menu");
  novo.append(ic("plus"), document.createTextNode("Adicionar bloco"));
  novo.addEventListener("click", function () { if (H.menuAtivo()) { H.fechaMenu(); return; } menuInserir(novo, null); });
  raiz.parentNode.insertBefore(novo, raiz.nextSibling);

  render(); atualizaBotoes();
  // A altura de cada caixa depende da fonte e da largura: refaz quando a fonte termina de carregar
  // e quando o espaço muda (painel recolhido, janela redimensionada).
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(ajustaTodos);
  if (window.ResizeObserver) new ResizeObserver(function () { ajustaTodos(); }).observe(raiz);
};
