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
    if (!m.mover) { if (k === "Escape") { e.preventDefault(); e.stopPropagation(); fechaMenu(); } return; }  // menu livre: só Esc
    if (k === "ArrowDown" || k === "ArrowUp" || (m.classList.contains("grade") && (k === "ArrowRight" || k === "ArrowLeft"))) {
      e.preventDefault(); e.stopPropagation(); m.mover(k === "ArrowDown" || k === "ArrowRight" ? 1 : -1);
    } else if (k === "Enter" || k === "Tab") {
      if (m.ativo >= 0) { e.preventDefault(); e.stopPropagation(); m.escolherAtivo(); }
    } else if (k === "Escape") { e.preventDefault(); e.stopPropagation(); fechaMenu(); }
  }, true);

  function posicionaMenu(m, ancora) {
    // clicar, rolar ou arrastar a barra do menu não tira o cursor do texto de onde se digitava
    m.addEventListener("mousedown", function (e) { e.preventDefault(); });
    document.body.appendChild(m);
    var r = ancora.getBoundingClientRect(), mw = m.offsetWidth, mh = m.offsetHeight;
    var topo = r.bottom + scrollY + 6, esq = Math.min(r.left + scrollX, scrollX + innerWidth - mw - 8);
    if (r.bottom + mh > innerHeight - 8 && r.top > mh + 8) topo = r.top + scrollY - mh - 6;
    m.style.top = Math.max(8, topo) + "px"; m.style.left = Math.max(8, esq) + "px";
  }
  // menu com conteúdo próprio (botões de ajuste, seções…); fecha com Esc ou clicando fora
  function abreMenuLivre(ancora, preencher, aoFechar) {
    fechaMenu();
    var m = el("div", "menu-flutuante livre"); m.setAttribute("role", "menu"); menuAberto = m;
    var remove = m.remove.bind(m); m.remove = function () { remove(); if (aoFechar) aoFechar(); };
    preencher(m, fechaMenu); posicionaMenu(m, ancora);
    return m;
  }
  function abreMenu(ancora, itens, aoEscolher, opcoes) {
    opcoes = opcoes || {}; fechaMenu();
    var m = el("div", "menu-flutuante" + (opcoes.grade ? " grade" : "")); m.setAttribute("role", "menu"); menuAberto = m;
    var botoes = [];
    itens.forEach(function (it) {
      if (it === "-") { m.appendChild(el("hr")); return; }
      if (it.titulo) { m.appendChild(el("div", "titulo-menu", it.titulo)); return; }
      var b = el("button"); b.type = "button"; b.setAttribute("role", "menuitem");
      if (it.glifo) b.appendChild(el("span", "glifo", it.glifo)); else if (it.icone) b.appendChild(ic(it.icone));
      var tx = el("span", "txt"); tx.appendChild(el("span", "", it.rotulo)); if (it.dica) tx.appendChild(el("small", "", it.dica)); b.appendChild(tx);
      if (it.perigo) b.classList.add("perigo-item");
      if (it.atual) b.classList.add("atual");
      b.addEventListener("mouseenter", function () { marca(botoes.length ? botoes.map(function (x) { return x.b; }).indexOf(b) : -1, true); });
      b.addEventListener("click", function () { fechaMenu(); aoEscolher(it); });
      m.appendChild(b); botoes.push({ b: b, it: it });
    });
    if (!botoes.length) m.appendChild(el("div", "vazio-menu", "Nenhum tipo encontrado"));
    posicionaMenu(m, ancora);
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

  infos();
  if (window.frotaEditor) window.frotaEditor({ el: el, ic: ic, lerJson: lerJson, novoId: novoId, clonar: clonar, enviar: enviar, abreMenu: abreMenu, abreMenuLivre: abreMenuLivre, fechaMenu: fechaMenu, menuAtivo: function () { return menuAberto; } });
})();
