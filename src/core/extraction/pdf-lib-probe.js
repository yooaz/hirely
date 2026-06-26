/**
 * pdf-lib document probe — metadata only (text extraction stays on pdf.js).
 */

/**
 * @param {ArrayBuffer} buffer
 * @returns {Promise<{ loaded: boolean, pageCount: number, title?: string, producer?: string }|null>}
 */
export async function probePdfWithPdfLib(buffer) {
  const PDFLib = globalThis.PDFLib || globalThis.window?.PDFLib;
  if (!PDFLib?.PDFDocument?.load) return null;
  try {
    const doc = await PDFLib.PDFDocument.load(buffer, { ignoreEncryption: true });
    const pageCount = doc.getPageCount();
    let title = '';
    let producer = '';
    try {
      title = doc.getTitle() || '';
      producer = doc.getProducer() || '';
    } catch {
      /* optional meta */
    }
    return { loaded: true, pageCount, title, producer };
  } catch (e) {
    console.warn('HIRELY pdf-lib probe', e);
    return { loaded: false, pageCount: 0 };
  }
}
