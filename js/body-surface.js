import * as THREE from 'three';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';

// Fuse the original sculpt's ellipsoids and torso into a single smooth skin mesh.
// The field is generated once, not on animation frames, then released.
export function fuseBodySurface(group, material) {
    const resolution = 128;
    const min = new THREE.Vector3(-.40, -.035, -.21);
    const extent = new THREE.Vector3(.80, 1.80, .42);
    const fieldMesh = new MarchingCubes(resolution, material, false, false, 100000);
    fieldMesh.isolation = 0;
    fieldMesh.field.fill(-1);
    const point = new THREE.Vector3(), local = new THREE.Vector3();
    const parts = group.children.filter(mesh => mesh.material === material);
    group.updateMatrixWorld(true);
    for (const mesh of parts) {
        const bounds = new THREE.Box3().setFromObject(mesh).expandByScalar(.018);
        const inverse = mesh.matrixWorld.clone().invert();
        const rings = mesh.userData.bodyRings;
        const radius = Math.min(mesh.scale.x, mesh.scale.y, mesh.scale.z);
        const lo = ['x','y','z'].map(axis => Math.max(1, Math.floor((bounds.min[axis]-min[axis])/extent[axis]*resolution)));
        const hi = ['x','y','z'].map(axis => Math.min(resolution-2, Math.ceil((bounds.max[axis]-min[axis])/extent[axis]*resolution)));
        for (let z=lo[2]; z<=hi[2]; z++) for (let y=lo[1]; y<=hi[1]; y++) for (let x=lo[0]; x<=hi[0]; x++) {
            point.set(min.x+x/resolution*extent.x,min.y+y/resolution*extent.y,min.z+z/resolution*extent.z);
            let distance;
            if (rings) {
                const py = THREE.MathUtils.clamp(point.y,rings[0][0],rings.at(-1)[0]);
                let i=0; while(i<rings.length-2 && rings[i+1][0]<py)i++;
                const a=rings[i],b=rings[i+1],t=(py-a[0])/(b[0]-a[0]);
                const rx=THREE.MathUtils.lerp(a[1],b[1],t),rz=THREE.MathUtils.lerp(a[2],b[2],t),cz=THREE.MathUtils.lerp(a[3],b[3],t);
                const side=(Math.hypot(point.x/rx,(point.z-cz)/rz)-1)*Math.min(rx,rz);
                distance=Math.max(side,Math.abs(point.y-py));
                if(point.y===py) distance=side;
            } else {
                local.copy(point).applyMatrix4(inverse);
                distance=(local.length()-1)*radius;
            }
            const index=x+y*resolution+z*resolution*resolution;
            const a=fieldMesh.field[index],b=-distance,k=.010;
            const h=Math.max(k-Math.abs(a-b),0)/k;
            fieldMesh.field[index]=Math.max(a,b)+h*h*k*.25;
        }
    }
    fieldMesh.update();
    const geometry=fieldMesh.geometry;
    geometry.computeBoundingSphere();
    const surface = new THREE.Mesh(geometry,material);
    surface.scale.copy(extent).multiplyScalar(.5);
    surface.position.copy(min).addScaledVector(extent,.5);
    for (const part of parts) group.remove(part);
    group.add(surface);
    return geometry;
}
