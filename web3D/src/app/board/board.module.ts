import {NgModule} from '@angular/core';
import {BoardComponent} from './board.component';
import {SharedModule} from "../shared/shared.module";

@NgModule({
  imports: [
    SharedModule
  ],
  declarations: [BoardComponent]
})
export class BoardModule { }
