import test from 'node:test';
import assert from 'node:assert/strict';
import { IMAGING_LIMITS, ImagingError, inspectImage, parseDicom, renderDicomGrayscale } from '../js/imaging-parser.js';

const text = new TextEncoder();
const longVr = new Set(['OB', 'OW', 'SQ', 'UN']);
function join(...parts) {
    const output = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
    let offset = 0;
    for (const part of parts) { output.set(part, offset); offset += part.length; }
    return output;
}
function us(value) {
    const bytes = new Uint8Array(2);
    new DataView(bytes.buffer).setUint16(0, value, true);
    return bytes;
}
function valueBytes(vr, value) {
    if (value instanceof Uint8Array) return value;
    if (vr === 'US') return us(value);
    const bytes = text.encode(String(value));
    return bytes.length % 2 ? join(bytes, new Uint8Array([vr === 'UI' ? 0 : 32])) : bytes;
}
function entry(group, tag, vr, value, explicit = true, lengthOverride) {
    const bytes = valueBytes(vr, value);
    const isItem = group === 0xfffe;
    const long = explicit && !isItem && longVr.has(vr);
    const header = new Uint8Array(long ? 12 : 8);
    const view = new DataView(header.buffer);
    view.setUint16(0, group, true);
    view.setUint16(2, tag, true);
    if (explicit && !isItem) {
        header.set(text.encode(vr), 4);
        if (long) view.setUint32(8, lengthOverride ?? bytes.length, true);
        else view.setUint16(6, lengthOverride ?? bytes.length, true);
    } else view.setUint32(4, lengthOverride ?? bytes.length, true);
    return join(header, bytes);
}

export function makeDicom(options = {}) {
    const o = { explicit: true, rows: 2, columns: 2, bits: 8, stored: 8, highBit: 7, signed: 0, photometric: 'MONOCHROME2', samples: 1, rawPixels: [0, 85, 170, 255], ...options };
    const explicit = o.explicit;
    const part10 = new Uint8Array(132);
    part10.set(text.encode('DICM'), 128);
    const fields = [
        [0x0008, 0x0060, 'CS', 'CT'],
        [0x0010, 0x0010, 'PN', 'PRIVATE^PERSON'],
        [0x0010, 0x0020, 'LO', 'private-patient-id'],
        [0x0028, 0x0002, 'US', o.samples], [0x0028, 0x0004, 'CS', o.photometric],
        [0x0028, 0x0010, 'US', o.rows], [0x0028, 0x0011, 'US', o.columns],
        [0x0028, 0x0100, 'US', o.bits], [0x0028, 0x0101, 'US', o.stored],
        [0x0028, 0x0102, 'US', o.highBit], [0x0028, 0x0103, 'US', o.signed]
    ];
    for (const [name, tag, vr] of [['frames', 0x0008, 'IS'], ['center', 0x1050, 'DS'], ['width', 0x1051, 'DS'], ['intercept', 0x1052, 'DS'], ['slope', 0x1053, 'DS'], ['voiFunction', 0x1056, 'CS']]) {
        if (o[name] !== undefined) fields.push([0x0028, tag, vr, o[name]]);
    }
    const pixelBytes = o.pixelBytes ?? (o.bits === 16 ? join(...o.rawPixels.map(us)) : new Uint8Array(o.rawPixels));
    const paddedPixels = pixelBytes.length % 2 ? join(pixelBytes, new Uint8Array(1)) : pixelBytes;
    return join(part10,
        entry(0x0002, 0x0010, 'UI', o.syntax ?? (explicit ? '1.2.840.10008.1.2.1' : '1.2.840.10008.1.2')),
        ...(o.before ?? []),
        ...fields.filter((field) => !(o.omit ?? []).includes(field[1])).map((field) => entry(...field, explicit)),
        entry(0x7fe0, 0x0010, o.bits === 16 ? 'OW' : 'OB', paddedPixels, explicit, o.pixelLength),
        ...(o.after ?? [])
    ).buffer;
}

for (const explicit of [true, false]) {
    test(`decodes real ${explicit ? 'explicit' : 'implicit'} little-endian single-frame pixels`, () => {
        const source = makeDicom({ explicit });
        const image = parseDicom(source);
        assert.deepEqual([...image.pixels], [0, 85, 170, 255]);
        assert.deepEqual([...renderDicomGrayscale(image)], [0, 0, 0, 255, 85, 85, 85, 255, 170, 170, 170, 255, 255, 255, 255, 255]);
        assert.equal(image.metadata.width, 2);
        assert.equal(image.metadata.height, 2);
        assert.equal(image.metadata.modality, 'CT');
        assert.doesNotMatch(JSON.stringify(image), /PRIVATE|private-patient-id/);
        new Uint8Array(source).fill(0);
        assert.deepEqual([...image.pixels], [0, 85, 170, 255], 'returned image must not retain the source dataset buffer');
    });
}

