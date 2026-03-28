import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
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
  private cultureMeshes: THREE.Mesh[] = [];

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
    private cultureService: CultureService
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

    // Scene — ciel + brume lointaine
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xcfe8ff);
    this.scene.fog = new THREE.FogExp2(0xb8d4e8, 0.0018);

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

    this.renderer.domElement.addEventListener('pointerdown', this.onCanvasPointerDownHandler);
    window.addEventListener('resize', this.onWindowResizeHandler);

    this.animate();
  }

  private setupLighting(): void {
    const hemi = new THREE.HemisphereLight(0xd6ecff, 0x4a3c2a, 0.55);
    hemi.position.set(0, 120, 0);
    this.scene.add(hemi);

    const ambient = new THREE.AmbientLight(0xffffff, 0.22);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xfff5e6, 1.35);
    sun.position.set(180, 220, 140);
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

  private buildFieldTerrain(side: number): THREE.Mesh {
    const seg = 56;
    const geom = new THREE.PlaneGeometry(side, side, seg, seg);
    geom.rotateX(-Math.PI / 2);
    const pos = geom.attributes['position'] as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      pos.setY(i, this.fieldHeightAt(v.x, v.z));
    }
    pos.needsUpdate = true;
    geom.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      color: 0x4d7c4a,
      roughness: 0.88,
      metalness: 0.04,
      envMapIntensity: 0.35,
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
        color: 0x6b4423,
        transparent: true,
        opacity: 0.42,
        roughness: 0.75,
        metalness: 0.05,
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
          m.color.setHex(isHi ? 0x8f5c32 : 0x6b4423);
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

  private updateCultureMeshes(): void {
    if (!this.scene) {
      return;
    }
    // Clear existing culture meshes
    this.cultureMeshes.forEach(mesh => this.scene.remove(mesh));
    this.cultureMeshes = [];

    this.cultures.forEach(culture => {
      const parcelle = this.parcelles.find(p => p.id === culture.parcelleId);
      if (!parcelle) return;

      const geometry = new THREE.CylinderGeometry(0.5, 0.5, 2);
      const material = new THREE.MeshLambertMaterial({ color: this.getCultureColorForThree(culture) });
      const mesh = new THREE.Mesh(geometry, material);
      const center = this.getParcelleCentroid(parcelle);
      if (center) {
        const y = this.fieldHeightAt(center.x, center.z) + 1.1;
        mesh.position.set(center.x, y, center.z);
      } else {
        const parcelleIndex = this.parcelles.indexOf(parcelle);
        const fx = (parcelleIndex % 5 - 2) * 15;
        const fz = Math.floor(parcelleIndex / 5) * 15;
        mesh.position.set(fx, this.fieldHeightAt(fx, fz) + 1.1, fz);
      }
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { culture };
      this.scene.add(mesh);
      this.cultureMeshes.push(mesh);
    });
  }

  private getCultureColorForThree(culture: Culture): number {
    const colors: { [key: string]: number } = {
      'blé': 0xFFD700,
      'maïs': 0xFFFF00,
      'tomate': 0xFF6347,
      'pomme de terre': 0xDAA520,
      'carotte': 0xFF8C00
    };
    if (!culture.nom) return 0x32CD32;
    return colors[culture.nom.toLowerCase()] || 0x32CD32;
  }

  getCultureColor(culture: Culture): string {
    const colorMap: { [key: string]: string } = {
      'blé': '#FFD700',
      'maïs': '#FFFF00',
      'tomate': '#FF6347',
      'pomme de terre': '#DAA520',
      'carotte': '#FF8C00'
    };
    if (!culture.nom) {
      return '#32CD32';
    }
    return colorMap[culture.nom.toLowerCase()] || '#32CD32';
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
      this.renderer.domElement.removeEventListener('pointerdown', this.onCanvasPointerDownHandler);
      this.renderer.dispose();
    }
    if (this.controls) {
      this.controls.dispose();
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