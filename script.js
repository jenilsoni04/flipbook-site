const pdfUrls = [
    "./pdfs/mag1.pdf"
];

async function loadPDFs() {

    const pages = [];

    for (const pdfUrl of pdfUrls) {

        const pdf = await pdfjsLib.getDocument(pdfUrl).promise;

        for (let i = 1; i <= pdf.numPages; i++) {

            const page = await pdf.getPage(i);

            const viewport = page.getViewport({ scale: 1.5 });

            const canvas = document.createElement("canvas");

            const context = canvas.getContext("2d");

            canvas.width = viewport.width;
            canvas.height = viewport.height;

            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;

            const div = document.createElement("div");

            div.className = "page";

            div.appendChild(canvas);

            pages.push(div);
        }
    }

    const pageFlip = new St.PageFlip(
        document.getElementById("flipbook"),
        {
            width: 400,
            height: 600,
            showCover: true,
            mobileScrollSupport: false
        }
    );

    pageFlip.loadFromHTML(pages);
}

loadPDFs();