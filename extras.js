/* Folio extras: compare two versions, Bates numbering and stamps, flipbook, and text recognition (OCR).
   Everything runs in the browser. Text recognition downloads its engine and language data the first time. */
const ready = window.Folio ? Promise.resolve() : new Promise(r => addEventListener("folio-ready", r, { once: true }));
await ready;
const F = window.Folio, { pdfjsLib, PDFDocument, StandardFonts, rgb, degrees, busy, toast, download, count, esc } = F;
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const chips = (id, attr, cb) => $(id).addEventListener("click", e => { const b = e.target.closest(`[data-${attr}]`); if (!b) return; $$(`${id} [data-${attr}]`).forEach(x => x.setAttribute("aria-pressed", x === b)); cb(b.dataset[attr]); });
const readFile = f => f.arrayBuffer().then(b => new Uint8Array(b));

/* Map a point given in "as displayed" page coordinates to the page’s own coordinates, for rotated pages */
function placer(page) {
  const { width: W, height: H } = page.getSize(), R = ((page.getRotation().angle % 360) + 360) % 360;
  const vw = R % 180 ? H : W, vh = R % 180 ? W : H;
  const map = (vx, vy) => R === 90 ? [W - vy, vx] : R === 180 ? [W - vx, H - vy] : R === 270 ? [vy, H - vx] : [vx, vy];
  return { vw, vh, map, rot: degrees(R) };
}

