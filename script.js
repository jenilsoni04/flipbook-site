const pdfUrl = "./pdfs/mag1.pdf";

async function loadPDF() {

    const pdf = await pdfjsLib.getDocument(pdfUrl).promise;

    const flipbook = document.getElementById("flipbook");

    for (let i = 1; i <= pdf.numPages; i++) {

        const page = await pdf.getPage(i);

        const viewport = page.getViewport({ scale: 1 });

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

        flipbook.appendChild(div);
    }

    $("#flipbook").turn({
        width: 800,
        height: 600,
        autoCenter: true
    });
}

loadPDF();