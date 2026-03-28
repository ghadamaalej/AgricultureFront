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
  private parcelleLine?: THREE.Line;

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

  /** Hauteur du relief à (x,z) — identique aux sommets du champ */
  private fieldHeightAt(x: number, z: number): number {
    return (
      Math.sin(x * 0.08) * Math.cos(z * 0.07) * 0.42 +
      Math.sin(x * 0.19 + z * 0.14) * 0.14 +
      Math.cos(x * 0.05 - z * 0.06) * 0.08
    );
  }

  private pseudoRandom(n: number): number {
    const x = Math.sin(n * 12.9898) * 43758.5453123;
    return x - Math.floor(x);
  }

  private hashSeed(id: number | undefined): number {
    return ((id ?? 0) * 2654435761) >>> 0;
  }

  private buildFieldTerrain(side: number): THREE.Mesh {
    const seg = 64;
    const geom = new THREE.PlaneGeometry(side, side, seg, seg);
    geom.rotateX(-Math.PI / 2);
    const pos = geom.attributes['position'] as THREE.BufferAttribute;
    const colors: number[] = [];
    const v = new THREE.Vector3();
    const c1 = new THREE.Color(0x3d6b3e);
    const c2 = new THREE.Color(0x5a8f52);
    const c3 = new THREE.Color(0x4a7a48);
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const y = this.fieldHeightAt(v.x, v.z);
      pos.setY(i, y);
      const n = this.pseudoRandom(i + Math.floor(v.x * 31) + Math.floor(v.z * 17));
      tmp.copy(c2).lerp(n > 0.55 ? c1 : c3, 0.35 + n * 0.25);
      colors.push(tmp.r, tmp.g, tmp.b);
    }
    pos.needsUpdate = true;
    geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geom.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      color: 0xffffff,
      roughness: 0.91,
      metalness: 0.02,
      envMapIntensity: 0.25,
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
        color: 0x5c4428,
        transparent: true,
        opacity: 0.48,
        roughness: 0.88,
        metalness: 0.02,
        depthWrite: false,
        side: THREE.DoubleSide
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
      positions = this.samplePointsInPolygon(ring, n, seed);
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
      const trunkGeom = new THREE.CylinderGeometry(0.11, 0.16, 1.05, 7);
      const crownGeom = new THREE.ConeGeometry(0.82, 2.05, 8);
      const trunkMat = new THREE.MeshStandardMaterial({
        color: 0x4a3526,
        roughness: 0.92,
        metalness: 0
      });
      const crownMat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.82,
        metalness: 0.02
      });
      const trunkIm = new THREE.InstancedMesh(trunkGeom, trunkMat, positions.length);
      const crownIm = new THREE.InstancedMesh(crownGeom, crownMat, positions.length);
      for (let i = 0; i < positions.length; i++) {
        const { x, z } = positions[i];
        const h = this.fieldHeightAt(x, z);
        const sc = 0.72 + this.pseudoRandom(seed + i * 7) * 0.38;
        tmpQ.setFromAxisAngle(yUp, this.pseudoRandom(seed + i * 13) * Math.PI * 2);
        tmpS.set(sc, sc, sc);
        tmpP.set(x, h + 0.52 * sc, z);
        tmpM.compose(tmpP, tmpQ, tmpS);
        trunkIm.setMatrixAt(i, tmpM);
        tmpP.set(x, h + 1.35 * sc + 1.05 * sc, z);
        tmpM.compose(tmpP, tmpQ, new THREE.Vector3(sc * 1.05, sc, sc * 1.05));
        crownIm.setMatrixAt(i, tmpM);
      }
      trunkIm.instanceMatrix.needsUpdate = true;
      crownIm.instanceMatrix.needsUpdate = true;
      trunkIm.castShadow = true;
      crownIm.castShadow = true;
      trunkIm.receiveShadow = true;
      crownIm.receiveShadow = true;
      group.add(trunkIm, crownIm);
    } else if (visual === 'row') {
      const stalkGeom = new THREE.BoxGeometry(0.1, 0.72, 0.1);
      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.78,
        metalness: 0.02
      });
      const mesh = new THREE.InstancedMesh(stalkGeom, mat, positions.length);
      for (let i = 0; i < positions.length; i++) {
        const { x, z } = positions[i];
        const h = this.fieldHeightAt(x, z);
        const sc = 0.75 + this.pseudoRandom(seed + i * 5) * 0.45;
        const tilt = (this.pseudoRandom(seed + i) - 0.5) * 0.14;
        tmpQ.setFromEuler(new THREE.Euler(tilt, this.pseudoRandom(seed + i * 11) * Math.PI * 2, tilt * 0.5));
        tmpS.set(sc, sc * 1.15, sc);
        tmpP.set(x, h + 0.36 * sc, z);
        tmpM.compose(tmpP, tmpQ, tmpS);
        mesh.setMatrixAt(i, tmpM);
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    } else {
      const bushGeom = new THREE.IcosahedronGeometry(0.42, 0);
      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.8,
        metalness: 0.03,
        flatShading: true
      });
      const mesh = new THREE.InstancedMesh(bushGeom, mat, positions.length);
      for (let i = 0; i < positions.length; i++) {
        const { x, z } = positions[i];
        const h = this.fieldHeightAt(x, z);
        const sc = 0.55 + this.pseudoRandom(seed + i * 3) * 0.65;
        tmpQ.setFromAxisAngle(yUp, this.pseudoRandom(seed + i * 17) * Math.PI * 2);
        tmpS.set(sc, sc * 0.88, sc);
        tmpP.set(x, h + 0.32 * sc, z);
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
    if (this.parcelleLine && this.scene) {
      this.scene.remove(this.parcelleLine);
      this.parcelleLine = undefined;
    }
    this.parcelleForm.patchValue({ geom: '' });
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
    if (this.parcelleLine) {
      this.scene.remove(this.parcelleLine);
      this.parcelleLine = undefined;
    }

    if (this.parcellePoints.length < 2) return;

    const lifted = this.parcellePoints.map((p) => {
      const q = p.clone();
      q.y = this.fieldHeightAt(q.x, q.z) + 0.16;
      return q;
    });
    const points = [...lifted];
    if (this.parcellePoints.length > 2) {
      points.push(lifted[0]);
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0xff2222, depthTest: true });
    material.linewidth = 2;
    this.parcelleLine = new THREE.Line(geometry, material);
    this.parcelleLine.renderOrder = 10;
    this.scene.add(this.parcelleLine);
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