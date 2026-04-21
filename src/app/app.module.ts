import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
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
import { RoleHomePlaceholderComponent } from './components/role-home-placeholder/role-home-placeholder.component';
import { AuthTokenInterceptor } from './services/auth/auth-token.interceptor';
import { SharedModule } from './shared/shared.module';
import { ExplorerHostComponent } from './components/explorer-host/explorer-host.component';
import { DiseasePredictorComponent } from './components/disease-predictor/disease-predictor.component';
import { AssistanceDetailComponent } from './components/assistance-detail/assistance-detail.component';
import { HelpRequestComponent } from './components/help-request/help-request.component';
import { ExpertAssistanceRequestsComponent } from './components/expert-assistance-requests/expert-assistance-requests.component';
import { provideHttpClient } from '@angular/common/http';

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
    FooterComponent,
    BlogDetailComponent,
    HomeComponent,
    NotFoundComponent,
    RegisterExtraComponent,
      RoleHomePlaceholderComponent,
      ExplorerHostComponent,
      DiseasePredictorComponent,
      AssistanceDetailComponent,
      HelpRequestComponent,
      ExpertAssistanceRequestsComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    AppRoutingModule  ,
      SharedModule,

  ],
    providers: [
        {
            provide: HTTP_INTERCEPTORS,
            useClass: AuthTokenInterceptor,
            multi: true
        },
        provideHttpClient()
    ],
  bootstrap: [AppComponent]
})
export class AppModule { }
