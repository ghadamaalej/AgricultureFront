import { Pipe, PipeTransform } from '@angular/core';
import { InventoryProduct } from '../models/inventory.models';

@Pipe({ name: 'enBoutiqueCount', standalone: false })
export class EnBoutiqueCountPipe implements PipeTransform {
  transform(products: InventoryProduct[]): number {
    return (products || []).filter(p => p.enBoutique).length;
  }
}
