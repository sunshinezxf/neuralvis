import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {BrowserModule} from "@angular/platform-browser";
import {FormsModule} from "@angular/forms";
import {HttpClientModule} from "@angular/common/http";
import {BrowserAnimationsModule} from "@angular/platform-browser/animations";
import {RouterModule} from "@angular/router";
import {NgZorroAntdModule} from 'ng-zorro-antd';
import {FileUploadModule} from 'ng2-file-upload';
import {SignaturePadModule} from "angular2-signaturepad";

const MODULES = [
  CommonModule,
  BrowserModule,
  FormsModule,
  HttpClientModule,
  BrowserAnimationsModule,
  RouterModule,
  FileUploadModule
];
const THIRD_MODULES = [
  NgZorroAntdModule,
  SignaturePadModule
];
const COMPONENTS = [
];
const DIRECTIVES = [];

@NgModule({
  imports: [
    ...MODULES,
    ...THIRD_MODULES
  ],
  declarations: [
    ...COMPONENTS,
    ...DIRECTIVES
  ],
  exports: [
    ...MODULES,
    ...THIRD_MODULES,
    ...COMPONENTS,
    ...DIRECTIVES
  ]
})
export class SharedModule { }
