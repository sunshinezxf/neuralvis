TSP = (function (exports) {
'use strict';

let extension_version = '0.0.1';

let FeatureMap = exports.elements.FeatureMap;

let Conv2d = exports.layers.Conv2d;
let Pooling2d = exports.layers.Pooling2d;

let Sequential = exports.models.Sequential;

let RenderPreprocessor = exports.utils.RenderPreprocessor;

function BlockedFeatureMap(width, height, unitLength, initCenter, color, minOpacity, blocked) {

  // Set blocked related
  this.blockedRatio = 0.2;
  this.blocked = blocked;
  this.basicDataArray = undefined;

  FeatureMap.call(this, width, height, unitLength, initCenter, color, minOpacity);

}

BlockedFeatureMap.prototype = Object.assign( Object.create( FeatureMap.prototype ), {
  init: function() {
		let amount = this.fmWidth * this.fmHeight;
		let basicData = new Uint8Array( amount );
		let data = new Uint8Array( amount );

		this.basicDataArray = basicData;
		this.dataArray = data;

		for ( let i = 0; i < amount; i++ ) {
		  basicData[i] = 255 * this.minOpacity;
		  if (!this.blocked) {
        data[ i ] = 255 * this.minOpacity;
      } else {
		    data[ i ] = 255 * this.minOpacity * this.blockedRatio;
      }
		}

		let dataTex = new THREE.DataTexture( data, this.fmWidth, this.fmHeight, THREE.LuminanceFormat, THREE.UnsignedByteType );
		this.dataTexture = dataTex;

		dataTex.magFilter = THREE.NearestFilter;
		dataTex.needsUpdate = true;

		let boxGeometry = new THREE.BoxBufferGeometry( this.actualWidth, this.unitLength, this.actualHeight );
		let material = new THREE.MeshBasicMaterial( {
			color: this.color,
			alphaMap: dataTex,
			transparent: true
		} );
		let basicMaterial = new THREE.MeshBasicMaterial( {
			color: this.color,
			transparent: true,
			opacity: this.sideOpacity
		} );
		let materials = [
			basicMaterial,
			basicMaterial,
			material,
			material,
			basicMaterial,
			basicMaterial
		];
		let cube = new THREE.Mesh( boxGeometry, materials );
		cube.elementType = 'featureMap';
		cube.hoverable = true;
		cube.clickable = true;
		this.featureMap = cube;
		let featureGroup = new THREE.Object3D();
		featureGroup.position.set( this.fmCenter.x, this.fmCenter.y, this.fmCenter.z );
		featureGroup.add( cube );
		this.featureGroup = featureGroup;
	},
  getBlocked: function() {
	  return this.blocked;
  },
  updateVis: function( colors ) {
    if (colors) {
      let  renderColor = RenderPreprocessor.preProcessFmColor( colors, this.fmWidth, this.fmHeight );
      for ( let i = 0; i < renderColor.length; i++ ) {
        this.basicDataArray[i] = renderColor[i] * 255;
        // 处理被block的显示
        if (!this.getBlocked()) {
          this.dataArray[i] = renderColor[i] * 255;
        } else {
          this.dataArray[i] = renderColor[i] * 255 * this.blockedRatio;
        }
      }
    } else {
      for ( let i = 0; i < this.basicDataArray.length; i++ ) {
        if (!this.getBlocked()) {
          this.dataArray[i] = this.basicDataArray[i];
        } else {
          this.dataArray[i] = this.basicDataArray[i] * this.blockedRatio;
        }
      }
    }
    this.dataTexture.needsUpdate = true;
	},
} );

let initFunc = function(center, actualDepth) {
  this.center = center;
  this.actualDepth = actualDepth;

  this.neuralGroup = new THREE.Group();
  this.neuralGroup.position.set( this.center.x, this.center.y, this.center.z );

  // 额外添加block数组，保存被block的信息
  this.blocks = [];
  for (let i = 0; i < actualDepth; i++) {
    this.blocks.push(false);
  }

  if ( this.depth === 1 ) {
    this.isOpen = true;
    this.closeable = false;
    this.initSegregationElements( this.openFmCenters );
  } else {
    if ( this.isOpen ) {
      this.initSegregationElements( this.openFmCenters );
      this.initCloseButton();
    } else {
      this.initAggregationElement();
    }
  }
  // Add wrapper object to THREE.js scene.
  this.scene.add( this.neuralGroup );
  // Create relative line element.
  this.addLineGroup();
};

let initSegregationElements = function( centers ) {
  for ( let i = 0; i < this.depth; i ++ ) {
    let segregationHandler = new BlockedFeatureMap(
      this.width,
      this.height,
      this.unitLength,
      centers[ i ],
      this.color,
      this.minOpacity,
      this.blocks[i]
    );
    segregationHandler.setLayerIndex( this.layerIndex );
    segregationHandler.setFmIndex( i );
    this.segregationHandlers.push( segregationHandler );
    this.neuralGroup.add( segregationHandler.getElement() );
  }
  if ( this.neuralValue !== undefined ) {
    this.updateSegregationVis();
  }
};

let blockFeatureMap = function( index ) {
  this.blocks[index] = !this.blocks[index];
  if (this.isOpen) {
    let clickedFm = this.segregationHandlers[index];
    clickedFm.blocked = !clickedFm.blocked;
    if (this.blockCallback) {
      this.blockCallback(this);
    }
    clickedFm.updateVis();
  }
};

let handleClick = function( clickedElement ) {
  if ( clickedElement.elementType === "aggregationElement" ) {
    this.openLayer();
  } else if ( clickedElement.elementType === "closeButton" ) {
    this.closeLayer();
  } else if ( clickedElement.elementType === 'featureMap' ) {
    this.blockFeatureMap(clickedElement.fmIndex);
  }
};

let setBlockCallback = function( callback ) {
  this.blockCallback = callback;
};

Conv2d.prototype = Object.assign( Object.create( Conv2d.prototype ), {
  init: initFunc,
  initSegregationElements: initSegregationElements ,
  handleClick: handleClick,
  blockFeatureMap: blockFeatureMap,
  setBlockCallback: setBlockCallback
} );
Pooling2d.prototype = Object.assign( Object.create( Pooling2d.prototype ), {
  init: initFunc,
  initSegregationElements: initSegregationElements,
  handleClick: handleClick,
  blockFeatureMap: blockFeatureMap,
  setBlockCallback: setBlockCallback
} );

Sequential.prototype = Object.assign( Object.create( Sequential.prototype ),  {
  show: function(activationValue) {
    // activationValue 包括input value
    for (let i = 0; i < activationValue.length; i++) {
      if (i === 0) {
        this.layers[i].updateValue(activationValue[i]);
      } else {
        if (!this.layers[i].autoOutputDetect) {
          this.layers[i].updateValue(activationValue[i]);
        }
      }
    }
  }
} );

let KerasLayerFactory = Object.create({
  getInstance: function(layerConfig, preLayerConfig) {
    // console.log(layerConfig);
    if (layerConfig['class_name'] === 'Input' || layerConfig['class_name'] === 'InputLayer') {
      const shape = layerConfig['config']['batch_input_shape'];
      if (shape.length === 1) {
        return new exports.layers.Input1d({ name: 'input', shape: shape });
      } else if (shape.length === 3) {
        if (shape[2] === 1) {
          return new exports.layers.GreyscaleInput({ name: 'input', shape: shape });
        } else if (shape[2] === 3) {
          return new exports.layers.RGBInput({ name: 'input', shape: shape });
        } else {
          console.log('Not supported yet!');
          return null;
        }
      } else {
        console.log('Not supported yet!');
        return null;
      }
    } else if (layerConfig['class_name'] === 'Dense') {
      const name = layerConfig['config']['name'];
      const units = layerConfig['config']['units'];
      return new exports.layers.Dense({ name: name, units: units });
    } else if (layerConfig['class_name'] === 'Conv2D') {
      const name = layerConfig['config']['name'];
      const kernelSize = layerConfig['config']['kernel_size'];
      const filters = layerConfig['config']['filters'];
      const strides = layerConfig['config']['strides'];
      const padding = layerConfig['config']['padding'];
      return new exports.layers.Conv2d({ name: name, kernelSize: kernelSize, filters: filters, strides: strides, padding: padding });
    } else if (layerConfig['class_name'] === 'MaxPooling2D') {
      const name = layerConfig['config']['name'];
      const poolSize = layerConfig['config']['pool_size'];
      const strides = layerConfig['config']['strides'];
      const padding = layerConfig['config']['padding'];
      return new exports.layers.Pooling2d({ name: name, poolSize: poolSize, strides: strides, padding: padding });
    } else if (layerConfig['class_name'] === 'Flatten') {
      const name = layerConfig['config']['name'];
      return new exports.layers.Flatten({ name: name });
    } else if (layerConfig['class_name'] === 'Activation') {
      const name = layerConfig['config']['name'];
      const activation = layerConfig['config']['activation'];
      const type = preLayerConfig['class_name'];
      if (type === 'Dense' || type === 'Activation') {
        return new exports.layers.Activation1d({ name: name, activation: activation });
      } else if (type === 'Conv2D' || type === 'MaxPooling2D') {
        return new exports.layers.Activation3d({ name: name, activation: activation });
      } else {
        return null;
      }
    } else {
      console.log('Not supported yet!');
      return null;
    }
  }
});

exports.elements.BlockedFeatureMap = BlockedFeatureMap;
exports.utils.KerasLayerFactory = KerasLayerFactory;

exports.extension_version = extension_version;

return exports;
}(TSP));
