const pdfUrls = [
    "./pdfs/mag1.pdf",
    "./pdfs/mag2.pdf"
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

            // Create flipbook page
            const pageElement = document.createElement("div");
            pageElement.classList.add("page");

            pageElement.appendChild(canvas);

            pages.push(pageElement);
        }
    }

    const flipbook = new St.PageFlip(
        document.getElementById("flipbook"),
        {
            width: 400,
            height: 600,
            showCover: true,
            mobileScrollSupport: false,
        }
    );

    flipbook.loadFromHTML(pages);
}

loadPDFs();