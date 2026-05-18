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
    <div class="flex justify-center items-center min-h-screen flex-col">
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
    // look for access_token in the hash, not a ?code=…
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const error = params.get('error');
    const sigin = this.isSigninQueryParamAvailable();
    if (error) {
      alert('Authentication failed: ' + error);
      this.router.navigate(['/']);
      return;
    }
    if (accessToken) {
      localStorage.setItem('splitwise_access_token', accessToken);
      this.router.navigate(['/']);
      return;
    } else if (sigin) {
      // if there is a signin parameter, start the OAuth flow
      this.startOAuthFlow();
      return;
    }
    alert("Authentication failed: No access token received");
    this.router.navigate(['/']);
    return;
  }

  private isSigninQueryParamAvailable(): boolean {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.has('signin');
  }

  private startOAuthFlow(): void {
    const redirectUri = encodeURIComponent(`${window.location.origin}/callback`);
    // 🚩 change response_type to “token”
    window.location.href =
      `https://secure.splitwise.com/oauth/authorize` +
      `?client_id=${this.clientId}` +
      `&response_type=token` +
      `&redirect_uri=${redirectUri}`;
  }

  private exchangeCodeForAccessToken(code: string): void {
    const tokenUrl = 'https://secure.splitwise.com/oauth/token';
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
}
