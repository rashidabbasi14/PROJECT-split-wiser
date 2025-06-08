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
import {ToastModule} from 'primeng/toast';
import {MessageService} from 'primeng/api';

import {ApiResponse, ExpenseResponse, Person, SplitwiseGroup, SplitwiseMember} from '../../interfaces/person';
import {Message} from 'primeng/message';
import {Router} from '@angular/router';

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
    Message,
    ToastModule
  ],
  providers: [MessageService],
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
  isManualFlow: boolean = true; // Track if using manual flow

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

  // New properties for non-group members
  showAddNonGroupMemberDialog: boolean = false;
  nonGroupMemberName: string = '';

  // New properties for Splitwise posting
  showDescriptionDialog: boolean = false;
  expenseDescription: string = '';
  showNonGroupMemberSharesDialog: boolean = false;
  nonGroupMemberShares: { name: string, amount: number }[] = [];

  protected readonly String = String;
  private readonly http = inject(HttpClient);
  private accessToken: string | null = null;
  private readonly splitwiseBaseUrl = this.getApiBaseUrl();

  constructor(private router: Router, private messageService: MessageService) {
  }

  ngOnInit(): void {
    this.checkAuthenticationStatus();
  }

  // Group Selection Handlers
  onGroupSelectionChange(): void {
    this.selectedGroupMembers = [];
    this.selectedPayer = null;
    if (this.selectedGroup) {
      this.updateMemberOptions();
      this.updateFlowType();
    } else {
      this.memberOptions = [];
      this.payerOptions = [];
      this.isManualFlow = true;
    }
  }

  // Update flow type based on current state
  updateFlowType(): void {
    this.isManualFlow = !(this.isAuthenticated && this.selectedGroup && this.selectedGroupMembers.length > 0);
  }

  // Manual Entry Methods
  showManualEntryDialog(): void {
    this.showManualEntry = true;
    this.numberOfPersons = undefined;
    this.shouldShowPersonInputs = false;
    this.inputPersons = [];
    this.isManualFlow = true; // Set manual flow when manual entry is clicked
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
    this.updateFlowType();
    this.updatePersonOptions();
  }

  // Add Non-Group Member
  showAddNonGroupMember(): void {
    this.showAddNonGroupMemberDialog = true;
    this.nonGroupMemberName = '';
  }

  closeAddNonGroupMemberDialog(): void {
    this.showAddNonGroupMemberDialog = false;
    this.nonGroupMemberName = '';
  }

  addNonGroupMember(): void {
    if (!this.nonGroupMemberName.trim()) {
      return;
    }

    const capitalizedName = this.capitalizeFullName(this.nonGroupMemberName.trim());

    // Check if name already exists
    if (this.persons.some(p => p.name === capitalizedName)) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Duplicate Name',
        detail: 'A person with this name already exists'
      });
      return;
    }

    const newPerson: Person = {
      id: Date.now(),
      name: capitalizedName,
      totalAmount: 0,
      listOfAmounts: [],
      isNonGroupMember: true
    };

    this.persons.push(newPerson);
    this.persons = this.persons.sort((a, b) => a.name.localeCompare(b.name));
    this.updatePersonOptions();
    this.closeAddNonGroupMemberDialog();

    this.messageService.add({
      severity: 'success',
      summary: 'Person Added',
      detail: `${capitalizedName} has been added to the bill`
    });
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
    this.multiPersonItemPrice = undefined;
    this.multiPersonItemDiscount = undefined;
    this.selectedPersonsForItem = [];
    this.shouldDivideAmongSelected = true;
  }

  addMultiPersonItem(): void {
    if (!this.multiPersonItemPrice || this.multiPersonItemPrice <= 0 || !this.selectedPersonsForItem.length) {
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

  // Post to Splitwise
  showPostToSplitwise(): void {
    if (!this.selectedPayer) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Payer Required',
        detail: 'Please select who paid for this transaction'
      });
      return;
    }

    this.showDescriptionDialog = true;
    this.expenseDescription = '';
  }

  closeDescriptionDialog(): void {
    this.showDescriptionDialog = false;
    this.expenseDescription = '';
  }

  async postToSplitwise(): Promise<void> {
    if (!this.expenseDescription.trim()) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Description Required',
        detail: 'Please enter a description for the expense'
      });
      return;
    }

    // Check for non-group members
    const nonGroupMembers = this.persons.filter(p => p.isNonGroupMember);
    const groupMembers = this.persons.filter(p => !p.isNonGroupMember);

    // Show non-group member shares if any
    if (nonGroupMembers.length > 0) {
      this.nonGroupMemberShares = nonGroupMembers.map(p => ({
        name: p.name,
        amount: p.totalAmount
      }));
      this.showNonGroupMemberSharesDialog = true;
    }

    // Calculate total for group members only
    const groupMembersTotal = groupMembers.reduce((sum, person) => sum + person.totalAmount, 0);

    // Prepare expense data with flattened user parameters
    const expenseData: any = {
      cost: groupMembersTotal.toFixed(2),
      description: this.expenseDescription.trim(),
      currency_code: "PKR",
      group_id: this.selectedGroup!.id
    };

    // Add payer
    const payerPerson = groupMembers.find(p => p.splitwiseUserId === this.selectedPayer!.user_id || p.splitwiseUserId === this.selectedPayer!.id);

    let userIndex = 0;

    if (payerPerson) {
      expenseData[`users__${userIndex}__user_id`] = payerPerson.splitwiseUserId;
      expenseData[`users__${userIndex}__paid_share`] = groupMembersTotal.toFixed(2);
      expenseData[`users__${userIndex}__owed_share`] = payerPerson.totalAmount.toFixed(2);
      userIndex++;
    }

    // Add other group members
    groupMembers.forEach(person => {
      if (person.splitwiseUserId !== payerPerson?.splitwiseUserId) {
        expenseData[`users__${userIndex}__user_id`] = person.splitwiseUserId;
        expenseData[`users__${userIndex}__paid_share`] = "0.00";
        expenseData[`users__${userIndex}__owed_share`] = person.totalAmount.toFixed(2);
        userIndex++;
      }
    });

    // Post to Splitwise
    try {
      const headers = new HttpHeaders({
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      });

      const response = await this.http.post<ExpenseResponse>(
        `${this.splitwiseBaseUrl}/create-expense`,
        expenseData,
        {headers}
      ).toPromise();

      if (response && (!response.errors || Object.keys(response.errors).length === 0)) {
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: 'Expense posted to Splitwise successfully'
        });

      } else {
        console.error('Splitwise API error:', response?.errors);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to post expense to Splitwise'
        });
      }
    } catch (error) {
      console.error('Error posting to Splitwise:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to post expense to Splitwise'
      });
    }

    this.closeDescriptionDialog();
  }

  closeNonGroupMemberSharesDialog(): void {
    this.showNonGroupMemberSharesDialog = false;
    this.nonGroupMemberShares = [];
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
    this.isManualFlow = true;
    this.closeMultiPersonItemDialog();
    this.closeAddNonGroupMemberDialog();
    this.closeDescriptionDialog();
    this.closeNonGroupMemberSharesDialog();
  }

  updatePayerOptions(): void {
    if (!this.selectedGroup?.members) {
      this.payerOptions = [];
      return;
    }

    // Filter out non-group members from payer options
    const groupMemberIds = this.selectedGroupMembers.map(m => m.id);
    this.payerOptions = this.selectedGroup.members
      .filter(member => groupMemberIds.includes(member.id))
      .map(member => ({
        label: `${member.first_name} ${member.last_name}`.trim(),
        value: member,
        email: member.email
      }));
  }

  connectWithSpitWise() {
    this.router.navigate(['/callback'], {queryParams: {signin: 'true'}});
  }

  disconnectFromSplitwise(): void {
    localStorage.removeItem('splitwise_access_token');
    this.accessToken = null;
    this.isAuthenticated = false;
    this.splitwiseGroups = [];
    this.selectedGroup = null;
    this.selectedGroupMembers = [];
    this.selectedPayer = null;
    this.groupOptions = [];
    this.memberOptions = [];
    this.payerOptions = [];
    this.personOptions = [];
    this.resetEverything();
    this.messageService.add({
      severity: 'info',
      summary: 'Disconnected',
      detail: 'You have been disconnected from Splitwise'
    });
    this.router.navigate(["/"]);
  }

  private getApiBaseUrl(): string {
    // Check if running on Netlify Dev (port 8888) or production
    const isNetlifyDev = window.location.port === '8888';
    const isProduction = window.location.hostname !== 'localhost';

    if (isNetlifyDev || isProduction) {
      // Use Netlify Functions
      return '/.netlify/functions';
    } else {
      // Fallback for local development with ng serve
      // This won't work for API calls but prevents immediate errors
      console.warn('Running without Netlify Dev. API calls will fail. Use "netlify dev" instead of "ng serve"');
      return '/.netlify/functions';
    }
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

  private fetchSplitwiseGroups(): void {
    if (!this.accessToken) return;

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json'
    });

    // CHANGED: /api/get_groups to /.netlify/functions/get-groups
    this.http.get<ApiResponse>(`${this.splitwiseBaseUrl}/get-groups`, {headers})
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
      {label: 'No Group', value: null},
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
