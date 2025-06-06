
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';

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
  constructor(private router: Router) {}

  ngOnInit(): void {
    this.handleCallback();
  }

  private handleCallback(): void {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');

    if (error) {
      console.error('OAuth error:', error);
      alert('Authentication failed: ' + error);
      this.router.navigate(['/']);
      return;
    }

    if (code) {
      // Store the auth code for the main component to process
      localStorage.setItem('splitwise_auth_code', code);

      // Redirect back to home page
      this.router.navigate(['/']);
    } else {
      console.error('No authorization code received');
      alert('Authentication failed: No authorization code received');
      this.router.navigate(['/']);
    }
  }
}
