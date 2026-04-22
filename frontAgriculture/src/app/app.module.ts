import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { AppComponent }          from './app.component';
import { AppRoutingModule }      from './app-routing.module';
import { HeroComponent }         from './components/hero/hero.component';
import { AboutComponent }        from './components/about/about.component';
import { ServicesComponent }     from './components/services/services.component';
import { ProductsComponent }     from './components/products/products.component';
import { CounterComponent }      from './components/counter/counter.component';
import { TestimonialsComponent } from './components/testimonials/testimonials.component';
import { BlogComponent }         from './components/blog/blog.component';
import { AuthComponent }         from './components/auth/auth.component';
import { BlogDetailComponent }   from './components/blog-detail/blog-detail.component';
import { HomeComponent }         from './components/home/home.component';
import { NotFoundComponent }     from './components/not-found/not-found.component';
import { RegisterExtraComponent } from './components/register-extra/register-extra.component';
import { SharedModule } from './shared/shared.module';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { AuthTokenInterceptor } from './services/auth/AuthTokenInterceptor';

@NgModule({
  declarations: [
    AppComponent,
    AuthComponent,
    HeroComponent,
    AboutComponent,
    ServicesComponent,
    ProductsComponent,
    CounterComponent,
    TestimonialsComponent,
    BlogComponent,
    BlogDetailComponent,
    HomeComponent,
    NotFoundComponent,
    RegisterExtraComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    AppRoutingModule,
    SharedModule
      
  ],
 providers: [
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthTokenInterceptor,
      multi: true
    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }