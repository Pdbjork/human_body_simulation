// Deliberately limited, local-only still-image decoder. It does not interpret images.
export const IMAGING_LIMITS = Object.freeze({ bytes: 32 * 1024 * 1024, pixels: 8 * 1024 * 1024, dimension: 4096 });
const MAX_ELEMENTS = 100000;
const MAX_DEPTH = 16;
const LONG_VR = new Set(['OB', 'OD', 'OF', 'OL', 'OV', 'OW', 'SQ', 'UC', 'UR', 'UT', 'UN']);
const VALID_VR = new Set(['AE', 'AS', 'AT', 'CS', 'DA', 'DS', 'DT', 'FD', 'FL', 'IS', 'LO', 'LT', 'PN', 'SH', 'SL', 'SS', 'ST', 'SV', 'TM', 'UI', 'UL', 'US', 'UV', ...LONG_VR]);
const MODALITIES = new Set(['CR', 'CT', 'DX', 'MG', 'MR', 'NM', 'OT', 'PT', 'RF', 'RTIMAGE', 'SC', 'US', 'XA', 'XC']);
const TAGS = new Map([
    [0x00080060, ['modality', 'CS']],
    [0x00280002, ['samples', 'US']], [0x00280004, ['photometric', 'CS']],
    [0x00280008, ['frames', 'IS']], [0x00280010, ['rows', 'US']],
    [0x00280011, ['columns', 'US']], [0x00280100, ['bitsAllocated', 'US']],
    [0x00280101, ['bitsStored', 'US']], [0x00280102, ['highBit', 'US']],
    [0x00280103, ['representation', 'US']], [0x00281050, ['center', 'DS']],
    [0x00281051, ['width', 'DS']], [0x00281052, ['intercept', 'DS']],
    [0x00281053, ['slope', 'DS']], [0x00281056, ['voiFunction', 'CS']],
    [0x20500020, ['presentationShape', 'CS']]
]);

export class ImagingError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ImagingError';
    }
}

function reject(message) { throw new ImagingError(message); }
function bounds(view, offset, length) {
    if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0 || offset > view.byteLength - length) {
        reject('The image is truncated or contains an out-of-bounds data length.');
    }
}
function inputView(buffer) {
    if (!(buffer instanceof ArrayBuffer) || !buffer.byteLength) reject('Choose a non-empty PNG, JPEG, or DICOM Part 10 file.');
    if (buffer.byteLength > IMAGING_LIMITS.bytes) reject('The local viewer accepts files up to 32 MiB.');
    return new DataView(buffer);
}
function dimensions(width, height) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > IMAGING_LIMITS.dimension || height > IMAGING_LIMITS.dimension || width * height > IMAGING_LIMITS.pixels) {
        reject('Image dimensions exceed this viewer: at most 4096 per side and 8,388,608 pixels.');
    }
}
function ascii(view, offset, length) {
    bounds(view, offset, length);
    if (length > 256) reject('A supported DICOM metadata value is too long.');
    let result = '';
    for (let i = 0; i < length; i++) result += String.fromCharCode(view.getUint8(offset + i));
    return result.replace(/[\0 ]+$/, '');
}
function numeric(value, name, integer = false, multiple = false) {
    const first = (multiple ? value.split('\\')[0] : value).trim();
    const expression = integer ? /^[+-]?\d+$/ : /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;
    if (!expression.test(first) || !Number.isFinite(Number(first))) reject(`Invalid DICOM ${name}.`);
    return Number(first);
}
function element(view, offset, explicit, budget) {
    if (++budget.count > MAX_ELEMENTS) reject('The DICOM element count exceeds the safe parsing limit.');
    bounds(view, offset, 8);
    const group = view.getUint16(offset, true);
    const item = view.getUint16(offset + 2, true);
    let vr = null;
    let length;
    let start = offset + 8;
    if (explicit && group !== 0xfffe) {
        vr = ascii(view, offset + 4, 2);
        if (!VALID_VR.has(vr)) reject('Invalid explicit DICOM value representation.');
        if (LONG_VR.has(vr)) {
            bounds(view, offset, 12);
            if (view.getUint16(offset + 6, true) !== 0) reject('Invalid DICOM reserved header bytes.');
            length = view.getUint32(offset + 8, true);
            start = offset + 12;
        } else {
            length = view.getUint16(offset + 6, true);
        }
    } else {
        length = view.getUint32(offset + 4, true);
    }
    if (length !== 0xffffffff) bounds(view, start, length);
    return { group, item, tag: group * 0x10000 + item, vr, length, start, end: start + length };
}

