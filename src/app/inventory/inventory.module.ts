import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { InventoryRoutingModule }    from './inventory-routing.module';

// Layout
import { InventoryLayoutComponent }  from './layout/inventory-layout.component';

// Inventory (products)
import { ProductListComponent }      from './components/product-list/product-list.component';
import { ProductFormComponent }      from './components/product-form/product-form.component';
import { BatchListComponent }        from './components/batch-list/batch-list.component';
import { MovementListComponent }     from './components/movement-list/movement-list.component';
import { ConsumeModalComponent }     from './components/consume-modal/consume-modal.component';
import { AdjustModalComponent }      from './components/adjust-modal/adjust-modal.component';

// Animals
import { AnimalListComponent }       from './components/animal-list/animal-list.component';
import { AnimalFormComponent }       from './components/animal-form/animal-form.component';
import { AnimalDetailComponent }     from './components/animal-detail/animal-detail.component';
import { CampaignListComponent }     from './components/campaign-list/campaign-list.component';
import { CampaignFormComponent }     from './components/campaign-form/campaign-form.component';
import { VaccinationModalComponent } from './components/vaccination-modal/vaccination-modal.component';

@NgModule({
  declarations: [
    InventoryLayoutComponent,
    ProductListComponent,
    ProductFormComponent,
    BatchListComponent,
    MovementListComponent,
    ConsumeModalComponent,
    AdjustModalComponent,
    AnimalListComponent,
    AnimalFormComponent,
    AnimalDetailComponent,
    CampaignListComponent,
    CampaignFormComponent,
    VaccinationModalComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    InventoryRoutingModule,
  ]
})
export class InventoryModule {}
