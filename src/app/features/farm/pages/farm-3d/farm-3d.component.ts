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
    this.scene.background = new THREE.Color(0xb8daf5);
    this.scene.fog = new THREE.FogExp2(0xa8cce8, 0.0014);

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
    const hemi = new THREE.HemisphereLight(0xe8f4ff, 0x6b5344, 0.62);
    hemi.position.set(0, 120, 0);
    this.scene.add(hemi);

    const ambient = new THREE.AmbientLight(0xffffff, 0.28);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xfff8ee, 1.42);
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
      Math.sin(x * 0.044) * Math.cos(z * 0.041) * 0.52 +
      Math.cos(x * 0.031 - z * 0.028) * 0.22;
    const mid = Math.sin(x * 0.11 + z * 0.088) * 0.16 + Math.cos(x * 0.078 + z * 0.062) * 0.1;
    const detail = Math.sin(x * 0.21 + z * 0.17) * 0.055 + Math.sin(x * 0.35 - z * 0.12) * 0.028;
    return low + mid + detail;
  }

  private pseudoRandom(n: number): number {
    const x = Math.sin(n * 12.9898) * 43758.5453123;
    return x - Math.floor(x);
  }

  private hashSeed(id: number | undefined): number {
    return ((id ?? 0) * 2654435761) >>> 0;
  }

  private buildFieldTerrain(side: number): THREE.Mesh {
    const seg = 96;
    const geom = new THREE.PlaneGeometry(side, side, seg, seg);
    geom.rotateX(-Math.PI / 2);
    const pos = geom.attributes['position'] as THREE.BufferAttribute;
    const colors: number[] = [];
    const v = new THREE.Vector3();
    const greenA = new THREE.Color(0x356b38);
    const greenB = new THREE.Color(0x4f8f4a);
    const greenC = new THREE.Color(0x3d6840);
    const brown = new THREE.Color(0x4a3d2a);
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
      tmp.copy(greenB).lerp(n > 0.52 ? greenA : greenC, 0.28 + n * 0.32);
      tmp.lerp(brown, (1 - yn) * 0.22);
      colors.push(tmp.r, tmp.g, tmp.b);
    }
    pos.needsUpdate = true;
    geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geom.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      color: 0xffffff,
      roughness: 0.86,
      metalness: 0.04,
      envMapIntensity: 0.28,
      flatShading: false
    });

    const mesh = new THREE.Mesh(geom, mat);
    mesh.name = 'terrainField';
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    return mesh;
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
      (this.terrainMesh.material as THREE.Material).dispose();
    }

    const superficieHa =
      this.terrain?.superficie ?? this.terrain?.superficieHa ?? 1;
    const side = 100 * Math.sqrt(Math.max(0.01, superficieHa));
    this.fieldSideMeters = side;

    this.terrainMesh = this.buildFieldTerrain(side);
    this.scene.add(this.terrainMesh);

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
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xFF6347, linewidth: 2 }); // Tomato red
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
        color: 0x4d6b3a,
        transparent: true,
        opacity: 0.45,
        roughness: 0.88,
        metalness: 0.02,
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
        (obj.material as THREE.LineBasicMaterial).color.setHex(isHi ? 0x00ffaa : 0xff6347);
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