// Undefined-length sequences are walked, never searched bytewise for delimiters.
// Defined-length items can be skipped without retaining their (possibly identifying) data.
function skipSequence(view, offset, explicit, budget, depth = 0) {
    if (depth >= MAX_DEPTH) reject('DICOM sequence nesting exceeds the safe parsing limit.');
    while (offset < view.byteLength) {
        const entry = element(view, offset, explicit, budget);
        if (entry.tag === 0xfffee0dd) {
            if (entry.length !== 0) reject('Invalid DICOM sequence delimiter.');
            return entry.end;
        }
        if (entry.tag !== 0xfffee000) reject('Invalid DICOM sequence item.');
        if (entry.length !== 0xffffffff) { offset = entry.end; continue; }
        offset = entry.start;
        let closed = false;
        while (offset < view.byteLength) {
            const child = element(view, offset, explicit, budget);
            if (child.tag === 0xfffee00d) {
                if (child.length !== 0) reject('Invalid DICOM item delimiter.');
                offset = child.end;
                closed = true;
                break;
            }
            if (child.group === 0xfffe) reject('Unexpected DICOM item delimiter.');
            if (child.length === 0xffffffff) {
                if (explicit && child.vr !== 'SQ') reject('Undefined-length non-sequence values are unsupported.');
                offset = skipSequence(view, child.start, explicit, budget, depth + 1);
            } else {
                offset = child.end;
            }
        }
        if (!closed) reject('The DICOM sequence item is incomplete.');
    }
    reject('The DICOM sequence is incomplete.');
}

