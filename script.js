/* ── PDF source from query param ─────────────────────────────── */
const params  = new URLSearchParams(window.location.search);
const pdfName = params.get('pdf') || 'mag1';
const pdfUrl  = `./pdfs/${pdfName}.pdf`;

/* ── DOM refs ────────────────────────────────────────────────── */
const loader      = document.getElementById('loader');
const loaderText  = document.getElementById('loader-text');
const flipbookEl  = document.getElementById('flipbook');
const btnPrev     = document.getElementById('btn-prev');
const btnNext     = document.getElementById('btn-next');
const pageCounter = document.getElementById('page-counter');
const pdfTitle    = document.getElementById('pdf-title');

/* Show readable title */
const pdfTitleParam = params.get('title');
pdfTitle.textContent = pdfTitleParam || pdfName.split('/').pop().replace(/[-_]/g, ' ');

/* ── Helpers ─────────────────────────────────────────────────── */
function updateCounter(current, total) {
  pageCounter.textContent = `Page ${current} / ${total}`;
}
function updateNavButtons(current, total) {
  btnPrev.disabled = current <= 1;
  btnNext.disabled = current >= total;
}

function getDisplaySize(rawW, rawH, divW, divH) {
  const na = rawW / rawH;
  const da = divW / divH;
  if (na > da) return { displayW: divW,                        displayH: Math.round(divW / na) };
  else         return { displayW: Math.round(divH * na),       displayH: divH };
}

/* Render one PDF page into its placeholder div */
async function renderPageIntoDiv(pageInfo, div, divW, divH) {
  const { displayW, displayH } = getDisplaySize(pageInfo.rawW, pageInfo.rawH, divW, divH);
  const renderVp = pageInfo.pdfPage.getViewport({ scale: (displayW * 1.5) / pageInfo.rawW });
  const canvas   = document.createElement('canvas');
  canvas.width   = renderVp.width;
  canvas.height  = renderVp.height;
  canvas.style.width  = displayW + 'px';
  canvas.style.height = displayH + 'px';

  await pageInfo.pdfPage.render({
    canvasContext: canvas.getContext('2d'),
    viewport: renderVp,
  }).promise;

  /* Swap placeholder content for the real canvas */
  div.innerHTML = '';
  div.appendChild(canvas);
}

/* Plain placeholder — NO position:relative so turn.js layout is unaffected */
function createPlaceholderDiv(divW, divH) {
  const div        = document.createElement('div');
  div.className    = 'page';
  div.style.width  = divW + 'px';
  div.style.height = divH + 'px';
  div.style.background = '#efefef'; /* light grey until real render arrives */
  return div;
}

/* ── Main loader ─────────────────────────────────────────────── */
async function loadPDF() {
  try {
    loaderText.textContent = 'Loading PDF…';
    const pdf        = await pdfjsLib.getDocument(pdfUrl).promise;
    const totalPages = pdf.numPages;

    /* STEP 1 — Collect page dimensions (no pixel decoding yet) */
    loaderText.textContent = 'Analysing layout…';
    const pageInfos = [];
    for (let i = 1; i <= totalPages; i++) {
      const p  = await pdf.getPage(i);
      const vp = p.getViewport({ scale: 1 });
      pageInfos.push({
        pdfPage:  p,
        isSpread: vp.width > vp.height * 1.3,
        rawW:     vp.width,
        rawH:     vp.height,
      });
    }

    const allSpreads = pageInfos.every(p => p.isSpread);

    /* Narrowest portrait page as reference (minimises letterboxing) */
    const portraitInfos = pageInfos.filter(p => !p.isSpread);
    const refInfo = (portraitInfos.length ? portraitInfos : pageInfos)
      .reduce((min, p) => (p.rawW / p.rawH) < (min.rawW / min.rawH) ? p : min);

    const bookW = allSpreads ? refInfo.rawW : refInfo.rawW * 2;
    const bookH = refInfo.rawH;

    /* Fit into available viewport space */
    const scale      = Math.min((window.innerWidth - 140) / bookW, (window.innerHeight - 110) / bookH);
    const finalBookW = Math.round(bookW * scale);
    const finalBookH = Math.round(bookH * scale);
    const finalPageW = allSpreads ? finalBookW : Math.round(refInfo.rawW * scale);

    /* STEP 2 — Insert ALL placeholder divs so turn.js sees the right page count */
    const divs = [];
    for (let i = 0; i < totalPages; i++) {
      const info = pageInfos[i];
      const divW = info.isSpread ? finalBookW : finalPageW;
      const div  = createPlaceholderDiv(divW, finalBookH);
      divs.push({ div, divW, info });
      flipbookEl.appendChild(div);
    }

    /* STEP 3 — Render first few pages eagerly so flipbook appears fast */
    const EAGER = 4;
    for (let i = 0; i < Math.min(EAGER, totalPages); i++) {
      loaderText.textContent = `Rendering page ${i + 1} of ${totalPages}…`;
      const { div, divW, info } = divs[i];
      await renderPageIntoDiv(info, div, divW, finalBookH);
    }

    /* STEP 4 — Show flipbook & init turn.js */
    loader.classList.add('hidden');
    setTimeout(() => { loader.style.display = 'none'; }, 450);

    const $book = $('#flipbook');
    $book.turn({
      width:      finalBookW,
      height:     finalBookH,
      autoCenter: true,
      gradients:  true,
      /*
       * display:'double' is kept for the whole session.
       * Turn.js natively shows page 1 (cover) alone on the right and the
       * last page alone on the left — no manual single/double switching needed.
       */
      display:    allSpreads ? 'single' : 'double',
      elevation:  50,
      when: {
        turning(e, page) {
          updateCounter(page, totalPages);
          updateNavButtons(page, totalPages);
        },
      },
    });

    /* Click left/right half to flip */
    $book.click(function (e) {
      const w = $(this).width();
      const x = e.pageX - $(this).offset().left;
      if (x < w / 2) $(this).turn('previous');
      else           $(this).turn('next');
    });

    btnPrev.addEventListener('click', () => $book.turn('previous'));
    btnNext.addEventListener('click', () => $book.turn('next'));

    updateCounter(1, totalPages);
    updateNavButtons(1, totalPages);

    /* STEP 5 — Background render remaining pages in small batches */
    const remaining = divs.slice(EAGER);

    async function renderBatch(start) {
      const BATCH = 2;
      for (let b = start; b < Math.min(start + BATCH, remaining.length); b++) {
        const { div, divW, info } = remaining[b];
        await renderPageIntoDiv(info, div, divW, finalBookH);
      }
      const next = start + BATCH;
      if (next < remaining.length) {
        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(() => renderBatch(next), { timeout: 2000 });
        } else {
          setTimeout(() => renderBatch(next), 50);
        }
      }
    }

    if (remaining.length > 0) setTimeout(() => renderBatch(0), 400);

  } catch (err) {
    console.error('PDF load error:', err);
    loaderText.textContent = '⚠ Failed to load PDF. Check the file name in the URL.';
  }
}

loadPDF();