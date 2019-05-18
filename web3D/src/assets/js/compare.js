let CP = (function(TSP) {
'use strict';

let RenderPreprocessor = TSP.utils.RenderPreprocessor;
let ChannelDataGenerator = TSP.utils.ChannelDataGenerator;
let ColorUtils = TSP.utils.ColorUtils;

function ContrastConfiguration() {
  this.margin = { top: 50, right: 50, bottom: 50, left: 50 };
  this.unitLength = 10;
  this.minWidth = 300;
  this.minHeight = 300;

  this.contrastGap = 50;
  this.minOpacity = 0.4;

  this.colors = {
    background: '#111111',
		Input1d: '#EEEEEE',
		GreyscaleInput: '#EEEEEE',
		RGBInput: '#EEEEEE',
		Conv1d: '#F7FE2E',
		Conv2d: '#F7FE2E',
		Pooling1d: '#00ffff',
		Pooling2d: '#00ffff',
		Dense: '#00ff00',
		Output1d: '#EEEEEE',
		Output2d: '#EEEEEE',
		Flatten: '#dfe2fe',
		Reshape: '#a287f4',
  };

  return this;
}
function getTranslate(transform) {
  if (!transform) {
    return [0, 0];
  }
  const arr = transform.substring(transform.indexOf('(') + 1, transform.indexOf(')')).split(',');
  return [+arr[0], +arr[1]];
}
function ContrastSceneInitializer(container) {
  this.container = container;
  this.svg = undefined;
  this.contrasts = [];

  this.configuration = new ContrastConfiguration();
  this.margin = this.configuration.margin;
  this.contrastGap = this.configuration.contrastGap;

  this.init();
}
ContrastSceneInitializer.prototype = {
  init: function() {
    let itemDx = 0;
    let itemDy = 0;
    let dragElem = null;
    this.svg = d3.select(this.container).append('svg');
    this.svg
      .style('width', this.container.clientWidth)
      .style('height', this.configuration.minHeight)
      .style('background-color', this.configuration.colors.background)
      .call(d3.drag()
        .on('start', function() {
          const transform = d3.select(this).attr('transform');
          const translate = getTranslate(transform);
          itemDx = d3.event.x - translate[0];
          itemDy = d3.event.y - translate[1];
          dragElem = d3.select(this);
        })
        .on('drag', (d, i) => {
          dragElem.attr('transform', `translate(${d3.event.x - itemDx}, ${d3.event.y - itemDy})`);
      }));

    this.resize();
  },
  add: function(contrast) {
    contrast.loadConfig(this.configuration);
    contrast.setEnvironment(this.svg, this);
    if (this.contrasts.length === 0) {
      contrast.init([this.margin.left, this.margin.top]);
    } else {
      let lastContrasts = this.contrasts[this.contrasts.length - 1];
      let position = lastContrasts.getPosition().map(function(i) {
        return i;
      });
      let actualShape = lastContrasts.getActualShape().map(function(i) {
        return i;
      });
      contrast.init([this.margin.left, position[1] + actualShape[1] + this.contrastGap]);
    }
    this.contrasts.push(contrast);
    this.resize();
  },
  updateVis: function(neuralValues) {
    for (let i = 0; i < neuralValues.length; i++) {
      this.contrasts[i].updateVis(neuralValues[i]);
    }
  },
  getAllContrasts: function() {
    return this.contrasts;
  },
  resize: function() {
    let maxWidth = this.svg.style('width');
    let maxHeight = this.svg.style('height');
    maxWidth = parseInt(maxWidth.substring(0, maxWidth.length - 2));
    maxHeight = parseInt(maxHeight.substring(0, maxHeight.length - 2));
    for (let i = 0; i < this.contrasts.length; i++) {
      let tw = this.contrasts[i].actualWidth + this.margin.left + this.margin.right;
      if (maxWidth < tw) {
        maxWidth = tw;
      }
      let th = this.contrasts[i].actualHeight + this.contrasts[i].position[1] + this.margin.bottom;
      if (maxHeight < th) {
        maxHeight = th;
      }
    }

    this.svg
      .style('width', `${maxWidth}px`)
      .style('height', `${maxHeight}px`);
  }
};
function Contrast(config) {
  this.svg = undefined;
  this.initializer = undefined;

  this.neuralGroup = undefined;

  this.position = [0, 0];
  this.actualWidth = undefined;
  this.actualHeight = undefined;

  this.unitLength = undefined;
  this.minOpacity = undefined;
  this.color = undefined;

  this.shape = config.shape;
  this.layerType = config.layerType;

  this.neuralValue = undefined;

  this.imageName = config.imageName;
  this.nameGap = 20;
}
Contrast.prototype = {
  loadConfig: function(config) {
    if (config.unitLength !== undefined) {
      this.unitLength = config.unitLength;
    }
    if (config.minOpacity !== undefined) {
      this.minOpacity = config.minOpacity;
    }
    this.color = config.colors[this.layerType];
  },
  init: function(position) {
    this.neuralGroup = this.svg.append('g');
    this.position = position;
    this.neuralGroup.attr('transform', `translate(${position[0]}, ${position[1]})`);
    this.neuralGroup.append('text')
      .attr('transform', 'translate(0, 0)')
      .attr('fill', 'white')
      .attr('stroke', 'white')
      .text(this.imageName);

    this.initExtensions();
  },
  initExtensions: function() {

  },
  getPosition: function() {
    return this.position;
  },
  getActualShape: function() {
    return [this.actualWidth, this.actualHeight];
  },
  updateVis: function(neuralValue) {

  },
  setEnvironment(svg, initializer) {
    this.svg = svg;
    this.initializer = initializer;
  },
  clear: function() {
    // this.neuralGroup.remove();
  }
};
function Contrast1d(config) {
  Contrast.call(this, config);
}
Contrast1d.prototype = Object.assign(Object.create(Contrast.prototype), {
  initExtensions: function() {
    this.actualWidth = this.shape[0] * this.unitLength;
    this.actualHeight = 1 * this.unitLength;
  },
  updateVis: function(neuralValue) {
    this.neuralValue = neuralValue;
    this.clear();
    this.updateQueueVis();
  },
  updateQueueVis: function() {
    let colors = ColorUtils.getAdjustValues(this.neuralValue, this.minOpacity);
    this.neuralGroup.selectAll('rect')
      .data(colors)
      .enter()
      .append('rect')
      .attr('width', this.unitLength)
      .attr('height', this.unitLength)
      .attr('fill', this.color)
      .attr('opacity', (d, i) => {
        if (this.blocked) {
          return colors[i] * 0.2;
        }
        return colors[i];
      })
      .attr('stroke-width', 0)
      .attr('transform', (d, i) => {
        let offsetX = i * this.unitLength;
        let offsetY = this.nameGap;
        return `translate(${offsetX}, ${offsetY})`;
      });
  },
  clear: function() {
    if (this.neuralGroup) {
      this.neuralGroup.selectAll('*').remove();
    }
  }
});
function Contrast3d(config) {
  Contrast.call(this, config);

  this.featureMapGap = 5;
  this.featureMaps = [];
  this.blocks = config.blocks;
}
Contrast3d.prototype = Object.assign(Object.create(Contrast.prototype), {
  initExtensions: function() {
    this.actualWidth = this.shape[0] * this.unitLength * this.shape[2] + (this.shape[2] - 1) * this.featureMapGap;
    this.actualHeight = this.shape[1] * this.unitLength;
    for (let i = 0; i < this.shape[2]; i++) {
      let fm = new FeatureMap(
        this.shape[1],
        this.shape[0],
        this.unitLength,
        this.color,
        [(this.unitLength * this.shape[1] + this.featureMapGap) * i, this.nameGap],
        i,
        this.blocks[i]
      );
      fm.setEnvironment(this.neuralGroup, this);
      fm.init();
      this.featureMaps.push(fm);
    }
  },
  updateVis: function(neuralValue) {
    this.neuralValue = neuralValue;
    // this.clear();

    let layerOutputValues = ChannelDataGenerator.generateChannelData(this.neuralValue, this.shape[2]);
    let featureMapSize = this.shape[0] * this.shape[1];

    for (let i = 0; i < this.shape[2]; i++) {
      let colors = ColorUtils.getAdjustValues(
        layerOutputValues.slice(i * featureMapSize, (i + 1) * featureMapSize),
        this.minOpacity
      );
      this.featureMaps[i].updateVis(colors);
    }
  }
});
function FeatureMap(width, height, unitLength, color, position, layerIndex, blocked) {
  this.g = undefined;
  this.layer = undefined;

  this.width = width;
  this.height = height;
  this.unitLength = unitLength;
  this.color = color;

  this.position = position;
  this.layerIndex = layerIndex;
  this.blocked = blocked;

  this.featureGroup = undefined;
}
FeatureMap.prototype = {
  setEnvironment: function(g, layer) {
    this.g = g;
    this.layer = layer;
  },
  init: function() {
    this.featureGroup = this.g.append('g')
      .attr('transform', `translate(${this.position[0]}, ${this.position[1]})`);
  },
  updateVis: function(colors) {
    this.clear();
    let renderColor = RenderPreprocessor.preProcessFmColor(colors, this.width, this.height);
    this.featureGroup.selectAll('rect')
      .data(renderColor)
      .enter()
      .append('rect')
      .attr('width', this.unitLength)
      .attr('height', this.unitLength)
      .attr('fill', this.color)
      .attr('opacity', (d, i) => {
        if (this.blocked) {
          return renderColor[i] * 0.2;
        }
        return renderColor[i];
      })
      .attr('stroke-width', 0)
      .attr('transform', (d, i) => {
        let offsetX = (i % this.width) * this.unitLength;
        let offsetY = (this.height - parseInt(i / this.width)) * this.unitLength;
        return `translate(${offsetX}, ${offsetY})`;
      });
  },
  getElements: function() {
    return this.featureGroup;
  },
  clear: function() {
    if (this.featureGroup) {
      this.featureGroup.selectAll('*').remove();
    }
  }
};

let ContrastFactory = Object.create({
  getInstance: function(layer, imageName) {
    if (layer.layerType === 'Conv2d' || layer.layerType === 'Pooling2d') {
      return new Contrast3d({ shape: layer.outputShape, layerType: layer.layerType, blocks: layer.blocks, imageName: imageName })
    } else if (layer.layerType === 'Dense' || layer.layerType === 'Flatten') {
      return new Contrast1d({ shape: layer.outputShape, layerType: layer.layerType, imageName: imageName })
    }
  }
});


let exports = {
  ContrastSceneInitializer: ContrastSceneInitializer,
  Contrast1d: Contrast1d,
  Contrast3d: Contrast3d,
  ContrastFactory: ContrastFactory
};

return exports;
}(TSP));
