// Запасной способ обновить десерты, если GitHub Actions упирается в капчу.
// 1. Открой https://gustobakery.ru/deserty в своём браузере и дождись загрузки.
// 2. Открой консоль (F12 → Console), вставь этот код и нажми Enter.
// 3. JSON скопируется в буфер — вставь его в gusto/desserts.json на GitHub
//    (кнопка ✏️ «Edit this file» → вставить → Commit changes).
(() => {
  const clean = s => (s ?? "").replace(/\s+/g, " ").trim();
  const items = [...document.querySelectorAll("article")].map(a => {
    const img = a.querySelector("img");
    const name = clean(a.querySelector("h3")?.textContent);
    if (!img?.src || !name) return null;
    const [description, nutrition] = clean(a.querySelector("main")?.textContent).split(/\s*(?=Ккал\s*:)/i);
    const price = clean(a.querySelector("footer")?.textContent).match(/(\d[\d\s]*)\s*₽/)?.[1];
    return {
      name,
      image: img.src,
      url: a.querySelector("a[href]")?.href ?? location.href,
      weight: clean(a.querySelector("header .text-xs")?.textContent) || undefined,
      price: price ? `${price.trim().replace(/\s+/g, " ")} ₽` : undefined,
      description: description || undefined,
      nutrition: nutrition || undefined,
    };
  }).filter(Boolean);
  const json = JSON.stringify({ source: location.href, updated: new Date().toISOString(), items }, null, 2);
  copy(json);
  console.log(`Скопировано десертов: ${items.length}`);
})();
