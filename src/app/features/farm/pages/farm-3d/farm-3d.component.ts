import {
  ChangeDetectorRef,
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ElementRef,
  ViewChild
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { TerrainService } from '../../services/terrain.service';
import { ParcelleService } from '../../services/parcelle.service';
import { CultureService } from '../../services/culture.service';
import { Terrain } from '../../models/terrain.model';
import { Parcelle, Culture, StadeCulture } from '../../models/parcelle.model';

/** Élément du catalogue glisser-déposer vers le terrain */
export interface PlantPaletteItem {
  id: string;
  label: string;
  icon: string;
  /** Valeur `type` du formulaire culture (cereal, legume, fruit, …) */
  cultureType: string;
  defaultName: string;
  /** Rendu 3D */
  visual: 'tree' | 'bush' | 'row';
}

@Component({
  selector: 'app-farm-3d',
  templateUrl: './farm-3d.component.html',
  styleUrls: ['./farm-3d.component.css']
})
export class Farm3dComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('canvas', { static: false }) canvas!: ElementRef<HTMLCanvasElement>;

  terrainId: number = 0;
  terrain: Terrain | null = null;
  parcelles: Parcelle[] = [];
  cultures: Culture[] = [];

  // Three.js objects
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private terrainMesh!: THREE.Mesh;
  private terrainDetailGroup?: THREE.Group;
  private animatedSceneObjects: Array<{ object: THREE.Object3D; speed: number }> = [];
  private smokePuffs: THREE.Mesh[] = [];
  /** Outlines (LineLoop) and fills (Mesh) saved parcelles — use Object3D to satisfy TypeScript */
  private parcelleMeshes: THREE.Object3D[] = [];
  private cultureMeshes: THREE.Object3D[] = [];

  // UI state
  isLoading = true;
  error: string | null = null;
  showParcelleForm = false;
  showCultureForm = false;
  selectedParcelle: Parcelle | null = null;
  /** Parcelle sélectionnée dans la liste pour mise en évidence sur le terrain */
  highlightedParcelleId: number | null = null;
  isDrawingParcelle = false;
  parcellePoints: THREE.Vector3[] = [];
  private undoStack: THREE.Vector3[] = [];
  private redoStack: THREE.Vector3[] = [];
  /** Tracé de dessin (tube épais, visible sur le relief) */
  private parcelleDrawTube?: THREE.Mesh;
  /** Aperçu semi-transparent du polygone (≥ 3 points) */
  private parcelleDrawPreviewFill?: THREE.Mesh;

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  get canUndo(): boolean {
    return this.parcellePoints.length > 0;
  }
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private isThreeInitialized = false;
  private fieldSideMeters = 100;
  private onCanvasPointerDownHandler = (event: PointerEvent) => this.onCanvasPointerDown(event);
  private onWindowResizeHandler = () => this.onWindowResize();
  private onCanvasDragOverHandler = (event: DragEvent) => this.onCanvasDragOver(event);
  private onCanvasDropHandler = (event: DragEvent) => this.onCanvasDrop(event);
  private onCanvasDragLeaveHandler = () => this.onCanvasDragLeave();

  /** Glisser-déposer plantation */
  canvasDropHighlight = false;

  readonly plantPalette: PlantPaletteItem[] = [
    { id: 'ble', label: 'Blé', icon: 'fa-bread-slice', cultureType: 'cereal', defaultName: 'Blé', visual: 'row' },
    { id: 'mais', label: 'Maïs', icon: 'fa-leaf', cultureType: 'cereal', defaultName: 'Maïs', visual: 'row' },
    { id: 'tomate', label: 'Tomate', icon: 'fa-apple-whole', cultureType: 'legume', defaultName: 'Tomate', visual: 'bush' },
    { id: 'carotte', label: 'Carotte', icon: 'fa-carrot', cultureType: 'legume', defaultName: 'Carotte', visual: 'bush' },
    { id: 'salade', label: 'Salade', icon: 'fa-seedling', cultureType: 'legume', defaultName: 'Salade', visual: 'bush' },
    { id: 'pomme', label: 'Pommier', icon: 'fa-apple-whole', cultureType: 'fruit', defaultName: 'Pomme', visual: 'tree' },
    { id: 'olive', label: 'Olivier', icon: 'fa-tree', cultureType: 'fruit', defaultName: 'Olivier', visual: 'tree' },
    { id: 'raisin', label: 'Vigne', icon: 'fa-wine-bottle', cultureType: 'fruit', defaultName: 'Raisin', visual: 'bush' },
    { id: 'autre', label: 'Autre', icon: 'fa-plus', cultureType: 'legume', defaultName: 'Culture', visual: 'bush' }
  ];

  // Forms
  parcelleForm: FormGroup;
  cultureForm: FormGroup;

  private subscriptions: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private terrainService: TerrainService,
    private parcelleService: ParcelleService,
    private cultureService: CultureService,
    private cdr: ChangeDetectorRef
  ) {
    this.parcelleForm = this.fb.group({
      nom: ['', [Validators.required, Validators.minLength(2)]],
      surface: [0, [Validators.required, Validators.min(0.01)]],
      geom: ['', Validators.required] // Will be set by drawing
    });

    this.cultureForm = this.fb.group({
      nom: ['', [Validators.required, Validators.minLength(2)]],
      type: ['', Validators.required],
      dateSemis: ['', Validators.required],
      dateRecolte: ['', Validators.required],
      stade: [StadeCulture.SEMIS, Validators.required],
      parcelleId: [null as number | null, Validators.required]
    });
  }

  ngOnInit(): void {
    this.terrainId = +this.route.snapshot.params['id'];
    if (!this.terrainId) {
      this.router.navigate(['/farm/list']);
      return;
    }

    this.loadTerrain();
    this.loadParcelles();
  }

  ngAfterViewInit(): void {
    // Initialize Three.js after data loads and canvas is available
    setTimeout(() => {
      if (this.canvas && !this.isThreeInitialized) {
        this.initThreeJS();
      }
    }, 100);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.cleanupThreeJS();
  }

  private loadTerrain(): void {
    this.terrainService.getTerrain(this.terrainId).subscribe({
      next: (terrain: Terrain) => {
        this.terrain = terrain;
        this.isLoading = false;
        // Le canvas n’existe qu’après *ngIf="!isLoading" — attendre le cycle de vue
        setTimeout(() => {
          this.initThreeIfReady();
          this.updateTerrainMesh();
        }, 0);
      },
      error: (error: any) => {
        console.error('Error loading terrain:', error);
        this.error = 'Erreur lors du chargement du terrain';
        this.isLoading = false;
      }
    });
  }

  private loadParcelles(): void {
    this.parcelleService.getParcellesByTerrain(this.terrainId).subscribe({
      next: (parcelles) => {
        // API Java expose idParcelle ; le template et les cultures utilisent id
        this.parcelles = parcelles.map((p) => ({
          ...p,
          id: p.id ?? p.idParcelle
        }));
        this.updateParcelleMeshes();
        const apply = () => {
          this.updateParcelleMeshes();
          this.loadCulturesForTerrainParcelles();
        };
        if (this.scene) {
          apply();
        } else {
          setTimeout(apply, 80);
        }
      },
      error: (error) => {
        console.error('Error loading parcelles:', error);
      }
    });
  }

  /** Agrège les cultures de toutes les parcelles du terrain (l’API n’expose que par parcelle) */
  private loadCulturesForTerrainParcelles(): void {
    const ids = this.parcelles.map((p) => p.id).filter((x): x is number => x != null);
    if (ids.length === 0) {
      this.cultures = [];
      this.updateCultureMeshes();
      return;
    }
    forkJoin(
      ids.map((parcelleId) =>
        this.cultureService.getCulturesByParcelle(parcelleId).pipe(
          map((list) => list.map((c) => this.normalizeCultureFromApi(c, parcelleId))),
          catchError(() => of([] as Culture[]))
        )
      )
    ).subscribe({
      next: (buckets) => {
        this.cultures = buckets.flat();
        this.updateCultureMeshes();
      },
      error: (e) => console.error('Error loading cultures:', e)
    });
  }

  private normalizeCultureFromApi(c: Culture, parcelleId: number): Culture {
    return {
      ...c,
      id: c.id ?? c.idCulture,
      parcelleId: c.parcelleId ?? parcelleId,
      nom: c.nom || c.espece || '',
      type: c.type ?? c.variete,
      variete: c.variete,
      dateRecolte: c.dateRecolte || c.dateRecoltePrevue || ''
    };
  }

  private initThreeIfReady(): void {
    if (this.isThreeInitialized || !this.canvas) {
      return;
    }
    this.initThreeJS();
  }

  private initThreeJS(): void {
    if (!this.canvas) {
      console.error('Canvas element not found');
      return;
    }
    if (this.isThreeInitialized) {
      return;
    }

    // Scene — ciel + brume lointaine
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xaed8f2);
    this.scene.fog = new THREE.FogExp2(0xb7d8ec, 0.0018);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      55,
      this.canvas.nativeElement.clientWidth / this.canvas.nativeElement.clientHeight,
      0.5,
      5000
    );
    this.camera.position.set(120, 90, 120);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas.nativeElement,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(this.canvas.nativeElement.clientWidth, this.canvas.nativeElement.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    // Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.maxPolarAngle = Math.PI * 0.485;

    this.isThreeInitialized = true;

    this.setupLighting();

    // Un seul maillage champ (clics = intersection réelle avec le relief)
    this.updateTerrainMesh();

    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', this.onCanvasPointerDownHandler);
    el.addEventListener('dragover', this.onCanvasDragOverHandler);
    el.addEventListener('drop', this.onCanvasDropHandler);
    el.addEventListener('dragleave', this.onCanvasDragLeaveHandler);
    window.addEventListener('resize', this.onWindowResizeHandler);

    this.animate();
  }

  private setupLighting(): void {
    const hemi = new THREE.HemisphereLight(0xe8f4ff, 0x5f4a36, 0.74);
    hemi.position.set(0, 120, 0);
    this.scene.add(hemi);

    const ambient = new THREE.AmbientLight(0xffffff, 0.2);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xfff1d6, 1.85);
    sun.position.set(160, 260, 120);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 3072;
    sun.shadow.mapSize.height = 3072;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 1200;
    sun.shadow.bias = -0.00025;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun);
    this.refreshShadowCameraForField(sun);
  }

  /** Hauteur du relief à (x,z) — vallées douces + petits détails (naturel) */
  private fieldHeightAt(x: number, z: number): number {
    const low =
      Math.sin(x * 0.044) * Math.cos(z * 0.041) * 1.15 +
      Math.cos(x * 0.031 - z * 0.028) * 0.48;
    const mid = Math.sin(x * 0.11 + z * 0.088) * 0.42 + Math.cos(x * 0.078 + z * 0.062) * 0.26;
    const detail = Math.sin(x * 0.21 + z * 0.17) * 0.18 + Math.sin(x * 0.35 - z * 0.12) * 0.09;
    const furrowWave = Math.sin(z * 1.28 + Math.sin(x * 0.07) * 0.8) * 0.045;
    return low + mid + detail + furrowWave;
  }

  private pseudoRandom(n: number): number {
    const x = Math.sin(n * 12.9898) * 43758.5453123;
    return x - Math.floor(x);
  }

  private hashSeed(id: number | undefined): number {
    return ((id ?? 0) * 2654435761) >>> 0;
  }

  private clamp01(value: number): number {
    return Math.max(0, Math.min(1, value));
  }

  private createFieldTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    const image = ctx.createImageData(canvas.width, canvas.height);

    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const grain =
          (this.pseudoRandom(x * 17 + y * 31) - 0.5) * 0.1 +
          Math.sin((x + Math.sin(y * 0.035) * 20) * 0.12) * 0.055 +
          Math.sin(y * 0.86) * 0.035;
        const moist = this.pseudoRandom(Math.floor(x / 11) * 91 + Math.floor(y / 13) * 37) * 0.09;
        const idx = (y * canvas.width + x) * 4;
        image.data[idx] = Math.round(this.clamp01(0.21 + grain * 0.55 + moist) * 255);
        image.data[idx + 1] = Math.round(this.clamp01(0.39 + grain * 0.8 + moist * 0.55) * 255);
        image.data[idx + 2] = Math.round(this.clamp01(0.16 + grain * 0.35) * 255);
        image.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);

    ctx.strokeStyle = 'rgba(43, 34, 18, 0.32)';
    ctx.lineWidth = 1.4;
    for (let y = 10; y < canvas.height; y += 14) {
      ctx.beginPath();
      for (let x = 0; x <= canvas.width; x += 8) {
        const yy = y + Math.sin(x * 0.04 + y * 0.11) * 2.5;
        if (x === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(8, 8);
    texture.anisotropy = this.renderer?.capabilities.getMaxAnisotropy?.() ?? 1;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  private buildFieldTerrain(side: number): THREE.Mesh {
    const seg = 160;
    const geom = new THREE.PlaneGeometry(side, side, seg, seg);
    geom.rotateX(-Math.PI / 2);
    const pos = geom.attributes['position'] as THREE.BufferAttribute;
    const colors: number[] = [];
    const v = new THREE.Vector3();
    const greenA = new THREE.Color(0x2f6b34);
    const greenB = new THREE.Color(0x5b8f43);
    const greenC = new THREE.Color(0x315529);
    const brown = new THREE.Color(0x584029);
    const dry = new THREE.Color(0x8b7746);
    const tmp = new THREE.Color();
    let yMin = Infinity;
    let yMax = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const y = this.fieldHeightAt(v.x, v.z);
      pos.setY(i, y);
      yMin = Math.min(yMin, y);
      yMax = Math.max(yMax, y);
    }
    const ySpan = Math.max(yMax - yMin, 0.08);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const yn = (v.y - yMin) / ySpan;
      const n = this.pseudoRandom(i + Math.floor(v.x * 31) + Math.floor(v.z * 17));
      const row = Math.abs(Math.sin(v.z * 1.3 + Math.sin(v.x * 0.07) * 0.8));
      tmp.copy(greenB).lerp(n > 0.52 ? greenA : greenC, 0.28 + n * 0.32);
      tmp.lerp(dry, Math.max(0, row - 0.72) * 0.34);
      tmp.lerp(brown, (1 - yn) * 0.28 + Math.max(0, 0.22 - row) * 0.38);
      colors.push(tmp.r, tmp.g, tmp.b);
    }
    pos.needsUpdate = true;
    geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geom.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      map: this.createFieldTexture(),
      vertexColors: true,
      color: 0xffffff,
      roughness: 0.97,
      metalness: 0,
      envMapIntensity: 0.28,
      flatShading: false
    });

    const mesh = new THREE.Mesh(geom, mat);
    mesh.name = 'terrainField';
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    return mesh;
  }

  private buildTerrainDetails(side: number): THREE.Group {
    const group = new THREE.Group();
    group.name = 'terrainRealismDetails';

    const furrowMat = new THREE.MeshStandardMaterial({
      color: 0x3d2a17,
      roughness: 1,
      metalness: 0,
      transparent: true,
      opacity: 0.7
    });
    const ridgeMat = new THREE.MeshStandardMaterial({
      color: 0x6a7f34,
      roughness: 0.95,
      metalness: 0,
      transparent: true,
      opacity: 0.42
    });
    const rows = Math.max(18, Math.min(46, Math.floor(side / 3.2)));
    for (let r = 0; r < rows; r++) {
      const z = ((r + 0.5) / rows - 0.5) * side * 0.94;
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 72; i++) {
        const x = (i / 72 - 0.5) * side * 0.96;
        const zz = z + Math.sin(x * 0.055 + r * 0.7) * 0.22;
        pts.push(new THREE.Vector3(x, this.fieldHeightAt(x, zz) + 0.035, zz));
      }
      const furrow = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 72, Math.max(0.035, side * 0.00055), 5, false),
        r % 3 === 0 ? ridgeMat.clone() : furrowMat.clone()
      );
      furrow.receiveShadow = true;
      group.add(furrow);
    }

    const grassCount = Math.max(900, Math.min(2600, Math.floor(side * side * 0.18)));
    const grass = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.34, 1.15),
      new THREE.MeshStandardMaterial({
        color: 0x4f8a2f,
        roughness: 1,
        metalness: 0,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.76
      }),
      grassCount
    );
    const tmpM = new THREE.Matrix4();
    const tmpQ = new THREE.Quaternion();
    const tmpS = new THREE.Vector3();
    const tmpP = new THREE.Vector3();
    for (let i = 0; i < grassCount; i++) {
      const x = (this.pseudoRandom(i * 17 + 3) - 0.5) * side * 0.96;
      const z = (this.pseudoRandom(i * 23 + 11) - 0.5) * side * 0.96;
      const blade = 0.35 + this.pseudoRandom(i * 29 + 5) * 0.95;
      tmpP.set(x, this.fieldHeightAt(x, z) + 0.2 * blade, z);
      tmpQ.setFromEuler(new THREE.Euler(
        (this.pseudoRandom(i * 31) - 0.5) * 0.42,
        this.pseudoRandom(i * 37) * Math.PI * 2,
        (this.pseudoRandom(i * 41) - 0.5) * 0.32
      ));
      tmpS.set(0.45 + this.pseudoRandom(i * 43) * 0.55, blade, 1);
      tmpM.compose(tmpP, tmpQ, tmpS);
      grass.setMatrixAt(i, tmpM);
      grass.setColorAt(i, new THREE.Color().setHSL(0.23 + this.pseudoRandom(i * 47) * 0.09, 0.48, 0.24 + this.pseudoRandom(i * 53) * 0.16));
    }
    grass.instanceMatrix.needsUpdate = true;
    grass.instanceColor!.needsUpdate = true;
    grass.castShadow = true;
    grass.receiveShadow = true;
    group.add(grass);

    const borderMat = new THREE.MeshStandardMaterial({ color: 0x5a3d22, roughness: 0.95, metalness: 0 });
    const half = side * 0.5;
    const edgePoints = [
      [new THREE.Vector3(-half, this.fieldHeightAt(-half, -half) + 0.12, -half), new THREE.Vector3(half, this.fieldHeightAt(half, -half) + 0.12, -half)],
      [new THREE.Vector3(half, this.fieldHeightAt(half, -half) + 0.12, -half), new THREE.Vector3(half, this.fieldHeightAt(half, half) + 0.12, half)],
      [new THREE.Vector3(half, this.fieldHeightAt(half, half) + 0.12, half), new THREE.Vector3(-half, this.fieldHeightAt(-half, half) + 0.12, half)],
      [new THREE.Vector3(-half, this.fieldHeightAt(-half, half) + 0.12, half), new THREE.Vector3(-half, this.fieldHeightAt(-half, -half) + 0.12, -half)]
    ];
    for (const edge of edgePoints) {
      const berm = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edge), 8, Math.max(0.28, side * 0.003), 8, false),
        borderMat.clone()
      );
      berm.castShadow = true;
      berm.receiveShadow = true;
      group.add(berm);
    }

    this.addFarmProps(group, side);

    return group;
  }

  private addFarmProps(group: THREE.Group, side: number): void {
    const half = side * 0.5;
    const place = (obj: THREE.Object3D, x: number, z: number, yaw = 0) => {
      obj.position.set(x, this.fieldHeightAt(x, z), z);
      obj.rotation.y = yaw;
      group.add(obj);
    };

    place(this.buildTractor(Math.max(1.8, side * 0.022)), -half * 0.72, -half * 0.62, -0.35);
    place(this.buildWindmill(Math.max(2.8, side * 0.034)), half * 0.74, -half * 0.72, 0.25);
    place(this.buildFarmHouse(Math.max(2.4, side * 0.028)), -half * 0.72, half * 0.62, 0.35);

    for (let i = 0; i < 6; i++) {
      const x = -half * 0.25 + i * Math.max(3.5, side * 0.052);
      const z = half * (0.55 + this.pseudoRandom(i * 91) * 0.22);
      place(this.buildHayBale(Math.max(0.9, side * 0.012)), x, z, this.pseudoRandom(i * 17) * Math.PI);
    }

    for (let i = 0; i < 5; i++) {
      const x = half * (0.16 + this.pseudoRandom(i * 29) * 0.44);
      const z = half * (0.18 + this.pseudoRandom(i * 43) * 0.42);
      place(i % 2 === 0 ? this.buildCow(Math.max(0.9, side * 0.012)) : this.buildSheep(Math.max(0.8, side * 0.011)), x, z, this.pseudoRandom(i * 71) * Math.PI * 2);
    }

    for (let i = 0; i < 7; i++) {
      const x = -half * (0.08 + this.pseudoRandom(i * 53) * 0.42);
      const z = half * (0.08 + this.pseudoRandom(i * 59) * 0.36);
      place(this.buildSheep(Math.max(0.7, side * 0.009)), x, z, this.pseudoRandom(i * 83) * Math.PI * 2);
    }

    for (let i = 0; i < 9; i++) {
      const x = -half * (0.52 + this.pseudoRandom(i * 101) * 0.32);
      const z = half * (0.38 + this.pseudoRandom(i * 107) * 0.26);
      place(this.buildChicken(Math.max(0.52, side * 0.006)), x, z, this.pseudoRandom(i * 113) * Math.PI * 2);
    }

    this.addFencePosts(group, side);
    this.addBirds(group, side);
  }

  private buildFarmHouse(scale: number): THREE.Group {
    const group = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x9a6a3a, roughness: 0.9, metalness: 0 });
    const darkWood = new THREE.MeshStandardMaterial({ color: 0x5c3a22, roughness: 0.92, metalness: 0 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x8f2f24, roughness: 0.78, metalness: 0.02 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x9ed3ff, roughness: 0.22, metalness: 0, transparent: true, opacity: 0.72 });
    const smokeMat = new THREE.MeshStandardMaterial({ color: 0xd8d7cf, roughness: 1, metalness: 0, transparent: true, opacity: 0.38, depthWrite: false });

    const base = new THREE.Mesh(new THREE.BoxGeometry(4.4, 2.45, 3.35), wood);
    base.position.y = 1.22;
    group.add(base);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.25, 1.75, 4), roofMat);
    roof.rotation.y = Math.PI * 0.25;
    roof.scale.z = 0.82;
    roof.position.y = 3.32;
    group.add(roof);

    for (let i = 0; i < 7; i++) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(0.035, 2.5, 3.42), darkWood);
      plank.position.set(-2.18 + i * 0.72, 1.25, -0.01);
      plank.rotation.y = Math.PI / 2;
      group.add(plank);
    }

    const door = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.35, 0.08), darkWood);
    door.position.set(0, 0.75, -1.72);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), roofMat);
    knob.position.set(0.22, 0.78, -1.78);
    group.add(door, knob);

    const windowGeom = new THREE.BoxGeometry(0.82, 0.62, 0.08);
    const leftWindow = new THREE.Mesh(windowGeom, glass);
    leftWindow.position.set(-1.35, 1.45, -1.72);
    const rightWindow = leftWindow.clone();
    rightWindow.position.x = 1.35;
    group.add(leftWindow, rightWindow);

    const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.58, 1.45, 0.58), darkWood);
    chimney.position.set(1.15, 4.1, 0.3);
    group.add(chimney);

    for (let i = 0; i < 5; i++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.28 + i * 0.06, 12, 8), smokeMat.clone());
      puff.position.set(1.15 + i * 0.13, 4.95 + i * 0.36, 0.3 + i * 0.08);
      puff.userData = {
        smokeBaseY: puff.position.y,
        smokeBaseX: puff.position.x,
        smokeBaseZ: puff.position.z,
        smokePhase: i * 0.7,
        smokeScale: 1 + i * 0.16
      };
      this.smokePuffs.push(puff);
      group.add(puff);
    }

    group.scale.setScalar(scale);
    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
    return group;
  }

  private buildChicken(scale: number): THREE.Group {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf4f0df, roughness: 0.82, metalness: 0 });
    const wingMat = new THREE.MeshStandardMaterial({ color: 0xc18b4a, roughness: 0.86, metalness: 0 });
    const redMat = new THREE.MeshStandardMaterial({ color: 0xd72525, roughness: 0.72, metalness: 0 });
    const beakMat = new THREE.MeshStandardMaterial({ color: 0xf0b735, roughness: 0.7, metalness: 0 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x2a221c, roughness: 0.78, metalness: 0 });

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), bodyMat);
    body.scale.set(1.1, 0.82, 0.86);
    body.position.y = 0.43;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 9), bodyMat);
    head.position.set(0.38, 0.82, 0);
    const comb = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 6), redMat);
    comb.scale.set(0.85, 1.4, 0.65);
    comb.position.set(0.38, 1.04, 0);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.18, 8), beakMat);
    beak.rotation.z = -Math.PI / 2;
    beak.position.set(0.59, 0.81, 0);
    const wing = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), wingMat);
    wing.scale.set(1, 0.5, 0.24);
    wing.position.set(0.04, 0.48, -0.34);
    const wing2 = wing.clone();
    wing2.position.z = 0.34;
    group.add(body, head, comb, beak, wing, wing2);

    for (let i = 0; i < 2; i++) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.32, 6), beakMat);
      leg.position.set(-0.12 + i * 0.22, 0.16, i === 0 ? -0.12 : 0.12);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.035, 0.06), beakMat);
      foot.position.set(leg.position.x + 0.05, 0.01, leg.position.z);
      group.add(leg, foot);
    }

    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), darkMat);
    eye.position.set(0.52, 0.88, -0.1);
    const eye2 = eye.clone();
    eye2.position.z = 0.1;
    group.add(eye, eye2);

    group.scale.setScalar(scale);
    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
    return group;
  }

  private buildTractor(scale: number): THREE.Group {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xc93f2f, roughness: 0.62, metalness: 0.12 });
    const cabinMat = new THREE.MeshStandardMaterial({ color: 0x2f8ebf, roughness: 0.35, metalness: 0.05, transparent: true, opacity: 0.78 });
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x171717, roughness: 0.88, metalness: 0.02 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xf4d35e, roughness: 0.48, metalness: 0.15 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1, 1.5), bodyMat);
    body.position.set(0, 1.0, 0);
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.72, 1.26), bodyMat);
    hood.position.set(1.8, 1.05, 0);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.12, 1.25, 1.08), cabinMat);
    cabin.position.set(-0.85, 1.7, 0);
    group.add(body, hood, cabin);

    const addWheel = (x: number, z: number, r: number) => {
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.42, 24), tireMat);
      tire.rotation.z = Math.PI / 2;
      tire.position.set(x, r, z);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.48, r * 0.48, 0.46, 18), rimMat);
      rim.rotation.z = Math.PI / 2;
      rim.position.copy(tire.position);
      group.add(tire, rim);
    };
    addWheel(-1.1, -0.9, 0.72);
    addWheel(-1.1, 0.9, 0.72);
    addWheel(1.35, -0.85, 0.48);
    addWheel(1.35, 0.85, 0.48);

    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.15, 10), tireMat);
    exhaust.position.set(2.42, 1.85, -0.42);
    group.add(exhaust);
    group.scale.setScalar(scale);
    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
    return group;
  }

  private buildWindmill(scale: number): THREE.Group {
    const group = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x7a5533, roughness: 0.88, metalness: 0 });
    const metal = new THREE.MeshStandardMaterial({ color: 0xd8e0df, roughness: 0.48, metalness: 0.18 });
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.45, 4.6, 6), wood);
    tower.position.y = 2.3;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.22, 16), metal);
    hub.rotation.x = Math.PI / 2;
    hub.position.set(0, 4.75, -0.1);
    const blades = new THREE.Group();
    blades.position.copy(hub.position);
    for (let i = 0; i < 4; i++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.55, 0.06), metal);
      blade.position.y = 0.82;
      blade.rotation.z = i * Math.PI * 0.5;
      blades.add(blade);
    }
    const tail = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.08, 0.62), metal);
    tail.position.set(0, 4.75, 0.72);
    group.add(tower, hub, blades, tail);
    group.scale.setScalar(scale);
    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
    this.animatedSceneObjects.push({ object: blades, speed: 0.035 });
    return group;
  }

  private buildHayBale(scale: number): THREE.Group {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xcaa24a, roughness: 0.96, metalness: 0 });
    const bale = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 1.2, 18), mat);
    bale.rotation.z = Math.PI / 2;
    bale.position.y = 0.65;
    group.add(bale);
    group.scale.setScalar(scale);
    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
    return group;
  }

  private buildCow(scale: number): THREE.Group {
    const group = new THREE.Group();
    const white = new THREE.MeshStandardMaterial({ color: 0xf1eee7, roughness: 0.8, metalness: 0 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x202020, roughness: 0.86, metalness: 0 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.78, 18, 12), white);
    body.scale.set(1.55, 0.82, 0.72);
    body.position.y = 0.88;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 14, 10), white);
    head.position.set(1.28, 1.08, 0);
    const patch1 = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), dark);
    patch1.scale.set(1, 0.22, 0.68);
    patch1.position.set(-0.25, 1.3, -0.42);
    const patch2 = patch1.clone();
    patch2.position.set(0.45, 1.15, 0.44);
    group.add(body, head, patch1, patch2);
    for (let i = 0; i < 4; i++) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.72, 8), dark);
      leg.position.set(i < 2 ? -0.58 : 0.58, 0.36, i % 2 ? -0.38 : 0.38);
      group.add(leg);
    }
    group.scale.setScalar(scale);
    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
    return group;
  }

  private buildSheep(scale: number): THREE.Group {
    const group = new THREE.Group();
    const wool = new THREE.MeshStandardMaterial({ color: 0xf2ead7, roughness: 0.95, metalness: 0 });
    const face = new THREE.MeshStandardMaterial({ color: 0x2f2a24, roughness: 0.88, metalness: 0 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.58, 16, 12), wool);
    body.scale.set(1.35, 0.9, 0.85);
    body.position.y = 0.68;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), face);
    head.position.set(0.85, 0.82, 0);
    group.add(body, head);
    for (let i = 0; i < 4; i++) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.055, 0.45, 7), face);
      leg.position.set(i < 2 ? -0.35 : 0.35, 0.22, i % 2 ? -0.28 : 0.28);
      group.add(leg);
    }
    group.scale.setScalar(scale);
    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
    return group;
  }

  private addFencePosts(group: THREE.Group, side: number): void {
    const mat = new THREE.MeshStandardMaterial({ color: 0x6b482b, roughness: 0.94, metalness: 0 });
    const half = side * 0.5;
    const postGeom = new THREE.CylinderGeometry(0.12, 0.16, 1.6, 7);
    const railGeom = new THREE.BoxGeometry(Math.max(2.8, side * 0.055), 0.12, 0.12);
    const makePost = (x: number, z: number) => {
      const post = new THREE.Mesh(postGeom, mat);
      post.position.set(x, this.fieldHeightAt(x, z) + 0.8, z);
      post.castShadow = post.receiveShadow = true;
      group.add(post);
    };
    const makeRail = (x: number, z: number, horizontal: boolean) => {
      const rail = new THREE.Mesh(railGeom, mat);
      rail.position.set(x, this.fieldHeightAt(x, z) + 1.08, z);
      if (!horizontal) rail.rotation.y = Math.PI / 2;
      rail.castShadow = rail.receiveShadow = true;
      group.add(rail);
    };
    const count = 12;
    for (let i = 0; i <= count; i++) {
      const t = i / count - 0.5;
      makePost(t * side, -half * 1.04);
      makePost(t * side, half * 1.04);
      if (i < count) {
        makeRail((t + 0.5 / count) * side, -half * 1.04, true);
        makeRail((t + 0.5 / count) * side, half * 1.04, true);
      }
    }
    for (let i = 0; i <= count; i++) {
      const t = i / count - 0.5;
      makePost(-half * 1.04, t * side);
      makePost(half * 1.04, t * side);
      if (i < count) {
        makeRail(-half * 1.04, (t + 0.5 / count) * side, false);
        makeRail(half * 1.04, (t + 0.5 / count) * side, false);
      }
    }
  }

  private addBirds(group: THREE.Group, side: number): void {
    const mat = new THREE.LineBasicMaterial({ color: 0x2b3b4a, transparent: true, opacity: 0.7 });
    for (let i = 0; i < 9; i++) {
      const x = (this.pseudoRandom(i * 13) - 0.5) * side * 0.8;
      const y = 18 + this.pseudoRandom(i * 19) * 10;
      const z = -side * (0.15 + this.pseudoRandom(i * 23) * 0.38);
      const w = 0.9 + this.pseudoRandom(i * 29) * 0.8;
      const points = [
        new THREE.Vector3(x - w, y, z),
        new THREE.Vector3(x, y + w * 0.38, z),
        new THREE.Vector3(x + w, y, z)
      ];
      const bird = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), mat.clone());
      group.add(bird);
    }
  }

  private refreshShadowCameraForField(sun: THREE.DirectionalLight): void {
    const half = this.fieldSideMeters * 0.65;
    sun.shadow.camera.left = -half;
    sun.shadow.camera.right = half;
    sun.shadow.camera.top = half;
    sun.shadow.camera.bottom = -half;
    sun.shadow.camera.updateProjectionMatrix();
  }

  private updateTerrainMesh(): void {
    if (!this.scene) {
      return;
    }

    if (this.terrainMesh) {
      this.scene.remove(this.terrainMesh);
      this.terrainMesh.geometry.dispose();
      this.disposeMaterial(this.terrainMesh.material);
    }
    if (this.terrainDetailGroup) {
      this.scene.remove(this.terrainDetailGroup);
      this.disposeObject3D(this.terrainDetailGroup);
      this.terrainDetailGroup = undefined;
      this.animatedSceneObjects = [];
      this.smokePuffs = [];
    }

    const superficieHa =
      this.terrain?.superficie ?? this.terrain?.superficieHa ?? 1;
    const side = 100 * Math.sqrt(Math.max(0.01, superficieHa));
    this.fieldSideMeters = side;

    this.terrainMesh = this.buildFieldTerrain(side);
    this.scene.add(this.terrainMesh);
    this.terrainDetailGroup = this.buildTerrainDetails(side);
    this.scene.add(this.terrainDetailGroup);

    const sun = this.scene.children.find(
      (c) => c instanceof THREE.DirectionalLight
    ) as THREE.DirectionalLight | undefined;
    if (sun) {
      this.refreshShadowCameraForField(sun);
    }

    if (this.controls && this.camera) {
      this.fitCameraToField(side);
    }
  }

  private fitCameraToField(side: number): void {
    const dist = side * 0.92;
    this.camera.position.set(dist * 0.58, dist * 0.48, dist * 0.62);
    this.controls.target.set(0, 0, 0);
    this.controls.minDistance = Math.max(side * 0.06, 8);
    this.controls.maxDistance = side * 3.2;
    this.controls.update();
  }

  private onWindowResize(): void {
    if (!this.canvas || !this.camera || !this.renderer) {
      return;
    }
    const w = this.canvas.nativeElement.clientWidth;
    const h = this.canvas.nativeElement.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private getRaycastDrawSurfaces(): THREE.Object3D[] {
    const list: THREE.Object3D[] = [];
    const field = this.scene.getObjectByName('terrainField');
    if (field) {
      list.push(field);
    } else if (this.terrainMesh) {
      list.push(this.terrainMesh);
    }
    return list;
  }

  private updateParcelleMeshes(): void {
    if (!this.scene) {
      return;
    }
    // Clear existing parcelle meshes
    this.parcelleMeshes.forEach(obj => this.scene.remove(obj));
    this.parcelleMeshes = [];

    this.parcelles.forEach((parcelle) => {
      // Try to render GeoJSON geometry if available
      if (parcelle.geom) {
        try {
          const geom = JSON.parse(parcelle.geom);
          if (geom.type === 'Polygon' && geom.coordinates) {
            this.renderParcellePolygon(parcelle, geom);
            return;  // Skip default visualization if GeoJSON rendered successfully
          }
        } catch (e) {
          console.warn('Failed to parse GeoJSON for parcelle:', parcelle.nom, e);
        }
      }

      // Fallback: render as simple box if no valid GeoJSON
      const surfaceValue = parcelle.surface || 0;
      const geometry = new THREE.BoxGeometry(
        Math.sqrt(surfaceValue / 10),
        0.1,
        Math.sqrt(surfaceValue / 10)
      );
      const material = new THREE.MeshStandardMaterial({
        color: 0xc19a6b,
        roughness: 0.82,
        metalness: 0.05
      });
      const mesh = new THREE.Mesh(geometry, material);
      
      // Position at center of polygon if available
      if (parcelle.geom) {
        try {
          const geom = JSON.parse(parcelle.geom);
          const coords = geom.coordinates[0];
          const centerX = coords.reduce((sum: number, c: any) => sum + c[0], 0) / coords.length;
          const centerZ = coords.reduce((sum: number, c: any) => sum + c[1], 0) / coords.length;
          mesh.position.set(
            centerX,
            this.fieldHeightAt(centerX, centerZ) + 0.08,
            centerZ
          );
        } catch {
          mesh.position.set(0, this.fieldHeightAt(0, 0) + 0.08, 0);
        }
      } else {
        mesh.position.set(0, this.fieldHeightAt(0, 0) + 0.08, 0);
      }

      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { parcelle };
      this.scene.add(mesh);
      this.parcelleMeshes.push(mesh);
    });

    this.applyParcelleHighlightMaterial();
  }

  private renderParcellePolygon(parcelle: Parcelle, geojson: any): void {
    const coordinates = geojson.coordinates[0]; // Ring of coordinates
    if (coordinates.length < 3) return;

    const lift = 0.12;
    const points = coordinates.map(
      (coord: any) =>
        new THREE.Vector3(
          coord[0],
          this.fieldHeightAt(coord[0], coord[1]) + lift,
          coord[1]
        )
    );

    // Create a polygon outline using LineGeometry
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xe3a35f, linewidth: 2 });
    const lineSegments = new THREE.LineLoop(lineGeometry, lineMaterial);
    lineSegments.userData = { parcelle };
    this.scene.add(lineSegments);
    this.parcelleMeshes.push(lineSegments);

    // Also add a semi-transparent fill using a mesh
    try {
      const shape = new THREE.Shape();
      const firstPoint = points[0];
      shape.moveTo(firstPoint.x, firstPoint.z);
      for (let i = 1; i < points.length; i++) {
        shape.lineTo(points[i].x, points[i].z);
      }
      
      const fillGeometry = new THREE.ShapeGeometry(shape);
      fillGeometry.rotateX(-Math.PI / 2);
      fillGeometry.computeVertexNormals();
      const fillMaterial = new THREE.MeshStandardMaterial({
        color: 0x7a5b35,
        transparent: true,
        opacity: 0.34,
        roughness: 0.96,
        metalness: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -0.6,
        polygonOffsetUnits: -1
      });
      const fillMesh = new THREE.Mesh(fillGeometry, fillMaterial);
      const avgH = points.reduce((s: number, p: THREE.Vector3) => s + p.y, 0) / points.length;
      fillMesh.position.y = avgH + 0.06;
      fillMesh.userData = { parcelle };
      this.scene.add(fillMesh);
      this.parcelleMeshes.push(fillMesh);

      const rowMaterial = new THREE.LineBasicMaterial({ color: 0xecd18a, transparent: true, opacity: 0.34 });
      let minX = Infinity;
      let maxX = -Infinity;
      let minZ = Infinity;
      let maxZ = -Infinity;
      for (const coord of coordinates) {
        minX = Math.min(minX, coord[0]);
        maxX = Math.max(maxX, coord[0]);
        minZ = Math.min(minZ, coord[1]);
        maxZ = Math.max(maxZ, coord[1]);
      }
      const rowCount = Math.max(3, Math.min(12, Math.floor((maxZ - minZ) / 2.8)));
      for (let row = 1; row < rowCount; row++) {
        const z = minZ + ((maxZ - minZ) * row) / rowCount;
        const pts: THREE.Vector3[] = [];
        for (let step = 0; step <= 26; step++) {
          const x = minX + ((maxX - minX) * step) / 26;
          if (this.pointInPolygon(x, z, coordinates)) {
            pts.push(new THREE.Vector3(x, this.fieldHeightAt(x, z) + 0.22, z));
          }
        }
        if (pts.length > 1) {
          const rowLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), rowMaterial.clone());
          rowLine.userData = { parcelle };
          this.scene.add(rowLine);
          this.parcelleMeshes.push(rowLine);
        }
      }
    } catch (e) {
      console.warn('Failed to create polygon fill for parcelle:', parcelle.nom);
    }
  }

  private getParcelleCentroid(parcelle: Parcelle): THREE.Vector3 | null {
    if (!parcelle.geom) {
      return null;
    }
    try {
      const geom = JSON.parse(parcelle.geom);
      if (geom.type === 'Polygon' && geom.coordinates?.[0]?.length) {
        const ring = geom.coordinates[0];
        let sx = 0;
        let sz = 0;
        const n = ring.length;
        for (const c of ring) {
          sx += c[0];
          sz += c[1];
        }
        const cx = sx / n;
        const cz = sz / n;
        return new THREE.Vector3(cx, this.fieldHeightAt(cx, cz) + 0.15, cz);
      }
    } catch {
      /* ignore */
    }
    return null;
  }

  private applyParcelleHighlightMaterial(): void {
    const hi = this.highlightedParcelleId;
    for (const obj of this.parcelleMeshes) {
      const p = obj.userData?.['parcelle'] as Parcelle | undefined;
      if (!p?.id) {
        continue;
      }
      const isHi = hi != null && p.id === hi;
      if (obj instanceof THREE.LineLoop) {
        (obj.material as THREE.LineBasicMaterial).color.setHex(isHi ? 0x9cff4f : 0xe3a35f);
      }
      if (obj instanceof THREE.Mesh && obj.userData?.['parcelle']) {
        const m = obj.material as THREE.MeshStandardMaterial | THREE.MeshLambertMaterial | THREE.MeshBasicMaterial;
        if (m instanceof THREE.MeshStandardMaterial) {
          m.emissive.setHex(isHi ? 0x3a6b3a : 0x000000);
          m.emissiveIntensity = isHi ? 0.35 : 0;
          m.opacity = isHi ? 0.58 : 0.42;
          m.color.setHex(isHi ? 0x9a6a3e : 0x5c4428);
        } else if ('emissive' in m) {
          (m as THREE.MeshLambertMaterial).emissive.setHex(isHi ? 0x555555 : 0x000000);
        }
        if (m instanceof THREE.MeshBasicMaterial) {
          m.opacity = isHi ? 0.55 : 0.3;
          m.color.setHex(isHi ? 0xffaa44 : 0x8b4513);
        }
      }
    }
  }

  private setSavedParcellesAndCulturesVisible(visible: boolean): void {
    this.parcelleMeshes.forEach((obj) => {
      obj.visible = visible;
    });
    this.cultureMeshes.forEach((m) => {
      m.visible = visible;
    });
  }

  private disposeMaterial(material: THREE.Material | THREE.Material[]): void {
    const materials = Array.isArray(material) ? material : [material];
    materials.forEach((m) => {
      const mat = m as THREE.Material & {
        map?: THREE.Texture;
        normalMap?: THREE.Texture;
        roughnessMap?: THREE.Texture;
        metalnessMap?: THREE.Texture;
        alphaMap?: THREE.Texture;
      };
      mat.map?.dispose();
      mat.normalMap?.dispose();
      mat.roughnessMap?.dispose();
      mat.metalnessMap?.dispose();
      mat.alphaMap?.dispose();
      mat.dispose();
    });
  }

  private disposeObject3D(obj: THREE.Object3D): void {
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Line || child instanceof THREE.LineLoop || child instanceof THREE.InstancedMesh) {
        child.geometry?.dispose();
        this.disposeMaterial(child.material as THREE.Material | THREE.Material[]);
      }
    });
  }

  private disposeCultureObject(obj: THREE.Object3D): void {
    obj.traverse((child) => {
      if (child instanceof THREE.InstancedMesh) {
        child.geometry.dispose();
        const mat = child.material;
        if (Array.isArray(mat)) {
          mat.forEach((m) => m.dispose());
        } else {
          mat.dispose();
        }
      } else if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
        const mat = child.material;
        if (Array.isArray(mat)) {
          mat.forEach((m) => m.dispose());
        } else if (mat) {
          mat.dispose();
        }
      }
    });
  }

  private updateCultureMeshes(): void {
    if (!this.scene) {
      return;
    }
    this.cultureMeshes.forEach((obj) => {
      this.scene.remove(obj);
      this.disposeCultureObject(obj);
    });
    this.cultureMeshes = [];

    this.cultures.forEach((culture) => {
      const parcelle = this.parcelles.find((p) => p.id === culture.parcelleId);
      if (!parcelle) {
        return;
      }
      const group = this.buildCultureScatterGroup(culture, parcelle);
      this.scene.add(group);
      this.cultureMeshes.push(group);
    });
  }

  /** Anneau GeoJSON [x,z] pour une parcelle (null si absent) */
  private getParcelleRing(parcelle: Parcelle): number[][] | null {
    if (!parcelle.geom) {
      return null;
    }
    try {
      const geom = JSON.parse(parcelle.geom);
      if (geom.type === 'Polygon' && geom.coordinates?.[0]?.length >= 3) {
        return geom.coordinates[0] as number[][];
      }
    } catch {
      /* ignore */
    }
    return null;
  }

  private polygonArea(ring: number[][]): number {
    let a = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    }
    return Math.abs(a / 2);
  }

  private pointInPolygon(x: number, z: number, ring: number[][]): boolean {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0];
      const zi = ring[i][1];
      const xj = ring[j][0];
      const zj = ring[j][1];
      const denom = zj - zi;
      const intersect =
        zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (Math.abs(denom) < 1e-9 ? 1e-9 : denom) + xi;
      if (intersect) {
        inside = !inside;
      }
    }
    return inside;
  }

  private samplePointsInPolygon(ring: number[][], count: number, seed: number): THREE.Vector3[] {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const c of ring) {
      minX = Math.min(minX, c[0]);
      maxX = Math.max(maxX, c[0]);
      minZ = Math.min(minZ, c[1]);
      maxZ = Math.max(maxZ, c[1]);
    }
    const out: THREE.Vector3[] = [];
    let tries = 0;
    const maxTries = Math.max(2000, count * 100);
    while (out.length < count && tries < maxTries) {
      tries++;
      const rx = minX + this.pseudoRandom(seed + tries * 3) * (maxX - minX);
      const rz = minZ + this.pseudoRandom(seed + tries * 3 + 1) * (maxZ - minZ);
      if (this.pointInPolygon(rx, rz, ring)) {
        out.push(new THREE.Vector3(rx, 0, rz));
      }
    }
    if (out.length < count) {
      const c = this.ringCentroid2d(ring);
      for (let k = out.length; k < count; k++) {
        const j = k * 0.37;
        const rx = c.x + Math.cos(j * 8) * j * 0.4;
        const rz = c.z + Math.sin(j * 8) * j * 0.4;
        if (this.pointInPolygon(rx, rz, ring)) {
          out.push(new THREE.Vector3(rx, 0, rz));
        } else {
          out.push(new THREE.Vector3(c.x, 0, c.z));
        }
      }
    }
    return out;
  }

  /** Grille orientée (rangées) pour céréales / cultures en ligne — plus réaliste qu’un tirage aléatoire */
  private sampleGridRowsInPolygon(ring: number[][], count: number, seed: number): THREE.Vector3[] {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const c of ring) {
      minX = Math.min(minX, c[0]);
      maxX = Math.max(maxX, c[0]);
      minZ = Math.min(minZ, c[1]);
      maxZ = Math.max(maxZ, c[1]);
    }
    const cx = (minX + maxX) * 0.5;
    const cz = (minZ + maxZ) * 0.5;
    const w = Math.max(maxX - minX, 1);
    const d = Math.max(maxZ - minZ, 1);
    const angle = this.pseudoRandom(seed) * Math.PI;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const span = Math.max(w, d, 14) * 0.72;
    const area = w * d;
    const step = Math.max(0.5, Math.min(2.05, Math.sqrt(area / Math.max(count, 8))));
    const out: THREE.Vector3[] = [];
    let t = 0;
    for (let u = -span; u <= span && out.length < count; u += step) {
      for (let v = -span; v <= span && out.length < count; v += step * 0.9) {
        t++;
        const jitter = (this.pseudoRandom(seed + t * 11) - 0.5) * step * 0.2;
        const rx = cx + u * cos - v * sin + jitter * cos;
        const rz = cz + u * sin + v * cos + jitter * sin;
        if (this.pointInPolygon(rx, rz, ring)) {
          out.push(new THREE.Vector3(rx, 0, rz));
        }
      }
    }
    if (out.length < count) {
      out.push(...this.samplePointsInPolygon(ring, count - out.length, seed + 7171));
    }
    return out.slice(0, count);
  }

  private ringCentroid2d(ring: number[][]): THREE.Vector3 {
    let sx = 0;
    let sz = 0;
    for (const c of ring) {
      sx += c[0];
      sz += c[1];
    }
    const n = ring.length;
    return new THREE.Vector3(sx / n, 0, sz / n);
  }

  private inferVisualKind(culture: Culture): 'tree' | 'bush' | 'row' {
    const obj = (culture.objectif || '').trim().toLowerCase();
    const viz = /^viz:(tree|bush|row)$/.exec(obj);
    if (viz) {
      return viz[1] as 'tree' | 'bush' | 'row';
    }
    const t = (culture.variete || culture.type || '').toLowerCase();
    const n = (culture.nom || culture.espece || '').toLowerCase();
    if (t === 'cereal' || t === 'céréale' || /blé|ble|maïs|mais|orge|avoine|riz/.test(n)) {
      return 'row';
    }
    if (
      t === 'fruit' &&
      /raisin|vigne|vignoble|frais|fraise|framboise|myrtille|melon|pastèque/.test(n)
    ) {
      return 'bush';
    }
    if (
      t === 'fruit' ||
      t === 'arboriculture' ||
      /olivier|pommier|poirier|citrus|agrum|figuier|noyer|cocotier|palm|cacaoyer/.test(n)
    ) {
      return 'tree';
    }
    return 'bush';
  }

  private instanceCountForParcel(area: number, visual: 'tree' | 'bush' | 'row'): number {
    const base = Math.sqrt(Math.max(area, 50));
    if (visual === 'tree') {
      return Math.min(48, Math.max(4, Math.floor(base * 0.35)));
    }
    if (visual === 'row') {
      return Math.min(120, Math.max(24, Math.floor(base * 1.8)));
    }
    return Math.min(90, Math.max(16, Math.floor(base * 1.1)));
  }

  private buildCultureScatterGroup(culture: Culture, parcelle: Parcelle): THREE.Object3D {
    const group = new THREE.Group();
    group.userData = { culture };
    const color = this.getCultureColorForThree(culture);
    const visual = this.inferVisualKind(culture);
    const ring = this.getParcelleRing(parcelle);
    const seed = this.hashSeed(culture.id);

    let positions: THREE.Vector3[];
    if (ring && ring.length >= 3) {
      const area = this.polygonArea(ring);
      const n = this.instanceCountForParcel(area, visual);
      positions =
        visual === 'row'
          ? this.sampleGridRowsInPolygon(ring, n, seed)
          : this.samplePointsInPolygon(ring, n, seed);
    } else {
      const c = this.getParcelleCentroid(parcelle);
      if (c) {
        positions = [new THREE.Vector3(c.x, 0, c.z)];
      } else {
        const parcelleIndex = this.parcelles.indexOf(parcelle);
        const fx = ((parcelleIndex % 5) - 2) * 15;
        const fz = Math.floor(parcelleIndex / 5) * 15;
        positions = [new THREE.Vector3(fx, 0, fz)];
      }
      const fill = Math.max(6, this.instanceCountForParcel(400, visual));
      for (let i = 1; i < fill; i++) {
        const p = positions[0].clone();
        p.x += (this.pseudoRandom(seed + i) - 0.5) * 8;
        p.z += (this.pseudoRandom(seed + i + 99) - 0.5) * 8;
        positions.push(p);
      }
    }

    const tmpM = new THREE.Matrix4();
    const tmpQ = new THREE.Quaternion();
    const tmpS = new THREE.Vector3();
    const tmpP = new THREE.Vector3();
    const yUp = new THREE.Vector3(0, 1, 0);

    if (visual === 'tree') {
      const trunkGeom = new THREE.CylinderGeometry(0.08, 0.13, 1.2, 12, 2, false);
      const crownMainGeom = new THREE.SphereGeometry(0.58, 16, 14);
      crownMainGeom.scale(1, 0.76, 1);
      const crownTopGeom = new THREE.SphereGeometry(0.34, 12, 10);
      const trunkMat = new THREE.MeshStandardMaterial({
        color: 0x3d2a1a,
        roughness: 0.94,
        metalness: 0
      });
      const crownMat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.78,
        metalness: 0.02
      });
      const crownMat2 = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.72,
        metalness: 0.02
      });
      const trunkIm = new THREE.InstancedMesh(trunkGeom, trunkMat, positions.length);
      const crownMainIm = new THREE.InstancedMesh(crownMainGeom, crownMat, positions.length);
      const crownTopIm = new THREE.InstancedMesh(crownTopGeom, crownMat2, positions.length);
      for (let i = 0; i < positions.length; i++) {
        const { x, z } = positions[i];
        const h = this.fieldHeightAt(x, z);
        const sc = 0.78 + this.pseudoRandom(seed + i * 7) * 0.42;
        const yaw = this.pseudoRandom(seed + i * 13) * Math.PI * 2;
        tmpQ.setFromAxisAngle(yUp, yaw);
        tmpS.set(sc, sc, sc);
        tmpP.set(x, h + 0.6 * sc, z);
        tmpM.compose(tmpP, tmpQ, tmpS);
        trunkIm.setMatrixAt(i, tmpM);
        tmpP.set(x, h + 1.22 * sc + 0.46 * sc, z);
        const crownScale = new THREE.Vector3(sc * 1.02, sc * 1.02, sc * 1.02);
        tmpM.compose(tmpP, tmpQ, crownScale);
        crownMainIm.setMatrixAt(i, tmpM);
        const ox = (this.pseudoRandom(seed + i * 19) - 0.5) * 0.35 * sc;
        const oz = (this.pseudoRandom(seed + i * 23) - 0.5) * 0.35 * sc;
        tmpP.set(x + ox, h + 1.95 * sc, z + oz);
        const st = sc * (0.82 + this.pseudoRandom(seed + i * 29) * 0.22);
        tmpM.compose(tmpP, tmpQ, new THREE.Vector3(st, st * 0.92, st));
        crownTopIm.setMatrixAt(i, tmpM);
      }
      trunkIm.instanceMatrix.needsUpdate = true;
      crownMainIm.instanceMatrix.needsUpdate = true;
      crownTopIm.instanceMatrix.needsUpdate = true;
      trunkIm.castShadow = true;
      crownMainIm.castShadow = true;
      crownTopIm.castShadow = true;
      trunkIm.receiveShadow = true;
      crownMainIm.receiveShadow = true;
      crownTopIm.receiveShadow = true;
      group.add(trunkIm, crownMainIm, crownTopIm);
    } else if (visual === 'row') {
      const stalkGeom = new THREE.CapsuleGeometry(0.032, 0.66, 6, 10);
      const headGeom = new THREE.SphereGeometry(0.085, 8, 6);
      const stalkMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(color).multiplyScalar(0.72),
        roughness: 0.82,
        metalness: 0.02
      });
      const headMat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.68,
        metalness: 0.03
      });
      const stalkIm = new THREE.InstancedMesh(stalkGeom, stalkMat, positions.length);
      const headIm = new THREE.InstancedMesh(headGeom, headMat, positions.length);
      const halfStem = (0.66 + 0.032 * 2) * 0.5;
      for (let i = 0; i < positions.length; i++) {
        const { x, z } = positions[i];
        const h = this.fieldHeightAt(x, z);
        const sc = 0.78 + this.pseudoRandom(seed + i * 5) * 0.48;
        const tilt = (this.pseudoRandom(seed + i) - 0.5) * 0.12;
        tmpQ.setFromEuler(
          new THREE.Euler(tilt, this.pseudoRandom(seed + i * 11) * Math.PI * 2, tilt * 0.45)
        );
        tmpS.set(sc, sc, sc);
        tmpP.set(x, h + halfStem * sc, z);
        tmpM.compose(tmpP, tmpQ, tmpS);
        stalkIm.setMatrixAt(i, tmpM);
        tmpP.set(x, h + (halfStem * 2 + 0.085) * sc, z);
        tmpM.compose(tmpP, tmpQ, new THREE.Vector3(sc * 1.05, sc * 1.1, sc * 1.05));
        headIm.setMatrixAt(i, tmpM);
      }
      stalkIm.instanceMatrix.needsUpdate = true;
      headIm.instanceMatrix.needsUpdate = true;
      stalkIm.castShadow = true;
      headIm.castShadow = true;
      stalkIm.receiveShadow = true;
      headIm.receiveShadow = true;
      group.add(stalkIm, headIm);
    } else {
      const bushGeom = new THREE.SphereGeometry(0.4, 14, 12);
      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.82,
        metalness: 0.04,
        flatShading: false
      });
      const mesh = new THREE.InstancedMesh(bushGeom, mat, positions.length);
      for (let i = 0; i < positions.length; i++) {
        const { x, z } = positions[i];
        const h = this.fieldHeightAt(x, z);
        const sc = 0.58 + this.pseudoRandom(seed + i * 3) * 0.55;
        const rx = 0.88 + this.pseudoRandom(seed + i * 31) * 0.28;
        const ry = 0.68 + this.pseudoRandom(seed + i * 37) * 0.32;
        const rz = 0.9 + this.pseudoRandom(seed + i * 41) * 0.22;
        tmpQ.setFromAxisAngle(yUp, this.pseudoRandom(seed + i * 17) * Math.PI * 2);
        tmpS.set(sc * rx, sc * ry, sc * rz);
        tmpP.set(x, h + 0.38 * sc * ry, z);
        tmpM.compose(tmpP, tmpQ, tmpS);
        mesh.setMatrixAt(i, tmpM);
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }

    return group;
  }

  private getCultureColorForThree(culture: Culture): number {
    const colors: { [key: string]: number } = {
      blé: 0xc9a227,
      ble: 0xc9a227,
      'blé dur': 0xd4af37,
      maïs: 0xf0e060,
      mais: 0xf0e060,
      tomate: 0xe63b2e,
      'pomme de terre': 0xc4a35a,
      carotte: 0xe67e22,
      salade: 0x56b85a,
      pomme: 0x7cba3d,
      olivier: 0x6a8f3a,
      raisin: 0x7b4b94,
      vigne: 0x6b3d7a,
      culture: 0x45a049
    };
    const key = (culture.nom || '').toLowerCase().trim();
    if (key && colors[key]) {
      return colors[key];
    }
    if (!culture.nom) {
      return 0x3cb371;
    }
    let h = 0;
    for (let i = 0; i < culture.nom.length; i++) {
      h = (h * 31 + culture.nom.charCodeAt(i)) >>> 0;
    }
    return (0x4a8f4a + (h % 0x303030)) & 0xffffff;
  }

  getCultureColor(culture: Culture): string {
    const n = this.getCultureColorForThree(culture);
    return '#' + n.toString(16).padStart(6, '0');
  }

  /** Clic sur une parcelle dans le panneau : affichage sur le terrain + caméra */
  onSelectParcelleInTerrain(parcelle: Parcelle): void {
    if (!parcelle.id || !this.isThreeInitialized) {
      return;
    }
    this.highlightedParcelleId = parcelle.id;
    this.applyParcelleHighlightMaterial();
    const centroid =
      this.getParcelleCentroid(parcelle) ?? this.getFallbackParcelleFocusPoint(parcelle);
    if (!centroid) {
      return;
    }
    const side = this.fieldSideMeters || 100;
    const dist = Math.max(side * 0.22, 28);
    const offset = new THREE.Vector3(dist * 0.75, dist * 0.65, dist * 0.75);
    this.camera.position.copy(centroid.clone().add(offset));
    this.controls.target.copy(centroid);
    this.controls.update();
  }

  /** Centre approximatif si GeoJSON absent (boîte / ligne déjà dans la scène) */
  private getFallbackParcelleFocusPoint(parcelle: Parcelle): THREE.Vector3 | null {
    const id = parcelle.id;
    for (const obj of this.parcelleMeshes) {
      const p = obj.userData?.['parcelle'] as Parcelle | undefined;
      if (p?.id !== id) {
        continue;
      }
      if (obj instanceof THREE.Mesh) {
        obj.updateMatrixWorld(true);
        const c = new THREE.Vector3();
        new THREE.Box3().setFromObject(obj).getCenter(c);
        c.y = this.fieldHeightAt(c.x, c.z) + 0.2;
        return c;
      }
      if (obj instanceof THREE.LineLoop) {
        const geom = obj.geometry as THREE.BufferGeometry;
        geom.computeBoundingBox();
        const box = geom.boundingBox;
        if (!box) {
          return null;
        }
        const c = new THREE.Vector3();
        box.getCenter(c);
        obj.localToWorld(c);
        c.y = this.fieldHeightAt(c.x, c.z) + 0.25;
        return c;
      }
    }
    return null;
  }

  private animate(): void {
    requestAnimationFrame(() => this.animate());
    this.controls.update();
    this.animatedSceneObjects.forEach((item) => {
      item.object.rotation.z += item.speed;
    });
    const t = performance.now() * 0.001;
    this.smokePuffs.forEach((puff, i) => {
      const phase = puff.userData['smokePhase'] ?? i;
      const drift = Math.sin(t * 0.9 + phase);
      puff.position.x = (puff.userData['smokeBaseX'] ?? puff.position.x) + drift * 0.18;
      puff.position.y = (puff.userData['smokeBaseY'] ?? puff.position.y) + ((t * 0.28 + phase) % 1.4);
      puff.position.z = (puff.userData['smokeBaseZ'] ?? puff.position.z) + Math.cos(t * 0.7 + phase) * 0.12;
      const pulse = (puff.userData['smokeScale'] ?? 1) + Math.sin(t * 1.3 + phase) * 0.08;
      puff.scale.setScalar(pulse);
      const mat = puff.material as THREE.MeshStandardMaterial;
      mat.opacity = 0.34 * (1 - (((t * 0.28 + phase) % 1.4) / 1.7));
    });
    this.renderer.render(this.scene, this.camera);
  }

  private cleanupThreeJS(): void {
    window.removeEventListener('resize', this.onWindowResizeHandler);
    if (this.renderer) {
      const el = this.renderer.domElement;
      el.removeEventListener('pointerdown', this.onCanvasPointerDownHandler);
      el.removeEventListener('dragover', this.onCanvasDragOverHandler);
      el.removeEventListener('drop', this.onCanvasDropHandler);
      el.removeEventListener('dragleave', this.onCanvasDragLeaveHandler);
      this.renderer.dispose();
    }
    if (this.scene) {
      this.disposeParcelleDrawingOverlays();
      if (this.terrainDetailGroup) {
        this.scene.remove(this.terrainDetailGroup);
        this.disposeObject3D(this.terrainDetailGroup);
        this.terrainDetailGroup = undefined;
        this.animatedSceneObjects = [];
        this.smokePuffs = [];
      }
      if (this.terrainMesh) {
        this.scene.remove(this.terrainMesh);
        this.terrainMesh.geometry.dispose();
        this.disposeMaterial(this.terrainMesh.material);
      }
      this.cultureMeshes.forEach((obj) => this.disposeCultureObject(obj));
      this.cultureMeshes = [];
    }
    if (this.controls) {
      this.controls.dispose();
    }
  }

  private defaultSemisDateString(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private defaultRecolteDateMonthsLater(months: number): string {
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    return d.toISOString().slice(0, 10);
  }

  private raycastTerrainFromClient(clientX: number, clientY: number): THREE.Vector3 | null {
    if (!this.renderer || !this.camera) {
      return null;
    }
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hits = this.raycaster.intersectObjects(this.getRaycastDrawSurfaces(), false);
    return hits.length ? hits[0].point : null;
  }

  private findParcelleAtXZ(x: number, z: number): Parcelle | null {
    const scored = this.parcelles.map((p) => {
      const ring = this.getParcelleRing(p);
      const area = ring ? this.polygonArea(ring) : p.surface || 1e6;
      return { p, area };
    });
    scored.sort((a, b) => a.area - b.area);
    for (const { p } of scored) {
      const ring = this.getParcelleRing(p);
      if (ring && ring.length >= 3 && this.pointInPolygon(x, z, ring)) {
        return p;
      }
    }
    for (const { p } of scored) {
      if (this.getParcelleRing(p)) {
        continue;
      }
      const c =
        this.getParcelleCentroid(p) ??
        this.getFallbackParcelleFocusPoint(p);
      if (!c) {
        continue;
      }
      const r = Math.max(4, Math.sqrt((p.surface || 200) / Math.PI) * 0.09);
      if (Math.hypot(x - c.x, z - c.z) <= r) {
        return p;
      }
    }
    return null;
  }

  onPaletteDragStart(event: DragEvent, item: PlantPaletteItem): void {
    event.dataTransfer?.setData('application/json', JSON.stringify(item));
    event.dataTransfer!.effectAllowed = 'copy';
  }

  onCanvasDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
    if (!this.canvasDropHighlight) {
      this.canvasDropHighlight = true;
      this.cdr.markForCheck();
    }
  }

  onCanvasDragLeave(): void {
    this.canvasDropHighlight = false;
    this.cdr.markForCheck();
  }

  onCanvasDrop(event: DragEvent): void {
    event.preventDefault();
    this.canvasDropHighlight = false;
    this.cdr.markForCheck();
    const raw = event.dataTransfer?.getData('application/json');
    if (!raw || !this.isThreeInitialized) {
      return;
    }
    let item: PlantPaletteItem;
    try {
      item = JSON.parse(raw) as PlantPaletteItem;
    } catch {
      return;
    }
    const hit = this.raycastTerrainFromClient(event.clientX, event.clientY);
    if (!hit) {
      this.error = 'Déposez sur le terrain visible.';
      return;
    }
    const parcelle = this.findParcelleAtXZ(hit.x, hit.z);
    if (!parcelle?.id) {
      this.error = 'Aucune parcelle à cet endroit. Dessinez d’abord une parcelle sur le terrain.';
      return;
    }
    const monthsHarvest = item.visual === 'tree' ? 18 : item.visual === 'row' ? 5 : 3;
    const payload = {
      espece: item.defaultName,
      variete: item.cultureType,
      dateSemis: this.defaultSemisDateString(),
      dateRecoltePrevue: this.defaultRecolteDateMonthsLater(monthsHarvest),
      stade: StadeCulture.SEMIS,
      objectif: `viz:${item.visual}`
    };
    this.cultureService.createCulture(parcelle.id, payload).subscribe({
      next: () => {
        this.error = null;
        this.loadCulturesForTerrainParcelles();
        this.onSelectParcelleInTerrain(parcelle);
      },
      error: (err) => {
        console.error('Error planting from palette:', err);
        this.error = 'Impossible d’enregistrer la culture. Vérifiez les dates ou le serveur.';
      }
    });
  }

  resetCameraView(): void {
    if (!this.camera || !this.controls) {
      return;
    }
    this.fitCameraToField(this.fieldSideMeters || 100);
  }

  setTopView(): void {
    if (!this.camera || !this.controls) {
      return;
    }
    const side = this.fieldSideMeters || 100;
    const h = side * 1.05;
    this.camera.position.set(0, h, 0.001);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  toggleViewportFullscreen(): void {
    const host = this.canvas?.nativeElement?.parentElement;
    if (!host) {
      return;
    }
    if (!document.fullscreenElement) {
      void host.requestFullscreen?.();
    } else {
      void document.exitFullscreen?.();
    }
  }

  // UI Methods
  onAddParcelle(): void {
    this.showParcelleForm = true;
    this.selectedParcelle = null;
    this.parcelleForm.reset({
      nom: '',
      surface: 0,
      geom: ''
    });
    this.clearDrawing();
    this.isDrawingParcelle = false;
    if (this.controls) {
      this.controls.enabled = true;
    }
    this.setSavedParcellesAndCulturesVisible(true);
  }

  closeParcelleForm(): void {
    this.showParcelleForm = false;
    this.isDrawingParcelle = false;
    if (this.controls) {
      this.controls.enabled = true;
    }
    this.setSavedParcellesAndCulturesVisible(true);
    this.clearDrawing();
  }

  onEditParcelle(parcelle: Parcelle): void {
    this.showParcelleForm = true;
    this.selectedParcelle = parcelle;
    this.parcelleForm.patchValue({
      nom: parcelle.nom,
      surface: parcelle.surface,
      geom: parcelle.geom
    });
  }

  onDeleteParcelle(parcelle: Parcelle): void {
    if (confirm(`Êtes-vous sûr de vouloir supprimer la parcelle "${parcelle.nom}" ?`)) {
      this.parcelleService.deleteParcelle(parcelle.id!).subscribe({
        next: () => {
          this.loadParcelles();
        },
        error: (error) => {
          console.error('Error deleting parcelle:', error);
          this.error = 'Erreur lors de la suppression de la parcelle';
        }
      });
    }
  }

  onSubmitParcelle(): void {
    if (this.parcelleForm.valid) {
      const formValue = this.parcelleForm.value;
      const parcelleData = {
        nom: formValue.nom,
        // Convert m² to hectares for backend model
        superficieHa: Number(formValue.surface) / 10000,
        geom: formValue.geom
      } as Parcelle;

      const operation = this.selectedParcelle
        ? this.parcelleService.updateParcelle(this.selectedParcelle.id!, parcelleData)
        : this.parcelleService.createParcelle(this.terrainId, parcelleData);

      operation.subscribe({
        next: () => {
          this.closeParcelleForm();
          this.loadParcelles();
        },
        error: (error) => {
          console.error('Error saving parcelle:', error);
          this.error = 'Erreur lors de la sauvegarde de la parcelle';
        }
      });
    }
  }

  onAddCulture(): void {
    this.showCultureForm = true;
    this.cultureForm.reset({
      nom: '',
      type: '',
      dateSemis: '',
      dateRecolte: '',
      stade: StadeCulture.SEMIS,
      parcelleId: null
    });
  }

  onSubmitCulture(): void {
    if (!this.cultureForm.valid) {
      return;
    }
    const formValue = this.cultureForm.value;
    const parcelleId = formValue.parcelleId as number;
    const payload = {
      espece: formValue.nom,
      variete: formValue.type || '',
      dateSemis: formValue.dateSemis as string,
      dateRecoltePrevue: formValue.dateRecolte as string,
      stade: formValue.stade as StadeCulture
    };

    this.cultureService.createCulture(parcelleId, payload).subscribe({
      next: () => {
        this.showCultureForm = false;
        this.loadCulturesForTerrainParcelles();
      },
      error: (error) => {
        console.error('Error saving culture:', error);
        this.error = 'Erreur lors de la sauvegarde de la culture';
      }
    });
  }

  onBackToList(): void {
    this.router.navigate(['/farm/list']);
  }

  onCanvasPointerDown(event: PointerEvent): void {
    if (!this.isDrawingParcelle || !this.isThreeInitialized || !this.scene) {
      return;
    }
    if (event.button !== 0) {
      return;
    }

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const surfaces = this.getRaycastDrawSurfaces();
    if (surfaces.length === 0) {
      return;
    }

    const intersects = this.raycaster.intersectObjects(surfaces, false);
    if (intersects.length === 0) {
      return;
    }

    const hit = intersects[0];
    const point = hit.point.clone();
    point.y = this.fieldHeightAt(point.x, point.z) + 0.14;
    this.parcellePoints.push(point);
    this.undoStack.push(point.clone());
    this.redoStack = [];

    // Build geometry and show graphical line
    this.updateDrawingLine();
    this.updateParcelleGeom();
  }

  toggleDrawingMode(): void {
    const willDraw = !this.isDrawingParcelle;
    this.isDrawingParcelle = willDraw;
    this.controls.enabled = !willDraw;

    if (willDraw) {
      this.setSavedParcellesAndCulturesVisible(false);
    } else {
      this.setSavedParcellesAndCulturesVisible(true);
      this.clearDrawing();
    }
  }

  finishDrawing(): void {
    if (this.parcellePoints.length < 3) {
      this.error = 'Dessinez au moins 3 points pour créer une parcelle.';
      return;
    }
    this.isDrawingParcelle = false;
    this.controls.enabled = true;
    this.setSavedParcellesAndCulturesVisible(true);
    this.showParcelleForm = true;
  }

  clearDrawing(): void {
    this.parcellePoints = [];
    this.undoStack = [];
    this.redoStack = [];
    this.disposeParcelleDrawingOverlays();
    this.parcelleForm.patchValue({ geom: '' });
  }

  private disposeParcelleDrawingOverlays(): void {
    if (!this.scene) {
      return;
    }
    if (this.parcelleDrawTube) {
      this.scene.remove(this.parcelleDrawTube);
      this.parcelleDrawTube.geometry.dispose();
      const tm = this.parcelleDrawTube.material;
      if (Array.isArray(tm)) {
        tm.forEach((m) => m.dispose());
      } else {
        tm.dispose();
      }
      this.parcelleDrawTube = undefined;
    }
    if (this.parcelleDrawPreviewFill) {
      this.scene.remove(this.parcelleDrawPreviewFill);
      this.parcelleDrawPreviewFill.geometry.dispose();
      (this.parcelleDrawPreviewFill.material as THREE.Material).dispose();
      this.parcelleDrawPreviewFill = undefined;
    }
  }

  undoPoint(): void {
    if (this.parcellePoints.length === 0) {
      return;
    }
    const lastPoint = this.parcellePoints.pop();
    if (lastPoint) {
      this.redoStack.push(lastPoint);
      this.updateDrawingLine();
      this.updateParcelleGeom();
    }
  }

  redoPoint(): void {
    if (this.redoStack.length === 0) {
      return;
    }
    const point = this.redoStack.pop();
    if (point) {
      this.parcellePoints.push(point);
      this.updateDrawingLine();
      this.updateParcelleGeom();
    }
  }

  private updateDrawingLine(): void {
    this.disposeParcelleDrawingOverlays();

    if (this.parcellePoints.length < 2 || !this.scene) {
      return;
    }

    const lifted = this.parcellePoints.map((p) => {
      const q = p.clone();
      q.y = this.fieldHeightAt(q.x, q.z) + 0.22;
      return q;
    });
    const closed = this.parcellePoints.length > 2;
    const curve = new THREE.CatmullRomCurve3(lifted, closed);
    const rad = Math.max(0.32, Math.min(1.85, (this.fieldSideMeters || 100) * 0.0068));
    const tubular = Math.max(36, lifted.length * 18);
    const tubeGeom = new THREE.TubeGeometry(curve, tubular, rad, 14, closed);
    const tubeMat = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      emissive: 0x3d0a14,
      emissiveIntensity: 0.38,
      roughness: 0.48,
      metalness: 0.12
    });
    this.parcelleDrawTube = new THREE.Mesh(tubeGeom, tubeMat);
    this.parcelleDrawTube.renderOrder = 14;
    this.parcelleDrawTube.castShadow = true;
    this.scene.add(this.parcelleDrawTube);

    if (this.parcellePoints.length >= 3) {
      try {
        const shape = new THREE.Shape();
        shape.moveTo(lifted[0].x, lifted[0].z);
        for (let i = 1; i < lifted.length; i++) {
          shape.lineTo(lifted[i].x, lifted[i].z);
        }
        const fillGeom = new THREE.ShapeGeometry(shape);
        fillGeom.rotateX(-Math.PI / 2);
        const avgH = lifted.reduce((s, p) => s + p.y, 0) / lifted.length + 0.05;
        const fillMat = new THREE.MeshStandardMaterial({
          color: 0x1f7a45,
          transparent: true,
          opacity: 0.36,
          roughness: 0.9,
          metalness: 0,
          depthWrite: false,
          side: THREE.DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1
        });
        this.parcelleDrawPreviewFill = new THREE.Mesh(fillGeom, fillMat);
        this.parcelleDrawPreviewFill.position.y = avgH;
        this.parcelleDrawPreviewFill.renderOrder = 13;
        this.scene.add(this.parcelleDrawPreviewFill);
      } catch {
        /* ignore invalid shapes */
      }
    }
  }

  private updateParcelleGeom(): void {
    if (this.parcellePoints.length < 3) {
      this.parcelleForm.patchValue({ geom: '' });
      return;
    }

    const coords = this.parcellePoints.map(p => [p.x, p.z]);
    const polygon = {
      type: 'Polygon',
      coordinates: [coords.concat([coords[0]])]
    };
    this.parcelleForm.patchValue({ geom: JSON.stringify(polygon) });
  }

  // Getters for template
  get parcelleFormControls() {
    return this.parcelleForm.controls;
  }

  get cultureFormControls() {
    return this.cultureForm.controls;
  }

  get StadeCulture() {
    return StadeCulture;
  }

  getCultureCountForParcelle(parcelleId: number): number {
    return this.cultures.filter(c => c.parcelleId === parcelleId).length;
  }
}
