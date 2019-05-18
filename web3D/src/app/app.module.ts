import {NgModule} from '@angular/core';

import {AppComponent} from './app.component';
import {NZ_I18N, zh_CN} from 'ng-zorro-antd';
import {AppRoutingModule} from './app-routing.module';
import {SharedModule} from "./shared/shared.module";
import {BoardModule} from "./board/board.module";

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    SharedModule,
    AppRoutingModule,
    BoardModule
  ],
  bootstrap: [AppComponent],
  /** 配置 ng-zorro-antd 国际化 **/
  providers: [ { provide: NZ_I18N, useValue: zh_CN } ]
})
export class AppModule { }
