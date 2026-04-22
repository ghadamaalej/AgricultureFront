import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TerrainFormComponent } from '../../components/terrain-form/terrain-form.component';
import { TerrainService } from '../../services/terrain.service';
import { Terrain } from '../../models/terrain.model';

@Component({
  selector: 'app-farm-add',
  templateUrl: './farm-add.component.html',
  styleUrls: ['./farm-add.component.css']
})
export class FarmAddComponent implements OnInit {

  ngOnInit(): void {}

  constructor(
    private terrainService: TerrainService,
    private router: Router
  ) {}

  onTerrainCreated(terrain: Terrain) {
    this.terrainService.createTerrain(terrain).subscribe({
      next: (createdTerrain) => {
        // Navigate to the 3D view of the newly created terrain
        this.router.navigate(['/farm/3d', createdTerrain.idTerrain]);
      },
      error: (error) => {
        console.error('Error creating terrain:', error);
        // Handle error (could show a toast notification)
      }
    });
  }
}