import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { InventoryApiService } from '../../services/inventory-api.service';
import { GoogleCalendarService } from '../../services/google-calendar.service';
import { InventoryProduct, Animal, VaccinationCampaign } from '../../models/inventory.models';

@Component({
  selector: 'app-campaign-form',
  standalone: false,
  templateUrl: './campaign-form.component.html',
  styleUrls: ['./campaign-form.component.css']
})
export class CampaignFormComponent implements OnInit {
  @Output() saved = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  form!: FormGroup;
  loading = false;
  loadingProds = true;
  loadingSpecies = true;
  error = '';

  // État de l'intégration Calendar
  calendarStatus: 'idle' | 'syncing' | 'success' | 'error' = 'idle';
  calendarMessage = '';

  products: InventoryProduct[] = [];
  animals: Animal[] = [];
  speciesOptions: string[] = [];

  constructor(
    private api: InventoryApiService,
    private calendarService: GoogleCalendarService
  ) {}

  ngOnInit() {
    this.form = new FormGroup({
      espece:      new FormControl('', Validators.required),
      ageMin:      new FormControl(0,  [Validators.required, Validators.min(0)]),
      ageMax:      new FormControl(10, [Validators.required, Validators.min(0)]),
      plannedDate: new FormControl('', Validators.required),
      productId:   new FormControl(null, Validators.required),
      dose:        new FormControl(null, [Validators.required, Validators.min(0.01)]),
      addToCalendar: new FormControl(true)  // ← checkbox Google Calendar
    });

    this.loadProducts();
    this.loadSpecies();
  }

  loadProducts() {
    this.loadingProds = true;
    this.api.getMyProducts().subscribe({
      next: (prods) => {
        this.products = prods.filter(p => p.categorie === 'VACCIN');
        this.loadingProds = false;
      },
      error: () => { this.loadingProds = false; }
    });
  }

  loadSpecies() {
    this.loadingSpecies = true;
    this.api.getMyAnimals().subscribe({
      next: (animals) => {
        this.animals = animals;
        this.speciesOptions = [...new Set(
          animals.map(a => (a.espece || '').trim()).filter(e => e.length > 0)
        )].sort((a, b) => a.localeCompare(b));
        this.loadingSpecies = false;
      },
      error: () => { this.loadingSpecies = false; }
    });
  }

  invalid(field: string): boolean {
    const c = this.form.get(field);
    return !!(c && c.invalid && c.touched);
  }

  get selectedProduct(): InventoryProduct | undefined {
    const id = this.form.get('productId')?.value;
    return id ? this.products.find(p => p.id === Number(id)) : undefined;
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const val = this.form.getRawValue();

    if (Number(val.ageMin) > Number(val.ageMax)) {
      this.error = "L'âge minimum doit être inférieur ou égal à l'âge maximum.";
      return;
    }

    this.loading = true;
    this.error = '';
    this.calendarStatus = 'idle';
    this.calendarMessage = '';

    const req = {
      espece:      val.espece,
      ageMin:      Number(val.ageMin),
      ageMax:      Number(val.ageMax),
      plannedDate: val.plannedDate,
      productId:   Number(val.productId),
      dose:        Number(val.dose)
    };

    this.api.createCampaign(req).subscribe({
      next: (createdCampaign: VaccinationCampaign) => {
        this.loading = false;

        // ✅ Campagne créée → synchroniser avec Google Calendar si coché
        if (val.addToCalendar) {
          this.syncToGoogleCalendar(createdCampaign);
        } else {
          this.saved.emit();
        }
      },
      error: (e) => {
        this.loading = false;
        this.error = e.error?.message || 'Erreur serveur';
      }
    });
  }

  private syncToGoogleCalendar(campaign: VaccinationCampaign) {
    this.calendarStatus = 'syncing';
    this.calendarMessage = 'Synchronisation avec Google Calendar…';

    const event = this.calendarService.buildVaccinationEvent({
      espece:      campaign.espece,
      ageMin:      campaign.ageMin,
      ageMax:      campaign.ageMax,
      plannedDate: campaign.plannedDate,
      productName: campaign.productName,
      dose:        campaign.dose
    });

    this.calendarService.createEvent(event).subscribe({
      next: (resp: any) => {
        this.calendarStatus = 'success';
        this.calendarMessage = `✅ Événement ajouté dans Google Calendar`;
        // Fermer après 2 secondes pour laisser voir le message
        setTimeout(() => this.saved.emit(), 2000);
      },
      error: (err) => {
        console.error('Google Calendar error:', err);
        this.calendarStatus = 'error';
        this.calendarMessage = "⚠️ Campagne enregistrée, mais l'ajout dans Google Calendar a échoué.";
        // Fermer quand même après 3 secondes
        setTimeout(() => this.saved.emit(), 3000);
      }
    });
  }
}