export function parseDicom(buffer) {
    const view = inputView(buffer);
    bounds(view, 0, 132);
    if (ascii(view, 128, 4) !== 'DICM') reject('DICOM files must include a Part 10 header (DICM). Raw datasets are unsupported.');
    const budget = { count: 0 };
    let offset = 132;
    let syntax = null;
    while (offset < view.byteLength) {
        bounds(view, offset, 4);
        if (view.getUint16(offset, true) !== 0x0002) break;
        const entry = element(view, offset, true, budget);
        if (entry.length === 0xffffffff) reject('Invalid DICOM file metadata length.');
        if (entry.tag === 0x00020010) {
            if (syntax !== null || entry.vr !== 'UI') reject('Invalid or duplicate DICOM transfer syntax.');
            syntax = ascii(view, entry.start, entry.length);
        }
        offset = entry.end;
    }
    if (syntax !== '1.2.840.10008.1.2' && syntax !== '1.2.840.10008.1.2.1') {
        reject('Unsupported DICOM transfer syntax. Only uncompressed Implicit or Explicit VR Little Endian is supported; compressed, deflated, and Big Endian files are not.');
    }
    const explicit = syntax === '1.2.840.10008.1.2.1';
    const values = {};
    let pixel = null;
    while (offset < view.byteLength) {
        const entry = element(view, offset, explicit, budget);
        if (entry.group === 0xfffe) reject('Unexpected DICOM delimiter outside a sequence.');
        if (entry.tag === 0x7fe00008 || entry.tag === 0x7fe00009) reject('Floating-point DICOM pixel data is unsupported.');
        if (entry.tag === 0x00283000 || entry.tag === 0x00283010 || entry.tag === 0x20500010) {
            reject('DICOM modality, VOI, and presentation lookup-table sequences are unsupported. Export a standard linear-window monochrome image instead.');
        }
        if (entry.tag === 0x7fe00010) {
            if (pixel) reject('Multiple DICOM pixel data elements are unsupported.');
            if (entry.length === 0xffffffff) reject('Encapsulated or compressed DICOM pixel data is unsupported.');
            if (explicit && entry.vr !== 'OB' && entry.vr !== 'OW') reject('Invalid DICOM pixel data representation.');
            pixel = entry;
        }
        const field = TAGS.get(entry.tag);
        if (field) {
            const [name, expectedVr] = field;
            if (Object.hasOwn(values, name)) reject('Duplicate DICOM image metadata is unsupported.');
            if (explicit && entry.vr !== expectedVr) reject('DICOM image metadata has an unexpected value representation.');
            if (expectedVr === 'US') {
                if (entry.length !== 2) reject('Invalid DICOM integer metadata length.');
                values[name] = view.getUint16(entry.start, true);
            } else {
                values[name] = ascii(view, entry.start, entry.length);
            }
        }
        if (entry.length === 0xffffffff) {
            if (explicit && entry.vr !== 'SQ') reject('Undefined-length non-sequence values are unsupported.');
            offset = skipSequence(view, entry.start, explicit, budget);
        } else {
            offset = entry.end;
        }
    }
    const frames = values.frames === undefined ? 1 : numeric(values.frames, 'frame count', true);
    if (frames !== 1) reject('Multiframe DICOM is unsupported. Choose a single-frame image; this viewer does not select or combine slices.');
    dimensions(values.columns, values.rows);
    if (values.samples !== 1 || !['MONOCHROME1', 'MONOCHROME2'].includes(values.photometric)) reject('Only single-sample MONOCHROME1 or MONOCHROME2 DICOM images are supported. Color and palette images are unsupported.');
    if (![8, 16].includes(values.bitsAllocated) || !Number.isInteger(values.bitsStored) || values.bitsStored < 1 || values.bitsStored > values.bitsAllocated || !Number.isInteger(values.highBit) || values.highBit < values.bitsStored - 1 || values.highBit >= values.bitsAllocated || ![0, 1].includes(values.representation)) {
        reject('Unsupported DICOM pixel layout. This viewer requires valid 8- or 16-bit integer samples.');
    }
    if (values.voiFunction !== undefined && values.voiFunction !== 'LINEAR') reject('Only the DICOM LINEAR window function is supported.');
    if (values.presentationShape !== undefined && values.presentationShape !== 'IDENTITY') reject('Non-identity presentation LUT shapes are unsupported.');
    const slope = values.slope === undefined ? 1 : numeric(values.slope, 'rescale slope');
    const intercept = values.intercept === undefined ? 0 : numeric(values.intercept, 'rescale intercept');
    if (!slope || Math.abs(slope) > 1e9 || Math.abs(intercept) > 1e12) reject('The DICOM rescale transform is outside this viewer’s supported range.');
    const count = values.rows * values.columns;
    const bytesPerSample = values.bitsAllocated / 8;
    const expected = count * bytesPerSample;
    if (!pixel || pixel.length !== expected + (expected % 2)) reject('DICOM pixel data length does not match its single-frame dimensions.');
    const shift = values.highBit + 1 - values.bitsStored;
    const modulus = 2 ** values.bitsStored;
    const sign = modulus / 2;
    const mask = modulus - 1;
    // Copy only pixel values, not the original dataset or any patient identifiers.
    const pixels = new Int32Array(count);
    let minimum = Infinity;
    let maximum = -Infinity;
    for (let i = 0; i < count; i++) {
        const raw = bytesPerSample === 1 ? view.getUint8(pixel.start + i) : view.getUint16(pixel.start + i * 2, true);
        let sample = (raw >>> shift) & mask;
        if (values.representation === 1 && sample >= sign) sample -= modulus;
        pixels[i] = sample;
        const transformed = sample * slope + intercept;
        minimum = Math.min(minimum, transformed);
        maximum = Math.max(maximum, transformed);
    }
    try {
        if (Math.max(Math.abs(minimum), Math.abs(maximum)) > 1e12) reject('Rescaled DICOM pixels are outside this viewer’s supported range.');
        const hasWindow = values.center !== undefined && values.width !== undefined;
        const center = hasWindow ? numeric(values.center, 'window center', false, true) : (minimum + maximum + 1) / 2;
        const width = hasWindow ? numeric(values.width, 'window width', false, true) : Math.max(1, maximum - minimum + 1);
        validateWindow(center, width);
        return {
            pixels, slope, intercept, center, width,
            inverted: values.photometric === 'MONOCHROME1',
            metadata: {
                format: 'DICOM Part 10', width: values.columns, height: values.rows,
                modality: MODALITIES.has(values.modality) ? values.modality : 'Other / unspecified',
                encoding: `${explicit ? 'Explicit' : 'Implicit'} VR Little Endian`,
                bitsStored: values.bitsStored, signed: values.representation === 1,
                photometric: values.photometric, windowSource: hasWindow ? 'First embedded linear window' : 'Full pixel range (includes padding)'
            }
        };
    } catch (error) {
        pixels.fill(0);
        throw error;
    }
}

