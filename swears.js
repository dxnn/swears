// Swears text-based display and manipulation library
// https://github.com/dxnn/swears


Swears = function(width, height, options) {
  this.setIntervalId = 0;
  this.width = width;
  this.height = height;
  this.layers = [];
  this.composite = [[{}]];
  this.options = options || {};
  this.x = 0;
  this.y = 0;
  this.max_x = width - 1;
  this.max_y = height - 1;
  
  // extend this property to add renderers.
  this.renderers = {
    pre: this.string_renderer
  };
  
  this.clear_composite();
  
  // THINK: how do we handle multiple views? with a single static viewport that might be weird...
  
  return this;
}

Swears.prototype = {
  add_layer: function(data, options) {
    var self = this,
        index = self.layers.length;
    
    var layer = Object.create(Swears.Layer, {
      'index': {
        value: index,
        enumerable:true, 
        writable:true
      },
      swears: {
        value: self
      }
    });

    layer.x = 0,
    layer.y = 0,
    layer.data = [[false]],
    
    self.layers[index] = layer;
    
    if(data) {layer.set_data(data);}
    
    options = options || {};
    layer.invisible = options.invisible || false;
    
    return layer;
  },
  
  clear_composite: function() {
    // initialize composite array
    for(var y = 0; y < this.height; y++) {
      this.composite[y] = [];
      for(var x = 0; x < this.width; x++) {
        this.composite[y][x] = [];
      }
    }
  },
  
  // shift the viewport
  translate: function(dx, dy) {
    this.x = this.x + dx;
    this.y = this.y + dy;
    this.max_x = this.x + this.width - 1;
    this.max_y = this.y + this.height - 1;
    return this;
  },
  
  // start the sequence
  play: function(framerate, callback) {
    var self = this;
    
    if(!parseInt(framerate)) {return false;}
    var micros = parseInt(1000 / parseInt(framerate));
    micros = micros < 10 ? 10 : micros;
    this.setIntervalId = setInterval(function() {
      callback();
      self.compositor();
      self.render();
    }, micros);
    
    return this;
  },
  
  // freeze time
  pause: function() {
    clearInterval(this.setIntervalId);
    delete(this.setIntervalId);
    return this;
  },
  
  // use a renderer to display stuff
  render: function(renderer, options) {
    renderer = renderer || 'pre';
    options = options || {};
    for (var prop in this.options) {
      if (this.options.hasOwnProperty(prop)) {
        if (this.options[prop] !== void 0) options[prop] = this.options[prop];
      }
    }
    this.renderers[renderer].call(this, options);
    return this;
  },

  // renders into an html pre tag. requires options.target to be the dom element.
  string_renderer: function(options) {
    // composite -> string
    var string = '';
    for(var y = 0; y < this.height; y++) {
      for(var x = 0; x < this.width; x++) {
        if(!this.composite[y][x][0]) {
          string += ' ';
          continue;
        }
        if(typeof this.composite[y][x][0].data == 'string') {
          string += this.composite[y][x][0].data[0];
        } else {
          string += this.composite[y][x][0].data.toString();
        }
      }
      string += "\n";
    }
    
    // render in target
    options.target.innerHTML = string;
  },
  
  // this creates a composite array from all layers that intersect the viewport. for a given x and y,
  // var slice = composite[y][x] is a stack of all layers that overlap that point, and
  // slice[0].data is probably a single character string (though it depends on your layers and renderer)
  // slice[0].layer is the layer that data came from
  compositor: function() {
    var layer, min_x, max_x, min_y, max_y;
      
    /* TODO: 
        - handle clipping better for large layers: determine the overlap with the viewport and only walk those areas
        - pattern generators that take a string and wrap it, or do halftoning or other fancy things
        - shape generators that take a shape (circle, rectangle, square), dimensions, and fill and perimeter funs
        - text generators
        - parallax routine
        - animation generators
        - sprites
        -- get rid of underscore
    */
    
    this.clear_composite();

    // check each layer
    for(var i = 0; i < this.layers.length; i++) {
      layer = this.layers[i];
      
      min_x = layer.x >= 0 ? 0 : -1 * (layer.x); // smallest inbounds x-index
      max_x = layer.x + layer.width <= this.max_x ? 
              layer.width - 1 : 
              this.max_x - layer.x - 1; // largest inbounds x-index

      min_y = layer.y >= 0 ? 0 : -1 * (layer.y); // smallest inbounds y-index
      max_y = layer.y + layer.height <= this.max_y ? 
              layer.height - 1 : 
              this.max_y - layer.y - 1; // largest inbounds y-index
      
      if(min_x > layer.width || max_x < 0 || min_y > layer.height || max_y < 0) {continue;}

      off_x = layer.x - this.x;
      off_y = layer.y - this.y;

      for(var layer_y = min_y; layer_y <= max_y; layer_y++) {
        vp_y = off_y + layer_y;
        for(var layer_x = min_x; layer_x <= max_x; layer_x++) {
          vp_x = off_x + layer_x;
          if(layer.data[layer_y][layer_x]) {
            this.composite[vp_y][vp_x].push({
              data: layer.data[layer_y][layer_x], 
              layer: layer
            });
          }
        }
      }
    }
      
    return this.composite; 
  },
  
  // utility function for changing strings into matrices
  make_matrix: function(string, alpha) {
    var matrix = [];
    var lines = string.split(/\n/);
    for(var i=0; i < lines.length; i++) {
      matrix[i] = [];
      for(var j=0; j < lines[i].length; j++) {
        matrix[i][j] = lines[i][j] == alpha ? false : lines[i][j];
        // THINK: should we limit this to true / false?
      }
    }
    return matrix;
  },
  
  destroy_all_layers: function() {
    this.layers = [];
  },
};


