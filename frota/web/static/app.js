(function () {
  var NS = "http://www.w3.org/2000/svg";
  var body = document.body;
  var ICONES = body.dataset.icones || "/static/icones.svg";

  /* ---------- menu, gaveta e tema ---------- */
  function gaveta(abrir) { body.classList.toggle("gaveta", abrir); }
  var abrir = document.getElementById("abrir-menu"), fundo = document.getElementById("fundo-gaveta");
  if (abrir) abrir.addEventListener("click", function () { gaveta(true); });
  if (fundo) fundo.addEventListener("click", function () { gaveta(false); });
  var tema = document.getElementById("tema");
  if (tema) tema.addEventListener("click", function () {
    var el = document.documentElement, atual = el.dataset.theme ||
      (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    var novo = atual === "dark" ? "light" : "dark";
    el.dataset.theme = novo;
    try { localStorage.setItem("frota-tema", novo); } catch (e) {}
  });

  /* ---------- peças ---------- */
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function ic(nome) {
    var s = document.createElementNS(NS, "svg"), u = document.createElementNS(NS, "use");
    s.setAttribute("class", "ic"); s.setAttribute("aria-hidden", "true");
    u.setAttribute("href", ICONES + "#i-" + nome); s.appendChild(u);
    return s;
  }
  var aberto = null;  // só um seletor aberto por vez: { fechar: fn, raiz: el }
  function fechaOutros(exceto) { if (aberto && aberto !== exceto) aberto.fechar(); }
  function abreParaCima(pop, raiz) {
    pop.classList.remove("acima");
    var r = pop.getBoundingClientRect(), rr = raiz.getBoundingClientRect();
    if (r.bottom > innerHeight - 8 && rr.top > r.height + 16) pop.classList.add("acima");
  }
  document.addEventListener("mousedown", function (e) { if (aberto && !aberto.raiz.contains(e.target)) aberto.fechar(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") { gaveta(false); if (aberto) aberto.fechar(); } });

  /* ---------- seletor de lista: troca o <select> do sistema ---------- */
  function seletor(sel) {
    if (sel.multiple || sel.closest(".sel") || sel.dataset.nativo !== undefined) return;
    var raiz = el("div", "sel");
    if (sel.style.width) raiz.style.width = sel.style.width;
    if (sel.classList.contains("cresce")) raiz.classList.add("cresce");
    sel.parentNode.insertBefore(raiz, sel); raiz.appendChild(sel);
    sel.classList.add("sel-nativo"); sel.tabIndex = -1; sel.setAttribute("aria-hidden", "true");

    var btn = el("button", "sel-btn"), txt = el("span", "sel-txt"), lista = el("ul", "sel-lista");
    btn.type = "button"; btn.setAttribute("aria-haspopup", "listbox"); btn.setAttribute("aria-expanded", "false");
    if (sel.getAttribute("aria-label")) btn.setAttribute("aria-label", sel.getAttribute("aria-label"));
    if (sel.id) { var lab = document.querySelector('label[for="' + sel.id + '"]'); if (lab) lab.addEventListener("click", function () { btn.focus(); }); }
    btn.append(txt, ic("caret-down"));
    lista.setAttribute("role", "listbox"); lista.hidden = true;
    var base = "sel-" + Math.random().toString(36).slice(2, 8);
    lista.id = base; btn.setAttribute("aria-controls", base);
    raiz.append(btn, lista);

    var ops = [], ativa = -1, busca = "", tBusca;
    [].forEach.call(sel.options, function (o, i) {
      var li = el("li", "sel-op"); li.setAttribute("role", "option"); li.id = base + "-" + i;
      li.append(el("span", "", o.text), ic("check"));
      if (o.disabled) li.setAttribute("aria-disabled", "true");
      li.addEventListener("mousedown", function (e) { e.preventDefault(); });
      li.addEventListener("mousemove", function () { marca(i); });
      li.addEventListener("click", function () { if (!o.disabled) escolhe(i); });
      lista.appendChild(li); ops.push(li);
    });
    function atualiza() {
      var i = sel.selectedIndex;
      txt.textContent = i >= 0 ? sel.options[i].text : "";
      ops.forEach(function (li, k) { li.setAttribute("aria-selected", k === i ? "true" : "false"); });
      btn.disabled = sel.disabled;
    }
    function marca(i) {
      if (ativa >= 0) ops[ativa].classList.remove("ativa");
      ativa = i;
      if (i >= 0) { ops[i].classList.add("ativa"); btn.setAttribute("aria-activedescendant", ops[i].id); ops[i].scrollIntoView({ block: "nearest" }); }
      else btn.removeAttribute("aria-activedescendant");
    }
    function proxima(de, passo) {
      for (var i = de + passo; i >= 0 && i < ops.length; i += passo) if (!sel.options[i].disabled) return i;
      return de;
    }
    function escolhe(i) {
      sel.selectedIndex = i; atualiza(); fecha(true);
      sel.dispatchEvent(new Event("input", { bubbles: true })); sel.dispatchEvent(new Event("change", { bubbles: true }));
    }
    var handle = { raiz: raiz, fechar: function () { fecha(false); } };
    function abre() {
      if (btn.disabled) return;
      fechaOutros(handle); lista.hidden = false; btn.setAttribute("aria-expanded", "true");
      abreParaCima(lista, raiz); aberto = handle; marca(sel.selectedIndex);
    }
    function fecha(foco) {
      lista.hidden = true; btn.setAttribute("aria-expanded", "false"); marca(-1);
      if (aberto === handle) aberto = null; if (foco) btn.focus();
    }
    btn.addEventListener("click", function () { lista.hidden ? abre() : fecha(false); });
    btn.addEventListener("keydown", function (e) {
      var k = e.key, open = !lista.hidden;
      if (k === "ArrowDown" || k === "ArrowUp") {
        e.preventDefault(); if (!open) { abre(); return; }
        marca(proxima(ativa < 0 ? sel.selectedIndex : ativa, k === "ArrowDown" ? 1 : -1));
      } else if (k === "Home" || k === "End") {
        if (open) { e.preventDefault(); marca(k === "Home" ? proxima(-1, 1) : proxima(ops.length, -1)); }
      } else if (k === "Enter" || k === " ") {
        if (open && ativa >= 0) { e.preventDefault(); escolhe(ativa); } else if (!open) { e.preventDefault(); abre(); }
      } else if (k === "Tab") { if (open) fecha(false); }
      else if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        busca += k.toLowerCase(); clearTimeout(tBusca); tBusca = setTimeout(function () { busca = ""; }, 600);
        for (var i = 0; i < ops.length; i++) if (!sel.options[i].disabled && sel.options[i].text.toLowerCase().indexOf(busca) === 0) {
          if (!open) abre(); marca(i); break;
        }
      }
    });
    sel.addEventListener("change", atualiza);
    if (sel.form) sel.form.addEventListener("reset", function () { setTimeout(atualiza, 0); });
    atualiza();
  }

  /* ---------- campo de data (dd/mm/aaaa) com calendário em português ---------- */
  var MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  var SEM = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  function iso(d) { return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function doIso(t) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t || ""); return m ? new Date(+m[1], m[2] - 1, +m[3]) : null; }
  function br(d) { return ("0" + d.getDate()).slice(-2) + "/" + ("0" + (d.getMonth() + 1)).slice(-2) + "/" + d.getFullYear(); }
  function doBr(t) {
    var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t); if (!m) return null;
    var d = new Date(+m[3], m[2] - 1, +m[1]);
    return d.getMonth() === m[2] - 1 && d.getDate() === +m[1] ? d : null;
  }
  function data(inp) {
    if (inp.closest(".data") || inp.dataset.nativo !== undefined) return;
    var raiz = el("div", "data"), campo = el("div", "data-campo"), txt = el("input"), bt = el("button", "data-bt");
    if (inp.style.width) raiz.style.width = inp.style.width;
    inp.parentNode.insertBefore(raiz, inp); raiz.appendChild(inp); inp.type = "hidden";
    txt.type = "text"; txt.inputMode = "numeric"; txt.placeholder = "dd/mm/aaaa"; txt.maxLength = 10; txt.autocomplete = "off";
    if (inp.getAttribute("aria-label")) txt.setAttribute("aria-label", inp.getAttribute("aria-label"));
    if (inp.id) { txt.id = inp.id + "-texto"; var lab = document.querySelector('label[for="' + inp.id + '"]'); if (lab) lab.htmlFor = txt.id; }
    bt.type = "button"; bt.setAttribute("aria-label", "Abrir calendário"); bt.setAttribute("aria-haspopup", "dialog"); bt.appendChild(ic("calendar-blank"));
    campo.append(txt, bt); raiz.insertBefore(campo, inp);
    var cal = null, mostrado = null, foco = null;

    function define(d, fechar) {
      inp.value = d ? iso(d) : ""; txt.value = d ? br(d) : ""; campo.removeAttribute("aria-invalid");
      inp.dispatchEvent(new Event("change", { bubbles: true }));
      if (fechar) fecha(true);
    }
    function mostraAtual() { var d = doIso(inp.value); txt.value = d ? br(d) : ""; }
    txt.addEventListener("input", function () {
      var v = txt.value.replace(/\D/g, "").slice(0, 8);
      if (v.length > 4) v = v.slice(0, 2) + "/" + v.slice(2, 4) + "/" + v.slice(4);
      else if (v.length > 2) v = v.slice(0, 2) + "/" + v.slice(2);
      txt.value = v;
      if (v.length === 10) { var d = doBr(v); if (d) define(d, false); else campo.setAttribute("aria-invalid", "true"); }
      else { campo.removeAttribute("aria-invalid"); if (v === "") { inp.value = ""; inp.dispatchEvent(new Event("change", { bubbles: true })); } }
    });
    txt.addEventListener("blur", function () { if (txt.value && txt.value.length < 10) campo.setAttribute("aria-invalid", "true"); });

    function desenha() {
      cal.textContent = "";
      var topo = el("div", "cal-topo"), ant = el("button", "cal-nav"), prox = el("button", "cal-nav");
      ant.type = prox.type = "button"; ant.setAttribute("aria-label", "Mês anterior"); prox.setAttribute("aria-label", "Próximo mês");
      ant.appendChild(ic("caret-left")); prox.appendChild(ic("caret-right"));
      ant.onclick = function () { mostrado = new Date(mostrado.getFullYear(), mostrado.getMonth() - 1, 1); foco = null; desenha(); };
      prox.onclick = function () { mostrado = new Date(mostrado.getFullYear(), mostrado.getMonth() + 1, 1); foco = null; desenha(); };
      var nomeMes = MESES[mostrado.getMonth()];
      topo.append(ant, el("b", "", nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1) + " de " + mostrado.getFullYear()), prox);
      var sem = el("div", "cal-sem"); SEM.forEach(function (s) { sem.appendChild(el("span", "", s)); });
      var dias = el("div", "cal-dias"), sel = doIso(inp.value), hoje = new Date();
      var ini = new Date(mostrado.getFullYear(), mostrado.getMonth(), 1 - new Date(mostrado.getFullYear(), mostrado.getMonth(), 1).getDay());
      var alvo = foco || sel || (hoje.getMonth() === mostrado.getMonth() && hoje.getFullYear() === mostrado.getFullYear() ? hoje : new Date(mostrado.getFullYear(), mostrado.getMonth(), 1));
      for (var i = 0; i < 42; i++) {
        var d = new Date(ini.getFullYear(), ini.getMonth(), ini.getDate() + i), b = el("button", "cal-dia", String(d.getDate()));
        b.type = "button"; b.dataset.iso = iso(d); b.tabIndex = iso(d) === iso(alvo) ? 0 : -1;
        if (d.getMonth() !== mostrado.getMonth()) b.classList.add("fora");
        if (iso(d) === iso(hoje)) b.classList.add("hoje");
        if (sel && iso(d) === iso(sel)) { b.classList.add("sel"); b.setAttribute("aria-pressed", "true"); }
        b.setAttribute("aria-label", d.getDate() + " de " + MESES[d.getMonth()] + " de " + d.getFullYear());
        (function (dd) { b.onclick = function () { define(dd, true); }; })(d);
        dias.appendChild(b);
      }
      dias.addEventListener("keydown", function (e) {
        var passo = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
        if (!passo) return;
        e.preventDefault();
        var atual = doIso(document.activeElement.dataset.iso) || alvo, novo = new Date(atual.getFullYear(), atual.getMonth(), atual.getDate() + passo);
        foco = novo; mostrado = new Date(novo.getFullYear(), novo.getMonth(), 1); desenha();
        var f = cal.querySelector('[data-iso="' + iso(novo) + '"]'); if (f) f.focus();
      });
      var pe = el("div", "cal-pe"), limpa = el("button", "", "Limpar"), hj = el("button", "", "Hoje");
      limpa.type = hj.type = "button"; limpa.onclick = function () { define(null, true); }; hj.onclick = function () { define(new Date(), true); };
      pe.append(limpa, hj); cal.append(topo, sem, dias, pe);
    }
    var handle = { raiz: raiz, fechar: function () { fecha(false); } };
    function abre() {
      fechaOutros(handle);
      cal = el("div", "cal"); cal.setAttribute("role", "dialog"); cal.setAttribute("aria-label", "Escolher data");
      var d = doIso(inp.value) || new Date(); mostrado = new Date(d.getFullYear(), d.getMonth(), 1); foco = null;
      raiz.appendChild(cal); desenha(); abreParaCima(cal, raiz); aberto = handle;
      bt.setAttribute("aria-expanded", "true");
      var f = cal.querySelector('.cal-dia[tabindex="0"]'); if (f) f.focus();
    }
    function fecha(volta) {
      if (cal) { cal.remove(); cal = null; }
      bt.setAttribute("aria-expanded", "false"); if (aberto === handle) aberto = null; if (volta) bt.focus();
    }
    bt.addEventListener("click", function () { cal ? fecha(false) : abre(); });
    mostraAtual();
    if (inp.form) inp.form.addEventListener("reset", function () { setTimeout(mostraAtual, 0); });
  }

  function melhora(raiz) {
    [].forEach.call((raiz || document).querySelectorAll("select"), seletor);
    [].forEach.call((raiz || document).querySelectorAll('input[type="date"]'), data);
  }
  window.frotaUI = { melhora: melhora };
  melhora();
})();
