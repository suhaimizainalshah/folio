# Folio: free PDF editor that runs in your browser

Merge, split, reorder, rotate, sign, fill in, annotate, number, watermark, compress and convert PDFs. No account, no limits, no watermarks. Files are processed on the visitor's own device and never uploaded.

## Features
**Pages:** merge any number of PDFs and images, drag to reorder (or Move earlier/later on phones), rotate, duplicate, delete, insert blank pages, download selected pages as a new PDF.
**Edit and sign:** type text anywhere (Helvetica, Times or Courier, any size and colour, bold, italic), signatures (draw, type in a script font, or upload a photo with automatic background removal, saved on your device for next time), images, ticks and crosses for forms, highlighter, whiteout, freehand drawing, today's date. Move, resize, duplicate and delete anything; arrow keys nudge.
**Get it signed:** add up to five signers, mark where each one signs (signature, initials, date signed, full name or text), then download a signing file and email it. Signers open it in Folio, are guided field by field, agree to sign electronically and download the signed PDF, which ends with a signing record page (document ID, original file fingerprint, who signed and when). With several signers the file passes from one to the next by email. No server is involved.
**Split:** every page, every N pages, or custom ranges like `1-3, 5, 7-9`. Several files download as one ZIP.
**Page numbers:** four styles, three positions, start number, skip cover pages.
**Watermark:** diagonal or straight text with adjustable strength.
**Convert:** save as a **Word document** (editable text with headings, paragraphs and bullet points, or an exact-look version with each page as a picture), a **PowerPoint** deck (one slide per page, with each page's text copied into the speaker notes), or JPG/PNG images. Works on all pages or only the ones you select.
**Fill form:** finds the PDF's own fillable fields (text boxes, tick boxes, drop-downs and option buttons), lets you complete them, and can lock the answers so they can't be changed.
**Redact:** in Edit and sign, drag a black box over anything sensitive. On download, every redacted page is rebuilt as an image, so the hidden text is permanently removed, not just covered.
**Document properties:** set the title, author, subject and keywords saved inside the PDF (in the Pages panel).
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
- Word conversion rebuilds text, headings and lists, not exact layouts such as columns, tables or images. Use "Exact look" when appearance matters more than editing. Scanned PDFs contain no text to extract.
- Compressing turns pages into images, so text in the compressed copy can't be selected or searched.

## Built with
pdf.js 4.10.38 (Apache-2.0), pdf-lib 1.17.1 (MIT), JSZip 3.10.1 (MIT), docx 9.0.2 (MIT) and PptxGenJS 3.12.0 (MIT), included in `vendor/` so the site has no outside dependencies apart from Google Fonts.

## Compare, Bates, flipbook and text recognition
- **Compare two versions:** finds every word added, removed or changed between the open document (or any PDF) and a revised PDF. See each change by page, then download the revised version with changes highlighted, the original with removals struck through, or a plain-text change report. Compares wording, not layout or images.
- **Bates numbering and stamps:** prefix, start number, digits and suffix (for example ABC000001), four positions, an optional stamp such as “CONFIDENTIAL”, and a white box for legibility. Number the open document, or many PDFs in sequence: they download as a ZIP with an `index.csv` of each file’s number range. Rotated pages are handled.
- **Flipbook:** turns the document into a single, self-contained HTML page with page-turning, two-page spreads on wide screens, swipe, arrow keys, zoom and full screen. Email it, open it offline or upload it to any website.
- **Read text (OCR):** recognises text in scanned pages in 12 languages and saves a searchable PDF (an invisible text layer over the original pages) or a text file. It uses Tesseract.js, which the browser downloads from jsDelivr the first time it is used (about 5 to 15 MB, including language data); the document itself never leaves the device. Searchable PDFs support Latin-script languages; Arabic and Chinese save as text files.
