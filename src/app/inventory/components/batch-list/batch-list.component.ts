import { Component, Input, Output, EventEmitter } from '@angular/core';
import { InventoryProduct, Batch } from '../../models/inventory.models';

@Component({
  selector: 'app-batch-list',
  standalone: false,
  templateUrl: './batch-list.component.html',
  styleUrls: ['./batch-list.component.css']
})
export class BatchListComponent {
  @Input() product!: InventoryProduct;
  @Input() batches: Batch[] = [];
  @Output() back    = new EventEmitter<void>();
  @Output() consume = new EventEmitter<void>();
  @Output() adjust  = new EventEmitter<void>();
}
