# Folio: free PDF editor that runs in your browser

Merge, split, reorder, rotate, sign, fill in, annotate, number, watermark, compress and convert PDFs. No account, no limits, no watermarks. Files are processed on the visitor's own device and never uploaded.

## Put it online with GitHub Pages
1. Create a new **public** repository on github.com, for example `folio`.
2. Click **uploading an existing file** and drag in everything: `index.html`, `app.js`, `README.md` and the whole `vendor` folder. Click **Commit changes**.
3. Open **Settings → Pages**, choose **Deploy from a branch**, branch `main`, folder `/ (root)`, and **Save**.
4. In about a minute it is live at `https://<your-username>.github.io/folio/`.

It must be opened from a web address (GitHub Pages or a local server), not by double-clicking `index.html`, because browsers block the PDF engine's background worker on `file://` pages. To run it on your own computer: open a terminal in this folder and run `python3 -m http.server`, then visit http://localhost:8000.

## Features
**Pages:** merge any number of PDFs and images, drag to reorder (or Move earlier/later on phones), rotate, duplicate, delete, insert blank pages, download selected pages as a new PDF.
**Edit and sign:** type text anywhere (Helvetica, Times or Courier, any size and colour, bold, italic), signatures (draw, type in a script font, or upload a photo with automatic background removal, saved on your device for next time), images, ticks and crosses for forms, highlighter, whiteout, freehand drawing, today's date. Move, resize, duplicate and delete anything; arrow keys nudge.
**Get it signed:** add up to five signers, mark where each one signs (signature, initials, date signed, full name or text), then download a signing file and email it. Signers open it in Folio, are guided field by field, agree to sign electronically and download the signed PDF, which ends with a signing record page (document ID, original file fingerprint, who signed and when). With several signers the file passes from one to the next by email. No server is involved.
**Split:** every page, every N pages, or custom ranges like `1-3, 5, 7-9`. Several files download as one ZIP.
**Page numbers:** four styles, three positions, start number, skip cover pages.
**Watermark:** diagonal or straight text with adjustable strength.
**Compress:** three levels for scanned or photo-heavy PDFs. Folio refuses to download a "compressed" file that came out bigger.
**To images:** JPG or PNG at screen, standard or print quality, for all or selected pages.
Undo/redo for everything (Ctrl+Z / Ctrl+Shift+Z), Ctrl+S to download.

## Visitor and download counts
Folio counts visits, downloads and signings anonymously with the free Abacus counter: no cookies, no names, nothing for browsers that send *Do Not Track* or *Global Privacy Control*. See your totals at `https://<you>.github.io/folio/#stats`. Change `COUNTER.ns` in `app.js` to your own name, or set `COUNTER.on` to `false`.

Click the Folio logo to go back to the start screen.

## Limits worth knowing
- Signatures are *simple electronic signatures*: Folio records the name and email each signer chose but does not verify identity. That is enough for many everyday agreements, but some documents (for example property deeds, wills or regulated contracts) need a qualified or witnessed signature. Check what applies to yours.
- Folio adds new content on top of pages. It doesn't rewrite text that is already in a PDF; cover it with Whiteout and type over it.
- Password-protected PDFs need their password removed first.
- Text with characters outside Western European alphabets (for example Chinese, Arabic or emoji) is saved as a crisp image of the text, so it still displays correctly.
- Compressing turns pages into images, so text in the compressed copy can't be selected or searched.

## Built with
pdf.js 4.10.38 (Apache-2.0), pdf-lib 1.17.1 (MIT) and JSZip 3.10.1 (MIT), included in `vendor/` so the site has no outside dependencies apart from Google Fonts.
