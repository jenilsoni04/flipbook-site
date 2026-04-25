const pdfUrls = [
    "./pdfs/mag1.pdf",
    "./pdfs/mag2.pdf"
];

async function loadPDFs() {

    const flipbook = document.getElementById("flipbook");

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

            const pageDiv = document.createElement("div");
            pageDiv.className = "page";

            pageDiv.appendChild(canvas);

            flipbook.appendChild(pageDiv);
        }
    }

    $("#flipbook").turn({
        width: 800,
        height: 600,
        autoCenter: true
    });
}

loadPDFs();