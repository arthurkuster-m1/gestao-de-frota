/* Tela Início: salto de data do calendário, anotações (editor de blocos) e informações contábeis. */
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  var ICONES = document.body.dataset.icones || "/static/icones.svg";

  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function ic(nome) {
    var s = document.createElementNS(NS, "svg"), u = document.createElementNS(NS, "use");
    s.setAttribute("class", "ic"); s.setAttribute("aria-hidden", "true"); u.setAttribute("href", ICONES + "#i-" + nome); s.appendChild(u);
    return s;
  }
  function lerJson(id, padrao) { try { return JSON.parse(document.getElementById(id).textContent); } catch (e) { return padrao; } }
  function novoId() { return "b" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  /* grava com a versão que a tela viu; 409 = outro aparelho gravou antes */
  function enviar(url, corpo, aoFim) {
    return fetch(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo), credentials: "same-origin", keepalive: aoFim === "saindo" })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, json: j }; }); });
  }

  /* ---------- calendário: salto para uma data ---------- */
  [].forEach.call(document.querySelectorAll("input[data-navega]"), function (inp) {
    inp.addEventListener("change", function () {
      if (/^\d{4}-\d{2}-\d{2}$/.test(inp.value)) location.href = inp.dataset.navega + inp.value + (inp.dataset.ancora || "");
    });
  });

  /* ---------- menu flutuante (usado pelo editor) ---------- */
  var menuAberto = null;
  function fechaMenu() { if (menuAberto) { menuAberto.remove(); menuAberto = null; } }
  document.addEventListener("mousedown", function (e) { if (menuAberto && !menuAberto.contains(e.target) && !e.target.closest("[data-abre-menu]")) fechaMenu(); });
  window.addEventListener("scroll", fechaMenu, true);
  function abreMenu(ancora, itens, aoEscolher, opcoes) {
    fechaMenu();
    var m = el("div", "menu-flutuante"); m.setAttribute("role", "menu"); menuAberto = m;
    var botoes = [];
    itens.forEach(function (it) {
      if (it === "-") { m.appendChild(el("hr")); return; }
      if (it.titulo) { m.appendChild(el("div", "titulo-menu", it.titulo)); return; }
      var b = el("button"); b.type = "button"; b.setAttribute("role", "menuitem");
      if (it.icone) b.appendChild(ic(it.icone));
      b.appendChild(el("span", "", it.rotulo)); if (it.dica) b.appendChild(el("small", "", it.dica));
      if (it.perigo) b.classList.add("perigo-item");
      b.addEventListener("mousedown", function (e) { e.preventDefault(); });
      b.addEventListener("click", function () { fechaMenu(); aoEscolher(it); });
      m.appendChild(b); botoes.push({ b: b, it: it });
    });
    document.body.appendChild(m);
    var r = ancora.getBoundingClientRect(), mw = m.offsetWidth, mh = m.offsetHeight;
    var topo = r.bottom + scrollY + 4, esq = Math.min(r.left + scrollX, scrollX + innerWidth - mw - 8);
    if (r.bottom + mh > innerHeight - 8 && r.top > mh + 8) topo = r.top + scrollY - mh - 4;
    m.style.top = topo + "px"; m.style.left = Math.max(8, esq) + "px";
    var ativo = -1;
    function marca(i) { botoes.forEach(function (x, k) { x.b.classList.toggle("ativa", k === i); }); ativo = i; if (i >= 0) botoes[i].b.scrollIntoView({ block: "nearest" }); }
    m.marcar = marca;
    m.mover = function (d) { if (botoes.length) marca((ativo + d + botoes.length) % botoes.length); };
    m.escolherAtivo = function () { if (ativo >= 0) botoes[ativo].b.click(); return ativo >= 0; };
    m.quantos = botoes.length;
    if (opcoes && opcoes.marcarPrimeiro && botoes.length) marca(0);
    return m;
  }

  /* ---------- editor de blocos das anotações ---------- */
  var TIPOS = [
    { tipo: "texto", rotulo: "Texto", icone: "list", dica: "" },
    { tipo: "titulo1", rotulo: "Título grande", icone: "list", dica: "#" },
    { tipo: "titulo2", rotulo: "Título médio", icone: "list", dica: "##" },
    { tipo: "titulo3", rotulo: "Título pequeno", icone: "list", dica: "###" },
    { tipo: "lista", rotulo: "Lista", icone: "list", dica: "-" },
    { tipo: "numerada", rotulo: "Lista numerada", icone: "list-checks", dica: "1." },
    { tipo: "tarefa", rotulo: "Lista de tarefas", icone: "check-square", dica: "[]" },
    { tipo: "destaque", rotulo: "Destaque", icone: "info", dica: "" },
    { tipo: "citacao", rotulo: "Citação", icone: "note-pencil", dica: ">" },
    { tipo: "tabela", rotulo: "Tabela", icone: "stack", dica: "" },
    { tipo: "separador", rotulo: "Divisória", icone: "arrow-right", dica: "---" }
  ];
  var ROTULO_TIPO = {}; TIPOS.forEach(function (t) { ROTULO_TIPO[t.tipo] = t.rotulo; });
  var PLACEHOLDER = { texto: "Escreva algo, ou digite / para escolher o tipo de bloco", titulo1: "Título", titulo2: "Título", titulo3: "Título", lista: "Item da lista", numerada: "Item da lista", tarefa: "Tarefa", destaque: "Destaque", citacao: "Citação" };
  var COM_TEXTO = { texto: 1, titulo1: 1, titulo2: 1, titulo3: 1, lista: 1, numerada: 1, tarefa: 1, destaque: 1, citacao: 1 };
  var DE_LISTA = { lista: 1, numerada: 1, tarefa: 1 };

  function editor() {
    var raiz = document.getElementById("editor");
    if (!raiz) return;
    var dados = lerJson("dados-anotacoes", { versao: 0, blocos: [] });
    var blocos = (dados.blocos || []).map(function (b) { return { id: b.id || novoId(), tipo: b.tipo, texto: b.texto || "", feito: !!b.feito, celulas: b.celulas || null }; });
    var versao = dados.versao || 0;
    if (!blocos.length) blocos.push({ id: novoId(), tipo: "texto", texto: "", feito: false, celulas: null });
    var estado = document.getElementById("estado-anotacoes"), aviso = document.getElementById("aviso-conflito-anotacoes");
    var sujo = false, salvando = false, pendente = false, timer = null, travado = false;

    function rotuloEstado(txt, erro) { estado.textContent = txt; estado.classList.toggle("erro", !!erro); }
    function marcaSujo() { sujo = true; rotuloEstado("Salvando…"); clearTimeout(timer); timer = setTimeout(salvar, 700); }
    function corpo() { return { versao: versao, blocos: blocos.map(function (b) { var o = { id: b.id, tipo: b.tipo, texto: COM_TEXTO[b.tipo] ? b.texto : "", feito: !!b.feito }; if (b.tipo === "tabela") o.celulas = b.celulas || [["", ""], ["", ""]]; return o; }) }; }
    function salvar(saindo) {
      if (travado || !sujo) return;
      if (salvando) { pendente = true; return; }
      salvando = true; sujo = false;
      enviar("/api/inicio/anotacoes", corpo(), saindo === "saindo" ? "saindo" : null).then(function (r) {
        salvando = false;
        if (r.status === 200) { versao = r.json.versao; rotuloEstado(sujo ? "Salvando…" : "Salvo"); if (sujo || pendente) { pendente = false; salvar(); } }
        else if (r.status === 409) { travado = true; aviso.hidden = false; rotuloEstado("Não salvo", true); }
        else { sujo = true; rotuloEstado("Erro ao salvar. Tentando de novo…", true); timer = setTimeout(salvar, 4000); }
      }).catch(function () { salvando = false; sujo = true; rotuloEstado("Sem conexão. Tentando de novo…", true); timer = setTimeout(salvar, 4000); });
    }
    document.getElementById("recarregar-anotacoes").addEventListener("click", function () { location.reload(); });
    addEventListener("pagehide", function () { if (sujo && !travado) { clearTimeout(timer); salvar("saindo"); } });
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden" && sujo && !travado) { clearTimeout(timer); salvar(); } });

    function idx(id) { for (var i = 0; i < blocos.length; i++) if (blocos[i].id === id) return i; return -1; }
    function caret(t) {
      var s = getSelection(); if (!s.rangeCount) return { ini: 0, fim: 0, colapsado: true };
      var r = s.getRangeAt(0), pre = r.cloneRange(); pre.selectNodeContents(t); pre.setEnd(r.startContainer, r.startOffset);
      var a = pre.toString().length; return { ini: a, fim: a + r.toString().length, colapsado: r.collapsed };
    }
    function poeCaret(t, pos) {
      t.focus(); var s = getSelection(), r = document.createRange(), tn = t.firstChild;
      if (!tn) { r.setStart(t, 0); } else { r.setStart(tn, Math.min(pos, tn.textContent.length)); }
      r.collapse(true); s.removeAllRanges(); s.addRange(r);
    }
    function foca(id, pos) {
      var t = raiz.querySelector('[data-id="' + id + '"] .bl-txt');
      if (t) poeCaret(t, pos == null ? t.textContent.length : pos);
      else { var c = raiz.querySelector('[data-id="' + id + '"] input'); if (c) c.focus(); }
    }
    function insere(depoisDe, bloco) { blocos.splice(depoisDe + 1, 0, bloco); }
    function novo(tipo, texto) { return { id: novoId(), tipo: tipo, texto: texto || "", feito: false, celulas: tipo === "tabela" ? [["", ""], ["", ""]] : null }; }
    function muda(i, tipo) {
      var b = blocos[i]; b.tipo = tipo;
      if (tipo === "tabela" && !b.celulas) b.celulas = [["", ""], ["", ""]];
      if (!COM_TEXTO[tipo]) b.texto = "";
    }

    function desenha(focoId, focoPos) {
      raiz.textContent = ""; var n = 0;
      blocos.forEach(function (b, i) {
        n = b.tipo === "numerada" ? n + 1 : 0;
        var bl = el("div", "bl bl-" + b.tipo + (b.feito && b.tipo === "tarefa" ? " feito" : "")); bl.dataset.id = b.id;
        var guia = el("div", "bl-guia"), mais = el("button"), alca = el("button");
        mais.type = alca.type = "button"; mais.setAttribute("aria-label", "Adicionar bloco abaixo"); alca.setAttribute("aria-label", "Opções do bloco");
        mais.dataset.abreMenu = alca.dataset.abreMenu = "1"; mais.appendChild(ic("plus")); alca.appendChild(ic("dots-six-vertical")); guia.append(mais, alca);
        mais.addEventListener("click", function () {
          var k = idx(b.id), tem = COM_TEXTO[b.tipo] && !b.texto && b.tipo === "texto";
          var alvoId = b.id;
          if (!tem) { var nb = novo("texto"); insere(k, nb); alvoId = nb.id; marcaSujo(); desenha(alvoId, 0); }
          var t = raiz.querySelector('[data-id="' + alvoId + '"] .bl-txt'); if (t) { t.focus(); escolheTipo(t, alvoId, null); }
        });
        alca.addEventListener("click", function () { opcoesDoBloco(alca, b.id); });
        var corpo = el("div", "bl-corpo");
        if (b.tipo === "separador") { corpo.appendChild(el("hr")); bl.tabIndex = 0; bl.addEventListener("keydown", function (e) { if (e.key === "Backspace" || e.key === "Delete") { e.preventDefault(); remove(b.id); } }); }
        else if (b.tipo === "tabela") corpo.appendChild(tabela(b));
        else {
          if (b.tipo === "numerada") corpo.appendChild(el("span", "num-bl", n + "."));
          if (b.tipo === "tarefa") {
            var cb = el("input"); cb.type = "checkbox"; cb.checked = !!b.feito; cb.setAttribute("aria-label", "Concluída");
            cb.addEventListener("change", function () { b.feito = cb.checked; bl.classList.toggle("feito", b.feito); marcaSujo(); }); corpo.appendChild(cb);
          }
          var t = el("div", "bl-txt"); t.contentEditable = "true"; t.setAttribute("role", "textbox"); t.setAttribute("aria-multiline", "true");
          t.dataset.ph = PLACEHOLDER[b.tipo] || ""; if (b.tipo === "texto" && blocos.length === 1) t.dataset.sempre = "1";
          t.textContent = b.texto; ligaTexto(t, b); corpo.appendChild(t);
        }
        bl.append(guia, corpo); raiz.appendChild(bl);
      });
      if (focoId) foca(focoId, focoPos);
    }

    function remove(id) {
      var i = idx(id); if (i < 0) return;
      blocos.splice(i, 1); if (!blocos.length) blocos.push(novo("texto"));
      var alvo = blocos[Math.max(0, i - 1)]; marcaSujo(); desenha(alvo.id, null);
    }
    function opcoesDoBloco(ancora, id) {
      var i = idx(id), itens = [{ titulo: "Transformar em" }];
      TIPOS.forEach(function (t) { itens.push({ rotulo: t.rotulo, acao: "tipo", tipo: t.tipo, icone: t.icone }); });
      itens.push("-", { rotulo: "Subir", acao: "subir", icone: "arrow-up" }, { rotulo: "Descer", acao: "descer", icone: "arrow-down" },
        { rotulo: "Duplicar", acao: "duplicar", icone: "copy" }, "-", { rotulo: "Excluir", acao: "excluir", icone: "trash", perigo: true });
      abreMenu(ancora, itens, function (it) {
        var k = idx(id); if (k < 0) return;
        if (it.acao === "tipo") { muda(k, it.tipo); marcaSujo(); desenha(id, null); }
        else if (it.acao === "subir" && k > 0) { var x = blocos.splice(k, 1)[0]; blocos.splice(k - 1, 0, x); marcaSujo(); desenha(id, null); }
        else if (it.acao === "descer" && k < blocos.length - 1) { var y = blocos.splice(k, 1)[0]; blocos.splice(k + 1, 0, y); marcaSujo(); desenha(id, null); }
        else if (it.acao === "duplicar") { var c = JSON.parse(JSON.stringify(blocos[k])); c.id = novoId(); blocos.splice(k + 1, 0, c); marcaSujo(); desenha(c.id, null); }
        else if (it.acao === "excluir") remove(id);
      });
    }

    /* menu "/" : escolher o tipo do bloco digitando */
    function escolheTipo(t, id, filtro) {
      var lista = TIPOS.filter(function (x) { return !filtro || x.rotulo.toLowerCase().indexOf(filtro.toLowerCase()) >= 0; });
      if (!lista.length) { fechaMenu(); return; }
      var m = abreMenu(t, lista.map(function (x) { return { rotulo: x.rotulo, dica: x.dica, tipo: x.tipo, icone: x.icone }; }), function (it) {
        var k = idx(id); if (k < 0) return; muda(k, it.tipo); blocos[k].texto = ""; marcaSujo();
        if (it.tipo === "separador") { var nb = novo("texto"); insere(k, nb); desenha(nb.id, 0); } else desenha(id, 0);
      }, { marcarPrimeiro: true });
      m.dataset.slash = "1";
    }

    function ligaTexto(t, b) {
      t.addEventListener("input", function () {
        var txt = t.textContent; b.texto = txt;
        var k = idx(b.id), atalho = [[/^### $/, "titulo3"], [/^## $/, "titulo2"], [/^# $/, "titulo1"], [/^[-*] $/, "lista"], [/^1\. $/, "numerada"], [/^\[\] $/, "tarefa"], [/^> $/, "citacao"]];
        if (b.tipo === "texto") {
          for (var j = 0; j < atalho.length; j++) if (atalho[j][0].test(txt.replace(/ /g, " "))) { muda(k, atalho[j][1]); blocos[k].texto = ""; marcaSujo(); desenha(b.id, 0); return; }
          if (txt === "---") { muda(k, "separador"); var nb = novo("texto"); insere(k, nb); marcaSujo(); desenha(nb.id, 0); return; }
        }
        if (txt.charAt(0) === "/" && txt.indexOf(" ") < 0 && txt.indexOf("\n") < 0 && b.tipo === "texto") escolheTipo(t, b.id, txt.slice(1)); else if (menuAberto && menuAberto.dataset.slash) fechaMenu();
        marcaSujo();
      });
      t.addEventListener("paste", function (e) {
        e.preventDefault(); var texto = (e.clipboardData || window.clipboardData).getData("text/plain").replace(/\r/g, "");
        var linhas = texto.split("\n").filter(function (l, i, a) { return !(l === "" && i === a.length - 1); });
        if (linhas.length <= 1) { document.execCommand("insertText", false, texto); return; }
        var k = idx(b.id), c = caret(t), antes = b.texto.slice(0, c.ini), depois = b.texto.slice(c.fim);
        b.texto = antes + linhas[0]; var ult = k, tipo = DE_LISTA[b.tipo] ? b.tipo : "texto";
        for (var i = 1; i < linhas.length; i++) { var nb = novo(tipo, linhas[i] + (i === linhas.length - 1 ? depois : "")); insere(ult, nb); ult++; }
        if (linhas.length === 1) b.texto += depois;
        marcaSujo(); desenha(blocos[ult].id, blocos[ult].texto.length - depois.length);
      });
      t.addEventListener("keydown", function (e) {
        var k = idx(b.id), c = caret(t);
        if (menuAberto && menuAberto.dataset.slash) {
          if (e.key === "ArrowDown") { e.preventDefault(); menuAberto.mover(1); return; }
          if (e.key === "ArrowUp") { e.preventDefault(); menuAberto.mover(-1); return; }
          if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); if (menuAberto.escolherAtivo()) return; }
          if (e.key === "Escape") { e.preventDefault(); fechaMenu(); return; }
        }
        if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
          e.preventDefault();
          if (DE_LISTA[b.tipo] && !b.texto) { muda(k, "texto"); marcaSujo(); desenha(b.id, 0); return; }
          var resto = b.texto.slice(c.fim); b.texto = b.texto.slice(0, c.ini);
          var tipo = DE_LISTA[b.tipo] ? b.tipo : "texto", nb = novo(tipo, resto); insere(k, nb); marcaSujo(); desenha(nb.id, 0);
        } else if (e.key === "Enter" && e.shiftKey) {
          e.preventDefault(); document.execCommand("insertText", false, "\n");
        } else if (e.key === "Backspace" && c.colapsado && c.ini === 0) {
          if (b.tipo !== "texto") { e.preventDefault(); muda(k, "texto"); marcaSujo(); desenha(b.id, 0); }
          else if (k > 0) {
            e.preventDefault(); var ant = blocos[k - 1];
            if (COM_TEXTO[ant.tipo]) { var pos = ant.texto.length; ant.texto += b.texto; blocos.splice(k, 1); marcaSujo(); desenha(ant.id, pos); }
            else if (ant.tipo === "separador") { blocos.splice(k - 1, 1); marcaSujo(); desenha(b.id, 0); }
          }
        } else if (e.key === "ArrowUp" && c.colapsado && c.ini === 0 && k > 0) { e.preventDefault(); foca(blocos[k - 1].id, null); }
        else if (e.key === "ArrowDown" && c.colapsado && c.fim === b.texto.length && k < blocos.length - 1) { e.preventDefault(); foca(blocos[k + 1].id, 0); }
      });
    }

    function tabela(b) {
      var cel = b.celulas || (b.celulas = [["", ""], ["", ""]]), wrap = el("div"), tb = el("table"), corpo = el("tbody");
      var larg = cel[0].length;
      var xs = el("tr"); for (var j = 0; j < larg; j++) { (function (jj) { var td = el("td"), x = el("button", "tb-x", "×"); x.type = "button"; x.setAttribute("aria-label", "Remover coluna"); x.addEventListener("click", function () { if (larg > 1) { cel.forEach(function (l) { l.splice(jj, 1); }); marcaSujo(); desenha(b.id, null); } }); td.appendChild(x); xs.appendChild(td); })(j); }
      xs.appendChild(el("td")); corpo.appendChild(xs);
      cel.forEach(function (linha, i) {
        var tr = el("tr");
        linha.forEach(function (v, j) { var td = el("td"), inp = el("input"); inp.value = v; inp.setAttribute("aria-label", "Linha " + (i + 1) + ", coluna " + (j + 1)); inp.addEventListener("input", function () { cel[i][j] = inp.value; marcaSujo(); }); td.appendChild(inp); tr.appendChild(td); });
        var tdx = el("td"), x = el("button", "tb-x", "×"); x.type = "button"; x.setAttribute("aria-label", "Remover linha"); x.addEventListener("click", function () { if (cel.length > 1) { cel.splice(i, 1); marcaSujo(); desenha(b.id, null); } }); tdx.appendChild(x); tr.appendChild(tdx);
        corpo.appendChild(tr);
      });
      tb.appendChild(corpo); wrap.appendChild(tb);
      var ac = el("div", "tb-acoes"), addL = el("button", "sec pequeno", "+ Linha"), addC = el("button", "sec pequeno", "+ Coluna");
      addL.type = addC.type = "button";
      addL.addEventListener("click", function () { cel.push(new Array(larg).fill("")); marcaSujo(); desenha(b.id, null); });
      addC.addEventListener("click", function () { if (larg < 10) { cel.forEach(function (l) { l.push(""); }); marcaSujo(); desenha(b.id, null); } });
      ac.append(addL, addC); wrap.appendChild(ac); return wrap;
    }
    desenha(null);
  }

  /* ---------- informações contábeis ---------- */
  var SUGESTOES = ["Razão social", "CNPJ", "Inscrição estadual", "Endereço fiscal", "Banco", "Agência", "Conta", "Chave PIX", "E-mail financeiro", "Contador"];
  function infos() {
    var corpo = document.getElementById("corpo-infos"); if (!corpo) return;
    var dados = lerJson("dados-infos", { versao: 0, itens: [] }), versao = dados.versao || 0;
    var itens = (dados.itens || []).map(function (x) { return { rotulo: x.rotulo || "", valor: x.valor || "" }; }), rascunho = null;
    var btnEditar = document.getElementById("editar-infos"), aviso = document.getElementById("aviso-conflito-infos"), painel = document.getElementById("infos");
    var grade = document.getElementById("notas-grade"), alterna = document.getElementById("alternar-infos");
    document.getElementById("recarregar-infos").addEventListener("click", function () { location.reload(); });

    function copia(texto, btn) {
      var ok = function () { var a = btn.textContent; btn.textContent = "Copiado"; setTimeout(function () { btn.textContent = a; }, 1200); };
      try { navigator.clipboard.writeText(texto).then(ok, function () { sel(); }); } catch (e) { sel(); }
      function sel() { var r = document.createRange(); r.selectNodeContents(btn.closest("dd").firstChild); getSelection().removeAllRanges(); getSelection().addRange(r); }
    }
    function ver() {
      corpo.textContent = ""; rascunho = null; btnEditar.textContent = "Editar"; btnEditar.className = "sec pequeno";
      var preenchidos = itens.filter(function (x) { return x.rotulo || x.valor; });
      if (!preenchidos.length) {
        var v = el("div", "vazio"); v.append(ic("receipt"), el("b", "", "Nada guardado ainda"), el("p", "", "Razão social, CNPJ, dados bancários e outras informações fixas ficam aqui. Aperte Editar para preencher."));
        corpo.appendChild(v); return;
      }
      var dl = el("dl", "info-lista");
      preenchidos.forEach(function (x) {
        var d = el("div", "info-item"), dd = el("dd"), cp = el("button", "fantasma pequeno", "Copiar"); cp.type = "button";
        cp.setAttribute("aria-label", "Copiar " + x.rotulo); cp.addEventListener("click", function () { copia(x.valor, cp); });
        dd.append(document.createTextNode(x.valor || "—"), cp); d.append(el("dt", "", x.rotulo || "Sem nome"), dd); dl.appendChild(d);
      });
      corpo.appendChild(dl);
    }
    function editar() {
      if (!rascunho) rascunho = itens.map(function (x) { return { rotulo: x.rotulo, valor: x.valor }; });
      btnEditar.textContent = "Cancelar"; btnEditar.className = "fantasma pequeno";
      corpo.textContent = ""; var f = el("div", "info-edicao");
      rascunho.forEach(function (x, i) {
        var l = el("div", "linha-edicao"), r = el("input"), v = el("input", "valor-ed"), rm = el("button", "fantasma icone-so pequeno"); rm.type = "button";
        r.placeholder = "Nome (ex.: CNPJ)"; r.value = x.rotulo; r.maxLength = 80; r.setAttribute("aria-label", "Nome do campo " + (i + 1));
        v.placeholder = "Valor"; v.value = x.valor; v.maxLength = 600; v.setAttribute("aria-label", "Valor do campo " + (i + 1));
        rm.setAttribute("aria-label", "Remover campo"); rm.appendChild(ic("trash"));
        r.addEventListener("input", function () { x.rotulo = r.value; }); v.addEventListener("input", function () { x.valor = v.value; });
        rm.addEventListener("click", function () { rascunho.splice(i, 1); editar(); });
        l.append(r, rm, v); f.appendChild(l);
      });
      var sug = el("div", "sugestoes"), usados = rascunho.map(function (x) { return x.rotulo.toLowerCase(); });
      SUGESTOES.filter(function (s) { return usados.indexOf(s.toLowerCase()) < 0; }).forEach(function (s) {
        var b = el("button", "sec", "+ " + s); b.type = "button"; b.addEventListener("click", function () { rascunho.push({ rotulo: s, valor: "" }); editar(); var ins = corpo.querySelectorAll(".valor-ed"); ins[ins.length - 1].focus(); }); sug.appendChild(b);
      });
      var vazio = el("button", "sec", "+ Campo em branco"); vazio.type = "button"; vazio.addEventListener("click", function () { rascunho.push({ rotulo: "", valor: "" }); editar(); var ins = corpo.querySelectorAll(".linha-edicao input:first-child"); ins[ins.length - 1].focus(); }); sug.appendChild(vazio);
      var acoes = el("div", "acoes"), salvar = el("button", "", "Salvar"), msg = el("span", "caption"); salvar.type = "button";
      salvar.addEventListener("click", function () {
        var limpo = rascunho.filter(function (x) { return x.rotulo.trim() || x.valor.trim(); }).map(function (x) { return { rotulo: x.rotulo.trim(), valor: x.valor.trim() }; });
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
    }
    btnEditar.addEventListener("click", function () { if (rascunho) ver(); else editar(); });

    var recolhido = false; try { recolhido = localStorage.getItem("frota-infos-recolhido") === "1"; } catch (e) {}
    function aplicaRecolhimento() {
      painel.classList.toggle("fechado", recolhido); grade.classList.toggle("recolhido", recolhido);
      alterna.setAttribute("aria-expanded", recolhido ? "false" : "true"); alterna.setAttribute("aria-label", recolhido ? "Abrir painel" : "Recolher painel");
    }
    alterna.addEventListener("click", function () { recolhido = !recolhido; try { localStorage.setItem("frota-infos-recolhido", recolhido ? "1" : "0"); } catch (e) {} aplicaRecolhimento(); });
    aplicaRecolhimento(); ver();
  }

  editor(); infos();
})();
