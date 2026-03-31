import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { InventoryLayoutComponent } from './layout/inventory-layout.component';
import { InventoryAuthGuard } from './services/inventory-auth.guard';

const routes: Routes = [
  {
    path: '',
    component: InventoryLayoutComponent,
    canActivate: [InventoryAuthGuard]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class InventoryRoutingModule {}