function validateWindow(center, width) {
    if (!Number.isFinite(center) || Math.abs(center) > 1e12 || !Number.isFinite(width) || width < 1 || width > 2e12) reject('Window center must be finite (within ±1 trillion); width must be between 1 and 2 trillion.');
}

export function renderDicomGrayscale(image, center = image.center, width = image.width) {
    validateWindow(center, width);
    const rgba = new Uint8ClampedArray(image.pixels.length * 4);
    const lower = center - 0.5 - (width - 1) / 2;
    const upper = center - 0.5 + (width - 1) / 2;
    for (let i = 0; i < image.pixels.length; i++) {
        const value = image.pixels[i] * image.slope + image.intercept;
        let gray = value <= lower ? 0 : value > upper ? 255 : ((value - (center - 0.5)) / (width - 1) + 0.5) * 255;
        if (image.inverted) gray = 255 - gray;
        const offset = i * 4;
        rgba[offset] = gray;
        rgba[offset + 1] = gray;
        rgba[offset + 2] = gray;
        rgba[offset + 3] = 255;
    }
    return rgba;
}

export function inspectImage(buffer) {
    const view = inputView(buffer);
    if (view.byteLength >= 132 && ascii(view, 128, 4) === 'DICM') return { format: 'DICOM' };
    if (view.byteLength >= 8 && view.getUint32(0) === 0x89504e47 && view.getUint32(4) === 0x0d0a1a0a) {
        let offset = 8;
        let width;
        let height;
        let chunks = 0;
        let hasData = false;
        let ended = false;
        while (offset < view.byteLength) {
            if (++chunks > MAX_ELEMENTS) reject('PNG chunk count exceeds the safe parsing limit.');
            bounds(view, offset, 12);
            const length = view.getUint32(offset);
            bounds(view, offset + 12, length);
            const type = ascii(view, offset + 4, 4);
            if (chunks === 1 && (type !== 'IHDR' || length !== 13)) reject('Invalid PNG image header.');
            if (type === 'IHDR') {
                if (chunks !== 1) reject('Duplicate PNG image header.');
                width = view.getUint32(offset + 8);
                height = view.getUint32(offset + 12);
                dimensions(width, height);
            }
            if (type === 'acTL') reject('Animated PNG files are unsupported. Choose a still image.');
            if (type === 'IDAT') hasData = true;
            offset += length + 12;
            if (type === 'IEND') {
                if (length !== 0 || offset !== view.byteLength) reject('Invalid PNG end-of-image data.');
                ended = true;
                break;
            }
        }
        if (!ended || !hasData) reject('The PNG file is incomplete.');
        return { format: 'PNG', mime: 'image/png', width, height };
    }
    if (view.byteLength >= 2 && view.getUint16(0) === 0xffd8) {
        let offset = 2;
        let dimensionsFound = null;
        let segments = 0;
        while (offset < view.byteLength) {
            if (++segments > MAX_ELEMENTS) reject('JPEG segment count exceeds the safe parsing limit.');
            if (view.getUint8(offset++) !== 0xff) reject('Invalid JPEG marker.');
            while (offset < view.byteLength && view.getUint8(offset) === 0xff) offset++;
            bounds(view, offset, 1);
            const marker = view.getUint8(offset++);
            if (marker === 0xd9) break;
            if (marker === 0x00 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) reject('Unexpected JPEG marker before image data.');
            if (marker === 0x01) continue;
            bounds(view, offset, 2);
            const length = view.getUint16(offset);
            if (length < 2) reject('Invalid JPEG segment length.');
            bounds(view, offset, length);
            if (marker === 0xda) {
                if (!dimensionsFound) reject('The JPEG file is missing image dimensions.');
                return { format: 'JPEG', mime: 'image/jpeg', ...dimensionsFound };
            }
            if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
                if (![0xc0, 0xc1, 0xc2].includes(marker)) reject('This JPEG encoding is unsupported. Choose an 8-bit baseline or progressive JPEG.');
                if (dimensionsFound || length < 8 || view.getUint8(offset + 2) !== 8) reject('Unsupported or invalid JPEG frame header.');
                const height = view.getUint16(offset + 3);
                const width = view.getUint16(offset + 5);
                dimensions(width, height);
                dimensionsFound = { width, height };
            }
            offset += length;
        }
        reject('The JPEG file is incomplete.');
    }
    reject('Unsupported image format. Choose PNG, JPEG, or a DICOM Part 10 file; file extensions alone do not identify an image.');
}
