import { NgModule, LOCALE_ID } from '@angular/core';
import { registerLocaleData, CommonModule } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';

import { AppComponent }                      from './app.component';
import { AppRoutingModule }                  from './app-routing.module';
import { HeroComponent }                     from './components/hero/hero.component';
import { AboutComponent }                    from './components/about/about.component';
import { ServicesComponent }                 from './components/services/services.component';
import { ProductsComponent }                 from './components/products/products.component';
import { CounterComponent }                  from './components/counter/counter.component';
import { TestimonialsComponent }             from './components/testimonials/testimonials.component';
import { BlogComponent }                     from './components/blog/blog.component';
import { AuthComponent }                     from './components/auth/auth.component';
import { BlogDetailComponent }               from './components/blog-detail/blog-detail.component';
import { HomeComponent }                     from './components/home/home.component';
import { NotFoundComponent }                 from './components/not-found/not-found.component';
import { RegisterExtraComponent }            from './components/register-extra/register-extra.component';
import { RoleHomePlaceholderComponent }      from './components/role-home-placeholder/role-home-placeholder.component';
import { ExplorerHostComponent }             from './components/explorer-host/explorer-host.component';
import { DiseasePredictorComponent }         from './components/disease-predictor/disease-predictor.component';
import { AssistanceDetailComponent }         from './components/assistance-detail/assistance-detail.component';
import { HelpRequestComponent }              from './components/help-request/help-request.component';
import { ExpertAssistanceRequestsComponent } from './components/expert-assistance-requests/expert-assistance-requests.component';
import { AuthTokenInterceptor }              from './services/auth/auth-token.interceptor';
import { SuccessToastInterceptor }           from './core/interceptors/success-toast.interceptor';
import { SharedModule }                      from './shared/shared.module';
import { ShopModule }                        from './shop/shop.module';
import { ToastComponent }                    from './shared/components/toast/toast.component';
import { AppToastComponent }                 from './shared/components/app-toast/app-toast.component';

registerLocaleData(localeFr);

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
        RegisterExtraComponent,
        RoleHomePlaceholderComponent,
        ExplorerHostComponent,
        DiseasePredictorComponent,
        AssistanceDetailComponent,
        HelpRequestComponent,
        ExpertAssistanceRequestsComponent,
        ToastComponent,
        AppToastComponent,
    ],
    imports: [
        BrowserModule,
        BrowserAnimationsModule,
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        HttpClientModule,
        AppRoutingModule,
        SharedModule,
        ShopModule,
    ],
    providers: [
        {
            provide: HTTP_INTERCEPTORS,
            useClass: AuthTokenInterceptor,
            multi: true
        },
        {
            provide: HTTP_INTERCEPTORS,
            useClass: SuccessToastInterceptor,
            multi: true
        },
        { provide: LOCALE_ID, useValue: 'fr' },
    ],
    bootstrap: [AppComponent]
})
export class AppModule { }