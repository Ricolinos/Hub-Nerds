import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge", headless: true });
const p = await b.newPage({ viewport: {width:1440,height:900} });
await p.goto("http://localhost:3000/sign-in", { waitUntil:"load", timeout:90000 });
await p.waitForTimeout(3000);
// retry anti-hidratación: reintenta llenar si el campo pierde el valor
for (let i=0;i<3;i++){
  const id = p.locator('input[name="identifier"], input[type="text"]').first();
  await id.fill("client_demo").catch(()=>{});
  await p.waitForTimeout(600);
  if ((await id.inputValue().catch(()=>"")) === "client_demo") break;
}
await p.keyboard.press("Enter");
await p.waitForTimeout(3500);
const pw = p.locator('input[type="password"]').first();
if (await pw.count()) { await pw.fill("424242"); await p.keyboard.press("Enter"); }
else {
  const code = p.locator('input[name="code"], input[inputmode="numeric"]').first();
  if (await code.count()) { await code.fill("424242"); }
}
await p.waitForTimeout(6000);
console.log("URL tras login:", p.url());
await p.screenshot({ path:"/tmp/login-state.png" });
await b.close();
