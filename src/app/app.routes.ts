import { Routes } from '@angular/router';
import {HomeComponent} from './components/home/home.component';
import {AboutComponent} from './components/about/about.component';
import {CallbackComponent} from './components/callback/callback.component';

export const routes: Routes = [
  {
    path: '',
    component:HomeComponent
  },
  {
    path:'about',
    component:AboutComponent
  },
  {
    path:'callback',
    component:CallbackComponent
  }
];