test('decodes signed stored bits, bit offsets, and rescale transforms', () => {
    const image = parseDicom(makeDicom({ bits: 16, stored: 12, highBit: 15, signed: 1, rawPixels: [0x0010, 0x7ff0, 0x8000, 0xfff0], slope: 2, intercept: -10 }));
    assert.deepEqual([...image.pixels], [1, 2047, -2048, -1]);
    const rendered = renderDicomGrayscale(image);
    assert.equal(rendered[4], 255);
    assert.equal(rendered[8], 0);
    assert.equal(image.center, -10.5);
    assert.equal(image.width, 8191);
});

test('applies MONOCHROME1 inversion rather than presenting negative contrast', () => {
    const image = parseDicom(makeDicom({ photometric: 'MONOCHROME1' }));
    assert.deepEqual([...renderDicomGrayscale(image)].filter((_, i) => i % 4 === 0), [255, 170, 85, 0]);
});

test('applies first embedded LINEAR window and the width-one threshold boundary', () => {
    const image = parseDicom(makeDicom({ center: '85\\128', width: '1\\256' }));
    assert.deepEqual([...renderDicomGrayscale(image)].filter((_, i) => i % 4 === 0), [0, 255, 255, 255]);
    assert.throws(() => renderDicomGrayscale(image, 0, 0), ImagingError);
    assert.throws(() => renderDicomGrayscale(image, NaN, 20), ImagingError);
});

test('retains correct pixel count when an odd 8-bit sample count requires padding', () => {
    const image = parseDicom(makeDicom({ rows: 1, columns: 3, rawPixels: [0, 1, 2] }));
    assert.deepEqual([...image.pixels], [0, 1, 2]);
    assert.equal(renderDicomGrayscale(image).length, 12);
});

test('rejects every truncated prefix with a controlled parsing error', () => {
    const source = makeDicom();
    for (let length = 0; length < source.byteLength; length++) {
        assert.throws(() => parseDicom(source.slice(0, length)), ImagingError, `truncated at ${length}`);
    }
});

test('rejects a declared pixel length outside the available bytes', () => {
    assert.throws(() => parseDicom(makeDicom({ pixelLength: 100000 })), /out-of-bounds/);
});

test('rejects incomplete or mismatched pixel layouts instead of inferring a preview', () => {
    assert.throws(() => parseDicom(makeDicom({ columns: 3 })), /pixel data length/);
    assert.throws(() => parseDicom(makeDicom({ stored: 12 })), /pixel layout/);
    assert.throws(() => parseDicom(makeDicom({ highBit: 5 })), /pixel layout/);
    assert.throws(() => parseDicom(makeDicom({ signed: 2 })), /pixel layout/);
    assert.throws(() => parseDicom(makeDicom({ omit: [0x0101] })), /pixel layout/);
});

test('rejects compressed, deflated, and big-endian transfer syntaxes explicitly', () => {
    for (const syntax of ['1.2.840.10008.1.2.4.50', '1.2.840.10008.1.2.5', '1.2.840.10008.1.2.1.99', '1.2.840.10008.1.2.2']) {
        assert.throws(() => parseDicom(makeDicom({ syntax })), /Unsupported DICOM transfer syntax/);
    }
    assert.throws(() => parseDicom(makeDicom({ pixelLength: 0xffffffff })), /Encapsulated or compressed/);
});

test('rejects multiframe, color, and non-linear presentation rather than silently choosing pixels', () => {
    assert.throws(() => parseDicom(makeDicom({ frames: 2 })), /Multiframe/);
    assert.throws(() => parseDicom(makeDicom({ frames: 'not-a-number' })), /frame count/);
    assert.throws(() => parseDicom(makeDicom({ frames: '1\\2' })), /frame count/);
    assert.throws(() => parseDicom(makeDicom({ photometric: 'RGB', samples: 3 })), /MONOCHROME/);
    assert.throws(() => parseDicom(makeDicom({ voiFunction: 'SIGMOID' })), /LINEAR/);
    assert.throws(() => parseDicom(makeDicom({ before: [entry(0x0028, 0x3010, 'SQ', new Uint8Array())] })), /lookup-table/);
    assert.throws(() => parseDicom(makeDicom({ before: [entry(0x2050, 0x0020, 'CS', 'INVERSE')] })), /presentation LUT/);
});

