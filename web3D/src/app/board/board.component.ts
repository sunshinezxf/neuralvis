import {AfterViewInit, Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import {NzMessageService, UploadXHRArgs} from "ng-zorro-antd";
import {environment} from "../../environments/environment";
import {HttpClient, HttpErrorResponse, HttpEvent, HttpEventType, HttpRequest} from "@angular/common/http";
import SignaturePad from "signature_pad";
import {forkJoin} from "rxjs";

declare var TSP;
declare var CP;

@Component({
  selector: 'app-board',
  templateUrl: './board.component.html',
  styleUrls: ['./board.component.less']
})
export class BoardComponent implements OnInit, AfterViewInit {

  @ViewChild('computeGraph')
  computeGraphRef: ElementRef;
  @ViewChild('compareBoard')
  compareBoardRef: ElementRef;
  @ViewChild('sketchpad')
  sketchpad: SignaturePad;

  computeGraph: HTMLElement;
  compareBoard: HTMLElement;

  sketchpadOptions = {
    minWidth: 5,
    maxWidth: 15,
    canvasWidth: 280,
    canvasHeight: 280,
    backgroundColor: 'rgb(0, 0, 0)',
    penColor: 'rgb(255, 255, 255)'
  };

  modelUploadedList = [];
  modelUploadedListTest = [];
  imageUploadedList = [];

  selectedModel: any;
  TSModelInstance: any;
  selectedImages = [];

  actionType = 0;
  compareState = false;
  compareReverse = null;

  hiddenConfig = [];

  // Compare
  selectedLayer: any;
  selectedLayerOptions: any[];
  contrastLandInstance: any;

  // Adversarial
  selectedAttack: any;

  // loading
  isLoading = false;

  constructor(
    private http: HttpClient,
    private message: NzMessageService
  ) { }

  ngOnInit() {
  }

  ngAfterViewInit(): void {
    this.computeGraph = this.computeGraphRef.nativeElement;
    this.compareBoard = this.compareBoardRef.nativeElement;
    // this.initTensorSpace();
    // this.initCompare();

    this.getModels();
    this.getImages();
  }

  run(): void {
    // this.compare();
    if (!this.selectedModel) {
      this.message.error('Please select a model!');
      return;
    }
    if (this.selectedImages.length === 0) {
      this.message.error('Please at least one image!');
      return;
    }

    this.isLoading = true;
    const url = `${environment.base_url}/api/model/tensorspace/info`;
    this.http.post(url, {
      model: this.selectedModel.modelName,
      image: this.selectedImages[0].imageName,
      hidden_config: this.hiddenConfig
    }, {
      withCredentials: true
    })
    .subscribe(res => {
      const data: any[] = res['data'];
      // console.log(data);
      const layers = this.TSModelInstance.getAllLayers();
      for (let i = 0; i < layers.length; i++) {
        layers[i].updateValue(data[i]['data']);
      }
    }, (error: HttpErrorResponse) => {
      this.handleError(error);
    }, () => {
      this.isLoading = false;
    });
  }

  initTensorSpaceModel(layers: any[]): void {
    this.computeGraph.innerHTML = '';
    // console.log(layers);
    this.TSModelInstance = new TSP.models.Sequential(this.computeGraph);
    for (let i = 0; i < layers.length; i++) {
      if (layers[i]['class_name'] === 'Dropout') {
        continue;
      }
      const layer = TSP.utils.KerasLayerFactory.getInstance(layers[i], i == 0 ? null : layers[i - 1]);
      this.TSModelInstance.add(layer);
      if (layers[i]['class_name'] === 'Conv2D' || layers[i]['class_name'] === 'MaxPooling2D') {
        layer.setBlockCallback(this.blockCallback);
      }
    }
    this.TSModelInstance.load({
      type: 'tfjs',
      url: `${environment.base_url}/api/tensorspace/model/info?model=${this.selectedModel['modelName']}`,
      onComplete: function() {
        console.log('success');
      }
    });
    this.TSModelInstance.init();
  }

  blockCallback = (layer) => {
    const newHiddens = [];
    for (let i = 0; i < this.hiddenConfig.length; i++) {
      if (this.hiddenConfig[i].layer_name !== layer.name) {
        newHiddens.push(this.hiddenConfig[i]);
      }
    }
    for (let i = 0; i < layer.blocks.length; i++) {
      if (layer.blocks[i]) {
        newHiddens.push({
          layer_name: layer.name,
          feature_index: i
        })
      }
    }
    this.hiddenConfig = newHiddens;
    if (!this.compareState) {
      this.run();
    } else {
      this.startCompare();
    }
  };

  compare(): void {
    if (!this.selectedModel || !this.TSModelInstance) {
      this.message.error('Please select a model!');
      return;
    }
    if (this.selectedImages.length !== 2) {
      this.message.error('Please two images!');
      return;
    }

    this.compareState = true;
    this.compareReverse = false;

    this.TSModelInstance.reset();
    this.selectedLayerOptions = [];
    const layers = this.TSModelInstance.getAllLayers();
    for (let i = 1; i < layers.length; i++) {
      this.selectedLayerOptions.push(layers[i]);
    }
    // console.log(this.selectedLayerOptions);
  }

  startCompare(): void {
    this.isLoading = true;
    const url = `${environment.base_url}/api/tensorspace/images/compare`;
    this.http.post(url, {
      model: this.selectedModel.modelName,
      images: this.selectedImages.map(function(item) {
        return item.imageName;
      }),
      layer: this.selectedLayer.name,
      hidden_config: this.hiddenConfig
    })
    .subscribe(res => {
      // console.log(res);
      this.initContrast(this.selectedLayer, res['data']);
    }, (error: HttpErrorResponse) => {
      this.handleError(error);
    }, () => {
      this.isLoading = false;
    });
  }

  initContrast(layer: any, contrasts: any[]): void {
    this.compareBoard.innerHTML = '';
    this.contrastLandInstance = new CP.ContrastSceneInitializer(this.compareBoard);
    for (let i = 0; i < contrasts.length; i++) {
      this.contrastLandInstance.add(CP.ContrastFactory.getInstance(layer, this.selectedImages[i].imageName));
    }
    this.contrastLandInstance.updateVis(contrasts.map(function(item) {
      return item[0]['data'];
    }));
  }

  generateAdv(): void {
    if (!this.selectedAttack) {
      this.message.error('You should select an attack function!');
      return;
    }
    if (this.selectedImages.length !== 1) {
      this.message.error('You should choose only one image!');
      return;
    }
    if (!this.selectedModel) {
      this.message.error('You should choose a model!');
      return;
    }
    const url = `${environment.base_url}/api/model/adversarial`;
    this.http.post(url, {
      model_name: this.selectedModel.modelName,
      image: this.selectedImages[0].imageName,
      attack_method: this.selectedAttack
    })
    .subscribe(res => {
      this.handleSuccess('Upload Success!');
      const image = {
          imageName: res['data']['image'],
          name: res['data']['image'],
          status: 'done',
          selected: false,
          imageB64: ''
        };
      this.imageUploadedList.push(image);
      this.getImage(image);
    }, (error: HttpErrorResponse) => {
      this.handleError(error);
    });
  }

  selectModel(item: any): void {
    // console.log(item);
    if (item.status !== 'done') {
      return;
    }
    if (this.compareState) {
      this.message.warning('Please exit the compare mode!');
      return;
    }
    if (this.selectedModel) {
      this.selectedModel.selected = false;
    }
    item.selected = true;
    this.selectedModel = item;

    this.isLoading = true;
    const url = `${environment.base_url}/api/model/info?model=${this.selectedModel['modelName']}`;
    this.http.get(url, {
      withCredentials: true
    })
    .subscribe((res: any) => {
      // console.log(res);
      let data: any[] = res['data']['config']['layers'];
      if (data === undefined) {
        data = res['data']['config'];
      }
      // console.log(data);
      const inputShape = data[0]['config']['batch_input_shape'];
      inputShape.shift();
      const inputLayer = {
        class_name: 'Input',
        config: {
          batch_input_shape: inputShape
        }
      };
      data.unshift(inputLayer);
      // console.log(data);

      this.initTensorSpaceModel(data);
      this.hiddenConfig = [];
    }, (error) => {
      this.handleError(error);
    }, () => {
      this.isLoading = false;
    });
  }

  selectImages(item: any): void {
    if (item.status !== 'done') {
      return;
    }
    if (!item.selected) {
      if (this.selectedImages.length >= 2) {
        const preItem = this.selectedImages.shift();
        preItem.selected = false;
      }
      this.selectedImages.push(item);
      item.selected = true;
    } else {
      let index = -1;
      for (let i = 0; i < this.selectedImages.length; i++) {
        if (this.selectedImages[i] === item) {
          index = i;
          break;
        }
      }
      if (index !== -1) {
        this.selectedImages.splice(index, 1);
      }
      item.selected = false;
    }
    if (this.selectedImages.length >= 2) {
      this.actionType = 1;
      // this.compareState = true;
      // this.compareReverse = false;
    } else {
      this.actionType = 0;
      this.compareState = false;
      this.compareBoard.innerHTML = '';
      if (this.compareReverse != null) {
        if (this.compareReverse == true) {
          this.compareReverse = null;
        } else {
          this.compareReverse = true;
        }
      }
    }
  }

  getModels(): void {
    const url = `${environment.base_url}/api/models`;
    this.http.get(url, {
      withCredentials: true
    })
    .subscribe((res: any) => {
      const data: any[] = res['data'];
      this.modelUploadedList = data.map((item) => {
        return {
          modelName: item,
          name: item,
          status: 'done',
          selected: false
        };
      });
    }, (error: HttpErrorResponse) => {
      this.handleError(error);
    });
  }

  getImages(): void {
    const url = `${environment.base_url}/api/images`;
    this.http.get(url, {
      withCredentials: true
    })
    .subscribe((res: any) => {
      const data: any[] = res['data'];
      this.imageUploadedList = data.map((item) => {
        // this.getImage()
        return {
          imageName: item,
          name: item,
          status: 'done',
          selected: false,
          imageB64: ''
        }
      });
      this.imageUploadedList.forEach((item) => {
        this.getImage(item);
      });
    });
  }

  getImage(image): void {
    const url = `${environment.base_url}/api/image?image=${image['imageName']}`;
    this.http.get(url, {
      withCredentials: true
    })
    .subscribe((res: any) => {
      let data: string = res['data'];
      data = data.substring(2, data.length - 1);
      image['imageB64'] = 'data:image/jpg;base64,' + data;
    });
  }

  modelUpload = (item: UploadXHRArgs) => {
    const url = `${environment.base_url}/api/model/upload`;
    const formData = new FormData();
    formData.append('model', item.file as any);
    return this.http.post(url, formData, {
      reportProgress: true,
      withCredentials: true
    })
    .subscribe((event: HttpEvent<{}>) => {
      if (event.type === HttpEventType.UploadProgress) {
        if (event.total > 0) {
          (event as any).percent = event.loaded / event.total * 100;
        }
        item.onProgress(event, item.file);
      } else if (event) {
        this.handleSuccess('Upload Success!');
        const length = this.modelUploadedList.length;
        const lastModelFile = this.modelUploadedList[length - 1];
        lastModelFile['name'] = event['data'];
        item.onSuccess(event, item.file, event);
        lastModelFile['modelName'] = event['data'];
      }
    }, (error: HttpErrorResponse) => {
      this.handleError(error);
      item.onError(error, item.file);
      this.modelUploadedList.pop();
    });
  };

  customBigReq = (item: UploadXHRArgs) => {
    const url = `${environment.base_url}/api/model/upload/slice`;
    const size = item.file.size;
    const chunkSize = parseInt((size / 3) + '', 10);
    const maxChunk = Math.ceil(size / chunkSize);
    const uuid = guid();
    // console.log(uuid);
    let filename = item.file.name;
    filename = filename.replace(/\\/g, "");
    const reqs = Array(maxChunk).fill(0).map((v: {}, index: number) => {
      const start = index * chunkSize;
      let end = start + chunkSize;
      if (size - end < 0) {
        end = size;
      }
      const formData = new FormData();
      formData.append('filename', filename);
      formData.append('model', item.file.slice(start, end));
      formData.append('start', start.toString());
      formData.append('end', end.toString());
      formData.append('task_id', uuid);
      const req = new HttpRequest('POST', url, formData, {
        withCredentials: true
      });
      return this.http.request(req);
    });
    return forkJoin(...reqs).subscribe(results => {
      // 处理成功
      const ress = results.map((i) => {
        return i.body;
      });
      let datas = ress.map((i) => {
        return i.data;
      });
      datas = datas.sort((a, b) => {
        return a.start - b.start;
      });
      const successUrl = `${environment.base_url}/api/model/upload/success`;
      this.http.post(successUrl, {
        filename: filename,
        task_id: uuid,
        slices: datas.map((i) => { return i.slice_name; })
      }, {
        withCredentials: true
      })
      .subscribe(res => {
        this.handleSuccess('Upload Success!');
        const length = this.modelUploadedList.length;
        const lastModelFile = this.modelUploadedList[length - 1];
        lastModelFile['name'] = res['data'];
        item.onSuccess(res, item.file, res);
        lastModelFile['modelName'] = res['data'];
      }, (error) => {
        this.handleError(error);
        // item.onError(error, item.file);
        this.modelUploadedList.pop();
      });
    }, (error) => {
      // 处理失败
      this.handleError(error);
      // item.onError(error, item.file);
      this.modelUploadedList.pop();
    });
  };

  imageUpload = (item: UploadXHRArgs) => {
    const url = `${environment.base_url}/api/image/upload`;
    const formData = new FormData();
    formData.append('image', item.file as any);
    return this.http.post(url, formData, {
      reportProgress: true,
      withCredentials: true
    })
    .subscribe((event: HttpEvent<{}>) => {
      if (event.type === HttpEventType.UploadProgress) {
        if (event.total > 0) {
          (event as any).percent = event.loaded / event.total * 100;
        }
        item.onProgress(event, item.file);
      } else {
        this.handleSuccess('Upload Success!');
        const length = this.imageUploadedList.length;
        const lastImageFile = this.imageUploadedList[length - 1];
        lastImageFile['name'] = event['data']['image'];
        item.onSuccess(event, item.file, event);
        lastImageFile['imageName'] = event['data']['image'];
        this.getImage(lastImageFile);
      }
    }, (error: HttpErrorResponse) => {
      this.handleError(error);
      item.onError(error, item.file);
      this.imageUploadedList.pop();
    });
  };

  sketchpadImageUpload(data): void {
    const url = `${environment.base_url}/api/image/sketchpad/upload`;
    this.http.post(url, {
      image: data
    }, {
      withCredentials: true
    })
    .subscribe(res => {
      this.handleSuccess('Upload Success!');
      const image = {
          imageName: res['data']['image'],
          name: res['data']['image'],
          status: 'done',
          selected: false,
          imageB64: ''
        };
      this.imageUploadedList.push(image);
      this.getImage(image);

      // 直接运行
      for (let i = 0; i < this.selectedImages.length; i++) {
        this.selectedImages[i].selected = false;
      }
      this.selectedImages = [image];
      image.selected = true;
    }, (error: HttpErrorResponse) => {
      this.handleError(error);
    })
  }

  getSketchpadImage(): void {
    let data = this.sketchpad.toDataURL('image/jpeg');
    data = data.substring(data.indexOf(',') + 1);
    this.sketchpadImageUpload(data);
  }

  clearSketchpad(): void {
    this.sketchpad.clear();
  }

  private handleError(error: HttpErrorResponse): void {
    if (error.error && error.error['message']) {
      this.message.error(error.error['message']);
    } else {
      this.message.error(error.message);
    }
  }

  private handleSuccess(message): void {
    this.message.success(message);
  }

}

function S4() {
    return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
}
function guid() {
    return (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4()+S4());
}
