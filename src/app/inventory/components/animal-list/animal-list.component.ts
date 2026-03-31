import { Component, OnInit } from '@angular/core';
import { InventoryApiService } from '../../services/inventory-api.service';
import { Animal } from '../../models/inventory.models';

@Component({
  selector: 'app-animal-list',
  standalone: false,
  templateUrl: './animal-list.component.html',
  styleUrls: ['./animal-list.component.css']
})
export class AnimalListComponent implements OnInit {
  animals: Animal[] = [];
  loading = true;
  error   = '';

  // Sub-views
  view: 'list' | 'campaigns' = 'list';
  selectedAnimal: Animal | null = null;

  // Modals
  showAnimalForm      = false;
  showAnimalDetail    = false;
  showCampaignForm    = false;
  showVaccModal       = false;   // vaccination individuelle
  editingAnimal: Animal | null = null;

  constructor(private api: InventoryApiService) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.api.getMyAnimals().subscribe({
      next: a => { this.animals = a; this.loading = false; },
      error: () => { this.error = 'Erreur de chargement'; this.loading = false; }
    });
  }

  openAdd()  { this.editingAnimal = null; this.showAnimalForm = true; }
  openEdit(a: Animal) { this.editingAnimal = a; this.showAnimalForm = true; }
  onSaved()  { this.showAnimalForm = false; this.load(); }

  delete(a: Animal) {
    if (!confirm(`Supprimer l'animal "${a.reference}" ?`)) return;
    this.api.deleteAnimal(a.id).subscribe({ next: () => this.load() });
  }

  openDetail(a: Animal)   { this.selectedAnimal = a; this.showAnimalDetail = true; }
  openVaccine(a: Animal)  { this.selectedAnimal = a; this.showVaccModal = true; }

  openCampaigns() { this.view = 'campaigns'; }
  backToList()    { this.view = 'list'; }

  age(dateNaissance: string): number {
    const now  = new Date();
    const born = new Date(dateNaissance);
    return Math.floor((now.getTime() - born.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
  }
}
