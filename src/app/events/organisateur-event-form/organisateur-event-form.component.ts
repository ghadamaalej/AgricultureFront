import { Component, OnInit } from '@angular/core';
import {FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { EventService } from 'src/app/services/event/event.service';
import { AuthService } from 'src/app/services/auth/auth.service'; 

@Component({
  selector: 'app-organisateur-event-form',
  standalone: false,
  templateUrl: './organisateur-event-form.component.html',
  styleUrl: './organisateur-event-form.component.css'
})
export class OrganisateurEventFormComponent implements OnInit {

  organisateurId!: number;
  isEditMode = false;
  eventId: number | null = null;
  existingEvent: any = null;

  eventForm!: FormGroup;

  imageFile: File | null = null;
  imagePreview: string | null = null;
  authFile: File | null = null;
  authFileName: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private eventService: EventService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    const id = this.authService.getCurrentUserId();
    if (!id) {
      this.router.navigate(['/auth']);
      return;
    }
    this.organisateurId = id;


    this.eventForm = new FormGroup({
      titre: new FormControl('', [Validators.required, Validators.minLength(3)]),
      type: new FormControl('', Validators.required),
      description: new FormControl('', [Validators.required, Validators.minLength(10)]),
      dateDebut: new FormControl('', Validators.required),
      dateFin: new FormControl('', Validators.required),
      lieu: new FormControl('', Validators.required),
      region: new FormControl('', Validators.required),
      capaciteMax: new FormControl(null, [Validators.required, Validators.min(1)]),
      montant: new FormControl(0, [Validators.required, Validators.min(0)]),
      statut: new FormControl('PLANNED', Validators.required)
    });

    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.isEditMode = true;
      this.eventId = +idParam;
      this.loadEvent(this.eventId);
    }
  }

  get f() { return this.eventForm.controls; }

  loadEvent(id: number): void {
    this.eventService.getEventsByOrganisateur(this.organisateurId).subscribe({
      next: events => {
        const ev = events.find(e => e.id === id);
        if (!ev) { this.router.navigate(['organizer/events']); return; }
        this.existingEvent = ev;
        this.imagePreview  = ev.image ? 'assets/images/' + ev.image : null;
        this.authFileName  = ev.autorisationmunicipale ?? null;
        this.eventForm.patchValue({
          titre: ev.titre,
          type: ev.type,
          description: ev.description,
          dateDebut: this.toDatetimeLocal(ev.dateDebut),
          dateFin: this.toDatetimeLocal(ev.dateFin),
          lieu: ev.lieu,
          region: ev.region,
          capaciteMax: ev.capaciteMax,
          montant: ev.montant,
          statut: ev.statut
        });
      },
      error: err => console.error('Error loading event', err)
    });
  }

  onSubmit(): void {
    if (this.eventForm.invalid) {
      this.eventForm.markAllAsTouched();
      return;
    }
    this.isEditMode ? this.update() : this.create();
  }

  private create(): void {
    const payload = {
      ...this.eventForm.value,
      statut: 'PLANNED',
      inscrits: 0,
      idOrganisateur: this.organisateurId,
      image: this.imageFile ? this.imageFile.name : null,
      autorisationmunicipale: this.authFile ? this.authFile.name : null
    };
    this.eventService.addEvent(payload).subscribe({
      next: () => this.router.navigate(['events/organizer/events'], { queryParams: { created: 'true' } }),
      error: err => console.error('Error creating event', err)
    });
  }

  private update(): void {
    const payload = {
      ...this.existingEvent,
      ...this.eventForm.value,
      image: this.imageFile ? this.imageFile.name : this.existingEvent.image,
      autorisationmunicipale: this.authFile ? this.authFile.name : this.existingEvent.autorisationmunicipale
    };
    this.eventService.updateEvent(payload).subscribe({
      next: () => this.router.navigate(['/events/organizer/events'], {queryParams: { success: 'updated' }}),
      error: err => console.error('Error updating event', err)
    });
  }

  onImageChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.imageFile = file;
    const reader = new FileReader();
    reader.onload = e => this.imagePreview = e.target?.result as string;
    reader.readAsDataURL(file);
  }

  onAuthChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.authFile = file;
    this.authFileName = file.name;
  }

  goBack(): void {
    this.router.navigate(['events/organizer/events']);
  }

  private toDatetimeLocal(dt: string): string {
    if (!dt) return '';
    return new Date(dt).toISOString().slice(0, 16);
  }
}