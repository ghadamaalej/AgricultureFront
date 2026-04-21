import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TerrainService } from '../../services/terrain.service';
import { Terrain } from '../../models/terrain.model';

@Component({
  selector: 'app-farm-list',
  templateUrl: './farm-list.component.html',
  styleUrls: ['./farm-list.component.css']
})
export class FarmListComponent implements OnInit {
  terrains: Terrain[] = [];
  loading = false;
  error = '';

  constructor(
    private terrainService: TerrainService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadTerrains();
  }

  loadTerrains() {
    this.loading = true;
    this.error = '';

    this.terrainService.getAllTerrains().subscribe({
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

  onTerrainClick(terrain: Terrain) {
    if (terrain.idTerrain) {
      this.router.navigate(['/farm/3d', terrain.idTerrain]);
    }
  }

  onAddNewTerrain() {
    this.router.navigate(['/farm/add']);
  }

  getSoilTypeIcon(typeSol: string): string {
    const iconMap: { [key: string]: string } = {
      'Argileux': 'fas fa-mountain',
      'Sableux': 'fas fa-sun',
      'Limoneux': 'fas fa-leaf',
      'Calcaire': 'fas fa-stone',
      'Humifère': 'fas fa-seedling'
    };
    return iconMap[typeSol] || 'fas fa-seedling';
  }

  getIrrigationIcon(irrigation: string): string {
    const iconMap: { [key: string]: string } = {
      'Aucune': 'fas fa-ban',
      'Goutte à goutte': 'fas fa-tint',
      'Aspersion': 'fas fa-cloud-rain',
      'Surface': 'fas fa-water',
      'Sous-sol': 'fas fa-arrow-down'
    };
    return iconMap[irrigation] || 'fas fa-tint';
  }
}