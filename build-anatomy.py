"""Convert official BodyParts3D reference meshes into the app's local GLB.

Usage: python3 build-anatomy.py --archive /path/isa_BP3D_4.0_obj_99.zip
       --partof /path/partof_element_parts.txt --isa /path/isa_element_parts.txt
       --lung-archive /path/BodyParts3D_3.0_obj_99.zip

Uses only Python's standard library. Source meshes are not procedurally replaced
or decimated here. Current source/license URLs and checksums accompany the asset.
"""
import argparse
from array import array
from collections import defaultdict
import csv
import hashlib
import json
from pathlib import Path
import struct
import sys
import zipfile

ROOT = Path(__file__).resolve().parent
SOURCE = 'https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/'
ATTRIBUTION = 'BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International'


def groups(path):
    result = defaultdict(set)
    with path.open() as handle:
        for row in csv.DictReader(handle, delimiter='\t'):
            result[row['name']].add(row['element file id'])
    return result


def parse_obj(data):
    vertices, normals, indices = [], [], []
    name = ''
    for line in data.decode('utf-8').splitlines():
        if line.startswith('# English name : '):
            name = line.split(' : ', 1)[1]
        elif line.startswith('v '):
            vertices.append(tuple(map(float, line.split()[1:4])))
        elif line.startswith('vn '):
            normals.append(tuple(map(float, line.split()[1:4])))
        elif line.startswith('f '):
            face = []
            for item in line.split()[1:]:
                parts = item.split('/')
                index = int(parts[0]) - 1
                # This archive pairs position/normal indices; fail, rather than
                # silently corrupting another OBJ layout or hard-edge normals.
                if len(parts) != 3 or int(parts[2]) - 1 != index:
                    raise ValueError('Unexpected BodyParts3D normal indexing')
                face.append(index)
            for i in range(1, len(face)-1):
                indices.extend((face[0], face[i], face[i+1]))
    if not vertices or not indices or len(vertices) != len(normals):
        raise ValueError('Incomplete source mesh')
    if min(indices) < 0 or max(indices) >= len(vertices):
        raise ValueError('Source index out of bounds')
    return name, vertices, normals, indices


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', required=True, type=Path)
    parser.add_argument('--partof', required=True, type=Path)
    parser.add_argument('--isa', required=True, type=Path)
    parser.add_argument('--lung-archive', required=True, type=Path,
                        help='Official BodyParts3D 3.0 OBJ archive, or a ZIP containing its five lung-lobe entries')
    args = parser.parse_args()
    partof, isa = groups(args.partof), groups(args.isa)
    requested = {}
    # Multi-headed/segmented muscles are classified as organ parts, not whole
    # muscle organs. Include both to retain deltoids, pectorals and muscle heads.
    for group, layer in [('bone organ', 'skeleton'), ('muscle organ', 'muscles'),
                         ('head of muscle organ', 'muscles'), ('zone of muscle organ', 'muscles'),
                         ('tendon', 'muscles')]:
        if not isa[group]:
            raise ValueError(f'Missing classification: {group}')
        for fid in isa[group]:
            requested[fid] = (layer, None, group)
    for root, organ in [('brain', None), ('trachea', 'lungs'), ('stomach', None),
                        ('large intestine', None), ('aorta', None),
                        ('superior vena cava', None), ('inferior vena cava', None),
                        ('heart', 'heart'), ('right lung', 'lungs'), ('left lung', 'lungs'),
                        ('liver', 'liver'), ('pancreas', 'pancreas'),
                        ('right kidney', 'kidneys'), ('left kidney', 'kidneys'),
                        ('small intestine', 'intestine')]:
        if not partof[root]:
            raise ValueError(f'Missing organ mapping: {root}')
        for fid in partof[root]:
            requested[fid] = ('organs', organ, root)
    for fid in partof['skin']:
        requested[fid] = ('surface', None, 'skin')
    if len(partof['skin']) != 1:
        raise ValueError('Expected one reference skin surface')
    archive = zipfile.ZipFile(args.archive)
    files = {Path(name).stem: (archive, name) for name in archive.namelist() if name.endswith('.obj')}
    # The 4.0 PART-OF lung hierarchy contains airways and vessels but omits the
    # enclosing parenchymal lobes. Retain the official 3.0 surfaces in their
    # original shared coordinate frame, rather than inventing a lung shell.
    lung_names = {
        'FMA7333': 'Upper lobe of right lung', 'FMA7337': 'Lower lobe of right lung',
        'FMA7370': 'Upper lobe of left lung', 'FMA7371': 'Lower lobe of left lung',
        'FMA7383': 'Middle lobe of right lung',
    }
    lung_archive = zipfile.ZipFile(args.lung_archive)
    for name in lung_archive.namelist():
        fid = Path(name.replace('\\', '/')).stem
        if fid in lung_names and name.endswith('.obj'):
            files[fid] = (lung_archive, name)
    for fid in lung_names:
        requested[fid] = ('organs', 'lungs', 'pulmonary lobe')
    missing = sorted(requested.keys() - files.keys())
    if missing:
        raise ValueError(f'Archive missing {len(missing)} requested structures: {missing[:10]}')
    def mesh_bytes(fid):
        source_archive, member = files[fid]
        return source_archive.read(member)
    skin = parse_obj(mesh_bytes(next(iter(partof['skin']))))[1]
    low = [min(p[i] for p in skin) for i in range(3)]
    high = [max(p[i] for p in skin) for i in range(3)]
    center = [(a+b)/2 for a,b in zip(low,high)]
    scale = 1.75/(high[2]-low[2])
    palette = {'surface': '#bc927b', 'muscles': '#a65e55', 'skeleton': '#e2d8bb',
               'heart': '#93443e', 'lungs': '#c49391', 'liver': '#794640',
               'pancreas': '#d9b482', 'kidneys': '#98574c', 'intestine': '#c99b85',
               'brain': '#c9b9a5', 'stomach': '#cb9a87', 'large intestine': '#b18b78',
               'artery': '#b05349', 'vein': '#647b91', 'airway': '#cfbba2'}
    batches = {}
    source_records = []
    for fid in sorted(requested):
        layer, organ, root = requested[fid]
        name, vertices, normals, indices = parse_obj(mesh_bytes(fid))
        name = lung_names.get(fid, name or fid)
        lower = name.lower()
        color_key = layer if layer != 'organs' else organ or root
        if root == 'tendon': color_key = 'skeleton'
        if layer == 'organs':
            if 'vein' in lower or 'vena cava' in lower: color_key = 'vein'
            elif 'artery' in lower or 'aorta' in lower: color_key = 'artery'
            elif 'bronch' in lower or 'trachea' in lower: color_key = 'airway'
        if color_key not in palette: color_key = 'intestine'
        key = (layer, organ, color_key)
        batch = batches.setdefault(key, {'positions': [], 'normals': [], 'indices': [], 'sources': []})
        offset = len(batch['positions'])//3
        for (x,y,z),(nx,ny,nz) in zip(vertices,normals):
            batch['positions'].extend(((x-center[0])*scale,(z-low[2])*scale,-(y-center[1])*scale))
            batch['normals'].extend((nx,nz,-ny))
        batch['indices'].extend(index+offset for index in indices)
        batch['sources'].append(fid)
        source_records.append({'id': fid, 'name': name, 'layer': layer, 'organ': organ, 'triangles': len(indices)//3})
    binary = bytearray()
    gltf = {'asset': {'version': '2.0', 'generator': 'Body Lab / build-anatomy.py',
                     'copyright': ATTRIBUTION}, 'scene': 0, 'scenes': [{'nodes': []}],
            'nodes': [], 'meshes': [], 'materials': [], 'buffers': [], 'bufferViews': [], 'accessors': []}

    def accessor(values, kind, width, target):
        while len(binary)%4: binary.append(0)
        data = array('f' if kind == 5126 else 'I', values)
        if data.itemsize != 4: raise ValueError('Conversion requires 32-bit floats/integers')
        if sys.byteorder != 'little': data.byteswap()
        view = len(gltf['bufferViews'])
        gltf['bufferViews'].append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': len(data)*4, 'target': target})
        binary.extend(data.tobytes())
        record = {'bufferView': view, 'componentType': kind, 'count': len(values)//width,
                  'type': 'VEC3' if width == 3 else 'SCALAR'}
        if width == 3:
            record['min'] = [min(values[i::3]) for i in range(3)]
            record['max'] = [max(values[i::3]) for i in range(3)]
        gltf['accessors'].append(record)
        return len(gltf['accessors'])-1

    for (layer, organ, color_key), batch in batches.items():
        color = palette[color_key]
        rgb = [int(color[i:i+2],16)/255 for i in (1,3,5)]
        linear = [v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in rgb]
        material = len(gltf['materials'])
        gltf['materials'].append({'name': color_key, 'pbrMetallicRoughness': {
            'baseColorFactor': linear+[1], 'metallicFactor': 0, 'roughnessFactor': .68}})
        mesh = len(gltf['meshes'])
        gltf['meshes'].append({'primitives': [{'attributes': {
            'POSITION': accessor(batch['positions'],5126,3,34962),
            'NORMAL': accessor(batch['normals'],5126,3,34962)},
            'indices': accessor(batch['indices'],5125,1,34963), 'material': material}]})
        node = {'mesh': mesh, 'name': f'{organ or layer} - {color_key}',
                'extras': {'layer': layer, 'sourceIds': batch['sources']}}
        if organ: node['extras']['organ'] = organ
        gltf['scenes'][0]['nodes'].append(len(gltf['nodes']))
        gltf['nodes'].append(node)
    gltf['buffers'].append({'byteLength': len(binary)})
    header = json.dumps(gltf,separators=(',',':')).encode()
    header += b' '*((-len(header))%4)
    binary.extend(b'\0'*((-len(binary))%4))
    result = struct.pack('<III',0x46546c67,2,28+len(header)+len(binary))
    result += struct.pack('<II',len(header),0x4e4f534a)+header
    result += struct.pack('<II',len(binary),0x004e4942)+binary
    destination = ROOT/'assets'/'anatomy'
    destination.mkdir(parents=True,exist_ok=True)
    (destination/'body.glb').write_bytes(result)
    credits = {
        'attribution': ATTRIBUTION,
        'license': 'https://creativecommons.org/licenses/by/4.0/',
        'licenseEvidence': 'https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html',
        'licenseNote': 'The publisher updated the database license in February 2025. Old OBJ comments retain the previous CC-BY-SA-2.1-JP notice; the current publisher page specifies CC BY 4.0.',
        'source': 'https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html',
        'release': 'BodyParts3D 4.0 with official 3.0 pulmonary lobe surfaces; publisher polygon-reduced OBJ meshes',
        'retrieved': '2026-09-28',
        'reference': 'Adult human male reference anatomy, not a patient-specific model.',
        'modifications': ['Selected anatomical structures using original FMA composition/classification tables.',
                          'Converted source millimetre coordinates to a Y-up view, uniformly scaled to 1.75 display units in height; display units are not patient measurements.',
                          'Merged geometry by display layer, lesson organ and illustrative tissue color, preserving source topology and normals at the conversion stage.',
                          'Assigned illustrative tissue/vascular colors and exported self-contained GLB.'],
        'inputs': [{'url': SOURCE+name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
                   for name,path in [('isa_BP3D_4.0_obj_99.zip',args.archive),('partof_element_parts.txt',args.partof),('isa_element_parts.txt',args.isa)]],
        'pulmonarySurfaces': {
            'url': 'https://dbarchive.biosciencedbc.jp/data/bodyparts3d/20110915/BodyParts3D_3.0_obj_99.zip',
            'entries': [{'id': fid, 'name': name, 'sha256': hashlib.sha256(mesh_bytes(fid)).hexdigest()}
                        for fid, name in lung_names.items()],
        },
        'outputSha256': hashlib.sha256(result).hexdigest(),
        'meshBatches': len(batches), 'structures': len(source_records),
        'triangles': sum(row['triangles'] for row in source_records),
        'sourceStructures': source_records,
    }
    (destination/'credits.json').write_text(json.dumps(credits,indent=2)+'\n')
    print(json.dumps({k:credits[k] for k in ['structures','triangles','meshBatches']}))
    print(f'GLB: {len(result):,} bytes')


if __name__ == '__main__':
    main()
