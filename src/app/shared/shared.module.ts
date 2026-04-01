import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

// Exemple composants partagés
import { NavbarComponent } from '../components/navbar/navbar.component';
import { FooterComponent } from '../components/footer/footer.component';
import { FormsModule } from '@angular/forms';

@NgModule({
  declarations: [
    NavbarComponent,
    FooterComponent
  ],
  imports: [
    CommonModule,
    FormsModule   
  ],
  exports: [
    NavbarComponent,
    FooterComponent,
    CommonModule,
    FormsModule  
  ]
})
export class SharedModule { }