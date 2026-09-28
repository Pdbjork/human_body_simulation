import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { fuseBodySurface } from './body-surface.js';

// Original illustrative geometry, metres; anatomical right is negative X in front view.
// Not a segmented scan, measurement reference, or representation of the user.
export function mountBodyModel(host, onSelect) {
    host.className = 'body-model';
    host.innerHTML = `<div class="body-model-toolbar"><label>View <select aria-label="Body layer"><option value="organs">Internal organs</option><option value="surface">Body surface</option><option value="skeleton">Skeleton</option><option value="combined">Organs + skeleton</option></select></label><button type="button" data-view="front">Front</button><button type="button" data-view="back">Back</button><button type="button" data-view="side">Side</button><button type="button" data-view="reset">Reset</button><button type="button" data-view="in" aria-label="Zoom in">+</button><button type="button" data-view="out" aria-label="Zoom out">−</button></div><div class="body-model-stage"></div><p class="body-model-help">Drag to rotate · pinch or scroll to zoom · arrow keys to rotate. Select colored organs or the buttons below. Front view: body right is on your left.</p><p class="body-model-status" role="status"></p>`;
    const stage = host.querySelector('.body-model-stage');
    const status = host.querySelector('.body-model-status');
    host.querySelector('select').add(new Option('Selected organ only', 'selected'));
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
    catch {
        status.textContent = '3D rendering is unavailable on this device. The organ buttons and lessons below remain available.';
        host.querySelector('.body-model-toolbar').hidden = true;
        return { select() {} };
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setClearColor(0x0b1522, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    stage.append(renderer.domElement);
    const canvas = renderer.domElement;
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Interactive three-dimensional anatomical body. Arrow keys rotate. Use organ buttons for accessible selection.');
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, .01, 20);
    const controls = new OrbitControls(camera, canvas);
    controls.enablePan = false;
    controls.minDistance = .65;
    controls.maxDistance = 4.8;
    controls.minPolarAngle = .25;
    controls.maxPolarAngle = Math.PI - .25;
    controls.target.set(0, .88, 0);
    camera.position.set(0, .92, 3.25);
    scene.add(new THREE.HemisphereLight(0xe6f3ff, 0x4d3544, 2.6));
    for (const [x, y, z, color, intensity] of [[-2, 3, 4, 0xffe5d5, 3], [2, 2, -2, 0x6edaff, 3], [2, 1, 3, 0xffffff, 1]]) {
        const light = new THREE.DirectionalLight(color, intensity);
        light.position.set(x, y, z); scene.add(light);
    }
    const skin = new THREE.Group(), bones = new THREE.Group(), organs = new THREE.Group();
    scene.add(skin, bones, organs);
    const sphere = new THREE.SphereGeometry(1, 32, 24);
    const materials = new Set(), geometries = new Set([sphere]);
    const material = (color, roughness = .48) => {
        const m = new THREE.MeshStandardMaterial({ color, roughness }); materials.add(m); return m;
    };
    const skinMat = material(0xb78670, .65), boneMat = material(0xe9ddbf, .6);
    const lungMat = material(0xc8818a), heartMat = material(0x9f3443, .35);
    const liverMat = material(0x793b39), renalMat = material(0x963d4b);
    const gutMat = material(0xdba085), pancreasMat = material(0xe1bb79);
    const arteryMat = material(0xa8333e), veinMat = material(0x426b95);
    function ellipsoid(parent, mat, position, scale, id, rotation = 0) {
        const mesh = new THREE.Mesh(sphere, mat);
        mesh.position.set(...position); mesh.scale.set(...scale); mesh.rotation.z = rotation;
        if (id) mesh.userData.organ = id;
        parent.add(mesh); return mesh;
    }
    function tube(parent, mat, points, radius, id) {
        const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
        const geo = new THREE.TubeGeometry(curve, Math.max(16, points.length * 5), radius, 8, false);
        geometries.add(geo);
        const mesh = new THREE.Mesh(geo, mat); if (id) mesh.userData.organ = id;
        parent.add(mesh); return mesh;
    }
    // Smooth elliptical cross-sections form one torso rather than stacked primitives.
    function torso(parent, mat, rings) {
        const vertices = [], indices = [], n = 64;
        for (const [y, rx, rz, z] of rings) for (let j = 0; j <= n; j++) {
            const a = j / n * Math.PI * 2;
            vertices.push(Math.cos(a) * rx, y, z + Math.sin(a) * rz);
        }
        for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < n; j++) {
            const a = i * (n + 1) + j, b = a + n + 1;
            indices.push(a, b, a + 1, b, b + 1, a + 1);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geo.setIndex(indices); geo.computeVertexNormals();
        geometries.add(geo); const mesh = new THREE.Mesh(geo, mat); mesh.userData.bodyRings = rings; parent.add(mesh);
    }
    function limb(parent, mat, a, b, width, depth = width) {
        const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b);
        const mid = from.clone().add(to).multiplyScalar(.5);
        const mesh = ellipsoid(parent, mat, mid.toArray(), [width, from.distanceTo(to) * .59, depth]);
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.sub(from).normalize());
        return mesh;
    }
    torso(skin, skinMat, [[.76,.035,.04,0],[.80,.105,.085,0],[.88,.143,.097,0],[.96,.137,.092,0],[1.04,.119,.085,0],[1.12,.131,.094,0],[1.22,.165,.105,0],[1.30,.181,.104,-.004],[1.35,.172,.086,-.008],[1.39,.12,.068,-.008],[1.42,.054,.048,0]]);
    ellipsoid(skin, skinMat, [0,1.447,0], [.045,.078,.045]);
    ellipsoid(skin, skinMat, [0,1.592,0], [.075,.104,.079]);
    ellipsoid(skin, skinMat, [0,1.54,.025], [.058,.062,.057]);
    ellipsoid(skin, skinMat, [0,1.58,.079], [.013,.025,.020]);
    const eyeMat = material(0x322c2b), lipMat = material(0x925e56);
    for (const s of [-1, 1]) {
        ellipsoid(skin, skinMat, [s*.076,1.582,0], [.013,.028,.017]);
        ellipsoid(skin, eyeMat, [s*.029,1.605,.072], [.013,.004,.005]);
        limb(skin, skinMat, [s*.16,1.35,0], [s*.236,1.11,0], .055, .052);
        ellipsoid(skin, skinMat, [s*.241,1.09,0], [.035,.040,.035]);
        limb(skin, skinMat, [s*.24,1.09,0], [s*.288,.887,.018], .037, .034);
        ellipsoid(skin, skinMat, [s*.30,.842,.023], [.032,.055,.020], null, -s*.13);
        for (let f=0; f<4; f++) limb(skin, skinMat, [s*(.276+f*.014),.818,.026], [s*(.276+f*.016),.76+Math.abs(f-1)*.009,.035], .007, .007);
        limb(skin, skinMat, [s*.276,.865,.025], [s*.251,.815,.045], .009);
        limb(skin, skinMat, [s*.081,.87,0], [s*.088,.49,.008], .073,.081);
        ellipsoid(skin, skinMat, [s*.088,.47,.014], [.044,.046,.047]);
        limb(skin, skinMat, [s*.088,.455,0], [s*.09,.12,-.012], .046,.047);
        ellipsoid(skin, skinMat, [s*.09,.09,0], [.031,.055,.032]);
        ellipsoid(skin, skinMat, [s*.091,.043,.047], [.039,.032,.094]);
        for(let t=0;t<5;t++) ellipsoid(skin,skinMat,[s*(.064+t*.013),.036,.123-t*.004],[.009-t*.0007,.017,.028-t*.003]);
    }
    ellipsoid(skin, lipMat, [0,1.543,.078], [.021,.003,.003]);
    geometries.add(fuseBodySurface(skin, skinMat));
    // Skeleton: skull, articulated spine, rib cage, clavicles, pelvis and paired long bones.
    ellipsoid(bones,boneMat,[0,1.592,-.005],[.068,.092,.069]);
    ellipsoid(bones,boneMat,[0,1.535,.016],[.045,.034,.045]);
    const socketMat=material(0x504b44);
    for(const s of [-1,1]) ellipsoid(bones,socketMat,[s*.027,1.60,.057],[.017,.013,.009]);
    for(let v=0;v<17;v++) ellipsoid(bones,boneMat,[0,.86+v*.0315,-.057+Math.sin(v*.28)*.015],[.021,.012,.023]);
    for(let v=0;v<7;v++) ellipsoid(bones,boneMat,[0,1.389+v*.020,-.035],[.015,.008,.016]);
    tube(bones,boneMat,[[0,1.32,.077],[0,1.23,.106],[0,1.16,.087]],.010);
    for(const s of [-1,1]) {
        for(let r=0;r<12;r++) {
            const y=1.325-r*.017, width=.082+Math.sin((r+1)/13*Math.PI)*.062;
            const points=[[s*.018,y,-.055],[s*width,y-.013,-.038],[s*(width+.012),y-.027,.039]];
            if(r<10) points.push([s*width*.68,y-.043,.087],[s*.012,y-.039,.087]);
            tube(bones,boneMat,points,.0045);
        }
        tube(bones,boneMat,[[s*.01,1.355,.04],[s*.08,1.375,.035],[s*.16,1.357,0]],.009);
        ellipsoid(bones,boneMat,[s*.081,.886,-.032],[.062,.074,.025],null,-s*.35);
        tube(bones,boneMat,[[s*.10,.895,0],[s*.093,.817,.031],[s*.038,.802,.038],[0,.82,.031]],.013);
        limb(bones,boneMat,[s*.16,1.35,0],[s*.236,1.09,0],.014);
        for(const d of [-.009,.009]) limb(bones,boneMat,[s*.24+d,1.09,0],[s*.288+d,.887,.018],.008);
        limb(bones,boneMat,[s*.081,.85,0],[s*.088,.49,.008],.019);
        for(const d of [-.012,.012]) limb(bones,boneMat,[s*.088+d,.46,0],[s*.09+d,.10,-.01],.010);
        ellipsoid(bones,boneMat,[s*.088,.475,.035],[.023,.027,.013]);
        for(let f=0;f<5;f++) tube(bones,boneMat,[[s*(.274+f*.011),.875,.018],[s*(.274+f*.013),.817,.022],[s*(.274+f*.014),.768+Math.abs(f-2)*.01,.03]],.0035);
        for(let t=0;t<5;t++) tube(bones,boneMat,[[s*.09,.09,0],[s*(.064+t*.013),.039,.075],[s*(.064+t*.013),.035,.139-t*.008]],.004);
    }
    // Organs occupy distinct anterior/posterior planes. All six lessons have raycast targets.
    const brainMat=material(0xd7a4a2);
    for(const s of [-1,1]) {
        ellipsoid(organs,brainMat,[s*.029,1.623,-.006],[.032,.054,.057]);
        for(let f=0;f<7;f++) tube(organs,brainMat,[[s*.008,1.655-f*.011,.038],[s*.048,1.657-f*.01,.027],[s*.053,1.65-f*.009,-.017],[s*.013,1.663-f*.01,-.052]],.006);
    }
    const tracheaMat=material(0xc5b4a2);
    tube(organs,tracheaMat,[[0,1.456,.026],[0,1.34,.017],[0,1.285,.007]],.011,'lungs');
    for(const s of [-1,1]) {
        tube(organs,tracheaMat,[[0,1.285,.007],[s*.036,1.265,.006],[s*.06,1.25,.002]],.008,'lungs');
        ellipsoid(organs,lungMat,[s*.087,1.262,-.008],[.056,.105,.062],'lungs',s*-.16);
        ellipsoid(organs,lungMat,[s*.093,1.181,-.007],[.058,.048,.060],'lungs',s*.15);
        if(s===-1) ellipsoid(organs,lungMat,[-.105,1.226,.024],[.045,.039,.046],'lungs');
        // Branches are illustrative bronchi, not a vascular segmentation.
        for(let b=0;b<4;b++) tube(organs,tracheaMat,[[s*.038,1.27,.05],[s*.066,1.27-b*.019,.053],[s*(.092+b*.009),1.30-b*.034,.048]],.0028,'lungs');
    }
    ellipsoid(organs,heartMat,[.028,1.205,.061],[.038,.057,.036],'heart',-.36);
    ellipsoid(organs,heartMat,[.009,1.24,.05],[.027,.024,.027],'heart');
    ellipsoid(organs,heartMat,[.046,1.247,.047],[.022,.025,.023],'heart');
    tube(organs,arteryMat,[[.022,1.237,.064],[.026,1.285,.057],[0,1.301,.022],[-.019,1.274,-.016]],.010,'heart');
    tube(organs,veinMat,[[.003,1.225,.063],[-.011,1.257,.079],[.015,1.277,.066],[.05,1.272,.027]],.009,'heart');
    tube(organs,pancreasMat,[[.012,1.25,.087],[.025,1.224,.096],[.032,1.188,.084],[.045,1.17,.069]],.0025,'heart');
    ellipsoid(organs,liverMat,[-.068,1.111,.015],[.090,.047,.070],'liver',-.13);
    ellipsoid(organs,liverMat,[.025,1.119,.041],[.067,.025,.040],'liver',.17);
    ellipsoid(organs,gutMat,[.073,1.073,.012],[.039,.064,.034],null,-.40);
    tube(organs,gutMat,[[.016,1.27,-.036],[.022,1.17,-.024],[.048,1.125,-.004]],.009);
    for(const s of [-1,1]) {
        const kidney=ellipsoid(organs,renalMat,[s*.071,1.052+(s===1?.008:0),-.045],[.025,.045,.025],'kidneys',s*-.22);
        // Kidney hilum indentation on the medial side.
        const geo=sphere.clone(), pos=geo.attributes.position;
        for(let i=0;i<pos.count;i++) {const x=pos.getX(i),y=pos.getY(i); if(x*s<0) pos.setX(i,x*(1-.52*Math.exp(-y*y*12)));}
        geo.computeVertexNormals(); geometries.add(geo); kidney.geometry=geo;
        tube(organs,pancreasMat,[[s*.055,1.053,-.044],[s*.048,.959,-.043],[s*.021,.862,-.001]],.0028,'kidneys');
    }
    for(let p=0;p<12;p++) ellipsoid(organs,pancreasMat,[-.032+p*.009,1.060+p*.002,-.008],[.013,.012-p*.0004,.011],'pancreas');
    const bowelPoints=[];
    for(let row=0;row<7;row++) for(let col=0;col<9;col++) {
        const u=(row%2?8-col:col)/8;
        bowelPoints.push([-.064+u*.128,.995-row*.016+Math.sin(u*Math.PI*3)*.007,.032+Math.sin(u*Math.PI*2+row)*.011]);
    }
    tube(organs,gutMat,bowelPoints,.009,'intestine');
    const colonMat=material(0xad7b6e);
    tube(organs,colonMat,[[-.088,.886,.016],[-.098,.970,.016],[-.087,1.02,.018],[0,1.015,.04],[.093,1.015,.018],[.094,.93,.015],[.06,.865,.014],[0,.85,-.005],[0,.82,-.022]],.013);
    ellipsoid(organs,pancreasMat,[0,.846,.028],[.025,.026,.021]);
    tube(organs,arteryMat,[[-.018,1.274,-.023],[-.019,1.12,-.033],[-.017,.97,-.032],[0,.88,-.028]],.006);
    tube(organs,veinMat,[[.002,1.26,-.029],[.007,1.1,-.037],[.005,.94,-.033],[0,.88,-.04]],.006);
    const grid=new THREE.GridHelper(.8,16,0x405467,0x233345); grid.position.y=.003; scene.add(grid);
    let lost=false, selectedOrgan='heart';
    function render(){if(!lost && stage.clientWidth) renderer.render(scene,camera);}
    function resize(){const w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();render();}
    const observer=new ResizeObserver(resize); observer.observe(stage);
    controls.addEventListener('change',render);
    function setLayer(){
        const layer=host.querySelector('select').value;
        skin.visible=layer!=='skeleton'; organs.visible=['organs','combined','selected'].includes(layer); bones.visible=layer==='skeleton'||layer==='combined';
        for(const mesh of organs.children) mesh.visible=layer!=='selected'||mesh.userData.organ===selectedOrgan;
        skinMat.transparent=layer!=='surface';skinMat.opacity=layer==='surface'?1:.12;skinMat.depthWrite=layer==='surface';skinMat.needsUpdate=true;
        eyeMat.visible=lipMat.visible=layer==='surface';
        render();
    }
    host.querySelector('select').addEventListener('change',setLayer);
    host.querySelector('.body-model-toolbar').addEventListener('click',e=>{
        const view=e.target.closest('[data-view]')?.dataset.view;if(!view)return;
        if(view==='in'||view==='out') {camera.position.sub(controls.target).multiplyScalar(view==='in'?.8:1.25).add(controls.target);}
        else {controls.target.set(0,.88,0);camera.position.set(view==='side'?3.25:0,.92,view==='back'?-3.25:view==='side'?0:3.25);if(view==='reset'){host.querySelector('select').value='organs';setLayer();}}
        controls.update();render();
    });
    canvas.addEventListener('keydown',e=>{
        if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();
        const offset=camera.position.clone().sub(controls.target), spherical=new THREE.Spherical().setFromVector3(offset);
        spherical.theta+=e.key==='ArrowLeft'?-.15:e.key==='ArrowRight'?.15:0;
        spherical.phi=THREE.MathUtils.clamp(spherical.phi+(e.key==='ArrowUp'?-.12:e.key==='ArrowDown'?.12:0),.25,Math.PI-.25);
        camera.position.copy(controls.target).add(offset.setFromSpherical(spherical));controls.update();render();
    });
    const raycaster=new THREE.Raycaster(), pointer=new THREE.Vector2();let down=null;
    canvas.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY];});
    canvas.addEventListener('pointerup',e=>{
        if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5||!organs.visible){down=null;return;}down=null;
        const rect=canvas.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
        raycaster.setFromCamera(pointer,camera);
        const hit=raycaster.intersectObjects(organs.children.filter(mesh=>mesh.visible),false)[0];
        if(hit?.object.userData.organ) onSelect(hit.object.userData.organ);
    });
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;status.textContent='3D graphics context lost. Organ lessons remain available; reload to restore the model.';});
    function select(id){
        selectedOrgan=id;
        if(!organs.visible) host.querySelector('select').value='organs';
        organs.traverse(mesh=>{if(!mesh.isMesh||!mesh.userData.organ)return;
            if(!mesh.userData.highlightMaterial){mesh.material=mesh.material.clone();materials.add(mesh.material);mesh.userData.highlightMaterial=true;}
            mesh.material.emissive.setHex(mesh.userData.organ===id?0x482410:0x000000);
        });
        status.textContent=`Selected: ${id==='intestine'?'small intestine':id}. Gold illumination marks the organ; its lesson appears alongside or below. Use “Selected organ only” to inspect it without overlapping organs.`;
        setLayer();
    }
    window.addEventListener('body-clear-personal-data',()=>{host.querySelector('select').value='organs';controls.target.set(0,.88,0);camera.position.set(0,.92,3.25);controls.update();setLayer();});
    window.addEventListener('pagehide',e=>{if(e.persisted)return;observer.disconnect();controls.dispose();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();grid.geometry.dispose();for(const m of grid.material instanceof Array?grid.material:[grid.material])m.dispose();renderer.dispose();},{once:true});
    controls.update();setLayer();resize();return {select};
}
