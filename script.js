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
const displayTitle = pdfTitleParam || pdfName.split('/').pop().replace(/[-_]/g, ' ');
pdfTitle.textContent = displayTitle;
document.title = displayTitle + ' — Jagruti Library';

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
async function renderPageIntoDiv(info, div, fallbackDivW, divH, finalBookW, pdfDoc) {
  if (info.isRendered || info.isRendering) return;
  info.isRendering = true;

  const page = await pdfDoc.getPage(info.pageNum);
  const vp = page.getViewport({ scale: 1 });
  const rawW = vp.width;
  const rawH = vp.height;
  const isSpread = rawW > rawH * 1.3;

  const divW = isSpread ? finalBookW : fallbackDivW;
  div.style.width = divW + 'px';

  const { displayW, displayH } = getDisplaySize(rawW, rawH, divW, divH);
  /* Account for high-DPI (Retina) displays to prevent blurriness */
  const dpr = window.devicePixelRatio || 1;
  const renderScale = Math.max(1.2, dpr); /* Use device pixel ratio for crisp text */
  const renderVp = page.getViewport({ scale: (displayW * renderScale) / rawW });
  const canvas   = document.createElement('canvas');
  canvas.width   = renderVp.width;
  canvas.height  = renderVp.height;
  canvas.style.width  = displayW + 'px';
  canvas.style.height = displayH + 'px';

  await page.render({
    canvasContext: canvas.getContext('2d'),
    viewport: renderVp,
  }).promise;

  /* Swap placeholder content for the real canvas */
  div.innerHTML = '';
  div.appendChild(canvas);
  
  info.isRendering = false;
  info.isRendered = true;
}

function destroyPage(pageInfo, div) {
  if (pageInfo.isRendered && !pageInfo.isRendering) {
    div.innerHTML = ''; // Clear canvas to free memory
    pageInfo.isRendered = false;
  }
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

/* ── Error timeout ─────────────────────────────────────────────── */
let loadTimeoutId = null;
function startLoadTimeout() {
  loadTimeoutId = setTimeout(() => {
    loaderText.innerHTML =
      '⚠ Failed to load PDF — check your connection.<br>' +
      '<button onclick="location.reload()" style="margin-top:14px;padding:8px 22px;' +
      'border-radius:20px;border:none;background:#7c6ff7;color:#fff;font-size:0.85rem;' +
      'cursor:pointer;">Retry</button>';
  }, 20000);
}
function clearLoadTimeout() {
  if (loadTimeoutId) clearTimeout(loadTimeoutId);
}

/* ── Main loader ─────────────────────────────────────────────── */
async function loadPDF() {
  try {
    startLoadTimeout();
    loaderText.textContent = 'Loading PDF…';
    const pdf        = await pdfjsLib.getDocument(pdfUrl).promise;
    const totalPages = pdf.numPages;

    /* STEP 1 — Fast Layout Analysis (Only fetch first 1-2 pages) */
    loaderText.textContent = 'Analysing layout…';
    const p1 = await pdf.getPage(1);
    const vp1 = p1.getViewport({ scale: 1 });
    const isP1Spread = vp1.width > vp1.height * 1.3;
    
    let refInfo = { rawW: vp1.width, rawH: vp1.height };
    let allSpreads = false;

    // Determine layout from first two pages instead of scanning entire document
    if (totalPages > 1) {
      const p2 = await pdf.getPage(2);
      const vp2 = p2.getViewport({ scale: 1 });
      const isP2Spread = vp2.width > vp2.height * 1.3;
      
      if (isP1Spread && isP2Spread) {
         allSpreads = true;
      } else if (isP1Spread && !isP2Spread) {
         refInfo = { rawW: vp2.width, rawH: vp2.height };
      }
    } else {
      if (isP1Spread) allSpreads = true;
    }

    const bookW = allSpreads ? refInfo.rawW : refInfo.rawW * 2;
    const bookH = refInfo.rawH;

    /* Fit into available viewport space */
    const scale      = Math.min((window.innerWidth - 140) / bookW, (window.innerHeight - 110) / bookH);
    const finalBookW = Math.round(bookW * scale);
    const finalBookH = Math.round(bookH * scale);
    const finalPageW = allSpreads ? finalBookW : Math.round(refInfo.rawW * scale);

    /* STEP 2 — Insert ALL placeholder divs instantly */
    const divs = [];
    for (let i = 0; i < totalPages; i++) {
      const info = { pageNum: i + 1, isRendered: false, isRendering: false };
      const div  = createPlaceholderDiv(finalPageW, finalBookH);
      divs.push({ div, fallbackDivW: finalPageW, finalBookW, info });
      flipbookEl.appendChild(div);
    }

    /* STEP 3 — Render first 2 pages in parallel — show the book ASAP */
    const EAGER = 2;
    loaderText.textContent = `Opening flipbook…`;
    await Promise.all(
      divs.slice(0, Math.min(EAGER, totalPages)).map(({ div, fallbackDivW, finalBookW, info }) =>
        renderPageIntoDiv(info, div, fallbackDivW, finalBookH, finalBookW, pdf)
      )
    );

    /* STEP 4 — Show flipbook & init turn.js */
    clearLoadTimeout();
    loader.classList.add('hidden');
    setTimeout(() => { loader.style.display = 'none'; }, 450);

    /* Reveal page counter now that we have real data */
    pageCounter.style.visibility = 'visible';

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
          if (typeof manageMemory === 'function') manageMemory(page);
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

    /* STEP 5 — Just-In-Time (JIT) Memory Management */
    window.manageMemory = function(currentPage) {
      const BUFFER = 4; // Keep 4 pages ahead and 4 pages behind in memory
      divs.forEach((item, index) => {
        const pageNum = index + 1;
        if (pageNum >= currentPage - BUFFER && pageNum <= currentPage + BUFFER) {
          // Render if in buffer range
          renderPageIntoDiv(item.info, item.div, item.fallbackDivW, finalBookH, item.finalBookW, pdf);
        } else {
          // Destroy canvas if outside buffer range to save RAM
          destroyPage(item.info, item.div);
        }
      });
    };

    // Load initial buffer for the first page
    manageMemory(1);

  } catch (err) {
    clearLoadTimeout();
    console.error('PDF load error:', err);
    loaderText.innerHTML =
      '⚠ Failed to load PDF. Check the file name in the URL.<br>' +
      '<button onclick="location.reload()" style="margin-top:14px;padding:8px 22px;' +
      'border-radius:20px;border:none;background:#7c6ff7;color:#fff;font-size:0.85rem;' +
      'cursor:pointer;">Retry</button>';
  }
}

/* ── Keyboard navigation ────────────────────────────────────── */
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    if (!btnNext.disabled) $('#flipbook').turn('next');
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    if (!btnPrev.disabled) $('#flipbook').turn('previous');
  }
});

loadPDF();