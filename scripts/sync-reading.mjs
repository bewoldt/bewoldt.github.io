// Pulls books marked "Read" from Hardcover and builds the year sections for reading.html.
//
//   HARDCOVER_TOKEN=... node scripts/sync-reading.mjs            summary only, writes nothing
//   HARDCOVER_TOKEN=... node scripts/sync-reading.mjs --out f    write the generated HTML to f
//   HARDCOVER_TOKEN=... node scripts/sync-reading.mjs --write    replace the blocks between the
//                                                                reading:start/end markers in reading.html
//                                                                (all years) and index.html (3 most recent)
//
// The token is read from the environment or from a git-ignored .env file.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const ENDPOINT = "https://api.hardcover.app/v1/graphql";
const READING_PAGE = new URL("../reading.html", import.meta.url);
const HOME_PAGE = new URL("../index.html", import.meta.url);
const HOME_COUNT = 3;
const READ_STATUS = 3; // Hardcover status_id for "Read"

function loadToken() {
  let token = process.env.HARDCOVER_TOKEN;
  const envFile = new URL("../.env", import.meta.url);
  if (!token && existsSync(envFile)) {
    token = readFileSync(envFile, "utf8").match(/^HARDCOVER_TOKEN=(.*)$/m)?.[1];
  }
  if (!token) throw new Error("Set HARDCOVER_TOKEN (environment variable or .env file).");
  token = token.trim().replace(/^["']|["']$/g, "");
  return token.startsWith("Bearer ") ? token : `Bearer ${token}`;
}

const QUERY = `
  query {
    me {
      user_books(where: { status_id: { _eq: ${READ_STATUS} } }) {
        rating
        user_book_reads { finished_at }
        book {
          title
          image { url }
          contributions { contribution author { name } }
        }
      }
    }
  }`;

async function fetchBooks() {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: loadToken() },
    body: JSON.stringify({ query: QUERY }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.errors) {
    throw new Error(`Hardcover API error (${res.status}): ${JSON.stringify(json.errors ?? json)}`);
  }
  const me = Array.isArray(json.data.me) ? json.data.me[0] : json.data.me;
  return me.user_books;
}

// Most recent finish date; books with no date go in "Undated".
function finishedYear(ub) {
  const dates = ub.user_book_reads.map((r) => r.finished_at).filter(Boolean).sort();
  const last = dates.at(-1);
  return { year: last ? last.slice(0, 4) : "Undated", date: last ?? "" };
}

const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function itemHtml(ub) {
  const { book } = ub;
  // Contributors with no role are authors; others are translators, illustrators, narrators and so on.
  const isAuthor = (c) => !c.contribution || c.contribution.toLowerCase() === "author";
  const authors = [...new Set(book.contributions.filter(isAuthor).map((c) => c.author?.name).filter(Boolean))].join(", ");
  const stars = Math.round(ub.rating ?? 0);
  const lines = [
    `        <div class="reading-item">`,
    `          <div class="reading-img">`,
    book.image?.url ? `            <img src="${esc(book.image.url)}" alt="${esc(book.title)}" loading="lazy" />` : "",
    `          </div>`,
    `          <div class="reading-author">`,
    `            <h3>${esc(book.title)}</h3>`,
    `            <p>${esc(authors)}</p>`,
    `          </div>`,
    stars >= 1
      ? `          <div class="rating">\n            <img src="assets/${stars}star.jpg" alt="${stars} stars" />\n          </div>`
      : "",
    `        </div>`,
  ];
  return lines.filter(Boolean).join("\n");
}

function build(userBooks) {
  const dated = userBooks.map((ub) => ({ ub, ...finishedYear(ub) }));
  const byYear = new Map();
  for (const x of dated) {
    if (!byYear.has(x.year)) byYear.set(x.year, []);
    byYear.get(x.year).push(x);
  }
  const years = [...byYear.keys()].sort((a, b) => (b === "Undated") - (a === "Undated") || b.localeCompare(a));
  const sections = years.map((year, i) => {
    const items = byYear.get(year).sort((a, b) => b.date.localeCompare(a.date)).map((x) => itemHtml(x.ub));
    return [
      i ? "      <br /><hr />" : "",
      `      <h2${i ? "" : ' class="reading-heading"'}>${year}</h2>`,
      `      <div class="reading-grid">`,
      items.join("\n"),
      `      </div>`,
    ].filter(Boolean).join("\n");
  });
  // Homepage: most recent finish dates first. The home grid sits two spaces deeper than the reading page grids.
  const recent = dated
    .filter((x) => x.date)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, HOME_COUNT)
    .map((x) => itemHtml(x.ub).replace(/^/gm, "  "))
    .join("\n");
  return { html: sections.join("\n"), recent, byYear, years };
}

function splice(url, html) {
  const re = /(<!-- reading:start -->\n)[\s\S]*?(\n\s*<!-- reading:end -->)/;
  const page = readFileSync(url, "utf8");
  if (!re.test(page)) throw new Error(`${url.pathname} is missing the reading:start / reading:end markers.`);
  writeFileSync(url, page.replace(re, (_, a, b) => a + html + b));
  console.log(`Updated ${url.pathname.split("/").pop()}`);
}

const args = process.argv.slice(2);
const { html, recent, byYear, years } = build(await fetchBooks());

for (const y of years) console.log(`${y}: ${byYear.get(y).length} books`);
console.log(`Total: ${[...byYear.values()].reduce((n, v) => n + v.length, 0)}`);

const outIdx = args.indexOf("--out");
if (outIdx !== -1) {
  writeFileSync(args[outIdx + 1], html + "\n");
  console.log(`Wrote ${args[outIdx + 1]}`);
}
if (args.includes("--write")) {
  splice(READING_PAGE, html);
  splice(HOME_PAGE, recent);
}
