import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { Farm3dRoutingModule } from './farm-3d-routing.module';
import { Farm3dPageComponent } from './pages/farm-3d-page/farm-3d-page.component';
import { TerrainFormComponent } from './components/terrain-form/terrain-form.component';
import { TerrainListComponent } from './components/terrain-list/terrain-list.component';
import { TerrainViewer3dComponent } from './components/terrain-viewer-3d/terrain-viewer-3d.component';

@NgModule({
  declarations: [
    Farm3dPageComponent,
    TerrainFormComponent,
    TerrainListComponent,
    TerrainViewer3dComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    Farm3dRoutingModule
  ]
})
export class Farm3dModule { }