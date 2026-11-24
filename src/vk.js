(function () {
  // VK Mini Apps: гасим нативный лоадер (иконка + спиннер),
  // иначе висит "бесконечная загрузка" как на скрине.
  // Работает и вне ВК (просто ничего не делает).
  function init() {
    try {
      const b = window.vkBridge;
      if (b && b.send) {
        b.send("VKWebAppInit").catch(function () {});
        try { b.send("VKWebAppExpand"); } catch (e) {}
        return true;
      }
    } catch (e) {}
    return false;
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
  // библиотека грузится асинхронно — повторяем после её появления
  let tries = 0;
  const t = setInterval(function () {
    if (init() || ++tries > 20) clearInterval(t);
  }, 500);
})();
