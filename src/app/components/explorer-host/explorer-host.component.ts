import { Component } from '@angular/core';

/**
 * Shell component for the /explorer route.
 * The actual iframe lives persistently in AppComponent so the 3D state
 * is never destroyed when navigating between modules.
 */
@Component({
  selector: 'app-explorer-host',
  standalone: false,
  template: ''
})
export class ExplorerHostComponent {}
