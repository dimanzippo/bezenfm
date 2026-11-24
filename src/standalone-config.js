// ─── Standalone-сборка (свой хостинг / GitHub Pages) ───
// Зеркало настроек из main.pjs. В генераторе Perchance этот файл НЕ
// подключается (там настройки читаются из main.pjs), он нужен только
// в статической сборке (scratch/bezenfm-site/), где движка Perchance нет.
// При смене настроек в main.pjs — продублируйте их здесь и пересоберите zip.
//
// ВАЖНО: http-поток здесь убран сознательно — со страницы на https браузер
// блокирует http-аудио как mixed content. Остались только https-зеркала
// и резервный поток. Названия треков читаются напрямую (без прокси),
// поэтому нужен CORS на стороне ретрансляции; если его нет — в плеере
// просто показываются слоганы, звук при этом играет как обычно.

window.stationName = "BEZEN FM";
window.stationTagline = "Первая радиостанция Безенчука";
window.cityName = "Безенчук";
window.regionName = "Самарская область";

window.streamUrls = [
  "https://new.vobook.ru/http://bezenfm.ddns.net:8000/",
  "https://new.vobook.ru/http://bezenfm.ddns.net:8001/",
];
window.backupStreamUrl = "https://radiorecord.hostingradio.ru/200096.aacp";

window.donateKey = "b277c9ec10315a569eb8";
window.donateCount = "20";
window.donateRefreshMs = "60000";
window.donateUrl = "https://api.vkdonate.ru";
window.donateAppUrl = "https://vk.ru/app6471849_-217508772";

// Прямой fetch вместо superFetch-прокси Perchance.
// Работает для хостов с CORS (vobook, vkdonate, record).
// Возвращает тот же Response, что обычный fetch.
window.superFetch = function (url, opts) {
  opts = opts || {};
  const init = { cache: "no-store" };
  if (opts.signal) init.signal = opts.signal;
  if (opts.headers) init.headers = opts.headers;
  return fetch(url, init);
};