test('rejects duplicate essential metadata and extra pixel data', () => {
    assert.throws(() => parseDicom(makeDicom({ after: [entry(0x0028, 0x0010, 'US', 100)] })), /Duplicate/);
    assert.throws(() => parseDicom(makeDicom({ after: [entry(0x7fe0, 0x0010, 'OB', new Uint8Array(4))] })), /Multiple/);
});

test('rejects excessive dimensions, bytes, and unsafe transforms before displaying anything', () => {
    assert.throws(() => parseDicom(makeDicom({ rows: 4096, columns: 4096 })), /dimensions exceed/);
    assert.throws(() => inspectImage(new ArrayBuffer(IMAGING_LIMITS.bytes + 1)), /32 MiB/);
    for (const slope of [0, 'NaN', '1e99']) assert.throws(() => parseDicom(makeDicom({ slope })), ImagingError);
    assert.throws(() => parseDicom(makeDicom({ center: '1e99', width: 10 })), /Window center/);
});

for (const explicit of [true, false]) {
    test(`walks nested undefined sequences in ${explicit ? 'explicit' : 'implicit'} datasets without exposing their data`, () => {
        const marker = (tag) => entry(0xfffe, tag, 'UN', new Uint8Array(), explicit);
        const nested = entry(0x0008, 0x1140, 'SQ', join(
            entry(0xfffe, 0xe000, 'UN', join(
                entry(0x0010, 0x0010, 'PN', 'SEQUENCE^IDENTIFIER', explicit),
                entry(0x0008, 0x1110, 'SQ', join(marker(0xe000), marker(0xe0dd)), explicit, 0xffffffff),
                marker(0xe00d)
            ), explicit, 0xffffffff), marker(0xe0dd)
        ), explicit, 0xffffffff);
        const image = parseDicom(makeDicom({ explicit, before: [nested] }));
        assert.deepEqual([...image.pixels], [0, 85, 170, 255]);
        assert.doesNotMatch(JSON.stringify(image), /SEQUENCE/);
    });
}

test('rejects malformed undefined sequences and excessive nesting', () => {
    const missingDelimiter = entry(0x0008, 0x1140, 'SQ', entry(0xfffe, 0xe000, 'UN', new Uint8Array()), true, 0xffffffff);
    assert.throws(() => parseDicom(makeDicom({ before: [missingDelimiter] })), /sequence item/);
    let nested = new Uint8Array();
    for (let i = 0; i < 18; i++) {
        nested = entry(0x0008, 0x1140, 'SQ', join(entry(0xfffe, 0xe000, 'UN', join(nested, entry(0xfffe, 0xe00d, 'UN', new Uint8Array())), true, 0xffffffff), entry(0xfffe, 0xe0dd, 'UN', new Uint8Array())), true, 0xffffffff);
    }
    assert.throws(() => parseDicom(makeDicom({ before: [nested] })), /nesting/);
});

test('recognizes PNG by content and rejects dimension bombs before browser decoding', () => {
    const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'));
    assert.deepEqual(inspectImage(png.buffer), { format: 'PNG', mime: 'image/png', width: 1, height: 1 });
    new DataView(png.buffer).setUint32(16, 1000000);
    assert.throws(() => inspectImage(png.buffer), /dimensions exceed/);
});

test('rejects PNG chunk lengths crossing the input boundary', () => {
    const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'));
    new DataView(png.buffer).setUint32(8, 0x7fffffff);
    assert.throws(() => inspectImage(png.buffer), /out-of-bounds/);
});

test('recognizes bounded JPEG frame dimensions and rejects oversized or truncated segments', () => {
    // Header inspection is separate from the browser’s full compressed-pixel decode.
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0, 11, 8, 0, 2, 0, 3, 1, 1, 0x11, 0, 0xff, 0xda, 0, 8, 1, 1, 0, 0, 63, 0, 0xff, 0xd9]);
    assert.deepEqual(inspectImage(jpeg.buffer), { format: 'JPEG', mime: 'image/jpeg', width: 3, height: 2 });
    assert.throws(() => inspectImage(jpeg.slice(0, 12).buffer), /out-of-bounds/);
    new DataView(jpeg.buffer).setUint16(9, 5000);
    assert.throws(() => inspectImage(jpeg.buffer), /dimensions exceed/);
});

test('rejects disguised SVG/text and raw DICOM datasets without a Part 10 header', () => {
    assert.throws(() => inspectImage(text.encode('<svg onload="alert(1)"></svg>').buffer), /Unsupported image format/);
    assert.throws(() => parseDicom(makeDicom().slice(132)), /Part 10/);
});
