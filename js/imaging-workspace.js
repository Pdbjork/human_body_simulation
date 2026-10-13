import { IMAGING_LIMITS, ImagingError, inspectImage, parseDicom, renderDicomGrayscale } from './imaging-parser.js';

export function mountImagingWorkspace(container) {
    container.innerHTML = `
        <h2>Private image viewer</h2>
        <p>View your own still images locally. This is an educational viewer, not a diagnostic workstation: it does not read scans, detect disease, or interpret a radiology report.</p>
        <p class="imaging-notice"><strong>Privacy:</strong> nothing you select is transmitted or saved by this viewer. Patient tags and filenames are not listed. Image pixels themselves may contain names or other identifying text; hiding metadata does not de-identify an image. Use only files you have permission to view.</p>
        <label class="imaging-consent"><input type="checkbox" data-imaging="consent"> I consent to processing my selected image in this browser’s memory for this session.</label>
        <div class="imaging-actions">
            <label class="imaging-file-label">Choose one image <input type="file" data-imaging="file" accept=".png,.jpg,.jpeg,.dcm,application/dicom,image/png,image/jpeg" disabled></label>
            <button type="button" data-imaging="delete" disabled>Delete image</button>
        </div>
        <p class="imaging-small">PNG/JPEG or supported DICOM Part 10. Maximum 32 MiB, 4096 pixels per side, and 8,388,608 pixels total. Selecting another image deletes the previous one. Revoking consent or clearing personal data also deletes it.</p>
        <p data-imaging="status" class="imaging-status" role="status" aria-live="polite">Consent is required before the file can be read.</p>
        <div data-imaging="viewer" hidden>
            <dl data-imaging="metadata" class="imaging-metadata"></dl>
            <div class="imaging-controls">
                <label>Zoom <input type="range" data-imaging="zoom" min="0.1" max="4" step="0.05" value="1"></label>
                <output data-imaging="zoom-label">100%</output>
                <button type="button" data-imaging="fit">Fit to viewer</button>
            </div>
            <div data-imaging="dicom-controls" class="imaging-controls" hidden>
                <label>Window center <input type="number" data-imaging="center" step="any"></label>
                <label>Window width <input type="number" data-imaging="width" min="1" step="any"></label>
                <button type="button" data-imaging="window">Apply contrast window</button>
                <button type="button" data-imaging="reset-window">Reset contrast</button>
            </div>
            <p data-imaging="dicom-note" class="imaging-small" hidden>Illustrative grayscale only. The first embedded LINEAR window is used when available; otherwise the full pixel range is shown (including padding). No orientation correction, spatial calibration, overlays, presentation states, or diagnostic interpretation. Contrast controls change display only.</p>
            <div data-imaging="viewport" class="imaging-viewport" tabindex="0" aria-label="Image preview, scroll to explore when zoomed">
                <canvas data-imaging="canvas" role="img" aria-label="Locally selected image. No automated interpretation is provided." width="0" height="0"></canvas>
            </div>
        </div>
        <details class="imaging-support">
            <summary>Supported DICOM and important limitations</summary>
            <p>The parser reads real image dimensions and integer pixels from single-frame, 8- or 16-bit, MONOCHROME1/2 Part 10 files using Implicit VR Little Endian or Explicit VR Little Endian. Signed pixels, stored-bit offsets, rescale slope/intercept, and linear window center/width are applied.</p>
            <p>Compressed/encapsulated, deflated, Big Endian, multiframe, color/palette, floating-point, lookup-table sequences, non-linear window functions, non-identity presentation LUT shapes, raw datasets without a Part 10 header, and oversized images are explicitly unsupported. There is no slice navigation, DICOMweb, PACS connection, AI analysis, export, or server upload.</p>
            <p>Do not use this preview to make care decisions. Ask the clinician or radiologist who ordered the study to explain the official report. Browser memory is released on deletion; this cannot erase your source file, screenshots, or browser/operating-system memory outside this page’s control.</p>
        </details>`;
    const find = (name) => container.querySelector(`[data-imaging="${name}"]`);
    const consent = find('consent');
    const input = find('file');
    const deleteButton = find('delete');
    const status = find('status');
    const viewer = find('viewer');
    const metadata = find('metadata');
    const canvas = find('canvas');
    const viewport = find('viewport');
    const zoom = find('zoom');
    const center = find('center');
    const width = find('width');
    const dicomControls = find('dicom-controls');
    let generation = 0;
    let reader = null;
    let dicom = null;
    let currentBuffer = null;
    let mounted = true;

    function eraseBuffer(buffer) {
        if (buffer) new Uint8Array(buffer).fill(0);
    }
    function clearImage(message = 'The image has been deleted from this session.') {
        generation++;
        if (reader) {
            const pendingReader = reader;
            reader = null;
            pendingReader.abort();
        }
        eraseBuffer(currentBuffer);
        currentBuffer = null;
        if (dicom) dicom.pixels.fill(0);
        dicom = null;
        canvas.width = 0;
        canvas.height = 0;
        canvas.style.width = '';
        canvas.style.height = '';
        metadata.replaceChildren();
        input.value = '';
        center.value = '';
        width.value = '';
        viewer.hidden = true;
        dicomControls.hidden = true;
        find('dicom-note').hidden = true;
        deleteButton.disabled = true;
        status.textContent = message;
    }
    function clearPersonalData() {
        consent.checked = false;
        input.disabled = true;
        clearImage('Image data cleared and consent revoked. No image remains in this viewer.');
    }
    function addMetadata(label, value) {
        const term = document.createElement('dt');
        term.textContent = label;
        const description = document.createElement('dd');
        description.textContent = String(value);
        metadata.append(term, description);
    }
    function setZoom(value) {
        const scale = Math.max(0.1, Math.min(4, value));
        zoom.value = String(scale);
        canvas.style.width = `${canvas.width * scale}px`;
        canvas.style.height = `${canvas.height * scale}px`;
        find('zoom-label').textContent = `${Math.round(scale * 100)}%`;
    }
    function fit() {
        if (!canvas.width) return;
        const available = Math.max(1, viewport.clientWidth - 24);
        setZoom(Math.min(1, available / canvas.width));
    }
    function drawDicom(windowCenter = dicom.center, windowWidth = dicom.width) {
        const rgba = renderDicomGrayscale(dicom, windowCenter, windowWidth);
        try {
            const context = canvas.getContext('2d');
            if (!context) throw new ImagingError('Canvas rendering is unavailable in this browser.');
            context.putImageData(new ImageData(rgba, dicom.metadata.width, dicom.metadata.height), 0, 0);
        } finally {
            rgba.fill(0);
        }
    }
    function readFile(file) {
        return new Promise((resolve, reject) => {
            const activeReader = new FileReader();
            reader = activeReader;
            const finish = () => {
                if (reader === activeReader) reader = null;
                activeReader.onload = null;
                activeReader.onerror = null;
                activeReader.onabort = null;
            };
            activeReader.onload = () => {
                const result = activeReader.result;
                finish();
                resolve(result);
            };
            activeReader.onerror = () => {
                finish();
                reject(new ImagingError('The browser could not read this file. Please choose it again.'));
            };
            activeReader.onabort = () => {
                finish();
                reject(new DOMException('Image reading cancelled.', 'AbortError'));
            };
            activeReader.readAsArrayBuffer(file);
        });
    }

    async function openSelectedImage() {
        let file = input.files?.[0] ?? null;
        input.value = '';
        if (!file) return;
        if (!consent.checked) {
            file = null;
            clearImage('Consent is required before the file can be read.');
            return;
        }
        clearImage('Reading this image locally; no file is being uploaded.');
        const ticket = generation;
        deleteButton.disabled = false;
        let buffer = null;
        let bitmap = null;
        try {
            if (!file.size || file.size > IMAGING_LIMITS.bytes) throw new ImagingError('Choose a non-empty image no larger than 32 MiB.');
            buffer = await readFile(file);
            file = null;
            if (!mounted || ticket !== generation || !consent.checked) return;
            currentBuffer = buffer;
            const header = inspectImage(buffer);
            if (header.format === 'DICOM') {
                dicom = parseDicom(buffer);
                canvas.width = dicom.metadata.width;
                canvas.height = dicom.metadata.height;
                drawDicom();
                center.value = String(dicom.center);
                width.value = String(dicom.width);
                dicomControls.hidden = false;
                find('dicom-note').hidden = false;
                addMetadata('Format', dicom.metadata.format);
                addMetadata('Dimensions', `${canvas.width} × ${canvas.height} pixels · single frame`);
                addMetadata('Encoding', dicom.metadata.encoding);
                addMetadata('Image type', `${dicom.metadata.photometric} · ${dicom.metadata.bitsStored}-bit ${dicom.metadata.signed ? 'signed' : 'unsigned'}`);
                addMetadata('Modality code', dicom.metadata.modality);
                addMetadata('Initial contrast', dicom.metadata.windowSource);
            } else {
                if (typeof createImageBitmap !== 'function') throw new ImagingError('This browser does not support the private image decoder. Use a current browser with createImageBitmap support.');
                // The Blob is temporary, never persisted, transmitted, or assigned an object URL.
                bitmap = await createImageBitmap(new Blob([buffer], { type: header.mime }));
                if (!mounted || ticket !== generation || !consent.checked) return;
                if (bitmap.width > IMAGING_LIMITS.dimension || bitmap.height > IMAGING_LIMITS.dimension || bitmap.width * bitmap.height > IMAGING_LIMITS.pixels || !bitmap.width || !bitmap.height) {
                    throw new ImagingError('Decoded image dimensions exceed the local viewer’s limits.');
                }
                canvas.width = bitmap.width;
                canvas.height = bitmap.height;
                const context = canvas.getContext('2d');
                if (!context) throw new ImagingError('Canvas rendering is unavailable in this browser.');
                context.drawImage(bitmap, 0, 0);
                addMetadata('Format', header.format);
                addMetadata('Dimensions', `${canvas.width} × ${canvas.height} pixels`);
            }
            viewer.hidden = false;
            fit();
            status.textContent = 'Local preview ready. No diagnostic analysis was performed. Delete the image when finished.';
        } catch (error) {
            if (!mounted || ticket !== generation || error?.name === 'AbortError') return;
            clearImage(error instanceof ImagingError ? error.message : 'This image could not be decoded safely. It may be damaged or use an unsupported image encoding.');
        } finally {
            bitmap?.close();
            bitmap = null;
            file = null;
            eraseBuffer(buffer);
            if (currentBuffer === buffer) currentBuffer = null;
            buffer = null;
        }
    }
    consent.addEventListener('change', () => {
        input.disabled = !consent.checked;
        if (!consent.checked) clearImage('Consent revoked; the image has been deleted.');
        else status.textContent = 'Ready for a local image. No file will be sent anywhere.';
    });
    input.addEventListener('change', openSelectedImage);
    deleteButton.addEventListener('click', () => clearImage());
    zoom.addEventListener('input', () => setZoom(Number(zoom.value)));
    find('fit').addEventListener('click', fit);
    find('window').addEventListener('click', () => {
        if (!dicom) return;
        try {
            if (!center.value.trim() || !width.value.trim()) throw new ImagingError('Enter both a window center and width.');
            drawDicom(Number(center.value), Number(width.value));
            status.textContent = 'Display contrast updated. Pixel values are unchanged; this is not a diagnostic interpretation.';
        } catch (error) {
            status.textContent = error instanceof ImagingError ? error.message : 'The display contrast could not be updated.';
        }
    });
    find('reset-window').addEventListener('click', () => {
        if (!dicom) return;
        center.value = String(dicom.center);
        width.value = String(dicom.width);
        drawDicom();
        status.textContent = 'Initial display contrast restored.';
    });
    window.addEventListener('body-clear-personal-data', clearPersonalData);
    window.addEventListener('pagehide', clearPersonalData);
    return () => {
        mounted = false;
        clearPersonalData();
        window.removeEventListener('body-clear-personal-data', clearPersonalData);
        window.removeEventListener('pagehide', clearPersonalData);
        input.removeEventListener('change', openSelectedImage);
        container.replaceChildren();
    };
}
