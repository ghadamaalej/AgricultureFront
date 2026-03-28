import { Component, ElementRef, ViewChild, Input, OnInit, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
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
  @ViewChild('canvas', { static: true }) canvas!: ElementRef<HTMLCanvasElement>;
  @Input() selectedTerrain: Terrain | null = null;

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private terrainMesh: THREE.Mesh | null = null;
  private controls: any; // OrbitControls
  private animationId: number | null = null;

  ngOnInit() {
    this.initThreeJS();
    this.setupScene();
    this.animate();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['selectedTerrain']) {
      this.updateTerrainVisualization();
    }
  }

  ngOnDestroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
    if (this.controls) {
      this.controls.dispose();
    }
  }

  private initThreeJS() {
    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf0f8f0); // Light green background

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      this.canvas.nativeElement.clientWidth / this.canvas.nativeElement.clientHeight,
      0.1,
      1000
    );
    this.camera.position.set(5, 5, 5);
    this.camera.lookAt(0, 0, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas.nativeElement,
      antialias: true
    });
    this.renderer.setSize(
      this.canvas.nativeElement.clientWidth,
      this.canvas.nativeElement.clientHeight
    );
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Orbit Controls (if available)
    try {
      this.controls = new OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.enableZoom = true;
      this.controls.enablePan = true;
    } catch (error) {
      console.warn('OrbitControls not available, using basic camera controls');
    }
  }

  private setupScene() {
    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    this.scene.add(directionalLight);

    // Ground plane
    const groundGeometry = new THREE.PlaneGeometry(20, 20);
    const groundMaterial = new THREE.MeshLambertMaterial({
      color: 0x8fbc8f,
      transparent: true,
      opacity: 0.3
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Grid helper
    const gridHelper = new THREE.GridHelper(20, 20, 0x4caf50, 0x4caf50);
    gridHelper.position.y = 0.01;
    this.scene.add(gridHelper);
  }

  private updateTerrainVisualization() {
    // Remove existing terrain
    if (this.terrainMesh) {
      this.scene.remove(this.terrainMesh);
      this.terrainMesh.geometry.dispose();
      (this.terrainMesh.material as THREE.Material).dispose();
      this.terrainMesh = null;
    }

    if (this.selectedTerrain) {
      this.createTerrainMesh();
    }
  }

  private createTerrainMesh() {
    if (!this.selectedTerrain) return;

    // Calculate dimensions based on area (simple square root approximation)
    const area = this.selectedTerrain.superficieHa;
    const sideLength = Math.sqrt(area) * 2; // Scale factor for visibility

    // Create terrain geometry (box for now, could be extruded plane later)
    const geometry = new THREE.BoxGeometry(sideLength, 0.2, sideLength);

    // Material based on soil type
    const material = new THREE.MeshLambertMaterial({
      color: this.getSoilColor(this.selectedTerrain.typeSol)
    });

    // Create mesh
    this.terrainMesh = new THREE.Mesh(geometry, material);
    this.terrainMesh.position.y = 0.1;
    this.terrainMesh.castShadow = true;
    this.terrainMesh.receiveShadow = true;

    this.scene.add(this.terrainMesh);

    // Adjust camera to focus on terrain
    this.camera.position.set(sideLength * 1.5, sideLength * 1.2, sideLength * 1.5);
    this.camera.lookAt(this.terrainMesh.position);
  }

  private getSoilColor(typeSol: string): number {
    const colorMap: { [key: string]: number } = {
      'Argileux': 0x8B4513,    // Brown
      'Sableux': 0xF4A460,     // Sandy brown
      'Limoneux': 0xDEB887,    // Burlywood
      'Calcaire': 0xF5F5DC,    // Beige
      'Humifère': 0x228B22     // Forest green
    };
    return colorMap[typeSol] || 0x228B22;
  }

  private animate = () => {
    this.animationId = requestAnimationFrame(this.animate);

    if (this.controls) {
      this.controls.update();
    }

    this.renderer.render(this.scene, this.camera);
  };

  onCanvasResize() {
    if (this.canvas && this.renderer && this.camera) {
      const width = this.canvas.nativeElement.clientWidth;
      const height = this.canvas.nativeElement.clientHeight;

      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();

      this.renderer.setSize(width, height);
    }
  }
}