/* ============ 1. Compare two versions ============ */
let cmpA = "open", fileA = null, fileB = null;
chips("#cmpASrc", "ca", v => { cmpA = v; if (v === "file") pickCmp("A"); else { fileA = null; $("#cmpAName").textContent = "Uses the document you have open."; } syncCmp(); });
function pickCmp(which) { const inp = $("#cmpIn"); inp.dataset.which = which; inp.value = ""; inp.click(); }
$("#cmpBPick").onclick = () => pickCmp("B");
$("#cmpIn").onchange = async () => { const f = $("#cmpIn").files[0]; if (!f) return; const bytes = await readFile(f); if ($("#cmpIn").dataset.which === "A") { fileA = { name: f.name, bytes }; $("#cmpAName").textContent = f.name; } else { fileB = { name: f.name, bytes }; $("#cmpBName").textContent = f.name; } syncCmp(); };
function syncCmp() { $("#cmpRun").disabled = !fileB || (cmpA === "file" && !fileA) || (cmpA === "open" && !F.hasDoc()); }
const normWord = w => w.toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-");
async function wordsOf(bytes) {
  const doc = await pdfjsLib.getDocument({ data: bytes.slice() }).promise, out = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const pg = await doc.getPage(i), tc = await pg.getTextContent();
    for (const it of tc.items) {
      if (!it.str || !it.str.trim()) continue; const [a, b, c, d, e, f] = it.transform, fh = Math.hypot(c, d) || Math.hypot(a, b) || 10, len = it.str.length; let pos = 0;
      for (const part of it.str.split(/(\s+)/)) { if (part.trim()) out.push({ t: part, k: normWord(part), page: i - 1, x: e + it.width * pos / len, w: it.width * part.length / len, y: f - fh * .25, h: fh * 1.2 }); pos += part.length; }
    }
    if (i % 5 === 0) busy(`Reading page ${i} of ${doc.numPages}`, i / doc.numPages * 50);
  }
  doc.destroy(); return out;
}
// Myers difference algorithm on words, after trimming the common start and end
function diff(A, B) {
  let s = 0; while (s < A.length && s < B.length && A[s] === B[s]) s++;
  let ea = A.length, eb = B.length; while (ea > s && eb > s && A[ea - 1] === B[eb - 1]) { ea--; eb--; }
  const a = A.slice(s, ea), b = B.slice(s, eb), N = a.length, M = b.length, MAX = N + M, off = MAX + 1, trace = [];
  let v = new Int32Array(2 * MAX + 3), D = -1;
  outer: for (let d = 0; d <= MAX; d++) {
    if (d > 3000) return null;
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      let x = (k === -d || (k !== d && v[off + k - 1] < v[off + k + 1])) ? v[off + k + 1] : v[off + k - 1] + 1, y = x - k;
      while (x < N && y < M && a[x] === b[y]) { x++; y++; }
      v[off + k] = x; if (x >= N && y >= M) { D = d; trace.push(v.slice()); break outer; }
    }
  }
  const ops = []; let x = N, y = M;
  for (let d = D; d > 0; d--) {
    const pv = trace[d], k = x - y, prevK = (k === -d || (k !== d && pv[off + k - 1] < pv[off + k + 1])) ? k + 1 : k - 1, px = pv[off + prevK], py = px - prevK;
    while (x > px && y > py) { ops.push(["=", s + x - 1, s + y - 1]); x--; y--; }
    if (x === px) ops.push(["+", -1, s + y - 1]); else ops.push(["-", s + x - 1, -1]);
    x = px; y = py;
  }
  while (x > 0 && y > 0) { ops.push(["=", s + x - 1, s + y - 1]); x--; y--; }
  ops.reverse(); return ops;
}
function blocksOf(ops) { const out = []; let cur = null; for (const [t, i, j] of ops) { if (t === "=") { cur = null; continue; } if (!cur) out.push(cur = { del: [], ins: [] }); (t === "-" ? cur.del : cur.ins).push(t === "-" ? i : j); } return out; }
let lastCmp = null;
$("#cmpRun").onclick = async () => {
  try {
    busy("Reading both documents", 5); await F.tick();
    const aBytes = cmpA === "open" ? await F.buildPdf(undefined, { decorate: false }) : fileA.bytes, bBytes = fileB.bytes;
    const wa = await wordsOf(aBytes), wb = await wordsOf(bBytes);
    if (!wa.length || !wb.length) { busy(false); return toast("One of the files has no readable text. If it’s a scan, use “Read text” on it first.", 5000); }
    busy("Comparing", 70); await F.tick();
    const ops = diff(wa.map(w => w.k), wb.map(w => w.k)); busy(false);
    if (!ops) return toast("These documents are too different to compare word by word.", 4500);
    const blocks = blocksOf(ops); lastCmp = { aBytes, bBytes, wa, wb, blocks }; showCmp(); count("compare");
  } catch (err) { console.error(err); busy(false); toast("Couldn’t compare these files."); }
};
function showCmp() {
  const { wa, wb, blocks } = lastCmp, added = blocks.reduce((n, b) => n + b.ins.length, 0), removed = blocks.reduce((n, b) => n + b.del.length, 0);
  const text = (ws, idx) => esc(idx.map(i => ws[i].t).join(" ")), pg = b => (b.ins.length ? wb[b.ins[0]].page : wa[b.del[0]].page) + 1;
  $("#cmpOut").innerHTML = !blocks.length ? `<p class="note"><b>No differences in the text.</b> The wording of both versions is identical. (Layout, images and formatting aren’t compared.)</p>` : `
    <div class="stat"><span>Changes</span><b>${blocks.length}</b></div><div class="stat"><span>Words added</span><b style="color:#1E7B4C">${added}</b></div><div class="stat"><span>Words removed</span><b style="color:#C2362B">${removed}</b></div>
    <button class="btn primary" id="cmpDlB">Download revised version, changes highlighted</button><button class="btn" id="cmpDlA">Download original, removals highlighted</button><button class="btn" id="cmpDlR">Download a change report</button>
    <div style="display:grid;gap:.45rem;max-height:46vh;overflow:auto">${blocks.slice(0, 300).map(b => `<div style="border:1px solid var(--line);border-radius:8px;padding:.5rem .6rem;font-size:.86rem"><b>Page ${pg(b)}</b><br>${b.del.length ? `<del style="color:#C2362B">${text(wa, b.del)}</del> ` : ""}${b.ins.length ? `<ins style="color:#1E7B4C;text-decoration:none;background:#D9F5E3">${text(wb, b.ins)}</ins>` : ""}</div>`).join("")}${blocks.length > 300 ? `<p class="note">Showing the first 300 changes. The downloads include all of them.</p>` : ""}</div>`;
  if (!blocks.length) return;
  $("#cmpDlB").onclick = () => markup(lastCmp.bBytes, wb, blocks.flatMap(b => b.ins), [.12, .7, .35], "revised-highlighted");
  $("#cmpDlA").onclick = () => markup(lastCmp.aBytes, wa, blocks.flatMap(b => b.del), [.85, .2, .15], "original-removals");
  $("#cmpDlR").onclick = () => { const lines = [`Comparison of “${cmpA === "open" ? F.safeName() : fileA.name}” (original) and “${fileB.name}” (revised)`, `${blocks.length} changes: ${added} words added, ${removed} words removed.`, ""]; blocks.forEach((b, i) => { lines.push(`${i + 1}. Page ${pg(b)}`); if (b.del.length) lines.push(`   Removed: ${b.del.map(j => wa[j].t).join(" ")}`); if (b.ins.length) lines.push(`   Added:   ${b.ins.map(j => wb[j].t).join(" ")}`); lines.push(""); }); download(new Blob([lines.join("\n")], { type: "text/plain" }), `${F.safeName()}-changes.txt`); };
}
async function markup(bytes, words, idxs, [r, g, b], suffix) {
  try {
    busy("Marking up", 50); const doc = await PDFDocument.load(bytes, { ignoreEncryption: true }), pagesL = doc.getPages();
    for (const i of idxs) { const w = words[i], p = pagesL[w.page]; if (!p) continue; p.drawRectangle({ x: w.x - 1, y: w.y, width: w.w + 2, height: w.h, color: rgb(r, g, b), opacity: .28 }); if (suffix === "original-removals") p.drawLine({ start: { x: w.x, y: w.y + w.h * .45 }, end: { x: w.x + w.w, y: w.y + w.h * .45 }, thickness: Math.max(.6, w.h * .06), color: rgb(r, g, b) }); }
    const out = await doc.save(); busy(false); download(new Blob([out], { type: "application/pdf" }), `${F.safeName()}-${suffix}.pdf`); toast("Marked-up copy saved");
  } catch (err) { console.error(err); busy(false); toast("Couldn’t mark up this file. It may be protected."); }
}
$$('.tool[data-tool="compare"]').forEach(b => b.addEventListener("click", syncCmp));

