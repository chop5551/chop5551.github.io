// Собирает актуальный список десертов с gustobakery.ru в gusto/desserts.json.
// Запускается GitHub Actions по расписанию (см. .github/workflows/update-desserts.yml).
// Локально: node scripts/update-desserts.mjs [файл.html]
import { readFile, writeFile } from "node:fs/promises";

const SOURCE = "https://gustobakery.ru/deserty";
const OUT = new URL("../gusto/desserts.json", import.meta.url);

const decode = s => s
  .replace(/&nbsp;/g, " ")
  .replace(/&amp;/g, "&")
  .replace(/&quot;/g, '"')
  .replace(/&#x27;|&#39;/g, "'")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n));

const text = html => decode(html.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
const first = (re, s) => s.match(re)?.[1];

export function parse(html) {
  const items = [];
  const seen = new Set();

  for (const [, block] of html.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/g)) {
    const image = first(/<img\b[^>]*\bsrc="([^"]+)"/, block);
    const href = first(/<a\b[^>]*\bhref="([^"]+)"/, block);
    const name = text(first(/<h3\b[^>]*>([\s\S]*?)<\/h3>/, block) ?? "");
    if (!image || !name || seen.has(image)) continue;
    seen.add(image);

    const header = first(/<header\b[^>]*>([\s\S]*?)<\/header>/, block) ?? "";
    const weight = text(first(/<div class="text-xs">([\s\S]*?)<\/div>/, header) ?? "");
    const about = text(first(/<main\b[^>]*>([\s\S]*?)<\/main>/, block) ?? "");
    const [description, nutrition] = about.split(/\s*(?=Ккал\s*:)/i);
    const price = first(/(\d[\d\s]*)\s*₽/, text(first(/<footer\b[^>]*>([\s\S]*?)<\/footer>/, block) ?? ""));

    items.push({
      name,
      image: new URL(decode(image), SOURCE).href,
      url: href ? new URL(decode(href), SOURCE).href : SOURCE,
      weight: weight || undefined,
      price: price ? `${price.trim().replace(/\s+/g, " ")} ₽` : undefined,
      description: description || undefined,
      nutrition: nutrition || undefined,
    });
  }
  return items;
}

const isCaptcha = html => /Вы не робот|smart-?captcha/i.test(html);

// Сайт защищён Yandex SmartCaptcha: если простой запрос получил капчу,
// пробуем открыть страницу настоящим браузером (Playwright).
async function loadWithBrowser() {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ locale: "ru-RU", viewport: { width: 1280, height: 900 } });
    await page.goto(SOURCE, { waitUntil: "networkidle", timeout: 60_000 });
    await page.waitForSelector("article img", { timeout: 20_000 }).catch(() => {});
    return await page.content();
  } finally {
    await browser.close();
  }
}

async function load() {
  const file = process.argv[2];
  if (file) return readFile(file, "utf8");
  const html = await loadWithFetch();
  if (!isCaptcha(html)) return html;
  console.log("Простой запрос получил капчу — открываю страницу браузером");
  return loadWithBrowser();
}

async function loadWithFetch() {
  const res = await fetch(SOURCE, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; chop5551-desserts/1.0; +https://chop5551.github.io)",
      "accept-language": "ru-RU,ru;q=0.9",
    },
  });
  if (!res.ok) throw new Error(`${SOURCE} → HTTP ${res.status}`);
  return res.text();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const html = await load();
  const items = parse(html);
  if (process.env.DEBUG_HTML || items.length < 3) {
    await writeFile("page.html", html);
    console.log({
      length: html.length,
      title: first(/<title[^>]*>([\s\S]*?)<\/title>/, html),
      captcha: isCaptcha(html),
      articles: (html.match(/<article\b/g) ?? []).length,
      smartofood: (html.match(/smartofood/g) ?? []).length,
      nextData: html.includes("__NEXT_DATA__"),
      nextFlight: html.includes("self.__next_f"),
    });
    console.log(html.slice(0, 3000));
  }
  // Не затираем рабочий список, если разметка сайта поменялась и ничего не нашлось
  if (items.length < 3) throw new Error(`Найдено только ${items.length} десертов — разметка сайта могла измениться`);
  await writeFile(OUT, JSON.stringify({ source: SOURCE, updated: new Date().toISOString(), items }, null, 2) + "\n");
  console.log(`Сохранено десертов: ${items.length}`);
}
