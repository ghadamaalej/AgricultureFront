import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Terrain } from '../../models/terrain.model';

@Component({
  selector: 'app-terrain-list',
  standalone: false,
  templateUrl: './terrain-list.component.html',
  styleUrls: ['./terrain-list.component.css']
})
export class TerrainListComponent implements OnInit {
  @Input() terrains: Terrain[] = [];
  @Input() selectedTerrain: Terrain | null = null;
  @Input() loading = false;
  @Output() terrainSelected = new EventEmitter<Terrain>();
  @Output() terrainDeleted = new EventEmitter<Terrain>();
  @Output() terrainEditRequested = new EventEmitter<Terrain>();

  ngOnInit() {
    // Component initialization
  }

  onTerrainClick(terrain: Terrain) {
    this.terrainSelected.emit(terrain);
  }

  onDeleteClick(terrain: Terrain, event: Event) {
    event.stopPropagation();
    if (confirm(`Êtes-vous sûr de vouloir supprimer le terrain "${terrain.nom}" ?`)) {
      this.terrainDeleted.emit(terrain);
    }
  }

  onEditClick(terrain: Terrain, event: Event) {
    event.stopPropagation();
    this.terrainEditRequested.emit(terrain);
  }

  isSelected(terrain: Terrain): boolean {
    return this.selectedTerrain?.idTerrain === terrain.idTerrain;
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