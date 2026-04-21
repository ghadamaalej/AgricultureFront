import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TerrainFormComponent } from '../../components/terrain-form/terrain-form.component';
import { TerrainListComponent } from '../../components/terrain-list/terrain-list.component';
import { TerrainViewer3dComponent } from '../../components/terrain-viewer-3d/terrain-viewer-3d.component';
import { TerrainService } from '../../services/terrain.service';
import { Terrain } from '../../models/terrain.model';

@Component({
  selector: 'app-farm-3d-page',
  standalone: false,
  templateUrl: './farm-3d-page.component.html',
  styleUrls: ['./farm-3d-page.component.css']
})
export class Farm3dPageComponent implements OnInit, OnDestroy {
  terrains: Terrain[] = [];
  selectedTerrain: Terrain | null = null;
  loading = false;
  error = '';
  success = '';

  constructor(private terrainService: TerrainService) {}

  ngOnInit() {
    this.loadTerrains();
  }

  ngOnDestroy() {
    // Cleanup if needed
  }

  loadTerrains() {
    this.loading = true;
    this.error = '';

    this.terrainService.getTerrains().subscribe({
      next: (terrains: Terrain[]) => {
        this.terrains = terrains;
        this.loading = false;
      },
      error: (error: any) => {
        console.error('Error loading terrains:', error);
        this.error = 'Erreur lors du chargement des terrains';
        this.loading = false;
      }
    });
  }

  onTerrainCreated(terrain: Terrain) {
    this.terrainService.createTerrain(terrain).subscribe({
      next: (createdTerrain: Terrain) => {
        this.terrains.push(createdTerrain);
        this.success = `Terrain "${createdTerrain.nom}" créé avec succès`;
        this.selectedTerrain = createdTerrain;
        setTimeout(() => this.success = '', 3000);
      },
      error: (error: any) => {
        console.error('Error creating terrain:', error);
        this.error = 'Erreur lors de la création du terrain';
        setTimeout(() => this.error = '', 3000);
      }
    });
  }

  onTerrainSelected(terrain: Terrain) {
    this.selectedTerrain = terrain;
  }

  onTerrainDeleted(terrain: Terrain) {
    if (terrain.idTerrain) {
      this.terrainService.deleteTerrain(terrain.idTerrain).subscribe({
        next: () => {
          this.terrains = this.terrains.filter((t: Terrain) => t.idTerrain !== terrain.idTerrain);
          if (this.selectedTerrain?.idTerrain === terrain.idTerrain) {
            this.selectedTerrain = null;
          }
          this.success = `Terrain "${terrain.nom}" supprimé avec succès`;
          setTimeout(() => this.success = '', 3000);
        },
        error: (error: any) => {
          console.error('Error deleting terrain:', error);
          this.error = 'Erreur lors de la suppression du terrain';
          setTimeout(() => this.error = '', 3000);
        }
      });
    }
  }

  onTerrainEditRequested(terrain: Terrain) {
    // TODO: Implement edit functionality
    console.log('Edit terrain:', terrain);
    // Could open a modal or navigate to edit page
  }
}