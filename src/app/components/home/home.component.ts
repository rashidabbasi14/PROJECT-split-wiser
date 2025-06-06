import {Component, inject, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {HttpClient, HttpHeaders} from '@angular/common/http';

// PrimeNG Imports
import {CardModule} from 'primeng/card';
import {ButtonModule} from 'primeng/button';
import {InputTextModule} from 'primeng/inputtext';
import {InputNumberModule} from 'primeng/inputnumber';
import {DropdownModule} from 'primeng/dropdown';
import {MultiSelectModule} from 'primeng/multiselect';
import {DialogModule} from 'primeng/dialog';
import {TagModule} from 'primeng/tag';
import {InputSwitchModule} from 'primeng/inputswitch';

import {ApiResponse, Person, SplitwiseGroup, SplitwiseMember, TokenResponse} from '../../interfaces/person';
import {Message} from 'primeng/message';

interface DropdownOption {
  label: string;
  value: any;
  email?: string;
  memberCount?: number;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    ButtonModule,
    InputTextModule,
    InputNumberModule,
    DropdownModule,
    MultiSelectModule,
    DialogModule,
    TagModule,
    InputSwitchModule,
    Message
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit {
  // Person Management
  persons: Person[] = [];
  inputPersons: Person[] = [];
  numberOfPersons: number | undefined;
  // UI State
  shouldShowBillCards: boolean = false;
  shouldShowPersonInputs: boolean = false;
  showManualEntry: boolean = false;
  showMultiPersonItemDialog: boolean = false;
  isPersonInputsValid: boolean = false;
  // Bill Calculation
  gstPercentage: number | undefined;
  totalBill: number = 0;
  discountOnTotalBill: number | undefined;
  // Multi Person Item
  multiPersonItemPrice: number | undefined;
  multiPersonItemDiscount: number | undefined;
  selectedPersonsForItem: Person[] = [];
  shouldDivideAmongSelected: boolean = true;
  // Splitwise Integration
  isAuthenticated: boolean = false;
  splitwiseGroups: SplitwiseGroup[] = [];
  selectedGroup: SplitwiseGroup | null = null;
  selectedGroupMembers: SplitwiseMember[] = [];
  selectedPayer: SplitwiseMember | null = null;
  // Dropdown Options
  groupOptions: DropdownOption[] = [];
  memberOptions: DropdownOption[] = [];
  payerOptions: DropdownOption[] = [];
  personOptions: DropdownOption[] = [];
  protected readonly String = String;
  private readonly http = inject(HttpClient);
  private readonly clientId: string = 'sBrfNYZ0Tc12BWwbkeIG91tAoSoC1gznJEgcCBni';
  private readonly clientSecret: string = 'EF1GfWeSkCGQoKXN31nAgiUIb327aUkxlOUDP8xw';
  private accessToken: string | null = null;
  private readonly splitwiseBaseUrl = '/api';

  ngOnInit(): void {
    this.checkAuthenticationStatus();
  }

  authenticateWithSplitwise(): void {
    const storedToken = localStorage.getItem('splitwise_access_token');
    if (storedToken) {
      this.accessToken = storedToken;
      this.isAuthenticated = true;
      this.fetchSplitwiseGroups();
      return;
    }

    const authCode = localStorage.getItem('splitwise_auth_code');
    if (authCode) {
      this.exchangeCodeForAccessToken(authCode);
      return;
    }

    this.startOAuthFlow();
  }

  // Group Selection Handlers
  onGroupSelectionChange(): void {
    this.selectedGroupMembers = [];
    this.selectedPayer = null;
    if (this.selectedGroup) {
      this.updateMemberOptions();
    } else {
      this.memberOptions = [];
      this.payerOptions = [];
    }
  }

  // Manual Entry Methods
  showManualEntryDialog(): void {
    this.showManualEntry = true;
    this.numberOfPersons = undefined;
    this.shouldShowPersonInputs = false;
    this.inputPersons = [];
  }

  closeManualEntryDialog(): void {
    this.showManualEntry = false;
    this.numberOfPersons = undefined;
    this.shouldShowPersonInputs = false;
    this.inputPersons = [];
  }

  generatePersonInputs(): void {
    if (!this.numberOfPersons || this.numberOfPersons < 2) {
      alert("Please enter a valid count of persons (minimum 2)");
      return;
    }

    this.inputPersons = [];
    for (let i = 0; i < this.numberOfPersons; i++) {
      this.inputPersons.push({
        id: i,
        name: '',
        totalAmount: 0,
        listOfAmounts: [],
      });
    }
    this.shouldShowPersonInputs = true;
    this.validatePersonInputs();
  }

  validatePersonInputs(): void {
    this.inputPersons.forEach(person => {
      person.name = this.capitalizeFullName(person.name.trim());
    });

    const names = this.inputPersons.map(person => person.name);
    const uniqueNames = new Set(names);
    this.isPersonInputsValid = names.length === uniqueNames.size && names.every(name => name !== '');
  }

  generateBillCards(): void {
    this.persons = [...this.inputPersons];
    this.persons = this.persons.sort((a, b) => a.name.localeCompare(b.name));
    this.shouldShowBillCards = true;
    this.closeManualEntryDialog();
    this.updatePersonOptions();
  }

  // Splitwise Integration Methods
  createBillWithSelectedMembers(): void {
    if (this.selectedGroupMembers.length === 0) {
      alert('Please select at least one group member');
      return;
    }

    this.persons = this.selectedGroupMembers.map((member: SplitwiseMember) => ({
      id: member.id,
      name: `${member.first_name} ${member.last_name}`.trim(),
      totalAmount: 0,
      listOfAmounts: [],
      splitwiseMember: member,
      splitwiseUserId: member.user_id || member.id
    }));

    this.shouldShowBillCards = true;
    this.shouldShowPersonInputs = false;
    this.updatePersonOptions();
  }

  // Amount Management
  addNewAmountInput(personId: number): void {
    const person = this.persons.find(p => p.id === personId);
    if (person) {
      person.listOfAmounts.push({
        id: Date.now() + Math.random(),
        amount: undefined
      });
    }
  }

  removeAmountInput(personId: number, amountId: number): void {
    const person = this.persons.find(p => p.id === personId);
    if (person) {
      person.listOfAmounts = person.listOfAmounts.filter(amount => amount.id !== amountId);
      this.calculateTotalBill();
    }
  }

  // Multi Person Item Methods
  closeMultiPersonItemDialog(): void {
    this.showMultiPersonItemDialog = false;
    this.multiPersonItemPrice = undefined;
    this.multiPersonItemDiscount = undefined;
    this.selectedPersonsForItem = [];
    this.shouldDivideAmongSelected = true;
  }

  addMultiPersonItem(): void {
    if (!this.multiPersonItemPrice || this.multiPersonItemPrice <= 0 || !this.selectedPersonsForItem?.length) {
      return;
    }

    // Remove duplicates
    const uniquePersons = Array.from(
      new Map(
        this.selectedPersonsForItem
          .flat()
          .map(person => [person.id, person])
      ).values()
    );

    let amountPerPerson = 0;
    if (this.shouldDivideAmongSelected) {
      amountPerPerson = Number((this.multiPersonItemPrice / uniquePersons.length).toFixed(2));
    } else {
      amountPerPerson = this.multiPersonItemPrice;
    }

    // Apply item discount
    const discountPercentage = this.multiPersonItemDiscount && this.multiPersonItemDiscount > 0 ? this.multiPersonItemDiscount : 0;
    amountPerPerson -= amountPerPerson * (discountPercentage / 100);

    uniquePersons.forEach(person => {
      const personToUpdate = this.persons.find(p => p.id === person.id);
      if (personToUpdate) {
        personToUpdate.listOfAmounts.push({
          id: Date.now() + Math.random(),
          amount: amountPerPerson
        });
      }
    });

    this.calculateTotalBill();
    this.closeMultiPersonItemDialog();
  }

  // Bill Calculation
  calculateTotalBill(): void {
    // Calculate individual amounts with GST
    if (this.gstPercentage && this.gstPercentage > 0) {
      this.persons.forEach(person => {
        person.totalAmount = person.listOfAmounts.reduce((sum, amount) => {
          const gstAmount = (amount.amount ?? 0) * (this.gstPercentage! / 100);
          const amountWithGST = (amount.amount ?? 0) + gstAmount;
          return sum + amountWithGST;
        }, 0);
      });
    } else {
      this.persons.forEach(person => {
        person.totalAmount = person.listOfAmounts.reduce((sum, amount) => sum + (amount.amount ?? 0), 0);
      });
    }

    // Apply total bill discount
    if (this.discountOnTotalBill && this.discountOnTotalBill > 0) {
      this.persons.forEach(person => {
        person.totalAmount -= person.totalAmount * (this.discountOnTotalBill! / 100);
      });
    }

    this.totalBill = this.persons.reduce((sum, person) => sum + person.totalAmount, 0);
  }

  // Utility Methods
  generateAvatarUrl(userName: string): string {
    return `https://avatar.iran.liara.run/public/boy?username=${userName}`;
  }

  // Reset Methods
  resetEverything(): void {
    this.persons = [];
    this.inputPersons = [];
    this.numberOfPersons = undefined;
    this.shouldShowBillCards = false;
    this.shouldShowPersonInputs = false;
    this.showManualEntry = false;
    this.isPersonInputsValid = false;
    this.gstPercentage = undefined;
    this.totalBill = 0;
    this.discountOnTotalBill = undefined;
    this.selectedGroup = null;
    this.selectedGroupMembers = [];
    this.selectedPayer = null;
    this.closeMultiPersonItemDialog();
  }

  updatePayerOptions(): void {
    if (!this.selectedGroup?.members) {
      this.payerOptions = [];
      return;
    }

    this.payerOptions = this.selectedGroup.members.map(member => ({
      label: `${member.first_name} ${member.last_name}`.trim(),
      value: member,
      email: member.email
    }));
  }

  // Authentication Methods
  private checkAuthenticationStatus(): void {
    const storedToken = localStorage.getItem('splitwise_access_token');
    if (storedToken) {
      this.accessToken = storedToken;
      this.isAuthenticated = true;
      this.fetchSplitwiseGroups();
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
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }).subscribe({
      next: (response: TokenResponse) => {
        this.accessToken = response.access_token;
        localStorage.setItem('splitwise_access_token', this.accessToken!);
        localStorage.removeItem('splitwise_auth_code');
        this.isAuthenticated = true;
        this.fetchSplitwiseGroups();
      },
      error: (error) => {
        console.error('Token exchange failed:', error);
        alert('Authentication failed during token exchange');
        localStorage.removeItem('splitwise_auth_code');
        localStorage.removeItem('splitwise_access_token');
      }
    });
  }

  private fetchSplitwiseGroups(): void {
    if (!this.accessToken) return;

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json'
    });

    this.http.get<ApiResponse>(`${this.splitwiseBaseUrl}/get_groups`, { headers })
      .subscribe({
        next: (response: ApiResponse) => {
          this.splitwiseGroups = response.groups || [];
          this.updateGroupOptions();
        },
        error: (error) => {
          console.error('Error fetching groups:', error);
        }
      });
  }

  // Dropdown Options Management
  private updateGroupOptions(): void {
    this.groupOptions = [
      { label: 'No Group', value: null },
      ...this.splitwiseGroups.map(group => ({
        label: group.name,
        value: group,
        memberCount: group.members?.length || 0
      }))
    ];
  }

  private updateMemberOptions(): void {
    if (!this.selectedGroup?.members) {
      this.memberOptions = [];
      return;
    }

    this.memberOptions = this.selectedGroup.members.map(member => ({
      label: `${member.first_name} ${member.last_name}`.trim(),
      value: member,
      email: member.email
    }));
  }

  private updatePersonOptions(): void {
    this.personOptions = this.persons.map(person => ({
      label: person.name,
      value: person
    }));
  }

  private capitalizeFullName(name: string): string {
    return name.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
}
