import {
  Component, ElementRef, ViewChild,
  Input, OnInit, OnDestroy, OnChanges,
  SimpleChanges, HostListener
} from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { Terrain } from '../../models/terrain.model';

@Component({
  selector: 'app-terrain-viewer-3d',
  standalone: false,
  templateUrl: './terrain-viewer-3d.component.html',
  styleUrls: ['./terrain-viewer-3d.component.css']
})
export class TerrainViewer3dComponent implements OnInit, OnDestroy, OnChanges {

  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @Input() selectedTerrain: Terrain | null = null;

  /* ── UI state bound to template ── */
  activeView: 'terrain' | 'topo' | 'irrigation' | 'cultures' = 'terrain';
  autoRotate    = false;
  wireframe     = false;
  heightScale   = 14;   // slider 2-45, divided by 10
  timeOfDay     = 42;   // slider 0-100
  fogAmount     = 30;   // slider 0-100
  sunTimeLabel  = '10:04';
  selectedPlot  = -1;
  hoveredPlot: any = null;
  tooltipX = 0;
  tooltipY = 0;

  /* ── Three.js objects ── */
  private scene!:    THREE.Scene;
  private camera!:   THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private animId:    number | null = null;

  private terrainGroup: THREE.Group | null = null;
  private plotMeshes:   THREE.Mesh[]       = [];
  private sunLight!:    THREE.DirectionalLight;
  private ambLight!:    THREE.AmbientLight;
  private hemiLight!:   THREE.HemisphereLight;
  private skyMat!:      THREE.ShaderMaterial;
  private starPoints!:  THREE.Points;

  private raycaster = new THREE.Raycaster();
  private mouse     = new THREE.Vector2();

  // ═══════════════════════════════════════════
  // LIFECYCLE
  // ═══════════════════════════════════════════

