TSPC = (function(exports){
'use strict';

let BlockedFeatureMap = exports.elements.BlockedFeatureMap;
let SceneInitializer = exports.scene.SceneInitializer;
let ModelConfiguration = exports.configure.ModelConfiguration;

let ChannelDataGenerator = exports.utils.ChannelDataGenerator;
let ColorUtils = exports.utils.ColorUtils;

function Contrast(config) {
  this.center = config.center;
  this.neuralGroup = undefined;
  this.scene = undefined;
  this.model = undefined;
  this.color = config.color;
  this.layerType = config.layerType ? config.layerType : 'background';
  this.layerIndex = config.layerIndex;
  this.actualWidth = undefined;
  this.actualHeight = undefined;
  this.unitLength = config.unitLength;
  this.minOpacity = undefined;
  this.neuralValue = config.neuralValue;
}

Contrast.prototype = {
  loadModelConfig: function (modelConfig) {
    if (this.color === undefined) {
      this.color = modelConfig.color[this.layerType];
    }
    if (modelConfig.minOpacity !== undefined) {
      this.minOpacity = modelConfig.minOpacity;
    }
  },
  setEnvironment: function (scene, model) {
    this.scene = scene;
    this.model = model;
  },
  init: function (center) {

  },
  updateValue: function (value) {

  },
  clear: function () {

  },
  getBoundingWidth: function () {
    return 100;
  }
};

function Contrast1d(config) {
  Contrast.call(this, config);

  this.width = config.width;
}

Contrast1d.prototype = Object.assign(Object.create(Contrast.prototype), {

});

function Contrast3d(config) {
  Contrast.call(this, config);

  this.width = config.shape[0];
  this.height = config.shape[1];
  this.depth = config.shape[2];

  this.segregationHandlers = [];
  this.blocks = config.blocks;
}

Contrast3d.prototype = Object.assign(Object.create(Contrast.prototype), {
  init: function(center) {
    this.center = center;
    // this.actualDepth = actualDepth;

    this.actualWidth = this.width * this.unitLength;
    this.actualHeight = this.width * this.unitLength;

    this.neuralGroup = new THREE.Group();
    this.neuralGroup.position.set(this.center.x, this.center.y, this.center.z);

    this.initSegregationElements();
  },
  initSegregationElements: function() {
    let gap = 60;
    let allWidth = this.actualWidth * this.depth + gap * (this.depth - 1);
    for (let i = 0; i < this.depth; i++) {
      let center = [0, 0, 0];
      center[0] = this.center[0] - allWidth / 2 + this.actualWidth * i + this.gap * i;
      center[1] = this.center[1] - this.actualHeight / 2;
      center[2] = this.center[2];
      let segregationHandler = new BlockedFeatureMap(
        this.width,
        this.height,
        this.unitLength,
        center,
        this.color,
        this.minOpacity,
        this.blocks[i]
      );
      segregationHandler.setLayerIndex(this.layerIndex);
      segregationHandler.setFmIndex(i);
      this.segregationHandlers.push(segregationHandler);
      this.neuralGroup.add(segregationHandler.getElement());
    }
    if (this.neuralValue !== undefined) {
      this.updateSegregationVis();
      this.scene.add(this.neuralGroup);
    }
  },
  updateSegregationVis: function() {
    let layerOutputValues = ChannelDataGenerator.generateChannelData(this.neuralValue, this.depth);
    let featureMapSize = this.width * this.height;
    for (let i = 0; i < this.depth; i++) {
      let colors = ColorUtils.getAdjustValues(
        layerOutputValues.slice(i * featureMapSize, (i + 1) * featureMapSize),
        this.minOpacity
      );
      this.segregationHandlers[i].updateVis(colors);
    }
  },
  clear: function() {
    if (this.neuralValue !== undefined) {
      for (let i = 0; i < this.segregationHandlers.length; i++) {
        this.segregationHandlers[i].clear();
      }
    }
    this.neuralValue = undefined;
  }
});

function CompareSceneInitializer(container, config) {
  this.container = container;

  this.scene = undefined;
  this.sceneArea = undefined;
  this.camera = undefined;
  this.renderer = undefined;

  this.backgroundColor = undefined;

  this.startCenter = [0, 0, 0];
  this.featureContrasts = [];

  this.configuration = new ModelConfiguration(config);

  this.loadSceneConfig(this.configuration);
  this.createScene();
}

CompareSceneInitializer.prototype = {
  loadSceneConfig: function(config) {
    this.backgroundColor = config.color.background;
  },
  createScene: function() {
    let sceneArea = document.createElement('canvas');
    this.sceneArea = sceneArea;

    sceneArea.width = this.container.clientWidth;
    sceneArea.height = this.container.clientHeight;
    sceneArea.style.backgroundColor = this.backgroundColor;

    this.renderer = new THREE.WebGLRenderer({
      canvas: sceneArea,
      antialias: true
    });

    this.renderer.setSize(sceneArea.width, sceneArea.height);
    this.container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera();
    this.camera.fov = 45;
		this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
		this.camera.near = 0.1;
		this.camera.far = 10000;

		this.camera.updateProjectionMatrix();
		this.camera.name = 'defaultCamera';

		this.scene = new THREE.Scene();
		this.scene.background = new THREE.Color( this.backgroundColor );
  },
  add: function(contrast) {
    contrast.loadModelConfig(this.configuration);
    contrast.setEnvironment(this.scene, this);
    this.featureContrasts.push(contrast);
  },
  init: function() {
    for (let i = 0; i < this.featureContrasts.length; i++) {
      let center = Object.assign(this.startCenter);
      center[2] += 100;
      this.featureContrasts[i].init(center);
    }
    this.render();
  },
  render: function() {
    this.renderer.render(this.scene, this.camera);
  }
};

let new_exports = {};
new_exports.CompareSceneInitializer = CompareSceneInitializer;
new_exports.Contrast3d = Contrast3d;

return new_exports;

}(TSP));
