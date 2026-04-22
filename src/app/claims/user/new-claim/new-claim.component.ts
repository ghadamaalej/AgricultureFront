import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ClaimsService } from '../../services/claims.service';
import { AuthService } from '../../../services/auth/auth.service';
import { ReclamationCategory, ReclamationPriority, CATEGORY_LABELS, PRIORITY_LABELS } from '../../models/claims.models';

@Component({
  selector: 'app-new-claim',
  standalone: false,
  templateUrl: './new-claim.component.html',
  styleUrls: ['./new-claim.component.css']
})
export class NewClaimComponent implements OnInit {

  form!: FormGroup;
  submitting = false;
  submitError: string | null = null;
  submitSuccess = false;

  categories: { value: ReclamationCategory; label: string }[] = [
    { value: 'COMMANDE',     label: CATEGORY_LABELS.COMMANDE },
    { value: 'LIVRAISON',    label: CATEGORY_LABELS.LIVRAISON },
    { value: 'PAIEMENT',     label: CATEGORY_LABELS.PAIEMENT },
    { value: 'COMPTE',       label: CATEGORY_LABELS.COMPTE },
    { value: 'RENDEZ_VOUS',  label: CATEGORY_LABELS.RENDEZ_VOUS },
    { value: 'INVENTAIRE',   label: CATEGORY_LABELS.INVENTAIRE },
    { value: 'AUTRE',        label: CATEGORY_LABELS.AUTRE }
  ];

  priorities: { value: ReclamationPriority; label: string; icon: string }[] = [
    { value: 'BASSE',   label: PRIORITY_LABELS.BASSE,   icon: 'fas fa-arrow-down' },
    { value: 'MOYENNE', label: PRIORITY_LABELS.MOYENNE, icon: 'fas fa-minus' },
    { value: 'HAUTE',   label: PRIORITY_LABELS.HAUTE,   icon: 'fas fa-arrow-up' }
  ];

  constructor(
    private fb: FormBuilder,
    private claimsService: ClaimsService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      subject:     ['', [Validators.required, Validators.minLength(5), Validators.maxLength(100)]],
      category:    ['', Validators.required],
      description: ['', [Validators.required, Validators.minLength(20)]],
      priority:    ['MOYENNE', Validators.required]
    });
  }

  setPriority(p: ReclamationPriority): void {
    this.form.patchValue({ priority: p });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const userId = this.authService.getCurrentUserId();
    if (!userId) { this.router.navigate(['/claims/auth']); return; }

    this.submitting = true;
    this.submitError = null;

    this.claimsService.create({ userId, ...this.form.value }).subscribe({
      next: (rec) => {
        this.submitting = false;
        this.submitSuccess = true;
        setTimeout(() => this.router.navigate(['/claims/detail', rec.id]), 1500);
      },
      error: () => {
        this.submitting = false;
        this.submitError = 'Une erreur est survenue. Veuillez réessayer.';
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/claims/my-claims']);
  }

  fieldInvalid(name: string): boolean {
    const c = this.form.get(name);
    return !!(c && c.invalid && c.touched);
  }
}