  ngOnInit(): void {
    this.initRenderer();
    this.initLights();
    this.buildSky();
    this.buildStars();
    this.applyTimeOfDay(this.timeOfDay);
    this.startLoop();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedTerrain'] && this.renderer) {
      this.selectedPlot = -1;
      this.rebuildScene();
      if (this.selectedTerrain) this.focusCamera();
    }
  }

  ngOnDestroy(): void {
    if (this.animId) cancelAnimationFrame(this.animId);
    this.renderer?.dispose();
    this.controls?.dispose();
    this.disposeGroup(this.terrainGroup);
  }

  // ═══════════════════════════════════════════
  // RENDERER + CAMERA + CONTROLS
  // ═══════════════════════════════════════════

  private initRenderer(): void {
    const canvas = this.canvasRef.nativeElement;
    const W = canvas.clientWidth  || 900;
    const H = canvas.clientHeight || 560;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(46, W / H, 0.05, 600);
    this.camera.position.set(14, 10, 14);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, logarithmicDepthBuffer: true
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(W, H);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping        = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping  = true;
    this.controls.dampingFactor  = 0.07;
    this.controls.minDistance    = 3;
    this.controls.maxDistance    = 65;
    this.controls.maxPolarAngle  = Math.PI * 0.47;
    this.controls.autoRotateSpeed = 1.5;

    this.scene.fog = new THREE.FogExp2(0x8baabe, 0.030);
  }

  // ═══════════════════════════════════════════
  // LIGHTS
  // ═══════════════════════════════════════════

  private initLights(): void {
    this.ambLight = new THREE.AmbientLight(0x8baabe, 0.3);
    this.scene.add(this.ambLight);

    this.hemiLight = new THREE.HemisphereLight(0x8ec8f5, 0x3d5a2a, 0.55);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff5d0, 1.7);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(4096, 4096);
    this.sunLight.shadow.camera.near   =  0.5;
    this.sunLight.shadow.camera.far    =  130;
    this.sunLight.shadow.camera.left   = -28;
    this.sunLight.shadow.camera.right  =  28;
    this.sunLight.shadow.camera.top    =  28;
    this.sunLight.shadow.camera.bottom = -28;
    this.sunLight.shadow.bias          = -0.0002;
    this.sunLight.shadow.normalBias    =  0.02;
    this.scene.add(this.sunLight);
  }

  // ═══════════════════════════════════════════
  // PHYSICALLY-BASED SKY SHADER
  // ═══════════════════════════════════════════

  private buildSky(): void {
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        uSun: { value: new THREE.Vector3(0, 1, 0) },
        uTOD: { value: 0.42 }
      },
      vertexShader: `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3  uSun;
        uniform float uTOD;
        varying vec3  vPos;
        void main() {
          vec3  d = normalize(vPos);
          float h = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
          float t = uTOD;

          vec3 zDay   = vec3(0.28, 0.55, 0.92);
          vec3 zDusk  = vec3(0.08, 0.12, 0.30);
          vec3 zNight = vec3(0.01, 0.01, 0.05);
          vec3 hDay   = vec3(0.62, 0.78, 0.96);
          vec3 hDusk  = vec3(0.82, 0.40, 0.14);
          vec3 hNight = vec3(0.03, 0.04, 0.10);

          float dawn   = clamp((1.0 - abs(t - 0.5) * 2.0) * 2.2, 0.0, 1.0);
          vec3  zenith = mix(mix(zNight, zDusk, dawn), zDay,  clamp(t * 1.8 - 0.4, 0.0, 1.0));
          vec3  horiz  = mix(mix(hNight, hDusk, dawn), hDay,  clamp(t * 1.8 - 0.4, 0.0, 1.0));
          vec3  sky    = mix(horiz, zenith, pow(h, 0.55));

          vec3  sd     = normalize(uSun);
          float disc   = pow(max(0.0, dot(d, sd)), 260.0) * 3.0;
          float corona = pow(max(0.0, dot(d, sd)),  14.0) * 0.8 * (1.0 - h * 0.4);
          vec3  sunC   = mix(vec3(1.0, 0.32, 0.04), vec3(1.0, 0.95, 0.70), clamp(t * 2.0 - 0.3, 0.0, 1.0));
          sky += sunC * disc + mix(vec3(1.0, 0.5, 0.1), vec3(0.9, 0.85, 0.6), t) * corona;

          float haze   = pow(max(0.0, 1.0 - abs(d.y) * 0.8), 0.6) * 0.18 * t;
          sky += vec3(0.7, 0.85, 1.0) * haze;

          gl_FragColor = vec4(sky, 1.0);
        }
      `
    });
    this.scene.add(new THREE.Mesh(new THREE.SphereGeometry(280, 24, 12), this.skyMat));
  }

  // ═══════════════════════════════════════════
  // STARS
  // ═══════════════════════════════════════════

  private buildStars(): void {
    const v: number[] = [];
    for (let i = 0; i < 2200; i++) {
      const r = 260;
      const t = Math.acos(1 - 2 * Math.random()) - Math.PI / 2;
      const p = Math.random() * Math.PI * 2;
      v.push(r * Math.cos(t) * Math.cos(p), r * Math.sin(t), r * Math.cos(t) * Math.sin(p));
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    this.starPoints = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.55, transparent: true, opacity: 0.75 })
    );
    this.scene.add(this.starPoints);
  }

  // ═══════════════════════════════════════════
  // NOISE FUNCTIONS
  // ═══════════════════════════════════════════

  private hash(x: number, z: number): number {
    const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
    return n - Math.floor(n);
  }

  private smoothNoise(x: number, z: number): number {
    const ix = Math.floor(x), iz = Math.floor(z);
    const fx = x - ix, fz = z - iz;
    const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
    return this.hash(ix,   iz)   * (1-ux) * (1-uz)
         + this.hash(ix+1, iz)   *    ux  * (1-uz)
         + this.hash(ix,   iz+1) * (1-ux) *    uz
         + this.hash(ix+1, iz+1) *    ux  *    uz;
  }

  private fbm(x: number, z: number, octaves: number): number {
    let v = 0, a = 0.5, f = 1;
    for (let i = 0; i < octaves; i++) {
      v += this.smoothNoise(x * f, z * f) * a;
      a *= 0.52; f *= 2.07;
    }
    return v;
  }

  // ═══════════════════════════════════════════
  // TERRAIN BUILDER
  // ═══════════════════════════════════════════

  private rebuildScene(): void {
    this.disposeGroup(this.terrainGroup);
    this.terrainGroup = new THREE.Group();
    this.plotMeshes   = [];

    if (!this.selectedTerrain) {
      this.scene.add(this.terrainGroup);
      return;
    }

    const t   = this.selectedTerrain;
    const sz  = Math.sqrt(t.superficieHa) * 2.9;
    const RES = 96;
    const hs  = this.heightScale / 10;
    const N   = (RES + 1) * (RES + 1);

    /* Soil colour base */
    const soilBase: Record<string, [number, number, number]> = {
      'Limoneux':       [0.34, 0.40, 0.18],
      'LIMONEUX':       [0.34, 0.40, 0.18],
      'Argileux':       [0.44, 0.28, 0.16],
      'ARGILEUX':       [0.44, 0.28, 0.16],
      'Sableux':        [0.70, 0.58, 0.34],
      'SABLEUX':        [0.70, 0.58, 0.34],
      'Calcaire':       [0.68, 0.64, 0.52],
      'CALCAIRE':       [0.68, 0.64, 0.52],
      'Humifère':       [0.20, 0.27, 0.12],
      'HUMIFERE':       [0.20, 0.27, 0.12],
      'Salin':          [0.56, 0.60, 0.58],
      'SALIN':          [0.56, 0.60, 0.58],
      'SILICO_ARGILEUX':[0.50, 0.36, 0.20],
    };
    const sr = soilBase[t.typeSol] ?? [0.34, 0.40, 0.18];

    /* Vertex buffers */
    const pos  = new Float32Array(N * 3);
    const nrm  = new Float32Array(N * 3);
    const uv   = new Float32Array(N * 2);
    const col  = new Float32Array(N * 3);
    const idx: number[] = [];
    const hts  = new Float32Array(N);

    for (let iz = 0; iz <= RES; iz++) {
      for (let ix = 0; ix <= RES; ix++) {
        const i   = iz * (RES + 1) + ix;
        const nx  = ix / RES * 4.2;
        const nz  = iz / RES * 4.2;

        /* Multi-octave terrain */
        const macro = this.fbm(nx, nz, 6)                * hs * 1.3;
        const meso  = this.fbm(nx * 2.8 + 3, nz * 2.8 + 7, 4) * hs * 0.28;
        const micro = this.fbm(nx * 8  + 11, nz * 8  + 5, 2) * hs * 0.05;
        const edge  = Math.pow(Math.min(ix, RES-ix, iz, RES-iz) / 14, 1.2);
        const y     = (macro + meso + micro) * Math.min(1, edge);
        hts[i] = y;

        pos[i*3]   = (ix / RES - 0.5) * sz;
        pos[i*3+1] = y;
        pos[i*3+2] = (iz / RES - 0.5) * sz;
        uv[i*2]    = ix / RES;
        uv[i*2+1]  = iz / RES;

        /* Realistic vertex colour: slope + wetness + rock */
        const prev  = i > 0 ? hts[Math.max(0, i-1)] : y;
        const slp   = Math.abs(y - prev) * 3.5;
        const wet   = this.fbm(nx * 1.8 + 1.3, nz * 1.8 + 4.7, 2) * 0.35;
        const rock  = this.fbm(nx * 3.5 + 6,   nz * 3.5 + 2,   3) * 0.2;

        col[i*3]   = Math.max(0, Math.min(1, sr[0] + slp*0.18 - wet*0.06 + rock*0.10 + this.fbm(nx+12, nz+7, 2)*0.06));
        col[i*3+1] = Math.max(0, Math.min(1, sr[1] + slp*0.08 + wet*0.05 - rock*0.04 + this.fbm(nx+3,  nz+10,2)*0.06));
        col[i*3+2] = Math.max(0, Math.min(1, sr[2] - slp*0.04 + wet*0.07 - rock*0.02 + this.fbm(nx+17, nz+1, 2)*0.04));
      }
    }

    for (let iz = 0; iz < RES; iz++) {
      for (let ix = 0; ix < RES; ix++) {
        const a = iz * (RES + 1) + ix;
        idx.push(a, a+1, a+RES+2, a, a+RES+2, a+RES+1);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal',   new THREE.Float32BufferAttribute(nrm, 3));
    geo.setAttribute('uv',       new THREE.Float32BufferAttribute(uv,  2));
    geo.setAttribute('color',    new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, wireframe: this.wireframe }));
    mesh.receiveShadow = true;
    this.terrainGroup.add(mesh);

    /* ── Grass instances ── */
    if (this.activeView === 'terrain') {
      const GN     = 1600;
      const dummy  = new THREE.Object3D();
      const gInst  = new THREE.InstancedMesh(
        new THREE.PlaneGeometry(0.12, 0.22),
        new THREE.MeshLambertMaterial({ color: 0x3a6b1a, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }),
        GN
      );
      for (let i = 0; i < GN; i++) {
        const gx = (Math.random() - 0.5) * sz * 0.95;
        const gz = (Math.random() - 0.5) * sz * 0.95;
        const ni = Math.floor((gz / sz + 0.5) * RES) * (RES + 1) + Math.floor((gx / sz + 0.5) * RES);
        const gy = (hts[Math.max(0, Math.min(N-1, ni))] ?? 0) + 0.11;
        dummy.position.set(gx, gy, gz);
        dummy.rotation.set(0, Math.random() * Math.PI, 0);
        dummy.scale.set(0.7 + Math.random() * 0.6, 0.7 + Math.random() * 0.8, 1);
        dummy.updateMatrix();
        gInst.setMatrixAt(i, dummy.matrix);
        gInst.setColorAt!(i, new THREE.Color().setHSL(0.25 + Math.random() * 0.08, 0.65 + Math.random() * 0.2, 0.22 + Math.random() * 0.1));
      }
      this.terrainGroup.add(gInst);
    }

    /* ── Crop plot overlays ── */
    if (this.activeView === 'cultures' || this.activeView === 'terrain') {
      const plots: any[] = (t as any).plots ?? [];
      if (plots.length > 0) {
        const pc = Math.ceil(Math.sqrt(plots.length));
        const pr = Math.ceil(plots.length / pc);
        const pw = (sz * 0.87) / pc;
        const ph = (sz * 0.87) / pr;

        plots.forEach((pl: any, i: number) => {
          const c   = i % pc, r = Math.floor(i / pc);
          const cx  = (c - pc/2 + 0.5) * pw;
          const cz  = (r - pr/2 + 0.5) * ph;
          const ni  = Math.floor((cz/sz + 0.5)*RES) * (RES+1) + Math.floor((cx/sz + 0.5)*RES);
          const bY  = (hts[Math.max(0, Math.min(N-1, ni))] ?? 0) + 0.07;

          const rgb = Array.isArray(pl.color) ? pl.color : [0.5, 0.7, 0.3];
          const pg  = new THREE.PlaneGeometry(pw * 0.91, ph * 0.91, 1, 1);
          const pm  = new THREE.MeshLambertMaterial({
            color: new THREE.Color(rgb[0], rgb[1], rgb[2]),
            transparent: true,
            opacity: this.activeView === 'cultures' ? 0.82 : 0.52,
            side: THREE.DoubleSide, depthWrite: false
          });
          const pmesh = new THREE.Mesh(pg, pm);
          pmesh.rotation.x = -Math.PI / 2;
          pmesh.position.set(cx, bY, cz);
          pmesh.receiveShadow = true;
          pmesh.userData = { plot: pl, index: i, baseY: bY };
          this.plotMeshes.push(pmesh);
          this.terrainGroup!.add(pmesh);

          const el = new THREE.LineSegments(
            new THREE.EdgesGeometry(pg),
            new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.15 })
          );
          el.rotation.x = -Math.PI / 2;
          el.position.set(cx, bY + 0.01, cz);
          this.terrainGroup!.add(el);
        });
      }
    }

    /* ── Irrigation tubes ── */
    if (this.activeView === 'irrigation' || this.activeView === 'terrain') {
      const irrColors: Record<string, number> = {
        'GOUTTE_A_GOUTTE': 0x1a6fd4, 'Goutte à goutte': 0x1a6fd4,
        'ASPERSION': 0x3b9ddd,       'Aspersion': 0x3b9ddd,
        'INONDATION': 0x0d3fa0,      'Inondation': 0x0d3fa0,
        'PLUVIAL': 0x55aaee,         'Pluvial': 0x55aaee,
      };
      const irrCol = new THREE.Color(irrColors[t.irrigation] ?? 0x1a6fd4);
      const rows   = this.activeView === 'irrigation' ? 7 : 3;

      for (let r = 0; r < rows; r++) {
        const lz  = ((r / (rows - 1)) - 0.5) * sz * 0.80;
        const pts: THREE.Vector3[] = [];
        for (let xi = 0; xi <= 36; xi++) {
          const lx = (xi / 36 - 0.5) * sz * 0.88;
          const ni = Math.floor((lz/sz + 0.5)*RES) * (RES+1) + Math.floor((lx/sz + 0.5)*RES);
          const lh = (hts[Math.max(0, Math.min(N-1, ni))] ?? 0) + 0.08;
          pts.push(new THREE.Vector3(lx, lh, lz));
        }
        const tube = new THREE.Mesh(
          new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, this.activeView === 'irrigation' ? 0.055 : 0.028, 6, false),
          new THREE.MeshLambertMaterial({ color: irrCol, transparent: true, opacity: this.activeView === 'irrigation' ? 0.92 : 0.62 })
        );
        tube.castShadow = true;
        this.terrainGroup.add(tube);
      }
    }

    /* ── Topographic contours (marching squares) ── */
    if (this.activeView === 'topo') {
      const mn = Math.min(...Array.from(hts));
      const mx = Math.max(...Array.from(hts));
      for (let s = 0; s < 14; s++) {
        const tgt  = mn + (mx - mn) * (s / 14);
        const pts: THREE.Vector3[] = [];
        for (let ix = 0; ix < RES; ix++) {
          for (let iz = 0; iz < RES; iz++) {
            const h00 = hts[iz*(RES+1)+ix], h10 = hts[iz*(RES+1)+ix+1], h01 = hts[(iz+1)*(RES+1)+ix];
            if ((h00 < tgt) !== (h10 < tgt)) {
              const f = (tgt - h00) / (h10 - h00);
              pts.push(new THREE.Vector3(((ix+f)/RES - 0.5)*sz, tgt+0.05, (iz/RES - 0.5)*sz));
            }
            if ((h00 < tgt) !== (h01 < tgt)) {
              const f = (tgt - h00) / (h01 - h00);
              pts.push(new THREE.Vector3((ix/RES - 0.5)*sz, tgt+0.05, ((iz+f)/RES - 0.5)*sz));
            }
          }
        }
        if (pts.length > 1) {
          const frac = s / 14;
          this.terrainGroup.add(new THREE.Points(
            new THREE.BufferGeometry().setFromPoints(pts),
            new THREE.PointsMaterial({ color: new THREE.Color().setHSL(0.35 - frac*0.2, 0.82, 0.32 + frac*0.38), size: 0.045 })
          ));
        }
      }
    }

    /* ── Realistic varied trees ── */
    const treeCount = this.activeView === 'terrain' ? 28 : 6;
    for (let i = 0; i < treeCount; i++) {
      const ang  = Math.random() * Math.PI * 2;
      const dist = sz * (0.5 + Math.random() * 0.28);
      const ttx  = Math.cos(ang) * dist, ttz = Math.sin(ang) * dist;
      const ni   = Math.floor((ttz/sz + 0.5)*RES) * (RES+1) + Math.floor((ttx/sz + 0.5)*RES);
      const tty  = hts[Math.max(0, Math.min(N-1, ni))] ?? 0;
      const th   = 0.7 + Math.random() * 1.5;
      const tr   = 0.07 + Math.random() * 0.05;

      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(tr * 0.55, tr, th, 7),
        new THREE.MeshLambertMaterial({ color: new THREE.Color(0.22 + Math.random()*0.1, 0.14, 0.07) })
      );
      trunk.position.set(ttx, tty + th/2, ttz);
      trunk.castShadow = true;
      this.terrainGroup.add(trunk);

      const cr   = 0.32 + Math.random() * 0.6;
      const type = Math.random();
      const cGeo = type < 0.4
        ? new THREE.SphereGeometry(cr, 7, 5)
        : type < 0.75
          ? new THREE.ConeGeometry(cr, cr * 2.2, 7)
          : new THREE.IcosahedronGeometry(cr, 0);
      const gv   = 0.15 + Math.random() * 0.25;
      const can  = new THREE.Mesh(cGeo, new THREE.MeshLambertMaterial({
        color: new THREE.Color(0.08 + gv*0.3, 0.18 + gv*0.4, 0.06)
      }));
      can.position.set(ttx, tty + th + cr * 0.7, ttz);
      can.castShadow = true;
      this.terrainGroup.add(can);
    }

    /* ── Rocks ── */
    if (this.activeView === 'terrain' || this.activeView === 'topo') {
      for (let i = 0; i < 16; i++) {
        const rx = (Math.random() - 0.5) * sz * 1.15;
        const rz = (Math.random() - 0.5) * sz * 1.15;
        const ni = Math.floor((rz/sz + 0.5)*RES) * (RES+1) + Math.floor((rx/sz + 0.5)*RES);
        const ry = hts[Math.max(0, Math.min(N-1, ni))] ?? 0;
        const rs = 0.05 + Math.random() * 0.22;
        const rg = new THREE.DodecahedronGeometry(rs, 0);
        rg.rotateX(Math.random() * Math.PI);
        rg.rotateY(Math.random() * Math.PI);
        const rock = new THREE.Mesh(rg, new THREE.MeshLambertMaterial({
          color: new THREE.Color(0.36 + Math.random()*0.1, 0.32 + Math.random()*0.08, 0.26 + Math.random()*0.08)
        }));
        rock.position.set(rx, ry + rs * 0.4, rz);
        rock.castShadow = rock.receiveShadow = true;
        this.terrainGroup.add(rock);
      }
    }

    /* ── Flood water plane (irrigation = inondation) ── */
    if (this.activeView === 'irrigation' && (t.irrigation === 'INONDATION' || t.irrigation === 'Inondation')) {
      const wm = new THREE.Mesh(
        new THREE.PlaneGeometry(sz * 0.88, sz * 0.88),
        new THREE.MeshLambertMaterial({ color: 0x1a55a0, transparent: true, opacity: 0.35 })
      );
      wm.rotation.x = -Math.PI / 2;
      wm.position.y = 0.14;
      this.terrainGroup.add(wm);
    }

    /* ── Infinite ground plane ── */
    const gnd = new THREE.Mesh(
      new THREE.PlaneGeometry(600, 600),
      new THREE.MeshLambertMaterial({ color: new THREE.Color(0.12, 0.18, 0.08) })
    );
    gnd.rotation.x = -Math.PI / 2;
    gnd.position.y = -0.55;
    gnd.receiveShadow = true;
    this.terrainGroup.add(gnd);

    this.scene.add(this.terrainGroup);
  }

  // ═══════════════════════════════════════════
  // TIME OF DAY
  // ═══════════════════════════════════════════

  applyTimeOfDay(value: number): void {
    this.timeOfDay = value;
    const tod  = value / 100;
    const hour = 6 + tod * 12;
    const h    = Math.floor(hour);
    const m    = Math.floor((hour - h) * 60);
    this.sunTimeLabel = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;

    const ang = Math.PI * (tod - 0.05);
    const sx  = Math.cos(ang) * 32;
    const sy  = Math.max(0.5, Math.sin(ang) * 28);
    const sz  = 9;

    if (this.sunLight) {
      this.sunLight.position.set(sx, sy, sz);
      this.sunLight.intensity = Math.max(0, Math.sin(ang) * 2.0);
      const warm = Math.max(0, 1 - Math.abs(tod - 0.5) * 3);
      this.sunLight.color.setRGB(1, 0.84 + warm * 0.12, 0.48 + warm * 0.45);
    }
    if (this.ambLight)  this.ambLight.intensity  = 0.12 + tod * 0.28;
    if (this.hemiLight) this.hemiLight.intensity  = 0.18 + tod * 0.42;
    if (this.skyMat) {
      this.skyMat.uniforms['uSun'].value.set(sx, sy, sz).normalize();
      this.skyMat.uniforms['uTOD'].value = tod;
    }
    if (this.starPoints) {
      (this.starPoints.material as THREE.PointsMaterial).opacity = Math.max(0, 0.75 - tod * 1.6);
    }
    if (this.scene.fog) {
      (this.scene.fog as THREE.FogExp2).color.setRGB(0.54 + tod*0.3, 0.67 + tod*0.25, 0.85 + tod*0.1);
    }
  }

  applyFog(value: number): void {
    this.fogAmount = value;
    if (this.scene.fog) {
      (this.scene.fog as THREE.FogExp2).density = value * 0.0007 + 0.002;
    }
  }

  // ═══════════════════════════════════════════
  // RENDER LOOP
  // ═══════════════════════════════════════════

  private startLoop(): void {
    const loop = () => {
      this.animId = requestAnimationFrame(loop);
      this.controls.autoRotate = this.autoRotate;
      this.controls.update();

      const now = performance.now();
      this.plotMeshes.forEach((m, i) => {
        const sel  = i === this.selectedPlot;
        const bY   = m.userData['baseY'] ?? 0.07;
        const tgtY = bY + (sel ? 0.07 + Math.sin(now * 0.0028) * 0.02 : 0);
        m.position.y += (tgtY - m.position.y) * 0.1;
        const mat  = m.material as THREE.MeshLambertMaterial;
        const tgtO = (this.activeView === 'cultures' ? 0.82 : 0.52) + (sel ? 0.10 : 0);
        mat.opacity += (tgtO - mat.opacity) * 0.08;
      });

      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  // ═══════════════════════════════════════════
  // RAYCASTING
  // ═══════════════════════════════════════════

  onMouseMove(event: MouseEvent): void {
    if (!this.renderer) return;
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    this.mouse.x =  ((event.clientX - rect.left) / rect.width)  * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top)  / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hits = this.raycaster.intersectObjects(this.plotMeshes);
    if (hits.length) {
      this.hoveredPlot = hits[0].object.userData['plot'];
      this.tooltipX    = event.clientX - rect.left + 14;
      this.tooltipY    = event.clientY - rect.top  - 10;
    } else {
      this.hoveredPlot = null;
    }
  }

  onMouseClick(event: MouseEvent): void {
    if (!this.renderer) return;
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    this.mouse.x =  ((event.clientX - rect.left) / rect.width)  * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top)  / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hits = this.raycaster.intersectObjects(this.plotMeshes);
    if (hits.length) {
      const idx = hits[0].object.userData['index'];
      this.selectedPlot = this.selectedPlot === idx ? -1 : idx;
    }
  }

  // ═══════════════════════════════════════════
  // CONTROLS
  // ═══════════════════════════════════════════

  setView(view: 'terrain' | 'topo' | 'irrigation' | 'cultures'): void {
    this.activeView   = view;
    this.selectedPlot = -1;
    this.rebuildScene();
  }

  toggleAutoRotate(): void { this.autoRotate = !this.autoRotate; }

  toggleWireframe(): void {
    this.wireframe = !this.wireframe;
    this.rebuildScene();
  }

  setHeightScale(value: number): void {
    this.heightScale = value;
    this.rebuildScene();
  }

  focusCamera(): void {
    if (!this.selectedTerrain) return;
    const d = Math.max(12, Math.sqrt(this.selectedTerrain.superficieHa) * 4.5);
    this.camera.position.set(d, d * 0.7, d);
    this.camera.lookAt(0, 0, 0);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  selectPlot(index: number): void {
    this.selectedPlot = this.selectedPlot === index ? -1 : index;
  }

  get currentPlots(): any[] { return (this.selectedTerrain as any)?.plots ?? []; }

  plotCssColor(plot: any): string {
    const c = Array.isArray(plot?.color) ? plot.color : [0.5, 0.7, 0.3];
    return `rgb(${c.map((v: number) => Math.round(v * 255)).join(',')})`;
  }

  get heightScaleLabel(): string { return (this.heightScale / 10).toFixed(1) + '×'; }

  @HostListener('window:resize')
  onResize(): void {
    if (!this.renderer) return;
    const el = this.canvasRef.nativeElement;
    this.camera.aspect = el.clientWidth / el.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(el.clientWidth, el.clientHeight);
  }

  private disposeGroup(group: THREE.Group | null): void {
    if (!group) return;
    this.scene?.remove(group);
    group.traverse((obj: any) => {
      obj.geometry?.dispose();
      (Array.isArray(obj.material) ? obj.material : [obj.material])
        .forEach((m: THREE.Material) => m?.dispose());
    });
  }
}