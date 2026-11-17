import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MsalBroadcastService, MsalService } from '@azure/msal-angular';
import { AccountInfo, InteractionStatus } from '@azure/msal-browser';
import { Subject, filter, takeUntil } from 'rxjs';
import { redirectPath } from './runtime-config';

@Component({
  standalone: false,
  selector: 'app-root',
  template: `
    <header *ngIf="!onRedirectPage" class="topbar">
      <a class="brand" routerLink="/">Pedidos<span>360</span></a>
      <div class="account">
        <span *ngIf="accountName">{{ accountName }}</span>
        <button class="quiet" *ngIf="accountName" (click)="logout()">Salir</button>
      </div>
    </header>
    <router-outlet></router-outlet>
    <footer *ngIf="!onRedirectPage">Pedidos360 · Gestión de pedidos y eventos</footer>
  `
})
export class AppComponent implements OnInit, OnDestroy {
  accountName = '';
  readonly onRedirectPage = window.location.pathname === redirectPath;
  private readonly destroyed = new Subject<void>();

  constructor(
    private readonly msal: MsalService,
    private readonly broadcast: MsalBroadcastService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    if (this.onRedirectPage) return;

    this.broadcast.inProgress$
      .pipe(
        filter(status => status === InteractionStatus.None),
        takeUntil(this.destroyed)
      )
      .subscribe(() => {
        this.setAccount(this.msal.instance.getActiveAccount() ?? this.msal.instance.getAllAccounts()[0]);
      });

    this.msal.handleRedirectObservable().pipe(takeUntil(this.destroyed)).subscribe({
      next: result => {
        if (!result?.account) return;
        this.setAccount(result.account);
        if (window.location.pathname === '/') {
          void this.router.navigateByUrl('/workspace');
        }
      },
      error: error => {
        // The error code is useful for support while avoiding claims and tokens in logs.
        console.error('Microsoft Entra ID:', error?.errorCode ?? 'redirect_failed');
        void this.router.navigate(['/'], { queryParams: { auth: 'failed' } });
      }
      });
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
  }

  private setAccount(account?: AccountInfo): void {
    if (account) this.msal.instance.setActiveAccount(account);
    this.accountName = account?.name || account?.username || '';
  }

  logout(): void {
    this.msal.logoutRedirect().subscribe({
      error: error => console.error('Microsoft Entra ID:', error?.errorCode ?? 'logout_failed')
    });
  }
}
