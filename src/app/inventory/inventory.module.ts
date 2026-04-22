import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { InventoryRoutingModule }       from './inventory-routing.module';

// Layout
import { InventoryLayoutComponent }     from './layout/inventory-layout.component';

// Farmer inventory (existing)
import { ProductListComponent }         from './components/product-list/product-list.component';
import { ProductFormComponent }         from './components/product-form/product-form.component';
import { BatchListComponent }           from './components/batch-list/batch-list.component';
import { MovementListComponent }        from './components/movement-list/movement-list.component';
import { ConsumeModalComponent }        from './components/consume-modal/consume-modal.component';
import { AdjustModalComponent }         from './components/adjust-modal/adjust-modal.component';

// Animals (shared)
import { AnimalListComponent }          from './components/animal-list/animal-list.component';
import { AnimalFormComponent }          from './components/animal-form/animal-form.component';
import { AnimalDetailComponent }        from './components/animal-detail/animal-detail.component';
import { CampaignListComponent }        from './components/campaign-list/campaign-list.component';
import { CampaignFormComponent }        from './components/campaign-form/campaign-form.component';
import { VaccinationModalComponent }    from './components/vaccination-modal/vaccination-modal.component';
import { StatisticsDashboardComponent } from './components/statistics-dashboard/statistics-dashboard.component';

// Vet-specific inventory
import { VetProductListComponent }      from './components/vet-product-list/vet-product-list.component';
import { VetProductFormComponent }      from './components/vet-product-form/vet-product-form.component';

// Boutique
import { VetShopComponent }             from './components/vet-shop/vet-shop.component';

// Pipes
import { EnBoutiqueCountPipe }          from './pipes/inventory.pipes';

@NgModule({
  declarations: [
    InventoryLayoutComponent,
    // Farmer
    ProductListComponent,
    ProductFormComponent,
    BatchListComponent,
    MovementListComponent,
    ConsumeModalComponent,
    AdjustModalComponent,
    // Animals
    AnimalListComponent,
    AnimalFormComponent,
    AnimalDetailComponent,
    CampaignListComponent,
    CampaignFormComponent,
    VaccinationModalComponent,
    StatisticsDashboardComponent,
    // Vet inventory
    VetProductListComponent,
    VetProductFormComponent,
    // Boutique
    VetShopComponent,
    // Pipes
    EnBoutiqueCountPipe,
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    InventoryRoutingModule,
    RouterModule,
  ],
  exports: [
    // Exportés pour AppointmentsModule (vétérinaire)
    VetProductListComponent,
    AnimalListComponent,
    VetShopComponent,
  ]
})
export class InventoryModule {}
