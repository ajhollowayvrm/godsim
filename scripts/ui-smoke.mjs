// Headed-less UI smoke test: boots the app, starts a world, advances eras,
// opens inspectors and the Divine Hand, and fails on any console error.
// Usage: npm run preview (in another shell) then: node scripts/ui-smoke.mjs
import { chromium } from "playwright";

const url = process.env.URL ?? "http://localhost:4173/";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });

try {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await page.screenshot({ path: "smoke-1-setup.png" });

  // pick the god-slayer adversary + a vow, then begin
  await page.locator(".advcard", { hasText: "mortal god-slayer" }).click();
  await page.locator(".advcard", { hasText: "no-blood" }).click();
  await page.locator(".btn.gold", { hasText: "Let there be a world" }).click();
  await page.waitForTimeout(400);

  for (let i = 0; i < 6; i++) {
    await page.locator(".btn.gold", { hasText: "Advance the Age" }).click();
    await page.waitForTimeout(250);
  }
  await page.screenshot({ path: "smoke-2-main.png" });

  // open the Divine Hand and inspect a soul
  await page.locator(".controls .btn.hand").click();
  await page.locator(".tabbtn", { hasText: "souls" }).click();
  await page.locator(".souls .soul").first().click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: "smoke-3-person.png" });
  await page.locator(".inspector .actions .btn.hand", { hasText: "Bless" }).first().click();
  await page.waitForTimeout(200);

  // click a map region and bless the land
  await page.locator("svg.map g").nth(14).click();
  await page.waitForTimeout(300);
  await page.locator(".inspector .actions .btn.hand", { hasText: "Bless this land" }).click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: "smoke-4-region.png" });

  // overlays
  for (const o of ["faith", "prosperity", "culture", "realms"]) {
    await page.locator(".overlaybar .btn", { hasText: o }).click();
    await page.waitForTimeout(120);
  }

  // god tab: vow shown, rewind input present
  await page.locator(".tabbtn", { hasText: "god" }).click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: "smoke-5-god.png" });

  // rewind to era 3 and confirm era header updates
  await page.locator(".card .seed").fill("3");
  await page.locator(".btn.hand", { hasText: "Unwind the years" }).click();
  await page.waitForTimeout(500);
  const sub = await page.locator(".sub").first().textContent();
  if (!/Era 3/.test(sub ?? "")) errors.push("rewind: expected Era 3 in header, got: " + sub);
  await page.screenshot({ path: "smoke-6-rewound.png" });

  // advance again after rewind
  await page.locator(".btn.gold", { hasText: "Advance the Age" }).click();
  await page.waitForTimeout(300);
} catch (e) {
  errors.push("script: " + e.message);
  await page.screenshot({ path: "smoke-error.png" }).catch(() => {});
}

console.log(errors.length ? "ERRORS:\n" + errors.join("\n") : "SMOKE OK — no console errors");
await browser.close();
process.exit(errors.length ? 1 : 0);
