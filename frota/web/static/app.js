(function () {
  var b = document.body;
  function gaveta(abrir) { b.classList.toggle("gaveta", abrir); }
  var abrir = document.getElementById("abrir-menu"), fundo = document.getElementById("fundo-gaveta");
  if (abrir) abrir.addEventListener("click", function () { gaveta(true); });
  if (fundo) fundo.addEventListener("click", function () { gaveta(false); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") gaveta(false); });

  // Tema: segue o sistema; o botão força um dos dois e lembra a escolha no navegador.
  var tema = document.getElementById("tema");
  if (tema) tema.addEventListener("click", function () {
    var el = document.documentElement, atual = el.dataset.theme ||
      (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    var novo = atual === "dark" ? "light" : "dark";
    el.dataset.theme = novo;
    try { localStorage.setItem("frota-tema", novo); } catch (e) {}
  });
})();
