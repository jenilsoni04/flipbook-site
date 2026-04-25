const pdfUrl = "pdfs/mag1.pdfs";

pdfjsLib.getDocument(pdfUrl).promise.then(async pdf => {

    const pages = [];

    for(let i = 1; i <= pdf.numPages; i++){

        const page = await pdf.getPage(i);

        const viewport = page.getViewport({scale:1.5});

        const canvas = document.createElement("canvas");

        const context = canvas.getContext("2d");

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;

        pages.push(canvas);
    }

    const flipbook = new St.PageFlip(
        document.getElementById("flipbook"),
        {
            width: 400,
            height: 600,
        }
    );

    flipbook.loadFromHTML(pages);
});