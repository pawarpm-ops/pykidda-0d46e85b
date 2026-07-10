// Shared helper for exporting a DOM node to a multi-page A4 PDF.
// Uses html-to-image (foreignObject-based) instead of html2canvas so modern
// CSS color functions like oklch(...) and color-mix(...) render correctly.

export async function exportNodeToPdf(node: HTMLElement, fileName: string) {
  if (!node) throw new Error("Nothing to export");

  const [{ toPng }, { jsPDF }] = await Promise.all([
    import("html-to-image"),
    import("jspdf"),
  ]);

  const bgColor = getComputedStyle(document.body).backgroundColor || "#ffffff";
  const scale = Math.min(2, window.devicePixelRatio || 1) || 2;

  // Two attempts: preferred (SVG foreignObject) then fallback rasterization
  // that inlines images. If both fail we surface the error to the caller.
  let dataUrl: string;
  try {
    dataUrl = await toPng(node, {
      backgroundColor: bgColor,
      pixelRatio: scale,
      cacheBust: true,
      skipFonts: false,
    });
  } catch (err) {
    // Retry once with a lower pixel ratio (safari memory quirks)
    dataUrl = await toPng(node, {
      backgroundColor: bgColor,
      pixelRatio: 1,
      cacheBust: true,
      skipFonts: true,
    });
  }

  // Measure the produced PNG for correct aspect ratio
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });

  const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 20;
  const imgW = pageW - margin * 2;
  const imgH = (img.height * imgW) / img.width;

  if (imgH <= pageH - margin * 2) {
    pdf.addImage(dataUrl, "PNG", margin, margin, imgW, imgH);
  } else {
    // Draw the same image on each page, shifted upward
    let remaining = imgH;
    let offset = 0;
    while (remaining > 0) {
      pdf.addImage(dataUrl, "PNG", margin, margin - offset, imgW, imgH);
      remaining -= pageH - margin * 2;
      if (remaining > 0) {
        pdf.addPage();
        offset += pageH - margin * 2;
      }
    }
  }

  const safeName = fileName.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "") || "report";
  pdf.save(`${safeName}.pdf`);
}
