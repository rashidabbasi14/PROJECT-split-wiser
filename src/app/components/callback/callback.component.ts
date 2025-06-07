import {Component, OnInit} from '@angular/core';
import {Router} from '@angular/router';
import {CommonModule} from '@angular/common';
import {CardModule} from 'primeng/card';
import {TokenResponse} from '../../interfaces/person';
import {HttpClient} from '@angular/common/http';

@Component({
  selector: 'app-callback',
  standalone: true,
  imports: [
    CommonModule,
    CardModule
  ],
  template: `
    <div class="flex justify-content-center align-items-center min-h-screen">
      <p-card class="w-full max-w-md">
        <ng-template pTemplate="header">
          <div class="text-center p-4">
            <h2 class="text-xl font-bold">Processing Authentication</h2>
          </div>
        </ng-template>

        <ng-template pTemplate="content">
          <div class="text-center">
            <i class="pi pi-spin pi-spinner text-4xl text-primary mb-4"></i>
            <p class="text-lg mb-4">Connecting to Splitwise...</p>
            <p class="text-sm text-color-secondary">Please wait while we complete the authentication process.</p>
          </div>
        </ng-template>
      </p-card>
    </div>
  `,
})
export class CallbackComponent implements OnInit {
  private readonly clientId: string = import.meta.env.NG_APP_SPLITWISE_CLIENT_ID ?? 'your-client-id';
  private readonly clientSecret: string = import.meta.env.NG_APP_SPLITWISE_CLIENT_SECRET ?? 'your-client-secret';

  constructor(private router: Router,
              private http: HttpClient) {
  }

  ngOnInit(): void {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');
    const sigin = urlParams.get('signin');
    if (code) {
      this.handleCallback(code, error);
    } else if (sigin) {
      this.startOAuthFlow();
    }
  }

  private startOAuthFlow(): void {
    const redirectUri = encodeURIComponent(`${window.location.origin}/callback`);
    window.location.href = `https://secure.splitwise.com/oauth/authorize?client_id=${this.clientId}&response_type=code&redirect_uri=${redirectUri}`;
  }

  private exchangeCodeForAccessToken(code: string): void {
    const tokenUrl = '/oauth/token';
    const redirectUri = `${window.location.origin}/callback`;

    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri
    });

    this.http.post<TokenResponse>(tokenUrl, body.toString(), {
      headers: {'Content-Type': 'application/x-www-form-urlencoded'}
    }).subscribe({
      next: (response: TokenResponse) => {
        localStorage.setItem('splitwise_access_token', response.access_token!);
        // Redirect back to home page
        this.router.navigate(['/']);
      },
      error: (error) => {
        console.error('Token exchange failed:', error);
        alert('Authentication failed during token exchange');
        localStorage.removeItem('splitwise_access_token');
      }
    });
  }

  private handleCallback(code: string, error: string | null): void {
    if (error) {
      console.error('OAuth error:', error);
      alert('Authentication failed: ' + error);
      this.router.navigate(['/']);
      return;
    }
    if (code) {
      this.exchangeCodeForAccessToken(code);
    } else {
      console.error('No authorization code received');
      alert('Authentication failed: No authorization code received');
      this.router.navigate(['/']);
    }
  }
}