// this is effectively the layer prototype, since we're using Object.create.
Swears.Layer = {
  remove: function() {
    this.swears.layers.splice(this.index, 1);
    for(var i = this.swears.layers.length - 1; i >= this.index; i--) {
      this.swears.layers[i].index--;
    }
    // delete(this); // ??
  },
  
  move_down: function() {
    if(this.index >= this.swears.layers.length - 1) {return false;}
    var next = this.swears.layers[this.index + 1];
    // swap layers
    this.swears.layers[this.index] = next;
    this.swears.layers[this.index + 1] = this;
    // swap indices
    this.index++;
    next.index--;
    return this.index;
  },
  
  move_to_bottom: function() {
    while(this.index < this.swears.layers.length) {
      this.move_down();
    }
  },
    
  move_up: function() {
    if(this.index <= 0) {return false;}
    var prev = this.swears.layers[this.index - 1];
    // swap layers
    this.swears.layers[this.index] = prev;
    this.swears.layers[this.index - 1] = this;
    // swap indices
    this.index--;
    prev.index++;
    return this.index;
  },
  
  move_to_top: function() {
    while(this.index) {
      this.move_up();
    }
  },
  
  translate: function(dx, dy, object) {
    var slices, last, vp_x, vp_y, layer_x, layer_y, min_x, max_x, min_y, max_y, new_x, new_y, keep_going = true;
    
    if(!dx & !dy) {return this;} // didn't move
    if(typeof object.oncollide != 'function') {return this.raw_translate(dx, dy);} // no collision woes
    
    /*
      There's a few different coordinate sets here:
      this.x is the layer's x offset (relative to the initial viewport)
      this.swears.x is the viewport's offset and min (rtt iv)
      this.swears.max_x is the viewport's max (rtt iv)
      dx is the proposed shift in this.x
      new_x is the proposed new this.x
      vp_x is a point in the current viewport
      layer_x is the same point in the layer's data
      min and max are relative to the layer's data
      off_x is the offset between the layer and the viewport
    */
    
    
    // collision detection against last composite
    // NOTE: for some purposes you'll need to composite after every move
    // NOTE: this only handles collisions within the composite viewport
    // THINK: combine this with the compositor in some fashion?
    // THINK: include the territory skipped if x or y > 1?
    new_x = this.x + dx;
    new_y = this.y + dy;
            
    min_x = new_x >= 0 ? 0 : -1 * (new_x); // smallest inbounds x-index
    max_x = new_x + this.width <= this.swears.max_x ? 
            this.width : 
            this.swears.max_x - new_x; // largest inbounds x-index
    
    min_y = new_y >= 0 ? 0 : -1 * (new_y); // smallest inbounds y-index
    max_y = new_y + this.height <= this.swears.max_y ? 
            this.height : 
            this.swears.max_y - new_y; // largest inbounds y-index
    
    off_x = new_x - this.swears.x;
    off_y = new_y - this.swears.y;
    
    // check for out-of-bounds
    if(min_x > this.width || max_x < 0 || min_y > this.height || max_y < 0) {return this.raw_translate(dx, dy);}
    
    last = this.swears.composite;
    for(var layer_y = min_y; layer_y <= max_y; layer_y++) {
      vp_y = off_y + layer_y;
      for(var layer_x = min_x; layer_x <= max_x; layer_x++) {
        vp_x = off_x + layer_x;
        if(this.data[layer_y][layer_x]) {
          slices = last[vp_y][vp_x];
          for(var i=0; i < slices.length; i++) {
            if(!object.oncollide(slices[i].layer)) {
              keep_going = false;
            }
          }
        }
      }
    }
    
    if(!keep_going) {return false;}
    
    return this.raw_translate(dx, dy);
  },
  
  raw_translate: function(dx, dy) {
    this.x = this.x + dx;
    this.y = this.y + dy;
    return this;
  },
  
  // set the layer's string data
  set_data: function(data) {
    if(typeof data == 'string') {
      data = this.swears.make_matrix(data);
    }
    this.data = data;
    
    var width = 1;
    for(var i = this.data.length - 1; i >= 0; i--) {
      width = this.data[i].length > width ? this.data[i].length : width;
    }
    this.width = width;
    this.height = this.data.length;
  },
};