/* ============ 2. Bates numbering and stamps ============ */
let batesPos = "br";
chips("#btPos", "bp", v => { batesPos = v; previewBates(); });
const batesLabel = n => `${$("#btPrefix").value}${String(n).padStart(Math.max(1, +$("#btDigits").value || 6), "0")}${$("#btSuffix").value}`;
function previewBates() { const s = +$("#btStart").value || 0; $("#btPreview").textContent = `First page: ${batesLabel(s)}. Next: ${batesLabel(s + 1)}.`; }
["#btPrefix", "#btSuffix", "#btStart", "#btDigits"].forEach(id => $(id).addEventListener("input", previewBates)); previewBates();
async function stampBates(bytes, start) {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true }), font = await doc.embedFont(StandardFonts.HelveticaBold), reg = await doc.embedFont(StandardFonts.Helvetica);
  const size = Math.max(5, +$("#btSize").value || 9), stamp = ($("#btStamp").value || "").trim(), box = $("#btBox").checked, margin = 18; let n = start;
  const clean = t => t.replace(/[^\x20-\x7E\u00A0-\u00FF]/g, "");
  for (const page of doc.getPages()) {
    const P = placer(page), label = clean(batesLabel(n)), lw = font.widthOfTextAtSize(label, size), top = batesPos === "tr";
    let vx = batesPos === "bl" ? margin : batesPos === "bc" ? (P.vw - lw) / 2 : P.vw - margin - lw, vy = top ? P.vh - margin - size : margin;
    const draw = (txt, f, sz, x, y) => { const w = f.widthOfTextAtSize(txt, sz); if (box) { const [bx, by] = P.map(x - 3, y - 3); page.drawRectangle({ x: bx, y: by, width: w + 6, height: sz + 5, color: rgb(1, 1, 1), rotate: P.rot, opacity: .92 }); } const [ux, uy] = P.map(x, y); page.drawText(txt, { x: ux, y: uy, size: sz, font: f, color: rgb(.07, .07, .07), rotate: P.rot }); };
    draw(label, font, size, vx, vy);
    if (stamp) { const st = clean(stamp), sw = reg.widthOfTextAtSize(st, size); const sx = batesPos === "bl" ? P.vw - margin - sw : batesPos === "bc" ? (P.vw - sw) / 2 : margin, sy = batesPos === "bc" ? vy + size + 6 : vy; draw(st, reg, size, sx, sy); }
    n++;
  }
  return { bytes: await doc.save(), first: start, last: n - 1, pages: n - start };
}
$("#btOne").onclick = async () => {
  if (!F.hasDoc()) return toast("Open a PDF first.");
  try { busy("Numbering", 40); const r = await stampBates(await F.buildPdf(), +$("#btStart").value || 0); busy(false); download(new Blob([r.bytes], { type: "application/pdf" }), `${batesLabel(r.first)}-${batesLabel(r.last)}.pdf`); toast(`Numbered ${r.pages} pages: ${batesLabel(r.first)} to ${batesLabel(r.last)}`); count("bates"); }
  catch (err) { console.error(err); busy(false); toast("Couldn’t number this PDF."); }
};
$("#btMany").onclick = () => { $("#batesIn").value = ""; $("#batesIn").click(); };
$("#batesIn").onchange = async () => {
  const files = [...$("#batesIn").files].filter(f => /pdf$/i.test(f.type) || /\.pdf$/i.test(f.name)).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })); if (!files.length) return;
  try {
    const zip = new JSZip(), index = [["File", "First number", "Last number", "Pages"]]; let n = +$("#btStart").value || 0;
    for (let i = 0; i < files.length; i++) { busy(`Numbering ${files[i].name}`, i / files.length * 100); const r = await stampBates(await readFile(files[i]), n); zip.file(`${batesLabel(r.first)}-${batesLabel(r.last)} ${files[i].name}`, r.bytes); index.push([files[i].name, batesLabel(r.first), batesLabel(r.last), r.pages]); n = r.last + 1; }
    zip.file("index.csv", index.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n"));
    busy("Zipping", 100); const blob = await zip.generateAsync({ type: "blob" }); busy(false); download(blob, `bates-${batesLabel(+$("#btStart").value || 0)}-${batesLabel(n - 1)}.zip`);
    toast(`Numbered ${files.length} files, ${batesLabel(+$("#btStart").value || 0)} to ${batesLabel(n - 1)}`, 4000); $("#btStart").value = n; previewBates(); count("bates");
  } catch (err) { console.error(err); busy(false); toast("One of those PDFs couldn’t be numbered. It may be protected."); }
};

