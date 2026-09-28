import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const organNames = { heart: 'Heart', lungs: 'Lungs', liver: 'Liver', pancreas: 'Pancreas', kidneys: 'Kidneys', intestine: 'Small intestine' };
const layerNames = { surface: 'Body surface', muscles: 'Musculature', organs: 'Internal organs', skeleton: 'Skeleton', combined: 'Organs + skeleton', selected: 'Selected organ' };
const initialDirection = new THREE.Vector3(.65, .055, 1).normalize();

// BodyParts3D reference meshes, not a scan of the user or a medical measurement tool.
// Geometry and licensing provenance live with the local GLB in assets/anatomy/.
export function mountBodyModel(host, onSelect) {
    host.className = 'body-model';
    host.innerHTML = `
        <div class="body-model-toolbar" aria-label="Anatomical atlas controls">
            <label>Body layer <select aria-label="Body layer" disabled>
                <option value="muscles">Musculature</option><option value="surface">Body surface</option>
                <option value="organs">Internal organs</option><option value="skeleton">Skeleton</option>
                <option value="combined">Organs + skeleton</option><option value="selected">Selected organ only</option>
            </select></label>
            <div class="body-model-view-controls" role="group" aria-label="Camera view">
                <button type="button" data-view="front" disabled>Front</button><button type="button" data-view="back" disabled>Back</button>
                <button type="button" data-view="side" disabled>Side</button><button type="button" data-view="reset" disabled>Reset</button>
            </div>
            <div class="body-model-zoom-controls" role="group" aria-label="Camera zoom">
                <button type="button" data-view="in" aria-label="Zoom in" disabled>+</button><button type="button" data-view="out" aria-label="Zoom out" disabled>−</button>
            </div>
        </div>
        <div class="body-model-stage" aria-busy="true" data-state="loading">
            <div class="body-model-atlas-label" aria-hidden="true"><span>BodyParts3D</span><strong>Anatomical atlas</strong></div>
            <div class="body-model-layer-label" aria-hidden="true">Musculature</div>
            <div class="body-model-message" role="status" aria-live="polite"><strong>Loading the anatomical atlas</strong><span>Reading local BodyParts3D meshes. Organ lessons remain available while the model loads.</span></div>
            <div class="body-model-reference-label" aria-hidden="true">Reference anatomy · not patient-specific</div>
        </div>
        <p class="body-model-help">Drag to rotate · pinch or scroll to zoom. With the model focused: arrow keys rotate, +/− zoom, Home resets. Choose an organ below to isolate it and open its lesson.</p>
        <p class="body-model-status" role="status" aria-live="polite"></p>`;
    const stage = host.querySelector('.body-model-stage');
    const toolbar = host.querySelector('.body-model-toolbar');
    const layerSelect = toolbar.querySelector('select');
    const layerLabel = host.querySelector('.body-model-layer-label');
    const status = host.querySelector('.body-model-status');
    const message = host.querySelector('.body-model-message');
    const buttons = toolbar.querySelectorAll('button, select');
    function setControlsEnabled(enabled) {
        for (const button of buttons) button.disabled = !enabled;
    }
    function showFailure(title, detail) {
        stage.dataset.state = 'error';
        stage.setAttribute('aria-busy', 'false');
        message.hidden = false;
        message.querySelector('strong').textContent = title;
        message.querySelector('span').textContent = detail;
        setControlsEnabled(false);
        status.textContent = 'The organ buttons and lessons are still available.';
    }

    let renderer;
    try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch (error) {
        console.error('BodyParts3D WebGL initialization failed:', error);
        showFailure('3D graphics unavailable', 'This device or browser could not start WebGL. You can still explore every organ lesson below.');
        return { select() {}, dispose() {} };
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    const canvas = renderer.domElement;
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Interactive BodyParts3D anatomical atlas. Arrow keys rotate, plus and minus zoom, Home resets. Organ lesson buttons below provide accessible selection.');
    stage.prepend(canvas);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, .001, 40);
    camera.position.copy(initialDirection).multiplyScalar(3);
    const controls = new OrbitControls(camera, canvas);
    controls.enablePan = false;
    controls.enableDamping = false;
    controls.rotateSpeed = .7;
    controls.zoomSpeed = .8;
    controls.minPolarAngle = .12;
    controls.maxPolarAngle = Math.PI - .12;
    controls.enabled = false;

    // A locally generated studio environment supplies broad, soft PBR reflections.
    // Tissue stays rough and non-metallic; no synthetic disease or surface anatomy.
    const room = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const environment = pmrem.fromScene(room, .06);
    scene.environment = environment.texture;
    scene.environmentIntensity = .45;
    room.dispose();
    pmrem.dispose();
    scene.add(new THREE.HemisphereLight(0xeaf1fa, 0x635450, .85));
    const key = new THREE.DirectionalLight(0xffeee1, 2.3);
    key.position.set(-1.6, 5.5, 2.4);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -.00015;
    key.shadow.normalBias = .0015;
    key.shadow.radius = 3;
    scene.add(key, key.target);
    const fill = new THREE.DirectionalLight(0xdbeaff, .85);
    fill.position.set(3, 1.8, 2);
    const rim = new THREE.DirectionalLight(0xe8f2ff, 2);
    rim.position.set(1, 2.6, -3);
    scene.add(fill, rim);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: .28, depthWrite: false }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    floor.visible = false;
    scene.add(floor);

    const lifetime = new AbortController();
    const eventOptions = { signal: lifetime.signal };
    const parts = [];
    const visibleMeshes = [];
    const materials = new Map();
    const bodyBounds = new THREE.Box3();
    const viewBounds = new THREE.Box3();
    const offset = new THREE.Vector3();
    const corner = new THREE.Vector3();
    const center = new THREE.Vector3();
    const inverseRotation = new THREE.Quaternion();
    const spherical = new THREE.Spherical();
    let model = null;
    let selectedOrgan = 'heart';
    let initialSelection = true;
    let picking = false;
    let resetting = false;
    let disposed = false;
    let lost = false;
    let frame = 0;
    let fitDistance = 0;
    let bodySize = 1.75;
    let loadingStarted = false;

    // Only events request a frame. There is no idle animation or damping loop.
    function requestRender() {
        if (disposed || lost || frame || document.hidden || !stage.clientWidth || !stage.clientHeight) return;
        frame = requestAnimationFrame(() => {
            frame = 0;
            if (!disposed && !lost && !document.hidden && stage.clientWidth && stage.clientHeight) renderer.render(scene, camera);
        });
    }
    controls.addEventListener('change', requestRender);

    function frameBounds(direction = null, preserveZoom = false) {
        if (viewBounds.isEmpty()) return;
        const zoomRatio = preserveZoom && fitDistance ? camera.position.distanceTo(controls.target) / fitDistance : 1;
        if (direction) offset.copy(direction);
        else offset.copy(camera.position).sub(controls.target);
        offset.normalize();
        viewBounds.getCenter(center);
        camera.position.copy(center).add(offset);
        camera.lookAt(center);
        inverseRotation.copy(camera.quaternion).invert();
        const tanY = Math.tan(THREE.MathUtils.degToRad(camera.fov * .5));
        const tanX = tanY * camera.aspect;
        let distance = 0;
        for (let i = 0; i < 8; i++) {
            corner.set(i & 1 ? viewBounds.max.x : viewBounds.min.x, i & 2 ? viewBounds.max.y : viewBounds.min.y, i & 4 ? viewBounds.max.z : viewBounds.min.z);
            corner.sub(center).applyQuaternion(inverseRotation);
            distance = Math.max(distance, corner.z + Math.abs(corner.x) * 1.16 / tanX, corner.z + Math.abs(corner.y) * 1.16 / tanY);
        }
        const radius = viewBounds.getSize(corner).length() * .5;
        fitDistance = Math.max(distance, radius * 1.2);
        controls.minDistance = Math.max(radius * .65, .025);
        controls.maxDistance = Math.max(bodySize * 5, fitDistance * 3);
        controls.target.copy(center);
        camera.position.copy(center).addScaledVector(offset, THREE.MathUtils.clamp(fitDistance * zoomRatio, controls.minDistance, controls.maxDistance));
        camera.near = Math.max(radius / 1000, .0001);
        camera.far = controls.maxDistance + bodySize * 4;
        camera.updateProjectionMatrix();
        controls.update();
        requestRender();
    }
    function resize() {
        const width = stage.clientWidth, height = stage.clientHeight;
        if (!width || !height || disposed) return;
        if (!loadingStarted) {
            loadingStarted = true;
            void loadAtlas();
        }
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        frameBounds(null, true);
        requestRender();
    }
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(stage);

    function updateStatus() {
        const layer = layerSelect.value;
        layerLabel.textContent = layer === 'selected' ? organNames[selectedOrgan] : layerNames[layer];
        canvas.setAttribute('aria-label', `${layerLabel.textContent}, interactive BodyParts3D atlas. Arrow keys rotate, plus and minus zoom, Home resets. Choose an organ lesson using the buttons below.`);
        status.textContent = layer === 'selected'
            ? `${organNames[selectedOrgan]} isolated. Its lesson appears alongside or below. Change Body layer to see surrounding anatomy.`
            : `${layerNames[layer]}. ${layer === 'muscles' ? 'Muscles are shown with the underlying skeleton. ' : ''}${['organs', 'combined'].includes(layer) ? 'Select a visible lesson organ to learn about it. Warm illumination marks the selected organ. ' : ''}Tissue colors are illustrative.`;
    }
    function setLayer(direction = null) {
        if (!model || disposed || lost) return;
        const layer = layerSelect.value;
        visibleMeshes.length = 0;
        viewBounds.makeEmpty();
        for (const part of parts) {
            const visible = layer === 'selected' ? part.organ === selectedOrgan
                : layer === 'combined' ? part.layer === 'organs' || part.layer === 'skeleton'
                : layer === 'muscles' ? part.layer === 'muscles' || part.layer === 'skeleton'
                : part.layer === layer;
            part.mesh.visible = visible;
            if (visible) {
                visibleMeshes.push(part.mesh);
                viewBounds.union(part.bounds);
            }
        }
        for (const material of materials.values()) material.emissive.setHex(material.userData.organ === selectedOrgan ? 0x32170b : 0x000000);
        floor.visible = ['surface', 'muscles', 'skeleton', 'combined'].includes(layer);
        renderer.shadowMap.needsUpdate = true;
        updateStatus();
        if (viewBounds.isEmpty()) {
            status.textContent = `No ${layer === 'selected' ? organNames[selectedOrgan].toLowerCase() : layerNames[layer].toLowerCase()} mesh is present in this atlas asset. Organ lessons remain available.`;
            requestRender();
            return;
        }
        frameBounds(direction);
    }
    function resetView() {
        layerSelect.value = 'muscles';
        setLayer(initialDirection);
    }
    function zoom(factor) {
        offset.copy(camera.position).sub(controls.target);
        const distance = THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance);
        camera.position.copy(controls.target).add(offset.setLength(distance));
        controls.update();
        requestRender();
    }
    function select(id) {
        if (!Object.hasOwn(organNames, id) || disposed) return;
        // The workspace seeds its lesson synchronously; that must not replace the atlas opening view.
        const seed = initialSelection && id === 'heart';
        initialSelection = false;
        selectedOrgan = id;
        if (resetting || seed) return;
        if (!picking) layerSelect.value = 'selected';
        if (picking) {
            for (const material of materials.values()) material.emissive.setHex(material.userData.organ === id ? 0x32170b : 0x000000);
            status.textContent = `${organNames[id]} selected. Warm illumination marks it; its lesson appears alongside or below. Choose “Selected organ only” for an unobstructed view.`;
            requestRender();
        } else setLayer(initialDirection);
    }
    layerSelect.addEventListener('change', () => setLayer(), eventOptions);
    toolbar.addEventListener('click', event => {
        const view = event.target.closest('[data-view]')?.dataset.view;
        if (!view || !model || lost) return;
        if (view === 'in' || view === 'out') zoom(view === 'in' ? .8 : 1.25);
        else if (view === 'reset') resetView();
        else frameBounds(new THREE.Vector3(view === 'side' ? 1 : 0, 0, view === 'back' ? -1 : view === 'side' ? 0 : 1));
    }, eventOptions);
    canvas.addEventListener('keydown', event => {
        if (!model || lost) return;
        if (event.key === 'Home') { event.preventDefault(); resetView(); return; }
        if (['+', '=', '-', '_'].includes(event.key)) { event.preventDefault(); zoom(['+', '='].includes(event.key) ? .8 : 1.25); return; }
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault();
        offset.copy(camera.position).sub(controls.target);
        spherical.setFromVector3(offset);
        spherical.theta += event.key === 'ArrowLeft' ? -.15 : event.key === 'ArrowRight' ? .15 : 0;
        spherical.phi = THREE.MathUtils.clamp(spherical.phi + (event.key === 'ArrowUp' ? -.12 : event.key === 'ArrowDown' ? .12 : 0), controls.minPolarAngle, controls.maxPolarAngle);
        camera.position.copy(controls.target).add(offset.setFromSpherical(spherical));
        controls.update();
        requestRender();
    }, eventOptions);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const activePointers = new Set();
    let pointerStart = null;
    canvas.addEventListener('pointerdown', event => {
        activePointers.add(event.pointerId);
        pointerStart = activePointers.size === 1 && event.button === 0 ? { id: event.pointerId, x: event.clientX, y: event.clientY } : null;
    }, eventOptions);
    canvas.addEventListener('pointermove', event => {
        if (pointerStart && Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 5) pointerStart = null;
    }, eventOptions);
    canvas.addEventListener('pointercancel', event => { activePointers.delete(event.pointerId); pointerStart = null; }, eventOptions);
    canvas.addEventListener('pointerup', event => {
        activePointers.delete(event.pointerId);
        const click = pointerStart && pointerStart.id === event.pointerId && Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) <= 5;
        pointerStart = null;
        if (!click || !model || lost) return;
        const rect = canvas.getBoundingClientRect();
        pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
        camera.updateMatrixWorld();
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObjects(visibleMeshes, false)[0];
        const id = hit?.object.userData.organ;
        if (!Object.hasOwn(organNames, id)) return;
        picking = true;
        try { onSelect(id); } finally { picking = false; }
    }, eventOptions);
    canvas.addEventListener('webglcontextlost', event => {
        event.preventDefault();
        lost = true;
        controls.enabled = false;
        showFailure('3D graphics interrupted', 'The browser lost its graphics context. Reload the page to restore the atlas; organ lessons remain available.');
    }, eventOptions);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) resize(); }, eventOptions);
    window.addEventListener('body-clear-personal-data', () => {
        selectedOrgan = 'heart';
        resetting = true;
        resetView();
        // The workspace handles the same event by selecting its initial heart lesson.
        queueMicrotask(() => { resetting = false; });
    }, eventOptions);

    function disposeObject(root) {
        const geometries = new Set(), objectMaterials = new Set(), textures = new Set();
        root.traverse(object => {
            if (object.geometry) geometries.add(object.geometry);
            for (const material of object.material ? Array.isArray(object.material) ? object.material : [object.material] : []) {
                objectMaterials.add(material);
                for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
            }
        });
        for (const geometry of geometries) geometry.dispose();
        for (const material of objectMaterials) material.dispose();
        for (const texture of textures) { texture.dispose(); texture.source?.data?.close?.(); }
    }
    function dispose() {
        if (disposed) return;
        disposed = true;
        lifetime.abort();
        cancelAnimationFrame(frame);
        resizeObserver.disconnect();
        detachObserver.disconnect();
        controls.removeEventListener('change', requestRender);
        controls.dispose();
        disposeObject(scene);
        scene.clear();
        model = null;
        parts.length = 0;
        visibleMeshes.length = 0;
        materials.clear();
        environment.dispose();
        key.dispose();
        renderer.dispose();
        canvas.remove();
    }
    let wasConnected = host.isConnected;
    const detachObserver = new MutationObserver(() => {
        if (host.isConnected) wasConnected = true;
        else if (wasConnected) dispose();
    });
    detachObserver.observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener('pagehide', event => { if (!event.persisted) dispose(); }, eventOptions);
    window.addEventListener('pageshow', event => { if (event.persisted) resize(); }, eventOptions);

    function tissueMaterial(layer, organ, source) {
        const materialKey = `${layer}:${organ || ''}:${source.uuid}`;
        if (materials.has(materialKey)) return materials.get(materialKey);
        const material = new THREE.MeshPhysicalMaterial({
            color: source.color, side: source.side, metalness: 0,
            roughness: layer === 'skeleton' ? .8 : layer === 'surface' ? .83 : .68,
            sheen: layer === 'muscles' || layer === 'organs' ? .16 : 0,
            sheenRoughness: .85, sheenColor: new THREE.Color(0xcf9d8e),
        });
        material.name = source.name;
        material.userData.organ = organ;
        materials.set(materialKey, material);
        return material;
    }
    async function loadAtlas() {
        let loaded = null;
        const importedMaterials = new Set();
        try {
            const url = new URL('../assets/anatomy/body.glb', import.meta.url);
            const response = await fetch(url, { signal: lifetime.signal });
            if (!response.ok) throw new Error(`Atlas request failed: HTTP ${response.status}`);
            const bytes = await response.arrayBuffer();
            if (disposed) return;
            const manager = new THREE.LoadingManager();
            manager.setURLModifier(resource => {
                if (!resource.startsWith('blob:') && !resource.startsWith('data:') && new URL(resource, url).origin !== url.origin) throw new Error('Atlas attempted to load a non-local resource');
                return resource;
            });
            const gltf = await new GLTFLoader(manager).parseAsync(bytes, new URL('.', url).href);
            loaded = gltf.scene;
            if (disposed) { disposeObject(loaded); return; }
            loaded.updateMatrixWorld(true);
            loaded.traverse(mesh => {
                if (!mesh.isMesh) return;
                let layer, organ;
                for (let node = mesh; node; node = node.parent) {
                    layer ||= node.userData.layer;
                    organ ||= node.userData.organ;
                }
                if (!['surface', 'muscles', 'skeleton', 'organs'].includes(layer)) throw new Error(`Missing atlas layer metadata for ${mesh.name}`);
                for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) importedMaterials.add(material);
                mesh.material = Array.isArray(mesh.material)
                    ? mesh.material.map(material => tissueMaterial(layer, organ, material))
                    : tissueMaterial(layer, organ, mesh.material);
                mesh.userData.organ = organ;
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
                const bounds = mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
                parts.push({ mesh, layer, organ, bounds });
                bodyBounds.union(bounds);
            });
            if (bodyBounds.isEmpty()) throw new Error('The local atlas contains no anatomical meshes');
            model = loaded;
            scene.add(model);
            bodySize = bodyBounds.getSize(corner).length();
            bodyBounds.getCenter(center);
            floor.position.set(center.x, bodyBounds.min.y - .004, center.z);
            floor.scale.setScalar(bodySize * 2.5);
            key.target.position.copy(center);
            key.shadow.camera.left = key.shadow.camera.bottom = -bodySize;
            key.shadow.camera.right = key.shadow.camera.top = bodySize;
            key.shadow.camera.near = .1;
            key.shadow.camera.far = key.position.distanceTo(center) + bodySize * 2;
            key.shadow.camera.updateProjectionMatrix();
            if (!lost) {
                stage.dataset.state = 'ready';
                stage.setAttribute('aria-busy', 'false');
                message.hidden = true;
                controls.enabled = true;
                setControlsEnabled(true);
                setLayer(initialDirection);
                resize();
            }
        } catch (error) {
            if (disposed) return;
            console.error('BodyParts3D atlas loading failed:', error);
            if (loaded) { scene.remove(loaded); disposeObject(loaded); }
            parts.length = 0;
            visibleMeshes.length = 0;
            materials.clear();
            model = null;
            controls.enabled = false;
            showFailure('Anatomical atlas could not load', 'The local body.glb asset could not be read or displayed. Reload after checking the app installation. No substitute body is shown; all organ lessons remain available.');
        } finally {
            const textures = new Set();
            for (const material of importedMaterials) {
                for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
                material.dispose();
            }
            for (const texture of textures) { texture.dispose(); texture.source?.data?.close?.(); }
        }
    }
    resize();
    return { select, dispose };
}
