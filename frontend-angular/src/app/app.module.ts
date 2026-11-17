import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import {
  InteractionType,
  BrowserCacheLocation,
  PublicClientApplication
} from '@azure/msal-browser';
import {
  MsalGuard,
  MsalBroadcastService,
  MsalInterceptor,
  MsalModule,
  MsalService
} from '@azure/msal-angular';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AppComponent } from './app.component';
import { HomeComponent } from './home.component';
import { RedirectComponent } from './redirect.component';
import { apiBaseUrl, redirectPath, runtimeConfig } from './runtime-config';
import { WorkspaceComponent } from './workspace.component';

@NgModule({
  declarations: [AppComponent, HomeComponent, RedirectComponent, WorkspaceComponent],
  imports: [
    BrowserModule,
    FormsModule,
    HttpClientModule,
    RouterModule.forRoot([
      { path: '', component: HomeComponent, pathMatch: 'full' },
      { path: redirectPath.slice(1), component: RedirectComponent },
      { path: 'workspace', component: WorkspaceComponent, canActivate: [MsalGuard] },
      { path: '**', redirectTo: '' }
    ]),
    MsalModule.forRoot(
      new PublicClientApplication({
        auth: {
          clientId: runtimeConfig.clientId,
          authority: `https://login.microsoftonline.com/${runtimeConfig.tenantId}`,
          redirectUri: `${window.location.origin}${redirectPath}`,
          postLogoutRedirectUri: `${window.location.origin}/`
        },
        cache: { cacheLocation: BrowserCacheLocation.SessionStorage }
      }),
      {
        interactionType: InteractionType.Redirect,
        authRequest: { scopes: [runtimeConfig.scope] },
        loginFailedRoute: '/'
      },
      {
        interactionType: InteractionType.Redirect,
        strictMatching: true,
        protectedResourceMap: new Map([
          [`${apiBaseUrl}/api/*`, [runtimeConfig.scope]]
        ])
      }
    )
  ],
  providers: [
    MsalGuard,
    MsalService,
    MsalBroadcastService,
    {
      provide: HTTP_INTERCEPTORS,
      useClass: MsalInterceptor,
      multi: true
    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule {}