/* ============ 3. Flipbook ============ */
let fbWidth = 1300;
chips("#fbQ", "fq", v => fbWidth = +v);
$("#fbGo").onclick = async () => {
  if (!F.hasDoc()) return toast("Open a PDF first.");
  try {
    busy("Preparing pages", 0); const bytes = await F.buildPdf(), doc = await pdfjsLib.getDocument({ data: bytes.slice() }).promise, imgs = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const pg = await doc.getPage(i), base = pg.getViewport({ scale: 1 }), vp = pg.getViewport({ scale: fbWidth / base.width }), c = document.createElement("canvas"); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); await pg.render({ canvasContext: x, viewport: vp }).promise; imgs.push({ src: c.toDataURL("image/jpeg", .82), w: c.width, h: c.height }); c.width = c.height = 0;
      busy(`Page ${i} of ${doc.numPages}`, i / doc.numPages * 100);
    }
    doc.destroy(); const title = ($("#fbTitle").value || F.safeName()).trim();
    download(new Blob([flipHtml(title, imgs, $("#fbBg").value, $("#fbCover").checked)], { type: "text/html" }), `${F.safeName()}-flipbook.html`); busy(false); toast("Flipbook saved. Open it in any browser, or upload it to your website."); count("flipbook");
  } catch (err) { console.error(err); busy(false); toast("Couldn’t make a flipbook from this PDF."); }
};
function flipHtml(title, imgs, bg, cover) {
  const ratio = (imgs[0].h / imgs[0].w).toFixed(4), t = esc(title);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${t}</title>
<style>
*{box-sizing:border-box}html,body{margin:0;height:100%;background:${bg};color:#fff;font:15px/1.4 system-ui,sans-serif;overflow:hidden}
header{display:flex;align-items:center;gap:.8rem;padding:.6rem 1rem;background:rgba(0,0,0,.25)}header h1{font-size:1rem;margin:0;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
button{font:inherit;color:#fff;background:rgba(255,255,255,.14);border:0;border-radius:8px;height:38px;min-width:38px;padding:0 .8rem;cursor:pointer}button:hover{background:rgba(255,255,255,.26)}button:disabled{opacity:.35;cursor:default}
main{position:absolute;inset:56px 0 0;display:grid;place-items:center;perspective:2400px}
.book{position:relative;display:flex;box-shadow:0 30px 60px -25px rgba(0,0,0,.6)}
.pg{position:relative;background:#fff center/contain no-repeat;width:var(--w);height:calc(var(--w)*${ratio})}
.pg.empty{background:transparent}.book .pg:first-child:not(:last-child):not(.empty){box-shadow:inset -18px 0 22px -16px rgba(0,0,0,.35)}.book .pg+.pg{box-shadow:inset 18px 0 22px -16px rgba(0,0,0,.35)}
.leaf{position:absolute;top:0;width:var(--w);height:calc(var(--w)*${ratio});transform-style:preserve-3d;transition:transform .7s cubic-bezier(.4,.1,.2,1);z-index:5}
.leaf>div{position:absolute;inset:0;background:#fff center/contain no-repeat;backface-visibility:hidden}
.leaf .back{transform:rotateY(180deg)}
.nav{position:absolute;top:50%;transform:translateY(-50%);width:54px;height:54px;border-radius:50%;font-size:1.6rem;z-index:9}.prev{left:12px}.next{right:12px}
.count{font-variant-numeric:tabular-nums;opacity:.85}
.zoomed .book{transform:scale(1.7);transform-origin:var(--zx,50%) var(--zy,50%);cursor:zoom-out}
@media (prefers-reduced-motion:reduce){.leaf{transition:none}}
</style></head><body>
<header><h1>${t}</h1><span class="count" id="count"></span><button id="zoom" aria-label="Zoom">Zoom</button><button id="fs" aria-label="Full screen">Full screen</button></header>
<main id="main"><button class="nav prev" id="prev" aria-label="Previous page">‹</button><div class="book" id="book"></div><button class="nav next" id="next" aria-label="Next page">›</button></main>
<script>
const P=${JSON.stringify(imgs.map(i => i.src))},cover=${cover},book=document.getElementById("book");let spreads=[],s=0,busy=false;
const two=()=>innerWidth>900&&innerWidth/innerHeight>1.1;
function build(){spreads=[];if(two()){let i=0;if(cover){spreads.push([null,0]);i=1;}for(;i<P.length;i+=2)spreads.push([i,i+1<P.length?i+1:null]);}else P.forEach((_,i)=>spreads.push([i]));}
function size(){const w2=two(),ratio=${ratio},avW=innerWidth-140,avH=innerHeight-80;let w=Math.min(avW/(w2?2:1),avH/ratio);book.style.setProperty("--w",w+"px");document.querySelectorAll(".leaf").forEach(l=>l.style.setProperty("--w",w+"px"));}
const pg=i=>'<div class="pg'+(i==null?' empty':'')+'"'+(i!=null?' style="background-image:url('+P[i]+')"':'')+'></div>';
function show(){book.innerHTML=spreads[s].map(pg).join("");size();const sp=spreads[s].filter(x=>x!=null).map(x=>x+1);document.getElementById("count").textContent=(sp.length>1?sp.join("–"):sp[0])+" / "+P.length;document.getElementById("prev").disabled=s===0;document.getElementById("next").disabled=s===spreads.length-1;}
function turn(dir){if(busy)return;const t=s+dir;if(t<0||t>=spreads.length)return;const w2=two(),cur=spreads[s],nxt=spreads[t];
 if(matchMedia("(prefers-reduced-motion:reduce)").matches){s=t;return show();}
 busy=true;const leaf=document.createElement("div");leaf.className="leaf";const W=parseFloat(getComputedStyle(book).getPropertyValue("--w"));
 const front=dir>0?(w2?cur[1]:cur[0]):(w2?cur[0]:cur[0]),back=dir>0?(w2?nxt[0]:nxt[0]):(w2?nxt[1]:nxt[0]);
 leaf.innerHTML='<div class="front"'+(front!=null?' style="background-image:url('+P[front]+')"':'')+'></div><div class="back"'+(back!=null?' style="background-image:url('+P[back]+')"':'')+'></div>';
 leaf.style.setProperty("--w",W+"px");leaf.style.left=(w2?(dir>0?W:0):0)+"px";leaf.style.transformOrigin=(w2?(dir>0?"left":"right"):(dir>0?"left":"right"))+" center";
 const pages=book.children;if(w2){if(dir>0)pages[1].outerHTML=pg(nxt[1]);else pages[0].outerHTML=pg(nxt[0]);}else{pages[0].outerHTML=pg(nxt[0]);}
 book.appendChild(leaf);requestAnimationFrame(()=>requestAnimationFrame(()=>{leaf.style.transform="rotateY("+(dir>0?-180:180)+"deg)";}));
 leaf.addEventListener("transitionend",()=>{s=t;busy=false;show();},{once:true});}
document.getElementById("next").onclick=()=>turn(1);document.getElementById("prev").onclick=()=>turn(-1);
addEventListener("keydown",e=>{if(e.key==="ArrowRight"||e.key===" ")turn(1);if(e.key==="ArrowLeft")turn(-1);});
let sx=null;addEventListener("touchstart",e=>sx=e.touches[0].clientX,{passive:true});addEventListener("touchend",e=>{if(sx==null)return;const d=e.changedTouches[0].clientX-sx;if(Math.abs(d)>40)turn(d<0?1:-1);sx=null;});
book.addEventListener("click",e=>{if(document.body.classList.contains("zoomed"))return document.body.classList.remove("zoomed");const r=book.getBoundingClientRect(),x=e.clientX-r.left;if(x>r.width*.6)turn(1);else if(x<r.width*.4)turn(-1);});
document.getElementById("zoom").onclick=()=>{document.body.classList.toggle("zoomed");};
document.getElementById("fs").onclick=()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen?.();
let last=two();addEventListener("resize",()=>{if(two()!==last){last=two();const page=spreads[s].find(x=>x!=null);build();s=Math.max(0,spreads.findIndex(sp=>sp.includes(page)));show();}else size();});
build();show();
<\/script></body></html>`;
}

/* ============ 4. Text recognition (OCR) ============ */
const TESS = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
let tessLoad = null;
const loadTess = () => tessLoad ||= new Promise((res, rej) => { const s = document.createElement("script"); s.src = TESS; s.onload = res; s.onerror = () => { tessLoad = null; rej(new Error("load")); }; document.head.appendChild(s); });
function wordsFrom(data) {
  if (data.words?.length) return data.words;
  const out = []; for (const b of data.blocks || []) for (const p of b.paragraphs || []) for (const l of p.lines || []) for (const w of l.words || []) out.push(w); return out;
}
async function recognise(asPdf) {
  if (!F.hasDoc()) return toast("Open a PDF or image first.");
  const lang = $("#ocrLang").value, latin = !["ara", "chi_sim"].includes(lang);
  if (asPdf && !latin) return toast("For Arabic and Chinese, use “Get the text as a file”. Searchable PDFs support Latin-script languages for now.", 5000);
  const bar = $("#ocrBar"), wrap = $("#ocrBarWrap"); let worker = null;
  try {
    busy("Getting text recognition ready (first time only)", 3); await loadTess();
    worker = await window.Tesseract.createWorker(lang, 1, { logger: m => { if (m.status === "loading language traineddata" || m.status === "loading tesseract core") busy(`Downloading ${m.status.includes("core") ? "the engine" : "language data"}…`, Math.round((m.progress || 0) * 100)); } });
    const bytes = await F.buildPdf(), doc = await pdfjsLib.getDocument({ data: bytes.slice() }).promise, out = asPdf ? await PDFDocument.load(bytes, { ignoreEncryption: true }) : null;
    const font = out ? await out.embedFont(StandardFonts.Helvetica) : null, texts = []; let done = 0, skipped = 0;
    wrap.hidden = false;
    for (let i = 1; i <= doc.numPages; i++) {
      const pg = await doc.getPage(i);
      if ($("#ocrSkip").checked) { const tc = await pg.getTextContent(); if (tc.items.some(it => it.str && it.str.trim())) { skipped++; texts.push(`--- Page ${i} (already had text) ---\n${tc.items.map(it => it.str).join(" ")}`); continue; } }
      busy(`Reading page ${i} of ${doc.numPages}`, (i - 1) / doc.numPages * 100); bar.style.width = `${(i - 1) / doc.numPages * 100}%`;
      const base = pg.getViewport({ scale: 1 }), scale = Math.min(3, 2200 / Math.max(base.width, base.height)), vp = pg.getViewport({ scale }), c = document.createElement("canvas"); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); await pg.render({ canvasContext: x, viewport: vp }).promise;
      const { data } = await worker.recognize(c, {}, { text: true, blocks: true }); texts.push(`--- Page ${i} ---\n${(data.text || "").trim()}`);
      if (out) {
        const page = out.getPage(i - 1), P = placer(page), k = P.vw / c.width;
        for (const w of wordsFrom(data)) {
          const txt = (w.text || "").replace(/[^\x20-\x7E\u00A0-\u00FF]/g, "").trim(); if (!txt || (w.confidence ?? 100) < 35) continue;
          const bw = (w.bbox.x1 - w.bbox.x0) * k, bh = (w.bbox.y1 - w.bbox.y0) * k; let size = Math.max(2, bh * .92); const tw = font.widthOfTextAtSize(txt, size); if (tw > bw && tw > 0) size *= bw / tw;
          const vx = w.bbox.x0 * k, vy = P.vh - w.bbox.y1 * k + bh * .18, [ux, uy] = P.map(vx, vy);
          page.drawText(txt, { x: ux, y: uy, size, font, opacity: 0, rotate: P.rot });
        }
      }
      done++; c.width = c.height = 0;
    }
    doc.destroy(); await worker.terminate(); worker = null; bar.style.width = "100%"; busy(false);
    if (!done && skipped) { wrap.hidden = true; return toast("Every page already has text, so there was nothing to recognise. Untick “Skip pages that already have text” to read them anyway.", 5500); }
    if (out) { download(new Blob([await out.save()], { type: "application/pdf" }), `${F.safeName()}-searchable.pdf`); toast(`Done: ${done} page${done > 1 ? "s" : ""} made searchable${skipped ? `, ${skipped} already had text` : ""}`, 4000); }
    else { download(new Blob([texts.join("\n\n")], { type: "text/plain;charset=utf-8" }), `${F.safeName()}-text.txt`); toast("Text saved"); }
    count("ocr"); setTimeout(() => (wrap.hidden = true), 1500);
  } catch (err) { console.error(err); busy(false); wrap.hidden = true; try { await worker?.terminate(); } catch {} toast(err.message === "load" ? "Text recognition needs an internet connection the first time, to download the engine." : "Couldn’t read the text on these pages.", 5000); }
}
$("#ocrPdf").onclick = () => recognise(true);
$("#ocrTxt").onclick = () => recognise(false);

/* ============ 5. Classroom tools (Kami-style): read aloud, paper pages, voice notes ============ */
// Read aloud with the browser's own speech voices
const synth = window.speechSynthesis;
function fillVoices() { if (!synth) return; const vs = synth.getVoices(), sel = $("#raVoice"), prev = sel.value; sel.innerHTML = vs.map((v, i) => `<option value="${i}">${esc(v.name)} (${esc(v.lang)})</option>`).join("") || "<option>Default voice</option>"; const en = vs.findIndex(v => /^en(-|_)GB/i.test(v.lang)); sel.value = prev || String(en >= 0 ? en : 0); }
if (synth) { fillVoices(); synth.onvoiceschanged = fillVoices; } else { $("#raPlay").disabled = true; $("#raNow").textContent = "This browser can’t read aloud."; }
let raQueue = [], raStop = false;
$("#raPlay").onclick = async () => {
  if (!synth) return; if (synth.paused) return synth.resume(); if (!F.hasDoc()) return toast("Open a PDF first.");
  synth.cancel(); raStop = false; busy("Getting the text", 30);
  try {
    const doc = await pdfjsLib.getDocument({ data: (await F.buildPdf(undefined, { decorate: false })).slice() }).promise, from = Math.max(1, Math.min(doc.numPages, +$("#raFrom").value || 1)); raQueue = [];
    for (let i = from; i <= doc.numPages; i++) { const tc = await (await doc.getPage(i)).getTextContent(), text = tc.items.map(t => t.str + (t.hasEOL ? " " : "")).join("").replace(/\s+/g, " ").trim(); (text.match(/[^.!?]+[.!?]*\s*/g) || []).forEach(s => s.trim() && raQueue.push({ page: i, s: s.trim() })); }
    doc.destroy(); busy(false);
    if (!raQueue.length) return toast("No readable text. If this is a scan, use “Read text” first.", 4500);
    const voice = synth.getVoices()[+$("#raVoice").value], rate = +$("#raRate").value;
    const speakNext = () => { if (raStop || !raQueue.length) { $("#raNow").textContent = raStop ? "" : "Finished reading."; return; } const { page, s } = raQueue.shift(), u = new SpeechSynthesisUtterance(s); if (voice) u.voice = voice; u.rate = rate; u.onend = speakNext; u.onerror = speakNext; $("#raNow").innerHTML = `<b>Page ${page}:</b> ${esc(s)}`; synth.speak(u); };
    speakNext(); count("read_aloud");
  } catch (err) { console.error(err); busy(false); toast("Couldn’t read this document aloud."); }
};
$("#raPause").onclick = () => synth?.speaking && (synth.paused ? synth.resume() : synth.pause());
$("#raStop").onclick = () => { raStop = true; raQueue = []; synth?.cancel(); $("#raNow").textContent = ""; };

// Paper pages drawn as real vector lines, so they print crisply
$("#ppAdd").onclick = async () => {
  const type = $("#ppType").value, [W, H] = $("#ppSize").value === "letter" ? [612, 792] : [595.28, 841.89], n = Math.max(1, Math.min(30, +$("#ppCount").value || 1)), mm = 72 / 25.4;
  const doc = await PDFDocument.create(), light = rgb(.62, .74, .86), mid = rgb(.45, .58, .72), red = rgb(.86, .45, .45), m = 15 * mm;
  for (let k = 0; k < n; k++) {
    const p = doc.addPage([W, H]), line = (x1, y1, x2, y2, c = light, w = .6, dash) => p.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, color: c, thickness: w, dashArray: dash });
    if (type === "lined" || type === "narrow") { const gap = (type === "lined" ? 8.7 : 7.1) * mm; for (let y = H - 30 * mm; y > m; y -= gap) line(m, y, W - m, y); line(m + 18 * mm, H - m, m + 18 * mm, m, red, .8); }
    if (type === "handwriting") { const gap = 22 * mm; for (let y = H - 30 * mm; y > m + 10 * mm; y -= gap) { line(m, y, W - m, y, mid, .8); line(m, y - 5 * mm, W - m, y - 5 * mm, light, .5, [3, 3]); line(m, y - 10 * mm, W - m, y - 10 * mm, mid, .8); line(m, y - 14 * mm, W - m, y - 14 * mm, light, .4); } }
    if (type === "grid" || type === "graph") { const step = type === "grid" ? 5 * mm : 2 * mm; let i = 0; for (let x = m; x <= W - m + .1; x += step, i++) line(x, m, x, H - m, type === "graph" && i % 5 === 0 ? mid : light, type === "graph" && i % 5 === 0 ? .7 : .35); i = 0; for (let y = m; y <= H - m + .1; y += step, i++) line(m, y, W - m, y, type === "graph" && i % 5 === 0 ? mid : light, type === "graph" && i % 5 === 0 ? .7 : .35); }
    if (type === "dots") for (let x = m; x <= W - m; x += 5 * mm) for (let y = m; y <= H - m; y += 5 * mm) p.drawCircle({ x, y, size: .7, color: mid });
    if (type === "iso") { const s = 6 * mm, h = s * Math.sqrt(3) / 2; let r = 0; for (let y = m; y <= H - m; y += h, r++) for (let x = m + (r % 2 ? s / 2 : 0); x <= W - m; x += s) p.drawCircle({ x, y, size: .7, color: mid }); }
    if (type === "cornell") { line(m, H - 35 * mm, W - m, H - 35 * mm, mid, 1); line(m + 55 * mm, H - 35 * mm, m + 55 * mm, 55 * mm, mid, 1); line(m, 55 * mm, W - m, 55 * mm, mid, 1); for (let y = H - 35 * mm - 8 * mm; y > 55 * mm; y -= 8 * mm) line(m + 55 * mm, y, W - m, y); const f = await doc.embedFont(StandardFonts.Helvetica); [["Cues and questions", m + 2, H - 41 * mm], ["Notes", m + 57 * mm, H - 41 * mm], ["Summary", m + 2, 50 * mm]].forEach(([t, x, y]) => p.drawText(t, { x, y, size: 9, font: f, color: mid })); }
    if (type === "music") { for (let top = H - 30 * mm; top > m + 12 * mm; top -= 26 * mm) for (let i = 0; i < 5; i++) line(m, top - i * 2.2 * mm, W - m, top - i * 2.2 * mm, rgb(.35, .38, .42), .6); }
  }
  const file = new File([await doc.save()], `${type}-paper.pdf`, { type: "application/pdf" });
  if (F.hasDoc()) await F.addFiles([file], F.insertIndex()); else await F.addFiles([file]);
  toast(`Added ${n} page${n > 1 ? "s" : ""} of ${$("#ppType").selectedOptions[0].textContent.toLowerCase()}`); count("paper_pages");
};

// Voice notes, stored inside the PDF as attachments
const notes = []; let rec = null, chunks = [];
$("#vnRec").onclick = async () => {
  try { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); chunks = []; rec = new MediaRecorder(stream); rec.ondataavailable = e => e.data.size && chunks.push(e.data);
    rec.onstop = () => { stream.getTracks().forEach(t => t.stop()); const type = (rec.mimeType || "audio/webm").split(";")[0], blob = new Blob(chunks, { type }); notes.push({ blob, type, name: `voice-note-${notes.length + 1}.${type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm"}`, url: URL.createObjectURL(blob) }); showNotes(); };
    rec.start(); $("#vnRec").disabled = true; $("#vnStop").disabled = false; $("#vnRec").textContent = "Recording…"; }
  catch { toast("Allow microphone access to record a voice note."); }
};
$("#vnStop").onclick = () => { rec?.stop(); $("#vnRec").disabled = false; $("#vnStop").disabled = true; $("#vnRec").textContent = "Record another"; };
function showNotes() { $("#vnList").innerHTML = notes.map((n, i) => `<div style="display:grid;grid-template-columns:1fr auto;gap:.4rem;align-items:center"><audio controls src="${n.url}" style="width:100%"></audio><button class="btn" data-vndel="${i}" aria-label="Remove voice note ${i + 1}">✕</button></div>`).join(""); $("#vnSave").disabled = !notes.length; }
$("#vnList").addEventListener("click", e => { const b = e.target.closest("[data-vndel]"); if (!b) return; notes.splice(+b.dataset.vndel, 1); showNotes(); });
$("#vnSave").onclick = async () => {
  if (!F.hasDoc()) return toast("Open a PDF first.");
  try { busy("Adding voice notes", 50); const doc = await PDFDocument.load(await F.buildPdf(), { ignoreEncryption: true });
    for (const n of notes) await doc.attach(new Uint8Array(await n.blob.arrayBuffer()), n.name, { mimeType: n.type, description: "Voice note", creationDate: new Date() });
    if ($("#vnLabel").checked) { const p = doc.getPage(0), P = placer(p), f = await doc.embedFont(StandardFonts.HelveticaBold), t = `${notes.length} voice note${notes.length > 1 ? "s" : ""} attached: open the attachments panel to listen`, sz = 8, w = f.widthOfTextAtSize(t, sz), [x, y] = P.map(P.vw - w - 22, P.vh - 22); p.drawRectangle({ x: x - 4, y: y - 4, width: w + 8, height: sz + 8, color: rgb(1, .96, .75), rotate: P.rot }); p.drawText(t, { x, y, size: sz, font: f, color: rgb(.25, .2, .05), rotate: P.rot }); }
    download(new Blob([await doc.save()], { type: "application/pdf" }), `${F.safeName()}-with-voice-notes.pdf`); busy(false); toast("Saved with voice notes"); count("voice_notes"); }
  catch (err) { console.error(err); busy(false); toast("Couldn’t add the voice notes to this PDF."); }
};
