import { NgModule } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { AppComponent }          from './app.component';
import { AppRoutingModule }      from './app-routing.module';
import { NavbarComponent }       from './components/navbar/navbar.component';
import { HeroComponent }         from './components/hero/hero.component';
import { AboutComponent }        from './components/about/about.component';
import { ServicesComponent }     from './components/services/services.component';
import { ProductsComponent }     from './components/products/products.component';
import { CounterComponent }      from './components/counter/counter.component';
import { TestimonialsComponent } from './components/testimonials/testimonials.component';
import { BlogComponent }         from './components/blog/blog.component';
import { FooterComponent }       from './components/footer/footer.component';
import { AuthComponent }         from './components/auth/auth.component';
import { BlogDetailComponent }   from './components/blog-detail/blog-detail.component';
import { HomeComponent }         from './components/home/home.component';
import { NotFoundComponent }     from './components/not-found/not-found.component';
import { RegisterExtraComponent } from './components/register-extra/register-extra.component';
import { CommonModule } from '@angular/common';


import { FarmerModule } from './farmer/farmer.module';
import { AnimalsModule } from './animals/animals.module';

import { LOCALE_ID } from '@angular/core';
import { ToastComponent } from './shared/components/toast/toast.component';
import { AppToastComponent } from './shared/components/app-toast/app-toast.component';
import { ClaimsModule } from './claims/claims.module';

registerLocaleData(localeFr);

@NgModule({
  declarations: [
    AppComponent,
    AuthComponent,
    NavbarComponent,
    HeroComponent,
    AboutComponent,
    ServicesComponent,
    ProductsComponent,
    CounterComponent,
    TestimonialsComponent,
    BlogComponent,
    FooterComponent,
    BlogDetailComponent,
    HomeComponent,
    NotFoundComponent,
    RegisterExtraComponent,
    ToastComponent,
     AppToastComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
     CommonModule,
    FormsModule,
   
    ReactiveFormsModule,
    HttpClientModule,
    AppRoutingModule,
    FarmerModule,
    AnimalsModule,
  
  
  
    
  ],
  providers: [{ provide: LOCALE_ID, useValue: 'fr' }],
  bootstrap: [AppComponent]
})
export class AppModule { }