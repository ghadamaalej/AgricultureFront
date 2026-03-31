import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { InventoryApiService } from '../../services/inventory-api.service';
import { AnimalDetail } from '../../models/inventory.models';

@Component({
  selector: 'app-animal-detail',
  standalone: false,
  templateUrl: './animal-detail.component.html',
  styleUrls: ['./animal-detail.component.css']
})
export class AnimalDetailComponent implements OnInit {
  @Input() animalId!: number;
  @Output() closed = new EventEmitter<void>();

  detail: AnimalDetail | null = null;
  loading = true;
  error   = '';

  constructor(private api: InventoryApiService) {}

  ngOnInit() {
    this.api.getAnimalDetail(this.animalId).subscribe({
      next: d => { this.detail = d; this.loading = false; },
      error: () => { this.error = 'Impossible de charger le détail'; this.loading = false; }
    });
  }

  age(dateNaissance: string): number {
    const now  = new Date();
    const born = new Date(dateNaissance);
    return Math.floor((now.getTime() - born.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
  }
}
