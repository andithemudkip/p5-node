const jsdom = require("jsdom");
const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');
const isURL = require('is-url');
const axios = require('axios');
const omggif = require('omggif');

/*
TODO
  loadJSON() -- done
  loadStrings() -- done
  loadTable() -- not a priority
  loadXML() -- not a priority
  loadBytes() -- not a priority
  httpGet() -- not doing anymore, just use axios or request
  httpPost() -- not doing anymore, just use axios or request
  httpDo() -- not doing anymore, just use axios or request
  createWriter()  -- not a priority
  save() -- meh
  saveCanvas() -- done
  saveJSON() -- done
  saveStrings()  -- done
  saveTable() -- not a priority
  ....
  registerMethod() -- done
  registerPlugin() -- done
*/

function pad(n, width, z) {
  z = z || '0';
  n = n + '';
  return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}

const GIFEncoder = require('gifencoder');
const pngFileStream = require('png-file-stream');

const dom = new jsdom.JSDOM(`<!DOCTYPE html><html><head></head><body></body></html>`, { predendToBeVisual: true, runScripts: 'outside-only' });
const { window } = dom;
const { document } = window;

let Canvas = require('jsdom/lib/jsdom/utils').Canvas;

let mainSketch;
let mainCanvas;
let pp;

module.exports = {
  loadFont: f => {
    if(typeof f == "object") {
      Canvas.registerFont(f.path, { family: f.family });
      return f.family;
    } else {
      let filepath = f.split('.')[f.split('.').length-2];
      let filepathparts = filepath.split(/\//g);
      let filename = filepathparts[filepathparts.length - 1];
      Canvas.registerFont(f, { family: filename });
      return filename;
    }
  },
  loadImage: src => {
    return () => {
      return new Promise((resolve, reject) => {
        mainSketch.loadImage(src).then(img => {
          resolve(img);
        })
      });
    }
  },
  loadJSON: f => {
    return () => {
      return new Promise((resolve, reject) => {
        mainSketch.loadJSON(f).then(data => {
          resolve(data);
        });
      });
    }
  },
  loadStrings: f => {
    return () => {
      return new Promise((resolve, reject) => {
        mainSketch.loadStrings(f).then(data => {
          resolve(data);
        });
      });
    }
  },
  registerMethod: (name, fnc) => {
    if(pp) {
      if(typeof name == 'string') {
        //DONT USE ARROW NOTATION FOR BIND TO WORK LOL
        fnc = fnc.bind({ p5: pp.prototype });
        //add the function to the p5 instance
        Object.defineProperty(pp.prototype, name, {
          configurable: true,
          enumerable: true,
          value: fnc
        });
        pp.prototype.registerMethod(name, pp.prototype[name]);

        //add the function to node-p5
        Object.defineProperty(module.exports, name, {
          configurable: true,
          enumerable: true,
          value: () => {
            return () => {
              return fnc();
            }
          }
        });
      }
    } else throw new Error('p5 not defined?');
  },
  registerPlugin: obj => {
    Object.keys(obj).forEach(key => {
      module.exports.registerMethod(key, obj[key]);
    });
  }
}


/*! p5.js v0.8.0 April 08, 2019 */

!(function(e) {
  pp = e();

  // helper for writing color to array - https://p5js.org/reference/#/p5.Image
  function writeColor(image, width, x, y, col) {
    let index = (x + y * width) * 4;
    image.pixels[index] = col[0];
    image.pixels[index + 1] = col[1];
    image.pixels[index + 2] = col[2];
    image.pixels[index + 3] = col[3];
  }

  // VECTORS
  pp.prototype.Vector = pp.Vector;

  // IO
  // LOAD JSON
  pp.prototype.loadJSON = (f, cb) => {
    return new Promise((resolve, reject) => {
      if(isURL(f)) {
        axios.get(f).then(res => {
          if(!cb) resolve(res.data);
          else cb(null, res.data);
        }).catch(err => {
          if(!cb) reject(err);
          else cb(err);
        });
      } else {
        if(!cb) resolve(JSON.parse(fs.readFileSync(f, 'utf8')));
        else cb(null, JSON.parse(fs.readFileSync(f, 'utf8')));
      }
    });
  }
  pp.prototype.registerMethod('loadJSON', pp.prototype.loadJSON);

  //LOAD STRINGS
  pp.prototype.loadStrings = (f, cb) => {
    return new Promise((resolve, reject) => {
      if(isURL(f)) {
        axios.get(f).then(res => {
          try {
            let data = res.data.replace(/\r/g, "").split('\n');
            if(cb) cb(null, data);
            else resolve(data);
          } catch (err) {
            if(cb) cb(err);
            else reject(err);
          }
        }).catch(err => {
          if(cb) cb(err);
          else reject(err);
        });
      } else {
        fs.readFile(f, 'utf8', (err, data) => {
          if(err) {
            if(cb) cb(err);
            else reject(err);
          } else {
            try {
              data = data.replace(/\r/g, "").split('\n');
              if(cb) cb(null, data);
              else resolve(data);
            } catch (err) {
              if(cb) cb(err);
              else reject(err);
            }
          }
        });
      }
    });
  }

  pp.prototype.registerMethod('loadStrings', pp.prototype.loadStrings);

  //LOAD IMAGE
  pp.prototype.loadImage = async (path, cb) => {
    let img;

    return new Promise((resolve, reject) => {
      // GIF
      if (path.endsWith('.gif')) {
        fs.readFile(path, function(err, data) {
          if (err) cb(null, img); // Fail if the file can't be read.

          const gifReader = new omggif.GifReader(data);

          const pImg = new pp.Image(1, 1, this);
          pImg.width = pImg.canvas.width = gifReader.width;
          pImg.height = pImg.canvas.height = gifReader.height;
          const frames = [];
          const numFrames = gifReader.numFrames();
          let framePixels = new Uint8ClampedArray(pImg.width * pImg.height * 4);
          let averageDelay = 0;

          if (numFrames > 1) {
            const loadGIFFrameIntoImage = (frameNum, gifReader) => {
              try {
                gifReader.decodeAndBlitFrameRGBA(frameNum, framePixels);
              } catch (e) {
                console.error(e);
              }
            };

            for (let j = 0; j < numFrames; j++) {
              const frameInfo = gifReader.frameInfo(j);
              averageDelay += frameInfo.delay;
              // Load GIF frame
              loadGIFFrameIntoImage(j, gifReader);
              const frameImg = new Jimp({ data: framePixels, width: pImg.width, height: pImg.height });

              // Write GIF frame onto pImg
              pImg.loadPixels();
              for(let i = 0; i < pImg.width; i++) {
                for(let j = 0; j < pImg.height; j++) {
                  let col = Jimp.intToRGBA(frameImg.getPixelColor(i, j));

                  let index = (i + j * pImg.width) * 4;
                  pImg.pixels[index] = col.r;
                  pImg.pixels[index + 1] = col.g;
                  pImg.pixels[index + 2] = col.b;
                  pImg.pixels[index + 3] = col.a;
                }
              }
              pImg.updatePixels();
              // Push processed frame into array
              frames.push(
                pImg.drawingContext.getImageData(0, 0, pImg.width, pImg.height)
              );
            }

            //Uses Netscape block encoding
            //to repeat forever, this will be 0
            //to repeat just once, this will be null
            //to repeat N times (1<N), should contain integer for loop number
            //this is changed to more usable values for us
            //to repeat forever, loopCount = null
            //everything else is just the number of loops
            let loopLimit = gifReader.loopCount();
            if (loopLimit === null) {
              loopLimit = 1;
            } else if (loopLimit === 0) {
              loopLimit = null;
            }

            // See note about this at variable creation above
            averageDelay /= numFrames;

            pImg.gifProperties = {
              displayIndex: 0,
              delay: averageDelay * 10, //GIF stores delay in one-hundredth of a second, shift to ms
              loopLimit,
              loopCount: 0,
              frames,
              numFrames,
              playing: true,
              timeDisplayed: 0
            };

            if(typeof cb === "function") {
              cb(null, pImg);
            } else {
              resolve(pImg);
            }
          }
        })

      }
      else {
        // Non GIF image
        Canvas.loadImage(path).then((image) => {
          img = new pp.Image(image.width, image.height);
          img.drawingContext.drawImage(image, 0, 0, image.width, image.height);

          if(typeof cb === "function") {
            cb(null, img);
          } else {
            resolve(img);
          }
        });
      }
    });
  }

  pp.prototype.registerMethod('loadImage', pp.prototype.loadImage);

  //SAVE JSON
  pp.prototype.saveJSON = (json, filename, optimize = false) => {
    return new Promise((resolve, reject) => {
      if (typeof json == "object") {
        let str = optimize ? JSON.stringify(json) : JSON.stringify(json, null, 4);
        fs.writeFile(filename, str, err => {
          if(err) reject(err);
          resolve(filename);
        });
      } else reject('First parameter must be an object');
    });
  }
  pp.prototype.registerMethod('saveJSON', pp.prototype.saveJSON);


  //SAVE STRINGS

  pp.prototype.saveStrings = (list, filename, extension = 'txt', separator = '\n') => {
    return new Promise((resolve, reject) => {
      if(typeof list == "object" && list.length != undefined) {
        let farr = filename.split('.');
        if(farr.length > 1 && extension == 'txt') {
          filename = filename.replace(`.${farr[farr.length - 1]}`, '');
          extension = farr[farr.length - 1];
        }
        let str = '';
        list.forEach(item => {
          str += `${item}${separator}`
        });
        fs.writeFile(`${filename}.${extension}`, str, err => {
          if(err) reject(err);
          resolve(`${filename}.${extension}`);
        })
      } else reject('First parameter must be an array.');
    });
  }

  pp.prototype.registerMethod('saveStrings', pp.prototype.saveStrings);

  // GET CANVAS DATA URL
  pp.prototype.getCanvasDataURL = c => {
    return c.canvas.toDataURL();
  }
  pp.prototype.registerMethod('getCanvasDataURL', pp.prototype.getCanvasDataURL)

  //SAVE CANVAS
  pp.prototype.saveCanvas = (c, f, ext) => {
    let extensions = ['png', 'jpg'];
    return new Promise((resolve, reject) => {
      if(!c.canvas) reject(new Error('No canvas passed to SaveCanvas'));
      let f_arr = f.split('.');
      if(!extensions.includes(f_arr[f_arr.length-1])) {
        if(ext) {
          f = `${f}.${ext}`;
        } else {
          f = `${f}.png`;
        }
      }
      fs.writeFile(`${f}`, pp.prototype.getCanvasDataURL(c).replace(/^data:image\/png;base64,/, ""), 'base64', err => {
        if(err) reject(err);
        else resolve(f);
      });
    });
  }
  pp.prototype.registerMethod('saveCanvas', pp.prototype.saveCanvas);

  // pp.prototype.doStuffAtEndOfDraw = () => {
  //   if(isSavingFrames) {
  //     if(mainCanvas) {
  //       savedFrames.push(pp.prototype.getCanvasDataURL(mainCanvas));
  //     }
  //   }
  // }
  // pp.prototype.registerMethod('post', pp.prototype.doStuffAtEndOfDraw);


  pp.prototype.saveFrames = (cnv, dir, ext, dur, framerate, cb) => {
    return new Promise((resolve, reject) => {
      //get the frames as base64
      mainSketch.noLoop();
      mainSketch.redraw();
      let nrOfFrames = framerate * dur;
      let sFrames = [];
      for(let i = 0; i < nrOfFrames; i++) {
        sFrames.push(pp.prototype.getCanvasDataURL(cnv));
        mainSketch.redraw();
      }
      mainSketch.loop();

      //cleanup folder
      if(!(fs.existsSync(dir) && fs.lstatSync(dir).isDirectory())) {
        fs.mkdirSync(dir);
      } else {
        let files = fs.readdirSync(dir);
        for (const file of files) {
          fs.unlinkSync(path.join(dir, file), err => {
            if (err) throw err;
          });
        }
      }

      if(typeof ext === "object") {
        //save as gif
        let mag = sFrames.length.toString().length;
        sFrames.forEach((frame, i) => {
          fs.writeFileSync(`${dir}/frame-${pad(i, mag)}.png`, frame.replace(/^data:image\/png;base64,/, ""), 'base64', err => {
            if(err) {
              if(cb) cb(err);
              else reject(err);
            }
          });
        });
        let encoder = new GIFEncoder(mainSketch.width, mainSketch.height);
        let str = '';
        for(let i = 0; i < mag; i++) {
          str += '?';
        }
        let options = {repeat: ext.repeat || 0, delay: ext.delay || Math.floor(1000 / framerate), quality: ext.quality || 10};
        let stream = pngFileStream(`${dir}/frame-${str}.png`)
          .pipe(encoder.createWriteStream(options))
          .pipe(fs.createWriteStream(`${dir}/${dir}.gif`));
        stream.on('finish', () => {
          if(cb) cb();
          else resolve();
        });
      } else {
        //save as images
        sFrames.forEach((frame, i) => {
          fs.writeFileSync(`${dir}/${i}.${ext}`, frame.replace(/^data:image\/png;base64,/, ""), 'base64', err => {
            if(err) {
              if(cb) cb(err);
              else reject(err);
            }
          });
        });
      }
    });
  }

  pp.prototype.registerMethod('saveFrames', pp.prototype.saveFrames);

  module.exports.createSketch = (s, toPreload = { 0: { function: null }}) => {
    mainSketch = new pp(async c => {
      let newObj = {};
      let index = 0;
      //declare the preload function
      c.preload = async () => {
        let keys = (typeof toPreload == "object") ? Object.keys(toPreload) : 0;
        //iterate through all the keys of the 'toPreload' object passed to createSketch
        keys.forEach(async (key, i) => {
          //if the 'function' parameter is a string, it means its a built in function of p5
          if (typeof toPreload[key] === 'function') {
            let funcVal = toPreload[key]();
            //check whether it returns a promise or just a value and add it to the returned 'preloaded' object
            if(funcVal instanceof Promise) newObj[key] = await funcVal;
            else newObj[key] = funcVal;
          //if it is a promise wait for it and add it to the object
          } else if (toPreload[key] instanceof Promise) {
            newObj[key] = await toPreload[key];
          }

          index++;
          //decrement preload so that p5 can move on to setup
          if(index == keys.length) {
            while(c._preloadCount) {
              c._decrementPreload();
            }
            //call the sketch and pass the p5 variable and the preloaded object

            s(c, newObj);
            if(keys[0] != '0') {
              c.setup();
            }

          }
        });
      }
    });
    return mainSketch;
  }

  // module.exports.Constructor = pp;

  // if ("object" == typeof exports && "undefined" != typeof module)
  //   module.exports = pp;
  // else if ("function" == typeof define && define.amd) define([], e);
  // else {
  //   ("undefined" != typeof window
  //     ? window
  //     : "undefined" != typeof global
  //     ? global
  //     : "undefined" != typeof self
  //     ? self
  //     : this
  //   ).p5 = e();
  // }


})(function() {
  return function n(o, s, l) {
    function u(t, e) {
      if (!s[t]) {
        if (!o[t]) {
          var r = "function" == typeof require && require;
          if (!e && r) return r(t, !0);
          if (h) return h(t, !0);
          var i = new Error("Cannot find module '" + t + "'");
          throw i.code = "MODULE_NOT_FOUND", i
        }
        var a = s[t] = {
          exports: {}
        };
        o[t][0].call(a.exports, function(e) {
          return u(o[t][1][e] || e)
        }, a, a.exports, n, o, s, l)
      }
      return s[t].exports
    }
    for (var h = "function" == typeof require && require, e = 0; e < l.length; e++) u(l[e]);
    return u
  }({
    1: [function(e, t, r) {
      "use strict";
      r.byteLength = function(e) {
        var t = f(e),
          r = t[0],
          i = t[1];
        return 3 * (r + i) / 4 - i
      }, r.toByteArray = function(e) {
        for (var t, r = f(e), i = r[0], a = r[1], n = new c((u = i, h = a, 3 * (u + h) / 4 - h)), o = 0, s = 0 < a ? i - 4 : i, l = 0; l < s; l += 4) t = d[e.charCodeAt(l)] << 18 | d[e.charCodeAt(l + 1)] << 12 | d[e.charCodeAt(l + 2)] << 6 | d[e.charCodeAt(l + 3)], n[o++] = t >> 16 & 255, n[o++] = t >> 8 & 255, n[o++] = 255 & t;
        var u, h;
        2 === a && (t = d[e.charCodeAt(l)] << 2 | d[e.charCodeAt(l + 1)] >> 4, n[o++] = 255 & t);
        1 === a && (t = d[e.charCodeAt(l)] << 10 | d[e.charCodeAt(l + 1)] << 4 | d[e.charCodeAt(l + 2)] >> 2, n[o++] = t >> 8 & 255, n[o++] = 255 & t);
        return n
      }, r.fromByteArray = function(e) {
        for (var t, r = e.length, i = r % 3, a = [], n = 0, o = r - i; n < o; n += 16383) a.push(l(e, n, o < n + 16383 ? o : n + 16383));
        1 === i ? (t = e[r - 1], a.push(s[t >> 2] + s[t << 4 & 63] + "==")) : 2 === i && (t = (e[r - 2] << 8) + e[r - 1], a.push(s[t >> 10] + s[t >> 4 & 63] + s[t << 2 & 63] + "="));
        return a.join("")
      };
      for (var s = [], d = [], c = "undefined" != typeof Uint8Array ? Uint8Array : Array, i = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/", a = 0, n = i.length; a < n; ++a) s[a] = i[a], d[i.charCodeAt(a)] = a;

      function f(e) {
        var t = e.length;
        if (0 < t % 4) throw new Error("Invalid string. Length must be a multiple of 4");
        var r = e.indexOf("=");
        return -1 === r && (r = t), [r, r === t ? 0 : 4 - r % 4]
      }

      function l(e, t, r) {
        for (var i, a, n = [], o = t; o < r; o += 3) i = (e[o] << 16 & 16711680) + (e[o + 1] << 8 & 65280) + (255 & e[o + 2]), n.push(s[(a = i) >> 18 & 63] + s[a >> 12 & 63] + s[a >> 6 & 63] + s[63 & a]);
        return n.join("")
      }
      d["-".charCodeAt(0)] = 62, d["_".charCodeAt(0)] = 63
    }, {}],
    2: [function(e, t, r) {}, {}],
    3: [function(e, t, r) {
      "use strict";
      var i = e("base64-js"),
        n = e("ieee754");
      r.Buffer = d, r.SlowBuffer = function(e) {
        +e != e && (e = 0);
        return d.alloc(+e)
      }, r.INSPECT_MAX_BYTES = 50;
      var a = 2147483647;

      function o(e) {
        if (a < e) throw new RangeError('The value "' + e + '" is invalid for option "size"');
        var t = new Uint8Array(e);
        return t.__proto__ = d.prototype, t
      }

      function d(e, t, r) {
        if ("number" != typeof e) return s(e, t, r);
        if ("string" == typeof t) throw new TypeError('The "string" argument must be of type string. Received type number');
        return u(e)
      }

      function s(e, t, r) {
        if ("string" == typeof e) return function(e, t) {
          "string" == typeof t && "" !== t || (t = "utf8");
          if (!d.isEncoding(t)) throw new TypeError("Unknown encoding: " + t);
          var r = 0 | f(e, t),
            i = o(r),
            a = i.write(e, t);
          a !== r && (i = i.slice(0, a));
          return i
        }(e, t);
        if (ArrayBuffer.isView(e)) return h(e);
        if (null == e) throw TypeError("The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type " + typeof e);
        if (U(e, ArrayBuffer) || e && U(e.buffer, ArrayBuffer)) return function(e, t, r) {
          if (t < 0 || e.byteLength < t) throw new RangeError('"offset" is outside of buffer bounds');
          if (e.byteLength < t + (r || 0)) throw new RangeError('"length" is outside of buffer bounds');
          var i;
          i = void 0 === t && void 0 === r ? new Uint8Array(e) : void 0 === r ? new Uint8Array(e, t) : new Uint8Array(e, t, r);
          return i.__proto__ = d.prototype, i
        }(e, t, r);
        if ("number" == typeof e) throw new TypeError('The "value" argument must not be of type number. Received type number');
        var i = e.valueOf && e.valueOf();
        if (null != i && i !== e) return d.from(i, t, r);
        var a = function(e) {
          if (d.isBuffer(e)) {
            var t = 0 | c(e.length),
              r = o(t);
            return 0 === r.length || e.copy(r, 0, 0, t), r
          }
          if (void 0 !== e.length) return "number" != typeof e.length || F(e.length) ? o(0) : h(e);
          if ("Buffer" === e.type && Array.isArray(e.data)) return h(e.data)
        }(e);
        if (a) return a;
        if ("undefined" != typeof Symbol && null != Symbol.toPrimitive && "function" == typeof e[Symbol.toPrimitive]) return d.from(e[Symbol.toPrimitive]("string"), t, r);
        throw new TypeError("The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type " + typeof e)
      }

      function l(e) {
        if ("number" != typeof e) throw new TypeError('"size" argument must be of type number');
        if (e < 0) throw new RangeError('The value "' + e + '" is invalid for option "size"')
      }

      function u(e) {
        return l(e), o(e < 0 ? 0 : 0 | c(e))
      }

      function h(e) {
        for (var t = e.length < 0 ? 0 : 0 | c(e.length), r = o(t), i = 0; i < t; i += 1) r[i] = 255 & e[i];
        return r
      }

      function c(e) {
        if (a <= e) throw new RangeError("Attempt to allocate Buffer larger than maximum size: 0x" + a.toString(16) + " bytes");
        return 0 | e
      }

      function f(e, t) {
        if (d.isBuffer(e)) return e.length;
        if (ArrayBuffer.isView(e) || U(e, ArrayBuffer)) return e.byteLength;
        if ("string" != typeof e) throw new TypeError('The "string" argument must be one of type string, Buffer, or ArrayBuffer. Received type ' + typeof e);
        var r = e.length,
          i = 2 < arguments.length && !0 === arguments[2];
        if (!i && 0 === r) return 0;
        for (var a = !1;;) switch (t) {
          case "ascii":
          case "latin1":
          case "binary":
            return r;
          case "utf8":
          case "utf-8":
            return A(e).length;
          case "ucs2":
          case "ucs-2":
          case "utf16le":
          case "utf-16le":
            return 2 * r;
          case "hex":
            return r >>> 1;
          case "base64":
            return I(e).length;
          default:
            if (a) return i ? -1 : A(e).length;
            t = ("" + t).toLowerCase(), a = !0
        }
      }

      function p(e, t, r) {
        var i = e[t];
        e[t] = e[r], e[r] = i
      }

      function m(e, t, r, i, a) {
        if (0 === e.length) return -1;
        if ("string" == typeof r ? (i = r, r = 0) : 2147483647 < r ? r = 2147483647 : r < -2147483648 && (r = -2147483648), F(r = +r) && (r = a ? 0 : e.length - 1), r < 0 && (r = e.length + r), r >= e.length) {
          if (a) return -1;
          r = e.length - 1
        } else if (r < 0) {
          if (!a) return -1;
          r = 0
        }
        if ("string" == typeof t && (t = d.from(t, i)), d.isBuffer(t)) return 0 === t.length ? -1 : v(e, t, r, i, a);
        if ("number" == typeof t) return t &= 255, "function" == typeof Uint8Array.prototype.indexOf ? a ? Uint8Array.prototype.indexOf.call(e, t, r) : Uint8Array.prototype.lastIndexOf.call(e, t, r) : v(e, [t], r, i, a);
        throw new TypeError("val must be string, number or Buffer")
      }

      function v(e, t, r, i, a) {
        var n, o = 1,
          s = e.length,
          l = t.length;
        if (void 0 !== i && ("ucs2" === (i = String(i).toLowerCase()) || "ucs-2" === i || "utf16le" === i || "utf-16le" === i)) {
          if (e.length < 2 || t.length < 2) return -1;
          s /= o = 2, l /= 2, r /= 2
        }

        function u(e, t) {
          return 1 === o ? e[t] : e.readUInt16BE(t * o)
        }
        if (a) {
          var h = -1;
          for (n = r; n < s; n++)
            if (u(e, n) === u(t, -1 === h ? 0 : n - h)) {
              if (-1 === h && (h = n), n - h + 1 === l) return h * o
            } else -1 !== h && (n -= n - h), h = -1
        } else
          for (s < r + l && (r = s - l), n = r; 0 <= n; n--) {
            for (var d = !0, c = 0; c < l; c++)
              if (u(e, n + c) !== u(t, c)) {
                d = !1;
                break
              } if (d) return n
          }
        return -1
      }

      function g(e, t, r, i) {
        r = Number(r) || 0;
        var a = e.length - r;
        i ? a < (i = Number(i)) && (i = a) : i = a;
        var n = t.length;
        n / 2 < i && (i = n / 2);
        for (var o = 0; o < i; ++o) {
          var s = parseInt(t.substr(2 * o, 2), 16);
          if (F(s)) return o;
          e[r + o] = s
        }
        return o
      }

      function y(e, t, r, i) {
        return k(function(e) {
          for (var t = [], r = 0; r < e.length; ++r) t.push(255 & e.charCodeAt(r));
          return t
        }(t), e, r, i)
      }

      function _(e, t, r) {
        return 0 === t && r === e.length ? i.fromByteArray(e) : i.fromByteArray(e.slice(t, r))
      }

      function b(e, t, r) {
        r = Math.min(e.length, r);
        for (var i = [], a = t; a < r;) {
          var n, o, s, l, u = e[a],
            h = null,
            d = 239 < u ? 4 : 223 < u ? 3 : 191 < u ? 2 : 1;
          if (a + d <= r) switch (d) {
            case 1:
              u < 128 && (h = u);
              break;
            case 2:
              128 == (192 & (n = e[a + 1])) && 127 < (l = (31 & u) << 6 | 63 & n) && (h = l);
              break;
            case 3:
              n = e[a + 1], o = e[a + 2], 128 == (192 & n) && 128 == (192 & o) && 2047 < (l = (15 & u) << 12 | (63 & n) << 6 | 63 & o) && (l < 55296 || 57343 < l) && (h = l);
              break;
            case 4:
              n = e[a + 1], o = e[a + 2], s = e[a + 3], 128 == (192 & n) && 128 == (192 & o) && 128 == (192 & s) && 65535 < (l = (15 & u) << 18 | (63 & n) << 12 | (63 & o) << 6 | 63 & s) && l < 1114112 && (h = l)
          }
          null === h ? (h = 65533, d = 1) : 65535 < h && (h -= 65536, i.push(h >>> 10 & 1023 | 55296), h = 56320 | 1023 & h), i.push(h), a += d
        }
        return function(e) {
          var t = e.length;
          if (t <= x) return String.fromCharCode.apply(String, e);
          var r = "",
            i = 0;
          for (; i < t;) r += String.fromCharCode.apply(String, e.slice(i, i += x));
          return r
        }(i)
      }
      r.kMaxLength = a, (d.TYPED_ARRAY_SUPPORT = function() {
        try {
          var e = new Uint8Array(1);
          return e.__proto__ = {
            __proto__: Uint8Array.prototype,
            foo: function() {
              return 42
            }
          }, 42 === e.foo()
        } catch (e) {
          return !1
        }
      }()) || "undefined" == typeof console || "function" != typeof console.error || console.error("This browser lacks typed array (Uint8Array) support which is required by `buffer` v5.x. Use `buffer` v4.x if you require old browser support."), Object.defineProperty(d.prototype, "parent", {
        enumerable: !0,
        get: function() {
          if (d.isBuffer(this)) return this.buffer
        }
      }), Object.defineProperty(d.prototype, "offset", {
        enumerable: !0,
        get: function() {
          if (d.isBuffer(this)) return this.byteOffset
        }
      }), "undefined" != typeof Symbol && null != Symbol.species && d[Symbol.species] === d && Object.defineProperty(d, Symbol.species, {
        value: null,
        configurable: !0,
        enumerable: !1,
        writable: !1
      }), d.poolSize = 8192, d.from = function(e, t, r) {
        return s(e, t, r)
      }, d.prototype.__proto__ = Uint8Array.prototype, d.__proto__ = Uint8Array, d.alloc = function(e, t, r) {
        return a = t, n = r, l(i = e), i <= 0 ? o(i) : void 0 !== a ? "string" == typeof n ? o(i).fill(a, n) : o(i).fill(a) : o(i);
        var i, a, n
      }, d.allocUnsafe = function(e) {
        return u(e)
      }, d.allocUnsafeSlow = function(e) {
        return u(e)
      }, d.isBuffer = function(e) {
        return null != e && !0 === e._isBuffer && e !== d.prototype
      }, d.compare = function(e, t) {
        if (U(e, Uint8Array) && (e = d.from(e, e.offset, e.byteLength)), U(t, Uint8Array) && (t = d.from(t, t.offset, t.byteLength)), !d.isBuffer(e) || !d.isBuffer(t)) throw new TypeError('The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array');
        if (e === t) return 0;
        for (var r = e.length, i = t.length, a = 0, n = Math.min(r, i); a < n; ++a)
          if (e[a] !== t[a]) {
            r = e[a], i = t[a];
            break
          } return r < i ? -1 : i < r ? 1 : 0
      }, d.isEncoding = function(e) {
        switch (String(e).toLowerCase()) {
          case "hex":
          case "utf8":
          case "utf-8":
          case "ascii":
          case "latin1":
          case "binary":
          case "base64":
          case "ucs2":
          case "ucs-2":
          case "utf16le":
          case "utf-16le":
            return !0;
          default:
            return !1
        }
      }, d.concat = function(e, t) {
        if (!Array.isArray(e)) throw new TypeError('"list" argument must be an Array of Buffers');
        if (0 === e.length) return d.alloc(0);
        var r;
        if (void 0 === t)
          for (r = t = 0; r < e.length; ++r) t += e[r].length;
        var i = d.allocUnsafe(t),
          a = 0;
        for (r = 0; r < e.length; ++r) {
          var n = e[r];
          if (U(n, Uint8Array) && (n = d.from(n)), !d.isBuffer(n)) throw new TypeError('"list" argument must be an Array of Buffers');
          n.copy(i, a), a += n.length
        }
        return i
      }, d.byteLength = f, d.prototype._isBuffer = !0, d.prototype.swap16 = function() {
        var e = this.length;
        if (e % 2 != 0) throw new RangeError("Buffer size must be a multiple of 16-bits");
        for (var t = 0; t < e; t += 2) p(this, t, t + 1);
        return this
      }, d.prototype.swap32 = function() {
        var e = this.length;
        if (e % 4 != 0) throw new RangeError("Buffer size must be a multiple of 32-bits");
        for (var t = 0; t < e; t += 4) p(this, t, t + 3), p(this, t + 1, t + 2);
        return this
      }, d.prototype.swap64 = function() {
        var e = this.length;
        if (e % 8 != 0) throw new RangeError("Buffer size must be a multiple of 64-bits");
        for (var t = 0; t < e; t += 8) p(this, t, t + 7), p(this, t + 1, t + 6), p(this, t + 2, t + 5), p(this, t + 3, t + 4);
        return this
      }, d.prototype.toLocaleString = d.prototype.toString = function() {
        var e = this.length;
        return 0 === e ? "" : 0 === arguments.length ? b(this, 0, e) : function(e, t, r) {
          var i = !1;
          if ((void 0 === t || t < 0) && (t = 0), t > this.length) return "";
          if ((void 0 === r || r > this.length) && (r = this.length), r <= 0) return "";
          if ((r >>>= 0) <= (t >>>= 0)) return "";
          for (e || (e = "utf8");;) switch (e) {
            case "hex":
              return M(this, t, r);
            case "utf8":
            case "utf-8":
              return b(this, t, r);
            case "ascii":
              return w(this, t, r);
            case "latin1":
            case "binary":
              return S(this, t, r);
            case "base64":
              return _(this, t, r);
            case "ucs2":
            case "ucs-2":
            case "utf16le":
            case "utf-16le":
              return E(this, t, r);
            default:
              if (i) throw new TypeError("Unknown encoding: " + e);
              e = (e + "").toLowerCase(), i = !0
          }
        }.apply(this, arguments)
      }, d.prototype.equals = function(e) {
        if (!d.isBuffer(e)) throw new TypeError("Argument must be a Buffer");
        return this === e || 0 === d.compare(this, e)
      }, d.prototype.inspect = function() {
        var e = "",
          t = r.INSPECT_MAX_BYTES;
        return e = this.toString("hex", 0, t).replace(/(.{2})/g, "$1 ").trim(), this.length > t && (e += " ... "), "<Buffer " + e + ">"
      }, d.prototype.compare = function(e, t, r, i, a) {
        if (U(e, Uint8Array) && (e = d.from(e, e.offset, e.byteLength)), !d.isBuffer(e)) throw new TypeError('The "target" argument must be one of type Buffer or Uint8Array. Received type ' + typeof e);
        if (void 0 === t && (t = 0), void 0 === r && (r = e ? e.length : 0), void 0 === i && (i = 0), void 0 === a && (a = this.length), t < 0 || r > e.length || i < 0 || a > this.length) throw new RangeError("out of range index");
        if (a <= i && r <= t) return 0;
        if (a <= i) return -1;
        if (r <= t) return 1;
        if (this === e) return 0;
        for (var n = (a >>>= 0) - (i >>>= 0), o = (r >>>= 0) - (t >>>= 0), s = Math.min(n, o), l = this.slice(i, a), u = e.slice(t, r), h = 0; h < s; ++h)
          if (l[h] !== u[h]) {
            n = l[h], o = u[h];
            break
          } return n < o ? -1 : o < n ? 1 : 0
      }, d.prototype.includes = function(e, t, r) {
        return -1 !== this.indexOf(e, t, r)
      }, d.prototype.indexOf = function(e, t, r) {
        return m(this, e, t, r, !0)
      }, d.prototype.lastIndexOf = function(e, t, r) {
        return m(this, e, t, r, !1)
      }, d.prototype.write = function(e, t, r, i) {
        if (void 0 === t) i = "utf8", r = this.length, t = 0;
        else if (void 0 === r && "string" == typeof t) i = t, r = this.length, t = 0;
        else {
          if (!isFinite(t)) throw new Error("Buffer.write(string, encoding, offset[, length]) is no longer supported");
          t >>>= 0, isFinite(r) ? (r >>>= 0, void 0 === i && (i = "utf8")) : (i = r, r = void 0)
        }
        var a = this.length - t;
        if ((void 0 === r || a < r) && (r = a), 0 < e.length && (r < 0 || t < 0) || t > this.length) throw new RangeError("Attempt to write outside buffer bounds");
        i || (i = "utf8");
        for (var n, o, s, l, u, h, d, c, f, p = !1;;) switch (i) {
          case "hex":
            return g(this, e, t, r);
          case "utf8":
          case "utf-8":
            return c = t, f = r, k(A(e, (d = this).length - c), d, c, f);
          case "ascii":
            return y(this, e, t, r);
          case "latin1":
          case "binary":
            return y(this, e, t, r);
          case "base64":
            return l = this, u = t, h = r, k(I(e), l, u, h);
          case "ucs2":
          case "ucs-2":
          case "utf16le":
          case "utf-16le":
            return o = t, s = r, k(function(e, t) {
              for (var r, i, a, n = [], o = 0; o < e.length && !((t -= 2) < 0); ++o) r = e.charCodeAt(o), i = r >> 8, a = r % 256, n.push(a), n.push(i);
              return n
            }(e, (n = this).length - o), n, o, s);
          default:
            if (p) throw new TypeError("Unknown encoding: " + i);
            i = ("" + i).toLowerCase(), p = !0
        }
      }, d.prototype.toJSON = function() {
        return {
          type: "Buffer",
          data: Array.prototype.slice.call(this._arr || this, 0)
        }
      };
      var x = 4096;

      function w(e, t, r) {
        var i = "";
        r = Math.min(e.length, r);
        for (var a = t; a < r; ++a) i += String.fromCharCode(127 & e[a]);
        return i
      }

      function S(e, t, r) {
        var i = "";
        r = Math.min(e.length, r);
        for (var a = t; a < r; ++a) i += String.fromCharCode(e[a]);
        return i
      }

      function M(e, t, r) {
        var i = e.length;
        (!t || t < 0) && (t = 0), (!r || r < 0 || i < r) && (r = i);
        for (var a = "", n = t; n < r; ++n) a += D(e[n]);
        return a
      }

      function E(e, t, r) {
        for (var i = e.slice(t, r), a = "", n = 0; n < i.length; n += 2) a += String.fromCharCode(i[n] + 256 * i[n + 1]);
        return a
      }

      function T(e, t, r) {
        if (e % 1 != 0 || e < 0) throw new RangeError("offset is not uint");
        if (r < e + t) throw new RangeError("Trying to access beyond buffer length")
      }

      function C(e, t, r, i, a, n) {
        if (!d.isBuffer(e)) throw new TypeError('"buffer" argument must be a Buffer instance');
        if (a < t || t < n) throw new RangeError('"value" argument is out of bounds');
        if (r + i > e.length) throw new RangeError("Index out of range")
      }

      function P(e, t, r, i, a, n) {
        if (r + i > e.length) throw new RangeError("Index out of range");
        if (r < 0) throw new RangeError("Index out of range")
      }

      function L(e, t, r, i, a) {
        return t = +t, r >>>= 0, a || P(e, 0, r, 4), n.write(e, t, r, i, 23, 4), r + 4
      }

      function R(e, t, r, i, a) {
        return t = +t, r >>>= 0, a || P(e, 0, r, 8), n.write(e, t, r, i, 52, 8), r + 8
      }
      d.prototype.slice = function(e, t) {
        var r = this.length;
        (e = ~~e) < 0 ? (e += r) < 0 && (e = 0) : r < e && (e = r), (t = void 0 === t ? r : ~~t) < 0 ? (t += r) < 0 && (t = 0) : r < t && (t = r), t < e && (t = e);
        var i = this.subarray(e, t);
        return i.__proto__ = d.prototype, i
      }, d.prototype.readUIntLE = function(e, t, r) {
        e >>>= 0, t >>>= 0, r || T(e, t, this.length);
        for (var i = this[e], a = 1, n = 0; ++n < t && (a *= 256);) i += this[e + n] * a;
        return i
      }, d.prototype.readUIntBE = function(e, t, r) {
        e >>>= 0, t >>>= 0, r || T(e, t, this.length);
        for (var i = this[e + --t], a = 1; 0 < t && (a *= 256);) i += this[e + --t] * a;
        return i
      }, d.prototype.readUInt8 = function(e, t) {
        return e >>>= 0, t || T(e, 1, this.length), this[e]
      }, d.prototype.readUInt16LE = function(e, t) {
        return e >>>= 0, t || T(e, 2, this.length), this[e] | this[e + 1] << 8
      }, d.prototype.readUInt16BE = function(e, t) {
        return e >>>= 0, t || T(e, 2, this.length), this[e] << 8 | this[e + 1]
      }, d.prototype.readUInt32LE = function(e, t) {
        return e >>>= 0, t || T(e, 4, this.length), (this[e] | this[e + 1] << 8 | this[e + 2] << 16) + 16777216 * this[e + 3]
      }, d.prototype.readUInt32BE = function(e, t) {
        return e >>>= 0, t || T(e, 4, this.length), 16777216 * this[e] + (this[e + 1] << 16 | this[e + 2] << 8 | this[e + 3])
      }, d.prototype.readIntLE = function(e, t, r) {
        e >>>= 0, t >>>= 0, r || T(e, t, this.length);
        for (var i = this[e], a = 1, n = 0; ++n < t && (a *= 256);) i += this[e + n] * a;
        return (a *= 128) <= i && (i -= Math.pow(2, 8 * t)), i
      }, d.prototype.readIntBE = function(e, t, r) {
        e >>>= 0, t >>>= 0, r || T(e, t, this.length);
        for (var i = t, a = 1, n = this[e + --i]; 0 < i && (a *= 256);) n += this[e + --i] * a;
        return (a *= 128) <= n && (n -= Math.pow(2, 8 * t)), n
      }, d.prototype.readInt8 = function(e, t) {
        return e >>>= 0, t || T(e, 1, this.length), 128 & this[e] ? -1 * (255 - this[e] + 1) : this[e]
      }, d.prototype.readInt16LE = function(e, t) {
        e >>>= 0, t || T(e, 2, this.length);
        var r = this[e] | this[e + 1] << 8;
        return 32768 & r ? 4294901760 | r : r
      }, d.prototype.readInt16BE = function(e, t) {
        e >>>= 0, t || T(e, 2, this.length);
        var r = this[e + 1] | this[e] << 8;
        return 32768 & r ? 4294901760 | r : r
      }, d.prototype.readInt32LE = function(e, t) {
        return e >>>= 0, t || T(e, 4, this.length), this[e] | this[e + 1] << 8 | this[e + 2] << 16 | this[e + 3] << 24
      }, d.prototype.readInt32BE = function(e, t) {
        return e >>>= 0, t || T(e, 4, this.length), this[e] << 24 | this[e + 1] << 16 | this[e + 2] << 8 | this[e + 3]
      }, d.prototype.readFloatLE = function(e, t) {
        return e >>>= 0, t || T(e, 4, this.length), n.read(this, e, !0, 23, 4)
      }, d.prototype.readFloatBE = function(e, t) {
        return e >>>= 0, t || T(e, 4, this.length), n.read(this, e, !1, 23, 4)
      }, d.prototype.readDoubleLE = function(e, t) {
        return e >>>= 0, t || T(e, 8, this.length), n.read(this, e, !0, 52, 8)
      }, d.prototype.readDoubleBE = function(e, t) {
        return e >>>= 0, t || T(e, 8, this.length), n.read(this, e, !1, 52, 8)
      }, d.prototype.writeUIntLE = function(e, t, r, i) {
        (e = +e, t >>>= 0, r >>>= 0, i) || C(this, e, t, r, Math.pow(2, 8 * r) - 1, 0);
        var a = 1,
          n = 0;
        for (this[t] = 255 & e; ++n < r && (a *= 256);) this[t + n] = e / a & 255;
        return t + r
      }, d.prototype.writeUIntBE = function(e, t, r, i) {
        (e = +e, t >>>= 0, r >>>= 0, i) || C(this, e, t, r, Math.pow(2, 8 * r) - 1, 0);
        var a = r - 1,
          n = 1;
        for (this[t + a] = 255 & e; 0 <= --a && (n *= 256);) this[t + a] = e / n & 255;
        return t + r
      }, d.prototype.writeUInt8 = function(e, t, r) {
        return e = +e, t >>>= 0, r || C(this, e, t, 1, 255, 0), this[t] = 255 & e, t + 1
      }, d.prototype.writeUInt16LE = function(e, t, r) {
        return e = +e, t >>>= 0, r || C(this, e, t, 2, 65535, 0), this[t] = 255 & e, this[t + 1] = e >>> 8, t + 2
      }, d.prototype.writeUInt16BE = function(e, t, r) {
        return e = +e, t >>>= 0, r || C(this, e, t, 2, 65535, 0), this[t] = e >>> 8, this[t + 1] = 255 & e, t + 2
      }, d.prototype.writeUInt32LE = function(e, t, r) {
        return e = +e, t >>>= 0, r || C(this, e, t, 4, 4294967295, 0), this[t + 3] = e >>> 24, this[t + 2] = e >>> 16, this[t + 1] = e >>> 8, this[t] = 255 & e, t + 4
      }, d.prototype.writeUInt32BE = function(e, t, r) {
        return e = +e, t >>>= 0, r || C(this, e, t, 4, 4294967295, 0), this[t] = e >>> 24, this[t + 1] = e >>> 16, this[t + 2] = e >>> 8, this[t + 3] = 255 & e, t + 4
      }, d.prototype.writeIntLE = function(e, t, r, i) {
        if (e = +e, t >>>= 0, !i) {
          var a = Math.pow(2, 8 * r - 1);
          C(this, e, t, r, a - 1, -a)
        }
        var n = 0,
          o = 1,
          s = 0;
        for (this[t] = 255 & e; ++n < r && (o *= 256);) e < 0 && 0 === s && 0 !== this[t + n - 1] && (s = 1), this[t + n] = (e / o >> 0) - s & 255;
        return t + r
      }, d.prototype.writeIntBE = function(e, t, r, i) {
        if (e = +e, t >>>= 0, !i) {
          var a = Math.pow(2, 8 * r - 1);
          C(this, e, t, r, a - 1, -a)
        }
        var n = r - 1,
          o = 1,
          s = 0;
        for (this[t + n] = 255 & e; 0 <= --n && (o *= 256);) e < 0 && 0 === s && 0 !== this[t + n + 1] && (s = 1), this[t + n] = (e / o >> 0) - s & 255;
        return t + r
      }, d.prototype.writeInt8 = function(e, t, r) {
        return e = +e, t >>>= 0, r || C(this, e, t, 1, 127, -128), e < 0 && (e = 255 + e + 1), this[t] = 255 & e, t + 1
      }, d.prototype.writeInt16LE = function(e, t, r) {
        return e = +e, t >>>= 0, r || C(this, e, t, 2, 32767, -32768), this[t] = 255 & e, this[t + 1] = e >>> 8, t + 2
      }, d.prototype.writeInt16BE = function(e, t, r) {
        return e = +e, t >>>= 0, r || C(this, e, t, 2, 32767, -32768), this[t] = e >>> 8, this[t + 1] = 255 & e, t + 2
      }, d.prototype.writeInt32LE = function(e, t, r) {
        return e = +e, t >>>= 0, r || C(this, e, t, 4, 2147483647, -2147483648), this[t] = 255 & e, this[t + 1] = e >>> 8, this[t + 2] = e >>> 16, this[t + 3] = e >>> 24, t + 4
      }, d.prototype.writeInt32BE = function(e, t, r) {
        return e = +e, t >>>= 0, r || C(this, e, t, 4, 2147483647, -2147483648), e < 0 && (e = 4294967295 + e + 1), this[t] = e >>> 24, this[t + 1] = e >>> 16, this[t + 2] = e >>> 8, this[t + 3] = 255 & e, t + 4
      }, d.prototype.writeFloatLE = function(e, t, r) {
        return L(this, e, t, !0, r)
      }, d.prototype.writeFloatBE = function(e, t, r) {
        return L(this, e, t, !1, r)
      }, d.prototype.writeDoubleLE = function(e, t, r) {
        return R(this, e, t, !0, r)
      }, d.prototype.writeDoubleBE = function(e, t, r) {
        return R(this, e, t, !1, r)
      }, d.prototype.copy = function(e, t, r, i) {
        if (!d.isBuffer(e)) throw new TypeError("argument should be a Buffer");
        if (r || (r = 0), i || 0 === i || (i = this.length), t >= e.length && (t = e.length), t || (t = 0), 0 < i && i < r && (i = r), i === r) return 0;
        if (0 === e.length || 0 === this.length) return 0;
        if (t < 0) throw new RangeError("targetStart out of bounds");
        if (r < 0 || r >= this.length) throw new RangeError("Index out of range");
        if (i < 0) throw new RangeError("sourceEnd out of bounds");
        i > this.length && (i = this.length), e.length - t < i - r && (i = e.length - t + r);
        var a = i - r;
        if (this === e && "function" == typeof Uint8Array.prototype.copyWithin) this.copyWithin(t, r, i);
        else if (this === e && r < t && t < i)
          for (var n = a - 1; 0 <= n; --n) e[n + t] = this[n + r];
        else Uint8Array.prototype.set.call(e, this.subarray(r, i), t);
        return a
      }, d.prototype.fill = function(e, t, r, i) {
        if ("string" == typeof e) {
          if ("string" == typeof t ? (i = t, t = 0, r = this.length) : "string" == typeof r && (i = r, r = this.length), void 0 !== i && "string" != typeof i) throw new TypeError("encoding must be a string");
          if ("string" == typeof i && !d.isEncoding(i)) throw new TypeError("Unknown encoding: " + i);
          if (1 === e.length) {
            var a = e.charCodeAt(0);
            ("utf8" === i && a < 128 || "latin1" === i) && (e = a)
          }
        } else "number" == typeof e && (e &= 255);
        if (t < 0 || this.length < t || this.length < r) throw new RangeError("Out of range index");
        if (r <= t) return this;
        var n;
        if (t >>>= 0, r = void 0 === r ? this.length : r >>> 0, e || (e = 0), "number" == typeof e)
          for (n = t; n < r; ++n) this[n] = e;
        else {
          var o = d.isBuffer(e) ? e : d.from(e, i),
            s = o.length;
          if (0 === s) throw new TypeError('The value "' + e + '" is invalid for argument "value"');
          for (n = 0; n < r - t; ++n) this[n + t] = o[n % s]
        }
        return this
      };
      var O = /[^+/0-9A-Za-z-_]/g;

      function D(e) {
        return e < 16 ? "0" + e.toString(16) : e.toString(16)
      }

      function A(e, t) {
        var r;
        t = t || 1 / 0;
        for (var i = e.length, a = null, n = [], o = 0; o < i; ++o) {
          if (55295 < (r = e.charCodeAt(o)) && r < 57344) {
            if (!a) {
              if (56319 < r) {
                -1 < (t -= 3) && n.push(239, 191, 189);
                continue
              }
              if (o + 1 === i) {
                -1 < (t -= 3) && n.push(239, 191, 189);
                continue
              }
              a = r;
              continue
            }
            if (r < 56320) {
              -1 < (t -= 3) && n.push(239, 191, 189), a = r;
              continue
            }
            r = 65536 + (a - 55296 << 10 | r - 56320)
          } else a && -1 < (t -= 3) && n.push(239, 191, 189);
          if (a = null, r < 128) {
            if ((t -= 1) < 0) break;
            n.push(r)
          } else if (r < 2048) {
            if ((t -= 2) < 0) break;
            n.push(r >> 6 | 192, 63 & r | 128)
          } else if (r < 65536) {
            if ((t -= 3) < 0) break;
            n.push(r >> 12 | 224, r >> 6 & 63 | 128, 63 & r | 128)
          } else {
            if (!(r < 1114112)) throw new Error("Invalid code point");
            if ((t -= 4) < 0) break;
            n.push(r >> 18 | 240, r >> 12 & 63 | 128, r >> 6 & 63 | 128, 63 & r | 128)
          }
        }
        return n
      }

      function I(e) {
        return i.toByteArray(function(e) {
          if ((e = (e = e.split("=")[0]).trim().replace(O, "")).length < 2) return "";
          for (; e.length % 4 != 0;) e += "=";
          return e
        }(e))
      }

      function k(e, t, r, i) {
        for (var a = 0; a < i && !(a + r >= t.length || a >= e.length); ++a) t[a + r] = e[a];
        return a
      }

      function U(e, t) {
        return e instanceof t || null != e && null != e.constructor && null != e.constructor.name && e.constructor.name === t.name
      }

      function F(e) {
        return e != e
      }
    }, {
      "base64-js": 1,
      ieee754: 8
    }],
    4: [function(e, t, r) {
      "use strict";
      t.exports = e("./").polyfill()
    }, {
      "./": 5
    }],
    5: [function(V, r, i) {
      (function(G, j) {
        var e, t;
        e = this, t = function() {
          "use strict";

          function u(e) {
            return "function" == typeof e
          }
          var r = Array.isArray ? Array.isArray : function(e) {
              return "[object Array]" === Object.prototype.toString.call(e)
            },
            i = 0,
            t = void 0,
            a = void 0,
            s = function(e, t) {
              c[i] = e, c[i + 1] = t, 2 === (i += 2) && (a ? a(f) : y())
            };
          var e = "undefined" != typeof window ? window : void 0,
            n = e || {},
            o = n.MutationObserver || n.WebKitMutationObserver,
            l = "undefined" == typeof self && void 0 !== G && "[object process]" === {}.toString.call(G),
            h = "undefined" != typeof Uint8ClampedArray && "undefined" != typeof importScripts && "undefined" != typeof MessageChannel;

          function d() {
            var e = setTimeout;
            return function() {
              return e(f, 1)
            }
          }
          var c = new Array(1e3);

          function f() {
            for (var e = 0; e < i; e += 2) {
              (0, c[e])(c[e + 1]), c[e] = void 0, c[e + 1] = void 0
            }
            i = 0
          }
          var p, m, v, g, y = void 0;

          function _(e, t) {
            var r = this,
              i = new this.constructor(w);
            void 0 === i[x] && F(i);
            var a = r._state;
            if (a) {
              var n = arguments[a - 1];
              s(function() {
                return k(a, i, n, r._result)
              })
            } else A(r, i, e, t);
            return i
          }

          function b(e) {
            if (e && "object" == typeof e && e.constructor === this) return e;
            var t = new this(w);
            return L(t, e), t
          }
          y = l ? function() {
            return G.nextTick(f)
          } : o ? (m = 0, v = new o(f), g = document.createTextNode(""), v.observe(g, {
            characterData: !0
          }), function() {
            g.data = m = ++m % 2
          }) : h ? ((p = new MessageChannel).port1.onmessage = f, function() {
            return p.port2.postMessage(0)
          }) : void 0 === e && "function" == typeof V ? function() {
            try {
              var e = Function("return this")().require("vertx");
              return void 0 !== (t = e.runOnLoop || e.runOnContext) ? function() {
                t(f)
              } : d()
            } catch (e) {
              return d()
            }
          }() : d();
          var x = Math.random().toString(36).substring(2);

          function w() {}
          var S = void 0,
            M = 1,
            E = 2,
            T = {
              error: null
            };

          function C(e) {
            try {
              return e.then
            } catch (e) {
              return T.error = e, T
            }
          }

          function P(e, t, r) {
            var i, a, n, o;
            t.constructor === e.constructor && r === _ && t.constructor.resolve === b ? (n = e, (o = t)._state === M ? O(n, o._result) : o._state === E ? D(n, o._result) : A(o, void 0, function(e) {
              return L(n, e)
            }, function(e) {
              return D(n, e)
            })) : r === T ? (D(e, T.error), T.error = null) : void 0 === r ? O(e, t) : u(r) ? (i = t, a = r, s(function(t) {
              var r = !1,
                e = function(e, t, r, i) {
                  try {
                    e.call(t, r, i)
                  } catch (e) {
                    return e
                  }
                }(a, i, function(e) {
                  r || (r = !0, i !== e ? L(t, e) : O(t, e))
                }, function(e) {
                  r || (r = !0, D(t, e))
                }, t._label);
              !r && e && (r = !0, D(t, e))
            }, e)) : O(e, t)
          }

          function L(e, t) {
            var r, i;
            e === t ? D(e, new TypeError("You cannot resolve a promise with itself")) : (i = typeof(r = t), null === r || "object" !== i && "function" !== i ? O(e, t) : P(e, t, C(t)))
          }

          function R(e) {
            e._onerror && e._onerror(e._result), I(e)
          }

          function O(e, t) {
            e._state === S && (e._result = t, e._state = M, 0 !== e._subscribers.length && s(I, e))
          }

          function D(e, t) {
            e._state === S && (e._state = E, e._result = t, s(R, e))
          }

          function A(e, t, r, i) {
            var a = e._subscribers,
              n = a.length;
            e._onerror = null, a[n] = t, a[n + M] = r, a[n + E] = i, 0 === n && e._state && s(I, e)
          }

          function I(e) {
            var t = e._subscribers,
              r = e._state;
            if (0 !== t.length) {
              for (var i = void 0, a = void 0, n = e._result, o = 0; o < t.length; o += 3) i = t[o], a = t[o + r], i ? k(r, i, a, n) : a(n);
              e._subscribers.length = 0
            }
          }

          function k(e, t, r, i) {
            var a = u(r),
              n = void 0,
              o = void 0,
              s = void 0,
              l = void 0;
            if (a) {
              if ((n = function(e, t) {
                  try {
                    return e(t)
                  } catch (e) {
                    return T.error = e, T
                  }
                }(r, i)) === T ? (l = !0, o = n.error, n.error = null) : s = !0, t === n) return void D(t, new TypeError("A promises callback cannot return that same promise."))
            } else n = i, s = !0;
            t._state !== S || (a && s ? L(t, n) : l ? D(t, o) : e === M ? O(t, n) : e === E && D(t, n))
          }
          var U = 0;

          function F(e) {
            e[x] = U++, e._state = void 0, e._result = void 0, e._subscribers = []
          }
          var N = function() {
            function e(e, t) {
              this._instanceConstructor = e, this.promise = new e(w), this.promise[x] || F(this.promise), r(t) ? (this.length = t.length, this._remaining = t.length, this._result = new Array(this.length), 0 === this.length ? O(this.promise, this._result) : (this.length = this.length || 0, this._enumerate(t), 0 === this._remaining && O(this.promise, this._result))) : D(this.promise, new Error("Array Methods must be provided an Array"))
            }
            return e.prototype._enumerate = function(e) {
              for (var t = 0; this._state === S && t < e.length; t++) this._eachEntry(e[t], t)
            }, e.prototype._eachEntry = function(t, e) {
              var r = this._instanceConstructor,
                i = r.resolve;
              if (i === b) {
                var a = C(t);
                if (a === _ && t._state !== S) this._settledAt(t._state, e, t._result);
                else if ("function" != typeof a) this._remaining--, this._result[e] = t;
                else if (r === B) {
                  var n = new r(w);
                  P(n, t, a), this._willSettleAt(n, e)
                } else this._willSettleAt(new r(function(e) {
                  return e(t)
                }), e)
              } else this._willSettleAt(i(t), e)
            }, e.prototype._settledAt = function(e, t, r) {
              var i = this.promise;
              i._state === S && (this._remaining--, e === E ? D(i, r) : this._result[t] = r), 0 === this._remaining && O(i, this._result)
            }, e.prototype._willSettleAt = function(e, t) {
              var r = this;
              A(e, void 0, function(e) {
                return r._settledAt(M, t, e)
              }, function(e) {
                return r._settledAt(E, t, e)
              })
            }, e
          }();
          var B = function() {
            function t(e) {
              this[x] = U++, this._result = this._state = void 0, this._subscribers = [], w !== e && ("function" != typeof e && function() {
                throw new TypeError("You must pass a resolver function as the first argument to the promise constructor")
              }(), this instanceof t ? function(t, e) {
                try {
                  e(function(e) {
                    L(t, e)
                  }, function(e) {
                    D(t, e)
                  })
                } catch (e) {
                  D(t, e)
                }
              }(this, e) : function() {
                throw new TypeError("Failed to construct 'Promise': Please use the 'new' operator, this object constructor cannot be called as a function.")
              }())
            }
            return t.prototype.catch = function(e) {
              return this.then(null, e)
            }, t.prototype.finally = function(t) {
              var r = this.constructor;
              return u(t) ? this.then(function(e) {
                return r.resolve(t()).then(function() {
                  return e
                })
              }, function(e) {
                return r.resolve(t()).then(function() {
                  throw e
                })
              }) : this.then(t, t)
            }, t
          }();
          return B.prototype.then = _, B.all = function(e) {
            return new N(this, e).promise
          }, B.race = function(a) {
            var n = this;
            return r(a) ? new n(function(e, t) {
              for (var r = a.length, i = 0; i < r; i++) n.resolve(a[i]).then(e, t)
            }) : new n(function(e, t) {
              return t(new TypeError("You must pass an array to race."))
            })
          }, B.resolve = b, B.reject = function(e) {
            var t = new this(w);
            return D(t, e), t
          }, B._setScheduler = function(e) {
            a = e
          }, B._setAsap = function(e) {
            s = e
          }, B._asap = s, B.polyfill = function() {
            var e = void 0;
            if (void 0 !== j) e = j;
            else if ("undefined" != typeof self) e = self;
            else try {
              e = Function("return this")()
            } catch (e) {
              throw new Error("polyfill failed because global object is unavailable in this environment")
            }
            var t = e.Promise;
            if (t) {
              var r = null;
              try {
                r = Object.prototype.toString.call(t.resolve())
              } catch (e) {}
              if ("[object Promise]" === r && !t.cast) return
            }
            e.Promise = B
          }, B.Promise = B
        }, "object" == typeof i && void 0 !== r ? r.exports = t() : e.ES6Promise = t()
      }).call(this, V("_process"), "undefined" != typeof global ? global : "undefined" != typeof self ? self : "undefined" != typeof window ? window : {})
    }, {
      _process: 13
    }],
    6: [function(e, i, a) {
      ! function(e, t) {
        if (void 0 !== a && void 0 !== i) t(a, i);
        else {
          var r = {
            exports: {}
          };
          t(r.exports, r), e.fetchJsonp = r.exports
        }
      }(this, function(e, t) {
        "use strict";
        var r = 5e3,
          i = "callback";

        function d(t) {
          try {
            delete window[t]
          } catch (e) {
            window[t] = void 0
          }
        }

        function c(e) {
          var t = document.getElementById(e);
          t && document.getElementsByTagName("head")[0].removeChild(t)
        }
        t.exports = function(n) {
          var o = arguments.length <= 1 || void 0 === arguments[1] ? {} : arguments[1],
            s = n,
            l = o.timeout || r,
            u = o.jsonpCallback || i,
            h = void 0;
          return new Promise(function(t, e) {
            var r = o.jsonpCallbackFunction || "jsonp_" + Date.now() + "_" + Math.ceil(1e5 * Math.random()),
              i = u + "_" + r;
            window[r] = function(e) {
              t({
                ok: !0,
                json: function() {
                  return Promise.resolve(e)
                }
              }), h && clearTimeout(h), c(i), d(r)
            }, s += -1 === s.indexOf("?") ? "?" : "&";
            var a = document.createElement("script");
            a.setAttribute("src", "" + s + u + "=" + r), o.charset && a.setAttribute("charset", o.charset), a.id = i, document.getElementsByTagName("head")[0].appendChild(a), h = setTimeout(function() {
              e(new Error("JSONP request to " + n + " timed out")), d(r), c(i), window[r] = function() {
                d(r)
              }
            }, l), a.onerror = function() {
              e(new Error("JSONP request to " + n + " failed")), d(r), c(i), h && clearTimeout(h)
            }
          })
        }
      })
    }, {}],
    7: [function(e, t, r) {
      var i = i || function(s) {
        "use strict";
        if (!(void 0 === s || "undefined" != typeof navigator && /MSIE [1-9]\./.test(navigator.userAgent))) {
          var e = s.document,
            l = function() {
              return s.URL || s.webkitURL || s
            },
            u = e.createElementNS("http://www.w3.org/1999/xhtml", "a"),
            h = "download" in u,
            d = /constructor/i.test(s.HTMLElement) || s.safari,
            // c = /CriOS\/[\d]+/.test(navigator.userAgent),
            f = function(e) {
              (s.setImmediate || s.setTimeout)(function() {
                throw e
              }, 0)
            },
            p = function(e) {
              setTimeout(function() {
                "string" == typeof e ? l().revokeObjectURL(e) : e.remove()
              }, 4e4)
            },
            m = function(e) {
              return /^\s*(?:text\/\S*|application\/xml|\S*\/\S*\+xml)\s*;.*charset\s*=\s*utf-8/i.test(e.type) ? new Blob([String.fromCharCode(65279), e], {
                type: e.type
              }) : e
            },
            i = function(e, r, t) {
              t || (e = m(e));
              var i, a = this,
                n = "application/octet-stream" === e.type,
                o = function() {
                  ! function(e, t, r) {
                    for (var i = (t = [].concat(t)).length; i--;) {
                      var a = e["on" + t[i]];
                      if ("function" == typeof a) try {
                        a.call(e, r || e)
                      } catch (e) {
                        f(e)
                      }
                    }
                  }(a, "writestart progress write writeend".split(" "))
                };
              if (a.readyState = a.INIT, h) return i = l().createObjectURL(e), void setTimeout(function() {
                var e, t;
                u.href = i, u.download = r, e = u, t = new MouseEvent("click"), e.dispatchEvent(t), o(), p(i), a.readyState = a.DONE
              });
              ! function() {
                if ((c || n && d) && s.FileReader) {
                  var t = new FileReader;
                  return t.onloadend = function() {
                    var e = c ? t.result : t.result.replace(/^data:[^;]*;/, "data:attachment/file;");
                    s.open(e, "_blank") || (s.location.href = e), e = void 0, a.readyState = a.DONE, o()
                  }, t.readAsDataURL(e), a.readyState = a.INIT
                }
                i || (i = l().createObjectURL(e)), n ? s.location.href = i : s.open(i, "_blank") || (s.location.href = i);
                a.readyState = a.DONE, o(), p(i)
              }()
            },
            t = i.prototype;
          return "undefined" != typeof navigator && navigator.msSaveOrOpenBlob ? function(e, t, r) {
            return t = t || e.name || "download", r || (e = m(e)), navigator.msSaveOrOpenBlob(e, t)
          } : (t.abort = function() {}, t.readyState = t.INIT = 0, t.WRITING = 1, t.DONE = 2, t.error = t.onwritestart = t.onprogress = t.onwrite = t.onabort = t.onerror = t.onwriteend = null, function(e, t, r) {
            return new i(e, t || e.name || "download", r)
          })
        }
      }("undefined" != typeof self && self || "undefined" != typeof window && window || this.content);
      void 0 !== t && t.exports && (t.exports.saveAs = i)
    }, {}],
    8: [function(e, t, r) {
      r.read = function(e, t, r, i, a) {
        var n, o, s = 8 * a - i - 1,
          l = (1 << s) - 1,
          u = l >> 1,
          h = -7,
          d = r ? a - 1 : 0,
          c = r ? -1 : 1,
          f = e[t + d];
        for (d += c, n = f & (1 << -h) - 1, f >>= -h, h += s; 0 < h; n = 256 * n + e[t + d], d += c, h -= 8);
        for (o = n & (1 << -h) - 1, n >>= -h, h += i; 0 < h; o = 256 * o + e[t + d], d += c, h -= 8);
        if (0 === n) n = 1 - u;
        else {
          if (n === l) return o ? NaN : 1 / 0 * (f ? -1 : 1);
          o += Math.pow(2, i), n -= u
        }
        return (f ? -1 : 1) * o * Math.pow(2, n - i)
      }, r.write = function(e, t, r, i, a, n) {
        var o, s, l, u = 8 * n - a - 1,
          h = (1 << u) - 1,
          d = h >> 1,
          c = 23 === a ? Math.pow(2, -24) - Math.pow(2, -77) : 0,
          f = i ? 0 : n - 1,
          p = i ? 1 : -1,
          m = t < 0 || 0 === t && 1 / t < 0 ? 1 : 0;
        for (t = Math.abs(t), isNaN(t) || t === 1 / 0 ? (s = isNaN(t) ? 1 : 0, o = h) : (o = Math.floor(Math.log(t) / Math.LN2), t * (l = Math.pow(2, -o)) < 1 && (o--, l *= 2), 2 <= (t += 1 <= o + d ? c / l : c * Math.pow(2, 1 - d)) * l && (o++, l /= 2), h <= o + d ? (s = 0, o = h) : 1 <= o + d ? (s = (t * l - 1) * Math.pow(2, a), o += d) : (s = t * Math.pow(2, d - 1) * Math.pow(2, a), o = 0)); 8 <= a; e[r + f] = 255 & s, f += p, s /= 256, a -= 8);
        for (o = o << a | s, u += a; 0 < u; e[r + f] = 255 & o, f += p, o /= 256, u -= 8);
        e[r + f - p] |= 128 * m
      }
    }, {}],
    9: [function(e, t, r) {
      "use strict";
      var i;

      function v(e, t) {
        return e.b === t.b && e.a === t.a
      }

      function g(e, t) {
        return e.b < t.b || e.b === t.b && e.a <= t.a
      }

      function y(e, t, r) {
        var i = t.b - e.b,
          a = r.b - t.b;
        return 0 < i + a ? i < a ? t.a - e.a + i / (i + a) * (e.a - r.a) : t.a - r.a + a / (i + a) * (r.a - e.a) : 0
      }

      function _(e, t, r) {
        var i = t.b - e.b,
          a = r.b - t.b;
        return 0 < i + a ? (t.a - r.a) * i + (t.a - e.a) * a : 0
      }

      function b(e, t) {
        return e.a < t.a || e.a === t.a && e.b <= t.b
      }

      function x(e, t, r) {
        var i = t.a - e.a,
          a = r.a - t.a;
        return 0 < i + a ? i < a ? t.b - e.b + i / (i + a) * (e.b - r.b) : t.b - r.b + a / (i + a) * (r.b - e.b) : 0
      }

      function w(e, t, r) {
        var i = t.a - e.a,
          a = r.a - t.a;
        return 0 < i + a ? (t.b - r.b) * i + (t.b - e.b) * a : 0
      }

      function S(e, t, r, i) {
        return (e = e < 0 ? 0 : e) <= (r = r < 0 ? 0 : r) ? 0 === r ? (t + i) / 2 : t + e / (e + r) * (i - t) : i + r / (e + r) * (t - i)
      }

      function o(e) {
        var t = n(e.b);
        return a(t, e.c), a(t.b, e.c), s(t, e.a), t
      }

      function M(e, t) {
        var r = !1,
          i = !1;
        e !== t && (t.a !== e.a && (i = !0, m(t.a, e.a)), t.d !== e.d && (r = !0, l(t.d, e.d)), f(t, e), i || (a(t, e.a), e.a.c = e), r || (s(t, e.d), e.d.a = e))
      }

      function d(e) {
        var t = e.b,
          r = !1;
        e.d !== e.b.d && (r = !0, l(e.d, e.b.d)), e.c === e ? m(e.a, null) : (e.b.d.a = J(e), e.a.c = e.c, f(e, J(e)), r || s(e, e.d)), t.c === t ? (m(t.a, null), l(t.d, null)) : (e.d.a = J(t), t.a.c = t.c, f(t, J(t))), p(e)
      }

      function E(e) {
        var t = n(e),
          r = t.b;
        return f(t, e.e), t.a = e.b.a, a(r, t.a), t.d = r.d = e.d, t = t.b, f(e.b, J(e.b)), f(e.b, t), e.b.a = t.a, t.b.a.c = t.b, t.b.d = e.b.d, t.f = e.f, t.b.f = e.b.f, t
      }

      function c(e, t) {
        var r = !1,
          i = n(e),
          a = i.b;
        return t.d !== e.d && (r = !0, l(t.d, e.d)), f(i, e.e), f(a, t), i.a = e.b.a, a.a = t.a, i.d = a.d = e.d, e.d.a = a, r || s(i, e.d), i
      }

      function n(e) {
        var t = new K,
          r = new K,
          i = e.b.h;
        return (((r.h = i).b.h = t).h = e).b.h = r, t.b = r, ((t.c = t).e = r).b = t, (r.c = r).e = t
      }

      function f(e, t) {
        var r = e.c,
          i = t.c;
        r.b.e = t, (i.b.e = e).c = i, t.c = r
      }

      function a(e, t) {
        var r = t.f,
          i = new ee(t, r);
        for (r.e = i, r = (t.f = i).c = e; r.a = i, (r = r.c) !== e;);
      }

      function s(e, t) {
        var r = t.d,
          i = new Q(t, r);
        for (r.b = i, (t.d = i).a = e, i.c = t.c, r = e; r.d = i, (r = r.e) !== e;);
      }

      function p(e) {
        var t = e.h;
        e = e.b.h, (t.b.h = e).b.h = t
      }

      function m(e, t) {
        for (var r = e.c, i = r; i.a = t, (i = i.c) !== r;);
        r = e.f, ((i = e.e).f = r).e = i
      }

      function l(e, t) {
        for (var r = e.a, i = r; i.d = t, (i = i.e) !== r;);
        r = e.d, ((i = e.b).d = r).b = i
      }

      function T(e) {
        var t = 0;
        return Math.abs(e[1]) > Math.abs(e[0]) && (t = 1), Math.abs(e[2]) > Math.abs(e[t]) && (t = 2), t
      }
      var C = 4e150;

      function P(e, t) {
        e.f += t.f, e.b.f += t.b.f
      }

      function u(e, t, r) {
        return e = e.a, t = t.a, r = r.a, t.b.a === e ? r.b.a === e ? g(t.a, r.a) ? _(r.b.a, t.a, r.a) <= 0 : 0 <= _(t.b.a, r.a, t.a) : _(r.b.a, e, r.a) <= 0 : r.b.a === e ? 0 <= _(t.b.a, e, t.a) : (t = y(t.b.a, e, t.a), (e = y(r.b.a, e, r.a)) <= t)
      }

      function L(e) {
        e.a.i = null;
        var t = e.e;
        t.a.c = t.c, t.c.a = t.a, e.e = null
      }

      function h(e, t) {
        d(e.a), e.c = !1, (e.a = t).i = e
      }

      function R(e) {
        for (var t = e.a.a;
          (e = ce(e)).a.a === t;);
        return e.c && (h(e, t = c(de(e).a.b, e.a.e)), e = ce(e)), e
      }

      function O(e, t, r) {
        var i = new he;
        return i.a = r, i.e = W(e.f, t.e, i), r.i = i
      }

      function D(e, t) {
        switch (e.s) {
          case 100130:
            return 0 != (1 & t);
          case 100131:
            return 0 !== t;
          case 100132:
            return 0 < t;
          case 100133:
            return t < 0;
          case 100134:
            return 2 <= t || t <= -2
        }
        return !1
      }

      function A(e) {
        var t = e.a,
          r = t.d;
        r.c = e.d, r.a = t, L(e)
      }

      function I(e, t, r) {
        for (t = (e = t).a; e !== r;) {
          e.c = !1;
          var i = de(e),
            a = i.a;
          if (a.a !== t.a) {
            if (!i.c) {
              A(e);
              break
            }
            h(i, a = c(t.c.b, a.b))
          }
          t.c !== a && (M(J(a), a), M(t, a)), A(e), t = i.a, e = i
        }
        return t
      }

      function k(e, t, r, i, a, n) {
        for (var o = !0; O(e, t, r.b), (r = r.c) !== i;);
        for (null === a && (a = de(t).a.b.c);
          (r = (i = de(t)).a.b).a === a.a;) r.c !== a && (M(J(r), r), M(J(a), r)), i.f = t.f - r.f, i.d = D(e, i.f), t.b = !0, !o && B(e, t) && (P(r, a), L(t), d(a)), o = !1, t = i, a = r;
        t.b = !0, n && j(e, t)
      }

      function U(e, t, r, i, a) {
        var n = [t.g[0], t.g[1], t.g[2]];
        t.d = null, t.d = e.o && e.o(n, r, i, e.c) || null, null === t.d && (a ? e.n || (Z(e, 100156), e.n = !0) : t.d = r[0])
      }

      function F(e, t, r) {
        var i = [null, null, null, null];
        i[0] = t.a.d, i[1] = r.a.d, U(e, t.a, i, [.5, .5, 0, 0], !1), M(t, r)
      }

      function N(e, t, r, i, a) {
        var n = Math.abs(t.b - e.b) + Math.abs(t.a - e.a),
          o = Math.abs(r.b - e.b) + Math.abs(r.a - e.a),
          s = a + 1;
        i[a] = .5 * o / (n + o), i[s] = .5 * n / (n + o), e.g[0] += i[a] * t.g[0] + i[s] * r.g[0], e.g[1] += i[a] * t.g[1] + i[s] * r.g[1], e.g[2] += i[a] * t.g[2] + i[s] * r.g[2]
      }

      function B(e, t) {
        var r = de(t),
          i = t.a,
          a = r.a;
        if (g(i.a, a.a)) {
          if (0 < _(a.b.a, i.a, a.a)) return !1;
          if (v(i.a, a.a)) {
            if (i.a !== a.a) {
              r = e.e;
              var n = i.a.h;
              if (0 <= n) {
                var o = (r = r.b).d,
                  s = r.e,
                  l = r.c,
                  u = l[n];
                o[u] = o[r.a], (l[o[u]] = u) <= --r.a && (u <= 1 ? le(r, u) : g(s[o[u >> 1]], s[o[u]]) ? le(r, u) : ue(r, u)), s[n] = null, l[n] = r.b, r.b = n
              } else
                for (r.c[-(n + 1)] = null; 0 < r.a && null === r.c[r.d[r.a - 1]];) --r.a;
              F(e, J(a), i)
            }
          } else E(a.b), M(i, J(a)), t.b = r.b = !0
        } else {
          if (_(i.b.a, a.a, i.a) < 0) return !1;
          ce(t).b = t.b = !0, E(i.b), M(J(a), i)
        }
        return !0
      }

      function G(e, t) {
        var r = de(t),
          i = t.a,
          a = r.a,
          n = i.a,
          o = a.a,
          s = i.b.a,
          l = a.b.a,
          u = new ee;
        if (_(s, e.a, n), _(l, e.a, o), n === o || Math.min(n.a, s.a) > Math.max(o.a, l.a)) return !1;
        if (g(n, o)) {
          if (0 < _(l, n, o)) return !1
        } else if (_(s, o, n) < 0) return !1;
        var h, d, c = s,
          f = n,
          p = l,
          m = o;
        if (g(c, f) || (h = c, c = f, f = h), g(p, m) || (h = p, p = m, m = h), g(c, p) || (h = c, c = p, p = h, h = f, f = m, m = h), g(p, f) ? g(f, m) ? ((h = y(c, p, f)) + (d = y(p, f, m)) < 0 && (h = -h, d = -d), u.b = S(h, p.b, d, f.b)) : ((h = _(c, p, f)) + (d = -_(c, m, f)) < 0 && (h = -h, d = -d), u.b = S(h, p.b, d, m.b)) : u.b = (p.b + f.b) / 2, b(c, f) || (h = c, c = f, f = h), b(p, m) || (h = p, p = m, m = h), b(c, p) || (h = c, c = p, p = h, h = f, f = m, m = h), b(p, f) ? b(f, m) ? ((h = x(c, p, f)) + (d = x(p, f, m)) < 0 && (h = -h, d = -d), u.a = S(h, p.a, d, f.a)) : ((h = w(c, p, f)) + (d = -w(c, m, f)) < 0 && (h = -h, d = -d), u.a = S(h, p.a, d, m.a)) : u.a = (p.a + f.a) / 2, g(u, e.a) && (u.b = e.a.b, u.a = e.a.a), g(c = g(n, o) ? n : o, u) && (u.b = c.b, u.a = c.a), v(u, n) || v(u, o)) return B(e, t), !1;
        if (!v(s, e.a) && 0 <= _(s, e.a, u) || !v(l, e.a) && _(l, e.a, u) <= 0) {
          if (l === e.a) return E(i.b), M(a.b, i), i = de(t = R(t)).a, I(e, de(t), r), k(e, t, J(i), i, i, !0), !0;
          if (s !== e.a) return 0 <= _(s, e.a, u) && (ce(t).b = t.b = !0, E(i.b), i.a.b = e.a.b, i.a.a = e.a.a), _(l, e.a, u) <= 0 && (t.b = r.b = !0, E(a.b), a.a.b = e.a.b, a.a.a = e.a.a), !1;
          for (E(a.b), M(i.e, J(a)), o = (n = r = t).a.b.a;
            (n = ce(n)).a.b.a === o;);
          return n = de(t = n).a.b.c, r.a = J(a), k(e, t, (a = I(e, r, null)).c, i.b.c, n, !0), !0
        }
        return E(i.b), E(a.b), M(J(a), i), i.a.b = u.b, i.a.a = u.a, i.a.h = re(e.e, i.a), i = i.a, a = [0, 0, 0, 0], u = [n.d, s.d, o.d, l.d], i.g[0] = i.g[1] = i.g[2] = 0, N(i, n, s, a, 0), N(i, o, l, a, 2), U(e, i, u, a, !0), ce(t).b = t.b = r.b = !0, !1
      }

      function j(e, t) {
        for (var r = de(t);;) {
          for (; r.b;) r = de(t = r);
          if (!t.b && (null === (t = ce(r = t)) || !t.b)) break;
          t.b = !1;
          var i, a = t.a,
            n = r.a;
          if (i = a.b.a !== n.b.a) e: {
            var o = de(i = t),
              s = i.a,
              l = o.a,
              u = void 0;
            if (g(s.b.a, l.b.a)) {
              if (_(s.b.a, l.b.a, s.a) < 0) {
                i = !1;
                break e
              }
              ce(i).b = i.b = !0, u = E(s), M(l.b, u), u.d.c = i.d
            } else {
              if (0 < _(l.b.a, s.b.a, l.a)) {
                i = !1;
                break e
              }
              i.b = o.b = !0, u = E(l), M(s.e, l.b), u.b.d.c = i.d
            }
            i = !0
          }
          if (i && (r.c ? (L(r), d(n), n = (r = de(t)).a) : t.c && (L(t), d(a), a = (t = ce(r)).a)), a.a !== n.a)
            if (a.b.a === n.b.a || t.c || r.c || a.b.a !== e.a && n.b.a !== e.a) B(e, t);
            else if (G(e, t)) break;
          a.a === n.a && a.b.a === n.b.a && (P(n, a), L(t), d(a), t = ce(r))
        }
      }

      function V(e, t) {
        for (var r = (e.a = t).c; null === r.i;)
          if ((r = r.c) === t.c) {
            r = e;
            var i = t;
            (o = new he).a = i.c.b;
            for (var a = (l = r.f).a; null !== (a = a.a).b && !l.c(l.b, o, a.b););
            var n = de(l = a.b),
              o = l.a;
            a = n.a;
            if (0 === _(o.b.a, i, o.a)) v((o = l.a).a, i) || v(o.b.a, i) || (E(o.b), l.c && (d(o.c), l.c = !1), M(i.c, o), V(r, i));
            else {
              var s = g(a.b.a, o.b.a) ? l : n;
              n = void 0;
              l.d || s.c ? (n = s === l ? c(i.c.b, o.e) : c(a.b.c.b, i.c).b, s.c ? h(s, n) : ((l = O(o = r, l, n)).f = ce(l).f + l.a.f, l.d = D(o, l.f)), V(r, i)) : k(r, l, i.c, i.c, null, !0)
            }
            return
          } if (l = (o = de(r = R(r.i))).a, (o = I(e, o, null)).c === l) {
          o = (l = o).c, a = de(r), n = r.a, s = a.a;
          var l, u = !1;
          n.b.a !== s.b.a && G(e, r), v(n.a, e.a) && (M(J(o), n), o = de(r = R(r)).a, I(e, de(r), a), u = !0), v(s.a, e.a) && (M(l, J(s)), l = I(e, a, null), u = !0), u ? k(e, r, l.c, o, o, !0) : (i = g(s.a, n.a) ? J(s) : n, k(e, r, i = c(l.c.b, i), i.c, i.c, !1), i.b.i.c = !0, j(e, r))
        } else k(e, r, o.c, l, l, !0)
      }

      function z(e, t) {
        var r = new he,
          i = o(e.b);
        i.a.b = C, i.a.a = t, i.b.a.b = -C, i.b.a.a = t, e.a = i.b.a, r.a = i, r.f = 0, r.d = !1, r.c = !1, r.h = !0, r.b = !1, i = W(i = e.f, i.a, r), r.e = i
      }

      function H(e) {
        this.a = new X, this.b = e, this.c = u
      }

      function W(e, t, r) {
        for (; null !== (t = t.c).b && !e.c(e.b, t.b, r););
        return e = new X(r, t.a, t), t.a.c = e, t.a = e
      }

      function X(e, t, r) {
        this.b = e || null, this.a = t || this, this.c = r || this
      }

      function q() {
        this.d = 0, this.p = this.b = this.q = null, this.j = [0, 0, 0], this.s = 100130, this.n = !1, this.o = this.a = this.e = this.f = null, this.m = !1, this.c = this.r = this.i = this.k = this.l = this.h = null
      }

      function Y(e, t) {
        if (e.d !== t)
          for (; e.d !== t;)
            if (e.d < t) switch (e.d) {
              case 0:
                Z(e, 100151), e.u(null);
                break;
              case 1:
                Z(e, 100152), e.t()
            } else switch (e.d) {
              case 2:
                Z(e, 100154), e.v();
                break;
              case 1:
                Z(e, 100153), e.w()
            }
      }

      function Z(e, t) {
        e.p && e.p(t, e.c)
      }

      function Q(e, t) {
        this.b = e || this, this.d = t || this, this.a = null, this.c = !1
      }

      function K() {
        (this.h = this).i = this.d = this.a = this.e = this.c = this.b = null, this.f = 0
      }

      function J(e) {
        return e.b.e
      }

      function $() {
        this.c = new ee, this.a = new Q, this.b = new K, this.d = new K, this.b.b = this.d, this.d.b = this.b
      }

      function ee(e, t) {
        this.e = e || this, this.f = t || this, this.d = this.c = null, this.g = [0, 0, 0], this.h = this.a = this.b = 0
      }

      function te() {
        this.c = [], this.d = null, this.a = 0, this.e = !1, this.b = new ae
      }

      function re(e, t) {
        if (e.e) {
          var r, i = e.b,
            a = ++i.a;
          return 2 * a > i.f && (i.f *= 2, i.c = ne(i.c, i.f + 1)), 0 === i.b ? r = a : (r = i.b, i.b = i.c[i.b]), i.e[r] = t, i.c[r] = a, i.d[a] = r, i.h && ue(i, a), r
        }
        return i = e.a++, e.c[i] = t, -(i + 1)
      }

      function ie(e) {
        if (0 === e.a) return se(e.b);
        var t = e.c[e.d[e.a - 1]];
        if (0 !== e.b.a && g(oe(e.b), t)) return se(e.b);
        for (; --e.a, 0 < e.a && null === e.c[e.d[e.a - 1]];);
        return t
      }

      function ae() {
        this.d = ne([0], 33), this.e = [null, null], this.c = [0, 0], this.a = 0, this.f = 32, this.b = 0, this.h = !1, this.d[1] = 1
      }

      function ne(e, t) {
        for (var r = Array(t), i = 0; i < e.length; i++) r[i] = e[i];
        for (; i < t; i++) r[i] = 0;
        return r
      }

      function oe(e) {
        return e.e[e.d[1]]
      }

      function se(e) {
        var t = e.d,
          r = e.e,
          i = e.c,
          a = t[1],
          n = r[a];
        return 0 < e.a && (t[1] = t[e.a], i[t[1]] = 1, r[a] = null, i[a] = e.b, e.b = a, 0 < --e.a && le(e, 1)), n
      }

      function le(e, t) {
        for (var r = e.d, i = e.e, a = e.c, n = t, o = r[n];;) {
          var s = n << 1;
          s < e.a && g(i[r[s + 1]], i[r[s]]) && (s += 1);
          var l = r[s];
          if (s > e.a || g(i[o], i[l])) {
            a[r[n] = o] = n;
            break
          }
          a[r[n] = l] = n, n = s
        }
      }

      function ue(e, t) {
        for (var r = e.d, i = e.e, a = e.c, n = t, o = r[n];;) {
          var s = n >> 1,
            l = r[s];
          if (0 === s || g(i[l], i[o])) {
            a[r[n] = o] = n;
            break
          }
          a[r[n] = l] = n, n = s
        }
      }

      function he() {
        this.e = this.a = null, this.f = 0, this.c = this.b = this.h = this.d = !1
      }

      function de(e) {
        return e.e.c.b
      }

      function ce(e) {
        return e.e.a.b
      }(i = q.prototype).x = function() {
        Y(this, 0)
      }, i.B = function(e, t) {
        switch (e) {
          case 100142:
            return;
          case 100140:
            switch (t) {
              case 100130:
              case 100131:
              case 100132:
              case 100133:
              case 100134:
                return void(this.s = t)
            }
            break;
          case 100141:
            return void(this.m = !!t);
          default:
            return void Z(this, 100900)
        }
        Z(this, 100901)
      }, i.y = function(e) {
        switch (e) {
          case 100142:
            return 0;
          case 100140:
            return this.s;
          case 100141:
            return this.m;
          default:
            Z(this, 100900)
        }
        return !1
      }, i.A = function(e, t, r) {
        this.j[0] = e, this.j[1] = t, this.j[2] = r
      }, i.z = function(e, t) {
        var r = t || null;
        switch (e) {
          case 100100:
          case 100106:
            this.h = r;
            break;
          case 100104:
          case 100110:
            this.l = r;
            break;
          case 100101:
          case 100107:
            this.k = r;
            break;
          case 100102:
          case 100108:
            this.i = r;
            break;
          case 100103:
          case 100109:
            this.p = r;
            break;
          case 100105:
          case 100111:
            this.o = r;
            break;
          case 100112:
            this.r = r;
            break;
          default:
            Z(this, 100900)
        }
      }, i.C = function(e, t) {
        var r = !1,
          i = [0, 0, 0];
        Y(this, 2);
        for (var a = 0; a < 3; ++a) {
          var n = e[a];
          n < -1e150 && (n = -1e150, r = !0), 1e150 < n && (n = 1e150, r = !0), i[a] = n
        }
        r && Z(this, 100155), null === (r = this.q) ? M(r = o(this.b), r.b) : (E(r), r = r.e), r.a.d = t, r.a.g[0] = i[0], r.a.g[1] = i[1], r.a.g[2] = i[2], r.f = 1, r.b.f = -1, this.q = r
      }, i.u = function(e) {
        Y(this, 0), this.d = 1, this.b = new $, this.c = e
      }, i.t = function() {
        Y(this, 1), this.d = 2, this.q = null
      }, i.v = function() {
        Y(this, 2), this.d = 1
      }, i.w = function() {
        Y(this, 1), this.d = 0;
        var e, t, r = !1,
          i = [l = this.j[0], a = this.j[1], o = this.j[2]];
        if (0 === l && 0 === a && 0 === o) {
          for (var a = [-2e150, -2e150, -2e150], n = [2e150, 2e150, 2e150], o = [], s = [], l = (r = this.b.c).e; l !== r; l = l.e)
            for (var u = 0; u < 3; ++u) {
              var h = l.g[u];
              h < n[u] && (n[u] = h, s[u] = l), h > a[u] && (a[u] = h, o[u] = l)
            }
          if (l = 0, a[1] - n[1] > a[0] - n[0] && (l = 1), a[2] - n[2] > a[l] - n[l] && (l = 2), n[l] >= a[l]) i[0] = 0, i[1] = 0, i[2] = 1;
          else {
            for (a = 0, n = s[l], o = o[l], s = [0, 0, 0], n = [n.g[0] - o.g[0], n.g[1] - o.g[1], n.g[2] - o.g[2]], u = [0, 0, 0], l = r.e; l !== r; l = l.e) u[0] = l.g[0] - o.g[0], u[1] = l.g[1] - o.g[1], u[2] = l.g[2] - o.g[2], s[0] = n[1] * u[2] - n[2] * u[1], s[1] = n[2] * u[0] - n[0] * u[2], s[2] = n[0] * u[1] - n[1] * u[0], a < (h = s[0] * s[0] + s[1] * s[1] + s[2] * s[2]) && (a = h, i[0] = s[0], i[1] = s[1], i[2] = s[2]);
            a <= 0 && (i[0] = i[1] = i[2] = 0, i[T(n)] = 1)
          }
          r = !0
        }
        for (s = T(i), l = this.b.c, a = (s + 1) % 3, o = (s + 2) % 3, s = 0 < i[s] ? 1 : -1, i = l.e; i !== l; i = i.e) i.b = i.g[a], i.a = s * i.g[o];
        if (r) {
          for (i = 0, l = (r = this.b.a).b; l !== r; l = l.b)
            if (!((a = l.a).f <= 0))
              for (; i += (a.a.b - a.b.a.b) * (a.a.a + a.b.a.a), (a = a.e) !== l.a;);
          if (i < 0)
            for (r = (i = this.b.c).e; r !== i; r = r.e) r.a = -r.a
        }
        for (this.n = !1, l = (i = this.b.b).h; l !== i; l = r) r = l.h, a = l.e, v(l.a, l.b.a) && l.e.e !== l && (F(this, a, l), d(l), a = (l = a).e), a.e === l && (a !== l && (a !== r && a !== r.b || (r = r.h), d(a)), l !== r && l !== r.b || (r = r.h), d(l));
        for (this.e = i = new te, l = (r = this.b.c).e; l !== r; l = l.e) l.h = re(i, l);
        for (function(e) {
            e.d = [];
            for (var t = 0; t < e.a; t++) e.d[t] = t;
            e.d.sort((r = e.c, function(e, t) {
                return g(r[e], r[t]) ? 1 : -1
              })), e.e = !0,
              function(e) {
                for (var t = e.a; 1 <= t; --t) le(e, t);
                e.h = !0
              }(e.b);
            var r
          }(i), this.f = new H(this), z(this, -C), z(this, C); null !== (i = ie(this.e));) {
          for (;;) {
            e: if (l = this.e, 0 === l.a) r = oe(l.b);
              else if (r = l.c[l.d[l.a - 1]], 0 !== l.b.a && (l = oe(l.b), g(l, r))) {
              r = l;
              break e
            }
            if (null === r || !v(r, i)) break;r = ie(this.e),
            F(this, i.c, r.c)
          }
          V(this, i)
        }
        for (this.a = this.f.a.a.b.a.a, i = 0; null !== (r = this.f.a.a.b);) r.h || ++i, L(r);
        for (this.f = null, (i = this.e).b = null, i.d = null, this.e = i.c = null, l = (i = this.b).a.b; l !== i.a; l = r) r = l.b, (l = l.a).e.e === l && (P(l.c, l), d(l));
        if (!this.n) {
          if (i = this.b, this.m)
            for (l = i.b.h; l !== i.b; l = r) r = l.h, l.b.d.c !== l.d.c ? l.f = l.d.c ? 1 : -1 : d(l);
          else
            for (l = i.a.b; l !== i.a; l = r)
              if (r = l.b, l.c) {
                for (l = l.a; g(l.b.a, l.a); l = l.c.b);
                for (; g(l.a, l.b.a); l = l.e);
                for (a = l.c.b, o = void 0; l.e !== a;)
                  if (g(l.b.a, a.a)) {
                    for (; a.e !== l && (g((t = a.e).b.a, t.a) || _(a.a, a.b.a, a.e.b.a) <= 0);) a = (o = c(a.e, a)).b;
                    a = a.c.b
                  } else {
                    for (; a.e !== l && (g((e = l.c.b).a, e.b.a) || 0 <= _(l.b.a, l.a, l.c.b.a));) l = (o = c(l, l.c.b)).b;
                    l = l.e
                  } for (; a.e.e !== l;) a = (o = c(a.e, a)).b
              } if (this.h || this.i || this.k || this.l)
            if (this.m) {
              for (r = (i = this.b).a.b; r !== i.a; r = r.b)
                if (r.c) {
                  for (this.h && this.h(2, this.c), l = r.a; this.k && this.k(l.a.d, this.c), (l = l.e) !== r.a;);
                  this.i && this.i(this.c)
                }
            } else {
              for (i = this.b, r = !!this.l, l = !1, a = -1, o = i.a.d; o !== i.a; o = o.d)
                if (o.c)
                  for (l || (this.h && this.h(4, this.c), l = !0), s = o.a; r && (a !== (n = s.b.d.c ? 0 : 1) && (a = n, this.l && this.l(!!a, this.c))), this.k && this.k(s.a.d, this.c), (s = s.e) !== o.a;);
              l && this.i && this.i(this.c)
            } if (this.r) {
            for (l = (i = this.b).a.b; l !== i.a; l = r)
              if (r = l.b, !l.c) {
                for (o = (a = l.a).e, s = void 0; o = (s = o).e, (s.d = null) === s.b.d && (s.c === s ? m(s.a, null) : (s.a.c = s.c, f(s, J(s))), (n = s.b).c === n ? m(n.a, null) : (n.a.c = n.c, f(n, J(n))), p(s)), s !== a;);
                a = l.d, ((l = l.b).d = a).b = l
              } return this.r(this.b), void(this.c = this.b = null)
          }
        }
        this.b = this.c = null
      }, this.libtess = {
        GluTesselator: q,
        windingRule: {
          GLU_TESS_WINDING_ODD: 100130,
          GLU_TESS_WINDING_NONZERO: 100131,
          GLU_TESS_WINDING_POSITIVE: 100132,
          GLU_TESS_WINDING_NEGATIVE: 100133,
          GLU_TESS_WINDING_ABS_GEQ_TWO: 100134
        },
        primitiveType: {
          GL_LINE_LOOP: 2,
          GL_TRIANGLES: 4,
          GL_TRIANGLE_STRIP: 5,
          GL_TRIANGLE_FAN: 6
        },
        errorType: {
          GLU_TESS_MISSING_BEGIN_POLYGON: 100151,
          GLU_TESS_MISSING_END_POLYGON: 100153,
          GLU_TESS_MISSING_BEGIN_CONTOUR: 100152,
          GLU_TESS_MISSING_END_CONTOUR: 100154,
          GLU_TESS_COORD_TOO_LARGE: 100155,
          GLU_TESS_NEED_COMBINE_CALLBACK: 100156
        },
        gluEnum: {
          GLU_TESS_MESH: 100112,
          GLU_TESS_TOLERANCE: 100142,
          GLU_TESS_WINDING_RULE: 100140,
          GLU_TESS_BOUNDARY_ONLY: 100141,
          GLU_INVALID_ENUM: 100900,
          GLU_INVALID_VALUE: 100901,
          GLU_TESS_BEGIN: 100100,
          GLU_TESS_VERTEX: 100101,
          GLU_TESS_END: 100102,
          GLU_TESS_ERROR: 100103,
          GLU_TESS_EDGE_FLAG: 100104,
          GLU_TESS_COMBINE: 100105,
          GLU_TESS_BEGIN_DATA: 100106,
          GLU_TESS_VERTEX_DATA: 100107,
          GLU_TESS_END_DATA: 100108,
          GLU_TESS_ERROR_DATA: 100109,
          GLU_TESS_EDGE_FLAG_DATA: 100110,
          GLU_TESS_COMBINE_DATA: 100111
        }
      }, q.prototype.gluDeleteTess = q.prototype.x, q.prototype.gluTessProperty = q.prototype.B, q.prototype.gluGetTessProperty = q.prototype.y, q.prototype.gluTessNormal = q.prototype.A, q.prototype.gluTessCallback = q.prototype.z, q.prototype.gluTessVertex = q.prototype.C, q.prototype.gluTessBeginPolygon = q.prototype.u, q.prototype.gluTessBeginContour = q.prototype.t, q.prototype.gluTessEndContour = q.prototype.v, q.prototype.gluTessEndPolygon = q.prototype.w, void 0 !== t && (t.exports = this.libtess)
    }, {}],
    10: [function(e, t, r) {
      "use strict";

      function P(e, t, r, i) {
        for (var a = e[t++], n = 1 << a, o = n + 1, s = o + 1, l = a + 1, u = (1 << l) - 1, h = 0, d = 0, c = 0, f = e[t++], p = new Int32Array(4096), m = null;;) {
          for (; h < 16 && 0 !== f;) d |= e[t++] << h, h += 8, 1 === f ? f = e[t++] : --f;
          if (h < l) break;
          var v = d & u;
          if (d >>= l, h -= l, v !== n) {
            if (v === o) break;
            for (var g = v < s ? v : m, y = 0, _ = g; n < _;) _ = p[_] >> 8, ++y;
            var b = _;
            if (i < c + y + (g !== v ? 1 : 0)) return void console.log("Warning, gif stream longer than expected.");
            r[c++] = b;
            var x = c += y;
            for (g !== v && (r[c++] = b), _ = g; y--;) _ = p[_], r[--x] = 255 & _, _ >>= 8;
            null !== m && s < 4096 && (p[s++] = m << 8 | b, u + 1 <= s && l < 12 && (++l, u = u << 1 | 1)), m = v
          } else s = o + 1, u = (1 << (l = a + 1)) - 1, m = null
        }
        return c !== i && console.log("Warning, gif stream shorter than expected."), r
      }
      try {
        r.GifWriter = function(g, e, t, r) {
          var y = 0,
            i = void 0 === (r = void 0 === r ? {} : r).loop ? null : r.loop,
            _ = void 0 === r.palette ? null : r.palette;
          if (e <= 0 || t <= 0 || 65535 < e || 65535 < t) throw new Error("Width/Height invalid.");

          function b(e) {
            var t = e.length;
            if (t < 2 || 256 < t || t & t - 1) throw new Error("Invalid code/color length, must be power of 2 and 2 .. 256.");
            return t
          }
          g[y++] = 71, g[y++] = 73, g[y++] = 70, g[y++] = 56, g[y++] = 57, g[y++] = 97;
          var a = 0,
            n = 0;
          if (null !== _) {
            for (var o = b(_); o >>= 1;) ++a;
            if (o = 1 << a, --a, void 0 !== r.background) {
              if (o <= (n = r.background)) throw new Error("Background index out of range.");
              if (0 === n) throw new Error("Background index explicitly passed as 0.")
            }
          }
          if (g[y++] = 255 & e, g[y++] = e >> 8 & 255, g[y++] = 255 & t, g[y++] = t >> 8 & 255, g[y++] = (null !== _ ? 128 : 0) | a, g[y++] = n, g[y++] = 0, null !== _)
            for (var s = 0, l = _.length; s < l; ++s) {
              var u = _[s];
              g[y++] = u >> 16 & 255, g[y++] = u >> 8 & 255, g[y++] = 255 & u
            }
          if (null !== i) {
            if (i < 0 || 65535 < i) throw new Error("Loop count invalid.");
            g[y++] = 33, g[y++] = 255, g[y++] = 11, g[y++] = 78, g[y++] = 69, g[y++] = 84, g[y++] = 83, g[y++] = 67, g[y++] = 65, g[y++] = 80, g[y++] = 69, g[y++] = 50, g[y++] = 46, g[y++] = 48, g[y++] = 3, g[y++] = 1, g[y++] = 255 & i, g[y++] = i >> 8 & 255, g[y++] = 0
          }
          var x = !1;
          this.addFrame = function(e, t, r, i, a, n) {
            if (!0 === x && (--y, x = !1), n = void 0 === n ? {} : n, e < 0 || t < 0 || 65535 < e || 65535 < t) throw new Error("x/y invalid.");
            if (r <= 0 || i <= 0 || 65535 < r || 65535 < i) throw new Error("Width/Height invalid.");
            if (a.length < r * i) throw new Error("Not enough pixels for the frame size.");
            var o = !0,
              s = n.palette;
            if (null == s && (o = !1, s = _), null == s) throw new Error("Must supply either a local or global palette.");
            for (var l = b(s), u = 0; l >>= 1;) ++u;
            l = 1 << u;
            var h = void 0 === n.delay ? 0 : n.delay,
              d = void 0 === n.disposal ? 0 : n.disposal;
            if (d < 0 || 3 < d) throw new Error("Disposal out of range.");
            var c = !1,
              f = 0;
            if (void 0 !== n.transparent && null !== n.transparent && (c = !0, (f = n.transparent) < 0 || l <= f)) throw new Error("Transparent color index.");
            if ((0 !== d || c || 0 !== h) && (g[y++] = 33, g[y++] = 249, g[y++] = 4, g[y++] = d << 2 | (!0 === c ? 1 : 0), g[y++] = 255 & h, g[y++] = h >> 8 & 255, g[y++] = f, g[y++] = 0), g[y++] = 44, g[y++] = 255 & e, g[y++] = e >> 8 & 255, g[y++] = 255 & t, g[y++] = t >> 8 & 255, g[y++] = 255 & r, g[y++] = r >> 8 & 255, g[y++] = 255 & i, g[y++] = i >> 8 & 255, g[y++] = !0 === o ? 128 | u - 1 : 0, !0 === o)
              for (var p = 0, m = s.length; p < m; ++p) {
                var v = s[p];
                g[y++] = v >> 16 & 255, g[y++] = v >> 8 & 255, g[y++] = 255 & v
              }
            return y = function(t, r, e, i) {
              t[r++] = e;
              var a = r++,
                n = 1 << e,
                o = n - 1,
                s = n + 1,
                l = s + 1,
                u = e + 1,
                h = 0,
                d = 0;

              function c(e) {
                for (; e <= h;) t[r++] = 255 & d, d >>= 8, h -= 8, r === a + 256 && (t[a] = 255, a = r++)
              }

              function f(e) {
                d |= e << h, h += u, c(8)
              }
              var p = i[0] & o,
                m = {};
              f(n);
              for (var v = 1, g = i.length; v < g; ++v) {
                var y = i[v] & o,
                  _ = p << 8 | y,
                  b = m[_];
                if (void 0 === b) {
                  for (d |= p << h, h += u; 8 <= h;) t[r++] = 255 & d, d >>= 8, h -= 8, r === a + 256 && (t[a] = 255, a = r++);
                  4096 === l ? (f(n), l = s + 1, u = e + 1, m = {}) : (1 << u <= l && ++u, m[_] = l++), p = y
                } else p = b
              }
              return f(p), f(s), c(1), a + 1 === r ? t[a] = 0 : (t[a] = r - a - 1, t[r++] = 0), r
            }(g, y, u < 2 ? 2 : u, a)
          }, this.end = function() {
            return !1 === x && (g[y++] = 59, x = !0), y
          }, this.getOutputBuffer = function() {
            return g
          }, this.setOutputBuffer = function(e) {
            g = e
          }, this.getOutputBufferPosition = function() {
            return y
          }, this.setOutputBufferPosition = function(e) {
            y = e
          }
        }, r.GifReader = function(x) {
          var e = 0;
          if (71 !== x[e++] || 73 !== x[e++] || 70 !== x[e++] || 56 !== x[e++] || 56 != (x[e++] + 1 & 253) || 97 !== x[e++]) throw new Error("Invalid GIF 87a/89a header.");
          var w = x[e++] | x[e++] << 8,
            t = x[e++] | x[e++] << 8,
            r = x[e++],
            i = r >> 7,
            a = 1 << 1 + (7 & r);
          x[e++], x[e++];
          var n = null,
            o = null;
          i && (n = e, e += 3 * (o = a));
          var s = !0,
            l = [],
            u = 0,
            h = null,
            d = 0,
            c = null;
          for (this.width = w, this.height = t; s && e < x.length;) switch (x[e++]) {
            case 33:
              switch (x[e++]) {
                case 255:
                  if (11 !== x[e] || 78 == x[e + 1] && 69 == x[e + 2] && 84 == x[e + 3] && 83 == x[e + 4] && 67 == x[e + 5] && 65 == x[e + 6] && 80 == x[e + 7] && 69 == x[e + 8] && 50 == x[e + 9] && 46 == x[e + 10] && 48 == x[e + 11] && 3 == x[e + 12] && 1 == x[e + 13] && 0 == x[e + 16]) e += 14, c = x[e++] | x[e++] << 8, e++;
                  else
                    for (e += 12;;) {
                      if (!(0 <= (C = x[e++]))) throw Error("Invalid block size");
                      if (0 === C) break;
                      e += C
                    }
                  break;
                case 249:
                  if (4 !== x[e++] || 0 !== x[e + 4]) throw new Error("Invalid graphics extension block.");
                  var f = x[e++];
                  u = x[e++] | x[e++] << 8, h = x[e++], 0 == (1 & f) && (h = null), d = f >> 2 & 7, e++;
                  break;
                case 254:
                  for (;;) {
                    if (!(0 <= (C = x[e++]))) throw Error("Invalid block size");
                    if (0 === C) break;
                    e += C
                  }
                  break;
                default:
                  throw new Error("Unknown graphic control label: 0x" + x[e - 1].toString(16))
              }
              break;
            case 44:
              var p = x[e++] | x[e++] << 8,
                m = x[e++] | x[e++] << 8,
                v = x[e++] | x[e++] << 8,
                g = x[e++] | x[e++] << 8,
                y = x[e++],
                _ = y >> 6 & 1,
                b = 1 << 1 + (7 & y),
                S = n,
                M = o,
                E = !1;
              y >> 7 && (E = !0, S = e, e += 3 * (M = b));
              var T = e;
              for (e++;;) {
                var C;
                if (!(0 <= (C = x[e++]))) throw Error("Invalid block size");
                if (0 === C) break;
                e += C
              }
              l.push({
                x: p,
                y: m,
                width: v,
                height: g,
                has_local_palette: E,
                palette_offset: S,
                palette_size: M,
                data_offset: T,
                data_length: e - T,
                transparent_index: h,
                interlaced: !!_,
                delay: u,
                disposal: d
              });
              break;
            case 59:
              s = !1;
              break;
            default:
              throw new Error("Unknown gif block: 0x" + x[e - 1].toString(16))
          }
          this.numFrames = function() {
            return l.length
          }, this.loopCount = function() {
            return c
          }, this.frameInfo = function(e) {
            if (e < 0 || e >= l.length) throw new Error("Frame index out of range.");
            return l[e]
          }, this.decodeAndBlitFrameBGRA = function(e, t) {
            var r = this.frameInfo(e),
              i = r.width * r.height,
              a = new Uint8Array(i);
            P(x, r.data_offset, a, i);
            var n = r.palette_offset,
              o = r.transparent_index;
            null === o && (o = 256);
            var s = r.width,
              l = w - s,
              u = s,
              h = 4 * (r.y * w + r.x),
              d = 4 * ((r.y + r.height) * w + r.x),
              c = h,
              f = 4 * l;
            !0 === r.interlaced && (f += 4 * w * 7);
            for (var p = 8, m = 0, v = a.length; m < v; ++m) {
              var g = a[m];
              if (0 === u && (u = s, d <= (c += f) && (f = 4 * l + 4 * w * (p - 1), c = h + (s + l) * (p << 1), p >>= 1)), g === o) c += 4;
              else {
                var y = x[n + 3 * g],
                  _ = x[n + 3 * g + 1],
                  b = x[n + 3 * g + 2];
                t[c++] = b, t[c++] = _, t[c++] = y, t[c++] = 255
              }--u
            }
          }, this.decodeAndBlitFrameRGBA = function(e, t) {
            var r = this.frameInfo(e),
              i = r.width * r.height,
              a = new Uint8Array(i);
            P(x, r.data_offset, a, i);
            var n = r.palette_offset,
              o = r.transparent_index;
            null === o && (o = 256);
            var s = r.width,
              l = w - s,
              u = s,
              h = 4 * (r.y * w + r.x),
              d = 4 * ((r.y + r.height) * w + r.x),
              c = h,
              f = 4 * l;
            !0 === r.interlaced && (f += 4 * w * 7);
            for (var p = 8, m = 0, v = a.length; m < v; ++m) {
              var g = a[m];
              if (0 === u && (u = s, d <= (c += f) && (f = 4 * l + 4 * w * (p - 1), c = h + (s + l) * (p << 1), p >>= 1)), g === o) c += 4;
              else {
                var y = x[n + 3 * g],
                  _ = x[n + 3 * g + 1],
                  b = x[n + 3 * g + 2];
                t[c++] = y, t[c++] = _, t[c++] = b, t[c++] = 255
              }--u
            }
          }
        }
      } catch (e) {}
    }, {}],
    11: [function(jr, t, r) {
      (function(Gr) {
        var e;
        e = this,
          function(E) {
            "use strict";
            var e, t;
            String.prototype.codePointAt || (e = function() {
              try {
                var e = {},
                  t = Object.defineProperty,
                  r = t(e, e, e) && t
              } catch (e) {}
              return r
            }(), t = function(e) {
              if (null == this) throw TypeError();
              var t = String(this),
                r = t.length,
                i = e ? Number(e) : 0;
              if (i != i && (i = 0), !(i < 0 || r <= i)) {
                var a, n = t.charCodeAt(i);
                return 55296 <= n && n <= 56319 && i + 1 < r && 56320 <= (a = t.charCodeAt(i + 1)) && a <= 57343 ? 1024 * (n - 55296) + a - 56320 + 65536 : n
              }
            }, e ? e(String.prototype, "codePointAt", {
              value: t,
              configurable: !0,
              writable: !0
            }) : String.prototype.codePointAt = t);
            var l = 0,
              n = -3;

            function r() {
              this.table = new Uint16Array(16), this.trans = new Uint16Array(288)
            }

            function o(e, t) {
              this.source = e, this.sourceIndex = 0, this.tag = 0, this.bitcount = 0, this.dest = t, this.destLen = 0, this.ltree = new r, this.dtree = new r
            }
            var s = new r,
              u = new r,
              h = new Uint8Array(30),
              d = new Uint16Array(30),
              c = new Uint8Array(30),
              f = new Uint16Array(30),
              p = new Uint8Array([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]),
              m = new r,
              v = new Uint8Array(320);

            function i(e, t, r, i) {
              var a, n;
              for (a = 0; a < r; ++a) e[a] = 0;
              for (a = 0; a < 30 - r; ++a) e[a + r] = a / r | 0;
              for (n = i, a = 0; a < 30; ++a) t[a] = n, n += 1 << e[a]
            }
            var g = new Uint16Array(16);

            function y(e, t, r, i) {
              var a, n;
              for (a = 0; a < 16; ++a) e.table[a] = 0;
              for (a = 0; a < i; ++a) e.table[t[r + a]]++;
              for (a = n = e.table[0] = 0; a < 16; ++a) g[a] = n, n += e.table[a];
              for (a = 0; a < i; ++a) t[r + a] && (e.trans[g[t[r + a]]++] = a)
            }

            function _(e) {
              e.bitcount-- || (e.tag = e.source[e.sourceIndex++], e.bitcount = 7);
              var t = 1 & e.tag;
              return e.tag >>>= 1, t
            }

            function b(e, t, r) {
              if (!t) return r;
              for (; e.bitcount < 24;) e.tag |= e.source[e.sourceIndex++] << e.bitcount, e.bitcount += 8;
              var i = e.tag & 65535 >>> 16 - t;
              return e.tag >>>= t, e.bitcount -= t, i + r
            }

            function x(e, t) {
              for (; e.bitcount < 24;) e.tag |= e.source[e.sourceIndex++] << e.bitcount, e.bitcount += 8;
              for (var r = 0, i = 0, a = 0, n = e.tag; i = 2 * i + (1 & n), n >>>= 1, ++a, r += t.table[a], 0 <= (i -= t.table[a]););
              return e.tag = n, e.bitcount -= a, t.trans[r + i]
            }

            function w(e, t, r) {
              var i, a, n, o, s, l;
              for (i = b(e, 5, 257), a = b(e, 5, 1), n = b(e, 4, 4), o = 0; o < 19; ++o) v[o] = 0;
              for (o = 0; o < n; ++o) {
                var u = b(e, 3, 0);
                v[p[o]] = u
              }
              for (y(m, v, 0, 19), s = 0; s < i + a;) {
                var h = x(e, m);
                switch (h) {
                  case 16:
                    var d = v[s - 1];
                    for (l = b(e, 2, 3); l; --l) v[s++] = d;
                    break;
                  case 17:
                    for (l = b(e, 3, 3); l; --l) v[s++] = 0;
                    break;
                  case 18:
                    for (l = b(e, 7, 11); l; --l) v[s++] = 0;
                    break;
                  default:
                    v[s++] = h
                }
              }
              y(t, v, 0, i), y(r, v, i, a)
            }

            function S(e, t, r) {
              for (;;) {
                var i, a, n, o, s = x(e, t);
                if (256 === s) return l;
                if (s < 256) e.dest[e.destLen++] = s;
                else
                  for (i = b(e, h[s -= 257], d[s]), a = x(e, r), o = n = e.destLen - b(e, c[a], f[a]); o < n + i; ++o) e.dest[e.destLen++] = e.dest[o]
              }
            }

            function M(e) {
              for (var t, r; 8 < e.bitcount;) e.sourceIndex--, e.bitcount -= 8;
              if ((t = 256 * (t = e.source[e.sourceIndex + 1]) + e.source[e.sourceIndex]) !== (65535 & ~(256 * e.source[e.sourceIndex + 3] + e.source[e.sourceIndex + 2]))) return n;
              for (e.sourceIndex += 4, r = t; r; --r) e.dest[e.destLen++] = e.source[e.sourceIndex++];
              return e.bitcount = 0, l
            }! function(e, t) {
              var r;
              for (r = 0; r < 7; ++r) e.table[r] = 0;
              for (e.table[7] = 24, e.table[8] = 152, e.table[9] = 112, r = 0; r < 24; ++r) e.trans[r] = 256 + r;
              for (r = 0; r < 144; ++r) e.trans[24 + r] = r;
              for (r = 0; r < 8; ++r) e.trans[168 + r] = 280 + r;
              for (r = 0; r < 112; ++r) e.trans[176 + r] = 144 + r;
              for (r = 0; r < 5; ++r) t.table[r] = 0;
              for (t.table[5] = 32, r = 0; r < 32; ++r) t.trans[r] = r
            }(s, u), i(h, d, 4, 3), i(c, f, 2, 1), h[28] = 0, d[28] = 258;
            var a = function(e, t) {
              var r, i, a = new o(e, t);
              do {
                switch (r = _(a), b(a, 2, 0)) {
                  case 0:
                    i = M(a);
                    break;
                  case 1:
                    i = S(a, s, u);
                    break;
                  case 2:
                    w(a, a.ltree, a.dtree), i = S(a, a.ltree, a.dtree);
                    break;
                  default:
                    i = n
                }
                if (i !== l) throw new Error("Data error")
              } while (!r);
              return a.destLen < a.dest.length ? "function" == typeof a.dest.slice ? a.dest.slice(0, a.destLen) : a.dest.subarray(0, a.destLen) : a.dest
            };

            function T(e, t, r, i, a) {
              return Math.pow(1 - a, 3) * e + 3 * Math.pow(1 - a, 2) * a * t + 3 * (1 - a) * Math.pow(a, 2) * r + Math.pow(a, 3) * i
            }

            function C() {
              this.x1 = Number.NaN, this.y1 = Number.NaN, this.x2 = Number.NaN, this.y2 = Number.NaN
            }

            function k() {
              this.commands = [], this.fill = "black", this.stroke = null, this.strokeWidth = 1
            }

            function P(e) {
              throw new Error(e)
            }

            function L(e, t) {
              e || P(t)
            }
            C.prototype.isEmpty = function() {
              return isNaN(this.x1) || isNaN(this.y1) || isNaN(this.x2) || isNaN(this.y2)
            }, C.prototype.addPoint = function(e, t) {
              "number" == typeof e && ((isNaN(this.x1) || isNaN(this.x2)) && (this.x1 = e, this.x2 = e), e < this.x1 && (this.x1 = e), e > this.x2 && (this.x2 = e)), "number" == typeof t && ((isNaN(this.y1) || isNaN(this.y2)) && (this.y1 = t, this.y2 = t), t < this.y1 && (this.y1 = t), t > this.y2 && (this.y2 = t))
            }, C.prototype.addX = function(e) {
              this.addPoint(e, null)
            }, C.prototype.addY = function(e) {
              this.addPoint(null, e)
            }, C.prototype.addBezier = function(e, t, r, i, a, n, o, s) {
              var l = this,
                u = [e, t],
                h = [r, i],
                d = [a, n],
                c = [o, s];
              this.addPoint(e, t), this.addPoint(o, s);
              for (var f = 0; f <= 1; f++) {
                var p = 6 * u[f] - 12 * h[f] + 6 * d[f],
                  m = -3 * u[f] + 9 * h[f] - 9 * d[f] + 3 * c[f],
                  v = 3 * h[f] - 3 * u[f];
                if (0 !== m) {
                  var g = Math.pow(p, 2) - 4 * v * m;
                  if (!(g < 0)) {
                    var y = (-p + Math.sqrt(g)) / (2 * m);
                    0 < y && y < 1 && (0 === f && l.addX(T(u[f], h[f], d[f], c[f], y)), 1 === f && l.addY(T(u[f], h[f], d[f], c[f], y)));
                    var _ = (-p - Math.sqrt(g)) / (2 * m);
                    0 < _ && _ < 1 && (0 === f && l.addX(T(u[f], h[f], d[f], c[f], _)), 1 === f && l.addY(T(u[f], h[f], d[f], c[f], _)))
                  }
                } else {
                  if (0 === p) continue;
                  var b = -v / p;
                  0 < b && b < 1 && (0 === f && l.addX(T(u[f], h[f], d[f], c[f], b)), 1 === f && l.addY(T(u[f], h[f], d[f], c[f], b)))
                }
              }
            }, C.prototype.addQuad = function(e, t, r, i, a, n) {
              var o = e + 2 / 3 * (r - e),
                s = t + 2 / 3 * (i - t),
                l = o + 1 / 3 * (a - e),
                u = s + 1 / 3 * (n - t);
              this.addBezier(e, t, o, s, l, u, a, n)
            }, k.prototype.moveTo = function(e, t) {
              this.commands.push({
                type: "M",
                x: e,
                y: t
              })
            }, k.prototype.lineTo = function(e, t) {
              this.commands.push({
                type: "L",
                x: e,
                y: t
              })
            }, k.prototype.curveTo = k.prototype.bezierCurveTo = function(e, t, r, i, a, n) {
              this.commands.push({
                type: "C",
                x1: e,
                y1: t,
                x2: r,
                y2: i,
                x: a,
                y: n
              })
            }, k.prototype.quadTo = k.prototype.quadraticCurveTo = function(e, t, r, i) {
              this.commands.push({
                type: "Q",
                x1: e,
                y1: t,
                x: r,
                y: i
              })
            }, k.prototype.close = k.prototype.closePath = function() {
              this.commands.push({
                type: "Z"
              })
            }, k.prototype.extend = function(e) {
              if (e.commands) e = e.commands;
              else if (e instanceof C) {
                var t = e;
                return this.moveTo(t.x1, t.y1), this.lineTo(t.x2, t.y1), this.lineTo(t.x2, t.y2), this.lineTo(t.x1, t.y2), void this.close()
              }
              Array.prototype.push.apply(this.commands, e)
            }, k.prototype.getBoundingBox = function() {
              for (var e = new C, t = 0, r = 0, i = 0, a = 0, n = 0; n < this.commands.length; n++) {
                var o = this.commands[n];
                switch (o.type) {
                  case "M":
                    e.addPoint(o.x, o.y), t = i = o.x, r = a = o.y;
                    break;
                  case "L":
                    e.addPoint(o.x, o.y), i = o.x, a = o.y;
                    break;
                  case "Q":
                    e.addQuad(i, a, o.x1, o.y1, o.x, o.y), i = o.x, a = o.y;
                    break;
                  case "C":
                    e.addBezier(i, a, o.x1, o.y1, o.x2, o.y2, o.x, o.y), i = o.x, a = o.y;
                    break;
                  case "Z":
                    i = t, a = r;
                    break;
                  default:
                    throw new Error("Unexpected path command " + o.type)
                }
              }
              return e.isEmpty() && e.addPoint(0, 0), e
            }, k.prototype.draw = function(e) {
              e.beginPath();
              for (var t = 0; t < this.commands.length; t += 1) {
                var r = this.commands[t];
                "M" === r.type ? e.moveTo(r.x, r.y) : "L" === r.type ? e.lineTo(r.x, r.y) : "C" === r.type ? e.bezierCurveTo(r.x1, r.y1, r.x2, r.y2, r.x, r.y) : "Q" === r.type ? e.quadraticCurveTo(r.x1, r.y1, r.x, r.y) : "Z" === r.type && e.closePath()
              }
              this.fill && (e.fillStyle = this.fill, e.fill()), this.stroke && (e.strokeStyle = this.stroke, e.lineWidth = this.strokeWidth, e.stroke())
            }, k.prototype.toPathData = function(n) {
              function e() {
                for (var e, t = arguments, r = "", i = 0; i < arguments.length; i += 1) {
                  var a = t[i];
                  0 <= a && 0 < i && (r += " "), r += (e = a, Math.round(e) === e ? "" + Math.round(e) : e.toFixed(n))
                }
                return r
              }
              n = void 0 !== n ? n : 2;
              for (var t = "", r = 0; r < this.commands.length; r += 1) {
                var i = this.commands[r];
                "M" === i.type ? t += "M" + e(i.x, i.y) : "L" === i.type ? t += "L" + e(i.x, i.y) : "C" === i.type ? t += "C" + e(i.x1, i.y1, i.x2, i.y2, i.x, i.y) : "Q" === i.type ? t += "Q" + e(i.x1, i.y1, i.x, i.y) : "Z" === i.type && (t += "Z")
              }
              return t
            }, k.prototype.toSVG = function(e) {
              var t = '<path d="';
              return t += this.toPathData(e), t += '"', this.fill && "black" !== this.fill && (null === this.fill ? t += ' fill="none"' : t += ' fill="' + this.fill + '"'), this.stroke && (t += ' stroke="' + this.stroke + '" stroke-width="' + this.strokeWidth + '"'), t += "/>"
            }, k.prototype.toDOMElement = function(e) {
              var t = this.toPathData(e),
                r = document.createElementNS("http://www.w3.org/2000/svg", "path");
              return r.setAttribute("d", t), r
            };
            var R = {
                fail: P,
                argument: L,
                assert: L
              },
              O = 2147483648,
              D = {},
              A = {},
              I = {};

            function U(e) {
              return function() {
                return e
              }
            }
            A.BYTE = function(e) {
              return R.argument(0 <= e && e <= 255, "Byte value should be between 0 and 255."), [e]
            }, I.BYTE = U(1), A.CHAR = function(e) {
              return [e.charCodeAt(0)]
            }, I.CHAR = U(1), A.CHARARRAY = function(e) {
              for (var t = [], r = 0; r < e.length; r += 1) t[r] = e.charCodeAt(r);
              return t
            }, I.CHARARRAY = function(e) {
              return e.length
            }, A.USHORT = function(e) {
              return [e >> 8 & 255, 255 & e]
            }, I.USHORT = U(2), A.SHORT = function(e) {
              return 32768 <= e && (e = -(65536 - e)), [e >> 8 & 255, 255 & e]
            }, I.SHORT = U(2), A.UINT24 = function(e) {
              return [e >> 16 & 255, e >> 8 & 255, 255 & e]
            }, I.UINT24 = U(3), A.ULONG = function(e) {
              return [e >> 24 & 255, e >> 16 & 255, e >> 8 & 255, 255 & e]
            }, I.ULONG = U(4), A.LONG = function(e) {
              return O <= e && (e = -(2 * O - e)), [e >> 24 & 255, e >> 16 & 255, e >> 8 & 255, 255 & e]
            }, I.LONG = U(4), A.FIXED = A.ULONG, I.FIXED = I.ULONG, A.FWORD = A.SHORT, I.FWORD = I.SHORT, A.UFWORD = A.USHORT, I.UFWORD = I.USHORT, A.LONGDATETIME = function(e) {
              return [0, 0, 0, 0, e >> 24 & 255, e >> 16 & 255, e >> 8 & 255, 255 & e]
            }, I.LONGDATETIME = U(8), A.TAG = function(e) {
              return R.argument(4 === e.length, "Tag should be exactly 4 ASCII characters."), [e.charCodeAt(0), e.charCodeAt(1), e.charCodeAt(2), e.charCodeAt(3)]
            }, I.TAG = U(4), A.Card8 = A.BYTE, I.Card8 = I.BYTE, A.Card16 = A.USHORT, I.Card16 = I.USHORT, A.OffSize = A.BYTE, I.OffSize = I.BYTE, A.SID = A.USHORT, I.SID = I.USHORT, A.NUMBER = function(e) {
              return -107 <= e && e <= 107 ? [e + 139] : 108 <= e && e <= 1131 ? [247 + ((e -= 108) >> 8), 255 & e] : -1131 <= e && e <= -108 ? [251 + ((e = -e - 108) >> 8), 255 & e] : -32768 <= e && e <= 32767 ? A.NUMBER16(e) : A.NUMBER32(e)
            }, I.NUMBER = function(e) {
              return A.NUMBER(e).length
            }, A.NUMBER16 = function(e) {
              return [28, e >> 8 & 255, 255 & e]
            }, I.NUMBER16 = U(3), A.NUMBER32 = function(e) {
              return [29, e >> 24 & 255, e >> 16 & 255, e >> 8 & 255, 255 & e]
            }, I.NUMBER32 = U(5), A.REAL = function(e) {
              var t = e.toString(),
                r = /\.(\d*?)(?:9{5,20}|0{5,20})\d{0,2}(?:e(.+)|$)/.exec(t);
              if (r) {
                var i = parseFloat("1e" + ((r[2] ? +r[2] : 0) + r[1].length));
                t = (Math.round(e * i) / i).toString()
              }
              for (var a = "", n = 0, o = t.length; n < o; n += 1) {
                var s = t[n];
                a += "e" === s ? "-" === t[++n] ? "c" : "b" : "." === s ? "a" : "-" === s ? "e" : s
              }
              for (var l = [30], u = 0, h = (a += 1 & a.length ? "f" : "ff").length; u < h; u += 2) l.push(parseInt(a.substr(u, 2), 16));
              return l
            }, I.REAL = function(e) {
              return A.REAL(e).length
            }, A.NAME = A.CHARARRAY, I.NAME = I.CHARARRAY, A.STRING = A.CHARARRAY, I.STRING = I.CHARARRAY, D.UTF8 = function(e, t, r) {
              for (var i = [], a = r, n = 0; n < a; n++, t += 1) i[n] = e.getUint8(t);
              return String.fromCharCode.apply(null, i)
            }, D.UTF16 = function(e, t, r) {
              for (var i = [], a = r / 2, n = 0; n < a; n++, t += 2) i[n] = e.getUint16(t);
              return String.fromCharCode.apply(null, i)
            }, A.UTF16 = function(e) {
              for (var t = [], r = 0; r < e.length; r += 1) {
                var i = e.charCodeAt(r);
                t[t.length] = i >> 8 & 255, t[t.length] = 255 & i
              }
              return t
            }, I.UTF16 = function(e) {
              return 2 * e.length
            };
            var F = {
              "x-mac-croatian": "ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®Š™´¨≠ŽØ∞±≤≥∆µ∂∑∏š∫ªºΩžø¿¡¬√ƒ≈Ć«Č… ÀÃÕŒœĐ—“”‘’÷◊©⁄€‹›Æ»–·‚„‰ÂćÁčÈÍÎÏÌÓÔđÒÚÛÙıˆ˜¯πË˚¸Êæˇ",
              "x-mac-cyrillic": "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ†°Ґ£§•¶І®©™Ђђ≠Ѓѓ∞±≤≥іµґЈЄєЇїЉљЊњјЅ¬√ƒ≈∆«»… ЋћЌќѕ–—“”‘’÷„ЎўЏџ№Ёёяабвгдежзийклмнопрстуфхцчшщъыьэю",
              "x-mac-gaelic": "ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ÆØḂ±≤≥ḃĊċḊḋḞḟĠġṀæøṁṖṗɼƒſṠ«»… ÀÃÕŒœ–—“”‘’ṡẛÿŸṪ€‹›Ŷŷṫ·Ỳỳ⁊ÂÊÁËÈÍÎÏÌÓÔ♣ÒÚÛÙıÝýŴŵẄẅẀẁẂẃ",
              "x-mac-greek": "Ä¹²É³ÖÜ΅àâä΄¨çéèêë£™îï•½‰ôö¦€ùûü†ΓΔΘΛΞΠß®©ΣΪ§≠°·Α±≤≥¥ΒΕΖΗΙΚΜΦΫΨΩάΝ¬ΟΡ≈Τ«»… ΥΧΆΈœ–―“”‘’÷ΉΊΌΎέήίόΏύαβψδεφγηιξκλμνοπώρστθωςχυζϊϋΐΰ­",
              "x-mac-icelandic": "ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûüÝ°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø¿¡¬√ƒ≈∆«»… ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄€ÐðÞþý·‚„‰ÂÊÁËÈÍÎÏÌÓÔÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ",
              "x-mac-inuit": "ᐃᐄᐅᐆᐊᐋᐱᐲᐳᐴᐸᐹᑉᑎᑏᑐᑑᑕᑖᑦᑭᑮᑯᑰᑲᑳᒃᒋᒌᒍᒎᒐᒑ°ᒡᒥᒦ•¶ᒧ®©™ᒨᒪᒫᒻᓂᓃᓄᓅᓇᓈᓐᓯᓰᓱᓲᓴᓵᔅᓕᓖᓗᓘᓚᓛᓪᔨᔩᔪᔫᔭ… ᔮᔾᕕᕖᕗ–—“”‘’ᕘᕙᕚᕝᕆᕇᕈᕉᕋᕌᕐᕿᖀᖁᖂᖃᖄᖅᖏᖐᖑᖒᖓᖔᖕᙱᙲᙳᙴᙵᙶᖖᖠᖡᖢᖣᖤᖥᖦᕼŁł",
              "x-mac-ce": "ÄĀāÉĄÖÜáąČäčĆćéŹźĎíďĒēĖóėôöõúĚěü†°Ę£§•¶ß®©™ę¨≠ģĮįĪ≤≥īĶ∂∑łĻļĽľĹĺŅņŃ¬√ńŇ∆«»… ňŐÕőŌ–—“”‘’÷◊ōŔŕŘ‹›řŖŗŠ‚„šŚśÁŤťÍŽžŪÓÔūŮÚůŰűŲųÝýķŻŁżĢˇ",
              macintosh: "ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø¿¡¬√ƒ≈∆«»… ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄€‹›ﬁﬂ‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ",
              "x-mac-romanian": "ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ĂȘ∞±≤≥¥µ∂∑∏π∫ªºΩăș¿¡¬√ƒ≈∆«»… ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄€‹›Țț‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ",
              "x-mac-turkish": "ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø¿¡¬√ƒ≈∆«»… ÀÃÕŒœ–—“”‘’÷◊ÿŸĞğİıŞş‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔÒÚÛÙˆ˜¯˘˙˚¸˝˛ˇ"
            };
            D.MACSTRING = function(e, t, r, i) {
              var a = F[i];
              if (void 0 !== a) {
                for (var n = "", o = 0; o < r; o++) {
                  var s = e.getUint8(t + o);
                  n += s <= 127 ? String.fromCharCode(s) : a[127 & s]
                }
                return n
              }
            };
            var N, B = "function" == typeof WeakMap && new WeakMap;

            function G(e) {
              return -128 <= e && e <= 127
            }

            function j(e, t, r) {
              for (var i = 0, a = e.length; t < a && i < 64 && 0 === e[t];) ++t, ++i;
              return r.push(128 | i - 1), t
            }

            function V(e, t, r) {
              for (var i = 0, a = e.length, n = t; n < a && i < 64;) {
                var o = e[n];
                if (!G(o)) break;
                if (0 === o && n + 1 < a && 0 === e[n + 1]) break;
                ++n, ++i
              }
              r.push(i - 1);
              for (var s = t; s < n; ++s) r.push(e[s] + 256 & 255);
              return n
            }

            function z(e, t, r) {
              for (var i = 0, a = e.length, n = t; n < a && i < 64;) {
                var o = e[n];
                if (0 === o) break;
                if (G(o) && n + 1 < a && G(e[n + 1])) break;
                ++n, ++i
              }
              r.push(64 | i - 1);
              for (var s = t; s < n; ++s) {
                var l = e[s];
                r.push(l + 65536 >> 8 & 255, l + 256 & 255)
              }
              return n
            }
            A.MACSTRING = function(e, t) {
              var r = function(e) {
                if (!N)
                  for (var t in N = {}, F) N[t] = new String(t);
                var r = N[e];
                if (void 0 !== r) {
                  if (B) {
                    var i = B.get(r);
                    if (void 0 !== i) return i
                  }
                  var a = F[e];
                  if (void 0 !== a) {
                    for (var n = {}, o = 0; o < a.length; o++) n[a.charCodeAt(o)] = o + 128;
                    return B && B.set(r, n), n
                  }
                }
              }(t);
              if (void 0 !== r) {
                for (var i = [], a = 0; a < e.length; a++) {
                  var n = e.charCodeAt(a);
                  if (128 <= n && void 0 === (n = r[n])) return;
                  i[a] = n
                }
                return i
              }
            }, I.MACSTRING = function(e, t) {
              var r = A.MACSTRING(e, t);
              return void 0 !== r ? r.length : 0
            }, A.VARDELTAS = function(e) {
              for (var t = 0, r = []; t < e.length;) {
                var i = e[t];
                t = 0 === i ? j(e, t, r) : -128 <= i && i <= 127 ? V(e, t, r) : z(e, t, r)
              }
              return r
            }, A.INDEX = function(e) {
              for (var t = 1, r = [t], i = [], a = 0; a < e.length; a += 1) {
                var n = A.OBJECT(e[a]);
                Array.prototype.push.apply(i, n), t += n.length, r.push(t)
              }
              if (0 === i.length) return [0, 0];
              for (var o = [], s = 1 + Math.floor(Math.log(t) / Math.log(2)) / 8 | 0, l = [void 0, A.BYTE, A.USHORT, A.UINT24, A.ULONG][s], u = 0; u < r.length; u += 1) {
                var h = l(r[u]);
                Array.prototype.push.apply(o, h)
              }
              return Array.prototype.concat(A.Card16(e.length), A.OffSize(s), o, i)
            }, I.INDEX = function(e) {
              return A.INDEX(e).length
            }, A.DICT = function(e) {
              for (var t = [], r = Object.keys(e), i = r.length, a = 0; a < i; a += 1) {
                var n = parseInt(r[a], 0),
                  o = e[n];
                t = (t = t.concat(A.OPERAND(o.value, o.type))).concat(A.OPERATOR(n))
              }
              return t
            }, I.DICT = function(e) {
              return A.DICT(e).length
            }, A.OPERATOR = function(e) {
              return e < 1200 ? [e] : [12, e - 1200]
            }, A.OPERAND = function(e, t) {
              var r = [];
              if (Array.isArray(t))
                for (var i = 0; i < t.length; i += 1) R.argument(e.length === t.length, "Not enough arguments given for type" + t), r = r.concat(A.OPERAND(e[i], t[i]));
              else if ("SID" === t) r = r.concat(A.NUMBER(e));
              else if ("offset" === t) r = r.concat(A.NUMBER32(e));
              else if ("number" === t) r = r.concat(A.NUMBER(e));
              else {
                if ("real" !== t) throw new Error("Unknown operand type " + t);
                r = r.concat(A.REAL(e))
              }
              return r
            }, A.OP = A.BYTE, I.OP = I.BYTE;
            var H = "function" == typeof WeakMap && new WeakMap;

            function W(e, t, r) {
              for (var i = 0; i < t.length; i += 1) {
                var a = t[i];
                this[a.name] = a.value
              }
              if (this.tableName = e, this.fields = t, r)
                for (var n = Object.keys(r), o = 0; o < n.length; o += 1) {
                  var s = n[o],
                    l = r[s];
                  void 0 !== this[s] && (this[s] = l)
                }
            }

            function X(e, t, r) {
              void 0 === r && (r = t.length);
              var i = new Array(t.length + 1);
              i[0] = {
                name: e + "Count",
                type: "USHORT",
                value: r
              };
              for (var a = 0; a < t.length; a++) i[a + 1] = {
                name: e + a,
                type: "USHORT",
                value: t[a]
              };
              return i
            }

            function q(e, t, r) {
              var i = t.length,
                a = new Array(i + 1);
              a[0] = {
                name: e + "Count",
                type: "USHORT",
                value: i
              };
              for (var n = 0; n < i; n++) a[n + 1] = {
                name: e + n,
                type: "TABLE",
                value: r(t[n], n)
              };
              return a
            }

            function Y(e, t, r) {
              var i = t.length,
                a = [];
              a[0] = {
                name: e + "Count",
                type: "USHORT",
                value: i
              };
              for (var n = 0; n < i; n++) a = a.concat(r(t[n], n));
              return a
            }

            function Z(e) {
              1 === e.format ? W.call(this, "coverageTable", [{
                name: "coverageFormat",
                type: "USHORT",
                value: 1
              }].concat(X("glyph", e.glyphs))) : R.assert(!1, "Can't create coverage table format 2 yet.")
            }

            function Q(e) {
              W.call(this, "scriptListTable", Y("scriptRecord", e, function(e, t) {
                var r = e.script,
                  i = r.defaultLangSys;
                return R.assert(!!i, "Unable to write GSUB: script " + e.tag + " has no default language system."), [{
                  name: "scriptTag" + t,
                  type: "TAG",
                  value: e.tag
                }, {
                  name: "script" + t,
                  type: "TABLE",
                  value: new W("scriptTable", [{
                    name: "defaultLangSys",
                    type: "TABLE",
                    value: new W("defaultLangSys", [{
                      name: "lookupOrder",
                      type: "USHORT",
                      value: 0
                    }, {
                      name: "reqFeatureIndex",
                      type: "USHORT",
                      value: i.reqFeatureIndex
                    }].concat(X("featureIndex", i.featureIndexes)))
                  }].concat(Y("langSys", r.langSysRecords, function(e, t) {
                    var r = e.langSys;
                    return [{
                      name: "langSysTag" + t,
                      type: "TAG",
                      value: e.tag
                    }, {
                      name: "langSys" + t,
                      type: "TABLE",
                      value: new W("langSys", [{
                        name: "lookupOrder",
                        type: "USHORT",
                        value: 0
                      }, {
                        name: "reqFeatureIndex",
                        type: "USHORT",
                        value: r.reqFeatureIndex
                      }].concat(X("featureIndex", r.featureIndexes)))
                    }]
                  })))
                }]
              }))
            }

            function K(e) {
              W.call(this, "featureListTable", Y("featureRecord", e, function(e, t) {
                var r = e.feature;
                return [{
                  name: "featureTag" + t,
                  type: "TAG",
                  value: e.tag
                }, {
                  name: "feature" + t,
                  type: "TABLE",
                  value: new W("featureTable", [{
                    name: "featureParams",
                    type: "USHORT",
                    value: r.featureParams
                  }].concat(X("lookupListIndex", r.lookupListIndexes)))
                }]
              }))
            }

            function J(e, r) {
              W.call(this, "lookupListTable", q("lookup", e, function(e) {
                var t = r[e.lookupType];
                return R.assert(!!t, "Unable to write GSUB lookup type " + e.lookupType + " tables."), new W("lookupTable", [{
                  name: "lookupType",
                  type: "USHORT",
                  value: e.lookupType
                }, {
                  name: "lookupFlag",
                  type: "USHORT",
                  value: e.lookupFlag
                }].concat(q("subtable", e.subtables, t)))
              }))
            }
            A.CHARSTRING = function(e) {
              if (H) {
                var t = H.get(e);
                if (void 0 !== t) return t
              }
              for (var r = [], i = e.length, a = 0; a < i; a += 1) {
                var n = e[a];
                r = r.concat(A[n.type](n.value))
              }
              return H && H.set(e, r), r
            }, I.CHARSTRING = function(e) {
              return A.CHARSTRING(e).length
            }, A.OBJECT = function(e) {
              var t = A[e.type];
              return R.argument(void 0 !== t, "No encoding function for type " + e.type), t(e.value)
            }, I.OBJECT = function(e) {
              var t = I[e.type];
              return R.argument(void 0 !== t, "No sizeOf function for type " + e.type), t(e.value)
            }, A.TABLE = function(e) {
              for (var t = [], r = e.fields.length, i = [], a = [], n = 0; n < r; n += 1) {
                var o = e.fields[n],
                  s = A[o.type];
                R.argument(void 0 !== s, "No encoding function for field type " + o.type + " (" + o.name + ")");
                var l = e[o.name];
                void 0 === l && (l = o.value);
                var u = s(l);
                "TABLE" === o.type ? (a.push(t.length), t = t.concat([0, 0]), i.push(u)) : t = t.concat(u)
              }
              for (var h = 0; h < i.length; h += 1) {
                var d = a[h],
                  c = t.length;
                R.argument(c < 65536, "Table " + e.tableName + " too big."), t[d] = c >> 8, t[d + 1] = 255 & c, t = t.concat(i[h])
              }
              return t
            }, I.TABLE = function(e) {
              for (var t = 0, r = e.fields.length, i = 0; i < r; i += 1) {
                var a = e.fields[i],
                  n = I[a.type];
                R.argument(void 0 !== n, "No sizeOf function for field type " + a.type + " (" + a.name + ")");
                var o = e[a.name];
                void 0 === o && (o = a.value), t += n(o), "TABLE" === a.type && (t += 2)
              }
              return t
            }, A.RECORD = A.TABLE, I.RECORD = I.TABLE, A.LITERAL = function(e) {
              return e
            }, I.LITERAL = function(e) {
              return e.length
            }, W.prototype.encode = function() {
              return A.TABLE(this)
            }, W.prototype.sizeOf = function() {
              return I.TABLE(this)
            };
            var $ = {
              Table: W,
              Record: W,
              Coverage: (Z.prototype = Object.create(W.prototype)).constructor = Z,
              ScriptList: (Q.prototype = Object.create(W.prototype)).constructor = Q,
              FeatureList: (K.prototype = Object.create(W.prototype)).constructor = K,
              LookupList: (J.prototype = Object.create(W.prototype)).constructor = J,
              ushortList: X,
              tableList: q,
              recordList: Y
            };

            function ee(e, t) {
              return e.getUint8(t)
            }

            function te(e, t) {
              return e.getUint16(t, !1)
            }

            function re(e, t) {
              return e.getUint32(t, !1)
            }

            function ie(e, t) {
              return e.getInt16(t, !1) + e.getUint16(t + 2, !1) / 65535
            }
            var ae = {
              byte: 1,
              uShort: 2,
              short: 2,
              uLong: 4,
              fixed: 4,
              longDateTime: 8,
              tag: 4
            };

            function ne(e, t) {
              this.data = e, this.offset = t, this.relativeOffset = 0
            }
            ne.prototype.parseByte = function() {
              var e = this.data.getUint8(this.offset + this.relativeOffset);
              return this.relativeOffset += 1, e
            }, ne.prototype.parseChar = function() {
              var e = this.data.getInt8(this.offset + this.relativeOffset);
              return this.relativeOffset += 1, e
            }, ne.prototype.parseCard8 = ne.prototype.parseByte, ne.prototype.parseCard16 = ne.prototype.parseUShort = function() {
              var e = this.data.getUint16(this.offset + this.relativeOffset);
              return this.relativeOffset += 2, e
            }, ne.prototype.parseSID = ne.prototype.parseUShort, ne.prototype.parseOffset16 = ne.prototype.parseUShort, ne.prototype.parseShort = function() {
              var e = this.data.getInt16(this.offset + this.relativeOffset);
              return this.relativeOffset += 2, e
            }, ne.prototype.parseF2Dot14 = function() {
              var e = this.data.getInt16(this.offset + this.relativeOffset) / 16384;
              return this.relativeOffset += 2, e
            }, ne.prototype.parseOffset32 = ne.prototype.parseULong = function() {
              var e = re(this.data, this.offset + this.relativeOffset);
              return this.relativeOffset += 4, e
            }, ne.prototype.parseFixed = function() {
              var e = ie(this.data, this.offset + this.relativeOffset);
              return this.relativeOffset += 4, e
            }, ne.prototype.parseString = function(e) {
              var t = this.data,
                r = this.offset + this.relativeOffset,
                i = "";
              this.relativeOffset += e;
              for (var a = 0; a < e; a++) i += String.fromCharCode(t.getUint8(r + a));
              return i
            }, ne.prototype.parseTag = function() {
              return this.parseString(4)
            }, ne.prototype.parseLongDateTime = function() {
              var e = re(this.data, this.offset + this.relativeOffset + 4);
              return e -= 2082844800, this.relativeOffset += 8, e
            }, ne.prototype.parseVersion = function(e) {
              var t = te(this.data, this.offset + this.relativeOffset),
                r = te(this.data, this.offset + this.relativeOffset + 2);
              return this.relativeOffset += 4, void 0 === e && (e = 4096), t + r / e / 10
            }, ne.prototype.skip = function(e, t) {
              void 0 === t && (t = 1), this.relativeOffset += ae[e] * t
            }, ne.prototype.parseULongList = function(e) {
              void 0 === e && (e = this.parseULong());
              for (var t = new Array(e), r = this.data, i = this.offset + this.relativeOffset, a = 0; a < e; a++) t[a] = r.getUint32(i), i += 4;
              return this.relativeOffset += 4 * e, t
            }, ne.prototype.parseOffset16List = ne.prototype.parseUShortList = function(e) {
              void 0 === e && (e = this.parseUShort());
              for (var t = new Array(e), r = this.data, i = this.offset + this.relativeOffset, a = 0; a < e; a++) t[a] = r.getUint16(i), i += 2;
              return this.relativeOffset += 2 * e, t
            }, ne.prototype.parseShortList = function(e) {
              for (var t = new Array(e), r = this.data, i = this.offset + this.relativeOffset, a = 0; a < e; a++) t[a] = r.getInt16(i), i += 2;
              return this.relativeOffset += 2 * e, t
            }, ne.prototype.parseByteList = function(e) {
              for (var t = new Array(e), r = this.data, i = this.offset + this.relativeOffset, a = 0; a < e; a++) t[a] = r.getUint8(i++);
              return this.relativeOffset += e, t
            }, ne.prototype.parseList = function(e, t) {
              t || (t = e, e = this.parseUShort());
              for (var r = new Array(e), i = 0; i < e; i++) r[i] = t.call(this);
              return r
            }, ne.prototype.parseList32 = function(e, t) {
              t || (t = e, e = this.parseULong());
              for (var r = new Array(e), i = 0; i < e; i++) r[i] = t.call(this);
              return r
            }, ne.prototype.parseRecordList = function(e, t) {
              t || (t = e, e = this.parseUShort());
              for (var r = new Array(e), i = Object.keys(t), a = 0; a < e; a++) {
                for (var n = {}, o = 0; o < i.length; o++) {
                  var s = i[o],
                    l = t[s];
                  n[s] = l.call(this)
                }
                r[a] = n
              }
              return r
            }, ne.prototype.parseRecordList32 = function(e, t) {
              t || (t = e, e = this.parseULong());
              for (var r = new Array(e), i = Object.keys(t), a = 0; a < e; a++) {
                for (var n = {}, o = 0; o < i.length; o++) {
                  var s = i[o],
                    l = t[s];
                  n[s] = l.call(this)
                }
                r[a] = n
              }
              return r
            }, ne.prototype.parseStruct = function(e) {
              if ("function" == typeof e) return e.call(this);
              for (var t = Object.keys(e), r = {}, i = 0; i < t.length; i++) {
                var a = t[i],
                  n = e[a];
                r[a] = n.call(this)
              }
              return r
            }, ne.prototype.parseValueRecord = function(e) {
              if (void 0 === e && (e = this.parseUShort()), 0 !== e) {
                var t = {};
                return 1 & e && (t.xPlacement = this.parseShort()), 2 & e && (t.yPlacement = this.parseShort()), 4 & e && (t.xAdvance = this.parseShort()), 8 & e && (t.yAdvance = this.parseShort()), 16 & e && (t.xPlaDevice = void 0, this.parseShort()), 32 & e && (t.yPlaDevice = void 0, this.parseShort()), 64 & e && (t.xAdvDevice = void 0, this.parseShort()), 128 & e && (t.yAdvDevice = void 0, this.parseShort()), t
              }
            }, ne.prototype.parseValueRecordList = function() {
              for (var e = this.parseUShort(), t = this.parseUShort(), r = new Array(t), i = 0; i < t; i++) r[i] = this.parseValueRecord(e);
              return r
            }, ne.prototype.parsePointer = function(e) {
              var t = this.parseOffset16();
              if (0 < t) return new ne(this.data, this.offset + t).parseStruct(e)
            }, ne.prototype.parsePointer32 = function(e) {
              var t = this.parseOffset32();
              if (0 < t) return new ne(this.data, this.offset + t).parseStruct(e)
            }, ne.prototype.parseListOfLists = function(e) {
              for (var t = this, r = this.parseOffset16List(), i = r.length, a = this.relativeOffset, n = new Array(i), o = 0; o < i; o++) {
                var s = r[o];
                if (0 !== s)
                  if (t.relativeOffset = s, e) {
                    for (var l = t.parseOffset16List(), u = new Array(l.length), h = 0; h < l.length; h++) t.relativeOffset = s + l[h], u[h] = e.call(t);
                    n[o] = u
                  } else n[o] = t.parseUShortList();
                else n[o] = void 0
              }
              return this.relativeOffset = a, n
            }, ne.prototype.parseCoverage = function() {
              var e = this.offset + this.relativeOffset,
                t = this.parseUShort(),
                r = this.parseUShort();
              if (1 === t) return {
                format: 1,
                glyphs: this.parseUShortList(r)
              };
              if (2 !== t) throw new Error("0x" + e.toString(16) + ": Coverage format must be 1 or 2.");
              for (var i = new Array(r), a = 0; a < r; a++) i[a] = {
                start: this.parseUShort(),
                end: this.parseUShort(),
                index: this.parseUShort()
              };
              return {
                format: 2,
                ranges: i
              }
            }, ne.prototype.parseClassDef = function() {
              var e = this.offset + this.relativeOffset,
                t = this.parseUShort();
              if (1 === t) return {
                format: 1,
                startGlyph: this.parseUShort(),
                classes: this.parseUShortList()
              };
              if (2 === t) return {
                format: 2,
                ranges: this.parseRecordList({
                  start: ne.uShort,
                  end: ne.uShort,
                  classId: ne.uShort
                })
              };
              throw new Error("0x" + e.toString(16) + ": ClassDef format must be 1 or 2.")
            }, ne.list = function(e, t) {
              return function() {
                return this.parseList(e, t)
              }
            }, ne.list32 = function(e, t) {
              return function() {
                return this.parseList32(e, t)
              }
            }, ne.recordList = function(e, t) {
              return function() {
                return this.parseRecordList(e, t)
              }
            }, ne.recordList32 = function(e, t) {
              return function() {
                return this.parseRecordList32(e, t)
              }
            }, ne.pointer = function(e) {
              return function() {
                return this.parsePointer(e)
              }
            }, ne.pointer32 = function(e) {
              return function() {
                return this.parsePointer32(e)
              }
            }, ne.tag = ne.prototype.parseTag, ne.byte = ne.prototype.parseByte, ne.uShort = ne.offset16 = ne.prototype.parseUShort, ne.uShortList = ne.prototype.parseUShortList, ne.uLong = ne.offset32 = ne.prototype.parseULong, ne.uLongList = ne.prototype.parseULongList, ne.struct = ne.prototype.parseStruct, ne.coverage = ne.prototype.parseCoverage, ne.classDef = ne.prototype.parseClassDef;
            var oe = {
              reserved: ne.uShort,
              reqFeatureIndex: ne.uShort,
              featureIndexes: ne.uShortList
            };
            ne.prototype.parseScriptList = function() {
              return this.parsePointer(ne.recordList({
                tag: ne.tag,
                script: ne.pointer({
                  defaultLangSys: ne.pointer(oe),
                  langSysRecords: ne.recordList({
                    tag: ne.tag,
                    langSys: ne.pointer(oe)
                  })
                })
              })) || []
            }, ne.prototype.parseFeatureList = function() {
              return this.parsePointer(ne.recordList({
                tag: ne.tag,
                feature: ne.pointer({
                  featureParams: ne.offset16,
                  lookupListIndexes: ne.uShortList
                })
              })) || []
            }, ne.prototype.parseLookupList = function(i) {
              return this.parsePointer(ne.list(ne.pointer(function() {
                var e = this.parseUShort();
                R.argument(1 <= e && e <= 9, "GPOS/GSUB lookup type " + e + " unknown.");
                var t = this.parseUShort(),
                  r = 16 & t;
                return {
                  lookupType: e,
                  lookupFlag: t,
                  subtables: this.parseList(ne.pointer(i[e])),
                  markFilteringSet: r ? this.parseUShort() : void 0
                }
              }))) || []
            }, ne.prototype.parseFeatureVariationsList = function() {
              return this.parsePointer32(function() {
                var e = this.parseUShort(),
                  t = this.parseUShort();
                return R.argument(1 === e && t < 1, "GPOS/GSUB feature variations table unknown."), this.parseRecordList32({
                  conditionSetOffset: ne.offset32,
                  featureTableSubstitutionOffset: ne.offset32
                })
              }) || []
            };
            var se = {
              getByte: ee,
              getCard8: ee,
              getUShort: te,
              getCard16: te,
              getShort: function(e, t) {
                return e.getInt16(t, !1)
              },
              getULong: re,
              getFixed: ie,
              getTag: function(e, t) {
                for (var r = "", i = t; i < t + 4; i += 1) r += String.fromCharCode(e.getInt8(i));
                return r
              },
              getOffset: function(e, t, r) {
                for (var i = 0, a = 0; a < r; a += 1) i <<= 8, i += e.getUint8(t + a);
                return i
              },
              getBytes: function(e, t, r) {
                for (var i = [], a = t; a < r; a += 1) i.push(e.getUint8(a));
                return i
              },
              bytesToString: function(e) {
                for (var t = "", r = 0; r < e.length; r += 1) t += String.fromCharCode(e[r]);
                return t
              },
              Parser: ne
            };
            var le = {
                parse: function(e, t) {
                  var r = {};
                  r.version = se.getUShort(e, t), R.argument(0 === r.version, "cmap table version should be 0."), r.numTables = se.getUShort(e, t + 2);
                  for (var i = -1, a = r.numTables - 1; 0 <= a; a -= 1) {
                    var n = se.getUShort(e, t + 4 + 8 * a),
                      o = se.getUShort(e, t + 4 + 8 * a + 2);
                    if (3 === n && (0 === o || 1 === o || 10 === o) || 0 === n && (0 === o || 1 === o || 2 === o || 3 === o || 4 === o)) {
                      i = se.getULong(e, t + 4 + 8 * a + 4);
                      break
                    }
                  }
                  if (-1 === i) throw new Error("No valid cmap sub-tables found.");
                  var s = new se.Parser(e, t + i);
                  if (r.format = s.parseUShort(), 12 === r.format) ! function(e, t) {
                    var r;
                    t.parseUShort(), e.length = t.parseULong(), e.language = t.parseULong(), e.groupCount = r = t.parseULong(), e.glyphIndexMap = {};
                    for (var i = 0; i < r; i += 1)
                      for (var a = t.parseULong(), n = t.parseULong(), o = t.parseULong(), s = a; s <= n; s += 1) e.glyphIndexMap[s] = o, o++
                  }(r, s);
                  else {
                    if (4 !== r.format) throw new Error("Only format 4 and 12 cmap tables are supported (found format " + r.format + ").");
                    ! function(e, t, r, i, a) {
                      var n;
                      e.length = t.parseUShort(), e.language = t.parseUShort(), e.segCount = n = t.parseUShort() >> 1, t.skip("uShort", 3), e.glyphIndexMap = {};
                      for (var o = new se.Parser(r, i + a + 14), s = new se.Parser(r, i + a + 16 + 2 * n), l = new se.Parser(r, i + a + 16 + 4 * n), u = new se.Parser(r, i + a + 16 + 6 * n), h = i + a + 16 + 8 * n, d = 0; d < n - 1; d += 1)
                        for (var c = void 0, f = o.parseUShort(), p = s.parseUShort(), m = l.parseShort(), v = u.parseUShort(), g = p; g <= f; g += 1) 0 !== v ? (h = u.offset + u.relativeOffset - 2, h += v, h += 2 * (g - p), 0 !== (c = se.getUShort(r, h)) && (c = c + m & 65535)) : c = g + m & 65535, e.glyphIndexMap[g] = c
                    }(r, s, e, t, i)
                  }
                  return r
                },
                make: function(e) {
                  var t, r = !0;
                  for (t = e.length - 1; 0 < t; t -= 1)
                    if (65535 < e.get(t).unicode) {
                      console.log("Adding CMAP format 12 (needed!)"), r = !1;
                      break
                    } var i = [{
                    name: "version",
                    type: "USHORT",
                    value: 0
                  }, {
                    name: "numTables",
                    type: "USHORT",
                    value: r ? 1 : 2
                  }, {
                    name: "platformID",
                    type: "USHORT",
                    value: 3
                  }, {
                    name: "encodingID",
                    type: "USHORT",
                    value: 1
                  }, {
                    name: "offset",
                    type: "ULONG",
                    value: r ? 12 : 20
                  }];
                  r || (i = i.concat([{
                    name: "cmap12PlatformID",
                    type: "USHORT",
                    value: 3
                  }, {
                    name: "cmap12EncodingID",
                    type: "USHORT",
                    value: 10
                  }, {
                    name: "cmap12Offset",
                    type: "ULONG",
                    value: 0
                  }])), i = i.concat([{
                    name: "format",
                    type: "USHORT",
                    value: 4
                  }, {
                    name: "cmap4Length",
                    type: "USHORT",
                    value: 0
                  }, {
                    name: "language",
                    type: "USHORT",
                    value: 0
                  }, {
                    name: "segCountX2",
                    type: "USHORT",
                    value: 0
                  }, {
                    name: "searchRange",
                    type: "USHORT",
                    value: 0
                  }, {
                    name: "entrySelector",
                    type: "USHORT",
                    value: 0
                  }, {
                    name: "rangeShift",
                    type: "USHORT",
                    value: 0
                  }]);
                  var a, n, o, s = new $.Table("cmap", i);
                  for (s.segments = [], t = 0; t < e.length; t += 1) {
                    for (var l = e.get(t), u = 0; u < l.unicodes.length; u += 1) a = s, n = l.unicodes[u], o = t, a.segments.push({
                      end: n,
                      start: n,
                      delta: -(n - o),
                      offset: 0,
                      glyphIndex: o
                    });
                    s.segments = s.segments.sort(function(e, t) {
                      return e.start - t.start
                    })
                  }
                  s.segments.push({
                    end: 65535,
                    start: 65535,
                    delta: 1,
                    offset: 0
                  });
                  var h = s.segments.length,
                    d = 0,
                    c = [],
                    f = [],
                    p = [],
                    m = [],
                    v = [],
                    g = [];
                  for (t = 0; t < h; t += 1) {
                    var y = s.segments[t];
                    y.end <= 65535 && y.start <= 65535 ? (c = c.concat({
                      name: "end_" + t,
                      type: "USHORT",
                      value: y.end
                    }), f = f.concat({
                      name: "start_" + t,
                      type: "USHORT",
                      value: y.start
                    }), p = p.concat({
                      name: "idDelta_" + t,
                      type: "SHORT",
                      value: y.delta
                    }), m = m.concat({
                      name: "idRangeOffset_" + t,
                      type: "USHORT",
                      value: y.offset
                    }), void 0 !== y.glyphId && (v = v.concat({
                      name: "glyph_" + t,
                      type: "USHORT",
                      value: y.glyphId
                    }))) : d += 1, r || void 0 === y.glyphIndex || (g = (g = (g = g.concat({
                      name: "cmap12Start_" + t,
                      type: "ULONG",
                      value: y.start
                    })).concat({
                      name: "cmap12End_" + t,
                      type: "ULONG",
                      value: y.end
                    })).concat({
                      name: "cmap12Glyph_" + t,
                      type: "ULONG",
                      value: y.glyphIndex
                    }))
                  }
                  if (s.segCountX2 = 2 * (h - d), s.searchRange = 2 * Math.pow(2, Math.floor(Math.log(h - d) / Math.log(2))), s.entrySelector = Math.log(s.searchRange / 2) / Math.log(2), s.rangeShift = s.segCountX2 - s.searchRange, s.fields = s.fields.concat(c), s.fields.push({
                      name: "reservedPad",
                      type: "USHORT",
                      value: 0
                    }), s.fields = s.fields.concat(f), s.fields = s.fields.concat(p), s.fields = s.fields.concat(m), s.fields = s.fields.concat(v), s.cmap4Length = 14 + 2 * c.length + 2 + 2 * f.length + 2 * p.length + 2 * m.length + 2 * v.length, !r) {
                    var _ = 16 + 4 * g.length;
                    s.cmap12Offset = 20 + s.cmap4Length, s.fields = s.fields.concat([{
                      name: "cmap12Format",
                      type: "USHORT",
                      value: 12
                    }, {
                      name: "cmap12Reserved",
                      type: "USHORT",
                      value: 0
                    }, {
                      name: "cmap12Length",
                      type: "ULONG",
                      value: _
                    }, {
                      name: "cmap12Language",
                      type: "ULONG",
                      value: 0
                    }, {
                      name: "cmap12nGroups",
                      type: "ULONG",
                      value: g.length / 3
                    }]), s.fields = s.fields.concat(g)
                  }
                  return s
                }
              },
              ue = [".notdef", "space", "exclam", "quotedbl", "numbersign", "dollar", "percent", "ampersand", "quoteright", "parenleft", "parenright", "asterisk", "plus", "comma", "hyphen", "period", "slash", "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "colon", "semicolon", "less", "equal", "greater", "question", "at", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "bracketleft", "backslash", "bracketright", "asciicircum", "underscore", "quoteleft", "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z", "braceleft", "bar", "braceright", "asciitilde", "exclamdown", "cent", "sterling", "fraction", "yen", "florin", "section", "currency", "quotesingle", "quotedblleft", "guillemotleft", "guilsinglleft", "guilsinglright", "fi", "fl", "endash", "dagger", "daggerdbl", "periodcentered", "paragraph", "bullet", "quotesinglbase", "quotedblbase", "quotedblright", "guillemotright", "ellipsis", "perthousand", "questiondown", "grave", "acute", "circumflex", "tilde", "macron", "breve", "dotaccent", "dieresis", "ring", "cedilla", "hungarumlaut", "ogonek", "caron", "emdash", "AE", "ordfeminine", "Lslash", "Oslash", "OE", "ordmasculine", "ae", "dotlessi", "lslash", "oslash", "oe", "germandbls", "onesuperior", "logicalnot", "mu", "trademark", "Eth", "onehalf", "plusminus", "Thorn", "onequarter", "divide", "brokenbar", "degree", "thorn", "threequarters", "twosuperior", "registered", "minus", "eth", "multiply", "threesuperior", "copyright", "Aacute", "Acircumflex", "Adieresis", "Agrave", "Aring", "Atilde", "Ccedilla", "Eacute", "Ecircumflex", "Edieresis", "Egrave", "Iacute", "Icircumflex", "Idieresis", "Igrave", "Ntilde", "Oacute", "Ocircumflex", "Odieresis", "Ograve", "Otilde", "Scaron", "Uacute", "Ucircumflex", "Udieresis", "Ugrave", "Yacute", "Ydieresis", "Zcaron", "aacute", "acircumflex", "adieresis", "agrave", "aring", "atilde", "ccedilla", "eacute", "ecircumflex", "edieresis", "egrave", "iacute", "icircumflex", "idieresis", "igrave", "ntilde", "oacute", "ocircumflex", "odieresis", "ograve", "otilde", "scaron", "uacute", "ucircumflex", "udieresis", "ugrave", "yacute", "ydieresis", "zcaron", "exclamsmall", "Hungarumlautsmall", "dollaroldstyle", "dollarsuperior", "ampersandsmall", "Acutesmall", "parenleftsuperior", "parenrightsuperior", "266 ff", "onedotenleader", "zerooldstyle", "oneoldstyle", "twooldstyle", "threeoldstyle", "fouroldstyle", "fiveoldstyle", "sixoldstyle", "sevenoldstyle", "eightoldstyle", "nineoldstyle", "commasuperior", "threequartersemdash", "periodsuperior", "questionsmall", "asuperior", "bsuperior", "centsuperior", "dsuperior", "esuperior", "isuperior", "lsuperior", "msuperior", "nsuperior", "osuperior", "rsuperior", "ssuperior", "tsuperior", "ff", "ffi", "ffl", "parenleftinferior", "parenrightinferior", "Circumflexsmall", "hyphensuperior", "Gravesmall", "Asmall", "Bsmall", "Csmall", "Dsmall", "Esmall", "Fsmall", "Gsmall", "Hsmall", "Ismall", "Jsmall", "Ksmall", "Lsmall", "Msmall", "Nsmall", "Osmall", "Psmall", "Qsmall", "Rsmall", "Ssmall", "Tsmall", "Usmall", "Vsmall", "Wsmall", "Xsmall", "Ysmall", "Zsmall", "colonmonetary", "onefitted", "rupiah", "Tildesmall", "exclamdownsmall", "centoldstyle", "Lslashsmall", "Scaronsmall", "Zcaronsmall", "Dieresissmall", "Brevesmall", "Caronsmall", "Dotaccentsmall", "Macronsmall", "figuredash", "hypheninferior", "Ogoneksmall", "Ringsmall", "Cedillasmall", "questiondownsmall", "oneeighth", "threeeighths", "fiveeighths", "seveneighths", "onethird", "twothirds", "zerosuperior", "foursuperior", "fivesuperior", "sixsuperior", "sevensuperior", "eightsuperior", "ninesuperior", "zeroinferior", "oneinferior", "twoinferior", "threeinferior", "fourinferior", "fiveinferior", "sixinferior", "seveninferior", "eightinferior", "nineinferior", "centinferior", "dollarinferior", "periodinferior", "commainferior", "Agravesmall", "Aacutesmall", "Acircumflexsmall", "Atildesmall", "Adieresissmall", "Aringsmall", "AEsmall", "Ccedillasmall", "Egravesmall", "Eacutesmall", "Ecircumflexsmall", "Edieresissmall", "Igravesmall", "Iacutesmall", "Icircumflexsmall", "Idieresissmall", "Ethsmall", "Ntildesmall", "Ogravesmall", "Oacutesmall", "Ocircumflexsmall", "Otildesmall", "Odieresissmall", "OEsmall", "Oslashsmall", "Ugravesmall", "Uacutesmall", "Ucircumflexsmall", "Udieresissmall", "Yacutesmall", "Thornsmall", "Ydieresissmall", "001.000", "001.001", "001.002", "001.003", "Black", "Bold", "Book", "Light", "Medium", "Regular", "Roman", "Semibold"],
              he = ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "space", "exclam", "quotedbl", "numbersign", "dollar", "percent", "ampersand", "quoteright", "parenleft", "parenright", "asterisk", "plus", "comma", "hyphen", "period", "slash", "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "colon", "semicolon", "less", "equal", "greater", "question", "at", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "bracketleft", "backslash", "bracketright", "asciicircum", "underscore", "quoteleft", "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z", "braceleft", "bar", "braceright", "asciitilde", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "exclamdown", "cent", "sterling", "fraction", "yen", "florin", "section", "currency", "quotesingle", "quotedblleft", "guillemotleft", "guilsinglleft", "guilsinglright", "fi", "fl", "", "endash", "dagger", "daggerdbl", "periodcentered", "", "paragraph", "bullet", "quotesinglbase", "quotedblbase", "quotedblright", "guillemotright", "ellipsis", "perthousand", "", "questiondown", "", "grave", "acute", "circumflex", "tilde", "macron", "breve", "dotaccent", "dieresis", "", "ring", "cedilla", "", "hungarumlaut", "ogonek", "caron", "emdash", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "AE", "", "ordfeminine", "", "", "", "", "Lslash", "Oslash", "OE", "ordmasculine", "", "", "", "", "", "ae", "", "", "", "dotlessi", "", "", "lslash", "oslash", "oe", "germandbls"],
              de = ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "space", "exclamsmall", "Hungarumlautsmall", "", "dollaroldstyle", "dollarsuperior", "ampersandsmall", "Acutesmall", "parenleftsuperior", "parenrightsuperior", "twodotenleader", "onedotenleader", "comma", "hyphen", "period", "fraction", "zerooldstyle", "oneoldstyle", "twooldstyle", "threeoldstyle", "fouroldstyle", "fiveoldstyle", "sixoldstyle", "sevenoldstyle", "eightoldstyle", "nineoldstyle", "colon", "semicolon", "commasuperior", "threequartersemdash", "periodsuperior", "questionsmall", "", "asuperior", "bsuperior", "centsuperior", "dsuperior", "esuperior", "", "", "isuperior", "", "", "lsuperior", "msuperior", "nsuperior", "osuperior", "", "", "rsuperior", "ssuperior", "tsuperior", "", "ff", "fi", "fl", "ffi", "ffl", "parenleftinferior", "", "parenrightinferior", "Circumflexsmall", "hyphensuperior", "Gravesmall", "Asmall", "Bsmall", "Csmall", "Dsmall", "Esmall", "Fsmall", "Gsmall", "Hsmall", "Ismall", "Jsmall", "Ksmall", "Lsmall", "Msmall", "Nsmall", "Osmall", "Psmall", "Qsmall", "Rsmall", "Ssmall", "Tsmall", "Usmall", "Vsmall", "Wsmall", "Xsmall", "Ysmall", "Zsmall", "colonmonetary", "onefitted", "rupiah", "Tildesmall", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "exclamdownsmall", "centoldstyle", "Lslashsmall", "", "", "Scaronsmall", "Zcaronsmall", "Dieresissmall", "Brevesmall", "Caronsmall", "", "Dotaccentsmall", "", "", "Macronsmall", "", "", "figuredash", "hypheninferior", "", "", "Ogoneksmall", "Ringsmall", "Cedillasmall", "", "", "", "onequarter", "onehalf", "threequarters", "questiondownsmall", "oneeighth", "threeeighths", "fiveeighths", "seveneighths", "onethird", "twothirds", "", "", "zerosuperior", "onesuperior", "twosuperior", "threesuperior", "foursuperior", "fivesuperior", "sixsuperior", "sevensuperior", "eightsuperior", "ninesuperior", "zeroinferior", "oneinferior", "twoinferior", "threeinferior", "fourinferior", "fiveinferior", "sixinferior", "seveninferior", "eightinferior", "nineinferior", "centinferior", "dollarinferior", "periodinferior", "commainferior", "Agravesmall", "Aacutesmall", "Acircumflexsmall", "Atildesmall", "Adieresissmall", "Aringsmall", "AEsmall", "Ccedillasmall", "Egravesmall", "Eacutesmall", "Ecircumflexsmall", "Edieresissmall", "Igravesmall", "Iacutesmall", "Icircumflexsmall", "Idieresissmall", "Ethsmall", "Ntildesmall", "Ogravesmall", "Oacutesmall", "Ocircumflexsmall", "Otildesmall", "Odieresissmall", "OEsmall", "Oslashsmall", "Ugravesmall", "Uacutesmall", "Ucircumflexsmall", "Udieresissmall", "Yacutesmall", "Thornsmall", "Ydieresissmall"],
              ce = [".notdef", ".null", "nonmarkingreturn", "space", "exclam", "quotedbl", "numbersign", "dollar", "percent", "ampersand", "quotesingle", "parenleft", "parenright", "asterisk", "plus", "comma", "hyphen", "period", "slash", "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "colon", "semicolon", "less", "equal", "greater", "question", "at", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "bracketleft", "backslash", "bracketright", "asciicircum", "underscore", "grave", "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z", "braceleft", "bar", "braceright", "asciitilde", "Adieresis", "Aring", "Ccedilla", "Eacute", "Ntilde", "Odieresis", "Udieresis", "aacute", "agrave", "acircumflex", "adieresis", "atilde", "aring", "ccedilla", "eacute", "egrave", "ecircumflex", "edieresis", "iacute", "igrave", "icircumflex", "idieresis", "ntilde", "oacute", "ograve", "ocircumflex", "odieresis", "otilde", "uacute", "ugrave", "ucircumflex", "udieresis", "dagger", "degree", "cent", "sterling", "section", "bullet", "paragraph", "germandbls", "registered", "copyright", "trademark", "acute", "dieresis", "notequal", "AE", "Oslash", "infinity", "plusminus", "lessequal", "greaterequal", "yen", "mu", "partialdiff", "summation", "product", "pi", "integral", "ordfeminine", "ordmasculine", "Omega", "ae", "oslash", "questiondown", "exclamdown", "logicalnot", "radical", "florin", "approxequal", "Delta", "guillemotleft", "guillemotright", "ellipsis", "nonbreakingspace", "Agrave", "Atilde", "Otilde", "OE", "oe", "endash", "emdash", "quotedblleft", "quotedblright", "quoteleft", "quoteright", "divide", "lozenge", "ydieresis", "Ydieresis", "fraction", "currency", "guilsinglleft", "guilsinglright", "fi", "fl", "daggerdbl", "periodcentered", "quotesinglbase", "quotedblbase", "perthousand", "Acircumflex", "Ecircumflex", "Aacute", "Edieresis", "Egrave", "Iacute", "Icircumflex", "Idieresis", "Igrave", "Oacute", "Ocircumflex", "apple", "Ograve", "Uacute", "Ucircumflex", "Ugrave", "dotlessi", "circumflex", "tilde", "macron", "breve", "dotaccent", "ring", "cedilla", "hungarumlaut", "ogonek", "caron", "Lslash", "lslash", "Scaron", "scaron", "Zcaron", "zcaron", "brokenbar", "Eth", "eth", "Yacute", "yacute", "Thorn", "thorn", "minus", "multiply", "onesuperior", "twosuperior", "threesuperior", "onehalf", "onequarter", "threequarters", "franc", "Gbreve", "gbreve", "Idotaccent", "Scedilla", "scedilla", "Cacute", "cacute", "Ccaron", "ccaron", "dcroat"];

            function fe(e) {
              this.font = e
            }

            function pe(e) {
              this.cmap = e
            }

            function me(e, t) {
              this.encoding = e, this.charset = t
            }

            function ve(e) {
              switch (e.version) {
                case 1:
                  this.names = ce.slice();
                  break;
                case 2:
                  this.names = new Array(e.numberOfGlyphs);
                  for (var t = 0; t < e.numberOfGlyphs; t++) e.glyphNameIndex[t] < ce.length ? this.names[t] = ce[e.glyphNameIndex[t]] : this.names[t] = e.names[e.glyphNameIndex[t] - ce.length];
                  break;
                case 2.5:
                  this.names = new Array(e.numberOfGlyphs);
                  for (var r = 0; r < e.numberOfGlyphs; r++) this.names[r] = ce[r + e.glyphNameIndex[r]];
                  break;
                case 3:
                default:
                  this.names = []
              }
            }
            fe.prototype.charToGlyphIndex = function(e) {
              var t = e.codePointAt(0),
                r = this.font.glyphs;
              if (r)
                for (var i = 0; i < r.length; i += 1)
                  for (var a = r.get(i), n = 0; n < a.unicodes.length; n += 1)
                    if (a.unicodes[n] === t) return i;
              return null
            }, pe.prototype.charToGlyphIndex = function(e) {
              return this.cmap.glyphIndexMap[e.codePointAt(0)] || 0
            }, me.prototype.charToGlyphIndex = function(e) {
              var t = e.codePointAt(0),
                r = this.encoding[t];
              return this.charset.indexOf(r)
            }, ve.prototype.nameToGlyphIndex = function(e) {
              return this.names.indexOf(e)
            }, ve.prototype.glyphIndexToName = function(e) {
              return this.names[e]
            };
            var ge = {
              line: function(e, t, r, i, a) {
                e.beginPath(), e.moveTo(t, r), e.lineTo(i, a), e.stroke()
              }
            };

            function ye(e) {
              this.bindConstructorValues(e)
            }

            function _e(t, e, r) {
              Object.defineProperty(t, e, {
                get: function() {
                  return t.path, t[r]
                },
                set: function(e) {
                  t[r] = e
                },
                enumerable: !0,
                configurable: !0
              })
            }

            function be(e, t) {
              if (this.font = e, this.glyphs = {}, Array.isArray(t))
                for (var r = 0; r < t.length; r++) this.glyphs[r] = t[r];
              this.length = t && t.length || 0
            }
            ye.prototype.bindConstructorValues = function(e) {
              var t, r;
              this.index = e.index || 0, this.name = e.name || null, this.unicode = e.unicode || void 0, this.unicodes = e.unicodes || void 0 !== e.unicode ? [e.unicode] : [], e.xMin && (this.xMin = e.xMin), e.yMin && (this.yMin = e.yMin), e.xMax && (this.xMax = e.xMax), e.yMax && (this.yMax = e.yMax), e.advanceWidth && (this.advanceWidth = e.advanceWidth), Object.defineProperty(this, "path", (t = e.path, r = t || new k, {
                configurable: !0,
                get: function() {
                  return "function" == typeof r && (r = r()), r
                },
                set: function(e) {
                  r = e
                }
              }))
            }, ye.prototype.addUnicode = function(e) {
              0 === this.unicodes.length && (this.unicode = e), this.unicodes.push(e)
            }, ye.prototype.getBoundingBox = function() {
              return this.path.getBoundingBox()
            }, ye.prototype.getPath = function(e, t, r, i, a) {
              var n, o;
              e = void 0 !== e ? e : 0, t = void 0 !== t ? t : 0, r = void 0 !== r ? r : 72, i || (i = {});
              var s = i.xScale,
                l = i.yScale;
              if (i.hinting && a && a.hinting && (o = this.path && a.hinting.exec(this, r)), o) n = a.hinting.getCommands(o), e = Math.round(e), t = Math.round(t), s = l = 1;
              else {
                n = this.path.commands;
                var u = 1 / this.path.unitsPerEm * r;
                void 0 === s && (s = u), void 0 === l && (l = u)
              }
              for (var h = new k, d = 0; d < n.length; d += 1) {
                var c = n[d];
                "M" === c.type ? h.moveTo(e + c.x * s, t + -c.y * l) : "L" === c.type ? h.lineTo(e + c.x * s, t + -c.y * l) : "Q" === c.type ? h.quadraticCurveTo(e + c.x1 * s, t + -c.y1 * l, e + c.x * s, t + -c.y * l) : "C" === c.type ? h.curveTo(e + c.x1 * s, t + -c.y1 * l, e + c.x2 * s, t + -c.y2 * l, e + c.x * s, t + -c.y * l) : "Z" === c.type && h.closePath()
              }
              return h
            }, ye.prototype.getContours = function() {
              if (void 0 === this.points) return [];
              for (var e = [], t = [], r = 0; r < this.points.length; r += 1) {
                var i = this.points[r];
                t.push(i), i.lastPointOfContour && (e.push(t), t = [])
              }
              return R.argument(0 === t.length, "There are still points left in the current contour."), e
            }, ye.prototype.getMetrics = function() {
              for (var e = this.path.commands, t = [], r = [], i = 0; i < e.length; i += 1) {
                var a = e[i];
                "Z" !== a.type && (t.push(a.x), r.push(a.y)), "Q" !== a.type && "C" !== a.type || (t.push(a.x1), r.push(a.y1)), "C" === a.type && (t.push(a.x2), r.push(a.y2))
              }
              var n = {
                xMin: Math.min.apply(null, t),
                yMin: Math.min.apply(null, r),
                xMax: Math.max.apply(null, t),
                yMax: Math.max.apply(null, r),
                leftSideBearing: this.leftSideBearing
              };
              return isFinite(n.xMin) || (n.xMin = 0), isFinite(n.xMax) || (n.xMax = this.advanceWidth), isFinite(n.yMin) || (n.yMin = 0), isFinite(n.yMax) || (n.yMax = 0), n.rightSideBearing = this.advanceWidth - n.leftSideBearing - (n.xMax - n.xMin), n
            }, ye.prototype.draw = function(e, t, r, i, a) {
              this.getPath(t, r, i, a).draw(e)
            }, ye.prototype.drawPoints = function(o, e, t, r) {
              function i(e, t, r, i) {
                var a = 2 * Math.PI;
                o.beginPath();
                for (var n = 0; n < e.length; n += 1) o.moveTo(t + e[n].x * i, r + e[n].y * i), o.arc(t + e[n].x * i, r + e[n].y * i, 2, 0, a, !1);
                o.closePath(), o.fill()
              }
              e = void 0 !== e ? e : 0, t = void 0 !== t ? t : 0, r = void 0 !== r ? r : 24;
              for (var a = 1 / this.path.unitsPerEm * r, n = [], s = [], l = this.path, u = 0; u < l.commands.length; u += 1) {
                var h = l.commands[u];
                void 0 !== h.x && n.push({
                  x: h.x,
                  y: -h.y
                }), void 0 !== h.x1 && s.push({
                  x: h.x1,
                  y: -h.y1
                }), void 0 !== h.x2 && s.push({
                  x: h.x2,
                  y: -h.y2
                })
              }
              o.fillStyle = "blue", i(n, e, t, a), o.fillStyle = "red", i(s, e, t, a)
            }, ye.prototype.drawMetrics = function(e, t, r, i) {
              var a;
              t = void 0 !== t ? t : 0, r = void 0 !== r ? r : 0, i = void 0 !== i ? i : 24, a = 1 / this.path.unitsPerEm * i, e.lineWidth = 1, e.strokeStyle = "black", ge.line(e, t, -1e4, t, 1e4), ge.line(e, -1e4, r, 1e4, r);
              var n = this.xMin || 0,
                o = this.yMin || 0,
                s = this.xMax || 0,
                l = this.yMax || 0,
                u = this.advanceWidth || 0;
              e.strokeStyle = "blue", ge.line(e, t + n * a, -1e4, t + n * a, 1e4), ge.line(e, t + s * a, -1e4, t + s * a, 1e4), ge.line(e, -1e4, r + -o * a, 1e4, r + -o * a), ge.line(e, -1e4, r + -l * a, 1e4, r + -l * a), e.strokeStyle = "green", ge.line(e, t + u * a, -1e4, t + u * a, 1e4)
            }, be.prototype.get = function(e) {
              return "function" == typeof this.glyphs[e] && (this.glyphs[e] = this.glyphs[e]()), this.glyphs[e]
            }, be.prototype.push = function(e, t) {
              this.glyphs[e] = t, this.length++
            };
            var xe = {
              GlyphSet: be,
              glyphLoader: function(e, t) {
                return new ye({
                  index: t,
                  font: e
                })
              },
              ttfGlyphLoader: function(r, e, i, a, n, o) {
                return function() {
                  var t = new ye({
                    index: e,
                    font: r
                  });
                  return t.path = function() {
                    i(t, a, n);
                    var e = o(r.glyphs, t);
                    return e.unitsPerEm = r.unitsPerEm, e
                  }, _e(t, "xMin", "_xMin"), _e(t, "xMax", "_xMax"), _e(t, "yMin", "_yMin"), _e(t, "yMax", "_yMax"), t
                }
              },
              cffGlyphLoader: function(r, e, i, a) {
                return function() {
                  var t = new ye({
                    index: e,
                    font: r
                  });
                  return t.path = function() {
                    var e = i(r, t, a);
                    return e.unitsPerEm = r.unitsPerEm, e
                  }, t
                }
              }
            };

            function we(e, t) {
              if (e === t) return !0;
              if (Array.isArray(e) && Array.isArray(t)) {
                if (e.length !== t.length) return !1;
                for (var r = 0; r < e.length; r += 1)
                  if (!we(e[r], t[r])) return !1;
                return !0
              }
              return !1
            }

            function Se(e) {
              return e.length < 1240 ? 107 : e.length < 33900 ? 1131 : 32768
            }

            function Me(e, t, r) {
              var i, a, n = [],
                o = [],
                s = se.getCard16(e, t);
              if (0 !== s) {
                var l = se.getByte(e, t + 2);
                i = t + (s + 1) * l + 2;
                for (var u = t + 3, h = 0; h < s + 1; h += 1) n.push(se.getOffset(e, u, l)), u += l;
                a = i + n[s]
              } else a = t + 2;
              for (var d = 0; d < n.length - 1; d += 1) {
                var c = se.getBytes(e, i + n[d], i + n[d + 1]);
                r && (c = r(c)), o.push(c)
              }
              return {
                objects: o,
                startOffset: t,
                endOffset: a
              }
            }

            function Ee(e, t) {
              if (28 === t) return e.parseByte() << 8 | e.parseByte();
              if (29 === t) return e.parseByte() << 24 | e.parseByte() << 16 | e.parseByte() << 8 | e.parseByte();
              if (30 === t) return function(e) {
                for (var t = "", r = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "E", "E-", null, "-"];;) {
                  var i = e.parseByte(),
                    a = i >> 4,
                    n = 15 & i;
                  if (15 === a) break;
                  if (t += r[a], 15 === n) break;
                  t += r[n]
                }
                return parseFloat(t)
              }(e);
              if (32 <= t && t <= 246) return t - 139;
              if (247 <= t && t <= 250) return 256 * (t - 247) + e.parseByte() + 108;
              if (251 <= t && t <= 254) return 256 * -(t - 251) - e.parseByte() - 108;
              throw new Error("Invalid b0 " + t)
            }

            function Te(e, t, r) {
              t = void 0 !== t ? t : 0;
              var i = new se.Parser(e, t),
                a = [],
                n = [];
              for (r = void 0 !== r ? r : e.length; i.relativeOffset < r;) {
                var o = i.parseByte();
                o <= 21 ? (12 === o && (o = 1200 + i.parseByte()), a.push([o, n]), n = []) : n.push(Ee(i, o))
              }
              return function(e) {
                for (var t = {}, r = 0; r < e.length; r += 1) {
                  var i = e[r][0],
                    a = e[r][1],
                    n = void 0;
                  if (n = 1 === a.length ? a[0] : a, t.hasOwnProperty(i) && !isNaN(t[i])) throw new Error("Object " + t + " already has key " + i);
                  t[i] = n
                }
                return t
              }(a)
            }

            function Ce(e, t) {
              return t = t <= 390 ? ue[t] : e[t - 391]
            }

            function Pe(e, t, r) {
              for (var i, a = {}, n = 0; n < t.length; n += 1) {
                var o = t[n];
                if (Array.isArray(o.type)) {
                  var s = [];
                  s.length = o.type.length;
                  for (var l = 0; l < o.type.length; l++) void 0 === (i = void 0 !== e[o.op] ? e[o.op][l] : void 0) && (i = void 0 !== o.value && void 0 !== o.value[l] ? o.value[l] : null), "SID" === o.type[l] && (i = Ce(r, i)), s[l] = i;
                  a[o.name] = s
                } else void 0 === (i = e[o.op]) && (i = void 0 !== o.value ? o.value : null), "SID" === o.type && (i = Ce(r, i)), a[o.name] = i
              }
              return a
            }
            var Le = [{
                name: "version",
                op: 0,
                type: "SID"
              }, {
                name: "notice",
                op: 1,
                type: "SID"
              }, {
                name: "copyright",
                op: 1200,
                type: "SID"
              }, {
                name: "fullName",
                op: 2,
                type: "SID"
              }, {
                name: "familyName",
                op: 3,
                type: "SID"
              }, {
                name: "weight",
                op: 4,
                type: "SID"
              }, {
                name: "isFixedPitch",
                op: 1201,
                type: "number",
                value: 0
              }, {
                name: "italicAngle",
                op: 1202,
                type: "number",
                value: 0
              }, {
                name: "underlinePosition",
                op: 1203,
                type: "number",
                value: -100
              }, {
                name: "underlineThickness",
                op: 1204,
                type: "number",
                value: 50
              }, {
                name: "paintType",
                op: 1205,
                type: "number",
                value: 0
              }, {
                name: "charstringType",
                op: 1206,
                type: "number",
                value: 2
              }, {
                name: "fontMatrix",
                op: 1207,
                type: ["real", "real", "real", "real", "real", "real"],
                value: [.001, 0, 0, .001, 0, 0]
              }, {
                name: "uniqueId",
                op: 13,
                type: "number"
              }, {
                name: "fontBBox",
                op: 5,
                type: ["number", "number", "number", "number"],
                value: [0, 0, 0, 0]
              }, {
                name: "strokeWidth",
                op: 1208,
                type: "number",
                value: 0
              }, {
                name: "xuid",
                op: 14,
                type: [],
                value: null
              }, {
                name: "charset",
                op: 15,
                type: "offset",
                value: 0
              }, {
                name: "encoding",
                op: 16,
                type: "offset",
                value: 0
              }, {
                name: "charStrings",
                op: 17,
                type: "offset",
                value: 0
              }, {
                name: "private",
                op: 18,
                type: ["number", "offset"],
                value: [0, 0]
              }, {
                name: "ros",
                op: 1230,
                type: ["SID", "SID", "number"]
              }, {
                name: "cidFontVersion",
                op: 1231,
                type: "number",
                value: 0
              }, {
                name: "cidFontRevision",
                op: 1232,
                type: "number",
                value: 0
              }, {
                name: "cidFontType",
                op: 1233,
                type: "number",
                value: 0
              }, {
                name: "cidCount",
                op: 1234,
                type: "number",
                value: 8720
              }, {
                name: "uidBase",
                op: 1235,
                type: "number"
              }, {
                name: "fdArray",
                op: 1236,
                type: "offset"
              }, {
                name: "fdSelect",
                op: 1237,
                type: "offset"
              }, {
                name: "fontName",
                op: 1238,
                type: "SID"
              }],
              Re = [{
                name: "subrs",
                op: 19,
                type: "offset",
                value: 0
              }, {
                name: "defaultWidthX",
                op: 20,
                type: "number",
                value: 0
              }, {
                name: "nominalWidthX",
                op: 21,
                type: "number",
                value: 0
              }];

            function Oe(e, t, r, i) {
              return Pe(Te(e, t, r), Re, i)
            }

            function De(e, t, r, i) {
              for (var a, n, o = [], s = 0; s < r.length; s += 1) {
                var l = new DataView(new Uint8Array(r[s]).buffer),
                  u = (n = i, Pe(Te(a = l, 0, a.byteLength), Le, n));
                u._subrs = [], u._subrsBias = 0;
                var h = u.private[0],
                  d = u.private[1];
                if (0 !== h && 0 !== d) {
                  var c = Oe(e, d + t, h, i);
                  if (u._defaultWidthX = c.defaultWidthX, u._nominalWidthX = c.nominalWidthX, 0 !== c.subrs) {
                    var f = Me(e, d + c.subrs + t);
                    u._subrs = f.objects, u._subrsBias = Se(u._subrs)
                  }
                  u._privateDict = c
                }
                o.push(u)
              }
              return o
            }

            function Ae(v, g, e) {
              var y, _, b, x, w, S, t, M, E = new k,
                T = [],
                C = 0,
                P = !1,
                L = !1,
                R = 0,
                O = 0;
              if (v.isCIDFont) {
                var r = v.tables.cff.topDict._fdSelect[g.index],
                  i = v.tables.cff.topDict._fdArray[r];
                w = i._subrs, S = i._subrsBias, t = i._defaultWidthX, M = i._nominalWidthX
              } else w = v.tables.cff.topDict._subrs, S = v.tables.cff.topDict._subrsBias, t = v.tables.cff.topDict._defaultWidthX, M = v.tables.cff.topDict._nominalWidthX;
              var D = t;

              function A(e, t) {
                L && E.closePath(), E.moveTo(e, t), L = !0
              }

              function I() {
                T.length % 2 != 0 && !P && (D = T.shift() + M), C += T.length >> 1, T.length = 0, P = !0
              }
              return function e(t) {
                for (var r, i, a, n, o, s, l, u, h, d, c, f, p = 0; p < t.length;) {
                  var m = t[p];
                  switch (p += 1, m) {
                    case 1:
                    case 3:
                      I();
                      break;
                    case 4:
                      1 < T.length && !P && (D = T.shift() + M, P = !0), O += T.pop(), A(R, O);
                      break;
                    case 5:
                      for (; 0 < T.length;) R += T.shift(), O += T.shift(), E.lineTo(R, O);
                      break;
                    case 6:
                      for (; 0 < T.length && (R += T.shift(), E.lineTo(R, O), 0 !== T.length);) O += T.shift(), E.lineTo(R, O);
                      break;
                    case 7:
                      for (; 0 < T.length && (O += T.shift(), E.lineTo(R, O), 0 !== T.length);) R += T.shift(), E.lineTo(R, O);
                      break;
                    case 8:
                      for (; 0 < T.length;) y = R + T.shift(), _ = O + T.shift(), b = y + T.shift(), x = _ + T.shift(), R = b + T.shift(), O = x + T.shift(), E.curveTo(y, _, b, x, R, O);
                      break;
                    case 10:
                      o = T.pop() + S, (s = w[o]) && e(s);
                      break;
                    case 11:
                      return;
                    case 12:
                      switch (m = t[p], p += 1, m) {
                        case 35:
                          y = R + T.shift(), _ = O + T.shift(), b = y + T.shift(), x = _ + T.shift(), l = b + T.shift(), u = x + T.shift(), h = l + T.shift(), d = u + T.shift(), c = h + T.shift(), f = d + T.shift(), R = c + T.shift(), O = f + T.shift(), T.shift(), E.curveTo(y, _, b, x, l, u), E.curveTo(h, d, c, f, R, O);
                          break;
                        case 34:
                          y = R + T.shift(), _ = O, b = y + T.shift(), x = _ + T.shift(), l = b + T.shift(), u = x, h = l + T.shift(), d = x, c = h + T.shift(), f = O, R = c + T.shift(), E.curveTo(y, _, b, x, l, u), E.curveTo(h, d, c, f, R, O);
                          break;
                        case 36:
                          y = R + T.shift(), _ = O + T.shift(), b = y + T.shift(), x = _ + T.shift(), l = b + T.shift(), u = x, h = l + T.shift(), d = x, c = h + T.shift(), f = d + T.shift(), R = c + T.shift(), E.curveTo(y, _, b, x, l, u), E.curveTo(h, d, c, f, R, O);
                          break;
                        case 37:
                          y = R + T.shift(), _ = O + T.shift(), b = y + T.shift(), x = _ + T.shift(), l = b + T.shift(), u = x + T.shift(), h = l + T.shift(), d = u + T.shift(), c = h + T.shift(), f = d + T.shift(), Math.abs(c - R) > Math.abs(f - O) ? R = c + T.shift() : O = f + T.shift(), E.curveTo(y, _, b, x, l, u), E.curveTo(h, d, c, f, R, O);
                          break;
                        default:
                          console.log("Glyph " + g.index + ": unknown operator 1200" + m), T.length = 0
                      }
                      break;
                    case 14:
                      0 < T.length && !P && (D = T.shift() + M, P = !0), L && (E.closePath(), L = !1);
                      break;
                    case 18:
                      I();
                      break;
                    case 19:
                    case 20:
                      I(), p += C + 7 >> 3;
                      break;
                    case 21:
                      2 < T.length && !P && (D = T.shift() + M, P = !0), O += T.pop(), A(R += T.pop(), O);
                      break;
                    case 22:
                      1 < T.length && !P && (D = T.shift() + M, P = !0), A(R += T.pop(), O);
                      break;
                    case 23:
                      I();
                      break;
                    case 24:
                      for (; 2 < T.length;) y = R + T.shift(), _ = O + T.shift(), b = y + T.shift(), x = _ + T.shift(), R = b + T.shift(), O = x + T.shift(), E.curveTo(y, _, b, x, R, O);
                      R += T.shift(), O += T.shift(), E.lineTo(R, O);
                      break;
                    case 25:
                      for (; 6 < T.length;) R += T.shift(), O += T.shift(), E.lineTo(R, O);
                      y = R + T.shift(), _ = O + T.shift(), b = y + T.shift(), x = _ + T.shift(), R = b + T.shift(), O = x + T.shift(), E.curveTo(y, _, b, x, R, O);
                      break;
                    case 26:
                      for (T.length % 2 && (R += T.shift()); 0 < T.length;) y = R, _ = O + T.shift(), b = y + T.shift(), x = _ + T.shift(), R = b, O = x + T.shift(), E.curveTo(y, _, b, x, R, O);
                      break;
                    case 27:
                      for (T.length % 2 && (O += T.shift()); 0 < T.length;) y = R + T.shift(), _ = O, b = y + T.shift(), x = _ + T.shift(), R = b + T.shift(), O = x, E.curveTo(y, _, b, x, R, O);
                      break;
                    case 28:
                      r = t[p], i = t[p + 1], T.push((r << 24 | i << 16) >> 16), p += 2;
                      break;
                    case 29:
                      o = T.pop() + v.gsubrsBias, (s = v.gsubrs[o]) && e(s);
                      break;
                    case 30:
                      for (; 0 < T.length && (y = R, _ = O + T.shift(), b = y + T.shift(), x = _ + T.shift(), R = b + T.shift(), O = x + (1 === T.length ? T.shift() : 0), E.curveTo(y, _, b, x, R, O), 0 !== T.length);) y = R + T.shift(), _ = O, b = y + T.shift(), x = _ + T.shift(), O = x + T.shift(), R = b + (1 === T.length ? T.shift() : 0), E.curveTo(y, _, b, x, R, O);
                      break;
                    case 31:
                      for (; 0 < T.length && (y = R + T.shift(), _ = O, b = y + T.shift(), x = _ + T.shift(), O = x + T.shift(), R = b + (1 === T.length ? T.shift() : 0), E.curveTo(y, _, b, x, R, O), 0 !== T.length);) y = R, _ = O + T.shift(), b = y + T.shift(), x = _ + T.shift(), R = b + T.shift(), O = x + (1 === T.length ? T.shift() : 0), E.curveTo(y, _, b, x, R, O);
                      break;
                    default:
                      m < 32 ? console.log("Glyph " + g.index + ": unknown operator " + m) : m < 247 ? T.push(m - 139) : m < 251 ? (r = t[p], p += 1, T.push(256 * (m - 247) + r + 108)) : m < 255 ? (r = t[p], p += 1, T.push(256 * -(m - 251) - r - 108)) : (r = t[p], i = t[p + 1], a = t[p + 2], n = t[p + 3], p += 4, T.push((r << 24 | i << 16 | a << 8 | n) / 65536))
                  }
                }
              }(e), g.advanceWidth = D, E
            }

            function Ie(e, t) {
              var r, i = ue.indexOf(e);
              return 0 <= i && (r = i), 0 <= (i = t.indexOf(e)) ? r = i + ue.length : (r = ue.length + t.length, t.push(e)), r
            }

            function ke(e, t, r) {
              for (var i = {}, a = 0; a < e.length; a += 1) {
                var n = e[a],
                  o = t[n.name];
                void 0 === o || we(o, n.value) || ("SID" === n.type && (o = Ie(o, r)), i[n.op] = {
                  name: n.name,
                  type: n.type,
                  value: o
                })
              }
              return i
            }

            function Ue(e, t) {
              var r = new $.Record("Top DICT", [{
                name: "dict",
                type: "DICT",
                value: {}
              }]);
              return r.dict = ke(Le, e, t), r
            }

            function Fe(e) {
              var t = new $.Record("Top DICT INDEX", [{
                name: "topDicts",
                type: "INDEX",
                value: []
              }]);
              return t.topDicts = [{
                name: "topDict_0",
                type: "TABLE",
                value: e
              }], t
            }

            function Ne(e) {
              var t = [],
                r = e.path;
              t.push({
                name: "width",
                type: "NUMBER",
                value: e.advanceWidth
              });
              for (var i = 0, a = 0, n = 0; n < r.commands.length; n += 1) {
                var o = void 0,
                  s = void 0,
                  l = r.commands[n];
                if ("Q" === l.type) {
                  l = {
                    type: "C",
                    x: l.x,
                    y: l.y,
                    x1: 1 / 3 * i + 2 / 3 * l.x1,
                    y1: 1 / 3 * a + 2 / 3 * l.y1,
                    x2: 1 / 3 * l.x + 2 / 3 * l.x1,
                    y2: 1 / 3 * l.y + 2 / 3 * l.y1
                  }
                }
                if ("M" === l.type) o = Math.round(l.x - i), s = Math.round(l.y - a), t.push({
                  name: "dx",
                  type: "NUMBER",
                  value: o
                }), t.push({
                  name: "dy",
                  type: "NUMBER",
                  value: s
                }), t.push({
                  name: "rmoveto",
                  type: "OP",
                  value: 21
                }), i = Math.round(l.x), a = Math.round(l.y);
                else if ("L" === l.type) o = Math.round(l.x - i), s = Math.round(l.y - a), t.push({
                  name: "dx",
                  type: "NUMBER",
                  value: o
                }), t.push({
                  name: "dy",
                  type: "NUMBER",
                  value: s
                }), t.push({
                  name: "rlineto",
                  type: "OP",
                  value: 5
                }), i = Math.round(l.x), a = Math.round(l.y);
                else if ("C" === l.type) {
                  var u = Math.round(l.x1 - i),
                    h = Math.round(l.y1 - a),
                    d = Math.round(l.x2 - l.x1),
                    c = Math.round(l.y2 - l.y1);
                  o = Math.round(l.x - l.x2), s = Math.round(l.y - l.y2), t.push({
                    name: "dx1",
                    type: "NUMBER",
                    value: u
                  }), t.push({
                    name: "dy1",
                    type: "NUMBER",
                    value: h
                  }), t.push({
                    name: "dx2",
                    type: "NUMBER",
                    value: d
                  }), t.push({
                    name: "dy2",
                    type: "NUMBER",
                    value: c
                  }), t.push({
                    name: "dx",
                    type: "NUMBER",
                    value: o
                  }), t.push({
                    name: "dy",
                    type: "NUMBER",
                    value: s
                  }), t.push({
                    name: "rrcurveto",
                    type: "OP",
                    value: 8
                  }), i = Math.round(l.x), a = Math.round(l.y)
                }
              }
              return t.push({
                name: "endchar",
                type: "OP",
                value: 14
              }), t
            }
            var Be = {
              parse: function(e, t, r) {
                r.tables.cff = {};
                var i, a, n, o = Me(e, Me(e, (i = e, a = t, (n = {}).formatMajor = se.getCard8(i, a), n.formatMinor = se.getCard8(i, a + 1), n.size = se.getCard8(i, a + 2), n.offsetSize = se.getCard8(i, a + 3), n.startOffset = a, n.endOffset = a + 4, n).endOffset, se.bytesToString).endOffset),
                  s = Me(e, o.endOffset, se.bytesToString),
                  l = Me(e, s.endOffset);
                r.gsubrs = l.objects, r.gsubrsBias = Se(r.gsubrs);
                var u = De(e, t, o.objects, s.objects);
                if (1 !== u.length) throw new Error("CFF table has too many fonts in 'FontSet' - count of fonts NameIndex.length = " + u.length);
                var h = u[0];
                if ((r.tables.cff.topDict = h)._privateDict && (r.defaultWidthX = h._privateDict.defaultWidthX, r.nominalWidthX = h._privateDict.nominalWidthX), void 0 !== h.ros[0] && void 0 !== h.ros[1] && (r.isCIDFont = !0), r.isCIDFont) {
                  var d = h.fdArray,
                    c = h.fdSelect;
                  if (0 === d || 0 === c) throw new Error("Font is marked as a CID font, but FDArray and/or FDSelect information is missing");
                  var f = De(e, t, Me(e, d += t).objects, s.objects);
                  h._fdArray = f, c += t, h._fdSelect = function(e, t, r, i) {
                    var a, n = [],
                      o = new se.Parser(e, t),
                      s = o.parseCard8();
                    if (0 === s)
                      for (var l = 0; l < r; l++) {
                        if (i <= (a = o.parseCard8())) throw new Error("CFF table CID Font FDSelect has bad FD index value " + a + " (FD count " + i + ")");
                        n.push(a)
                      } else {
                        if (3 !== s) throw new Error("CFF Table CID Font FDSelect table has unsupported format " + s);
                        var u, h = o.parseCard16(),
                          d = o.parseCard16();
                        if (0 !== d) throw new Error("CFF Table CID Font FDSelect format 3 range has bad initial GID " + d);
                        for (var c = 0; c < h; c++) {
                          if (a = o.parseCard8(), u = o.parseCard16(), i <= a) throw new Error("CFF table CID Font FDSelect has bad FD index value " + a + " (FD count " + i + ")");
                          if (r < u) throw new Error("CFF Table CID Font FDSelect format 3 range has bad GID " + u);
                          for (; d < u; d++) n.push(a);
                          d = u
                        }
                        if (u !== r) throw new Error("CFF Table CID Font FDSelect format 3 range has bad final GID " + u)
                      }
                    return n
                  }(e, c, r.numGlyphs, f.length)
                }
                var p = t + h.private[1],
                  m = Oe(e, p, h.private[0], s.objects);
                if (r.defaultWidthX = m.defaultWidthX, r.nominalWidthX = m.nominalWidthX, 0 !== m.subrs) {
                  var v = Me(e, p + m.subrs);
                  r.subrs = v.objects, r.subrsBias = Se(r.subrs)
                } else r.subrs = [], r.subrsBias = 0;
                var g = Me(e, t + h.charStrings);
                r.nGlyphs = g.objects.length;
                var y = function(e, t, r, i) {
                  var a, n, o = new se.Parser(e, t);
                  r -= 1;
                  var s = [".notdef"],
                    l = o.parseCard8();
                  if (0 === l)
                    for (var u = 0; u < r; u += 1) a = o.parseSID(), s.push(Ce(i, a));
                  else if (1 === l)
                    for (; s.length <= r;) {
                      a = o.parseSID(), n = o.parseCard8();
                      for (var h = 0; h <= n; h += 1) s.push(Ce(i, a)), a += 1
                    } else {
                      if (2 !== l) throw new Error("Unknown charset format " + l);
                      for (; s.length <= r;) {
                        a = o.parseSID(), n = o.parseCard16();
                        for (var d = 0; d <= n; d += 1) s.push(Ce(i, a)), a += 1
                      }
                    }
                  return s
                }(e, t + h.charset, r.nGlyphs, s.objects);
                0 === h.encoding ? r.cffEncoding = new me(he, y) : 1 === h.encoding ? r.cffEncoding = new me(de, y) : r.cffEncoding = function(e, t, r) {
                  var i, a = {},
                    n = new se.Parser(e, t),
                    o = n.parseCard8();
                  if (0 === o)
                    for (var s = n.parseCard8(), l = 0; l < s; l += 1) a[i = n.parseCard8()] = l;
                  else {
                    if (1 !== o) throw new Error("Unknown encoding format " + o);
                    var u = n.parseCard8();
                    i = 1;
                    for (var h = 0; h < u; h += 1)
                      for (var d = n.parseCard8(), c = n.parseCard8(), f = d; f <= d + c; f += 1) a[f] = i, i += 1
                  }
                  return new me(a, r)
                }(e, t + h.encoding, y), r.encoding = r.encoding || r.cffEncoding, r.glyphs = new xe.GlyphSet(r);
                for (var _ = 0; _ < r.nGlyphs; _ += 1) {
                  var b = g.objects[_];
                  r.glyphs.push(_, xe.cffGlyphLoader(r, _, Ae, b))
                }
              },
              make: function(e, t) {
                for (var r, i = new $.Table("CFF ", [{
                    name: "header",
                    type: "RECORD"
                  }, {
                    name: "nameIndex",
                    type: "RECORD"
                  }, {
                    name: "topDictIndex",
                    type: "RECORD"
                  }, {
                    name: "stringIndex",
                    type: "RECORD"
                  }, {
                    name: "globalSubrIndex",
                    type: "RECORD"
                  }, {
                    name: "charsets",
                    type: "RECORD"
                  }, {
                    name: "charStringsIndex",
                    type: "RECORD"
                  }, {
                    name: "privateDict",
                    type: "RECORD"
                  }]), a = 1 / t.unitsPerEm, n = {
                    version: t.version,
                    fullName: t.fullName,
                    familyName: t.familyName,
                    weight: t.weightName,
                    fontBBox: t.fontBBox || [0, 0, 0, 0],
                    fontMatrix: [a, 0, 0, a, 0, 0],
                    charset: 999,
                    encoding: 0,
                    charStrings: 999,
                    private: [0, 999]
                  }, o = [], s = 1; s < e.length; s += 1) r = e.get(s), o.push(r.name);
                var l = [];
                i.header = new $.Record("Header", [{
                  name: "major",
                  type: "Card8",
                  value: 1
                }, {
                  name: "minor",
                  type: "Card8",
                  value: 0
                }, {
                  name: "hdrSize",
                  type: "Card8",
                  value: 4
                }, {
                  name: "major",
                  type: "Card8",
                  value: 1
                }]), i.nameIndex = function(e) {
                  var t = new $.Record("Name INDEX", [{
                    name: "names",
                    type: "INDEX",
                    value: []
                  }]);
                  t.names = [];
                  for (var r = 0; r < e.length; r += 1) t.names.push({
                    name: "name_" + r,
                    type: "NAME",
                    value: e[r]
                  });
                  return t
                }([t.postScriptName]);
                var u, h, d, c = Ue(n, l);
                i.topDictIndex = Fe(c), i.globalSubrIndex = new $.Record("Global Subr INDEX", [{
                  name: "subrs",
                  type: "INDEX",
                  value: []
                }]), i.charsets = function(e, t) {
                  for (var r = new $.Record("Charsets", [{
                      name: "format",
                      type: "Card8",
                      value: 0
                    }]), i = 0; i < e.length; i += 1) {
                    var a = Ie(e[i], t);
                    r.fields.push({
                      name: "glyph_" + i,
                      type: "SID",
                      value: a
                    })
                  }
                  return r
                }(o, l), i.charStringsIndex = function(e) {
                  for (var t = new $.Record("CharStrings INDEX", [{
                      name: "charStrings",
                      type: "INDEX",
                      value: []
                    }]), r = 0; r < e.length; r += 1) {
                    var i = e.get(r),
                      a = Ne(i);
                    t.charStrings.push({
                      name: i.name,
                      type: "CHARSTRING",
                      value: a
                    })
                  }
                  return t
                }(e), i.privateDict = (u = {}, h = l, (d = new $.Record("Private DICT", [{
                  name: "dict",
                  type: "DICT",
                  value: {}
                }])).dict = ke(Re, u, h), d), i.stringIndex = function(e) {
                  var t = new $.Record("String INDEX", [{
                    name: "strings",
                    type: "INDEX",
                    value: []
                  }]);
                  t.strings = [];
                  for (var r = 0; r < e.length; r += 1) t.strings.push({
                    name: "string_" + r,
                    type: "STRING",
                    value: e[r]
                  });
                  return t
                }(l);
                var f = i.header.sizeOf() + i.nameIndex.sizeOf() + i.topDictIndex.sizeOf() + i.stringIndex.sizeOf() + i.globalSubrIndex.sizeOf();
                return n.charset = f, n.encoding = 0, n.charStrings = n.charset + i.charsets.sizeOf(), n.private[1] = n.charStrings + i.charStringsIndex.sizeOf(), c = Ue(n, l), i.topDictIndex = Fe(c), i
              }
            };
            var Ge = {
              parse: function(e, t) {
                var r = {},
                  i = new se.Parser(e, t);
                return r.version = i.parseVersion(), r.fontRevision = Math.round(1e3 * i.parseFixed()) / 1e3, r.checkSumAdjustment = i.parseULong(), r.magicNumber = i.parseULong(), R.argument(1594834165 === r.magicNumber, "Font header has wrong magic number."), r.flags = i.parseUShort(), r.unitsPerEm = i.parseUShort(), r.created = i.parseLongDateTime(), r.modified = i.parseLongDateTime(), r.xMin = i.parseShort(), r.yMin = i.parseShort(), r.xMax = i.parseShort(), r.yMax = i.parseShort(), r.macStyle = i.parseUShort(), r.lowestRecPPEM = i.parseUShort(), r.fontDirectionHint = i.parseShort(), r.indexToLocFormat = i.parseShort(), r.glyphDataFormat = i.parseShort(), r
              },
              make: function(e) {
                var t = Math.round((new Date).getTime() / 1e3) + 2082844800,
                  r = t;
                return e.createdTimestamp && (r = e.createdTimestamp + 2082844800), new $.Table("head", [{
                  name: "version",
                  type: "FIXED",
                  value: 65536
                }, {
                  name: "fontRevision",
                  type: "FIXED",
                  value: 65536
                }, {
                  name: "checkSumAdjustment",
                  type: "ULONG",
                  value: 0
                }, {
                  name: "magicNumber",
                  type: "ULONG",
                  value: 1594834165
                }, {
                  name: "flags",
                  type: "USHORT",
                  value: 0
                }, {
                  name: "unitsPerEm",
                  type: "USHORT",
                  value: 1e3
                }, {
                  name: "created",
                  type: "LONGDATETIME",
                  value: r
                }, {
                  name: "modified",
                  type: "LONGDATETIME",
                  value: t
                }, {
                  name: "xMin",
                  type: "SHORT",
                  value: 0
                }, {
                  name: "yMin",
                  type: "SHORT",
                  value: 0
                }, {
                  name: "xMax",
                  type: "SHORT",
                  value: 0
                }, {
                  name: "yMax",
                  type: "SHORT",
                  value: 0
                }, {
                  name: "macStyle",
                  type: "USHORT",
                  value: 0
                }, {
                  name: "lowestRecPPEM",
                  type: "USHORT",
                  value: 0
                }, {
                  name: "fontDirectionHint",
                  type: "SHORT",
                  value: 2
                }, {
                  name: "indexToLocFormat",
                  type: "SHORT",
                  value: 0
                }, {
                  name: "glyphDataFormat",
                  type: "SHORT",
                  value: 0
                }], e)
              }
            };
            var je = {
              parse: function(e, t) {
                var r = {},
                  i = new se.Parser(e, t);
                return r.version = i.parseVersion(), r.ascender = i.parseShort(), r.descender = i.parseShort(), r.lineGap = i.parseShort(), r.advanceWidthMax = i.parseUShort(), r.minLeftSideBearing = i.parseShort(), r.minRightSideBearing = i.parseShort(), r.xMaxExtent = i.parseShort(), r.caretSlopeRise = i.parseShort(), r.caretSlopeRun = i.parseShort(), r.caretOffset = i.parseShort(), i.relativeOffset += 8, r.metricDataFormat = i.parseShort(), r.numberOfHMetrics = i.parseUShort(), r
              },
              make: function(e) {
                return new $.Table("hhea", [{
                  name: "version",
                  type: "FIXED",
                  value: 65536
                }, {
                  name: "ascender",
                  type: "FWORD",
                  value: 0
                }, {
                  name: "descender",
                  type: "FWORD",
                  value: 0
                }, {
                  name: "lineGap",
                  type: "FWORD",
                  value: 0
                }, {
                  name: "advanceWidthMax",
                  type: "UFWORD",
                  value: 0
                }, {
                  name: "minLeftSideBearing",
                  type: "FWORD",
                  value: 0
                }, {
                  name: "minRightSideBearing",
                  type: "FWORD",
                  value: 0
                }, {
                  name: "xMaxExtent",
                  type: "FWORD",
                  value: 0
                }, {
                  name: "caretSlopeRise",
                  type: "SHORT",
                  value: 1
                }, {
                  name: "caretSlopeRun",
                  type: "SHORT",
                  value: 0
                }, {
                  name: "caretOffset",
                  type: "SHORT",
                  value: 0
                }, {
                  name: "reserved1",
                  type: "SHORT",
                  value: 0
                }, {
                  name: "reserved2",
                  type: "SHORT",
                  value: 0
                }, {
                  name: "reserved3",
                  type: "SHORT",
                  value: 0
                }, {
                  name: "reserved4",
                  type: "SHORT",
                  value: 0
                }, {
                  name: "metricDataFormat",
                  type: "SHORT",
                  value: 0
                }, {
                  name: "numberOfHMetrics",
                  type: "USHORT",
                  value: 0
                }], e)
              }
            };
            var Ve = {
              parse: function(e, t, r, i, a) {
                for (var n, o, s = new se.Parser(e, t), l = 0; l < i; l += 1) {
                  l < r && (n = s.parseUShort(), o = s.parseShort());
                  var u = a.get(l);
                  u.advanceWidth = n, u.leftSideBearing = o
                }
              },
              make: function(e) {
                for (var t = new $.Table("hmtx", []), r = 0; r < e.length; r += 1) {
                  var i = e.get(r),
                    a = i.advanceWidth || 0,
                    n = i.leftSideBearing || 0;
                  t.fields.push({
                    name: "advanceWidth_" + r,
                    type: "USHORT",
                    value: a
                  }), t.fields.push({
                    name: "leftSideBearing_" + r,
                    type: "SHORT",
                    value: n
                  })
                }
                return t
              }
            };
            var ze = {
              make: function(e) {
                for (var t = new $.Table("ltag", [{
                    name: "version",
                    type: "ULONG",
                    value: 1
                  }, {
                    name: "flags",
                    type: "ULONG",
                    value: 0
                  }, {
                    name: "numTags",
                    type: "ULONG",
                    value: e.length
                  }]), r = "", i = 12 + 4 * e.length, a = 0; a < e.length; ++a) {
                  var n = r.indexOf(e[a]);
                  n < 0 && (n = r.length, r += e[a]), t.fields.push({
                    name: "offset " + a,
                    type: "USHORT",
                    value: i + n
                  }), t.fields.push({
                    name: "length " + a,
                    type: "USHORT",
                    value: e[a].length
                  })
                }
                return t.fields.push({
                  name: "stringPool",
                  type: "CHARARRAY",
                  value: r
                }), t
              },
              parse: function(e, t) {
                var r = new se.Parser(e, t),
                  i = r.parseULong();
                R.argument(1 === i, "Unsupported ltag table version."), r.skip("uLong", 1);
                for (var a = r.parseULong(), n = [], o = 0; o < a; o++) {
                  for (var s = "", l = t + r.parseUShort(), u = r.parseUShort(), h = l; h < l + u; ++h) s += String.fromCharCode(e.getInt8(h));
                  n.push(s)
                }
                return n
              }
            };
            var He = {
                parse: function(e, t) {
                  var r = {},
                    i = new se.Parser(e, t);
                  return r.version = i.parseVersion(), r.numGlyphs = i.parseUShort(), 1 === r.version && (r.maxPoints = i.parseUShort(), r.maxContours = i.parseUShort(), r.maxCompositePoints = i.parseUShort(), r.maxCompositeContours = i.parseUShort(), r.maxZones = i.parseUShort(), r.maxTwilightPoints = i.parseUShort(), r.maxStorage = i.parseUShort(), r.maxFunctionDefs = i.parseUShort(), r.maxInstructionDefs = i.parseUShort(), r.maxStackElements = i.parseUShort(), r.maxSizeOfInstructions = i.parseUShort(), r.maxComponentElements = i.parseUShort(), r.maxComponentDepth = i.parseUShort()), r
                },
                make: function(e) {
                  return new $.Table("maxp", [{
                    name: "version",
                    type: "FIXED",
                    value: 20480
                  }, {
                    name: "numGlyphs",
                    type: "USHORT",
                    value: e
                  }])
                }
              },
              We = ["copyright", "fontFamily", "fontSubfamily", "uniqueID", "fullName", "version", "postScriptName", "trademark", "manufacturer", "designer", "description", "manufacturerURL", "designerURL", "license", "licenseURL", "reserved", "preferredFamily", "preferredSubfamily", "compatibleFullName", "sampleText", "postScriptFindFontName", "wwsFamily", "wwsSubfamily"],
              Xe = {
                0: "en",
                1: "fr",
                2: "de",
                3: "it",
                4: "nl",
                5: "sv",
                6: "es",
                7: "da",
                8: "pt",
                9: "no",
                10: "he",
                11: "ja",
                12: "ar",
                13: "fi",
                14: "el",
                15: "is",
                16: "mt",
                17: "tr",
                18: "hr",
                19: "zh-Hant",
                20: "ur",
                21: "hi",
                22: "th",
                23: "ko",
                24: "lt",
                25: "pl",
                26: "hu",
                27: "es",
                28: "lv",
                29: "se",
                30: "fo",
                31: "fa",
                32: "ru",
                33: "zh",
                34: "nl-BE",
                35: "ga",
                36: "sq",
                37: "ro",
                38: "cz",
                39: "sk",
                40: "si",
                41: "yi",
                42: "sr",
                43: "mk",
                44: "bg",
                45: "uk",
                46: "be",
                47: "uz",
                48: "kk",
                49: "az-Cyrl",
                50: "az-Arab",
                51: "hy",
                52: "ka",
                53: "mo",
                54: "ky",
                55: "tg",
                56: "tk",
                57: "mn-CN",
                58: "mn",
                59: "ps",
                60: "ks",
                61: "ku",
                62: "sd",
                63: "bo",
                64: "ne",
                65: "sa",
                66: "mr",
                67: "bn",
                68: "as",
                69: "gu",
                70: "pa",
                71: "or",
                72: "ml",
                73: "kn",
                74: "ta",
                75: "te",
                76: "si",
                77: "my",
                78: "km",
                79: "lo",
                80: "vi",
                81: "id",
                82: "tl",
                83: "ms",
                84: "ms-Arab",
                85: "am",
                86: "ti",
                87: "om",
                88: "so",
                89: "sw",
                90: "rw",
                91: "rn",
                92: "ny",
                93: "mg",
                94: "eo",
                128: "cy",
                129: "eu",
                130: "ca",
                131: "la",
                132: "qu",
                133: "gn",
                134: "ay",
                135: "tt",
                136: "ug",
                137: "dz",
                138: "jv",
                139: "su",
                140: "gl",
                141: "af",
                142: "br",
                143: "iu",
                144: "gd",
                145: "gv",
                146: "ga",
                147: "to",
                148: "el-polyton",
                149: "kl",
                150: "az",
                151: "nn"
              },
              qe = {
                0: 0,
                1: 0,
                2: 0,
                3: 0,
                4: 0,
                5: 0,
                6: 0,
                7: 0,
                8: 0,
                9: 0,
                10: 5,
                11: 1,
                12: 4,
                13: 0,
                14: 6,
                15: 0,
                16: 0,
                17: 0,
                18: 0,
                19: 2,
                20: 4,
                21: 9,
                22: 21,
                23: 3,
                24: 29,
                25: 29,
                26: 29,
                27: 29,
                28: 29,
                29: 0,
                30: 0,
                31: 4,
                32: 7,
                33: 25,
                34: 0,
                35: 0,
                36: 0,
                37: 0,
                38: 29,
                39: 29,
                40: 0,
                41: 5,
                42: 7,
                43: 7,
                44: 7,
                45: 7,
                46: 7,
                47: 7,
                48: 7,
                49: 7,
                50: 4,
                51: 24,
                52: 23,
                53: 7,
                54: 7,
                55: 7,
                56: 7,
                57: 27,
                58: 7,
                59: 4,
                60: 4,
                61: 4,
                62: 4,
                63: 26,
                64: 9,
                65: 9,
                66: 9,
                67: 13,
                68: 13,
                69: 11,
                70: 10,
                71: 12,
                72: 17,
                73: 16,
                74: 14,
                75: 15,
                76: 18,
                77: 19,
                78: 20,
                79: 22,
                80: 30,
                81: 0,
                82: 0,
                83: 0,
                84: 4,
                85: 28,
                86: 28,
                87: 28,
                88: 0,
                89: 0,
                90: 0,
                91: 0,
                92: 0,
                93: 0,
                94: 0,
                128: 0,
                129: 0,
                130: 0,
                131: 0,
                132: 0,
                133: 0,
                134: 0,
                135: 7,
                136: 4,
                137: 26,
                138: 0,
                139: 0,
                140: 0,
                141: 0,
                142: 0,
                143: 28,
                144: 0,
                145: 0,
                146: 0,
                147: 0,
                148: 6,
                149: 0,
                150: 0,
                151: 0
              },
              Ye = {
                1078: "af",
                1052: "sq",
                1156: "gsw",
                1118: "am",
                5121: "ar-DZ",
                15361: "ar-BH",
                3073: "ar",
                2049: "ar-IQ",
                11265: "ar-JO",
                13313: "ar-KW",
                12289: "ar-LB",
                4097: "ar-LY",
                6145: "ary",
                8193: "ar-OM",
                16385: "ar-QA",
                1025: "ar-SA",
                10241: "ar-SY",
                7169: "aeb",
                14337: "ar-AE",
                9217: "ar-YE",
                1067: "hy",
                1101: "as",
                2092: "az-Cyrl",
                1068: "az",
                1133: "ba",
                1069: "eu",
                1059: "be",
                2117: "bn",
                1093: "bn-IN",
                8218: "bs-Cyrl",
                5146: "bs",
                1150: "br",
                1026: "bg",
                1027: "ca",
                3076: "zh-HK",
                5124: "zh-MO",
                2052: "zh",
                4100: "zh-SG",
                1028: "zh-TW",
                1155: "co",
                1050: "hr",
                4122: "hr-BA",
                1029: "cs",
                1030: "da",
                1164: "prs",
                1125: "dv",
                2067: "nl-BE",
                1043: "nl",
                3081: "en-AU",
                10249: "en-BZ",
                4105: "en-CA",
                9225: "en-029",
                16393: "en-IN",
                6153: "en-IE",
                8201: "en-JM",
                17417: "en-MY",
                5129: "en-NZ",
                13321: "en-PH",
                18441: "en-SG",
                7177: "en-ZA",
                11273: "en-TT",
                2057: "en-GB",
                1033: "en",
                12297: "en-ZW",
                1061: "et",
                1080: "fo",
                1124: "fil",
                1035: "fi",
                2060: "fr-BE",
                3084: "fr-CA",
                1036: "fr",
                5132: "fr-LU",
                6156: "fr-MC",
                4108: "fr-CH",
                1122: "fy",
                1110: "gl",
                1079: "ka",
                3079: "de-AT",
                1031: "de",
                5127: "de-LI",
                4103: "de-LU",
                2055: "de-CH",
                1032: "el",
                1135: "kl",
                1095: "gu",
                1128: "ha",
                1037: "he",
                1081: "hi",
                1038: "hu",
                1039: "is",
                1136: "ig",
                1057: "id",
                1117: "iu",
                2141: "iu-Latn",
                2108: "ga",
                1076: "xh",
                1077: "zu",
                1040: "it",
                2064: "it-CH",
                1041: "ja",
                1099: "kn",
                1087: "kk",
                1107: "km",
                1158: "quc",
                1159: "rw",
                1089: "sw",
                1111: "kok",
                1042: "ko",
                1088: "ky",
                1108: "lo",
                1062: "lv",
                1063: "lt",
                2094: "dsb",
                1134: "lb",
                1071: "mk",
                2110: "ms-BN",
                1086: "ms",
                1100: "ml",
                1082: "mt",
                1153: "mi",
                1146: "arn",
                1102: "mr",
                1148: "moh",
                1104: "mn",
                2128: "mn-CN",
                1121: "ne",
                1044: "nb",
                2068: "nn",
                1154: "oc",
                1096: "or",
                1123: "ps",
                1045: "pl",
                1046: "pt",
                2070: "pt-PT",
                1094: "pa",
                1131: "qu-BO",
                2155: "qu-EC",
                3179: "qu",
                1048: "ro",
                1047: "rm",
                1049: "ru",
                9275: "smn",
                4155: "smj-NO",
                5179: "smj",
                3131: "se-FI",
                1083: "se",
                2107: "se-SE",
                8251: "sms",
                6203: "sma-NO",
                7227: "sms",
                1103: "sa",
                7194: "sr-Cyrl-BA",
                3098: "sr",
                6170: "sr-Latn-BA",
                2074: "sr-Latn",
                1132: "nso",
                1074: "tn",
                1115: "si",
                1051: "sk",
                1060: "sl",
                11274: "es-AR",
                16394: "es-BO",
                13322: "es-CL",
                9226: "es-CO",
                5130: "es-CR",
                7178: "es-DO",
                12298: "es-EC",
                17418: "es-SV",
                4106: "es-GT",
                18442: "es-HN",
                2058: "es-MX",
                19466: "es-NI",
                6154: "es-PA",
                15370: "es-PY",
                10250: "es-PE",
                20490: "es-PR",
                3082: "es",
                1034: "es",
                21514: "es-US",
                14346: "es-UY",
                8202: "es-VE",
                2077: "sv-FI",
                1053: "sv",
                1114: "syr",
                1064: "tg",
                2143: "tzm",
                1097: "ta",
                1092: "tt",
                1098: "te",
                1054: "th",
                1105: "bo",
                1055: "tr",
                1090: "tk",
                1152: "ug",
                1058: "uk",
                1070: "hsb",
                1056: "ur",
                2115: "uz-Cyrl",
                1091: "uz",
                1066: "vi",
                1106: "cy",
                1160: "wo",
                1157: "sah",
                1144: "ii",
                1130: "yo"
              };

            function Ze(e, t, r) {
              switch (e) {
                case 0:
                  if (65535 === t) return "und";
                  if (r) return r[t];
                  break;
                case 1:
                  return Xe[t];
                case 3:
                  return Ye[t]
              }
            }
            var Qe = "utf-16",
              Ke = {
                0: "macintosh",
                1: "x-mac-japanese",
                2: "x-mac-chinesetrad",
                3: "x-mac-korean",
                6: "x-mac-greek",
                7: "x-mac-cyrillic",
                9: "x-mac-devanagai",
                10: "x-mac-gurmukhi",
                11: "x-mac-gujarati",
                12: "x-mac-oriya",
                13: "x-mac-bengali",
                14: "x-mac-tamil",
                15: "x-mac-telugu",
                16: "x-mac-kannada",
                17: "x-mac-malayalam",
                18: "x-mac-sinhalese",
                19: "x-mac-burmese",
                20: "x-mac-khmer",
                21: "x-mac-thai",
                22: "x-mac-lao",
                23: "x-mac-georgian",
                24: "x-mac-armenian",
                25: "x-mac-chinesesimp",
                26: "x-mac-tibetan",
                27: "x-mac-mongolian",
                28: "x-mac-ethiopic",
                29: "x-mac-ce",
                30: "x-mac-vietnamese",
                31: "x-mac-extarabic"
              },
              Je = {
                15: "x-mac-icelandic",
                17: "x-mac-turkish",
                18: "x-mac-croatian",
                24: "x-mac-ce",
                25: "x-mac-ce",
                26: "x-mac-ce",
                27: "x-mac-ce",
                28: "x-mac-ce",
                30: "x-mac-icelandic",
                37: "x-mac-romanian",
                38: "x-mac-ce",
                39: "x-mac-ce",
                40: "x-mac-ce",
                143: "x-mac-inuit",
                146: "x-mac-gaelic"
              };

            function $e(e, t, r) {
              switch (e) {
                case 0:
                  return Qe;
                case 1:
                  return Je[r] || Ke[t];
                case 3:
                  if (1 === t || 10 === t) return Qe
              }
            }

            function et(e) {
              var t = {};
              for (var r in e) t[e[r]] = parseInt(r);
              return t
            }

            function tt(e, t, r, i, a, n) {
              return new $.Record("NameRecord", [{
                name: "platformID",
                type: "USHORT",
                value: e
              }, {
                name: "encodingID",
                type: "USHORT",
                value: t
              }, {
                name: "languageID",
                type: "USHORT",
                value: r
              }, {
                name: "nameID",
                type: "USHORT",
                value: i
              }, {
                name: "length",
                type: "USHORT",
                value: a
              }, {
                name: "offset",
                type: "USHORT",
                value: n
              }])
            }

            function rt(e, t) {
              var r = function(e, t) {
                var r = e.length,
                  i = t.length - r + 1;
                e: for (var a = 0; a < i; a++)
                  for (; a < i; a++) {
                    for (var n = 0; n < r; n++)
                      if (t[a + n] !== e[n]) continue e;
                    return a
                  }
                return -1
              }(e, t);
              if (r < 0) {
                r = t.length;
                for (var i = 0, a = e.length; i < a; ++i) t.push(e[i])
              }
              return r
            }
            var it = {
                parse: function(e, t, r) {
                  for (var i = {}, a = new se.Parser(e, t), n = a.parseUShort(), o = a.parseUShort(), s = a.offset + a.parseUShort(), l = 0; l < o; l++) {
                    var u = a.parseUShort(),
                      h = a.parseUShort(),
                      d = a.parseUShort(),
                      c = a.parseUShort(),
                      f = We[c] || c,
                      p = a.parseUShort(),
                      m = a.parseUShort(),
                      v = Ze(u, d, r),
                      g = $e(u, h, d);
                    if (void 0 !== g && void 0 !== v) {
                      var y = void 0;
                      if (y = g === Qe ? D.UTF16(e, s + m, p) : D.MACSTRING(e, s + m, p, g)) {
                        var _ = i[f];
                        void 0 === _ && (_ = i[f] = {}), _[v] = y
                      }
                    }
                  }
                  return 1 === n && a.parseUShort(), i
                },
                make: function(e, t) {
                  var r, i = [],
                    a = {},
                    n = et(We);
                  for (var o in e) {
                    var s = n[o];
                    if (void 0 === s && (s = o), r = parseInt(s), isNaN(r)) throw new Error('Name table entry "' + o + '" does not exist, see nameTableNames for complete list.');
                    a[r] = e[o], i.push(r)
                  }
                  for (var l = et(Xe), u = et(Ye), h = [], d = [], c = 0; c < i.length; c++) {
                    var f = a[r = i[c]];
                    for (var p in f) {
                      var m = f[p],
                        v = 1,
                        g = l[p],
                        y = qe[g],
                        _ = $e(v, y, g),
                        b = A.MACSTRING(m, _);
                      void 0 === b && (v = 0, (g = t.indexOf(p)) < 0 && (g = t.length, t.push(p)), y = 4, b = A.UTF16(m));
                      var x = rt(b, d);
                      h.push(tt(v, y, g, r, b.length, x));
                      var w = u[p];
                      if (void 0 !== w) {
                        var S = A.UTF16(m),
                          M = rt(S, d);
                        h.push(tt(3, 1, w, r, S.length, M))
                      }
                    }
                  }
                  h.sort(function(e, t) {
                    return e.platformID - t.platformID || e.encodingID - t.encodingID || e.languageID - t.languageID || e.nameID - t.nameID
                  });
                  for (var E = new $.Table("name", [{
                      name: "format",
                      type: "USHORT",
                      value: 0
                    }, {
                      name: "count",
                      type: "USHORT",
                      value: h.length
                    }, {
                      name: "stringOffset",
                      type: "USHORT",
                      value: 6 + 12 * h.length
                    }]), T = 0; T < h.length; T++) E.fields.push({
                    name: "record_" + T,
                    type: "RECORD",
                    value: h[T]
                  });
                  return E.fields.push({
                    name: "strings",
                    type: "LITERAL",
                    value: d
                  }), E
                }
              },
              at = [{
                begin: 0,
                end: 127
              }, {
                begin: 128,
                end: 255
              }, {
                begin: 256,
                end: 383
              }, {
                begin: 384,
                end: 591
              }, {
                begin: 592,
                end: 687
              }, {
                begin: 688,
                end: 767
              }, {
                begin: 768,
                end: 879
              }, {
                begin: 880,
                end: 1023
              }, {
                begin: 11392,
                end: 11519
              }, {
                begin: 1024,
                end: 1279
              }, {
                begin: 1328,
                end: 1423
              }, {
                begin: 1424,
                end: 1535
              }, {
                begin: 42240,
                end: 42559
              }, {
                begin: 1536,
                end: 1791
              }, {
                begin: 1984,
                end: 2047
              }, {
                begin: 2304,
                end: 2431
              }, {
                begin: 2432,
                end: 2559
              }, {
                begin: 2560,
                end: 2687
              }, {
                begin: 2688,
                end: 2815
              }, {
                begin: 2816,
                end: 2943
              }, {
                begin: 2944,
                end: 3071
              }, {
                begin: 3072,
                end: 3199
              }, {
                begin: 3200,
                end: 3327
              }, {
                begin: 3328,
                end: 3455
              }, {
                begin: 3584,
                end: 3711
              }, {
                begin: 3712,
                end: 3839
              }, {
                begin: 4256,
                end: 4351
              }, {
                begin: 6912,
                end: 7039
              }, {
                begin: 4352,
                end: 4607
              }, {
                begin: 7680,
                end: 7935
              }, {
                begin: 7936,
                end: 8191
              }, {
                begin: 8192,
                end: 8303
              }, {
                begin: 8304,
                end: 8351
              }, {
                begin: 8352,
                end: 8399
              }, {
                begin: 8400,
                end: 8447
              }, {
                begin: 8448,
                end: 8527
              }, {
                begin: 8528,
                end: 8591
              }, {
                begin: 8592,
                end: 8703
              }, {
                begin: 8704,
                end: 8959
              }, {
                begin: 8960,
                end: 9215
              }, {
                begin: 9216,
                end: 9279
              }, {
                begin: 9280,
                end: 9311
              }, {
                begin: 9312,
                end: 9471
              }, {
                begin: 9472,
                end: 9599
              }, {
                begin: 9600,
                end: 9631
              }, {
                begin: 9632,
                end: 9727
              }, {
                begin: 9728,
                end: 9983
              }, {
                begin: 9984,
                end: 10175
              }, {
                begin: 12288,
                end: 12351
              }, {
                begin: 12352,
                end: 12447
              }, {
                begin: 12448,
                end: 12543
              }, {
                begin: 12544,
                end: 12591
              }, {
                begin: 12592,
                end: 12687
              }, {
                begin: 43072,
                end: 43135
              }, {
                begin: 12800,
                end: 13055
              }, {
                begin: 13056,
                end: 13311
              }, {
                begin: 44032,
                end: 55215
              }, {
                begin: 55296,
                end: 57343
              }, {
                begin: 67840,
                end: 67871
              }, {
                begin: 19968,
                end: 40959
              }, {
                begin: 57344,
                end: 63743
              }, {
                begin: 12736,
                end: 12783
              }, {
                begin: 64256,
                end: 64335
              }, {
                begin: 64336,
                end: 65023
              }, {
                begin: 65056,
                end: 65071
              }, {
                begin: 65040,
                end: 65055
              }, {
                begin: 65104,
                end: 65135
              }, {
                begin: 65136,
                end: 65279
              }, {
                begin: 65280,
                end: 65519
              }, {
                begin: 65520,
                end: 65535
              }, {
                begin: 3840,
                end: 4095
              }, {
                begin: 1792,
                end: 1871
              }, {
                begin: 1920,
                end: 1983
              }, {
                begin: 3456,
                end: 3583
              }, {
                begin: 4096,
                end: 4255
              }, {
                begin: 4608,
                end: 4991
              }, {
                begin: 5024,
                end: 5119
              }, {
                begin: 5120,
                end: 5759
              }, {
                begin: 5760,
                end: 5791
              }, {
                begin: 5792,
                end: 5887
              }, {
                begin: 6016,
                end: 6143
              }, {
                begin: 6144,
                end: 6319
              }, {
                begin: 10240,
                end: 10495
              }, {
                begin: 40960,
                end: 42127
              }, {
                begin: 5888,
                end: 5919
              }, {
                begin: 66304,
                end: 66351
              }, {
                begin: 66352,
                end: 66383
              }, {
                begin: 66560,
                end: 66639
              }, {
                begin: 118784,
                end: 119039
              }, {
                begin: 119808,
                end: 120831
              }, {
                begin: 1044480,
                end: 1048573
              }, {
                begin: 65024,
                end: 65039
              }, {
                begin: 917504,
                end: 917631
              }, {
                begin: 6400,
                end: 6479
              }, {
                begin: 6480,
                end: 6527
              }, {
                begin: 6528,
                end: 6623
              }, {
                begin: 6656,
                end: 6687
              }, {
                begin: 11264,
                end: 11359
              }, {
                begin: 11568,
                end: 11647
              }, {
                begin: 19904,
                end: 19967
              }, {
                begin: 43008,
                end: 43055
              }, {
                begin: 65536,
                end: 65663
              }, {
                begin: 65856,
                end: 65935
              }, {
                begin: 66432,
                end: 66463
              }, {
                begin: 66464,
                end: 66527
              }, {
                begin: 66640,
                end: 66687
              }, {
                begin: 66688,
                end: 66735
              }, {
                begin: 67584,
                end: 67647
              }, {
                begin: 68096,
                end: 68191
              }, {
                begin: 119552,
                end: 119647
              }, {
                begin: 73728,
                end: 74751
              }, {
                begin: 119648,
                end: 119679
              }, {
                begin: 7040,
                end: 7103
              }, {
                begin: 7168,
                end: 7247
              }, {
                begin: 7248,
                end: 7295
              }, {
                begin: 43136,
                end: 43231
              }, {
                begin: 43264,
                end: 43311
              }, {
                begin: 43312,
                end: 43359
              }, {
                begin: 43520,
                end: 43615
              }, {
                begin: 65936,
                end: 65999
              }, {
                begin: 66e3,
                end: 66047
              }, {
                begin: 66208,
                end: 66271
              }, {
                begin: 127024,
                end: 127135
              }];
            var nt = {
              parse: function(e, t) {
                var r = {},
                  i = new se.Parser(e, t);
                r.version = i.parseUShort(), r.xAvgCharWidth = i.parseShort(), r.usWeightClass = i.parseUShort(), r.usWidthClass = i.parseUShort(), r.fsType = i.parseUShort(), r.ySubscriptXSize = i.parseShort(), r.ySubscriptYSize = i.parseShort(), r.ySubscriptXOffset = i.parseShort(), r.ySubscriptYOffset = i.parseShort(), r.ySuperscriptXSize = i.parseShort(), r.ySuperscriptYSize = i.parseShort(), r.ySuperscriptXOffset = i.parseShort(), r.ySuperscriptYOffset = i.parseShort(), r.yStrikeoutSize = i.parseShort(), r.yStrikeoutPosition = i.parseShort(), r.sFamilyClass = i.parseShort(), r.panose = [];
                for (var a = 0; a < 10; a++) r.panose[a] = i.parseByte();
                return r.ulUnicodeRange1 = i.parseULong(), r.ulUnicodeRange2 = i.parseULong(), r.ulUnicodeRange3 = i.parseULong(), r.ulUnicodeRange4 = i.parseULong(), r.achVendID = String.fromCharCode(i.parseByte(), i.parseByte(), i.parseByte(), i.parseByte()), r.fsSelection = i.parseUShort(), r.usFirstCharIndex = i.parseUShort(), r.usLastCharIndex = i.parseUShort(), r.sTypoAscender = i.parseShort(), r.sTypoDescender = i.parseShort(), r.sTypoLineGap = i.parseShort(), r.usWinAscent = i.parseUShort(), r.usWinDescent = i.parseUShort(), 1 <= r.version && (r.ulCodePageRange1 = i.parseULong(), r.ulCodePageRange2 = i.parseULong()), 2 <= r.version && (r.sxHeight = i.parseShort(), r.sCapHeight = i.parseShort(), r.usDefaultChar = i.parseUShort(), r.usBreakChar = i.parseUShort(), r.usMaxContent = i.parseUShort()), r
              },
              make: function(e) {
                return new $.Table("OS/2", [{
                  name: "version",
                  type: "USHORT",
                  value: 3
                }, {
                  name: "xAvgCharWidth",
                  type: "SHORT",
                  value: 0
                }, {
                  name: "usWeightClass",
                  type: "USHORT",
                  value: 0
                }, {
                  name: "usWidthClass",
                  type: "USHORT",
                  value: 0
                }, {
                  name: "fsType",
                  type: "USHORT",
                  value: 0
                }, {
                  name: "ySubscriptXSize",
                  type: "SHORT",
                  value: 650
                }, {
                  name: "ySubscriptYSize",
                  type: "SHORT",
                  value: 699
                }, {
                  name: "ySubscriptXOffset",
                  type: "SHORT",
                  value: 0
                }, {
                  name: "ySubscriptYOffset",
                  type: "SHORT",
                  value: 140
                }, {
                  name: "ySuperscriptXSize",
                  type: "SHORT",
                  value: 650
                }, {
                  name: "ySuperscriptYSize",
                  type: "SHORT",
                  value: 699
                }, {
                  name: "ySuperscriptXOffset",
                  type: "SHORT",
                  value: 0
                }, {
                  name: "ySuperscriptYOffset",
                  type: "SHORT",
                  value: 479
                }, {
                  name: "yStrikeoutSize",
                  type: "SHORT",
                  value: 49
                }, {
                  name: "yStrikeoutPosition",
                  type: "SHORT",
                  value: 258
                }, {
                  name: "sFamilyClass",
                  type: "SHORT",
                  value: 0
                }, {
                  name: "bFamilyType",
                  type: "BYTE",
                  value: 0
                }, {
                  name: "bSerifStyle",
                  type: "BYTE",
                  value: 0
                }, {
                  name: "bWeight",
                  type: "BYTE",
                  value: 0
                }, {
                  name: "bProportion",
                  type: "BYTE",
                  value: 0
                }, {
                  name: "bContrast",
                  type: "BYTE",
                  value: 0
                }, {
                  name: "bStrokeVariation",
                  type: "BYTE",
                  value: 0
                }, {
                  name: "bArmStyle",
                  type: "BYTE",
                  value: 0
                }, {
                  name: "bLetterform",
                  type: "BYTE",
                  value: 0
                }, {
                  name: "bMidline",
                  type: "BYTE",
                  value: 0
                }, {
                  name: "bXHeight",
                  type: "BYTE",
                  value: 0
                }, {
                  name: "ulUnicodeRange1",
                  type: "ULONG",
                  value: 0
                }, {
                  name: "ulUnicodeRange2",
                  type: "ULONG",
                  value: 0
                }, {
                  name: "ulUnicodeRange3",
                  type: "ULONG",
                  value: 0
                }, {
                  name: "ulUnicodeRange4",
                  type: "ULONG",
                  value: 0
                }, {
                  name: "achVendID",
                  type: "CHARARRAY",
                  value: "XXXX"
                }, {
                  name: "fsSelection",
                  type: "USHORT",
                  value: 0
                }, {
                  name: "usFirstCharIndex",
                  type: "USHORT",
                  value: 0
                }, {
                  name: "usLastCharIndex",
                  type: "USHORT",
                  value: 0
                }, {
                  name: "sTypoAscender",
                  type: "SHORT",
                  value: 0
                }, {
                  name: "sTypoDescender",
                  type: "SHORT",
                  value: 0
                }, {
                  name: "sTypoLineGap",
                  type: "SHORT",
                  value: 0
                }, {
                  name: "usWinAscent",
                  type: "USHORT",
                  value: 0
                }, {
                  name: "usWinDescent",
                  type: "USHORT",
                  value: 0
                }, {
                  name: "ulCodePageRange1",
                  type: "ULONG",
                  value: 0
                }, {
                  name: "ulCodePageRange2",
                  type: "ULONG",
                  value: 0
                }, {
                  name: "sxHeight",
                  type: "SHORT",
                  value: 0
                }, {
                  name: "sCapHeight",
                  type: "SHORT",
                  value: 0
                }, {
                  name: "usDefaultChar",
                  type: "USHORT",
                  value: 0
                }, {
                  name: "usBreakChar",
                  type: "USHORT",
                  value: 0
                }, {
                  name: "usMaxContext",
                  type: "USHORT",
                  value: 0
                }], e)
              },
              unicodeRanges: at,
              getUnicodeRange: function(e) {
                for (var t = 0; t < at.length; t += 1) {
                  var r = at[t];
                  if (e >= r.begin && e < r.end) return t
                }
                return -1
              }
            };
            var ot = {
                parse: function(e, t) {
                  var r = {},
                    i = new se.Parser(e, t);
                  switch (r.version = i.parseVersion(), r.italicAngle = i.parseFixed(), r.underlinePosition = i.parseShort(), r.underlineThickness = i.parseShort(), r.isFixedPitch = i.parseULong(), r.minMemType42 = i.parseULong(), r.maxMemType42 = i.parseULong(), r.minMemType1 = i.parseULong(), r.maxMemType1 = i.parseULong(), r.version) {
                    case 1:
                      r.names = ce.slice();
                      break;
                    case 2:
                      r.numberOfGlyphs = i.parseUShort(), r.glyphNameIndex = new Array(r.numberOfGlyphs);
                      for (var a = 0; a < r.numberOfGlyphs; a++) r.glyphNameIndex[a] = i.parseUShort();
                      r.names = [];
                      for (var n = 0; n < r.numberOfGlyphs; n++)
                        if (r.glyphNameIndex[n] >= ce.length) {
                          var o = i.parseChar();
                          r.names.push(i.parseString(o))
                        } break;
                    case 2.5:
                      r.numberOfGlyphs = i.parseUShort(), r.offset = new Array(r.numberOfGlyphs);
                      for (var s = 0; s < r.numberOfGlyphs; s++) r.offset[s] = i.parseChar()
                  }
                  return r
                },
                make: function() {
                  return new $.Table("post", [{
                    name: "version",
                    type: "FIXED",
                    value: 196608
                  }, {
                    name: "italicAngle",
                    type: "FIXED",
                    value: 0
                  }, {
                    name: "underlinePosition",
                    type: "FWORD",
                    value: 0
                  }, {
                    name: "underlineThickness",
                    type: "FWORD",
                    value: 0
                  }, {
                    name: "isFixedPitch",
                    type: "ULONG",
                    value: 0
                  }, {
                    name: "minMemType42",
                    type: "ULONG",
                    value: 0
                  }, {
                    name: "maxMemType42",
                    type: "ULONG",
                    value: 0
                  }, {
                    name: "minMemType1",
                    type: "ULONG",
                    value: 0
                  }, {
                    name: "maxMemType1",
                    type: "ULONG",
                    value: 0
                  }])
                }
              },
              st = new Array(9);
            st[1] = function() {
              var e = this.offset + this.relativeOffset,
                t = this.parseUShort();
              return 1 === t ? {
                substFormat: 1,
                coverage: this.parsePointer(ne.coverage),
                deltaGlyphId: this.parseUShort()
              } : 2 === t ? {
                substFormat: 2,
                coverage: this.parsePointer(ne.coverage),
                substitute: this.parseOffset16List()
              } : void R.assert(!1, "0x" + e.toString(16) + ": lookup type 1 format must be 1 or 2.")
            }, st[2] = function() {
              var e = this.parseUShort();
              return R.argument(1 === e, "GSUB Multiple Substitution Subtable identifier-format must be 1"), {
                substFormat: e,
                coverage: this.parsePointer(ne.coverage),
                sequences: this.parseListOfLists()
              }
            }, st[3] = function() {
              var e = this.parseUShort();
              return R.argument(1 === e, "GSUB Alternate Substitution Subtable identifier-format must be 1"), {
                substFormat: e,
                coverage: this.parsePointer(ne.coverage),
                alternateSets: this.parseListOfLists()
              }
            }, st[4] = function() {
              var e = this.parseUShort();
              return R.argument(1 === e, "GSUB ligature table identifier-format must be 1"), {
                substFormat: e,
                coverage: this.parsePointer(ne.coverage),
                ligatureSets: this.parseListOfLists(function() {
                  return {
                    ligGlyph: this.parseUShort(),
                    components: this.parseUShortList(this.parseUShort() - 1)
                  }
                })
              }
            };
            var lt = {
              sequenceIndex: ne.uShort,
              lookupListIndex: ne.uShort
            };
            st[5] = function() {
              var e = this.offset + this.relativeOffset,
                t = this.parseUShort();
              if (1 === t) return {
                substFormat: t,
                coverage: this.parsePointer(ne.coverage),
                ruleSets: this.parseListOfLists(function() {
                  var e = this.parseUShort(),
                    t = this.parseUShort();
                  return {
                    input: this.parseUShortList(e - 1),
                    lookupRecords: this.parseRecordList(t, lt)
                  }
                })
              };
              if (2 === t) return {
                substFormat: t,
                coverage: this.parsePointer(ne.coverage),
                classDef: this.parsePointer(ne.classDef),
                classSets: this.parseListOfLists(function() {
                  var e = this.parseUShort(),
                    t = this.parseUShort();
                  return {
                    classes: this.parseUShortList(e - 1),
                    lookupRecords: this.parseRecordList(t, lt)
                  }
                })
              };
              if (3 === t) {
                var r = this.parseUShort(),
                  i = this.parseUShort();
                return {
                  substFormat: t,
                  coverages: this.parseList(r, ne.pointer(ne.coverage)),
                  lookupRecords: this.parseRecordList(i, lt)
                }
              }
              R.assert(!1, "0x" + e.toString(16) + ": lookup type 5 format must be 1, 2 or 3.")
            }, st[6] = function() {
              var e = this.offset + this.relativeOffset,
                t = this.parseUShort();
              return 1 === t ? {
                substFormat: 1,
                coverage: this.parsePointer(ne.coverage),
                chainRuleSets: this.parseListOfLists(function() {
                  return {
                    backtrack: this.parseUShortList(),
                    input: this.parseUShortList(this.parseShort() - 1),
                    lookahead: this.parseUShortList(),
                    lookupRecords: this.parseRecordList(lt)
                  }
                })
              } : 2 === t ? {
                substFormat: 2,
                coverage: this.parsePointer(ne.coverage),
                backtrackClassDef: this.parsePointer(ne.classDef),
                inputClassDef: this.parsePointer(ne.classDef),
                lookaheadClassDef: this.parsePointer(ne.classDef),
                chainClassSet: this.parseListOfLists(function() {
                  return {
                    backtrack: this.parseUShortList(),
                    input: this.parseUShortList(this.parseShort() - 1),
                    lookahead: this.parseUShortList(),
                    lookupRecords: this.parseRecordList(lt)
                  }
                })
              } : 3 === t ? {
                substFormat: 3,
                backtrackCoverage: this.parseList(ne.pointer(ne.coverage)),
                inputCoverage: this.parseList(ne.pointer(ne.coverage)),
                lookaheadCoverage: this.parseList(ne.pointer(ne.coverage)),
                lookupRecords: this.parseRecordList(lt)
              } : void R.assert(!1, "0x" + e.toString(16) + ": lookup type 6 format must be 1, 2 or 3.")
            }, st[7] = function() {
              var e = this.parseUShort();
              R.argument(1 === e, "GSUB Extension Substitution subtable identifier-format must be 1");
              var t = this.parseUShort(),
                r = new ne(this.data, this.offset + this.parseULong());
              return {
                substFormat: 1,
                lookupType: t,
                extension: st[t].call(r)
              }
            }, st[8] = function() {
              var e = this.parseUShort();
              return R.argument(1 === e, "GSUB Reverse Chaining Contextual Single Substitution Subtable identifier-format must be 1"), {
                substFormat: e,
                coverage: this.parsePointer(ne.coverage),
                backtrackCoverage: this.parseList(ne.pointer(ne.coverage)),
                lookaheadCoverage: this.parseList(ne.pointer(ne.coverage)),
                substitutes: this.parseUShortList()
              }
            };
            var ut = new Array(9);
            ut[1] = function(e) {
              return 1 === e.substFormat ? new $.Table("substitutionTable", [{
                name: "substFormat",
                type: "USHORT",
                value: 1
              }, {
                name: "coverage",
                type: "TABLE",
                value: new $.Coverage(e.coverage)
              }, {
                name: "deltaGlyphID",
                type: "USHORT",
                value: e.deltaGlyphId
              }]) : new $.Table("substitutionTable", [{
                name: "substFormat",
                type: "USHORT",
                value: 2
              }, {
                name: "coverage",
                type: "TABLE",
                value: new $.Coverage(e.coverage)
              }].concat($.ushortList("substitute", e.substitute)))
            }, ut[3] = function(e) {
              return R.assert(1 === e.substFormat, "Lookup type 3 substFormat must be 1."), new $.Table("substitutionTable", [{
                name: "substFormat",
                type: "USHORT",
                value: 1
              }, {
                name: "coverage",
                type: "TABLE",
                value: new $.Coverage(e.coverage)
              }].concat($.tableList("altSet", e.alternateSets, function(e) {
                return new $.Table("alternateSetTable", $.ushortList("alternate", e))
              })))
            }, ut[4] = function(e) {
              return R.assert(1 === e.substFormat, "Lookup type 4 substFormat must be 1."), new $.Table("substitutionTable", [{
                name: "substFormat",
                type: "USHORT",
                value: 1
              }, {
                name: "coverage",
                type: "TABLE",
                value: new $.Coverage(e.coverage)
              }].concat($.tableList("ligSet", e.ligatureSets, function(e) {
                return new $.Table("ligatureSetTable", $.tableList("ligature", e, function(e) {
                  return new $.Table("ligatureTable", [{
                    name: "ligGlyph",
                    type: "USHORT",
                    value: e.ligGlyph
                  }].concat($.ushortList("component", e.components, e.components.length + 1)))
                }))
              })))
            };
            var ht = {
              parse: function(e, t) {
                var r = new ne(e, t = t || 0),
                  i = r.parseVersion(1);
                return R.argument(1 === i || 1.1 === i, "Unsupported GSUB table version."), 1 === i ? {
                  version: i,
                  scripts: r.parseScriptList(),
                  features: r.parseFeatureList(),
                  lookups: r.parseLookupList(st)
                } : {
                  version: i,
                  scripts: r.parseScriptList(),
                  features: r.parseFeatureList(),
                  lookups: r.parseLookupList(st),
                  variations: r.parseFeatureVariationsList()
                }
              },
              make: function(e) {
                return new $.Table("GSUB", [{
                  name: "version",
                  type: "ULONG",
                  value: 65536
                }, {
                  name: "scripts",
                  type: "TABLE",
                  value: new $.ScriptList(e.scripts)
                }, {
                  name: "features",
                  type: "TABLE",
                  value: new $.FeatureList(e.features)
                }, {
                  name: "lookups",
                  type: "TABLE",
                  value: new $.LookupList(e.lookups, ut)
                }])
              }
            };
            var dt = {
              parse: function(e, t) {
                var r = new se.Parser(e, t),
                  i = r.parseULong();
                R.argument(1 === i, "Unsupported META table version."), r.parseULong(), r.parseULong();
                for (var a = r.parseULong(), n = {}, o = 0; o < a; o++) {
                  var s = r.parseTag(),
                    l = r.parseULong(),
                    u = r.parseULong(),
                    h = D.UTF8(e, t + l, u);
                  n[s] = h
                }
                return n
              },
              make: function(e) {
                var t = Object.keys(e).length,
                  r = "",
                  i = 16 + 12 * t,
                  a = new $.Table("meta", [{
                    name: "version",
                    type: "ULONG",
                    value: 1
                  }, {
                    name: "flags",
                    type: "ULONG",
                    value: 0
                  }, {
                    name: "offset",
                    type: "ULONG",
                    value: i
                  }, {
                    name: "numTags",
                    type: "ULONG",
                    value: t
                  }]);
                for (var n in e) {
                  var o = r.length;
                  r += e[n], a.fields.push({
                    name: "tag " + n,
                    type: "TAG",
                    value: n
                  }), a.fields.push({
                    name: "offset " + n,
                    type: "ULONG",
                    value: i + o
                  }), a.fields.push({
                    name: "length " + n,
                    type: "ULONG",
                    value: e[n].length
                  })
                }
                return a.fields.push({
                  name: "stringPool",
                  type: "CHARARRAY",
                  value: r
                }), a
              }
            };

            function ct(e) {
              return Math.log(e) / Math.log(2) | 0
            }

            function ft(e) {
              for (; e.length % 4 != 0;) e.push(0);
              for (var t = 0, r = 0; r < e.length; r += 4) t += (e[r] << 24) + (e[r + 1] << 16) + (e[r + 2] << 8) + e[r + 3];
              return t %= Math.pow(2, 32)
            }

            function pt(e, t, r, i) {
              return new $.Record("Table Record", [{
                name: "tag",
                type: "TAG",
                value: void 0 !== e ? e : ""
              }, {
                name: "checkSum",
                type: "ULONG",
                value: void 0 !== t ? t : 0
              }, {
                name: "offset",
                type: "ULONG",
                value: void 0 !== r ? r : 0
              }, {
                name: "length",
                type: "ULONG",
                value: void 0 !== i ? i : 0
              }])
            }

            function mt(e) {
              var t = new $.Table("sfnt", [{
                name: "version",
                type: "TAG",
                value: "OTTO"
              }, {
                name: "numTables",
                type: "USHORT",
                value: 0
              }, {
                name: "searchRange",
                type: "USHORT",
                value: 0
              }, {
                name: "entrySelector",
                type: "USHORT",
                value: 0
              }, {
                name: "rangeShift",
                type: "USHORT",
                value: 0
              }]);
              t.tables = e, t.numTables = e.length;
              var r = Math.pow(2, ct(t.numTables));
              t.searchRange = 16 * r, t.entrySelector = ct(r), t.rangeShift = 16 * t.numTables - t.searchRange;
              for (var i = [], a = [], n = t.sizeOf() + pt().sizeOf() * t.numTables; n % 4 != 0;) n += 1, a.push({
                name: "padding",
                type: "BYTE",
                value: 0
              });
              for (var o = 0; o < e.length; o += 1) {
                var s = e[o];
                R.argument(4 === s.tableName.length, "Table name" + s.tableName + " is invalid.");
                var l = s.sizeOf(),
                  u = pt(s.tableName, ft(s.encode()), n, l);
                for (i.push({
                    name: u.tag + " Table Record",
                    type: "RECORD",
                    value: u
                  }), a.push({
                    name: s.tableName + " table",
                    type: "RECORD",
                    value: s
                  }), n += l, R.argument(!isNaN(n), "Something went wrong calculating the offset."); n % 4 != 0;) n += 1, a.push({
                  name: "padding",
                  type: "BYTE",
                  value: 0
                })
              }
              return i.sort(function(e, t) {
                return e.value.tag > t.value.tag ? 1 : -1
              }), t.fields = t.fields.concat(i), t.fields = t.fields.concat(a), t
            }

            function vt(e, t, r) {
              for (var i = 0; i < t.length; i += 1) {
                var a = e.charToGlyphIndex(t[i]);
                if (0 < a) return e.glyphs.get(a).getMetrics()
              }
              return r
            }
            var gt = {
              make: mt,
              fontToTable: function(e) {
                for (var t, r = [], i = [], a = [], n = [], o = [], s = [], l = [], u = 0, h = 0, d = 0, c = 0, f = 0, p = 0; p < e.glyphs.length; p += 1) {
                  var m = e.glyphs.get(p),
                    v = 0 | m.unicode;
                  if (isNaN(m.advanceWidth)) throw new Error("Glyph " + m.name + " (" + p + "): advanceWidth is not a number.");
                  (v < t || void 0 === t) && 0 < v && (t = v), u < v && (u = v);
                  var g = nt.getUnicodeRange(v);
                  if (g < 32) h |= 1 << g;
                  else if (g < 64) d |= 1 << g - 32;
                  else if (g < 96) c |= 1 << g - 64;
                  else {
                    if (!(g < 123)) throw new Error("Unicode ranges bits > 123 are reserved for internal usage");
                    f |= 1 << g - 96
                  }
                  if (".notdef" !== m.name) {
                    var y = m.getMetrics();
                    r.push(y.xMin), i.push(y.yMin), a.push(y.xMax), n.push(y.yMax), s.push(y.leftSideBearing), l.push(y.rightSideBearing), o.push(m.advanceWidth)
                  }
                }
                var _ = {
                  xMin: Math.min.apply(null, r),
                  yMin: Math.min.apply(null, i),
                  xMax: Math.max.apply(null, a),
                  yMax: Math.max.apply(null, n),
                  advanceWidthMax: Math.max.apply(null, o),
                  advanceWidthAvg: function(e) {
                    for (var t = 0, r = 0; r < e.length; r += 1) t += e[r];
                    return t / e.length
                  }(o),
                  minLeftSideBearing: Math.min.apply(null, s),
                  maxLeftSideBearing: Math.max.apply(null, s),
                  minRightSideBearing: Math.min.apply(null, l)
                };
                _.ascender = e.ascender, _.descender = e.descender;
                var b = Ge.make({
                    flags: 3,
                    unitsPerEm: e.unitsPerEm,
                    xMin: _.xMin,
                    yMin: _.yMin,
                    xMax: _.xMax,
                    yMax: _.yMax,
                    lowestRecPPEM: 3,
                    createdTimestamp: e.createdTimestamp
                  }),
                  x = je.make({
                    ascender: _.ascender,
                    descender: _.descender,
                    advanceWidthMax: _.advanceWidthMax,
                    minLeftSideBearing: _.minLeftSideBearing,
                    minRightSideBearing: _.minRightSideBearing,
                    xMaxExtent: _.maxLeftSideBearing + (_.xMax - _.xMin),
                    numberOfHMetrics: e.glyphs.length
                  }),
                  w = He.make(e.glyphs.length),
                  S = nt.make({
                    xAvgCharWidth: Math.round(_.advanceWidthAvg),
                    usWeightClass: e.tables.os2.usWeightClass,
                    usWidthClass: e.tables.os2.usWidthClass,
                    usFirstCharIndex: t,
                    usLastCharIndex: u,
                    ulUnicodeRange1: h,
                    ulUnicodeRange2: d,
                    ulUnicodeRange3: c,
                    ulUnicodeRange4: f,
                    fsSelection: e.tables.os2.fsSelection,
                    sTypoAscender: _.ascender,
                    sTypoDescender: _.descender,
                    sTypoLineGap: 0,
                    usWinAscent: _.yMax,
                    usWinDescent: Math.abs(_.yMin),
                    ulCodePageRange1: 1,
                    sxHeight: vt(e, "xyvw", {
                      yMax: Math.round(_.ascender / 2)
                    }).yMax,
                    sCapHeight: vt(e, "HIKLEFJMNTZBDPRAGOQSUVWXY", _).yMax,
                    usDefaultChar: e.hasChar(" ") ? 32 : 0,
                    usBreakChar: e.hasChar(" ") ? 32 : 0
                  }),
                  M = Ve.make(e.glyphs),
                  E = le.make(e.glyphs),
                  T = e.getEnglishName("fontFamily"),
                  C = e.getEnglishName("fontSubfamily"),
                  P = T + " " + C,
                  L = e.getEnglishName("postScriptName");
                L || (L = T.replace(/\s/g, "") + "-" + C);
                var R = {};
                for (var O in e.names) R[O] = e.names[O];
                R.uniqueID || (R.uniqueID = {
                  en: e.getEnglishName("manufacturer") + ":" + P
                }), R.postScriptName || (R.postScriptName = {
                  en: L
                }), R.preferredFamily || (R.preferredFamily = e.names.fontFamily), R.preferredSubfamily || (R.preferredSubfamily = e.names.fontSubfamily);
                var D = [],
                  A = it.make(R, D),
                  I = 0 < D.length ? ze.make(D) : void 0,
                  k = ot.make(),
                  U = Be.make(e.glyphs, {
                    version: e.getEnglishName("version"),
                    fullName: P,
                    familyName: T,
                    weightName: C,
                    postScriptName: L,
                    unitsPerEm: e.unitsPerEm,
                    fontBBox: [0, _.yMin, _.ascender, _.advanceWidthMax]
                  }),
                  F = e.metas && 0 < Object.keys(e.metas).length ? dt.make(e.metas) : void 0,
                  N = [b, x, w, S, A, E, k, U, M];
                I && N.push(I), e.tables.gsub && N.push(ht.make(e.tables.gsub)), F && N.push(F);
                for (var B = mt(N), G = ft(B.encode()), j = B.fields, V = !1, z = 0; z < j.length; z += 1)
                  if ("head table" === j[z].name) {
                    j[z].value.checkSumAdjustment = 2981146554 - G, V = !0;
                    break
                  } if (!V) throw new Error("Could not find head table with checkSum to adjust.");
                return B
              },
              computeCheckSum: ft
            };

            function yt(e, t) {
              for (var r = 0, i = e.length - 1; r <= i;) {
                var a = r + i >>> 1,
                  n = e[a].tag;
                if (n === t) return a;
                n < t ? r = a + 1 : i = a - 1
              }
              return -r - 1
            }

            function _t(e, t) {
              for (var r = 0, i = e.length - 1; r <= i;) {
                var a = r + i >>> 1,
                  n = e[a];
                if (n === t) return a;
                n < t ? r = a + 1 : i = a - 1
              }
              return -r - 1
            }

            function bt(e, t) {
              for (var r, i = 0, a = e.length - 1; i <= a;) {
                var n = i + a >>> 1,
                  o = (r = e[n]).start;
                if (o === t) return r;
                o < t ? i = n + 1 : a = n - 1
              }
              if (0 < i) return t > (r = e[i - 1]).end ? 0 : r
            }

            function xt(e, t) {
              this.font = e, this.tableName = t
            }

            function wt(e) {
              xt.call(this, e, "gpos")
            }

            function St(e) {
              xt.call(this, e, "gsub")
            }

            function Mt(e, t) {
              var r = e.length;
              if (r !== t.length) return !1;
              for (var i = 0; i < r; i++)
                if (e[i] !== t[i]) return !1;
              return !0
            }

            function Et(e, t, r) {
              for (var i = e.subtables, a = 0; a < i.length; a++) {
                var n = i[a];
                if (n.substFormat === t) return n
              }
              if (r) return i.push(r), r
            }

            function Tt(e) {
              for (var t = new ArrayBuffer(e.length), r = new Uint8Array(t), i = 0; i < e.length; ++i) r[i] = e[i];
              return t
            }

            function Ct(e, t) {
              if (!e) throw t
            }

            function Pt(e, t, r, i, a) {
              var n;
              return n = 0 < (t & i) ? (n = e.parseByte(), 0 == (t & a) && (n = -n), r + n) : 0 < (t & a) ? r : r + e.parseShort()
            }

            function Lt(e, t, r) {
              var i, a, n = new se.Parser(t, r);
              if (e.numberOfContours = n.parseShort(), e._xMin = n.parseShort(), e._yMin = n.parseShort(), e._xMax = n.parseShort(), e._yMax = n.parseShort(), 0 < e.numberOfContours) {
                for (var o = e.endPointIndices = [], s = 0; s < e.numberOfContours; s += 1) o.push(n.parseUShort());
                e.instructionLength = n.parseUShort(), e.instructions = [];
                for (var l = 0; l < e.instructionLength; l += 1) e.instructions.push(n.parseByte());
                var u = o[o.length - 1] + 1;
                i = [];
                for (var h = 0; h < u; h += 1)
                  if (a = n.parseByte(), i.push(a), 0 < (8 & a))
                    for (var d = n.parseByte(), c = 0; c < d; c += 1) i.push(a), h += 1;
                if (R.argument(i.length === u, "Bad flags."), 0 < o.length) {
                  var f, p = [];
                  if (0 < u) {
                    for (var m = 0; m < u; m += 1) a = i[m], (f = {}).onCurve = !!(1 & a), f.lastPointOfContour = 0 <= o.indexOf(m), p.push(f);
                    for (var v = 0, g = 0; g < u; g += 1) a = i[g], (f = p[g]).x = Pt(n, a, v, 2, 16), v = f.x;
                    for (var y = 0, _ = 0; _ < u; _ += 1) a = i[_], (f = p[_]).y = Pt(n, a, y, 4, 32), y = f.y
                  }
                  e.points = p
                } else e.points = []
              } else if (0 === e.numberOfContours) e.points = [];
              else {
                e.isComposite = !0, e.points = [], e.components = [];
                for (var b = !0; b;) {
                  i = n.parseUShort();
                  var x = {
                    glyphIndex: n.parseUShort(),
                    xScale: 1,
                    scale01: 0,
                    scale10: 0,
                    yScale: 1,
                    dx: 0,
                    dy: 0
                  };
                  0 < (1 & i) ? 0 < (2 & i) ? (x.dx = n.parseShort(), x.dy = n.parseShort()) : x.matchedPoints = [n.parseUShort(), n.parseUShort()] : 0 < (2 & i) ? (x.dx = n.parseChar(), x.dy = n.parseChar()) : x.matchedPoints = [n.parseByte(), n.parseByte()], 0 < (8 & i) ? x.xScale = x.yScale = n.parseF2Dot14() : 0 < (64 & i) ? (x.xScale = n.parseF2Dot14(), x.yScale = n.parseF2Dot14()) : 0 < (128 & i) && (x.xScale = n.parseF2Dot14(), x.scale01 = n.parseF2Dot14(), x.scale10 = n.parseF2Dot14(), x.yScale = n.parseF2Dot14()), e.components.push(x), b = !!(32 & i)
                }
                if (256 & i) {
                  e.instructionLength = n.parseUShort(), e.instructions = [];
                  for (var w = 0; w < e.instructionLength; w += 1) e.instructions.push(n.parseByte())
                }
              }
            }

            function Rt(e, t) {
              for (var r = [], i = 0; i < e.length; i += 1) {
                var a = e[i],
                  n = {
                    x: t.xScale * a.x + t.scale01 * a.y + t.dx,
                    y: t.scale10 * a.x + t.yScale * a.y + t.dy,
                    onCurve: a.onCurve,
                    lastPointOfContour: a.lastPointOfContour
                  };
                r.push(n)
              }
              return r
            }

            function Ot(e) {
              var t = new k;
              if (!e) return t;
              for (var r = function(e) {
                  for (var t = [], r = [], i = 0; i < e.length; i += 1) {
                    var a = e[i];
                    r.push(a), a.lastPointOfContour && (t.push(r), r = [])
                  }
                  return R.argument(0 === r.length, "There are still points left in the current contour."), t
                }(e), i = 0; i < r.length; ++i) {
                var a = r[i],
                  n = null,
                  o = a[a.length - 1],
                  s = a[0];
                if (o.onCurve) t.moveTo(o.x, o.y);
                else if (s.onCurve) t.moveTo(s.x, s.y);
                else {
                  var l = {
                    x: .5 * (o.x + s.x),
                    y: .5 * (o.y + s.y)
                  };
                  t.moveTo(l.x, l.y)
                }
                for (var u = 0; u < a.length; ++u)
                  if (n = o, o = s, s = a[(u + 1) % a.length], o.onCurve) t.lineTo(o.x, o.y);
                  else {
                    var h = s;
                    n.onCurve || {
                      x: .5 * (o.x + n.x),
                      y: .5 * (o.y + n.y)
                    }, s.onCurve || (h = {
                      x: .5 * (o.x + s.x),
                      y: .5 * (o.y + s.y)
                    }), t.quadraticCurveTo(o.x, o.y, h.x, h.y)
                  } t.closePath()
              }
              return t
            }

            function Dt(e, t) {
              if (t.isComposite)
                for (var r = 0; r < t.components.length; r += 1) {
                  var i = t.components[r],
                    a = e.get(i.glyphIndex);
                  if (a.getPath(), a.points) {
                    var n = void 0;
                    if (void 0 === i.matchedPoints) n = Rt(a.points, i);
                    else {
                      if (i.matchedPoints[0] > t.points.length - 1 || i.matchedPoints[1] > a.points.length - 1) throw Error("Matched points out of range in " + t.name);
                      var o = t.points[i.matchedPoints[0]],
                        s = a.points[i.matchedPoints[1]],
                        l = {
                          xScale: i.xScale,
                          scale01: i.scale01,
                          scale10: i.scale10,
                          yScale: i.yScale,
                          dx: 0,
                          dy: 0
                        };
                      s = Rt([s], l)[0], l.dx = o.x - s.x, l.dy = o.y - s.y, n = Rt(a.points, l)
                    }
                    t.points = t.points.concat(n)
                  }
                }
              return Ot(t.points)
            }(wt.prototype = xt.prototype = {
              searchTag: yt,
              binSearch: _t,
              getTable: function(e) {
                var t = this.font.tables[this.tableName];
                return !t && e && (t = this.font.tables[this.tableName] = this.createDefaultTable()), t
              },
              getScriptNames: function() {
                var e = this.getTable();
                return e ? e.scripts.map(function(e) {
                  return e.tag
                }) : []
              },
              getDefaultScriptName: function() {
                var e = this.getTable();
                if (e) {
                  for (var t = !1, r = 0; r < e.scripts.length; r++) {
                    var i = e.scripts[r].tag;
                    if ("DFLT" === i) return i;
                    "latn" === i && (t = !0)
                  }
                  return t ? "latn" : void 0
                }
              },
              getScriptTable: function(e, t) {
                var r = this.getTable(t);
                if (r) {
                  e = e || "DFLT";
                  var i = r.scripts,
                    a = yt(r.scripts, e);
                  if (0 <= a) return i[a].script;
                  if (t) {
                    var n = {
                      tag: e,
                      script: {
                        defaultLangSys: {
                          reserved: 0,
                          reqFeatureIndex: 65535,
                          featureIndexes: []
                        },
                        langSysRecords: []
                      }
                    };
                    return i.splice(-1 - a, 0, n), n.script
                  }
                }
              },
              getLangSysTable: function(e, t, r) {
                var i = this.getScriptTable(e, r);
                if (i) {
                  if (!t || "dflt" === t || "DFLT" === t) return i.defaultLangSys;
                  var a = yt(i.langSysRecords, t);
                  if (0 <= a) return i.langSysRecords[a].langSys;
                  if (r) {
                    var n = {
                      tag: t,
                      langSys: {
                        reserved: 0,
                        reqFeatureIndex: 65535,
                        featureIndexes: []
                      }
                    };
                    return i.langSysRecords.splice(-1 - a, 0, n), n.langSys
                  }
                }
              },
              getFeatureTable: function(e, t, r, i) {
                var a = this.getLangSysTable(e, t, i);
                if (a) {
                  for (var n, o = a.featureIndexes, s = this.font.tables[this.tableName].features, l = 0; l < o.length; l++)
                    if ((n = s[o[l]]).tag === r) return n.feature;
                  if (i) {
                    var u = s.length;
                    return R.assert(0 === u || r >= s[u - 1].tag, "Features must be added in alphabetical order."), n = {
                      tag: r,
                      feature: {
                        params: 0,
                        lookupListIndexes: []
                      }
                    }, s.push(n), o.push(u), n.feature
                  }
                }
              },
              getLookupTables: function(e, t, r, i, a) {
                var n = this.getFeatureTable(e, t, r, a),
                  o = [];
                if (n) {
                  for (var s, l = n.lookupListIndexes, u = this.font.tables[this.tableName].lookups, h = 0; h < l.length; h++)(s = u[l[h]]).lookupType === i && o.push(s);
                  if (0 === o.length && a) {
                    s = {
                      lookupType: i,
                      lookupFlag: 0,
                      subtables: [],
                      markFilteringSet: void 0
                    };
                    var d = u.length;
                    return u.push(s), l.push(d), [s]
                  }
                }
                return o
              },
              getGlyphClass: function(e, t) {
                switch (e.format) {
                  case 1:
                    return e.startGlyph <= t && t < e.startGlyph + e.classes.length ? e.classes[t - e.startGlyph] : 0;
                  case 2:
                    var r = bt(e.ranges, t);
                    return r ? r.classId : 0
                }
              },
              getCoverageIndex: function(e, t) {
                switch (e.format) {
                  case 1:
                    var r = _t(e.glyphs, t);
                    return 0 <= r ? r : -1;
                  case 2:
                    var i = bt(e.ranges, t);
                    return i ? i.index + t - i.start : -1
                }
              },
              expandCoverage: function(e) {
                if (1 === e.format) return e.glyphs;
                for (var t = [], r = e.ranges, i = 0; i < r.length; i++)
                  for (var a = r[i], n = a.start, o = a.end, s = n; s <= o; s++) t.push(s);
                return t
              }
            }).init = function() {
              var e = this.getDefaultScriptName();
              this.defaultKerningTables = this.getKerningTables(e)
            }, wt.prototype.getKerningValue = function(e, t, r) {
              for (var i = 0; i < e.length; i++)
                for (var a = e[i].subtables, n = 0; n < a.length; n++) {
                  var o = a[n],
                    s = this.getCoverageIndex(o.coverage, t);
                  if (!(s < 0)) switch (o.posFormat) {
                    case 1:
                      for (var l = o.pairSets[s], u = 0; u < l.length; u++) {
                        var h = l[u];
                        if (h.secondGlyph === r) return h.value1 && h.value1.xAdvance || 0
                      }
                      break;
                    case 2:
                      var d = this.getGlyphClass(o.classDef1, t),
                        c = this.getGlyphClass(o.classDef2, r),
                        f = o.classRecords[d][c];
                      return f.value1 && f.value1.xAdvance || 0
                  }
                }
              return 0
            }, wt.prototype.getKerningTables = function(e, t) {
              if (this.font.tables.gpos) return this.getLookupTables(e, t, "kern", 2)
            }, (St.prototype = xt.prototype).createDefaultTable = function() {
              return {
                version: 1,
                scripts: [{
                  tag: "DFLT",
                  script: {
                    defaultLangSys: {
                      reserved: 0,
                      reqFeatureIndex: 65535,
                      featureIndexes: []
                    },
                    langSysRecords: []
                  }
                }],
                features: [],
                lookups: []
              }
            }, St.prototype.getSingle = function(e, t, r) {
              for (var i = [], a = this.getLookupTables(t, r, e, 1), n = 0; n < a.length; n++)
                for (var o = a[n].subtables, s = 0; s < o.length; s++) {
                  var l = o[s],
                    u = this.expandCoverage(l.coverage),
                    h = void 0;
                  if (1 === l.substFormat) {
                    var d = l.deltaGlyphId;
                    for (h = 0; h < u.length; h++) {
                      var c = u[h];
                      i.push({
                        sub: c,
                        by: c + d
                      })
                    }
                  } else {
                    var f = l.substitute;
                    for (h = 0; h < u.length; h++) i.push({
                      sub: u[h],
                      by: f[h]
                    })
                  }
                }
              return i
            }, St.prototype.getAlternates = function(e, t, r) {
              for (var i = [], a = this.getLookupTables(t, r, e, 3), n = 0; n < a.length; n++)
                for (var o = a[n].subtables, s = 0; s < o.length; s++)
                  for (var l = o[s], u = this.expandCoverage(l.coverage), h = l.alternateSets, d = 0; d < u.length; d++) i.push({
                    sub: u[d],
                    by: h[d]
                  });
              return i
            }, St.prototype.getLigatures = function(e, t, r) {
              for (var i = [], a = this.getLookupTables(t, r, e, 4), n = 0; n < a.length; n++)
                for (var o = a[n].subtables, s = 0; s < o.length; s++)
                  for (var l = o[s], u = this.expandCoverage(l.coverage), h = l.ligatureSets, d = 0; d < u.length; d++)
                    for (var c = u[d], f = h[d], p = 0; p < f.length; p++) {
                      var m = f[p];
                      i.push({
                        sub: [c].concat(m.components),
                        by: m.ligGlyph
                      })
                    }
              return i
            }, St.prototype.addSingle = function(e, t, r, i) {
              var a = Et(this.getLookupTables(r, i, e, 1, !0)[0], 2, {
                substFormat: 2,
                coverage: {
                  format: 1,
                  glyphs: []
                },
                substitute: []
              });
              R.assert(1 === a.coverage.format, "Ligature: unable to modify coverage table format " + a.coverage.format);
              var n = t.sub,
                o = this.binSearch(a.coverage.glyphs, n);
              o < 0 && (o = -1 - o, a.coverage.glyphs.splice(o, 0, n), a.substitute.splice(o, 0, 0)), a.substitute[o] = t.by
            }, St.prototype.addAlternate = function(e, t, r, i) {
              var a = Et(this.getLookupTables(r, i, e, 3, !0)[0], 1, {
                substFormat: 1,
                coverage: {
                  format: 1,
                  glyphs: []
                },
                alternateSets: []
              });
              R.assert(1 === a.coverage.format, "Ligature: unable to modify coverage table format " + a.coverage.format);
              var n = t.sub,
                o = this.binSearch(a.coverage.glyphs, n);
              o < 0 && (o = -1 - o, a.coverage.glyphs.splice(o, 0, n), a.alternateSets.splice(o, 0, 0)), a.alternateSets[o] = t.by
            }, St.prototype.addLigature = function(e, t, r, i) {
              var a = this.getLookupTables(r, i, e, 4, !0)[0],
                n = a.subtables[0];
              n || (n = {
                substFormat: 1,
                coverage: {
                  format: 1,
                  glyphs: []
                },
                ligatureSets: []
              }, a.subtables[0] = n), R.assert(1 === n.coverage.format, "Ligature: unable to modify coverage table format " + n.coverage.format);
              var o = t.sub[0],
                s = t.sub.slice(1),
                l = {
                  ligGlyph: t.by,
                  components: s
                },
                u = this.binSearch(n.coverage.glyphs, o);
              if (0 <= u) {
                for (var h = n.ligatureSets[u], d = 0; d < h.length; d++)
                  if (Mt(h[d].components, s)) return;
                h.push(l)
              } else u = -1 - u, n.coverage.glyphs.splice(u, 0, o), n.ligatureSets.splice(u, 0, [l])
            }, St.prototype.getFeature = function(e, t, r) {
              if (/ss\d\d/.test(e)) return this.getSingle(e, t, r);
              switch (e) {
                case "aalt":
                case "salt":
                  return this.getSingle(e, t, r).concat(this.getAlternates(e, t, r));
                case "dlig":
                case "liga":
                case "rlig":
                  return this.getLigatures(e, t, r)
              }
            }, St.prototype.add = function(e, t, r, i) {
              if (/ss\d\d/.test(e)) return this.addSingle(e, t, r, i);
              switch (e) {
                case "aalt":
                case "salt":
                  return "number" == typeof t.by ? this.addSingle(e, t, r, i) : this.addAlternate(e, t, r, i);
                case "dlig":
                case "liga":
                case "rlig":
                  return this.addLigature(e, t, r, i)
              }
            };
            var At, It, kt, Ut, Ft = {
              getPath: Ot,
              parse: function(e, t, r, i) {
                for (var a = new xe.GlyphSet(i), n = 0; n < r.length - 1; n += 1) {
                  var o = r[n];
                  o !== r[n + 1] ? a.push(n, xe.ttfGlyphLoader(i, n, Lt, e, t + o, Dt)) : a.push(n, xe.glyphLoader(i, n))
                }
                return a
              }
            };

            function Nt(e) {
              this.font = e, this.getCommands = function(e) {
                return Ft.getPath(e).commands
              }, this._fpgmState = this._prepState = void 0, this._errorState = 0
            }

            function Bt(e) {
              return e
            }

            function Gt(e) {
              return Math.sign(e) * Math.round(Math.abs(e))
            }

            function jt(e) {
              return Math.sign(e) * Math.round(Math.abs(2 * e)) / 2
            }

            function Vt(e) {
              return Math.sign(e) * (Math.round(Math.abs(e) + .5) - .5)
            }

            function zt(e) {
              return Math.sign(e) * Math.ceil(Math.abs(e))
            }

            function Ht(e) {
              return Math.sign(e) * Math.floor(Math.abs(e))
            }
            var Wt = function(e) {
                var t = this.srPeriod,
                  r = this.srPhase,
                  i = 1;
                return e < 0 && (e = -e, i = -1), e += this.srThreshold - r, e = Math.trunc(e / t) * t, (e += r) < 0 ? r * i : e * i
              },
              Xt = {
                x: 1,
                y: 0,
                axis: "x",
                distance: function(e, t, r, i) {
                  return (r ? e.xo : e.x) - (i ? t.xo : t.x)
                },
                interpolate: function(e, t, r, i) {
                  var a, n, o, s, l, u, h;
                  if (!i || i === this) return a = e.xo - t.xo, n = e.xo - r.xo, l = t.x - t.xo, u = r.x - r.xo, 0 === (h = (o = Math.abs(a)) + (s = Math.abs(n))) ? void(e.x = e.xo + (l + u) / 2) : void(e.x = e.xo + (l * s + u * o) / h);
                  a = i.distance(e, t, !0, !0), n = i.distance(e, r, !0, !0), l = i.distance(t, t, !1, !0), u = i.distance(r, r, !1, !0), 0 !== (h = (o = Math.abs(a)) + (s = Math.abs(n))) ? Xt.setRelative(e, e, (l * s + u * o) / h, i, !0) : Xt.setRelative(e, e, (l + u) / 2, i, !0)
                },
                normalSlope: Number.NEGATIVE_INFINITY,
                setRelative: function(e, t, r, i, a) {
                  if (i && i !== this) {
                    var n = a ? t.xo : t.x,
                      o = a ? t.yo : t.y,
                      s = n + r * i.x,
                      l = o + r * i.y;
                    e.x = s + (e.y - l) / i.normalSlope
                  } else e.x = (a ? t.xo : t.x) + r
                },
                slope: 0,
                touch: function(e) {
                  e.xTouched = !0
                },
                touched: function(e) {
                  return e.xTouched
                },
                untouch: function(e) {
                  e.xTouched = !1
                }
              },
              qt = {
                x: 0,
                y: 1,
                axis: "y",
                distance: function(e, t, r, i) {
                  return (r ? e.yo : e.y) - (i ? t.yo : t.y)
                },
                interpolate: function(e, t, r, i) {
                  var a, n, o, s, l, u, h;
                  if (!i || i === this) return a = e.yo - t.yo, n = e.yo - r.yo, l = t.y - t.yo, u = r.y - r.yo, 0 === (h = (o = Math.abs(a)) + (s = Math.abs(n))) ? void(e.y = e.yo + (l + u) / 2) : void(e.y = e.yo + (l * s + u * o) / h);
                  a = i.distance(e, t, !0, !0), n = i.distance(e, r, !0, !0), l = i.distance(t, t, !1, !0), u = i.distance(r, r, !1, !0), 0 !== (h = (o = Math.abs(a)) + (s = Math.abs(n))) ? qt.setRelative(e, e, (l * s + u * o) / h, i, !0) : qt.setRelative(e, e, (l + u) / 2, i, !0)
                },
                normalSlope: 0,
                setRelative: function(e, t, r, i, a) {
                  if (i && i !== this) {
                    var n = a ? t.xo : t.x,
                      o = a ? t.yo : t.y,
                      s = n + r * i.x,
                      l = o + r * i.y;
                    e.y = l + i.normalSlope * (e.x - s)
                  } else e.y = (a ? t.yo : t.y) + r
                },
                slope: Number.POSITIVE_INFINITY,
                touch: function(e) {
                  e.yTouched = !0
                },
                touched: function(e) {
                  return e.yTouched
                },
                untouch: function(e) {
                  e.yTouched = !1
                }
              };

            function Yt(e, t) {
              this.x = e, this.y = t, this.axis = void 0, this.slope = t / e, this.normalSlope = -e / t, Object.freeze(this)
            }

            function Zt(e, t) {
              var r = Math.sqrt(e * e + t * t);
              return t /= r, 1 === (e /= r) && 0 === t ? Xt : 0 === e && 1 === t ? qt : new Yt(e, t)
            }

            function Qt(e, t, r, i) {
              this.x = this.xo = Math.round(64 * e) / 64, this.y = this.yo = Math.round(64 * t) / 64, this.lastPointOfContour = r, this.onCurve = i, this.prevPointOnContour = void 0, this.nextPointOnContour = void 0, this.xTouched = !1, this.yTouched = !1, Object.preventExtensions(this)
            }
            Object.freeze(Xt), Object.freeze(qt), Yt.prototype.distance = function(e, t, r, i) {
              return this.x * Xt.distance(e, t, r, i) + this.y * qt.distance(e, t, r, i)
            }, Yt.prototype.interpolate = function(e, t, r, i) {
              var a, n, o, s, l, u, h;
              o = i.distance(e, t, !0, !0), s = i.distance(e, r, !0, !0), a = i.distance(t, t, !1, !0), n = i.distance(r, r, !1, !0), 0 !== (h = (l = Math.abs(o)) + (u = Math.abs(s))) ? this.setRelative(e, e, (a * u + n * l) / h, i, !0) : this.setRelative(e, e, (a + n) / 2, i, !0)
            }, Yt.prototype.setRelative = function(e, t, r, i, a) {
              i = i || this;
              var n = a ? t.xo : t.x,
                o = a ? t.yo : t.y,
                s = n + r * i.x,
                l = o + r * i.y,
                u = i.normalSlope,
                h = this.slope,
                d = e.x,
                c = e.y;
              e.x = (h * d - u * s + l - c) / (h - u), e.y = h * (e.x - d) + c
            }, Yt.prototype.touch = function(e) {
              e.xTouched = !0, e.yTouched = !0
            }, Qt.prototype.nextTouched = function(e) {
              for (var t = this.nextPointOnContour; !e.touched(t) && t !== this;) t = t.nextPointOnContour;
              return t
            }, Qt.prototype.prevTouched = function(e) {
              for (var t = this.prevPointOnContour; !e.touched(t) && t !== this;) t = t.prevPointOnContour;
              return t
            };
            var Kt = Object.freeze(new Qt(0, 0)),
              Jt = {
                cvCutIn: 17 / 16,
                deltaBase: 9,
                deltaShift: .125,
                loop: 1,
                minDis: 1,
                autoFlip: !0
              };

            function $t(e, t) {
              switch (this.env = e, this.stack = [], this.prog = t, e) {
                case "glyf":
                  this.zp0 = this.zp1 = this.zp2 = 1, this.rp0 = this.rp1 = this.rp2 = 0;
                case "prep":
                  this.fv = this.pv = this.dpv = Xt, this.round = Gt
              }
            }

            function er(e) {
              for (var t = e.tZone = new Array(e.gZone.length), r = 0; r < t.length; r++) t[r] = new Qt(0, 0)
            }

            function tr(e, t) {
              var r, i = e.prog,
                a = e.ip,
                n = 1;
              do {
                if (88 === (r = i[++a])) n++;
                else if (89 === r) n--;
                else if (64 === r) a += i[a + 1] + 1;
                else if (65 === r) a += 2 * i[a + 1] + 1;
                else if (176 <= r && r <= 183) a += r - 176 + 1;
                else if (184 <= r && r <= 191) a += 2 * (r - 184 + 1);
                else if (t && 1 === n && 27 === r) break
              } while (0 < n);
              e.ip = a
            }

            function rr(e, t) {
              E.DEBUG && console.log(t.step, "SVTCA[" + e.axis + "]"), t.fv = t.pv = t.dpv = e
            }

            function ir(e, t) {
              E.DEBUG && console.log(t.step, "SPVTCA[" + e.axis + "]"), t.pv = t.dpv = e
            }

            function ar(e, t) {
              E.DEBUG && console.log(t.step, "SFVTCA[" + e.axis + "]"), t.fv = e
            }

            function nr(e, t) {
              var r, i, a = t.stack,
                n = a.pop(),
                o = a.pop(),
                s = t.z2[n],
                l = t.z1[o];
              E.DEBUG && console.log("SPVTL[" + e + "]", n, o), i = e ? (r = s.y - l.y, l.x - s.x) : (r = l.x - s.x, l.y - s.y), t.pv = t.dpv = Zt(r, i)
            }

            function or(e, t) {
              var r, i, a = t.stack,
                n = a.pop(),
                o = a.pop(),
                s = t.z2[n],
                l = t.z1[o];
              E.DEBUG && console.log("SFVTL[" + e + "]", n, o), i = e ? (r = s.y - l.y, l.x - s.x) : (r = l.x - s.x, l.y - s.y), t.fv = Zt(r, i)
            }

            function sr(e) {
              E.DEBUG && console.log(e.step, "POP[]"), e.stack.pop()
            }

            function lr(e, t) {
              var r = t.stack.pop(),
                i = t.z0[r],
                a = t.fv,
                n = t.pv;
              E.DEBUG && console.log(t.step, "MDAP[" + e + "]", r);
              var o = n.distance(i, Kt);
              e && (o = t.round(o)), a.setRelative(i, Kt, o, n), a.touch(i), t.rp0 = t.rp1 = r
            }

            function ur(e, t) {
              var r, i, a, n = t.z2,
                o = n.length - 2;
              E.DEBUG && console.log(t.step, "IUP[" + e.axis + "]");
              for (var s = 0; s < o; s++) r = n[s], e.touched(r) || (i = r.prevTouched(e)) !== r && (i === (a = r.nextTouched(e)) && e.setRelative(r, r, e.distance(i, i, !1, !0), e, !0), e.interpolate(r, i, a, e))
            }

            function hr(e, t) {
              for (var r = t.stack, i = e ? t.rp1 : t.rp2, a = (e ? t.z0 : t.z1)[i], n = t.fv, o = t.pv, s = t.loop, l = t.z2; s--;) {
                var u = r.pop(),
                  h = l[u],
                  d = o.distance(a, a, !1, !0);
                n.setRelative(h, h, d, o), n.touch(h), E.DEBUG && console.log(t.step, (1 < t.loop ? "loop " + (t.loop - s) + ": " : "") + "SHP[" + (e ? "rp1" : "rp2") + "]", u)
              }
              t.loop = 1
            }

            function dr(e, t) {
              var r = t.stack,
                i = e ? t.rp1 : t.rp2,
                a = (e ? t.z0 : t.z1)[i],
                n = t.fv,
                o = t.pv,
                s = r.pop(),
                l = t.z2[t.contours[s]],
                u = l;
              E.DEBUG && console.log(t.step, "SHC[" + e + "]", s);
              for (var h = o.distance(a, a, !1, !0); u !== a && n.setRelative(u, u, h, o), (u = u.nextPointOnContour) !== l;);
            }

            function cr(e, t) {
              var r, i, a = t.stack,
                n = e ? t.rp1 : t.rp2,
                o = (e ? t.z0 : t.z1)[n],
                s = t.fv,
                l = t.pv,
                u = a.pop();
              switch (E.DEBUG && console.log(t.step, "SHZ[" + e + "]", u), u) {
                case 0:
                  r = t.tZone;
                  break;
                case 1:
                  r = t.gZone;
                  break;
                default:
                  throw new Error("Invalid zone")
              }
              for (var h = l.distance(o, o, !1, !0), d = r.length - 2, c = 0; c < d; c++) i = r[c], s.setRelative(i, i, h, l)
            }

            function fr(e, t) {
              var r = t.stack,
                i = r.pop() / 64,
                a = r.pop(),
                n = t.z1[a],
                o = t.z0[t.rp0],
                s = t.fv,
                l = t.pv;
              s.setRelative(n, o, i, l), s.touch(n), E.DEBUG && console.log(t.step, "MSIRP[" + e + "]", i, a), t.rp1 = t.rp0, t.rp2 = a, e && (t.rp0 = a)
            }

            function pr(e, t) {
              var r = t.stack,
                i = r.pop(),
                a = r.pop(),
                n = t.z0[a],
                o = t.fv,
                s = t.pv,
                l = t.cvt[i];
              E.DEBUG && console.log(t.step, "MIAP[" + e + "]", i, "(", l, ")", a);
              var u = s.distance(n, Kt);
              e && (Math.abs(u - l) < t.cvCutIn && (u = l), u = t.round(u)), o.setRelative(n, Kt, u, s), 0 === t.zp0 && (n.xo = n.x, n.yo = n.y), o.touch(n), t.rp0 = t.rp1 = a
            }

            function mr(e, t) {
              var r = t.stack,
                i = r.pop(),
                a = t.z2[i];
              E.DEBUG && console.log(t.step, "GC[" + e + "]", i), r.push(64 * t.dpv.distance(a, Kt, e, !1))
            }

            function vr(e, t) {
              var r = t.stack,
                i = r.pop(),
                a = r.pop(),
                n = t.z1[i],
                o = t.z0[a],
                s = t.dpv.distance(o, n, e, e);
              E.DEBUG && console.log(t.step, "MD[" + e + "]", i, a, "->", s), t.stack.push(Math.round(64 * s))
            }

            function gr(e, t) {
              var r = t.stack,
                i = r.pop(),
                a = t.fv,
                n = t.pv,
                o = t.ppem,
                s = t.deltaBase + 16 * (e - 1),
                l = t.deltaShift,
                u = t.z0;
              E.DEBUG && console.log(t.step, "DELTAP[" + e + "]", i, r);
              for (var h = 0; h < i; h++) {
                var d = r.pop(),
                  c = r.pop();
                if (s + ((240 & c) >> 4) === o) {
                  var f = (15 & c) - 8;
                  0 <= f && f++, E.DEBUG && console.log(t.step, "DELTAPFIX", d, "by", f * l);
                  var p = u[d];
                  a.setRelative(p, p, f * l, n)
                }
              }
            }

            function yr(e, t) {
              var r = t.stack,
                i = r.pop();
              E.DEBUG && console.log(t.step, "ROUND[]"), r.push(64 * t.round(i / 64))
            }

            function _r(e, t) {
              var r = t.stack,
                i = r.pop(),
                a = t.ppem,
                n = t.deltaBase + 16 * (e - 1),
                o = t.deltaShift;
              E.DEBUG && console.log(t.step, "DELTAC[" + e + "]", i, r);
              for (var s = 0; s < i; s++) {
                var l = r.pop(),
                  u = r.pop();
                if (n + ((240 & u) >> 4) === a) {
                  var h = (15 & u) - 8;
                  0 <= h && h++;
                  var d = h * o;
                  E.DEBUG && console.log(t.step, "DELTACFIX", l, "by", d), t.cvt[l] += d
                }
              }
            }

            function br(e, t) {
              var r, i, a = t.stack,
                n = a.pop(),
                o = a.pop(),
                s = t.z2[n],
                l = t.z1[o];
              E.DEBUG && console.log(t.step, "SDPVTL[" + e + "]", n, o), i = e ? (r = s.y - l.y, l.x - s.x) : (r = l.x - s.x, l.y - s.y), t.dpv = Zt(r, i)
            }

            function xr(e, t) {
              var r = t.stack,
                i = t.prog,
                a = t.ip;
              E.DEBUG && console.log(t.step, "PUSHB[" + e + "]");
              for (var n = 0; n < e; n++) r.push(i[++a]);
              t.ip = a
            }

            function wr(e, t) {
              var r = t.ip,
                i = t.prog,
                a = t.stack;
              E.DEBUG && console.log(t.ip, "PUSHW[" + e + "]");
              for (var n = 0; n < e; n++) {
                var o = i[++r] << 8 | i[++r];
                32768 & o && (o = -(1 + (65535 ^ o))), a.push(o)
              }
              t.ip = r
            }

            function Sr(e, t, r, i, a, n) {
              var o, s, l, u, h = n.stack,
                d = e && h.pop(),
                c = h.pop(),
                f = n.rp0,
                p = n.z0[f],
                m = n.z1[c],
                v = n.minDis,
                g = n.fv,
                y = n.dpv;
              l = 0 <= (s = o = y.distance(m, p, !0, !0)) ? 1 : -1, s = Math.abs(s), e && (u = n.cvt[d], i && Math.abs(s - u) < n.cvCutIn && (s = u)), r && s < v && (s = v), i && (s = n.round(s)), g.setRelative(m, p, l * s, y), g.touch(m), E.DEBUG && console.log(n.step, (e ? "MIRP[" : "MDRP[") + (t ? "M" : "m") + (r ? ">" : "_") + (i ? "R" : "_") + (0 === a ? "Gr" : 1 === a ? "Bl" : 2 === a ? "Wh" : "") + "]", e ? d + "(" + n.cvt[d] + "," + u + ")" : "", c, "(d =", o, "->", l * s, ")"), n.rp1 = n.rp0, n.rp2 = c, t && (n.rp0 = c)
            }
            Nt.prototype.exec = function(e, t) {
              if ("number" != typeof t) throw new Error("Point size is not a number!");
              if (!(2 < this._errorState)) {
                var r = this.font,
                  i = this._prepState;
                if (!i || i.ppem !== t) {
                  var a = this._fpgmState;
                  if (!a) {
                    $t.prototype = Jt, (a = this._fpgmState = new $t("fpgm", r.tables.fpgm)).funcs = [], a.font = r, E.DEBUG && (console.log("---EXEC FPGM---"), a.step = -1);
                    try {
                      It(a)
                    } catch (e) {
                      return console.log("Hinting error in FPGM:" + e), void(this._errorState = 3)
                    }
                  }
                  $t.prototype = a, (i = this._prepState = new $t("prep", r.tables.prep)).ppem = t;
                  var n = r.tables.cvt;
                  if (n)
                    for (var o = i.cvt = new Array(n.length), s = t / r.unitsPerEm, l = 0; l < n.length; l++) o[l] = n[l] * s;
                  else i.cvt = [];
                  E.DEBUG && (console.log("---EXEC PREP---"), i.step = -1);
                  try {
                    It(i)
                  } catch (e) {
                    this._errorState < 2 && console.log("Hinting error in PREP:" + e), this._errorState = 2
                  }
                }
                if (!(1 < this._errorState)) try {
                  return kt(e, i)
                } catch (e) {
                  return this._errorState < 1 && (console.log("Hinting error:" + e), console.log("Note: further hinting errors are silenced")), void(this._errorState = 1)
                }
              }
            }, kt = function(e, t) {
              var r, i, a, n = t.ppem / t.font.unitsPerEm,
                o = n,
                s = e.components;
              if ($t.prototype = t, s) {
                var l = t.font;
                i = [], r = [];
                for (var u = 0; u < s.length; u++) {
                  var h = s[u],
                    d = l.glyphs.get(h.glyphIndex);
                  a = new $t("glyf", d.instructions), E.DEBUG && (console.log("---EXEC COMP " + u + "---"), a.step = -1), Ut(d, a, n, o);
                  for (var c = Math.round(h.dx * n), f = Math.round(h.dy * o), p = a.gZone, m = a.contours, v = 0; v < p.length; v++) {
                    var g = p[v];
                    g.xTouched = g.yTouched = !1, g.xo = g.x = g.x + c, g.yo = g.y = g.y + f
                  }
                  var y = i.length;
                  i.push.apply(i, p);
                  for (var _ = 0; _ < m.length; _++) r.push(m[_] + y)
                }
                e.instructions && !a.inhibitGridFit && ((a = new $t("glyf", e.instructions)).gZone = a.z0 = a.z1 = a.z2 = i, a.contours = r, i.push(new Qt(0, 0), new Qt(Math.round(e.advanceWidth * n), 0)), E.DEBUG && (console.log("---EXEC COMPOSITE---"), a.step = -1), It(a), i.length -= 2)
              } else a = new $t("glyf", e.instructions), E.DEBUG && (console.log("---EXEC GLYPH---"), a.step = -1), Ut(e, a, n, o), i = a.gZone;
              return i
            }, Ut = function(e, t, r, i) {
              for (var a, n, o, s = e.points || [], l = s.length, u = t.gZone = t.z0 = t.z1 = t.z2 = [], h = t.contours = [], d = 0; d < l; d++) a = s[d], u[d] = new Qt(a.x * r, a.y * i, a.lastPointOfContour, a.onCurve);
              for (var c = 0; c < l; c++) a = u[c], n || (n = a, h.push(c)), a.lastPointOfContour ? ((a.nextPointOnContour = n).prevPointOnContour = a, n = void 0) : (o = u[c + 1], (a.nextPointOnContour = o).prevPointOnContour = a);
              if (!t.inhibitGridFit) {
                if (E.DEBUG) {
                  console.log("PROCESSING GLYPH", t.stack);
                  for (var f = 0; f < l; f++) console.log(f, u[f].x, u[f].y)
                }
                if (u.push(new Qt(0, 0), new Qt(Math.round(e.advanceWidth * r), 0)), It(t), u.length -= 2, E.DEBUG) {
                  console.log("FINISHED GLYPH", t.stack);
                  for (var p = 0; p < l; p++) console.log(p, u[p].x, u[p].y)
                }
              }
            }, It = function(e) {
              var t = e.prog;
              if (t) {
                var r, i = t.length;
                for (e.ip = 0; e.ip < i; e.ip++) {
                  if (E.DEBUG && e.step++, !(r = At[t[e.ip]])) throw new Error("unknown instruction: 0x" + Number(t[e.ip]).toString(16));
                  r(e)
                }
              }
            }, At = [rr.bind(void 0, qt), rr.bind(void 0, Xt), ir.bind(void 0, qt), ir.bind(void 0, Xt), ar.bind(void 0, qt), ar.bind(void 0, Xt), nr.bind(void 0, 0), nr.bind(void 0, 1), or.bind(void 0, 0), or.bind(void 0, 1), function(e) {
              var t = e.stack,
                r = t.pop(),
                i = t.pop();
              E.DEBUG && console.log(e.step, "SPVFS[]", r, i), e.pv = e.dpv = Zt(i, r)
            }, function(e) {
              var t = e.stack,
                r = t.pop(),
                i = t.pop();
              E.DEBUG && console.log(e.step, "SPVFS[]", r, i), e.fv = Zt(i, r)
            }, function(e) {
              var t = e.stack,
                r = e.pv;
              E.DEBUG && console.log(e.step, "GPV[]"), t.push(16384 * r.x), t.push(16384 * r.y)
            }, function(e) {
              var t = e.stack,
                r = e.fv;
              E.DEBUG && console.log(e.step, "GFV[]"), t.push(16384 * r.x), t.push(16384 * r.y)
            }, function(e) {
              e.fv = e.pv, E.DEBUG && console.log(e.step, "SFVTPV[]")
            }, function(e) {
              var t = e.stack,
                r = t.pop(),
                i = t.pop(),
                a = t.pop(),
                n = t.pop(),
                o = t.pop(),
                s = e.z0,
                l = e.z1,
                u = s[r],
                h = s[i],
                d = l[a],
                c = l[n],
                f = e.z2[o];
              E.DEBUG && console.log("ISECT[], ", r, i, a, n, o);
              var p = u.x,
                m = u.y,
                v = h.x,
                g = h.y,
                y = d.x,
                _ = d.y,
                b = c.x,
                x = c.y,
                w = (p - v) * (_ - x) - (m - g) * (y - b),
                S = p * g - m * v,
                M = y * x - _ * b;
              f.x = (S * (y - b) - M * (p - v)) / w, f.y = (S * (_ - x) - M * (m - g)) / w
            }, function(e) {
              e.rp0 = e.stack.pop(), E.DEBUG && console.log(e.step, "SRP0[]", e.rp0)
            }, function(e) {
              e.rp1 = e.stack.pop(), E.DEBUG && console.log(e.step, "SRP1[]", e.rp1)
            }, function(e) {
              e.rp2 = e.stack.pop(), E.DEBUG && console.log(e.step, "SRP2[]", e.rp2)
            }, function(e) {
              var t = e.stack.pop();
              switch (E.DEBUG && console.log(e.step, "SZP0[]", t), e.zp0 = t) {
                case 0:
                  e.tZone || er(e), e.z0 = e.tZone;
                  break;
                case 1:
                  e.z0 = e.gZone;
                  break;
                default:
                  throw new Error("Invalid zone pointer")
              }
            }, function(e) {
              var t = e.stack.pop();
              switch (E.DEBUG && console.log(e.step, "SZP1[]", t), e.zp1 = t) {
                case 0:
                  e.tZone || er(e), e.z1 = e.tZone;
                  break;
                case 1:
                  e.z1 = e.gZone;
                  break;
                default:
                  throw new Error("Invalid zone pointer")
              }
            }, function(e) {
              var t = e.stack.pop();
              switch (E.DEBUG && console.log(e.step, "SZP2[]", t), e.zp2 = t) {
                case 0:
                  e.tZone || er(e), e.z2 = e.tZone;
                  break;
                case 1:
                  e.z2 = e.gZone;
                  break;
                default:
                  throw new Error("Invalid zone pointer")
              }
            }, function(e) {
              var t = e.stack.pop();
              switch (E.DEBUG && console.log(e.step, "SZPS[]", t), e.zp0 = e.zp1 = e.zp2 = t, t) {
                case 0:
                  e.tZone || er(e), e.z0 = e.z1 = e.z2 = e.tZone;
                  break;
                case 1:
                  e.z0 = e.z1 = e.z2 = e.gZone;
                  break;
                default:
                  throw new Error("Invalid zone pointer")
              }
            }, function(e) {
              e.loop = e.stack.pop(), E.DEBUG && console.log(e.step, "SLOOP[]", e.loop)
            }, function(e) {
              E.DEBUG && console.log(e.step, "RTG[]"), e.round = Gt
            }, function(e) {
              E.DEBUG && console.log(e.step, "RTHG[]"), e.round = Vt
            }, function(e) {
              var t = e.stack.pop();
              E.DEBUG && console.log(e.step, "SMD[]", t), e.minDis = t / 64
            }, function(e) {
              E.DEBUG && console.log(e.step, "ELSE[]"), tr(e, !1)
            }, function(e) {
              var t = e.stack.pop();
              E.DEBUG && console.log(e.step, "JMPR[]", t), e.ip += t - 1
            }, function(e) {
              var t = e.stack.pop();
              E.DEBUG && console.log(e.step, "SCVTCI[]", t), e.cvCutIn = t / 64
            }, void 0, void 0, function(e) {
              var t = e.stack;
              E.DEBUG && console.log(e.step, "DUP[]"), t.push(t[t.length - 1])
            }, sr, function(e) {
              E.DEBUG && console.log(e.step, "CLEAR[]"), e.stack.length = 0
            }, function(e) {
              var t = e.stack,
                r = t.pop(),
                i = t.pop();
              E.DEBUG && console.log(e.step, "SWAP[]"), t.push(r), t.push(i)
            }, function(e) {
              var t = e.stack;
              E.DEBUG && console.log(e.step, "DEPTH[]"), t.push(t.length)
            }, function(e) {
              var t = e.stack,
                r = t.pop();
              E.DEBUG && console.log(e.step, "CINDEX[]", r), t.push(t[t.length - r])
            }, function(e) {
              var t = e.stack,
                r = t.pop();
              E.DEBUG && console.log(e.step, "MINDEX[]", r), t.push(t.splice(t.length - r, 1)[0])
            }, void 0, void 0, void 0, function(e) {
              var t = e.stack,
                r = t.pop(),
                i = t.pop();
              E.DEBUG && console.log(e.step, "LOOPCALL[]", r, i);
              var a = e.ip,
                n = e.prog;
              e.prog = e.funcs[r];
              for (var o = 0; o < i; o++) It(e), E.DEBUG && console.log(++e.step, o + 1 < i ? "next loopcall" : "done loopcall", o);
              e.ip = a, e.prog = n
            }, function(e) {
              var t = e.stack.pop();
              E.DEBUG && console.log(e.step, "CALL[]", t);
              var r = e.ip,
                i = e.prog;
              e.prog = e.funcs[t], It(e), e.ip = r, e.prog = i, E.DEBUG && console.log(++e.step, "returning from", t)
            }, function(e) {
              if ("fpgm" !== e.env) throw new Error("FDEF not allowed here");
              var t = e.stack,
                r = e.prog,
                i = e.ip,
                a = t.pop(),
                n = i;
              for (E.DEBUG && console.log(e.step, "FDEF[]", a); 45 !== r[++i];);
              e.ip = i, e.funcs[a] = r.slice(n + 1, i)
            }, void 0, lr.bind(void 0, 0), lr.bind(void 0, 1), ur.bind(void 0, qt), ur.bind(void 0, Xt), hr.bind(void 0, 0), hr.bind(void 0, 1), dr.bind(void 0, 0), dr.bind(void 0, 1), cr.bind(void 0, 0), cr.bind(void 0, 1), function(e) {
              for (var t = e.stack, r = e.loop, i = e.fv, a = t.pop() / 64, n = e.z2; r--;) {
                var o = t.pop(),
                  s = n[o];
                E.DEBUG && console.log(e.step, (1 < e.loop ? "loop " + (e.loop - r) + ": " : "") + "SHPIX[]", o, a), i.setRelative(s, s, a), i.touch(s)
              }
              e.loop = 1
            }, function(e) {
              for (var t = e.stack, r = e.rp1, i = e.rp2, a = e.loop, n = e.z0[r], o = e.z1[i], s = e.fv, l = e.dpv, u = e.z2; a--;) {
                var h = t.pop(),
                  d = u[h];
                E.DEBUG && console.log(e.step, (1 < e.loop ? "loop " + (e.loop - a) + ": " : "") + "IP[]", h, r, "<->", i), s.interpolate(d, n, o, l), s.touch(d)
              }
              e.loop = 1
            }, fr.bind(void 0, 0), fr.bind(void 0, 1), function(e) {
              for (var t = e.stack, r = e.rp0, i = e.z0[r], a = e.loop, n = e.fv, o = e.pv, s = e.z1; a--;) {
                var l = t.pop(),
                  u = s[l];
                E.DEBUG && console.log(e.step, (1 < e.loop ? "loop " + (e.loop - a) + ": " : "") + "ALIGNRP[]", l), n.setRelative(u, i, 0, o), n.touch(u)
              }
              e.loop = 1
            }, function(e) {
              E.DEBUG && console.log(e.step, "RTDG[]"), e.round = jt
            }, pr.bind(void 0, 0), pr.bind(void 0, 1), function(e) {
              var t = e.prog,
                r = e.ip,
                i = e.stack,
                a = t[++r];
              E.DEBUG && console.log(e.step, "NPUSHB[]", a);
              for (var n = 0; n < a; n++) i.push(t[++r]);
              e.ip = r
            }, function(e) {
              var t = e.ip,
                r = e.prog,
                i = e.stack,
                a = r[++t];
              E.DEBUG && console.log(e.step, "NPUSHW[]", a);
              for (var n = 0; n < a; n++) {
                var o = r[++t] << 8 | r[++t];
                32768 & o && (o = -(1 + (65535 ^ o))), i.push(o)
              }
              e.ip = t
            }, function(e) {
              var t = e.stack,
                r = e.store;
              r || (r = e.store = []);
              var i = t.pop(),
                a = t.pop();
              E.DEBUG && console.log(e.step, "WS", i, a), r[a] = i
            }, function(e) {
              var t = e.stack,
                r = e.store,
                i = t.pop();
              E.DEBUG && console.log(e.step, "RS", i);
              var a = r && r[i] || 0;
              t.push(a)
            }, function(e) {
              var t = e.stack,
                r = t.pop(),
                i = t.pop();
              E.DEBUG && console.log(e.step, "WCVTP", r, i), e.cvt[i] = r / 64
            }, function(e) {
              var t = e.stack,
                r = t.pop();
              E.DEBUG && console.log(e.step, "RCVT", r), t.push(64 * e.cvt[r])
            }, mr.bind(void 0, 0), mr.bind(void 0, 1), void 0, vr.bind(void 0, 0), vr.bind(void 0, 1), function(e) {
              E.DEBUG && console.log(e.step, "MPPEM[]"), e.stack.push(e.ppem)
            }, void 0, function(e) {
              E.DEBUG && console.log(e.step, "FLIPON[]"), e.autoFlip = !0
            }, void 0, void 0, function(e) {
              var t = e.stack,
                r = t.pop(),
                i = t.pop();
              E.DEBUG && console.log(e.step, "LT[]", r, i), t.push(i < r ? 1 : 0)
            }, function(e) {
              var t = e.stack,
                r = t.pop(),
                i = t.pop();
              E.DEBUG && console.log(e.step, "LTEQ[]", r, i), t.push(i <= r ? 1 : 0)
            }, function(e) {
              var t = e.stack,
                r = t.pop(),
                i = t.pop();
              E.DEBUG && console.log(e.step, "GT[]", r, i), t.push(r < i ? 1 : 0)
            }, function(e) {
              var t = e.stack,
                r = t.pop(),
                i = t.pop();
              E.DEBUG && console.log(e.step, "GTEQ[]", r, i), t.push(r <= i ? 1 : 0)
            }, function(e) {
              var t = e.stack,
                r = t.pop(),
                i = t.pop();
              E.DEBUG && console.log(e.step, "EQ[]", r, i), t.push(r === i ? 1 : 0)
            }, function(e) {
              var t = e.stack,
                r = t.pop(),
                i = t.pop();
              E.DEBUG && console.log(e.step, "NEQ[]", r, i), t.push(r !== i ? 1 : 0)
            }, function(e) {
              var t = e.stack,
                r = t.pop();
              E.DEBUG && console.log(e.step, "ODD[]", r), t.push(Math.trunc(r) % 2 ? 1 : 0)
            }, function(e) {
              var t = e.stack,
                r = t.pop();
              E.DEBUG && console.log(e.step, "EVEN[]", r), t.push(Math.trunc(r) % 2 ? 0 : 1)
            }, function(e) {
              var t = e.stack.pop();
              E.DEBUG && console.log(e.step, "IF[]", t), t || (tr(e, !0), E.DEBUG && console.log(e.step, "EIF[]"))
            }, function(e) {
              E.DEBUG && console.log(e.step, "EIF[]")
            }, function(e) {
              var t = e.stack,
                r = t.pop(),
                i = t.pop();
              E.DEBUG && console.log(e.step, "AND[]", r, i), t.push(r && i ? 1 : 0)
            }, function(e) {
              var t = e.stack,
                r = t.pop(),
                i = t.pop();
              E.DEBUG && console.log(e.step, "OR[]", r, i), t.push(r || i ? 1 : 0)
            }, function(e) {
              var t = e.stack,
                r = t.pop();
              E.DEBUG && console.log(e.step, "NOT[]", r), t.push(r ? 0 : 1)
            }, gr.bind(void 0, 1), function(e) {
              var t = e.stack.pop();
              E.DEBUG && console.log(e.step, "SDB[]", t), e.deltaBase = t
            }, function(e) {
              var t = e.stack.pop();
              E.DEBUG && console.log(e.step, "SDS[]", t), e.deltaShift = Math.pow(.5, t)
            }, function(e) {
              var t = e.stack,
                r = t.pop(),
                i = t.pop();
              E.DEBUG && console.log(e.step, "ADD[]", r, i), t.push(i + r)
            }, function(e) {
              var t = e.stack,
                r = t.pop(),
                i = t.pop();
              E.DEBUG && console.log(e.step, "SUB[]", r, i), t.push(i - r)
            }, function(e) {
              var t = e.stack,
                r = t.pop(),
                i = t.pop();
              E.DEBUG && console.log(e.step, "DIV[]", r, i), t.push(64 * i / r)
            }, function(e) {
              var t = e.stack,
                r = t.pop(),
                i = t.pop();
              E.DEBUG && console.log(e.step, "MUL[]", r, i), t.push(i * r / 64)
            }, function(e) {
              var t = e.stack,
                r = t.pop();
              E.DEBUG && console.log(e.step, "ABS[]", r), t.push(Math.abs(r))
            }, function(e) {
              var t = e.stack,
                r = t.pop();
              E.DEBUG && console.log(e.step, "NEG[]", r), t.push(-r)
            }, function(e) {
              var t = e.stack,
                r = t.pop();
              E.DEBUG && console.log(e.step, "FLOOR[]", r), t.push(64 * Math.floor(r / 64))
            }, function(e) {
              var t = e.stack,
                r = t.pop();
              E.DEBUG && console.log(e.step, "CEILING[]", r), t.push(64 * Math.ceil(r / 64))
            }, yr.bind(void 0, 0), yr.bind(void 0, 1), yr.bind(void 0, 2), yr.bind(void 0, 3), void 0, void 0, void 0, void 0, function(e) {
              var t = e.stack,
                r = t.pop(),
                i = t.pop();
              E.DEBUG && console.log(e.step, "WCVTF[]", r, i), e.cvt[i] = r * e.ppem / e.font.unitsPerEm
            }, gr.bind(void 0, 2), gr.bind(void 0, 3), _r.bind(void 0, 1), _r.bind(void 0, 2), _r.bind(void 0, 3), function(e) {
              var t, r = e.stack.pop();
              switch (E.DEBUG && console.log(e.step, "SROUND[]", r), e.round = Wt, 192 & r) {
                case 0:
                  t = .5;
                  break;
                case 64:
                  t = 1;
                  break;
                case 128:
                  t = 2;
                  break;
                default:
                  throw new Error("invalid SROUND value")
              }
              switch (e.srPeriod = t, 48 & r) {
                case 0:
                  e.srPhase = 0;
                  break;
                case 16:
                  e.srPhase = .25 * t;
                  break;
                case 32:
                  e.srPhase = .5 * t;
                  break;
                case 48:
                  e.srPhase = .75 * t;
                  break;
                default:
                  throw new Error("invalid SROUND value")
              }
              r &= 15, e.srThreshold = 0 === r ? 0 : (r / 8 - .5) * t
            }, function(e) {
              var t, r = e.stack.pop();
              switch (E.DEBUG && console.log(e.step, "S45ROUND[]", r), e.round = Wt, 192 & r) {
                case 0:
                  t = Math.sqrt(2) / 2;
                  break;
                case 64:
                  t = Math.sqrt(2);
                  break;
                case 128:
                  t = 2 * Math.sqrt(2);
                  break;
                default:
                  throw new Error("invalid S45ROUND value")
              }
              switch (e.srPeriod = t, 48 & r) {
                case 0:
                  e.srPhase = 0;
                  break;
                case 16:
                  e.srPhase = .25 * t;
                  break;
                case 32:
                  e.srPhase = .5 * t;
                  break;
                case 48:
                  e.srPhase = .75 * t;
                  break;
                default:
                  throw new Error("invalid S45ROUND value")
              }
              r &= 15, e.srThreshold = 0 === r ? 0 : (r / 8 - .5) * t
            }, void 0, void 0, function(e) {
              E.DEBUG && console.log(e.step, "ROFF[]"), e.round = Bt
            }, void 0, function(e) {
              E.DEBUG && console.log(e.step, "RUTG[]"), e.round = zt
            }, function(e) {
              E.DEBUG && console.log(e.step, "RDTG[]"), e.round = Ht
            }, sr, sr, void 0, void 0, void 0, void 0, void 0, function(e) {
              var t = e.stack.pop();
              E.DEBUG && console.log(e.step, "SCANCTRL[]", t)
            }, br.bind(void 0, 0), br.bind(void 0, 1), function(e) {
              var t = e.stack,
                r = t.pop(),
                i = 0;
              E.DEBUG && console.log(e.step, "GETINFO[]", r), 1 & r && (i = 35), 32 & r && (i |= 4096), t.push(i)
            }, void 0, function(e) {
              var t = e.stack,
                r = t.pop(),
                i = t.pop(),
                a = t.pop();
              E.DEBUG && console.log(e.step, "ROLL[]"), t.push(i), t.push(r), t.push(a)
            }, function(e) {
              var t = e.stack,
                r = t.pop(),
                i = t.pop();
              E.DEBUG && console.log(e.step, "MAX[]", r, i), t.push(Math.max(i, r))
            }, function(e) {
              var t = e.stack,
                r = t.pop(),
                i = t.pop();
              E.DEBUG && console.log(e.step, "MIN[]", r, i), t.push(Math.min(i, r))
            }, function(e) {
              var t = e.stack.pop();
              E.DEBUG && console.log(e.step, "SCANTYPE[]", t)
            }, function(e) {
              var t = e.stack.pop(),
                r = e.stack.pop();
              switch (E.DEBUG && console.log(e.step, "INSTCTRL[]", t, r), t) {
                case 1:
                  return void(e.inhibitGridFit = !!r);
                case 2:
                  return void(e.ignoreCvt = !!r);
                default:
                  throw new Error("invalid INSTCTRL[] selector")
              }
            }, void 0, void 0, void 0, void 0, void 0, void 0, void 0, void 0, void 0, void 0, void 0, void 0, void 0, void 0, void 0, void 0, void 0, void 0, void 0, void 0, void 0, void 0, void 0, void 0, void 0, void 0, void 0, void 0, void 0, void 0, void 0, void 0, void 0, xr.bind(void 0, 1), xr.bind(void 0, 2), xr.bind(void 0, 3), xr.bind(void 0, 4), xr.bind(void 0, 5), xr.bind(void 0, 6), xr.bind(void 0, 7), xr.bind(void 0, 8), wr.bind(void 0, 1), wr.bind(void 0, 2), wr.bind(void 0, 3), wr.bind(void 0, 4), wr.bind(void 0, 5), wr.bind(void 0, 6), wr.bind(void 0, 7), wr.bind(void 0, 8), Sr.bind(void 0, 0, 0, 0, 0, 0), Sr.bind(void 0, 0, 0, 0, 0, 1), Sr.bind(void 0, 0, 0, 0, 0, 2), Sr.bind(void 0, 0, 0, 0, 0, 3), Sr.bind(void 0, 0, 0, 0, 1, 0), Sr.bind(void 0, 0, 0, 0, 1, 1), Sr.bind(void 0, 0, 0, 0, 1, 2), Sr.bind(void 0, 0, 0, 0, 1, 3), Sr.bind(void 0, 0, 0, 1, 0, 0), Sr.bind(void 0, 0, 0, 1, 0, 1), Sr.bind(void 0, 0, 0, 1, 0, 2), Sr.bind(void 0, 0, 0, 1, 0, 3), Sr.bind(void 0, 0, 0, 1, 1, 0), Sr.bind(void 0, 0, 0, 1, 1, 1), Sr.bind(void 0, 0, 0, 1, 1, 2), Sr.bind(void 0, 0, 0, 1, 1, 3), Sr.bind(void 0, 0, 1, 0, 0, 0), Sr.bind(void 0, 0, 1, 0, 0, 1), Sr.bind(void 0, 0, 1, 0, 0, 2), Sr.bind(void 0, 0, 1, 0, 0, 3), Sr.bind(void 0, 0, 1, 0, 1, 0), Sr.bind(void 0, 0, 1, 0, 1, 1), Sr.bind(void 0, 0, 1, 0, 1, 2), Sr.bind(void 0, 0, 1, 0, 1, 3), Sr.bind(void 0, 0, 1, 1, 0, 0), Sr.bind(void 0, 0, 1, 1, 0, 1), Sr.bind(void 0, 0, 1, 1, 0, 2), Sr.bind(void 0, 0, 1, 1, 0, 3), Sr.bind(void 0, 0, 1, 1, 1, 0), Sr.bind(void 0, 0, 1, 1, 1, 1), Sr.bind(void 0, 0, 1, 1, 1, 2), Sr.bind(void 0, 0, 1, 1, 1, 3), Sr.bind(void 0, 1, 0, 0, 0, 0), Sr.bind(void 0, 1, 0, 0, 0, 1), Sr.bind(void 0, 1, 0, 0, 0, 2), Sr.bind(void 0, 1, 0, 0, 0, 3), Sr.bind(void 0, 1, 0, 0, 1, 0), Sr.bind(void 0, 1, 0, 0, 1, 1), Sr.bind(void 0, 1, 0, 0, 1, 2), Sr.bind(void 0, 1, 0, 0, 1, 3), Sr.bind(void 0, 1, 0, 1, 0, 0), Sr.bind(void 0, 1, 0, 1, 0, 1), Sr.bind(void 0, 1, 0, 1, 0, 2), Sr.bind(void 0, 1, 0, 1, 0, 3), Sr.bind(void 0, 1, 0, 1, 1, 0), Sr.bind(void 0, 1, 0, 1, 1, 1), Sr.bind(void 0, 1, 0, 1, 1, 2), Sr.bind(void 0, 1, 0, 1, 1, 3), Sr.bind(void 0, 1, 1, 0, 0, 0), Sr.bind(void 0, 1, 1, 0, 0, 1), Sr.bind(void 0, 1, 1, 0, 0, 2), Sr.bind(void 0, 1, 1, 0, 0, 3), Sr.bind(void 0, 1, 1, 0, 1, 0), Sr.bind(void 0, 1, 1, 0, 1, 1), Sr.bind(void 0, 1, 1, 0, 1, 2), Sr.bind(void 0, 1, 1, 0, 1, 3), Sr.bind(void 0, 1, 1, 1, 0, 0), Sr.bind(void 0, 1, 1, 1, 0, 1), Sr.bind(void 0, 1, 1, 1, 0, 2), Sr.bind(void 0, 1, 1, 1, 0, 3), Sr.bind(void 0, 1, 1, 1, 1, 0), Sr.bind(void 0, 1, 1, 1, 1, 1), Sr.bind(void 0, 1, 1, 1, 1, 2), Sr.bind(void 0, 1, 1, 1, 1, 3)];
            var Mr = Array.from || function(e) {
              return e.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]?|[^\uD800-\uDFFF]|./g) || []
            };

            function Er(e) {
              (e = e || {}).empty || (Ct(e.familyName, "When creating a new Font object, familyName is required."), Ct(e.styleName, "When creating a new Font object, styleName is required."), Ct(e.unitsPerEm, "When creating a new Font object, unitsPerEm is required."), Ct(e.ascender, "When creating a new Font object, ascender is required."), Ct(e.descender, "When creating a new Font object, descender is required."), Ct(e.descender < 0, "Descender should be negative (e.g. -512)."), this.names = {
                fontFamily: {
                  en: e.familyName || " "
                },
                fontSubfamily: {
                  en: e.styleName || " "
                },
                fullName: {
                  en: e.fullName || e.familyName + " " + e.styleName
                },
                postScriptName: {
                  en: e.postScriptName || (e.familyName + e.styleName).replace(/\s/g, "")
                },
                designer: {
                  en: e.designer || " "
                },
                designerURL: {
                  en: e.designerURL || " "
                },
                manufacturer: {
                  en: e.manufacturer || " "
                },
                manufacturerURL: {
                  en: e.manufacturerURL || " "
                },
                license: {
                  en: e.license || " "
                },
                licenseURL: {
                  en: e.licenseURL || " "
                },
                version: {
                  en: e.version || "Version 0.1"
                },
                description: {
                  en: e.description || " "
                },
                copyright: {
                  en: e.copyright || " "
                },
                trademark: {
                  en: e.trademark || " "
                }
              }, this.unitsPerEm = e.unitsPerEm || 1e3, this.ascender = e.ascender, this.descender = e.descender, this.createdTimestamp = e.createdTimestamp, this.tables = {
                os2: {
                  usWeightClass: e.weightClass || this.usWeightClasses.MEDIUM,
                  usWidthClass: e.widthClass || this.usWidthClasses.MEDIUM,
                  fsSelection: e.fsSelection || this.fsSelectionValues.REGULAR
                }
              }), this.supported = !0, this.glyphs = new xe.GlyphSet(this, e.glyphs || []), this.encoding = new fe(this), this.position = new wt(this), this.substitution = new St(this), this.tables = this.tables || {}, Object.defineProperty(this, "hinting", {
                get: function() {
                  return this._hinting ? this._hinting : "truetype" === this.outlinesFormat ? this._hinting = new Nt(this) : void 0
                }
              })
            }

            function Tr(e, t) {
              var r = JSON.stringify(e),
                i = 256;
              for (var a in t) {
                var n = parseInt(a);
                if (n && !(n < 256)) {
                  if (JSON.stringify(t[a]) === r) return n;
                  i <= n && (i = n + 1)
                }
              }
              return t[i] = e, i
            }

            function Cr(e, t, r, i) {
              for (var a = [{
                  name: "nameID_" + e,
                  type: "USHORT",
                  value: Tr(t.name, i)
                }, {
                  name: "flags_" + e,
                  type: "USHORT",
                  value: 0
                }], n = 0; n < r.length; ++n) {
                var o = r[n].tag;
                a.push({
                  name: "axis_" + e + " " + o,
                  type: "FIXED",
                  value: t.coordinates[o] << 16
                })
              }
              return a
            }

            function Pr(e, t, r, i) {
              var a = {},
                n = new se.Parser(e, t);
              a.name = i[n.parseUShort()] || {}, n.skip("uShort", 1), a.coordinates = {};
              for (var o = 0; o < r.length; ++o) a.coordinates[r[o].tag] = n.parseFixed();
              return a
            }
            Er.prototype.hasChar = function(e) {
              return null !== this.encoding.charToGlyphIndex(e)
            }, Er.prototype.charToGlyphIndex = function(e) {
              return this.encoding.charToGlyphIndex(e)
            }, Er.prototype.charToGlyph = function(e) {
              var t = this.charToGlyphIndex(e),
                r = this.glyphs.get(t);
              return r || (r = this.glyphs.get(0)), r
            }, Er.prototype.stringToGlyphs = function(e, t) {
              t = t || this.defaultRenderOptions;
              for (var r = Mr(e), i = [], a = 0; a < r.length; a += 1) {
                var n = r[a];
                i.push(this.charToGlyphIndex(n))
              }
              var o = i.length;
              if (t.features) {
                var s = t.script || this.substitution.getDefaultScriptName(),
                  l = [];
                t.features.liga && (l = l.concat(this.substitution.getFeature("liga", s, t.language))), t.features.rlig && (l = l.concat(this.substitution.getFeature("rlig", s, t.language)));
                for (var u = 0; u < o; u += 1)
                  for (var h = 0; h < l.length; h++) {
                    for (var d = l[h], c = d.sub, f = c.length, p = 0; p < f && c[p] === i[u + p];) p++;
                    p === f && (i.splice(u, f, d.by), o = o - f + 1)
                  }
              }
              for (var m = new Array(o), v = this.glyphs.get(0), g = 0; g < o; g += 1) m[g] = this.glyphs.get(i[g]) || v;
              return m
            }, Er.prototype.nameToGlyphIndex = function(e) {
              return this.glyphNames.nameToGlyphIndex(e)
            }, Er.prototype.nameToGlyph = function(e) {
              var t = this.nameToGlyphIndex(e),
                r = this.glyphs.get(t);
              return r || (r = this.glyphs.get(0)), r
            }, Er.prototype.glyphIndexToName = function(e) {
              return this.glyphNames.glyphIndexToName ? this.glyphNames.glyphIndexToName(e) : ""
            }, Er.prototype.getKerningValue = function(e, t) {
              e = e.index || e, t = t.index || t;
              var r = this.position.defaultKerningTables;
              return r ? this.position.getKerningValue(r, e, t) : this.kerningPairs[e + "," + t] || 0
            }, Er.prototype.defaultRenderOptions = {
              kerning: !0,
              features: {
                liga: !0,
                rlig: !0
              }
            }, Er.prototype.forEachGlyph = function(e, t, r, i, a, n) {
              t = void 0 !== t ? t : 0, r = void 0 !== r ? r : 0, i = void 0 !== i ? i : 72, a = a || this.defaultRenderOptions;
              var o, s = 1 / this.unitsPerEm * i,
                l = this.stringToGlyphs(e, a);
              if (a.kerning) {
                var u = a.script || this.position.getDefaultScriptName();
                o = this.position.getKerningTables(u, a.language)
              }
              for (var h = 0; h < l.length; h += 1) {
                var d = l[h];
                if (n.call(this, d, t, r, i, a), d.advanceWidth && (t += d.advanceWidth * s), a.kerning && h < l.length - 1) t += (o ? this.position.getKerningValue(o, d.index, l[h + 1].index) : this.getKerningValue(d, l[h + 1])) * s;
                a.letterSpacing ? t += a.letterSpacing * i : a.tracking && (t += a.tracking / 1e3 * i)
              }
              return t
            }, Er.prototype.getPath = function(e, t, r, i, n) {
              var o = new k;
              return this.forEachGlyph(e, t, r, i, n, function(e, t, r, i) {
                var a = e.getPath(t, r, i, n, this);
                o.extend(a)
              }), o
            }, Er.prototype.getPaths = function(e, t, r, i, n) {
              var o = [];
              return this.forEachGlyph(e, t, r, i, n, function(e, t, r, i) {
                var a = e.getPath(t, r, i, n, this);
                o.push(a)
              }), o
            }, Er.prototype.getAdvanceWidth = function(e, t, r) {
              return this.forEachGlyph(e, 0, 0, t, r, function() {})
            }, Er.prototype.draw = function(e, t, r, i, a, n) {
              this.getPath(t, r, i, a, n).draw(e)
            }, Er.prototype.drawPoints = function(a, e, t, r, i, n) {
              this.forEachGlyph(e, t, r, i, n, function(e, t, r, i) {
                e.drawPoints(a, t, r, i)
              })
            }, Er.prototype.drawMetrics = function(a, e, t, r, i, n) {
              this.forEachGlyph(e, t, r, i, n, function(e, t, r, i) {
                e.drawMetrics(a, t, r, i)
              })
            }, Er.prototype.getEnglishName = function(e) {
              var t = this.names[e];
              if (t) return t.en
            }, Er.prototype.validate = function() {
              var r = this;

              function e(e) {
                var t = r.getEnglishName(e);
                t && t.trim().length
              }
              e("fontFamily"), e("weightName"), e("manufacturer"), e("copyright"), e("version"), this.unitsPerEm
            }, Er.prototype.toTables = function() {
              return gt.fontToTable(this)
            }, Er.prototype.toBuffer = function() {
              return console.warn("Font.toBuffer is deprecated. Use Font.toArrayBuffer instead."), this.toArrayBuffer()
            }, Er.prototype.toArrayBuffer = function() {
              for (var e = this.toTables().encode(), t = new ArrayBuffer(e.length), r = new Uint8Array(t), i = 0; i < e.length; i++) r[i] = e[i];
              return t
            }, Er.prototype.download = function(t) {
              var e = this.getEnglishName("fontFamily"),
                r = this.getEnglishName("fontSubfamily");
              t = t || e.replace(/\s/g, "") + "-" + r + ".otf";
              var a = this.toArrayBuffer();
              if ("undefined" != typeof window) window.requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem, window.requestFileSystem(window.TEMPORARY, a.byteLength, function(e) {
                e.root.getFile(t, {
                  create: !0
                }, function(i) {
                  i.createWriter(function(e) {
                    var t = new DataView(a),
                      r = new Blob([t], {
                        type: "font/opentype"
                      });
                    e.write(r), e.addEventListener("writeend", function() {
                      location.href = i.toURL()
                    }, !1)
                  })
                })
              }, function(e) {
                throw new Error(e.name + ": " + e.message)
              });
              else {
                var i = jr("fs"),
                  n = function(e) {
                    for (var t = new Gr(e.byteLength), r = new Uint8Array(e), i = 0; i < t.length; ++i) t[i] = r[i];
                    return t
                  }(a);
                i.writeFileSync(t, n)
              }
            }, Er.prototype.fsSelectionValues = {
              ITALIC: 1,
              UNDERSCORE: 2,
              NEGATIVE: 4,
              OUTLINED: 8,
              STRIKEOUT: 16,
              BOLD: 32,
              REGULAR: 64,
              USER_TYPO_METRICS: 128,
              WWS: 256,
              OBLIQUE: 512
            }, Er.prototype.usWidthClasses = {
              ULTRA_CONDENSED: 1,
              EXTRA_CONDENSED: 2,
              CONDENSED: 3,
              SEMI_CONDENSED: 4,
              MEDIUM: 5,
              SEMI_EXPANDED: 6,
              EXPANDED: 7,
              EXTRA_EXPANDED: 8,
              ULTRA_EXPANDED: 9
            }, Er.prototype.usWeightClasses = {
              THIN: 100,
              EXTRA_LIGHT: 200,
              LIGHT: 300,
              NORMAL: 400,
              MEDIUM: 500,
              SEMI_BOLD: 600,
              BOLD: 700,
              EXTRA_BOLD: 800,
              BLACK: 900
            };
            var Lr = {
                make: function(e, t) {
                  var r, i, a, n, o = new $.Table("fvar", [{
                    name: "version",
                    type: "ULONG",
                    value: 65536
                  }, {
                    name: "offsetToData",
                    type: "USHORT",
                    value: 0
                  }, {
                    name: "countSizePairs",
                    type: "USHORT",
                    value: 2
                  }, {
                    name: "axisCount",
                    type: "USHORT",
                    value: e.axes.length
                  }, {
                    name: "axisSize",
                    type: "USHORT",
                    value: 20
                  }, {
                    name: "instanceCount",
                    type: "USHORT",
                    value: e.instances.length
                  }, {
                    name: "instanceSize",
                    type: "USHORT",
                    value: 4 + 4 * e.axes.length
                  }]);
                  o.offsetToData = o.sizeOf();
                  for (var s = 0; s < e.axes.length; s++) o.fields = o.fields.concat((r = s, i = e.axes[s], a = t, n = Tr(i.name, a), [{
                    name: "tag_" + r,
                    type: "TAG",
                    value: i.tag
                  }, {
                    name: "minValue_" + r,
                    type: "FIXED",
                    value: i.minValue << 16
                  }, {
                    name: "defaultValue_" + r,
                    type: "FIXED",
                    value: i.defaultValue << 16
                  }, {
                    name: "maxValue_" + r,
                    type: "FIXED",
                    value: i.maxValue << 16
                  }, {
                    name: "flags_" + r,
                    type: "USHORT",
                    value: 0
                  }, {
                    name: "nameID_" + r,
                    type: "USHORT",
                    value: n
                  }]));
                  for (var l = 0; l < e.instances.length; l++) o.fields = o.fields.concat(Cr(l, e.instances[l], e.axes, t));
                  return o
                },
                parse: function(e, t, r) {
                  var i = new se.Parser(e, t),
                    a = i.parseULong();
                  R.argument(65536 === a, "Unsupported fvar table version.");
                  var n = i.parseOffset16();
                  i.skip("uShort", 1);
                  for (var o, s, l, u, h, d = i.parseUShort(), c = i.parseUShort(), f = i.parseUShort(), p = i.parseUShort(), m = [], v = 0; v < d; v++) m.push((o = e, s = t + n + v * c, l = r, h = u = void 0, u = {}, h = new se.Parser(o, s), u.tag = h.parseTag(), u.minValue = h.parseFixed(), u.defaultValue = h.parseFixed(), u.maxValue = h.parseFixed(), h.skip("uShort", 1), u.name = l[h.parseUShort()] || {}, u));
                  for (var g = [], y = t + n + d * c, _ = 0; _ < f; _++) g.push(Pr(e, y + _ * p, m, r));
                  return {
                    axes: m,
                    instances: g
                  }
                }
              },
              Rr = new Array(10);
            Rr[1] = function() {
              var e = this.offset + this.relativeOffset,
                t = this.parseUShort();
              return 1 === t ? {
                posFormat: 1,
                coverage: this.parsePointer(ne.coverage),
                value: this.parseValueRecord()
              } : 2 === t ? {
                posFormat: 2,
                coverage: this.parsePointer(ne.coverage),
                values: this.parseValueRecordList()
              } : void R.assert(!1, "0x" + e.toString(16) + ": GPOS lookup type 1 format must be 1 or 2.")
            }, Rr[2] = function() {
              var e = this.offset + this.relativeOffset,
                t = this.parseUShort();
              R.assert(1 === t || 2 === t, "0x" + e.toString(16) + ": GPOS lookup type 2 format must be 1 or 2.");
              var r = this.parsePointer(ne.coverage),
                i = this.parseUShort(),
                a = this.parseUShort();
              if (1 === t) return {
                posFormat: t,
                coverage: r,
                valueFormat1: i,
                valueFormat2: a,
                pairSets: this.parseList(ne.pointer(ne.list(function() {
                  return {
                    secondGlyph: this.parseUShort(),
                    value1: this.parseValueRecord(i),
                    value2: this.parseValueRecord(a)
                  }
                })))
              };
              if (2 === t) {
                var n = this.parsePointer(ne.classDef),
                  o = this.parsePointer(ne.classDef),
                  s = this.parseUShort(),
                  l = this.parseUShort();
                return {
                  posFormat: t,
                  coverage: r,
                  valueFormat1: i,
                  valueFormat2: a,
                  classDef1: n,
                  classDef2: o,
                  class1Count: s,
                  class2Count: l,
                  classRecords: this.parseList(s, ne.list(l, function() {
                    return {
                      value1: this.parseValueRecord(i),
                      value2: this.parseValueRecord(a)
                    }
                  }))
                }
              }
            }, Rr[3] = function() {
              return {
                error: "GPOS Lookup 3 not supported"
              }
            }, Rr[4] = function() {
              return {
                error: "GPOS Lookup 4 not supported"
              }
            }, Rr[5] = function() {
              return {
                error: "GPOS Lookup 5 not supported"
              }
            }, Rr[6] = function() {
              return {
                error: "GPOS Lookup 6 not supported"
              }
            }, Rr[7] = function() {
              return {
                error: "GPOS Lookup 7 not supported"
              }
            }, Rr[8] = function() {
              return {
                error: "GPOS Lookup 8 not supported"
              }
            }, Rr[9] = function() {
              return {
                error: "GPOS Lookup 9 not supported"
              }
            };
            var Or = new Array(10);
            var Dr = {
              parse: function(e, t) {
                var r = new ne(e, t = t || 0),
                  i = r.parseVersion(1);
                return R.argument(1 === i || 1.1 === i, "Unsupported GPOS table version " + i), 1 === i ? {
                  version: i,
                  scripts: r.parseScriptList(),
                  features: r.parseFeatureList(),
                  lookups: r.parseLookupList(Rr)
                } : {
                  version: i,
                  scripts: r.parseScriptList(),
                  features: r.parseFeatureList(),
                  lookups: r.parseLookupList(Rr),
                  variations: r.parseFeatureVariationsList()
                }
              },
              make: function(e) {
                return new $.Table("GPOS", [{
                  name: "version",
                  type: "ULONG",
                  value: 65536
                }, {
                  name: "scripts",
                  type: "TABLE",
                  value: new $.ScriptList(e.scripts)
                }, {
                  name: "features",
                  type: "TABLE",
                  value: new $.FeatureList(e.features)
                }, {
                  name: "lookups",
                  type: "TABLE",
                  value: new $.LookupList(e.lookups, Or)
                }])
              }
            };
            var Ar = {
              parse: function(e, t) {
                var r = new se.Parser(e, t),
                  i = r.parseUShort();
                if (0 === i) return function(e) {
                  var t = {};
                  e.skip("uShort");
                  var r = e.parseUShort();
                  R.argument(0 === r, "Unsupported kern sub-table version."), e.skip("uShort", 2);
                  var i = e.parseUShort();
                  e.skip("uShort", 3);
                  for (var a = 0; a < i; a += 1) {
                    var n = e.parseUShort(),
                      o = e.parseUShort(),
                      s = e.parseShort();
                    t[n + "," + o] = s
                  }
                  return t
                }(r);
                if (1 === i) return function(e) {
                  var t = {};
                  e.skip("uShort"), 1 < e.parseULong() && console.warn("Only the first kern subtable is supported."), e.skip("uLong");
                  var r = 255 & e.parseUShort();
                  if (e.skip("uShort"), 0 === r) {
                    var i = e.parseUShort();
                    e.skip("uShort", 3);
                    for (var a = 0; a < i; a += 1) {
                      var n = e.parseUShort(),
                        o = e.parseUShort(),
                        s = e.parseShort();
                      t[n + "," + o] = s
                    }
                  }
                  return t
                }(r);
                throw new Error("Unsupported kern table version (" + i + ").")
              }
            };
            var Ir = {
              parse: function(e, t, r, i) {
                for (var a = new se.Parser(e, t), n = i ? a.parseUShort : a.parseULong, o = [], s = 0; s < r + 1; s += 1) {
                  var l = n.call(a);
                  i && (l *= 2), o.push(l)
                }
                return o
              }
            };

            function kr(e, r) {
              jr("fs").readFile(e, function(e, t) {
                if (e) return r(e.message);
                r(null, Tt(t))
              })
            }

            function Ur(e, t) {
              var r = new XMLHttpRequest;
              r.open("get", e, !0), r.responseType = "arraybuffer", r.onload = function() {
                return r.response ? t(null, r.response) : t("Font could not be loaded: " + r.statusText)
              }, r.onerror = function() {
                t("Font could not be loaded")
              }, r.send()
            }

            function Fr(e, t) {
              for (var r = [], i = 12, a = 0; a < t; a += 1) {
                var n = se.getTag(e, i),
                  o = se.getULong(e, i + 4),
                  s = se.getULong(e, i + 8),
                  l = se.getULong(e, i + 12);
                r.push({
                  tag: n,
                  checksum: o,
                  offset: s,
                  length: l,
                  compression: !1
                }), i += 16
              }
              return r
            }

            function Nr(e, t) {
              if ("WOFF" !== t.compression) return {
                data: e,
                offset: t.offset
              };
              var r = new Uint8Array(e.buffer, t.offset + 2, t.compressedLength - 2),
                i = new Uint8Array(t.length);
              if (a(r, i), i.byteLength !== t.length) throw new Error("Decompression error: " + t.tag + " decompressed length doesn't match recorded length");
              return {
                data: new DataView(i.buffer, 0),
                offset: 0
              }
            }

            function Br(e) {
              var t, r, i, a, n, o, s, l, u, h, d, c, f, p, m = new Er({
                  empty: !0
                }),
                v = new DataView(e, 0),
                g = [],
                y = se.getTag(v, 0);
              if (y === String.fromCharCode(0, 1, 0, 0) || "true" === y || "typ1" === y) m.outlinesFormat = "truetype", g = Fr(v, i = se.getUShort(v, 4));
              else if ("OTTO" === y) m.outlinesFormat = "cff", g = Fr(v, i = se.getUShort(v, 4));
              else {
                if ("wOFF" !== y) throw new Error("Unsupported OpenType signature " + y);
                var _ = se.getTag(v, 4);
                if (_ === String.fromCharCode(0, 1, 0, 0)) m.outlinesFormat = "truetype";
                else {
                  if ("OTTO" !== _) throw new Error("Unsupported OpenType flavor " + y);
                  m.outlinesFormat = "cff"
                }
                g = function(e, t) {
                  for (var r = [], i = 44, a = 0; a < t; a += 1) {
                    var n = se.getTag(e, i),
                      o = se.getULong(e, i + 4),
                      s = se.getULong(e, i + 8),
                      l = se.getULong(e, i + 12),
                      u = void 0;
                    u = s < l && "WOFF", r.push({
                      tag: n,
                      offset: o,
                      compression: u,
                      compressedLength: s,
                      length: l
                    }), i += 20
                  }
                  return r
                }(v, i = se.getUShort(v, 12))
              }
              for (var b = 0; b < i; b += 1) {
                var x = g[b],
                  w = void 0;
                switch (x.tag) {
                  case "cmap":
                    w = Nr(v, x), m.tables.cmap = le.parse(w.data, w.offset), m.encoding = new pe(m.tables.cmap);
                    break;
                  case "cvt ":
                    w = Nr(v, x), p = new se.Parser(w.data, w.offset), m.tables.cvt = p.parseShortList(x.length / 2);
                    break;
                  case "fvar":
                    n = x;
                    break;
                  case "fpgm":
                    w = Nr(v, x), p = new se.Parser(w.data, w.offset), m.tables.fpgm = p.parseByteList(x.length);
                    break;
                  case "head":
                    w = Nr(v, x), m.tables.head = Ge.parse(w.data, w.offset), m.unitsPerEm = m.tables.head.unitsPerEm, t = m.tables.head.indexToLocFormat;
                    break;
                  case "hhea":
                    w = Nr(v, x), m.tables.hhea = je.parse(w.data, w.offset), m.ascender = m.tables.hhea.ascender, m.descender = m.tables.hhea.descender, m.numberOfHMetrics = m.tables.hhea.numberOfHMetrics;
                    break;
                  case "hmtx":
                    u = x;
                    break;
                  case "ltag":
                    w = Nr(v, x), r = ze.parse(w.data, w.offset);
                    break;
                  case "maxp":
                    w = Nr(v, x), m.tables.maxp = He.parse(w.data, w.offset), m.numGlyphs = m.tables.maxp.numGlyphs;
                    break;
                  case "name":
                    c = x;
                    break;
                  case "OS/2":
                    w = Nr(v, x), m.tables.os2 = nt.parse(w.data, w.offset);
                    break;
                  case "post":
                    w = Nr(v, x), m.tables.post = ot.parse(w.data, w.offset), m.glyphNames = new ve(m.tables.post);
                    break;
                  case "prep":
                    w = Nr(v, x), p = new se.Parser(w.data, w.offset), m.tables.prep = p.parseByteList(x.length);
                    break;
                  case "glyf":
                    o = x;
                    break;
                  case "loca":
                    d = x;
                    break;
                  case "CFF ":
                    a = x;
                    break;
                  case "kern":
                    h = x;
                    break;
                  case "GPOS":
                    s = x;
                    break;
                  case "GSUB":
                    l = x;
                    break;
                  case "meta":
                    f = x
                }
              }
              var S = Nr(v, c);
              if (m.tables.name = it.parse(S.data, S.offset, r), m.names = m.tables.name, o && d) {
                var M = 0 === t,
                  E = Nr(v, d),
                  T = Ir.parse(E.data, E.offset, m.numGlyphs, M),
                  C = Nr(v, o);
                m.glyphs = Ft.parse(C.data, C.offset, T, m)
              } else {
                if (!a) throw new Error("Font doesn't contain TrueType or CFF outlines.");
                var P = Nr(v, a);
                Be.parse(P.data, P.offset, m)
              }
              var L = Nr(v, u);
              if (Ve.parse(L.data, L.offset, m.numberOfHMetrics, m.numGlyphs, m.glyphs), function(e) {
                  for (var t, r = e.tables.cmap.glyphIndexMap, i = Object.keys(r), a = 0; a < i.length; a += 1) {
                    var n = i[a],
                      o = r[n];
                    (t = e.glyphs.get(o)).addUnicode(parseInt(n))
                  }
                  for (var s = 0; s < e.glyphs.length; s += 1) t = e.glyphs.get(s), e.cffEncoding ? e.isCIDFont ? t.name = "gid" + s : t.name = e.cffEncoding.charset[s] : e.glyphNames.names && (t.name = e.glyphNames.glyphIndexToName(s))
                }(m), h) {
                var R = Nr(v, h);
                m.kerningPairs = Ar.parse(R.data, R.offset)
              } else m.kerningPairs = {};
              if (s) {
                var O = Nr(v, s);
                m.tables.gpos = Dr.parse(O.data, O.offset), m.position.init()
              }
              if (l) {
                var D = Nr(v, l);
                m.tables.gsub = ht.parse(D.data, D.offset)
              }
              if (n) {
                var A = Nr(v, n);
                m.tables.fvar = Lr.parse(A.data, A.offset, m.names)
              }
              if (f) {
                var I = Nr(v, f);
                m.tables.meta = dt.parse(I.data, I.offset), m.metas = m.tables.meta
              }
              return m
            }
            E.Font = Er, E.Glyph = ye, E.Path = k, E.BoundingBox = C, E._parse = se, E.parse = Br, E.load = function(e, i) {
              ("undefined" == typeof window ? kr : Ur)(e, function(e, t) {
                if (e) return i(e);
                var r;
                try {
                  r = Br(t)
                } catch (e) {
                  return i(e, null)
                }
                return i(null, r)
              })
            }, E.loadSync = function(e) {
              return Br(Tt(jr("fs").readFileSync(e)))
            }, Object.defineProperty(E, "__esModule", {
              value: !0
            })
          }("object" == typeof r && void 0 !== t ? r : e.opentype = {})
      }).call(this, jr("buffer").Buffer)
    }, {
      buffer: 3,
      fs: 2
    }],
    12: [function(e, t, u) {
      (function(a) {
        function n(e, t) {
          for (var r = 0, i = e.length - 1; 0 <= i; i--) {
            var a = e[i];
            "." === a ? e.splice(i, 1) : ".." === a ? (e.splice(i, 1), r++) : r && (e.splice(i, 1), r--)
          }
          if (t)
            for (; r--; r) e.unshift("..");
          return e
        }

        function o(e, t) {
          if (e.filter) return e.filter(t);
          for (var r = [], i = 0; i < e.length; i++) t(e[i], i, e) && r.push(e[i]);
          return r
        }
        u.resolve = function() {
          for (var e = "", t = !1, r = arguments.length - 1; - 1 <= r && !t; r--) {
            var i = 0 <= r ? arguments[r] : a.cwd();
            if ("string" != typeof i) throw new TypeError("Arguments to path.resolve must be strings");
            i && (e = i + "/" + e, t = "/" === i.charAt(0))
          }
          return (t ? "/" : "") + (e = n(o(e.split("/"), function(e) {
            return !!e
          }), !t).join("/")) || "."
        }, u.normalize = function(e) {
          var t = u.isAbsolute(e),
            r = "/" === i(e, -1);
          return (e = n(o(e.split("/"), function(e) {
            return !!e
          }), !t).join("/")) || t || (e = "."), e && r && (e += "/"), (t ? "/" : "") + e
        }, u.isAbsolute = function(e) {
          return "/" === e.charAt(0)
        }, u.join = function() {
          var e = Array.prototype.slice.call(arguments, 0);
          return u.normalize(o(e, function(e, t) {
            if ("string" != typeof e) throw new TypeError("Arguments to path.join must be strings");
            return e
          }).join("/"))
        }, u.relative = function(e, t) {
          function r(e) {
            for (var t = 0; t < e.length && "" === e[t]; t++);
            for (var r = e.length - 1; 0 <= r && "" === e[r]; r--);
            return r < t ? [] : e.slice(t, r - t + 1)
          }
          e = u.resolve(e).substr(1), t = u.resolve(t).substr(1);
          for (var i = r(e.split("/")), a = r(t.split("/")), n = Math.min(i.length, a.length), o = n, s = 0; s < n; s++)
            if (i[s] !== a[s]) {
              o = s;
              break
            } var l = [];
          for (s = o; s < i.length; s++) l.push("..");
          return (l = l.concat(a.slice(o))).join("/")
        }, u.sep = "/", u.delimiter = ":", u.dirname = function(e) {
          if ("string" != typeof e && (e += ""), 0 === e.length) return ".";
          for (var t = e.charCodeAt(0), r = 47 === t, i = -1, a = !0, n = e.length - 1; 1 <= n; --n)
            if (47 === (t = e.charCodeAt(n))) {
              if (!a) {
                i = n;
                break
              }
            } else a = !1;
          return -1 === i ? r ? "/" : "." : r && 1 === i ? "/" : e.slice(0, i)
        }, u.basename = function(e, t) {
          var r = function(e) {
            "string" != typeof e && (e += "");
            var t, r = 0,
              i = -1,
              a = !0;
            for (t = e.length - 1; 0 <= t; --t)
              if (47 === e.charCodeAt(t)) {
                if (!a) {
                  r = t + 1;
                  break
                }
              } else -1 === i && (a = !1, i = t + 1);
            return -1 === i ? "" : e.slice(r, i)
          }(e);
          return t && r.substr(-1 * t.length) === t && (r = r.substr(0, r.length - t.length)), r
        }, u.extname = function(e) {
          "string" != typeof e && (e += "");
          for (var t = -1, r = 0, i = -1, a = !0, n = 0, o = e.length - 1; 0 <= o; --o) {
            var s = e.charCodeAt(o);
            if (47 === s) {
              if (a) continue;
              r = o + 1;
              break
            } - 1 === i && (a = !1, i = o + 1), 46 === s ? -1 === t ? t = o : 1 !== n && (n = 1) : -1 !== t && (n = -1)
          }
          return -1 === t || -1 === i || 0 === n || 1 === n && t === i - 1 && t === r + 1 ? "" : e.slice(t, i)
        };
        var i = "b" === "ab".substr(-1) ? function(e, t, r) {
          return e.substr(t, r)
        } : function(e, t, r) {
          return t < 0 && (t = e.length + t), e.substr(t, r)
        }
      }).call(this, e("_process"))
    }, {
      _process: 13
    }],
    13: [function(e, t, r) {
      var i, a, n = t.exports = {};

      function o() {
        throw new Error("setTimeout has not been defined")
      }

      function s() {
        throw new Error("clearTimeout has not been defined")
      }

      function l(t) {
        if (i === setTimeout) return setTimeout(t, 0);
        if ((i === o || !i) && setTimeout) return i = setTimeout, setTimeout(t, 0);
        try {
          return i(t, 0)
        } catch (e) {
          try {
            return i.call(null, t, 0)
          } catch (e) {
            return i.call(this, t, 0)
          }
        }
      }! function() {
        try {
          i = "function" == typeof setTimeout ? setTimeout : o
        } catch (e) {
          i = o
        }
        try {
          a = "function" == typeof clearTimeout ? clearTimeout : s
        } catch (e) {
          a = s
        }
      }();
      var u, h = [],
        d = !1,
        c = -1;

      function f() {
        d && u && (d = !1, u.length ? h = u.concat(h) : c = -1, h.length && p())
      }

      function p() {
        if (!d) {
          var e = l(f);
          d = !0;
          for (var t = h.length; t;) {
            for (u = h, h = []; ++c < t;) u && u[c].run();
            c = -1, t = h.length
          }
          u = null, d = !1,
            function(t) {
              if (a === clearTimeout) return clearTimeout(t);
              if ((a === s || !a) && clearTimeout) return a = clearTimeout, clearTimeout(t);
              try {
                a(t)
              } catch (e) {
                try {
                  return a.call(null, t)
                } catch (e) {
                  return a.call(this, t)
                }
              }
            }(e)
        }
      }

      function m(e, t) {
        this.fun = e, this.array = t
      }

      function v() {}
      n.nextTick = function(e) {
        var t = new Array(arguments.length - 1);
        if (1 < arguments.length)
          for (var r = 1; r < arguments.length; r++) t[r - 1] = arguments[r];
        h.push(new m(e, t)), 1 !== h.length || d || l(p)
      }, m.prototype.run = function() {
        this.fun.apply(null, this.array)
      }, n.title = "browser", n.browser = !0, n.env = {}, n.argv = [], n.version = "", n.versions = {}, n.on = v, n.addListener = v, n.once = v, n.off = v, n.removeListener = v, n.removeAllListeners = v, n.emit = v, n.prependListener = v, n.prependOnceListener = v, n.listeners = function(e) {
        return []
      }, n.binding = function(e) {
        throw new Error("process.binding is not supported")
      }, n.cwd = function() {
        return "/"
      }, n.chdir = function(e) {
        throw new Error("process.chdir is not supported")
      }, n.umask = function() {
        return 0
      }
    }, {}],
    14: [function(e, t, r) {
      ! function(e) {
        "use strict";
        if (!e.fetch) {
          var t = "URLSearchParams" in e,
            r = "Symbol" in e && "iterator" in Symbol,
            o = "FileReader" in e && "Blob" in e && function() {
              try {
                return new Blob, !0
              } catch (e) {
                return !1
              }
            }(),
            i = "FormData" in e,
            a = "ArrayBuffer" in e;
          if (a) var n = ["[object Int8Array]", "[object Uint8Array]", "[object Uint8ClampedArray]", "[object Int16Array]", "[object Uint16Array]", "[object Int32Array]", "[object Uint32Array]", "[object Float32Array]", "[object Float64Array]"],
            s = function(e) {
              return e && DataView.prototype.isPrototypeOf(e)
            },
            l = ArrayBuffer.isView || function(e) {
              return e && -1 < n.indexOf(Object.prototype.toString.call(e))
            };
          p.prototype.append = function(e, t) {
            e = d(e), t = c(t);
            var r = this.map[e];
            this.map[e] = r ? r + "," + t : t
          }, p.prototype.delete = function(e) {
            delete this.map[d(e)]
          }, p.prototype.get = function(e) {
            return e = d(e), this.has(e) ? this.map[e] : null
          }, p.prototype.has = function(e) {
            return this.map.hasOwnProperty(d(e))
          }, p.prototype.set = function(e, t) {
            this.map[d(e)] = c(t)
          }, p.prototype.forEach = function(e, t) {
            for (var r in this.map) this.map.hasOwnProperty(r) && e.call(t, this.map[r], r, this)
          }, p.prototype.keys = function() {
            var r = [];
            return this.forEach(function(e, t) {
              r.push(t)
            }), f(r)
          }, p.prototype.values = function() {
            var t = [];
            return this.forEach(function(e) {
              t.push(e)
            }), f(t)
          }, p.prototype.entries = function() {
            var r = [];
            return this.forEach(function(e, t) {
              r.push([t, e])
            }), f(r)
          }, r && (p.prototype[Symbol.iterator] = p.prototype.entries);
          var u = ["DELETE", "GET", "HEAD", "OPTIONS", "POST", "PUT"];
          b.prototype.clone = function() {
            return new b(this, {
              body: this._bodyInit
            })
          }, _.call(b.prototype), _.call(w.prototype), w.prototype.clone = function() {
            return new w(this._bodyInit, {
              status: this.status,
              statusText: this.statusText,
              headers: new p(this.headers),
              url: this.url
            })
          }, w.error = function() {
            var e = new w(null, {
              status: 0,
              statusText: ""
            });
            return e.type = "error", e
          };
          var h = [301, 302, 303, 307, 308];
          w.redirect = function(e, t) {
            if (-1 === h.indexOf(t)) throw new RangeError("Invalid status code");
            return new w(null, {
              status: t,
              headers: {
                location: e
              }
            })
          }, e.Headers = p, e.Request = b, e.Response = w, e.fetch = function(r, a) {
            return new Promise(function(i, e) {
              var t = new b(r, a),
                n = new XMLHttpRequest;
              n.onload = function() {
                var e, a, t = {
                  status: n.status,
                  statusText: n.statusText,
                  headers: (e = n.getAllResponseHeaders() || "", a = new p, e.replace(/\r?\n[\t ]+/g, " ").split(/\r?\n/).forEach(function(e) {
                    var t = e.split(":"),
                      r = t.shift().trim();
                    if (r) {
                      var i = t.join(":").trim();
                      a.append(r, i)
                    }
                  }), a)
                };
                t.url = "responseURL" in n ? n.responseURL : t.headers.get("X-Request-URL");
                var r = "response" in n ? n.response : n.responseText;
                i(new w(r, t))
              }, n.onerror = function() {
                e(new TypeError("Network request failed"))
              }, n.ontimeout = function() {
                e(new TypeError("Network request failed"))
              }, n.open(t.method, t.url, !0), "include" === t.credentials ? n.withCredentials = !0 : "omit" === t.credentials && (n.withCredentials = !1), "responseType" in n && o && (n.responseType = "blob"), t.headers.forEach(function(e, t) {
                n.setRequestHeader(t, e)
              }), n.send(void 0 === t._bodyInit ? null : t._bodyInit)
            })
          }, e.fetch.polyfill = !0
        }

        function d(e) {
          if ("string" != typeof e && (e = String(e)), /[^a-z0-9\-#$%&'*+.\^_`|~]/i.test(e)) throw new TypeError("Invalid character in header field name");
          return e.toLowerCase()
        }

        function c(e) {
          return "string" != typeof e && (e = String(e)), e
        }

        function f(t) {
          var e = {
            next: function() {
              var e = t.shift();
              return {
                done: void 0 === e,
                value: e
              }
            }
          };
          return r && (e[Symbol.iterator] = function() {
            return e
          }), e
        }

        function p(t) {
          this.map = {}, t instanceof p ? t.forEach(function(e, t) {
            this.append(t, e)
          }, this) : Array.isArray(t) ? t.forEach(function(e) {
            this.append(e[0], e[1])
          }, this) : t && Object.getOwnPropertyNames(t).forEach(function(e) {
            this.append(e, t[e])
          }, this)
        }

        function m(e) {
          if (e.bodyUsed) return Promise.reject(new TypeError("Already read"));
          e.bodyUsed = !0
        }

        function v(r) {
          return new Promise(function(e, t) {
            r.onload = function() {
              e(r.result)
            }, r.onerror = function() {
              t(r.error)
            }
          })
        }

        function g(e) {
          var t = new FileReader,
            r = v(t);
          return t.readAsArrayBuffer(e), r
        }

        function y(e) {
          if (e.slice) return e.slice(0);
          var t = new Uint8Array(e.byteLength);
          return t.set(new Uint8Array(e)), t.buffer
        }

        function _() {
          return this.bodyUsed = !1, this._initBody = function(e) {
            if (this._bodyInit = e)
              if ("string" == typeof e) this._bodyText = e;
              else if (o && Blob.prototype.isPrototypeOf(e)) this._bodyBlob = e;
            else if (i && FormData.prototype.isPrototypeOf(e)) this._bodyFormData = e;
            else if (t && URLSearchParams.prototype.isPrototypeOf(e)) this._bodyText = e.toString();
            else if (a && o && s(e)) this._bodyArrayBuffer = y(e.buffer), this._bodyInit = new Blob([this._bodyArrayBuffer]);
            else {
              if (!a || !ArrayBuffer.prototype.isPrototypeOf(e) && !l(e)) throw new Error("unsupported BodyInit type");
              this._bodyArrayBuffer = y(e)
            } else this._bodyText = "";
            this.headers.get("content-type") || ("string" == typeof e ? this.headers.set("content-type", "text/plain;charset=UTF-8") : this._bodyBlob && this._bodyBlob.type ? this.headers.set("content-type", this._bodyBlob.type) : t && URLSearchParams.prototype.isPrototypeOf(e) && this.headers.set("content-type", "application/x-www-form-urlencoded;charset=UTF-8"))
          }, o && (this.blob = function() {
            var e = m(this);
            if (e) return e;
            if (this._bodyBlob) return Promise.resolve(this._bodyBlob);
            if (this._bodyArrayBuffer) return Promise.resolve(new Blob([this._bodyArrayBuffer]));
            if (this._bodyFormData) throw new Error("could not read FormData body as blob");
            return Promise.resolve(new Blob([this._bodyText]))
          }, this.arrayBuffer = function() {
            return this._bodyArrayBuffer ? m(this) || Promise.resolve(this._bodyArrayBuffer) : this.blob().then(g)
          }), this.text = function() {
            var e, t, r, i = m(this);
            if (i) return i;
            if (this._bodyBlob) return e = this._bodyBlob, t = new FileReader, r = v(t), t.readAsText(e), r;
            if (this._bodyArrayBuffer) return Promise.resolve(function(e) {
              for (var t = new Uint8Array(e), r = new Array(t.length), i = 0; i < t.length; i++) r[i] = String.fromCharCode(t[i]);
              return r.join("")
            }(this._bodyArrayBuffer));
            if (this._bodyFormData) throw new Error("could not read FormData body as text");
            return Promise.resolve(this._bodyText)
          }, i && (this.formData = function() {
            return this.text().then(x)
          }), this.json = function() {
            return this.text().then(JSON.parse)
          }, this
        }

        function b(e, t) {
          var r, i, a = (t = t || {}).body;
          if (e instanceof b) {
            if (e.bodyUsed) throw new TypeError("Already read");
            this.url = e.url, this.credentials = e.credentials, t.headers || (this.headers = new p(e.headers)), this.method = e.method, this.mode = e.mode, a || null == e._bodyInit || (a = e._bodyInit, e.bodyUsed = !0)
          } else this.url = String(e);
          if (this.credentials = t.credentials || this.credentials || "omit", !t.headers && this.headers || (this.headers = new p(t.headers)), this.method = (r = t.method || this.method || "GET", i = r.toUpperCase(), -1 < u.indexOf(i) ? i : r), this.mode = t.mode || this.mode || null, this.referrer = null, ("GET" === this.method || "HEAD" === this.method) && a) throw new TypeError("Body not allowed for GET or HEAD requests");
          this._initBody(a)
        }

        function x(e) {
          var a = new FormData;
          return e.trim().split("&").forEach(function(e) {
            if (e) {
              var t = e.split("="),
                r = t.shift().replace(/\+/g, " "),
                i = t.join("=").replace(/\+/g, " ");
              a.append(decodeURIComponent(r), decodeURIComponent(i))
            }
          }), a
        }

        function w(e, t) {
          t || (t = {}), this.type = "default", this.status = void 0 === t.status ? 200 : t.status, this.ok = 200 <= this.status && this.status < 300, this.statusText = "statusText" in t ? t.statusText : "OK", this.headers = new p(t.headers), this.url = t.url || "", this._initBody(e)
        }
      }("undefined" != typeof self ? self : this)
    }, {}],
    15: [function(e, t, r) {
      "use strict";
      var i, a = (i = e("./core/main")) && i.__esModule ? i : {
        default: i
      };
      e("./core/constants"), e("./core/environment"), e("./core/error_helpers"), e("./core/helpers"), e("./core/legacy"), e("./core/preload"), e("./core/p5.Element"), e("./core/p5.Graphics"), e("./core/p5.Renderer"), e("./core/p5.Renderer2D"), e("./core/rendering"), e("./core/shim"), e("./core/structure"), e("./core/transform"), e("./core/shape/2d_primitives"), e("./core/shape/attributes"), e("./core/shape/curves"), e("./core/shape/vertex"), e("./color/color_conversion"), e("./color/creating_reading"), e("./color/p5.Color"), e("./color/setting"), e("./data/p5.TypedDict"), e("./data/local_storage.js"), e("./dom/dom"), e("./events/acceleration"), e("./events/keyboard"), e("./events/mouse"), e("./events/touch"), e("./image/filters"), e("./image/image"), e("./image/loading_displaying"), e("./image/p5.Image"), e("./image/pixels"), e("./io/files"), e("./io/p5.Table"), e("./io/p5.TableRow"), e("./io/p5.XML"), e("./math/calculation"), e("./math/math"), e("./math/noise"), e("./math/p5.Vector"), e("./math/random"), e("./math/trigonometry"), e("./typography/attributes"), e("./typography/loading_displaying"), e("./typography/p5.Font"), e("./utilities/array_functions"), e("./utilities/conversion"), e("./utilities/string_functions"), e("./utilities/time_date"), e("./webgl/3d_primitives"), e("./webgl/interaction"), e("./webgl/light"), e("./webgl/loading"), e("./webgl/material"), e("./webgl/p5.Camera"), e("./webgl/p5.Geometry"), e("./webgl/p5.Matrix"), e("./webgl/p5.RendererGL.Immediate"), e("./webgl/p5.RendererGL"), e("./webgl/p5.RendererGL.Retained"), e("./webgl/p5.Shader"), e("./webgl/p5.Texture"), e("./webgl/text"), e("./core/init"), t.exports = a.default
    }, {
      "./color/color_conversion": 16,
      "./color/creating_reading": 17,
      "./color/p5.Color": 18,
      "./color/setting": 19,
      "./core/constants": 20,
      "./core/environment": 21,
      "./core/error_helpers": 22,
      "./core/helpers": 23,
      "./core/init": 24,
      "./core/legacy": 25,
      "./core/main": 26,
      "./core/p5.Element": 27,
      "./core/p5.Graphics": 28,
      "./core/p5.Renderer": 29,
      "./core/p5.Renderer2D": 30,
      "./core/preload": 31,
      "./core/rendering": 32,
      "./core/shape/2d_primitives": 33,
      "./core/shape/attributes": 34,
      "./core/shape/curves": 35,
      "./core/shape/vertex": 36,
      "./core/shim": 37,
      "./core/structure": 38,
      "./core/transform": 39,
      "./data/local_storage.js": 40,
      "./data/p5.TypedDict": 41,
      "./dom/dom": 42,
      "./events/acceleration": 43,
      "./events/keyboard": 44,
      "./events/mouse": 45,
      "./events/touch": 46,
      "./image/filters": 47,
      "./image/image": 48,
      "./image/loading_displaying": 49,
      "./image/p5.Image": 50,
      "./image/pixels": 51,
      "./io/files": 52,
      "./io/p5.Table": 53,
      "./io/p5.TableRow": 54,
      "./io/p5.XML": 55,
      "./math/calculation": 56,
      "./math/math": 57,
      "./math/noise": 58,
      "./math/p5.Vector": 59,
      "./math/random": 60,
      "./math/trigonometry": 61,
      "./typography/attributes": 62,
      "./typography/loading_displaying": 63,
      "./typography/p5.Font": 64,
      "./utilities/array_functions": 65,
      "./utilities/conversion": 66,
      "./utilities/string_functions": 67,
      "./utilities/time_date": 68,
      "./webgl/3d_primitives": 69,
      "./webgl/interaction": 70,
      "./webgl/light": 71,
      "./webgl/loading": 72,
      "./webgl/material": 73,
      "./webgl/p5.Camera": 74,
      "./webgl/p5.Geometry": 75,
      "./webgl/p5.Matrix": 76,
      "./webgl/p5.RendererGL": 79,
      "./webgl/p5.RendererGL.Immediate": 77,
      "./webgl/p5.RendererGL.Retained": 78,
      "./webgl/p5.Shader": 80,
      "./webgl/p5.Texture": 81,
      "./webgl/text": 82
    }],
    16: [function(e, t, r) {
      "use strict";
      Object.defineProperty(r, "__esModule", {
        value: !0
      }), r.default = void 0;
      var i, a = (i = e("../core/main")) && i.__esModule ? i : {
        default: i
      };
      a.default.ColorConversion = {}, a.default.ColorConversion._hsbaToHSLA = function(e) {
        var t = e[0],
          r = e[1],
          i = e[2],
          a = (2 - r) * i / 2;
        return 0 !== a && (1 === a ? r = 0 : a < .5 ? r /= 2 - r : r = r * i / (2 - 2 * a)), [t, r, a, e[3]]
      }, a.default.ColorConversion._hsbaToRGBA = function(e) {
        var t = 6 * e[0],
          r = e[1],
          i = e[2],
          a = [];
        if (0 === r) a = [i, i, i, e[3]];
        else {
          var n, o, s, l = Math.floor(t),
            u = i * (1 - r),
            h = i * (1 - r * (t - l)),
            d = i * (1 - r * (1 + l - t));
          s = 1 === l ? (n = h, o = i, u) : 2 === l ? (n = u, o = i, d) : 3 === l ? (n = u, o = h, i) : 4 === l ? (n = d, o = u, i) : 5 === l ? (n = i, o = u, h) : (n = i, o = d, u), a = [n, o, s, e[3]]
        }
        return a
      }, a.default.ColorConversion._hslaToHSBA = function(e) {
        var t, r = e[0],
          i = e[1],
          a = e[2];
        return [r, i = 2 * ((t = a < .5 ? (1 + i) * a : a + i - a * i) - a) / t, t, e[3]]
      }, a.default.ColorConversion._hslaToRGBA = function(e) {
        var t = 6 * e[0],
          r = e[1],
          i = e[2],
          a = [];
        if (0 === r) a = [i, i, i, e[3]];
        else {
          var n, o = 2 * i - (n = i < .5 ? (1 + r) * i : i + r - i * r),
            s = function(e, t, r) {
              return e < 0 ? e += 6 : 6 <= e && (e -= 6), e < 1 ? t + (r - t) * e : e < 3 ? r : e < 4 ? t + (r - t) * (4 - e) : t
            };
          a = [s(t + 2, o, n), s(t, o, n), s(t - 2, o, n), e[3]]
        }
        return a
      }, a.default.ColorConversion._rgbaToHSBA = function(e) {
        var t, r, i = e[0],
          a = e[1],
          n = e[2],
          o = Math.max(i, a, n),
          s = o - Math.min(i, a, n);
        return 0 === s ? r = t = 0 : (r = s / o, i === o ? t = (a - n) / s : a === o ? t = 2 + (n - i) / s : n === o && (t = 4 + (i - a) / s), t < 0 ? t += 6 : 6 <= t && (t -= 6)), [t / 6, r, o, e[3]]
      }, a.default.ColorConversion._rgbaToHSLA = function(e) {
        var t, r, i = e[0],
          a = e[1],
          n = e[2],
          o = Math.max(i, a, n),
          s = Math.min(i, a, n),
          l = o + s,
          u = o - s;
        return 0 === u ? r = t = 0 : (r = l < 1 ? u / l : u / (2 - l), i === o ? t = (a - n) / u : a === o ? t = 2 + (n - i) / u : n === o && (t = 4 + (i - a) / u), t < 0 ? t += 6 : 6 <= t && (t -= 6)), [t / 6, r, l / 2, e[3]]
      };
      var n = a.default.ColorConversion;
      r.default = n
    }, {
      "../core/main": 26
    }],
    17: [function(e, t, r) {
      "use strict";
      Object.defineProperty(r, "__esModule", {
        value: !0
      }), r.default = void 0;
      var i, d = (i = e("../core/main")) && i.__esModule ? i : {
          default: i
        },
        c = function(e) {
          {
            if (e && e.__esModule) return e;
            var t = {};
            if (null != e)
              for (var r in e)
                if (Object.prototype.hasOwnProperty.call(e, r)) {
                  var i = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(e, r) : {};
                  i.get || i.set ? Object.defineProperty(t, r, i) : t[r] = e[r]
                } return t.default = e, t
          }
        }(e("../core/constants"));
      e("./p5.Color"), e("../core/error_helpers"), d.default.prototype.alpha = function(e) {
        return d.default._validateParameters("alpha", arguments), this.color(e)._getAlpha()
      }, d.default.prototype.blue = function(e) {
        return d.default._validateParameters("blue", arguments), this.color(e)._getBlue()
      }, d.default.prototype.brightness = function(e) {
        return d.default._validateParameters("brightness", arguments), this.color(e)._getBrightness()
      }, d.default.prototype.color = function() {
        if (d.default._validateParameters("color", arguments), arguments[0] instanceof d.default.Color) return arguments[0];
        var e = arguments[0] instanceof Array ? arguments[0] : arguments;
        return new d.default.Color(this, e)
      }, d.default.prototype.green = function(e) {
        return d.default._validateParameters("green", arguments), this.color(e)._getGreen()
      }, d.default.prototype.hue = function(e) {
        return d.default._validateParameters("hue", arguments), this.color(e)._getHue()
      }, d.default.prototype.lerpColor = function(e, t, r) {
        d.default._validateParameters("lerpColor", arguments);
        var i, a, n, o, s, l, u = this._colorMode,
          h = this._colorMaxes;
        if (u === c.RGB) s = e.levels.map(function(e) {
          return e / 255
        }), l = t.levels.map(function(e) {
          return e / 255
        });
        else if (u === c.HSB) e._getBrightness(), t._getBrightness(), s = e.hsba, l = t.hsba;
        else {
          if (u !== c.HSL) throw new Error("".concat(u, "cannot be used for interpolation."));
          e._getLightness(), t._getLightness(), s = e.hsla, l = t.hsla
        }
        return r = Math.max(Math.min(r, 1), 0), void 0 === this.lerp && (this.lerp = function(e, t, r) {
          return r * (t - e) + e
        }), i = this.lerp(s[0], l[0], r), a = this.lerp(s[1], l[1], r), n = this.lerp(s[2], l[2], r), o = this.lerp(s[3], l[3], r), i *= h[u][0], a *= h[u][1], n *= h[u][2], o *= h[u][3], this.color(i, a, n, o)
      }, d.default.prototype.lightness = function(e) {
        return d.default._validateParameters("lightness", arguments), this.color(e)._getLightness()
      }, d.default.prototype.red = function(e) {
        return d.default._validateParameters("red", arguments), this.color(e)._getRed()
      }, d.default.prototype.saturation = function(e) {
        return d.default._validateParameters("saturation", arguments), this.color(e)._getSaturation()
      };
      var a = d.default;
      r.default = a
    }, {
      "../core/constants": 20,
      "../core/error_helpers": 22,
      "../core/main": 26,
      "./p5.Color": 18
    }],
    18: [function(e, t, r) {
      "use strict";
      Object.defineProperty(r, "__esModule", {
        value: !0
      }), r.default = void 0;
      var d = i(e("../core/main")),
        c = function(e) {
          {
            if (e && e.__esModule) return e;
            var t = {};
            if (null != e)
              for (var r in e)
                if (Object.prototype.hasOwnProperty.call(e, r)) {
                  var i = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(e, r) : {};
                  i.get || i.set ? Object.defineProperty(t, r, i) : t[r] = e[r]
                } return t.default = e, t
          }
        }(e("../core/constants")),
        f = i(e("./color_conversion"));

      function i(e) {
        return e && e.__esModule ? e : {
          default: e
        }
      }
      d.default.Color = function(e, t) {
        if (this._storeModeAndMaxes(e._colorMode, e._colorMaxes), this.mode !== c.RGB && this.mode !== c.HSL && this.mode !== c.HSB) throw new Error("".concat(this.mode, " is an invalid colorMode."));
        return this._array = d.default.Color._parseInputs.apply(this, t), this._calculateLevels(), this
      }, d.default.Color.prototype.toString = function(e) {
        var t = this.levels,
          r = this._array,
          i = r[3];
        switch (e) {
          case "#rrggbb":
            return "#".concat(t[0] < 16 ? "0".concat(t[0].toString(16)) : t[0].toString(16), t[1] < 16 ? "0".concat(t[1].toString(16)) : t[1].toString(16), t[2] < 16 ? "0".concat(t[2].toString(16)) : t[2].toString(16));
          case "#rrggbbaa":
            return "#".concat(t[0] < 16 ? "0".concat(t[0].toString(16)) : t[0].toString(16), t[1] < 16 ? "0".concat(t[1].toString(16)) : t[1].toString(16), t[2] < 16 ? "0".concat(t[2].toString(16)) : t[2].toString(16), t[3] < 16 ? "0".concat(t[2].toString(16)) : t[3].toString(16));
          case "#rgb":
            return "#".concat(Math.round(15 * r[0]).toString(16), Math.round(15 * r[1]).toString(16), Math.round(15 * r[2]).toString(16));
          case "#rgba":
            return "#".concat(Math.round(15 * r[0]).toString(16), Math.round(15 * r[1]).toString(16), Math.round(15 * r[2]).toString(16), Math.round(15 * r[3]).toString(16));
          case "rgb":
            return "rgb(".concat(t[0], ", ", t[1], ", ", t[2], ")");
          case "rgb%":
            return "rgb(".concat((100 * r[0]).toPrecision(3), "%, ", (100 * r[1]).toPrecision(3), "%, ", (100 * r[2]).toPrecision(3), "%)");
          case "rgba%":
            return "rgba(".concat((100 * r[0]).toPrecision(3), "%, ", (100 * r[1]).toPrecision(3), "%, ", (100 * r[2]).toPrecision(3), "%, ", (100 * r[3]).toPrecision(3), "%)");
          case "hsb":
          case "hsv":
            return this.hsba || (this.hsba = f.default._rgbaToHSBA(this._array)), "hsb(".concat(this.hsba[0] * this.maxes[c.HSB][0], ", ", this.hsba[1] * this.maxes[c.HSB][1], ", ", this.hsba[2] * this.maxes[c.HSB][2], ")");
          case "hsb%":
          case "hsv%":
            return this.hsba || (this.hsba = f.default._rgbaToHSBA(this._array)), "hsb(".concat((100 * this.hsba[0]).toPrecision(3), "%, ", (100 * this.hsba[1]).toPrecision(3), "%, ", (100 * this.hsba[2]).toPrecision(3), "%)");
          case "hsba":
          case "hsva":
            return this.hsba || (this.hsba = f.default._rgbaToHSBA(this._array)), "hsba(".concat(this.hsba[0] * this.maxes[c.HSB][0], ", ", this.hsba[1] * this.maxes[c.HSB][1], ", ", this.hsba[2] * this.maxes[c.HSB][2], ", ", i, ")");
          case "hsba%":
          case "hsva%":
            return this.hsba || (this.hsba = f.default._rgbaToHSBA(this._array)), "hsba(".concat((100 * this.hsba[0]).toPrecision(3), "%, ", (100 * this.hsba[1]).toPrecision(3), "%, ", (100 * this.hsba[2]).toPrecision(3), "%, ", (100 * i).toPrecision(3), "%)");
          case "hsl":
            return this.hsla || (this.hsla = f.default._rgbaToHSLA(this._array)), "hsl(".concat(this.hsla[0] * this.maxes[c.HSL][0], ", ", this.hsla[1] * this.maxes[c.HSL][1], ", ", this.hsla[2] * this.maxes[c.HSL][2], ")");
          case "hsl%":
            return this.hsla || (this.hsla = f.default._rgbaToHSLA(this._array)), "hsl(".concat((100 * this.hsla[0]).toPrecision(3), "%, ", (100 * this.hsla[1]).toPrecision(3), "%, ", (100 * this.hsla[2]).toPrecision(3), "%)");
          case "hsla":
            return this.hsla || (this.hsla = f.default._rgbaToHSLA(this._array)), "hsla(".concat(this.hsla[0] * this.maxes[c.HSL][0], ", ", this.hsla[1] * this.maxes[c.HSL][1], ", ", this.hsla[2] * this.maxes[c.HSL][2], ", ", i, ")");
          case "hsla%":
            return this.hsla || (this.hsla = f.default._rgbaToHSLA(this._array)), "hsl(".concat((100 * this.hsla[0]).toPrecision(3), "%, ", (100 * this.hsla[1]).toPrecision(3), "%, ", (100 * this.hsla[2]).toPrecision(3), "%, ", (100 * i).toPrecision(3), "%)");
          case "rgba":
          default:
            return "rgba(".concat(t[0], ",", t[1], ",", t[2], ",", i, ")")
        }
      }, d.default.Color.prototype.setRed = function(e) {
        this._array[0] = e / this.maxes[c.RGB][0], this._calculateLevels()
      }, d.default.Color.prototype.setGreen = function(e) {
        this._array[1] = e / this.maxes[c.RGB][1], this._calculateLevels()
      }, d.default.Color.prototype.setBlue = function(e) {
        this._array[2] = e / this.maxes[c.RGB][2], this._calculateLevels()
      }, d.default.Color.prototype.setAlpha = function(e) {
        this._array[3] = e / this.maxes[this.mode][3], this._calculateLevels()
      }, d.default.Color.prototype._calculateLevels = function() {
        for (var e = this._array, t = this.levels = new Array(e.length), r = e.length - 1; 0 <= r; --r) t[r] = Math.round(255 * e[r])
      }, d.default.Color.prototype._getAlpha = function() {
        return this._array[3] * this.maxes[this.mode][3]
      }, d.default.Color.prototype._storeModeAndMaxes = function(e, t) {
        this.mode = e, this.maxes = t
      }, d.default.Color.prototype._getMode = function() {
        return this.mode
      }, d.default.Color.prototype._getMaxes = function() {
        return this.maxes
      }, d.default.Color.prototype._getBlue = function() {
        return this._array[2] * this.maxes[c.RGB][2]
      }, d.default.Color.prototype._getBrightness = function() {
        return this.hsba || (this.hsba = f.default._rgbaToHSBA(this._array)), this.hsba[2] * this.maxes[c.HSB][2]
      }, d.default.Color.prototype._getGreen = function() {
        return this._array[1] * this.maxes[c.RGB][1]
      }, d.default.Color.prototype._getHue = function() {
        return this.mode === c.HSB ? (this.hsba || (this.hsba = f.default._rgbaToHSBA(this._array)), this.hsba[0] * this.maxes[c.HSB][0]) : (this.hsla || (this.hsla = f.default._rgbaToHSLA(this._array)), this.hsla[0] * this.maxes[c.HSL][0])
      }, d.default.Color.prototype._getLightness = function() {
        return this.hsla || (this.hsla = f.default._rgbaToHSLA(this._array)), this.hsla[2] * this.maxes[c.HSL][2]
      }, d.default.Color.prototype._getRed = function() {
        return this._array[0] * this.maxes[c.RGB][0]
      }, d.default.Color.prototype._getSaturation = function() {
        return this.mode === c.HSB ? (this.hsba || (this.hsba = f.default._rgbaToHSBA(this._array)), this.hsba[1] * this.maxes[c.HSB][1]) : (this.hsla || (this.hsla = f.default._rgbaToHSLA(this._array)), this.hsla[1] * this.maxes[c.HSL][1])
      };
      var p = {
          aliceblue: "#f0f8ff",
          antiquewhite: "#faebd7",
          aqua: "#00ffff",
          aquamarine: "#7fffd4",
          azure: "#f0ffff",
          beige: "#f5f5dc",
          bisque: "#ffe4c4",
          black: "#000000",
          blanchedalmond: "#ffebcd",
          blue: "#0000ff",
          blueviolet: "#8a2be2",
          brown: "#a52a2a",
          burlywood: "#deb887",
          cadetblue: "#5f9ea0",
          chartreuse: "#7fff00",
          chocolate: "#d2691e",
          coral: "#ff7f50",
          cornflowerblue: "#6495ed",
          cornsilk: "#fff8dc",
          crimson: "#dc143c",
          cyan: "#00ffff",
          darkblue: "#00008b",
          darkcyan: "#008b8b",
          darkgoldenrod: "#b8860b",
          darkgray: "#a9a9a9",
          darkgreen: "#006400",
          darkgrey: "#a9a9a9",
          darkkhaki: "#bdb76b",
          darkmagenta: "#8b008b",
          darkolivegreen: "#556b2f",
          darkorange: "#ff8c00",
          darkorchid: "#9932cc",
          darkred: "#8b0000",
          darksalmon: "#e9967a",
          darkseagreen: "#8fbc8f",
          darkslateblue: "#483d8b",
          darkslategray: "#2f4f4f",
          darkslategrey: "#2f4f4f",
          darkturquoise: "#00ced1",
          darkviolet: "#9400d3",
          deeppink: "#ff1493",
          deepskyblue: "#00bfff",
          dimgray: "#696969",
          dimgrey: "#696969",
          dodgerblue: "#1e90ff",
          firebrick: "#b22222",
          floralwhite: "#fffaf0",
          forestgreen: "#228b22",
          fuchsia: "#ff00ff",
          gainsboro: "#dcdcdc",
          ghostwhite: "#f8f8ff",
          gold: "#ffd700",
          goldenrod: "#daa520",
          gray: "#808080",
          green: "#008000",
          greenyellow: "#adff2f",
          grey: "#808080",
          honeydew: "#f0fff0",
          hotpink: "#ff69b4",
          indianred: "#cd5c5c",
          indigo: "#4b0082",
          ivory: "#fffff0",
          khaki: "#f0e68c",
          lavender: "#e6e6fa",
          lavenderblush: "#fff0f5",
          lawngreen: "#7cfc00",
          lemonchiffon: "#fffacd",
          lightblue: "#add8e6",
          lightcoral: "#f08080",
          lightcyan: "#e0ffff",
          lightgoldenrodyellow: "#fafad2",
          lightgray: "#d3d3d3",
          lightgreen: "#90ee90",
          lightgrey: "#d3d3d3",
          lightpink: "#ffb6c1",
          lightsalmon: "#ffa07a",
          lightseagreen: "#20b2aa",
          lightskyblue: "#87cefa",
          lightslategray: "#778899",
          lightslategrey: "#778899",
          lightsteelblue: "#b0c4de",
          lightyellow: "#ffffe0",
          lime: "#00ff00",
          limegreen: "#32cd32",
          linen: "#faf0e6",
          magenta: "#ff00ff",
          maroon: "#800000",
          mediumaquamarine: "#66cdaa",
          mediumblue: "#0000cd",
          mediumorchid: "#ba55d3",
          mediumpurple: "#9370db",
          mediumseagreen: "#3cb371",
          mediumslateblue: "#7b68ee",
          mediumspringgreen: "#00fa9a",
          mediumturquoise: "#48d1cc",
          mediumvioletred: "#c71585",
          midnightblue: "#191970",
          mintcream: "#f5fffa",
          mistyrose: "#ffe4e1",
          moccasin: "#ffe4b5",
          navajowhite: "#ffdead",
          navy: "#000080",
          oldlace: "#fdf5e6",
          olive: "#808000",
          olivedrab: "#6b8e23",
          orange: "#ffa500",
          orangered: "#ff4500",
          orchid: "#da70d6",
          palegoldenrod: "#eee8aa",
          palegreen: "#98fb98",
          paleturquoise: "#afeeee",
          palevioletred: "#db7093",
          papayawhip: "#ffefd5",
          peachpuff: "#ffdab9",
          peru: "#cd853f",
          pink: "#ffc0cb",
          plum: "#dda0dd",
          powderblue: "#b0e0e6",
          purple: "#800080",
          rebeccapurple: "#663399",
          red: "#ff0000",
          rosybrown: "#bc8f8f",
          royalblue: "#4169e1",
          saddlebrown: "#8b4513",
          salmon: "#fa8072",
          sandybrown: "#f4a460",
          seagreen: "#2e8b57",
          seashell: "#fff5ee",
          sienna: "#a0522d",
          silver: "#c0c0c0",
          skyblue: "#87ceeb",
          slateblue: "#6a5acd",
          slategray: "#708090",
          slategrey: "#708090",
          snow: "#fffafa",
          springgreen: "#00ff7f",
          steelblue: "#4682b4",
          tan: "#d2b48c",
          teal: "#008080",
          thistle: "#d8bfd8",
          tomato: "#ff6347",
          turquoise: "#40e0d0",
          violet: "#ee82ee",
          wheat: "#f5deb3",
          white: "#ffffff",
          whitesmoke: "#f5f5f5",
          yellow: "#ffff00",
          yellowgreen: "#9acd32"
        },
        a = /\s*/,
        n = /(\d{1,3})/,
        o = /((?:\d+(?:\.\d+)?)|(?:\.\d+))/,
        s = new RegExp("".concat(o.source, "%")),
        m = {
          HEX3: /^#([a-f0-9])([a-f0-9])([a-f0-9])$/i,
          HEX4: /^#([a-f0-9])([a-f0-9])([a-f0-9])([a-f0-9])$/i,
          HEX6: /^#([a-f0-9]{2})([a-f0-9]{2})([a-f0-9]{2})$/i,
          HEX8: /^#([a-f0-9]{2})([a-f0-9]{2})([a-f0-9]{2})([a-f0-9]{2})$/i,
          RGB: new RegExp(["^rgb\\(", n.source, ",", n.source, ",", n.source, "\\)$"].join(a.source), "i"),
          RGB_PERCENT: new RegExp(["^rgb\\(", s.source, ",", s.source, ",", s.source, "\\)$"].join(a.source), "i"),
          RGBA: new RegExp(["^rgba\\(", n.source, ",", n.source, ",", n.source, ",", o.source, "\\)$"].join(a.source), "i"),
          RGBA_PERCENT: new RegExp(["^rgba\\(", s.source, ",", s.source, ",", s.source, ",", o.source, "\\)$"].join(a.source), "i"),
          HSL: new RegExp(["^hsl\\(", n.source, ",", s.source, ",", s.source, "\\)$"].join(a.source), "i"),
          HSLA: new RegExp(["^hsla\\(", n.source, ",", s.source, ",", s.source, ",", o.source, "\\)$"].join(a.source), "i"),
          HSB: new RegExp(["^hsb\\(", n.source, ",", s.source, ",", s.source, "\\)$"].join(a.source), "i"),
          HSBA: new RegExp(["^hsba\\(", n.source, ",", s.source, ",", s.source, ",", o.source, "\\)$"].join(a.source), "i")
        };
      d.default.Color._parseInputs = function(e, t, r, i) {
        var a, n = arguments.length,
          o = this.mode,
          s = this.maxes[o],
          l = [];
        if (3 <= n) {
          for (l[0] = e / s[0], l[1] = t / s[1], l[2] = r / s[2], l[3] = "number" == typeof i ? i / s[3] : 1, a = l.length - 1; 0 <= a; --a) {
            var u = l[a];
            u < 0 ? l[a] = 0 : 1 < u && (l[a] = 1)
          }
          return o === c.HSL ? f.default._hslaToRGBA(l) : o === c.HSB ? f.default._hsbaToRGBA(l) : l
        }
        if (1 === n && "string" == typeof e) {
          var h = e.trim().toLowerCase();
          if (p[h]) return d.default.Color._parseInputs.call(this, p[h]);
          if (m.HEX3.test(h)) return (l = m.HEX3.exec(h).slice(1).map(function(e) {
            return parseInt(e + e, 16) / 255
          }))[3] = 1, l;
          if (m.HEX6.test(h)) return (l = m.HEX6.exec(h).slice(1).map(function(e) {
            return parseInt(e, 16) / 255
          }))[3] = 1, l;
          if (m.HEX4.test(h)) return l = m.HEX4.exec(h).slice(1).map(function(e) {
            return parseInt(e + e, 16) / 255
          });
          if (m.HEX8.test(h)) return l = m.HEX8.exec(h).slice(1).map(function(e) {
            return parseInt(e, 16) / 255
          });
          if (m.RGB.test(h)) return (l = m.RGB.exec(h).slice(1).map(function(e) {
            return e / 255
          }))[3] = 1, l;
          if (m.RGB_PERCENT.test(h)) return (l = m.RGB_PERCENT.exec(h).slice(1).map(function(e) {
            return parseFloat(e) / 100
          }))[3] = 1, l;
          if (m.RGBA.test(h)) return l = m.RGBA.exec(h).slice(1).map(function(e, t) {
            return 3 === t ? parseFloat(e) : e / 255
          });
          if (m.RGBA_PERCENT.test(h)) return l = m.RGBA_PERCENT.exec(h).slice(1).map(function(e, t) {
            return 3 === t ? parseFloat(e) : parseFloat(e) / 100
          });
          if (m.HSL.test(h) ? (l = m.HSL.exec(h).slice(1).map(function(e, t) {
              return 0 === t ? parseInt(e, 10) / 360 : parseInt(e, 10) / 100
            }))[3] = 1 : m.HSLA.test(h) && (l = m.HSLA.exec(h).slice(1).map(function(e, t) {
              return 0 === t ? parseInt(e, 10) / 360 : 3 === t ? parseFloat(e) : parseInt(e, 10) / 100
            })), (l = l.map(function(e) {
              return Math.max(Math.min(e, 1), 0)
            })).length) return f.default._hslaToRGBA(l);
          if (m.HSB.test(h) ? (l = m.HSB.exec(h).slice(1).map(function(e, t) {
              return 0 === t ? parseInt(e, 10) / 360 : parseInt(e, 10) / 100
            }))[3] = 1 : m.HSBA.test(h) && (l = m.HSBA.exec(h).slice(1).map(function(e, t) {
              return 0 === t ? parseInt(e, 10) / 360 : 3 === t ? parseFloat(e) : parseInt(e, 10) / 100
            })), l.length) {
            for (a = l.length - 1; 0 <= a; --a) l[a] = Math.max(Math.min(l[a], 1), 0);
            return f.default._hsbaToRGBA(l)
          }
          l = [1, 1, 1, 1]
        } else {
          if (1 !== n && 2 !== n || "number" != typeof e) throw new Error("".concat(arguments, "is not a valid color representation."));
          l[0] = e / s[2], l[1] = e / s[2], l[2] = e / s[2], l[3] = "number" == typeof t ? t / s[3] : 1, l = l.map(function(e) {
            return Math.max(Math.min(e, 1), 0)
          })
        }
        return l
      };
      var l = d.default.Color;
      r.default = l
    }, {
      "../core/constants": 20,
      "../core/main": 26,
      "./color_conversion": 16
    }],
    19: [function(e, t, r) {
      "use strict";
      Object.defineProperty(r, "__esModule", {
        value: !0
      }), r.default = void 0;
      var i, o = (i = e("../core/main")) && i.__esModule ? i : {
          default: i
        },
        s = function(e) {
          {
            if (e && e.__esModule) return e;
            var t = {};
            if (null != e)
              for (var r in e)
                if (Object.prototype.hasOwnProperty.call(e, r)) {
                  var i = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(e, r) : {};
                  i.get || i.set ? Object.defineProperty(t, r, i) : t[r] = e[r]
                } return t.default = e, t
          }
        }(e("../core/constants"));
      e("./p5.Color"), o.default.prototype.background = function() {
        var e;
        return (e = this._renderer).background.apply(e, arguments), this
      }, o.default.prototype.clear = function() {
        return this._renderer.clear(), this
      }, o.default.prototype.colorMode = function(e, t, r, i, a) {
        if (o.default._validateParameters("colorMode", arguments), e === s.RGB || e === s.HSB || e === s.HSL) {
          this._colorMode = e;
          var n = this._colorMaxes[e];
          2 === arguments.length ? (n[0] = t, n[1] = t, n[2] = t, n[3] = t) : 4 === arguments.length ? (n[0] = t, n[1] = r, n[2] = i) : 5 === arguments.length && (n[0] = t, n[1] = r, n[2] = i, n[3] = a)
        }
        return this
      }, o.default.prototype.fill = function() {
        var e;
        return this._renderer._setProperty("_fillSet", !0), this._renderer._setProperty("_doFill", !0), (e = this._renderer).fill.apply(e, arguments), this
      }, o.default.prototype.noFill = function() {
        return this._renderer._setProperty("_doFill", !1), this
      }, o.default.prototype.noStroke = function() {
        return this._renderer._setProperty("_doStroke", !1), this
      }, o.default.prototype.stroke = function() {
        var e;
        return this._renderer._setProperty("_strokeSet", !0), this._renderer._setProperty("_doStroke", !0), (e = this._renderer).stroke.apply(e, arguments), this
      }, o.default.prototype.erase = function() {
        var e = 0 < arguments.length && void 0 !== arguments[0] ? arguments[0] : 255,
          t = 1 < arguments.length && void 0 !== arguments[1] ? arguments[1] : 255;
        return this._renderer.erase(e, t), this
      }, o.default.prototype.noErase = function() {
        return this._renderer.noErase(), this
      };
      var a = o.default;
      r.default = a
    }, {
      "../core/constants": 20,
      "../core/main": 26,
      "./p5.Color": 18
    }],
    20: [function(e, t, r) {
      "use strict";
      Object.defineProperty(r, "__esModule", {
        value: !0
      }), r.TEXTURE = r.FILL = r.STROKE = r.CURVE = r.BEZIER = r.QUADRATIC = r.LINEAR = r._CTX_MIDDLE = r._DEFAULT_LEADMULT = r._DEFAULT_TEXT_FILL = r.BOLDITALIC = r.BOLD = r.ITALIC = r.NORMAL = r.BLUR = r.ERODE = r.DILATE = r.POSTERIZE = r.INVERT = r.OPAQUE = r.GRAY = r.THRESHOLD = r.BURN = r.DODGE = r.SOFT_LIGHT = r.HARD_LIGHT = r.OVERLAY = r.REPLACE = r.SCREEN = r.MULTIPLY = r.EXCLUSION = r.SUBTRACT = r.DIFFERENCE = r.LIGHTEST = r.DARKEST = r.ADD = r.REMOVE = r.BLEND = r.UP_ARROW = r.TAB = r.SHIFT = r.RIGHT_ARROW = r.RETURN = r.OPTION = r.LEFT_ARROW = r.ESCAPE = r.ENTER = r.DOWN_ARROW = r.DELETE = r.CONTROL = r.BACKSPACE = r.ALT = r.AUTO = r.HSL = r.HSB = r.RGB = r.MITER = r.BEVEL = r.ROUND = r.SQUARE = r.PROJECT = r.PIE = r.CHORD = r.OPEN = r.CLOSE = r.QUAD_STRIP = r.QUADS = r.TRIANGLE_STRIP = r.TRIANGLE_FAN = r.TRIANGLES = r.LINE_LOOP = r.LINE_STRIP = r.LINES = r.POINTS = r.BASELINE = r.BOTTOM = r.TOP = r.CENTER = r.LEFT = r.RIGHT = r.RADIUS = r.CORNERS = r.CORNER = r.RAD_TO_DEG = r.DEG_TO_RAD = r.RADIANS = r.DEGREES = r.TWO_PI = r.TAU = r.QUARTER_PI = r.PI = r.HALF_PI = r.WAIT = r.TEXT = r.MOVE = r.HAND = r.CROSS = r.ARROW = r.WEBGL = r.P2D = void 0, r.AXES = r.GRID = r._DEFAULT_FILL = r._DEFAULT_STROKE = r.PORTRAIT = r.LANDSCAPE = r.MIRROR = r.CLAMP = r.REPEAT = r.NEAREST = r.IMAGE = r.IMMEDIATE = void 0;
      var i = Math.PI;
      r.P2D = "p2d";
      r.WEBGL = "webgl";
      r.ARROW = "default";
      r.CROSS = "crosshair";
      r.HAND = "pointer";
      r.MOVE = "move";
      r.TEXT = "text";
      r.WAIT = "wait";
      var a = i / 2;
      r.HALF_PI = a;
      var n = i;
      r.PI = n;
      var o = i / 4;
      r.QUARTER_PI = o;
      var s = 2 * i;
      r.TAU = s;
      var l = 2 * i;
      r.TWO_PI = l;
      r.DEGREES = "degrees";
      r.RADIANS = "radians";
      var u = i / 180;
      r.DEG_TO_RAD = u;
      var h = 180 / i;
      r.RAD_TO_DEG = h;
      r.CORNER = "corner";
      r.CORNERS = "corners";
      r.RADIUS = "radius";
      r.RIGHT = "right";
      r.LEFT = "left";
      r.CENTER = "center";
      r.TOP = "top";
      r.BOTTOM = "bottom";
      r.BASELINE = "alphabetic";
      r.POINTS = 0;
      r.LINES = 1;
      r.LINE_STRIP = 3;
      r.LINE_LOOP = 2;
      r.TRIANGLES = 4;
      r.TRIANGLE_FAN = 6;
      r.TRIANGLE_STRIP = 5;
      r.QUADS = "quads";
      r.QUAD_STRIP = "quad_strip";
      r.CLOSE = "close";
      r.OPEN = "open";
      r.CHORD = "chord";
      r.PIE = "pie";
      r.PROJECT = "square";
      r.SQUARE = "butt";
      r.ROUND = "round";
      r.BEVEL = "bevel";
      r.MITER = "miter";
      r.RGB = "rgb";
      r.HSB = "hsb";
      r.HSL = "hsl";
      r.AUTO = "auto";
      r.ALT = 18;
      r.BACKSPACE = 8;
      r.CONTROL = 17;
      r.DELETE = 46;
      r.DOWN_ARROW = 40;
      r.ENTER = 13;
      r.ESCAPE = 27;
      r.LEFT_ARROW = 37;
      r.OPTION = 18;
      r.RETURN = 13;
      r.RIGHT_ARROW = 39;
      r.SHIFT = 16;
      r.TAB = 9;
      r.UP_ARROW = 38;
      r.BLEND = "source-over";
      r.REMOVE = "destination-out";
      r.ADD = "lighter";
      r.DARKEST = "darken";
      r.LIGHTEST = "lighten";
      r.DIFFERENCE = "difference";
      r.SUBTRACT = "subtract";
      r.EXCLUSION = "exclusion";
      r.MULTIPLY = "multiply";
      r.SCREEN = "screen";
      r.REPLACE = "copy";
      r.OVERLAY = "overlay";
      r.HARD_LIGHT = "hard-light";
      r.SOFT_LIGHT = "soft-light";
      r.DODGE = "color-dodge";
      r.BURN = "color-burn";
      r.THRESHOLD = "threshold";
      r.GRAY = "gray";
      r.OPAQUE = "opaque";
      r.INVERT = "invert";
      r.POSTERIZE = "posterize";
      r.DILATE = "dilate";
      r.ERODE = "erode";
      r.BLUR = "blur";
      r.NORMAL = "normal";
      r.ITALIC = "italic";
      r.BOLD = "bold";
      r.BOLDITALIC = "bold italic";
      r._DEFAULT_TEXT_FILL = "#000000";
      r._DEFAULT_LEADMULT = 1.25;
      r._CTX_MIDDLE = "middle";
      r.LINEAR = "linear";
      r.QUADRATIC = "quadratic";
      r.BEZIER = "bezier";
      r.CURVE = "curve";
      r.STROKE = "stroke";
      r.FILL = "fill";
      r.TEXTURE = "texture";
      r.IMMEDIATE = "immediate";
      r.IMAGE = "image";
      r.NEAREST = "nearest";
      r.REPEAT = "repeat";
      r.CLAMP = "clamp";
      r.MIRROR = "mirror";
      r.LANDSCAPE = "landscape";
      r.PORTRAIT = "portrait";
      r._DEFAULT_STROKE = "#000000";
      r._DEFAULT_FILL = "#FFFFFF";
      r.GRID = "grid";
      r.AXES = "axes"
    }, {}],
    21: [function(e, t, r) {
      "use strict";
      Object.defineProperty(r, "__esModule", {
        value: !0
      }), r.default = void 0;
      var i, a = (i = e("./main")) && i.__esModule ? i : {
          default: i
        },
        n = function(e) {
          {
            if (e && e.__esModule) return e;
            var t = {};
            if (null != e)
              for (var r in e)
                if (Object.prototype.hasOwnProperty.call(e, r)) {
                  var i = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(e, r) : {};
                  i.get || i.set ? Object.defineProperty(t, r, i) : t[r] = e[r]
                } return t.default = e, t
          }
        }(e("./constants"));
      var o = [n.ARROW, n.CROSS, n.HAND, n.MOVE, n.TEXT, n.WAIT];
      a.default.prototype._frameRate = 0, a.default.prototype._lastFrameTime = window.performance.now(), a.default.prototype._targetFrameRate = 60;
      var s = window.print;

      function l() {
        return window.innerWidth || document.documentElement && document.documentElement.clientWidth || document.body && document.body.clientWidth || 0
      }

      function u() {
        return window.innerHeight || document.documentElement && document.documentElement.clientHeight || document.body && document.body.clientHeight || 0
      }
      a.default.prototype.print = function() {
        var e;
        arguments.length ? (e = console).log.apply(e, arguments) : s()
      }, a.default.prototype.frameCount = 0, a.default.prototype.deltaTime = 0, a.default.prototype.focused = document.hasFocus(), a.default.prototype.cursor = function(e, t, r) {
        var i = "auto",
          a = this._curElement.elt;
        if (o.includes(e)) i = e;
        else if ("string" == typeof e) {
          var n = "";
          t && r && "number" == typeof t && "number" == typeof r && (n = "".concat(t, " ").concat(r)), i = "http://" === e.substring(0, 7) || "https://" === e.substring(0, 8) ? "url(".concat(e, ") ").concat(n, ", auto") : /\.(cur|jpg|jpeg|gif|png|CUR|JPG|JPEG|GIF|PNG)$/.test(e) ? "url(".concat(e, ") ").concat(n, ", auto") : e
        }
        a.style.cursor = i
      }, a.default.prototype.frameRate = function(e) {
        return a.default._validateParameters("frameRate", arguments), "number" != typeof e || e < 0 ? this._frameRate : (this._setProperty("_targetFrameRate", e), 0 === e && this._setProperty("_frameRate", e), this)
      }, a.default.prototype.getFrameRate = function() {
        return this.frameRate()
      }, a.default.prototype.setFrameRate = function(e) {
        return this.frameRate(e)
      }, a.default.prototype.noCursor = function() {
        this._curElement.elt.style.cursor = "none"
      },
      a.default.prototype.displayWidth = 600, //screen.width
      a.default.prototype.displayHeight = 600, //screen.height
      a.default.prototype.windowWidth = l(), a.default.prototype.windowHeight = u(), a.default.prototype._onresize = function(e) {
        this._setProperty("windowWidth", l()), this._setProperty("windowHeight", u());
        var t, r = this._isGlobal ? window : this;
        "function" == typeof r.windowResized && (void 0 === (t = r.windowResized(e)) || t || e.preventDefault())
      }, a.default.prototype.width = 0, a.default.prototype.height = 0, a.default.prototype.fullscreen = function(e) {
        if (a.default._validateParameters("fullscreen", arguments), void 0 === e) return document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
        e ? function(e) {
          if (!(document.fullscreenEnabled || document.webkitFullscreenEnabled || document.mozFullScreenEnabled || document.msFullscreenEnabled)) throw new Error("Fullscreen not enabled in this browser.");
          e.requestFullscreen ? e.requestFullscreen() : e.mozRequestFullScreen ? e.mozRequestFullScreen() : e.webkitRequestFullscreen ? e.webkitRequestFullscreen() : e.msRequestFullscreen && e.msRequestFullscreen()
        }(document.documentElement) : document.exitFullscreen ? document.exitFullscreen() : document.mozCancelFullScreen ? document.mozCancelFullScreen() : document.webkitExitFullscreen ? document.webkitExitFullscreen() : document.msExitFullscreen && document.msExitFullscreen()
      }, a.default.prototype.pixelDensity = function(e) {
        var t;
        return a.default._validateParameters("pixelDensity", arguments), "number" == typeof e ? (e !== this._pixelDensity && (this._pixelDensity = e), (t = this).resizeCanvas(this.width, this.height, !0)) : t = this._pixelDensity, t
      }, a.default.prototype.displayDensity = function() {
        return window.devicePixelRatio
      }, a.default.prototype.getURL = function() {
        return location.href
      }, a.default.prototype.getURLPath = function() {
        return location.pathname.split("/").filter(function(e) {
          return "" !== e
        })
      }, a.default.prototype.getURLParams = function() {
        for (var e, t = /[?&]([^&=]+)(?:[&=])([^&=]+)/gim, r = {}; null != (e = t.exec(location.search));) e.index === t.lastIndex && t.lastIndex++, r[e[1]] = e[2];
        return r
      };
      var h = a.default;
      r.default = h
    }, {
      "./constants": 20,
      "./main": 26
    }],
    22: [function(a, e, t) {
      "use strict";
      Object.defineProperty(t, "__esModule", {
        value: !0
      }), t.default = void 0;
      var r, n = (r = a("./main")) && r.__esModule ? r : {
        default: r
      };
      ! function(e) {
        {
          if (e && e.__esModule) return;
          var t = {};
          if (null != e)
            for (var r in e)
              if (Object.prototype.hasOwnProperty.call(e, r)) {
                var i = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(e, r) : {};
                i.get || i.set ? Object.defineProperty(t, r, i) : t[r] = e[r]
              } t.default = e
        }
      }(a("./constants"));
      n.default._validateParameters = n.default._friendlyFileLoadError = n.default._friendlyError = function() {};
      var o = null,
        i = function(t, r) {
          var i, e;
          r || (r = console.log.bind(console)), o || (i = {}, (o = [].concat((e = function(r) {
            return Object.getOwnPropertyNames(r).filter(function(e) {
              return "_" !== e[0] && !(e in i) && (i[e] = !0)
            }).map(function(e) {
              var t;
              return t = "function" == typeof r[e] ? "function" : e === e.toUpperCase() ? "constant" : "variable", {
                name: e,
                type: t
              }
            })
          })(n.default.prototype), e(a("./constants")))).sort(function(e, t) {
            return t.name.length - e.name.length
          })), o.some(function(e) {
            if (t.message && null !== t.message.match("\\W?".concat(e.name, "\\W"))) return r("Did you just try to use p5.js's ".concat(e.name).concat("function" === e.type ? "() " : " ").concat(e.type, "? If so, you may want to move it into your sketch's setup() function.\n\nFor more details, see: ").concat("https://github.com/processing/p5.js/wiki/p5.js-overview#why-cant-i-assign-variables-using-p5-functions-and-variables-before-setup")), !0
          })
        };
      n.default.prototype._helpForMisusedAtTopLevelCode = i, "complete" !== document.readyState && (window.addEventListener("error", i, !1), window.addEventListener("load", function() {
        window.removeEventListener("error", i, !1)
      }));
      var s = n.default;
      t.default = s
    }, {
      "../../docs/reference/data.json": void 0,
      "./constants": 20,
      "./main": 26
    }],
    23: [function(e, t, r) {
      "use strict";
      Object.defineProperty(r, "__esModule", {
        value: !0
      }), r.default = void 0;
      var n = function(e) {
        {
          if (e && e.__esModule) return e;
          var t = {};
          if (null != e)
            for (var r in e)
              if (Object.prototype.hasOwnProperty.call(e, r)) {
                var i = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(e, r) : {};
                i.get || i.set ? Object.defineProperty(t, r, i) : t[r] = e[r]
              } return t.default = e, t
        }
      }(e("./constants"));
      var i = {
        modeAdjust: function(e, t, r, i, a) {
          return a === n.CORNER ? {
            x: e,
            y: t,
            w: r,
            h: i
          } : a === n.CORNERS ? {
            x: e,
            y: t,
            w: r - e,
            h: i - t
          } : a === n.RADIUS ? {
            x: e - r,
            y: t - i,
            w: 2 * r,
            h: 2 * i
          } : a === n.CENTER ? {
            x: e - .5 * r,
            y: t - .5 * i,
            w: r,
            h: i
          } : void 0
        }
      };
      r.default = i
    }, {
      "./constants": 20
    }],
    24: [function(e, t, r) {
      "use strict";
      var i, a = (i = e("../core/main")) && i.__esModule ? i : {
        default: i
      };
      var n = function() {
        window.mocha || (window.setup && "function" == typeof window.setup || window.draw && "function" == typeof window.draw) && !a.default.instance && new a.default
      };
      "complete" === document.readyState ? n() : window.addEventListener("load", n, !1)
    }, {
      "../core/main": 26
    }],
    25: [function(e, t, r) {
      "use strict";
      Object.defineProperty(r, "__esModule", {
        value: !0
      }), r.default = void 0;
      var i, a = (i = e("./main")) && i.__esModule ? i : {
        default: i
      };
      a.default.prototype.pushStyle = function() {
        throw new Error("pushStyle() not used, see push()")
      }, a.default.prototype.popStyle = function() {
        throw new Error("popStyle() not used, see pop()")
      }, a.default.prototype.popMatrix = function() {
        throw new Error("popMatrix() not used, see pop()")
      }, a.default.prototype.printMatrix = function() {
        throw new Error("printMatrix() is not implemented in p5.js, refer to [https://simonsarris.com/a-transformation-class-for-canvas-to-keep-track-of-the-transformation-matrix/] to add your own implementation.")
      }, a.default.prototype.pushMatrix = function() {
        throw new Error("pushMatrix() not used, see push()")
      };
      var n = a.default;
      r.default = n
    }, {
      "./main": 26
    }],
    26: [function(e, t, r) {
      "use strict";
      Object.defineProperty(r, "__esModule", {
        value: !0
      }), r.default = void 0, e("./shim");
      var i = function(e) {
        {
          if (e && e.__esModule) return e;
          var t = {};
          if (null != e)
            for (var r in e)
              if (Object.prototype.hasOwnProperty.call(e, r)) {
                var i = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(e, r) : {};
                i.get || i.set ? Object.defineProperty(t, r, i) : t[r] = e[r]
              } return t.default = e, t
        }
      }(e("./constants"));

      function a(e, t) {
        for (var r = 0; r < t.length; r++) {
          var i = t[r];
          i.enumerable = i.enumerable || !1, i.configurable = !0, "value" in i && (i.writable = !0), Object.defineProperty(e, i.key, i)
        }
      }
      var n = function() {
        function b(e, t, r) {
          var c = this;
          ! function(e, t) {
            if (!(e instanceof t)) throw new TypeError("Cannot call a class as a function")
          }(this, b), this._setupDone = !1, this._pixelDensity = Math.ceil(window.devicePixelRatio) || 1, this._userNode = t, this._curElement = null, this._elements = [], this._glAttributes = null, this._requestAnimId = 0, this._preloadCount = 0, this._isGlobal = !1, this._loop = !0, this._initializeInstanceVariables(), this._defaultCanvasSize = {
            width: 100,
            height: 100
          }, this._events = {
            mousemove: null,
            mousedown: null,
            mouseup: null,
            dragend: null,
            dragover: null,
            click: null,
            dblclick: null,
            mouseover: null,
            mouseout: null,
            keydown: null,
            keyup: null,
            keypress: null,
            touchstart: null,
            touchmove: null,
            touchend: null,
            resize: null,
            blur: null
          }, this._lcg_random_state = null, this._gaussian_previous = !1, this._events.wheel = null, this._loadingScreenId = "p5_loading", this._registeredMethods = {};
          var i = Object.getOwnPropertyNames(b.prototype._registeredMethods),
            a = !0,
            n = !1,
            o = void 0;
          try {
            for (var s, l = i[Symbol.iterator](); !(a = (s = l.next()).done); a = !0) {
              var u = s.value;
              this._registeredMethods[u] = b.prototype._registeredMethods[u].slice()
            }
          } catch (e) {
            n = !0, o = e
          } finally {
            try {
              a || null == l.return || l.return()
            } finally {
              if (n) throw o
            }
          }
          window.DeviceOrientationEvent && (this._events.deviceorientation = null), window.DeviceMotionEvent && !window._isNodeWebkit && (this._events.devicemotion = null), this._start = function() {
            c._userNode && "string" == typeof c._userNode && (c._userNode = document.getElementById(c._userNode));
            var e = (c._isGlobal ? window : c).preload;
            if (e) {
              var t = document.getElementById(c._loadingScreenId);
              if (!t)(t = document.createElement("div")).innerHTML = "Loading...", t.style.position = "absolute", t.id = c._loadingScreenId, (c._userNode || document.body).appendChild(t);
              var r = c._preloadMethods;
              for (var i in r) {
                r[i] = r[i] || b;
                var a = r[i];
                a !== b.prototype && a !== b || (c._isGlobal && (window[i] = c._wrapPreload(c, i)), a = c), c._registeredPreloadMethods[i] = a[i], a[i] = c._wrapPreload(a, i)
              }
              e(), c._runIfPreloadsAreDone()
            } else c._setup(), c._draw()
          }, this._runIfPreloadsAreDone = function() {
            var e = this._isGlobal ? window : this;
            if (0 === e._preloadCount) {
              var t = document.getElementById(e._loadingScreenId);
              t && t.parentNode.removeChild(t), this._lastFrameTime = window.performance.now(), e._setup(), e._draw()
            }
          }, this._decrementPreload = function() {
            var e = this._isGlobal ? window : this;
            "function" == typeof e.preload && (e._setProperty("_preloadCount", e._preloadCount - 1), e._runIfPreloadsAreDone())
          }, this._wrapPreload = function(i, a) {
            var n = this;
            return function() {
              n._incrementPreload();
              for (var e = arguments.length, t = new Array(e), r = 0; r < e; r++) t[r] = arguments[r];
              return n._registeredPreloadMethods[a].apply(i, t)
            }
          }, this._incrementPreload = function() {
            var e = this._isGlobal ? window : this;
            e._setProperty("_preloadCount", e._preloadCount + 1)
          }, this._setup = function() {
            c.createCanvas(c._defaultCanvasSize.width, c._defaultCanvasSize.height, "p2d");
            var e = c._isGlobal ? window : c;
            if ("function" == typeof e.preload)
              for (var t in c._preloadMethods) e[t] = c._preloadMethods[t][t], e[t] && c && (e[t] = e[t].bind(c));
            "function" == typeof e.setup && e.setup();
            var r = document.getElementsByTagName("canvas"),
              i = !0,
              a = !1,
              n = void 0;
            try {
              for (var o, s = r[Symbol.iterator](); !(i = (o = s.next()).done); i = !0) {
                var l = o.value;
                "true" === l.dataset.hidden && (l.style.visibility = "", delete l.dataset.hidden)
              }
            } catch (e) {
              a = !0, n = e
            } finally {
              try {
                i || null == s.return || s.return()
              } finally {
                if (a) throw n
              }
            }
            c._lastFrameTime = window.performance.now(), c._setupDone = !0
          }, this._draw = function() {
            var e = window.performance.now(),
              t = e - c._lastFrameTime,
              r = 1e3 / c._targetFrameRate;
            (!c._loop || r - 5 <= t) && (c.redraw(), c._frameRate = 1e3 / (e - c._lastFrameTime), c.deltaTime = e - c._lastFrameTime, c._setProperty("deltaTime", c.deltaTime), c._lastFrameTime = e, void 0 !== c._updateMouseCoords && (c._updateMouseCoords(), c._setProperty("movedX", 0), c._setProperty("movedY", 0))), c._loop && (c._requestAnimId = window.requestAnimationFrame(c._draw))
          }, this._setProperty = function(e, t) {
            c[e] = t, c._isGlobal && (window[e] = t)
          }, this.remove = function() {
            var e = document.getElementById(c._loadingScreenId);
            if (e && (e.parentNode.removeChild(e), c._incrementPreload()), c._curElement) {
              for (var t in c._loop = !1, c._requestAnimId && window.cancelAnimationFrame(c._requestAnimId), c._events) window.removeEventListener(t, c._events[t]);
              var r = !0,
                i = !1,
                a = void 0;
              try {
                for (var n, o = c._elements[Symbol.iterator](); !(r = (n = o.next()).done); r = !0) {
                  var s = n.value;
                  for (var l in s.elt && s.elt.parentNode && s.elt.parentNode.removeChild(s.elt), s._events) s.elt.removeEventListener(l, s._events[l])
                }
              } catch (e) {
                i = !0, a = e
              } finally {
                try {
                  r || null == o.return || o.return()
                } finally {
                  if (i) throw a
                }
              }
              var u = c;
              c._registeredMethods.remove.forEach(function(e) {
                void 0 !== e && e.call(u)
              })
            }
            if (c._isGlobal) {
              for (var h in b.prototype) try {
                delete window[h]
              } catch (e) {
                window[h] = void 0
              }
              for (var d in c)
                if (c.hasOwnProperty(d)) try {
                  delete window[d]
                } catch (e) {
                  window[d] = void 0
                }
              b.instance = null
            }
          }, this._registeredMethods.init.forEach(function(e) {
            void 0 !== e && e.call(this)
          }, this), this._setupPromisePreloads();
          var h = this._createFriendlyGlobalFunctionBinder();
          if (e) e(this);
          else {
            for (var d in this._isGlobal = !0, b.instance = this, b.prototype)
              if ("function" == typeof b.prototype[d]) {
                var f = d.substring(2);
                this._events.hasOwnProperty(f) || (Math.hasOwnProperty(d) && Math[d] === b.prototype[d] ? h(d, b.prototype[d]) : h(d, b.prototype[d].bind(this)))
              } else h(d, b.prototype[d]);
            for (var p in this) this.hasOwnProperty(p) && h(p, this[p])
          }
          for (var m in this._events) {
            var v = this["_on".concat(m)];
            if (v) {
              var g = v.bind(this);
              window.addEventListener(m, g, {
                passive: !1
              }), this._events[m] = g
            }
          }
          var y = function() {
              c._setProperty("focused", !0)
            },
            _ = function() {
              c._setProperty("focused", !1)
            };
          window.addEventListener("focus", y), window.addEventListener("blur", _), this.registerMethod("remove", function() {
            window.removeEventListener("focus", y), window.removeEventListener("blur", _)
          }), "complete" === document.readyState ? this._start() : window.addEventListener("load", this._start.bind(this), !1)
        }
        var e, t, r;
        return e = b, (t = [{
          key: "_initializeInstanceVariables",
          value: function() {
            this._styles = [], this._bezierDetail = 20, this._curveDetail = 20, this._colorMode = i.RGB, this._colorMaxes = {
              rgb: [255, 255, 255, 255],
              hsb: [360, 100, 100, 1],
              hsl: [360, 100, 100, 1]
            }, this._downKeys = {}
          }
        }, {
          key: "registerPreloadMethod",
          value: function(e, t) {
            b.prototype._preloadMethods.hasOwnProperty(e) || (b.prototype._preloadMethods[e] = t)
          }
        }, {
          key: "registerMethod",
          value: function(e, t) {
            var r = this || b.prototype;
            r._registeredMethods.hasOwnProperty(e) || (r._registeredMethods[e] = []), r._registeredMethods[e].push(t)
          }
        }, {
          key: "_createFriendlyGlobalFunctionBinder",
          value: function() {
            var e = 0 < arguments.length && void 0 !== arguments[0] ? arguments[0] : {},
              r = e.globalObject || window;
            e.log || console.log.bind(console);
            return function(e, t) {
              r[e] = t
            }
          }
        }]) && a(e.prototype, t), r && a(e, r), b
      }();
      for (var o in n.instance = null, n.disableFriendlyErrors = !1, i) n.prototype[o] = i[o];
      n.prototype._preloadMethods = {
        loadJSON: n.prototype,
        loadImage: n.prototype,
        loadStrings: n.prototype,
        loadXML: n.prototype,
        loadBytes: n.prototype,
        loadTable: n.prototype,
        loadFont: n.prototype,
        loadModel: n.prototype,
        loadShader: n.prototype
      }, n.prototype._registeredMethods = {
        init: [],
        pre: [],
        post: [],
        remove: []
      }, n.prototype._registeredPreloadMethods = {};
      var s = n;
      r.default = s
    }, {
      "./constants": 20,
      "./shim": 37
    }],
    27: [function(e, t, r) {
      "use strict";
      Object.defineProperty(r, "__esModule", {
        value: !0
      }), r.default = void 0;
      var i, a = (i = e("./main")) && i.__esModule ? i : {
        default: i
      };
      a.default.Element = function(e, t) {
        this.elt = e, this._pInst = this._pixelsState = t, this._events = {}, this.width = this.elt.offsetWidth, this.height = this.elt.offsetHeight
      }, a.default.Element.prototype.parent = function(e) {
        return void 0 === e ? this.elt.parentNode : ("string" == typeof e ? ("#" === e[0] && (e = e.substring(1)), e = document.getElementById(e)) : e instanceof a.default.Element && (e = e.elt), e.appendChild(this.elt), this)
      }, a.default.Element.prototype.id = function(e) {
        return void 0 === e ? this.elt.id : (this.elt.id = e, this.width = this.elt.offsetWidth, this.height = this.elt.offsetHeight, this)
      }, a.default.Element.prototype.class = function(e) {
        return void 0 === e ? this.elt.className : (this.elt.className = e, this)
      }, a.default.Element.prototype.mousePressed = function(t) {
        return a.default.Element._adjustListener("mousedown", function(e) {
          return this._pInst._setProperty("mouseIsPressed", !0), this._pInst._setMouseButton(e), t.call(this)
        }, this), this
      }, a.default.Element.prototype.doubleClicked = function(e) {
        return a.default.Element._adjustListener("dblclick", e, this), this
      }, a.default.Element.prototype.mouseWheel = function(e) {
        return a.default.Element._adjustListener("wheel", e, this), this
      }, a.default.Element.prototype.mouseReleased = function(e) {
        return a.default.Element._adjustListener("mouseup", e, this), this
      }, a.default.Element.prototype.mouseClicked = function(e) {
        return a.default.Element._adjustListener("click", e, this), this
      }, a.default.Element.prototype.mouseMoved = function(e) {
        return a.default.Element._adjustListener("mousemove", e, this), this
      }, a.default.Element.prototype.mouseOver = function(e) {
        return a.default.Element._adjustListener("mouseover", e, this), this
      }, a.default.Element.prototype.mouseOut = function(e) {
        return a.default.Element._adjustListener("mouseout", e, this), this
      }, a.default.Element.prototype.touchStarted = function(e) {
        return a.default.Element._adjustListener("touchstart", e, this), this
      }, a.default.Element.prototype.touchMoved = function(e) {
        return a.default.Element._adjustListener("touchmove", e, this), this
      }, a.default.Element.prototype.touchEnded = function(e) {
        return a.default.Element._adjustListener("touchend", e, this), this
      }, a.default.Element.prototype.dragOver = function(e) {
        return a.default.Element._adjustListener("dragover", e, this), this
      }, a.default.Element.prototype.dragLeave = function(e) {
        return a.default.Element._adjustListener("dragleave", e, this), this
      }, a.default.Element._adjustListener = function(e, t, r) {
        return !1 === t ? a.default.Element._detachListener(e, r) : a.default.Element._attachListener(e, t, r), this
      }, a.default.Element._attachListener = function(e, t, r) {
        r._events[e] && a.default.Element._detachListener(e, r);
        var i = t.bind(r);
        r.elt.addEventListener(e, i, !1), r._events[e] = i
      }, a.default.Element._detachListener = function(e, t) {
        var r = t._events[e];
        t.elt.removeEventListener(e, r, !1), t._events[e] = null
      }, a.default.Element.prototype._setProperty = function(e, t) {
        this[e] = t
      };
      var n = a.default.Element;
      r.default = n
    }, {
      "./main": 26
    }],
    28: [function(e, t, r) {
      "use strict";
      Object.defineProperty(r, "__esModule", {
        value: !0
      }), r.default = void 0;
      var i, s = (i = e("./main")) && i.__esModule ? i : {
          default: i
        },
        l = function(e) {
          {
            if (e && e.__esModule) return e;
            var t = {};
            if (null != e)
              for (var r in e)
                if (Object.prototype.hasOwnProperty.call(e, r)) {
                  var i = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(e, r) : {};
                  i.get || i.set ? Object.defineProperty(t, r, i) : t[r] = e[r]
                } return t.default = e, t
          }
        }(e("./constants"));
      s.default.Graphics = function(e, t, r, i) {
        var a = r || l.P2D;
        this.canvas = document.createElement("canvas");
        var n = i._userNode || document.body;
        for (var o in n.appendChild(this.canvas), s.default.Element.call(this, this.canvas, i), s.default.prototype) this[o] || ("function" == typeof s.default.prototype[o] ? this[o] = s.default.prototype[o].bind(this) : this[o] = s.default.prototype[o]);
        return s.default.prototype._initializeInstanceVariables.apply(this), this.width = e, this.height = t, this._pixelDensity = i._pixelDensity, a === l.WEBGL ? this._renderer = new s.default.RendererGL(this.canvas, this, !1) : this._renderer = new s.default.Renderer2D(this.canvas, this, !1), i._elements.push(this), this._renderer.resize(e, t), this._renderer._applyDefaults(), this
      }, s.default.Graphics.prototype = Object.create(s.default.Element.prototype), s.default.Graphics.prototype.reset = function() {
        this._renderer.resetMatrix(), this._renderer.isP3D && this._renderer._update()
      }, s.default.Graphics.prototype.remove = function() {
        this.elt.parentNode && this.elt.parentNode.removeChild(this.elt);
        var e = this._pInst._elements.indexOf(this);
        for (var t in -1 !== e && this._pInst._elements.splice(e, 1), this._events) this.elt.removeEventListener(t, this._events[t])
      };
      var a = s.default.Graphics;
      r.default = a
    }, {
      "./constants": 20,
      "./main": 26
    }],
    29: [function(e, t, r) {
      "use strict";
      Object.defineProperty(r, "__esModule", {
        value: !0
      }), r.default = void 0;
      var i, l = (i = e("./main")) && i.__esModule ? i : {
          default: i
        },
        y = function(e) {
          {
            if (e && e.__esModule) return e;
            var t = {};
            if (null != e)
              for (var r in e)
                if (Object.prototype.hasOwnProperty.call(e, r)) {
                  var i = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(e, r) : {};
                  i.get || i.set ? Object.defineProperty(t, r, i) : t[r] = e[r]
                } return t.default = e, t
          }
        }(e("../core/constants"));

      function a(e) {
        return (a = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
          return typeof e
        } : function(e) {
          return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        })(e)
      }

      function s(e) {
        var t = 0,
          r = 0;
        if (e.offsetParent)
          for (; t += e.offsetLeft, r += e.offsetTop, e = e.offsetParent;);
        else t += e.offsetLeft, r += e.offsetTop;
        return [t, r]
      }
      l.default.Renderer = function(e, t, r) {
        l.default.Element.call(this, e, t), this.canvas = e, this._pixelsState = t, r ? (this._isMainCanvas = !0, this._pInst._setProperty("_curElement", this), this._pInst._setProperty("canvas", this.canvas), this._pInst._setProperty("width", this.width), this._pInst._setProperty("height", this.height)) : (this.canvas.style.display = "none", this._styles = []), this._textSize = 12, this._textLeading = 15, this._textFont = "sans-serif", this._textStyle = y.NORMAL, this._textAscent = null, this._textDescent = null, this._textAlign = y.LEFT, this._textBaseline = y.BASELINE, this._rectMode = y.CORNER, this._ellipseMode = y.CENTER, this._curveTightness = 0, this._imageMode = y.CORNER, this._tint = null, this._doStroke = !0, this._doFill = !0, this._strokeSet = !1, this._fillSet = !1
      }, l.default.Renderer.prototype = Object.create(l.default.Element.prototype), l.default.Renderer.prototype.push = function() {
        return {
          properties: {
            _doStroke: this._doStroke,
            _strokeSet: this._strokeSet,
            _doFill: this._doFill,
            _fillSet: this._fillSet,
            _tint: this._tint,
            _imageMode: this._imageMode,
            _rectMode: this._rectMode,
            _ellipseMode: this._ellipseMode,
            _textFont: this._textFont,
            _textLeading: this._textLeading,
            _textSize: this._textSize,
            _textAlign: this._textAlign,
            _textBaseline: this._textBaseline,
            _textStyle: this._textStyle
          }
        }
      }, l.default.Renderer.prototype.pop = function(e) {
        e.properties && Object.assign(this, e.properties)
      }, l.default.Renderer.prototype.resize = function(e, t) {
        this.width = e, this.height = t, this.elt.width = e * this._pInst._pixelDensity, this.elt.height = t * this._pInst._pixelDensity, this.elt.style.width = "".concat(e, "px"), this.elt.style.height = "".concat(t, "px"), this._isMainCanvas && (this._pInst._setProperty("width", this.width), this._pInst._setProperty("height", this.height))
      }, l.default.Renderer.prototype.get = function(e, t, r, i) {
        var a = this._pixelsState,
          n = a._pixelDensity,
          o = this.canvas;
        if (void 0 === e && void 0 === t) e = t = 0, r = a.width, i = a.height;
        else if (e *= n, t *= n, void 0 === r && void 0 === i) return e < 0 || t < 0 || e >= o.width || t >= o.height ? [0, 0, 0, 0] : this._getPixel(e, t);
        var s = new l.default.Image(r, i);
        return s.canvas.getContext("2d").drawImage(o, e, t, r * n, i * n, 0, 0, r, i), s
      }, l.default.Renderer.prototype.textLeading = function(e) {
        return "number" == typeof e ? (this._setProperty("_textLeading", e), this._pInst) : this._textLeading
      }, l.default.Renderer.prototype.textSize = function(e) {
        return "number" == typeof e ? (this._setProperty("_textSize", e), this._setProperty("_textLeading", e * y._DEFAULT_LEADMULT), this._applyTextProperties()) : this._textSize
      }, l.default.Renderer.prototype.textStyle = function(e) {
        return e ? (e !== y.NORMAL && e !== y.ITALIC && e !== y.BOLD && e !== y.BOLDITALIC || this._setProperty("_textStyle", e), this._applyTextProperties()) : this._textStyle
      }, l.default.Renderer.prototype.textAscent = function() {
        return null === this._textAscent && this._updateTextMetrics(), this._textAscent
      }, l.default.Renderer.prototype.textDescent = function() {
        return null === this._textDescent && this._updateTextMetrics(), this._textDescent
      }, l.default.Renderer.prototype.textAlign = function(e, t) {
        return void 0 !== e ? (this._setProperty("_textAlign", e), void 0 !== t && this._setProperty("_textBaseline", t), this._applyTextProperties()) : {
          horizontal: this._textAlign,
          vertical: this._textBaseline
        }
      }, l.default.Renderer.prototype.text = function(e, t, r, i, a) {
        var n, o, s, l, u, h, d, c, f = this._pInst,
          p = Number.MAX_VALUE;
        if ((this._doFill || this._doStroke) && void 0 !== e) {
          if ("string" != typeof e && (e = e.toString()), n = (e = e.replace(/(\t)/g, "  ")).split("\n"), void 0 !== i) {
            for (s = c = 0; s < n.length; s++)
              for (u = "", d = n[s].split(" "), o = 0; o < d.length; o++) h = "".concat(u + d[o], " "), i < this.textWidth(h) ? (u = "".concat(d[o], " "), c += f.textLeading()) : u = h;
            switch (this._rectMode === y.CENTER && (t -= i / 2, r -= a / 2), this._textAlign) {
              case y.CENTER:
                t += i / 2;
                break;
              case y.RIGHT:
                t += i
            }
            var m = !1;
            if (void 0 !== a) {
              switch (this._textBaseline) {
                case y.BOTTOM:
                  r += a - c;
                  break;
                case y.CENTER:
                  r += (a - c) / 2;
                  break;
                case y.BASELINE:
                  m = !0, this._textBaseline = y.TOP
              }
              p = r + a - f.textAscent()
            }
            for (s = 0; s < n.length; s++) {
              for (u = "", d = n[s].split(" "), o = 0; o < d.length; o++) h = "".concat(u + d[o], " "), i < this.textWidth(h) && 0 < u.length ? (this._renderText(f, u, t, r, p), u = "".concat(d[o], " "), r += f.textLeading()) : u = h;
              this._renderText(f, u, t, r, p), r += f.textLeading(), m && (this._textBaseline = y.BASELINE)
            }
          } else {
            var v = 0,
              g = f.textAlign().vertical;
            for (g === y.CENTER ? v = (n.length - 1) * f.textLeading() / 2 : g === y.BOTTOM && (v = (n.length - 1) * f.textLeading()), l = 0; l < n.length; l++) this._renderText(f, n[l], t, r - v, p), r += f.textLeading()
          }
          return f
        }
      }, l.default.Renderer.prototype._applyDefaults = function() {
        return this
      }, l.default.Renderer.prototype._isOpenType = function() {
        var e = 0 < arguments.length && void 0 !== arguments[0] ? arguments[0] : this._textFont;
        return "object" === a(e) && e.font && e.font.supported
      }, l.default.Renderer.prototype._updateTextMetrics = function() {
        if (this._isOpenType()) return this._setProperty("_textAscent", this._textFont._textAscent()), this._setProperty("_textDescent", this._textFont._textDescent()), this;
        var e = document.createElement("span");
        e.style.fontFamily = this._textFont, e.style.fontSize = "".concat(this._textSize, "px"), e.innerHTML = "ABCjgq|";
        var t = document.createElement("div");
        t.style.display = "inline-block", t.style.width = "1px", t.style.height = "0px";
        var r = document.createElement("div");
        r.appendChild(e), r.appendChild(t), r.style.height = "0px", r.style.overflow = "hidden", document.body.appendChild(r), t.style.verticalAlign = "baseline";
        var i = s(t),
          a = s(e),
          n = i[1] - a[1];
        t.style.verticalAlign = "bottom", i = s(t), a = s(e);
        var o = i[1] - a[1] - n;
        return document.body.removeChild(r), this._setProperty("_textAscent", n), this._setProperty("_textDescent", o), this
      };
      var n = l.default.Renderer;
      r.default = n
    }, {
      "../core/constants": 20,
      "./main": 26
    }],
    30: [function(e, t, r) {
      "use strict";
      Object.defineProperty(r, "__esModule", {
        value: !0
      }), r.default = void 0;
      var d = i(e("./main")),
        p = function(e) {
          {
            if (e && e.__esModule) return e;
            var t = {};
            if (null != e)
              for (var r in e)
                if (Object.prototype.hasOwnProperty.call(e, r)) {
                  var i = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(e, r) : {};
                  i.get || i.set ? Object.defineProperty(t, r, i) : t[r] = e[r]
                } return t.default = e, t
          }
        }(e("./constants")),
        c = i(e("../image/filters"));

      function i(e) {
        return e && e.__esModule ? e : {
          default: e
        }
      }
      e("./p5.Renderer");
      var v = "rgba(0,0,0,0)";
      d.default.Renderer2D = function(e, t, r) {
        return d.default.Renderer.call(this, e, t, r), this.drawingContext = this.canvas.getContext("2d"), this._pInst._setProperty("drawingContext", this.drawingContext), this
      }, d.default.Renderer2D.prototype = Object.create(d.default.Renderer.prototype), d.default.Renderer2D.prototype._applyDefaults = function() {
        this._cachedFillStyle = this._cachedStrokeStyle = void 0, this._cachedBlendMode = p.BLEND, this._setFill(p._DEFAULT_FILL), this._setStroke(p._DEFAULT_STROKE), this.drawingContext.lineCap = p.ROUND, this.drawingContext.font = "normal 12px sans-serif"
      }, d.default.Renderer2D.prototype.resize = function(e, t) {
        d.default.Renderer.prototype.resize.call(this, e, t), this.drawingContext.scale(this._pInst._pixelDensity, this._pInst._pixelDensity)
      }, d.default.Renderer2D.prototype.background = function() {
        if (this.drawingContext.save(), this.resetMatrix(), (arguments.length <= 0 ? void 0 : arguments[0]) instanceof d.default.Image) this._pInst.image(arguments.length <= 0 ? void 0 : arguments[0], 0, 0, this.width, this.height);
        else {
          var e, t = this._getFill(),
            r = (e = this._pInst).color.apply(e, arguments).toString();
          this._setFill(r), this._isErasing && this.blendMode(this._cachedBlendMode), this.drawingContext.fillRect(0, 0, this.width, this.height), this._setFill(t), this._isErasing && this._pInst.erase()
        }
        this.drawingContext.restore()
      }, d.default.Renderer2D.prototype.clear = function() {
        this.drawingContext.save(), this.resetMatrix(), this.drawingContext.clearRect(0, 0, this.width, this.height), this.drawingContext.restore()
      }, d.default.Renderer2D.prototype.fill = function() {
        var e, t = (e = this._pInst).color.apply(e, arguments);
        this._setFill(t.toString())
      }, d.default.Renderer2D.prototype.stroke = function() {
        var e, t = (e = this._pInst).color.apply(e, arguments);
        this._setStroke(t.toString())
      }, d.default.Renderer2D.prototype.erase = function(e, t) {
        if (!this._isErasing) {
          this._cachedFillStyle = this.drawingContext.fillStyle;
          var r = this._pInst.color(255, e).toString();
          this.drawingContext.fillStyle = r, this._cachedStrokeStyle = this.drawingContext.strokeStyle;
          var i = this._pInst.color(255, t).toString();
          this.drawingContext.strokeStyle = i;
          var a = this._cachedBlendMode;
          this.blendMode(p.REMOVE), this._cachedBlendMode = a, this._isErasing = !0
        }
      }, d.default.Renderer2D.prototype.noErase = function() {
        this._isErasing && (this.drawingContext.fillStyle = this._cachedFillStyle, this.drawingContext.strokeStyle = this._cachedStrokeStyle, this.blendMode(this._cachedBlendMode), this._isErasing = !1)
      }, d.default.Renderer2D.prototype.image = function(e, t, r, i, a, n, o, s, l) {
        var u;
        e.gifProperties && e._animateGif(this._pInst);
        try {
          this._tint && (d.default.MediaElement && e instanceof d.default.MediaElement && e.loadPixels(), e.canvas && (u = this._getTintedImageCanvas(e))), u || (u = e.canvas || e.elt);
          var h = 1;
          e.width && 0 < e.width && (h = u.width / e.width), this._isErasing && this.blendMode(this._cachedBlendMode), this.drawingContext.drawImage(u, h * t, h * r, h * i, h * a, n, o, s, l), this._isErasing && this._pInst.erase()
        } catch (e) {
          if ("NS_ERROR_NOT_AVAILABLE" !== e.name) throw e
        }
      }, d.default.Renderer2D.prototype._getTintedImageCanvas = function(e) {
        if (!e.canvas) return e;
        var t = c.default._toPixels(e.canvas),
          r = document.createElement("canvas");
        r.width = e.canvas.width, r.height = e.canvas.height;
        for (var i = r.getContext("2d"), a = i.createImageData(e.canvas.width, e.canvas.height), n = a.data, o = 0; o < t.length; o += 4) {
          var s = t[o],
            l = t[o + 1],
            u = t[o + 2],
            h = t[o + 3];
          n[o] = s * this._tint[0] / 255, n[o + 1] = l * this._tint[1] / 255, n[o + 2] = u * this._tint[2] / 255, n[o + 3] = h * this._tint[3] / 255
        }
        return i.putImageData(a, 0, 0), r
      }, d.default.Renderer2D.prototype.blendMode = function(e) {
        if (e === p.SUBTRACT) console.warn("blendMode(SUBTRACT) only works in WEBGL mode.");
        else {
          if (e !== p.BLEND && e !== p.REMOVE && e !== p.DARKEST && e !== p.LIGHTEST && e !== p.DIFFERENCE && e !== p.MULTIPLY && e !== p.EXCLUSION && e !== p.SCREEN && e !== p.REPLACE && e !== p.OVERLAY && e !== p.HARD_LIGHT && e !== p.SOFT_LIGHT && e !== p.DODGE && e !== p.BURN && e !== p.ADD) throw new Error("Mode ".concat(e, " not recognized."));
          this._cachedBlendMode = e, this.drawingContext.globalCompositeOperation = e
        }
      }, d.default.Renderer2D.prototype.blend = function() {
        for (var e = this.drawingContext.globalCompositeOperation, t = arguments.length, r = new Array(t), i = 0; i < t; i++) r[i] = arguments[i];
        var a = r[r.length - 1],
          n = Array.prototype.slice.call(r, 0, r.length - 1);
        this.drawingContext.globalCompositeOperation = a, d.default.prototype.copy.apply(this, n), this.drawingContext.globalCompositeOperation = e
      }, d.default.Renderer2D.prototype._getPixel = function(e, t) {
        var r;
        return [(r = this.drawingContext.getImageData(e, t, 1, 1).data)[0], r[1], r[2], r[3]]
      }, d.default.Renderer2D.prototype.loadPixels = function() {
        var e = this._pixelsState,
          t = e._pixelDensity,
          r = this.width * t,
          i = this.height * t,
          a = this.drawingContext.getImageData(0, 0, r, i);
        e._setProperty("imageData", a), e._setProperty("pixels", a.data)
      }, d.default.Renderer2D.prototype.set = function(e, t, r) {
        e = Math.floor(e), t = Math.floor(t);
        var i = this._pixelsState;
        if (r instanceof d.default.Image) this.drawingContext.save(), this.drawingContext.setTransform(1, 0, 0, 1, 0, 0), this.drawingContext.scale(i._pixelDensity, i._pixelDensity), this.drawingContext.drawImage(r.canvas, e, t), this.drawingContext.restore();
        else {
          var a = 0,
            n = 0,
            o = 0,
            s = 0,
            l = 4 * (t * i._pixelDensity * (this.width * i._pixelDensity) + e * i._pixelDensity);
          if (i.imageData || i.loadPixels.call(i), "number" == typeof r) l < i.pixels.length && (o = n = a = r, s = 255);
          else if (r instanceof Array) {
            if (r.length < 4) throw new Error("pixel array must be of the form [R, G, B, A]");
            l < i.pixels.length && (a = r[0], n = r[1], o = r[2], s = r[3])
          } else r instanceof d.default.Color && l < i.pixels.length && (a = r.levels[0], n = r.levels[1], o = r.levels[2], s = r.levels[3]);
          for (var u = 0; u < i._pixelDensity; u++)
            for (var h = 0; h < i._pixelDensity; h++) l = 4 * ((t * i._pixelDensity + h) * this.width * i._pixelDensity + (e * i._pixelDensity + u)), i.pixels[l] = a, i.pixels[l + 1] = n, i.pixels[l + 2] = o, i.pixels[l + 3] = s
        }
      }, d.default.Renderer2D.prototype.updatePixels = function(e, t, r, i) {
        var a = this._pixelsState,
          n = a._pixelDensity;
        void 0 === e && void 0 === t && void 0 === r && void 0 === i && (t = e = 0, r = this.width, i = this.height), e *= n, t *= n, r *= n, i *= n, this.gifProperties && (this.gifProperties.frames[this.gifProperties.displayIndex] = a.imageData), this.drawingContext.putImageData(a.imageData, e, t, 0, 0, r, i)
      }, d.default.Renderer2D.prototype._acuteArcToBezier = function(e, t) {
        var r = t / 2,
          i = Math.cos(r),
          a = Math.sin(r),
          n = 1 / Math.tan(r),
          o = e + r,
          s = Math.cos(o),
          l = Math.sin(o),
          u = (4 - i) / 3,
          h = a + (i - u) * n;
        return {
          ax: Math.cos(e).toFixed(7),
          ay: Math.sin(e).toFixed(7),
          bx: (u * s + h * l).toFixed(7),
          by: (u * l - h * s).toFixed(7),
          cx: (u * s - h * l).toFixed(7),
          cy: (u * l + h * s).toFixed(7),
          dx: Math.cos(e + t).toFixed(7),
          dy: Math.sin(e + t).toFixed(7)
        }
      }, d.default.Renderer2D.prototype.arc = function(r, i, e, t, a, n, o) {
        var s = this.drawingContext,
          l = e / 2,
          u = t / 2,
          h = 0,
          d = [];
        for (r += l, i += u; 1e-5 <= n - a;) h = Math.min(n - a, p.HALF_PI), d.push(this._acuteArcToBezier(a, h)), a += h;
        return this._doFill && (s.beginPath(), d.forEach(function(e, t) {
          0 === t && s.moveTo(r + e.ax * l, i + e.ay * u), s.bezierCurveTo(r + e.bx * l, i + e.by * u, r + e.cx * l, i + e.cy * u, r + e.dx * l, i + e.dy * u)
        }), o !== p.PIE && null != o || s.lineTo(r, i), s.closePath(), s.fill()), this._doStroke && (s.beginPath(), d.forEach(function(e, t) {
          0 === t && s.moveTo(r + e.ax * l, i + e.ay * u), s.bezierCurveTo(r + e.bx * l, i + e.by * u, r + e.cx * l, i + e.cy * u, r + e.dx * l, i + e.dy * u)
        }), o === p.PIE ? (s.lineTo(r, i), s.closePath()) : o === p.CHORD && s.closePath(), s.stroke()), this
      }, d.default.Renderer2D.prototype.ellipse = function(e) {
        var t = this.drawingContext,
          r = this._doFill,
          i = this._doStroke,
          a = parseFloat(e[0]),
          n = parseFloat(e[1]),
          o = parseFloat(e[2]),
          s = parseFloat(e[3]);
        if (r && !i) {
          if (this._getFill() === v) return this
        } else if (!r && i && this._getStroke() === v) return this;
        var l = o / 2 * .5522847498,
          u = s / 2 * .5522847498,
          h = a + o,
          d = n + s,
          c = a + o / 2,
          f = n + s / 2;
        t.beginPath(), t.moveTo(a, f), t.bezierCurveTo(a, f - u, c - l, n, c, n), t.bezierCurveTo(c + l, n, h, f - u, h, f), t.bezierCurveTo(h, f + u, c + l, d, c, d), t.bezierCurveTo(c - l, d, a, f + u, a, f), t.closePath(), r && t.fill(), i && t.stroke()
      }, d.default.Renderer2D.prototype.line = function(e, t, r, i) {
        var a = this.drawingContext;
        return this._doStroke && (this._getStroke() === v || (a.beginPath(), a.moveTo(e, t), a.lineTo(r, i), a.stroke())), this
      }, d.default.Renderer2D.prototype.point = function(e, t) {
        var r = this.drawingContext;
        if (!this._doStroke) return this;
        if (this._getStroke() === v) return this;
        var i = this._getStroke(),
          a = this._getFill();
        e = Math.round(e), t = Math.round(t), this._setFill(i), 1 < r.lineWidth ? (r.beginPath(), r.arc(e, t, r.lineWidth / 2, 0, p.TWO_PI, !1), r.fill()) : r.fillRect(e, t, 1, 1), this._setFill(a)
      }, d.default.Renderer2D.prototype.quad = function(e, t, r, i, a, n, o, s) {
        var l = this.drawingContext,
          u = this._doFill,
          h = this._doStroke;
        if (u && !h) {
          if (this._getFill() === v) return this
        } else if (!u && h && this._getStroke() === v) return this;
        return l.beginPath(), l.moveTo(e, t), l.lineTo(r, i), l.lineTo(a, n), l.lineTo(o, s), l.closePath(), u && l.fill(), h && l.stroke(), this
      }, d.default.Renderer2D.prototype.rect = function(e) {
        var t = e[0],
          r = e[1],
          i = e[2],
          a = e[3],
          n = e[4],
          o = e[5],
          s = e[6],
          l = e[7],
          u = this.drawingContext,
          h = this._doFill,
          d = this._doStroke;
        if (h && !d) {
          if (this._getFill() === v) return this
        } else if (!h && d && this._getStroke() === v) return this;
        if (u.beginPath(), void 0 === n) u.rect(t, r, i, a);
        else {
          void 0 === o && (o = n), void 0 === s && (s = o), void 0 === l && (l = s);
          var c = Math.abs(i),
            f = Math.abs(a),
            p = c / 2,
            m = f / 2;
          c < 2 * n && (n = p), f < 2 * n && (n = m), c < 2 * o && (o = p), f < 2 * o && (o = m), c < 2 * s && (s = p), f < 2 * s && (s = m), c < 2 * l && (l = p), f < 2 * l && (l = m), u.beginPath(), u.moveTo(t + n, r), u.arcTo(t + i, r, t + i, r + a, o), u.arcTo(t + i, r + a, t, r + a, s), u.arcTo(t, r + a, t, r, l), u.arcTo(t, r, t + i, r, n), u.closePath()
        }
        return this._doFill && u.fill(), this._doStroke && u.stroke(), this
      }, d.default.Renderer2D.prototype.triangle = function(e) {
        var t = this.drawingContext,
          r = this._doFill,
          i = this._doStroke,
          a = e[0],
          n = e[1],
          o = e[2],
          s = e[3],
          l = e[4],
          u = e[5];
        if (r && !i) {
          if (this._getFill() === v) return this
        } else if (!r && i && this._getStroke() === v) return this;
        t.beginPath(), t.moveTo(a, n), t.lineTo(o, s), t.lineTo(l, u), t.closePath(), r && t.fill(), i && t.stroke()
      }, d.default.Renderer2D.prototype.endShape = function(e, t, r, i, a, n, o) {
        if (0 === t.length) return this;
        if (!this._doStroke && !this._doFill) return this;
        var s, l, u, h = e === p.CLOSE;
        h && !n && t.push(t[0]);
        var d = t.length;
        if (!r || o !== p.POLYGON && null !== o)
          if (!i || o !== p.POLYGON && null !== o)
            if (!a || o !== p.POLYGON && null !== o)
              if (o === p.POINTS)
                for (l = 0; l < d; l++) s = t[l], this._doStroke && this._pInst.stroke(s[6]), this._pInst.point(s[0], s[1]);
              else if (o === p.LINES)
          for (l = 0; l + 1 < d; l += 2) s = t[l], this._doStroke && this._pInst.stroke(t[l + 1][6]), this._pInst.line(s[0], s[1], t[l + 1][0], t[l + 1][1]);
        else if (o === p.TRIANGLES)
          for (l = 0; l + 2 < d; l += 3) s = t[l], this.drawingContext.beginPath(), this.drawingContext.moveTo(s[0], s[1]), this.drawingContext.lineTo(t[l + 1][0], t[l + 1][1]), this.drawingContext.lineTo(t[l + 2][0], t[l + 2][1]), this.drawingContext.closePath(), this._doFill && (this._pInst.fill(t[l + 2][5]), this.drawingContext.fill()), this._doStroke && (this._pInst.stroke(t[l + 2][6]), this.drawingContext.stroke());
        else if (o === p.TRIANGLE_STRIP)
          for (l = 0; l + 1 < d; l++) s = t[l], this.drawingContext.beginPath(), this.drawingContext.moveTo(t[l + 1][0], t[l + 1][1]), this.drawingContext.lineTo(s[0], s[1]), this._doStroke && this._pInst.stroke(t[l + 1][6]), this._doFill && this._pInst.fill(t[l + 1][5]), l + 2 < d && (this.drawingContext.lineTo(t[l + 2][0], t[l + 2][1]), this._doStroke && this._pInst.stroke(t[l + 2][6]), this._doFill && this._pInst.fill(t[l + 2][5])), this._doFillStrokeClose(h);
        else if (o === p.TRIANGLE_FAN) {
          if (2 < d) {
            for (this.drawingContext.beginPath(), l = 2; l < d; l++) s = t[l], this.drawingContext.moveTo(t[0][0], t[0][1]), this.drawingContext.lineTo(t[l - 1][0], t[l - 1][1]), this.drawingContext.lineTo(s[0], s[1]), this.drawingContext.lineTo(t[0][0], t[0][1]), l < d - 1 && (this._doFill && s[5] !== t[l + 1][5] || this._doStroke && s[6] !== t[l + 1][6]) && (this._doFill && (this._pInst.fill(s[5]), this.drawingContext.fill(), this._pInst.fill(t[l + 1][5])), this._doStroke && (this._pInst.stroke(s[6]), this.drawingContext.stroke(), this._pInst.stroke(t[l + 1][6])), this.drawingContext.closePath(), this.drawingContext.beginPath());
            this._doFillStrokeClose(h)
          }
        } else if (o === p.QUADS)
          for (l = 0; l + 3 < d; l += 4) {
            for (s = t[l], this.drawingContext.beginPath(), this.drawingContext.moveTo(s[0], s[1]), u = 1; u < 4; u++) this.drawingContext.lineTo(t[l + u][0], t[l + u][1]);
            this.drawingContext.lineTo(s[0], s[1]), this._doFill && this._pInst.fill(t[l + 3][5]), this._doStroke && this._pInst.stroke(t[l + 3][6]), this._doFillStrokeClose(h)
          } else if (o === p.QUAD_STRIP) {
            if (3 < d)
              for (l = 0; l + 1 < d; l += 2) s = t[l], this.drawingContext.beginPath(), l + 3 < d ? (this.drawingContext.moveTo(t[l + 2][0], t[l + 2][1]), this.drawingContext.lineTo(s[0], s[1]), this.drawingContext.lineTo(t[l + 1][0], t[l + 1][1]), this.drawingContext.lineTo(t[l + 3][0], t[l + 3][1]), this._doFill && this._pInst.fill(t[l + 3][5]), this._doStroke && this._pInst.stroke(t[l + 3][6])) : (this.drawingContext.moveTo(s[0], s[1]), this.drawingContext.lineTo(t[l + 1][0], t[l + 1][1])), this._doFillStrokeClose(h)
          } else {
            for (this.drawingContext.beginPath(), this.drawingContext.moveTo(t[0][0], t[0][1]), l = 1; l < d; l++)(s = t[l]).isVert && (s.moveTo ? this.drawingContext.moveTo(s[0], s[1]) : this.drawingContext.lineTo(s[0], s[1]));
            this._doFillStrokeClose(h)
          }
        else {
          for (this.drawingContext.beginPath(), l = 0; l < d; l++) t[l].isVert ? t[l].moveTo ? this.drawingContext.moveTo(t[l][0], t[l][1]) : this.drawingContext.lineTo(t[l][0], t[l][1]) : this.drawingContext.quadraticCurveTo(t[l][0], t[l][1], t[l][2], t[l][3]);
          this._doFillStrokeClose(h)
        } else {
          for (this.drawingContext.beginPath(), l = 0; l < d; l++) t[l].isVert ? t[l].moveTo ? this.drawingContext.moveTo(t[l][0], t[l][1]) : this.drawingContext.lineTo(t[l][0], t[l][1]) : this.drawingContext.bezierCurveTo(t[l][0], t[l][1], t[l][2], t[l][3], t[l][4], t[l][5]);
          this._doFillStrokeClose(h)
        } else if (3 < d) {
          var c = [],
            f = 1 - this._curveTightness;
          for (this.drawingContext.beginPath(), this.drawingContext.moveTo(t[1][0], t[1][1]), l = 1; l + 2 < d; l++) s = t[l], c[0] = [s[0], s[1]], c[1] = [s[0] + (f * t[l + 1][0] - f * t[l - 1][0]) / 6, s[1] + (f * t[l + 1][1] - f * t[l - 1][1]) / 6], c[2] = [t[l + 1][0] + (f * t[l][0] - f * t[l + 2][0]) / 6, t[l + 1][1] + (f * t[l][1] - f * t[l + 2][1]) / 6], c[3] = [t[l + 1][0], t[l + 1][1]], this.drawingContext.bezierCurveTo(c[1][0], c[1][1], c[2][0], c[2][1], c[3][0], c[3][1]);
          h && this.drawingContext.lineTo(t[l + 1][0], t[l + 1][1]), this._doFillStrokeClose(h)
        }
        return n = a = i = r = !1, h && t.pop(), this
      }, d.default.Renderer2D.prototype.strokeCap = function(e) {
        return e !== p.ROUND && e !== p.SQUARE && e !== p.PROJECT || (this.drawingContext.lineCap = e), this
      }, d.default.Renderer2D.prototype.strokeJoin = function(e) {
        return e !== p.ROUND && e !== p.BEVEL && e !== p.MITER || (this.drawingContext.lineJoin = e), this
      }, d.default.Renderer2D.prototype.strokeWeight = function(e) {
        return this.drawingContext.lineWidth = void 0 === e || 0 === e ? 1e-4 : e, this
      }, d.default.Renderer2D.prototype._getFill = function() {
        return this._cachedFillStyle || (this._cachedFillStyle = this.drawingContext.fillStyle), this._cachedFillStyle
      }, d.default.Renderer2D.prototype._setFill = function(e) {
        e !== this._cachedFillStyle && (this.drawingContext.fillStyle = e, this._cachedFillStyle = e)
      }, d.default.Renderer2D.prototype._getStroke = function() {
        return this._cachedStrokeStyle || (this._cachedStrokeStyle = this.drawingContext.strokeStyle), this._cachedStrokeStyle
      }, d.default.Renderer2D.prototype._setStroke = function(e) {
        e !== this._cachedStrokeStyle && (this.drawingContext.strokeStyle = e, this._cachedStrokeStyle = e)
      }, d.default.Renderer2D.prototype.bezier = function(e, t, r, i, a, n, o, s) {
        return this._pInst.beginShape(), this._pInst.vertex(e, t), this._pInst.bezierVertex(r, i, a, n, o, s), this._pInst.endShape(), this
      }, d.default.Renderer2D.prototype.curve = function(e, t, r, i, a, n, o, s) {
        return this._pInst.beginShape(), this._pInst.curveVertex(e, t), this._pInst.curveVertex(r, i), this._pInst.curveVertex(a, n), this._pInst.curveVertex(o, s), this._pInst.endShape(), this
      }, d.default.Renderer2D.prototype._doFillStrokeClose = function(e) {
        e && this.drawingContext.closePath(), this._doFill && this.drawingContext.fill(), this._doStroke && this.drawingContext.stroke()
      }, d.default.Renderer2D.prototype.applyMatrix = function(e, t, r, i, a, n) {
        this.drawingContext.transform(e, t, r, i, a, n)
      }, d.default.Renderer2D.prototype.resetMatrix = function() {
        return this.drawingContext.setTransform(1, 0, 0, 1, 0, 0), this.drawingContext.scale(this._pInst._pixelDensity, this._pInst._pixelDensity), this
      }, d.default.Renderer2D.prototype.rotate = function(e) {
        this.drawingContext.rotate(e)
      }, d.default.Renderer2D.prototype.scale = function(e, t) {
        return this.drawingContext.scale(e, t), this
      }, d.default.Renderer2D.prototype.translate = function(e, t) {
        return e instanceof d.default.Vector && (t = e.y, e = e.x), this.drawingContext.translate(e, t), this
      }, d.default.Renderer2D.prototype.text = function(e, t, r, i, a) {
        var n;
        void 0 !== i && this.drawingContext.textBaseline === p.BASELINE && (n = !0, this.drawingContext.textBaseline = p.TOP);
        var o = d.default.Renderer.prototype.text.apply(this, arguments);
        return n && (this.drawingContext.textBaseline = p.BASELINE), o
      }, d.default.Renderer2D.prototype._renderText = function(e, t, r, i, a) {
        if (!(a <= i)) return e.push(), this._isOpenType() ? this._textFont._renderPath(t, r, i, {
          renderer: this
        }) : (this._doStroke && this._strokeSet && this.drawingContext.strokeText(t, r, i), this._doFill && (this._fillSet || this._setFill(p._DEFAULT_TEXT_FILL), this.drawingContext.fillText(t, r, i))), e.pop(), e
      }, d.default.Renderer2D.prototype.textWidth = function(e) {
        return this._isOpenType() ? this._textFont._textWidth(e, this._textSize) : this.drawingContext.measureText(e).width
      }, d.default.Renderer2D.prototype._applyTextProperties = function() {
        var e, t = this._pInst;
        return this._setProperty("_textAscent", null), this._setProperty("_textDescent", null), e = this._textFont, this._isOpenType() && (e = this._textFont.font.familyName, this._setProperty("_textStyle", this._textFont.font.styleName)), this.drawingContext.font = "".concat(this._textStyle || "normal", " ").concat(this._textSize || 12, "px ").concat(e || "sans-serif"), this.drawingContext.textAlign = this._textAlign, this._textBaseline === p.CENTER ? this.drawingContext.textBaseline = p._CTX_MIDDLE : this.drawingContext.textBaseline = this._textBaseline, t
      }, d.default.Renderer2D.prototype.push = function() {
        return this.drawingContext.save(), d.default.Renderer.prototype.push.apply(this)
      }, d.default.Renderer2D.prototype.pop = function(e) {
        this.drawingContext.restore(), this._cachedFillStyle = this.drawingContext.fillStyle, this._cachedStrokeStyle = this.drawingContext.strokeStyle, d.default.Renderer.prototype.pop.call(this, e)
      };
      var a = d.default.Renderer2D;
      r.default = a
    }, {
      "../image/filters": 47,
      "./constants": 20,
      "./main": 26,
      "./p5.Renderer": 29
    }],
    31: [function(e, t, r) {
      "use strict";
      var i, c = (i = e("./main")) && i.__esModule ? i : {
        default: i
      };
      c.default.prototype._promisePreloads = [];
      var f = !(c.default.prototype.registerPromisePreload = function(e) {
        c.default.prototype._promisePreloads.push(e)
      });
      c.default.prototype._setupPromisePreloads = function() {
        var e = !0,
          t = !1,
          r = void 0;
        try {
          for (var i, a = this._promisePreloads[Symbol.iterator](); !(e = (i = a.next()).done); e = !0) {
            var n = i.value,
              o = this,
              s = n.method,
              l = n.addCallbacks,
              u = n.legacyPreloadSetup,
              h = n.target || this,
              d = h[s].bind(h);
            if (h === c.default.prototype) {
              if (f) continue;
              o = null, d = h[s]
            }
            if (h[s] = this._wrapPromisePreload(o, d, l), u) h[u.method] = this._legacyPreloadGenerator(o, u, h[s])
          }
        } catch (e) {
          t = !0, r = e
        } finally {
          try {
            e || null == a.return || a.return()
          } finally {
            if (t) throw r
          }
        }
        f = !0
      }, c.default.prototype._wrapPromisePreload = function(e, l, u) {
        var t = function() {
          var e = this;
          this._incrementPreload();
          for (var t = null, r = null, i = arguments.length, a = new Array(i), n = 0; n < i; n++) a[n] = arguments[n];
          if (u)
            for (var o = a.length - 1; 0 <= o && !r && "function" == typeof a[o]; o--) r = t, t = a.pop();
          var s = Promise.resolve(l.apply(this, a));
          return t && s.then(t), r && s.catch(r), s.then(function() {
            return e._decrementPreload()
          }), s
        };
        return e && (t = t.bind(e)), t
      };
      var n = function() {
        return {}
      };
      c.default.prototype._legacyPreloadGenerator = function(e, t, i) {
        var a = t.createBaseObject || n,
          r = function() {
            var t = this;
            this._incrementPreload();
            var r = a.apply(this, arguments);
            return i.apply(this, arguments).then(function(e) {
              Object.assign(r, e), t._decrementPreload()
            }), r
          };
        return e && (r = r.bind(e)), r
      }
    }, {
      "./main": 26
    }],
    32: [function(e, t, r) {
      "use strict";
      Object.defineProperty(r, "__esModule", {
        value: !0
      }), r.default = void 0;
      var i, s = (i = e("./main")) && i.__esModule ? i : {
          default: i
        },
        l = function(e) {
          {
            if (e && e.__esModule) return e;
            var t = {};
            if (null != e)
              for (var r in e)
                if (Object.prototype.hasOwnProperty.call(e, r)) {
                  var i = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(e, r) : {};
                  i.get || i.set ? Object.defineProperty(t, r, i) : t[r] = e[r]
                } return t.default = e, t
          }
        }(e("./constants"));

      function u(e) {
        return (u = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
          return typeof e
        } : function(e) {
          return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        })(e)
      }
      e("./p5.Graphics"), e("./p5.Renderer2D"), e("../webgl/p5.RendererGL");
      var h = "defaultCanvas0";
      s.default.prototype.createCanvas = function(e, t, r) {
        s.default._validateParameters("createCanvas", arguments);
        var i, a = r || l.P2D;
        if (a === l.WEBGL) {
          if (i = document.getElementById(h)) {
            i.parentNode.removeChild(i);
            var n = this._renderer;
            this._elements = this._elements.filter(function(e) {
              return e !== n
            })
          }(i = document.createElement("canvas")).id = h, i.classList.add("p5Canvas")
        } else if (this._defaultGraphicsCreated) i = this.canvas;
        else {
          i = document.createElement("canvas");
          for (var o = 0; document.getElementById("defaultCanvas".concat(o));) o++;
          h = "defaultCanvas".concat(o), i.id = h, i.classList.add("p5Canvas")
        }
        return this._setupDone || (i.dataset.hidden = !0, i.style.visibility = "hidden"), this._userNode ? this._userNode.appendChild(i) : document.body.appendChild(i), a === l.WEBGL ? (this._setProperty("_renderer", new s.default.RendererGL(i, this, !0)), this._elements.push(this._renderer)) : this._defaultGraphicsCreated || (this._setProperty("_renderer", new s.default.Renderer2D(i, this, !0)), this._defaultGraphicsCreated = !0, this._elements.push(this._renderer)), this._renderer.resize(e, t), this._renderer._applyDefaults(), this._renderer
      }, s.default.prototype.resizeCanvas = function(e, t, r) {
        if (s.default._validateParameters("resizeCanvas", arguments), this._renderer) {
          var i = {};
          for (var a in this.drawingContext) {
            var n = this.drawingContext[a];
            "object" !== u(n) && "function" != typeof n && (i[a] = n)
          }
          for (var o in this._renderer.resize(e, t), this.width = e, this.height = t, i) try {
            this.drawingContext[o] = i[o]
          } catch (e) {}
          r || this.redraw()
        }
      }, s.default.prototype.noCanvas = function() {
        this.canvas && this.canvas.parentNode.removeChild(this.canvas)
      }, s.default.prototype.createGraphics = function(e, t, r) {
        return s.default._validateParameters("createGraphics", arguments), new s.default.Graphics(e, t, r, this)
      }, s.default.prototype.blendMode = function(e) {
        s.default._validateParameters("blendMode", arguments), e === l.NORMAL && (console.warn("NORMAL has been deprecated for use in blendMode. defaulting to BLEND instead."), e = l.BLEND), this._renderer.blendMode(e)
      };
      var a = s.default;
      r.default = a
    }, {
      "../webgl/p5.RendererGL": 79,
      "./constants": 20,
      "./main": 26,
      "./p5.Graphics": 28,
      "./p5.Renderer2D": 30
    }],
    33: [function(e, t, r) {
      "use strict";
      Object.defineProperty(r, "__esModule", {
        value: !0
      }), r.default = void 0;
      var h = i(e("../main")),
        o = function(e) {
          {
            if (e && e.__esModule) return e;
            var t = {};
            if (null != e)
              for (var r in e)
                if (Object.prototype.hasOwnProperty.call(e, r)) {
                  var i = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(e, r) : {};
                  i.get || i.set ? Object.defineProperty(t, r, i) : t[r] = e[r]
                } return t.default = e, t
          }
        }(e("../constants")),
        d = i(e("../helpers"));

      function i(e) {
        return e && e.__esModule ? e : {
          default: e
        }
      }

      function a(e) {
        return function(e) {
          if (Array.isArray(e)) {
            for (var t = 0, r = new Array(e.length); t < e.length; t++) r[t] = e[t];
            return r
          }
        }(e) || function(e) {
          if (Symbol.iterator in Object(e) || "[object Arguments]" === Object.prototype.toString.call(e)) return Array.from(e)
        }(e) || function() {
          throw new TypeError("Invalid attempt to spread non-iterable instance")
        }()
      }
      e("../error_helpers"), h.default.prototype._normalizeArcAngles = function(e, t, r, i, a) {
        var n;
        return e -= o.TWO_PI * Math.floor(e / o.TWO_PI), t -= o.TWO_PI * Math.floor(t / o.TWO_PI), n = Math.min(Math.abs(e - t), o.TWO_PI - Math.abs(e - t)), a && (e = e <= o.HALF_PI ? Math.atan(r / i * Math.tan(e)) : e > o.HALF_PI && e <= 3 * o.HALF_PI ? Math.atan(r / i * Math.tan(e)) + o.PI : Math.atan(r / i * Math.tan(e)) + o.TWO_PI, t = t <= o.HALF_PI ? Math.atan(r / i * Math.tan(t)) : t > o.HALF_PI && t <= 3 * o.HALF_PI ? Math.atan(r / i * Math.tan(t)) + o.PI : Math.atan(r / i * Math.tan(t)) + o.TWO_PI), t < e && (t += o.TWO_PI), {
          start: e,
          stop: t,
          correspondToSamePoint: n < 1e-5
        }
      }, h.default.prototype.arc = function(e, t, r, i, a, n, o, s) {
        if (h.default._validateParameters("arc", arguments), !this._renderer._doStroke && !this._renderer._doFill) return this;
        a = this._toRadians(a), n = this._toRadians(n), r = Math.abs(r), i = Math.abs(i);
        var l = d.default.modeAdjust(e, t, r, i, this._renderer._ellipseMode),
          u = this._normalizeArcAngles(a, n, l.w, l.h, !0);
        return u.correspondToSamePoint ? this._renderer.ellipse([l.x, l.y, l.w, l.h, s]) : this._renderer.arc(l.x, l.y, l.w, l.h, u.start, u.stop, o, s), this
      }, h.default.prototype.ellipse = function(e, t, r, i, a) {
        if (h.default._validateParameters("ellipse", arguments), !this._renderer._doStroke && !this._renderer._doFill) return this;
        r < 0 && (r = Math.abs(r)), void 0 === i ? i = r : i < 0 && (i = Math.abs(i));
        var n = d.default.modeAdjust(e, t, r, i, this._renderer._ellipseMode);
        return this._renderer.ellipse([n.x, n.y, n.w, n.h, a]), this
      }, h.default.prototype.circle = function() {
        var e = Array.prototype.slice.call(arguments, 0, 2);
        return e.push(arguments[2]), e.push(arguments[2]), this.ellipse.apply(this, a(e))
      }, h.default.prototype.line = function() {
        for (var e = arguments.length, t = new Array(e), r = 0; r < e; r++) t[r] = arguments[r];
        var i;
        (h.default._validateParameters("line", t), this._renderer._doStroke) && (i = this._renderer).line.apply(i, t);
        return this
      }, h.default.prototype.point = function() {
        for (var e = arguments.length, t = new Array(e), r = 0; r < e; r++) t[r] = arguments[r];
        var i;
        (h.default._validateParameters("point", t), this._renderer._doStroke) && (1 === t.length && t[0] instanceof h.default.Vector ? this._renderer.point.call(this._renderer, t[0].x, t[0].y, t[0].z) : (i = this._renderer).point.apply(i, t));
        return this
      }, h.default.prototype.quad = function() {
        for (var e = arguments.length, t = new Array(e), r = 0; r < e; r++) t[r] = arguments[r];
        var i;
        (h.default._validateParameters("quad", t), this._renderer._doStroke || this._renderer._doFill) && (this._renderer.isP3D && 12 !== t.length ? this._renderer.quad.call(this._renderer, t[0], t[1], 0, t[2], t[3], 0, t[4], t[5], 0, t[6], t[7], 0) : (i = this._renderer).quad.apply(i, t));
        return this
      }, h.default.prototype.rect = function() {
        if (h.default._validateParameters("rect", arguments), this._renderer._doStroke || this._renderer._doFill) {
          for (var e = d.default.modeAdjust(arguments[0], arguments[1], arguments[2], arguments[3], this._renderer._rectMode), t = [e.x, e.y, e.w, e.h], r = 4; r < arguments.length; r++) t[r] = arguments[r];
          this._renderer.rect(t)
        }
        return this
      }, h.default.prototype.square = function(e, t, r, i, a, n, o) {
        return this.rect(e, t, r, r, i, a, n, o)
      }, h.default.prototype.triangle = function() {
        for (var e = arguments.length, t = new Array(e), r = 0; r < e; r++) t[r] = arguments[r];
        return h.default._validateParameters("triangle", t), (this._renderer._doStroke || this._renderer._doFill) && this._renderer.triangle(t), this
      };
      var n = h.default;
      r.default = n
    }, {
      "../constants": 20,
      "../error_helpers": 22,
      "../helpers": 23,
      "../main": 26
    }],
    34: [function(e, t, r) {
      "use strict";
      Object.defineProperty(r, "__esModule", {
        value: !0
      }), r.default = void 0;
      var i, a = (i = e("../main")) && i.__esModule ? i : {
          default: i
        },
        n = function(e) {
          {
            if (e && e.__esModule) return e;
            var t = {};
            if (null != e)
              for (var r in e)
                if (Object.prototype.hasOwnProperty.call(e, r)) {
                  var i = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(e, r) : {};
                  i.get || i.set ? Object.defineProperty(t, r, i) : t[r] = e[r]
                } return t.default = e, t
          }
        }(e("../constants"));
      a.default.prototype.ellipseMode = function(e) {
        return a.default._validateParameters("ellipseMode", arguments), e !== n.CORNER && e !== n.CORNERS && e !== n.RADIUS && e !== n.CENTER || (this._renderer._ellipseMode = e), this
      }, a.default.prototype.noSmooth = function() {
        return this.setAttributes("antialias", !1), this._renderer.isP3D || "imageSmoothingEnabled" in this.drawingContext && (this.drawingContext.imageSmoothingEnabled = !1), this
      }, a.default.prototype.rectMode = function(e) {
        return a.default._validateParameters("rectMode", arguments), e !== n.CORNER && e !== n.CORNERS && e !== n.RADIUS && e !== n.CENTER || (this._renderer._rectMode = e), this
      }, a.default.prototype.smooth = function() {
        return this.setAttributes("antialias", !0), this._renderer.isP3D || "imageSmoothingEnabled" in this.drawingContext && (this.drawingContext.imageSmoothingEnabled = !0), this
      }, a.default.prototype.strokeCap = function(e) {
        return a.default._validateParameters("strokeCap", arguments), e !== n.ROUND && e !== n.SQUARE && e !== n.PROJECT || this._renderer.strokeCap(e), this
      }, a.default.prototype.strokeJoin = function(e) {
        return a.default._validateParameters("strokeJoin", arguments), e !== n.ROUND && e !== n.BEVEL && e !== n.MITER || this._renderer.strokeJoin(e), this
      }, a.default.prototype.strokeWeight = function(e) {
        return a.default._validateParameters("strokeWeight", arguments), this._renderer.strokeWeight(e), this
      };
      var o = a.default;
      r.default = o
    }, {
      "../constants": 20,
      "../main": 26
    }],
    35: [function(e, t, r) {
      "use strict";
      Object.defineProperty(r, "__esModule", {
        value: !0
      }), r.default = void 0;
      var i, s = (i = e("../main")) && i.__esModule ? i : {
        default: i
      };
      e("../error_helpers"), s.default.prototype.bezier = function() {
        for (var e, t = arguments.length, r = new Array(t), i = 0; i < t; i++) r[i] = arguments[i];
        return s.default._validateParameters("bezier", r), (this._renderer._doStroke || this._renderer._doFill) && (e = this._renderer).bezier.apply(e, r), this
      }, s.default.prototype.bezierDetail = function(e) {
        return s.default._validateParameters("bezierDetail", arguments), this._bezierDetail = e, this
      }, s.default.prototype.bezierPoint = function(e, t, r, i, a) {
        s.default._validateParameters("bezierPoint", arguments);
        var n = 1 - a;
        return Math.pow(n, 3) * e + 3 * Math.pow(n, 2) * a * t + 3 * n * Math.pow(a, 2) * r + Math.pow(a, 3) * i
      }, s.default.prototype.bezierTangent = function(e, t, r, i, a) {
        s.default._validateParameters("bezierTangent", arguments);
        var n = 1 - a;
        return 3 * i * Math.pow(a, 2) - 3 * r * Math.pow(a, 2) + 6 * r * n * a - 6 * t * n * a + 3 * t * Math.pow(n, 2) - 3 * e * Math.pow(n, 2)
      }, s.default.prototype.curve = function() {
        for (var e = arguments.length, t = new Array(e), r = 0; r < e; r++) t[r] = arguments[r];
        var i;
        (s.default._validateParameters("curve", t), this._renderer._doStroke) && (i = this._renderer).curve.apply(i, t);
        return this
      }, s.default.prototype.curveDetail = function(e) {
        return s.default._validateParameters("curveDetail", arguments), this._curveDetail = e < 3 ? 3 : e, this
      }, s.default.prototype.curveTightness = function(e) {
        return s.default._validateParameters("curveTightness", arguments), this._renderer._curveTightness = e, this
      }, s.default.prototype.curvePoint = function(e, t, r, i, a) {
        s.default._validateParameters("curvePoint", arguments);
        var n = a * a * a,
          o = a * a;
        return e * (-.5 * n + o - .5 * a) + t * (1.5 * n - 2.5 * o + 1) + r * (-1.5 * n + 2 * o + .5 * a) + i * (.5 * n - .5 * o)
      }, s.default.prototype.curveTangent = function(e, t, r, i, a) {
        s.default._validateParameters("curveTangent", arguments);
        var n = a * a;
        return e * (-3 * n / 2 + 2 * a - .5) + t * (9 * n / 2 - 5 * a) + r * (-9 * n / 2 + 4 * a + .5) + i * (3 * n / 2 - a)
      };
      var a = s.default;
      r.default = a
    }, {
      "../error_helpers": 22,
      "../main": 26
    }],
    36: [function(e, t, r) {
      "use strict";
      Object.defineProperty(r, "__esModule", {
        value: !0
      }), r.default = void 0;
      var i, s = (i = e("../main")) && i.__esModule ? i : {
          default: i
        },
        l = function(e) {
          {
            if (e && e.__esModule) return e;
            var t = {};
            if (null != e)
              for (var r in e)
                if (Object.prototype.hasOwnProperty.call(e, r)) {
                  var i = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(e, r) : {};
                  i.get || i.set ? Object.defineProperty(t, r, i) : t[r] = e[r]
                } return t.default = e, t
          }
        }(e("../constants"));
      var a = null,
        u = [],
        h = [],
        o = !1,
        n = !1,
        d = !1,
        c = !1,
        f = !0;
      s.default.prototype.beginContour = function() {
        return h = [], c = !0, this
      }, s.default.prototype.beginShape = function(e) {
        var t;
        (s.default._validateParameters("beginShape", arguments), this._renderer.isP3D) ? (t = this._renderer).beginShape.apply(t, arguments): (a = e === l.POINTS || e === l.LINES || e === l.TRIANGLES || e === l.TRIANGLE_FAN || e === l.TRIANGLE_STRIP || e === l.QUADS || e === l.QUAD_STRIP ? e : null, u = [], h = []);
        return this
      }, s.default.prototype.bezierVertex = function() {
        for (var e = arguments.length, t = new Array(e), r = 0; r < e; r++) t[r] = arguments[r];
        var i;
        if (s.default._validateParameters("bezierVertex", t), this._renderer.isP3D)(i = this._renderer).bezierVertex.apply(i, t);
        else if (0 === u.length) s.default._friendlyError("vertex() must be used once before calling bezierVertex()", "bezierVertex");
        else {
          o = !0;
          for (var a = [], n = 0; n < t.length; n++) a[n] = t[n];
          a.isVert = !1, c ? h.push(a) : u.push(a)
        }
        return this
      }, s.default.prototype.curveVertex = function() {
        for (var e = arguments.length, t = new Array(e), r = 0; r < e; r++) t[r] = arguments[r];
        var i;
        (s.default._validateParameters("curveVertex", t), this._renderer.isP3D) ? (i = this._renderer).curveVertex.apply(i, t): (n = !0, this.vertex(t[0], t[1]));
        return this
      }, s.default.prototype.endContour = function() {
        var e = h[0].slice();
        e.isVert = h[0].isVert, e.moveTo = !1, h.push(e), f && (u.push(u[0]), f = !1);
        for (var t = 0; t < h.length; t++) u.push(h[t]);
        return this
      }, s.default.prototype.endShape = function(e) {
        if (s.default._validateParameters("endShape", arguments), this._renderer.isP3D) this._renderer.endShape(e, n, o, d, c, a);
        else {
          if (0 === u.length) return this;
          if (!this._renderer._doStroke && !this._renderer._doFill) return this;
          var t = e === l.CLOSE;
          t && !c && u.push(u[0]), this._renderer.endShape(e, u, n, o, d, c, a), f = !(c = d = o = n = !1), t && u.pop()
        }
        return this
      }, s.default.prototype.quadraticVertex = function() {
        for (var e = arguments.length, t = new Array(e), r = 0; r < e; r++) t[r] = arguments[r];
        if (s.default._validateParameters("quadraticVertex", t), this._renderer.isP3D) {
          var i;
          (i = this._renderer).quadraticVertex.apply(i, t)
        } else {
          if (this._contourInited) {
            var a = {};
            return a.x = t[0], a.y = t[1], a.x3 = t[2], a.y3 = t[3], a.type = l.QUADRATIC, this._contourVertices.push(a), this
          }
          if (0 < u.length) {
            d = !0;
            for (var n = [], o = 0; o < t.length; o++) n[o] = t[o];
            n.isVert = !1, c ? h.push(n) : u.push(n)
          } else s.default._friendlyError("vertex() must be used once before calling quadraticVertex()", "quadraticVertex")
        }
        return this
      }, s.default.prototype.vertex = function(e, t, r, i, a) {
        if (this._renderer.isP3D) {
          var n;
          (n = this._renderer).vertex.apply(n, arguments)
        } else {
          var o = [];
          o.isVert = !0, o[0] = e, o[1] = t, o[2] = 0, o[3] = 0, o[4] = 0, o[5] = this._renderer._getFill(), o[6] = this._renderer._getStroke(), r && (o.moveTo = r), c ? (0 === h.length && (o.moveTo = !0), h.push(o)) : u.push(o)
        }
        return this
      };
      var p = s.default;
      r.default = p
    }, {
      "../constants": 20,
      "../main": 26
    }],
    37: [function(e, t, r) {
      "use strict";

      function i(e) {
        return (i = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
          return typeof e
        } : function(e) {
          return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        })(e)
      }
      window.requestAnimationFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame || function(e, t) {
          window.setTimeout(e, 1e3 / 60)
        }, "undefined" == typeof Uint8ClampedArray || Uint8ClampedArray.prototype.slice || Object.defineProperty(Uint8ClampedArray.prototype, "slice", {
          value: Array.prototype.slice,
          writable: !0,
          configurable: !0,
          enumerable: !1
        }),
        function() {
          if (!Object.assign) {
            var s = Object.keys,
              e = Object.defineProperty,
              l = "function" == typeof Symbol && "symbol" === i(Symbol()),
              r = Object.prototype.propertyIsEnumerable,
              u = function(t) {
                return function(e) {
                  return r.call(t, e)
                }
              };
            e(Object, "assign", {
              value: function(e, t) {
                if (null == e) throw new TypeError("target must be an object");
                var r, i, a, n, o = Object(e);
                for (r = 1; r < arguments.length; ++r)
                  for (i = Object(arguments[r]), n = s(i), l && Object.getOwnPropertySymbols && n.push.apply(n, Object.getOwnPropertySymbols(i).filter(u(i))), a = 0; a < n.length; ++a) o[n[a]] = i[n[a]];
                return o
              },
              configurable: !0,
              enumerable: !1,
              writable: !0
            })
          }
        }()
    }, {}],
    38: [function(e, t, r) {
      "use strict";
      Object.defineProperty(r, "__esModule", {
        value: !0
      }), r.default = void 0;
      var i, a = (i = e("./main")) && i.__esModule ? i : {
        default: i
      };
      a.default.prototype.noLoop = function() {
        this._loop = !1
      }, a.default.prototype.loop = function() {
        this._loop || (this._loop = !0, this._setupDone && this._draw())
      }, a.default.prototype.push = function() {
        this._styles.push({
          props: {
            _colorMode: this._colorMode
          },
          renderer: this._renderer.push()
        })
      }, a.default.prototype.pop = function() {
        var e = this._styles.pop();
        e ? (this._renderer.pop(e.renderer), Object.assign(this, e.props)) : console.warn("pop() was called without matching push()")
      }, a.default.prototype.redraw = function(e) {
        if (!this._inUserDraw && this._setupDone) {
          var t = parseInt(e);
          (isNaN(t) || t < 1) && (t = 1);
          var r = this._isGlobal ? window : this,
            i = r.setup,
            a = r.draw;
          if ("function" == typeof a) {
            void 0 === i && r.scale(r._pixelDensity, r._pixelDensity);
            for (var n = function(e) {
                e.call(r)
              }, o = 0; o < t; o++) {
              r.resetMatrix(), r._renderer.isP3D && r._renderer._update(), r._setProperty("frameCount", r.frameCount + 1), r._registeredMethods.pre.forEach(n), this._inUserDraw = !0;
              try {
                a()
              } finally {
                this._inUserDraw = !1
              }
              r._registeredMethods.post.forEach(n)
            }
          }
        }
      };
      var n = a.default;
      r.default = n
    }, {
      "./main": 26
    }],
    39: [function(e, t, r) {
      "use strict";
      Object.defineProperty(r, "__esModule", {
        value: !0
      }), r.default = void 0;
      var i, n = (i = e("./main")) && i.__esModule ? i : {
        default: i
      };
      n.default.prototype.applyMatrix = function(e, t, r, i, a, n) {
        var o;
        return (o = this._renderer).applyMatrix.apply(o, arguments), this
      }, n.default.prototype.resetMatrix = function() {
        return this._renderer.resetMatrix(), this
      }, n.default.prototype.rotate = function(e, t) {
        return n.default._validateParameters("rotate", arguments), this._renderer.rotate(this._toRadians(e), t), this
      }, n.default.prototype.rotateX = function(e) {
        return this._assert3d("rotateX"), n.default._validateParameters("rotateX", arguments), this._renderer.rotateX(this._toRadians(e)), this
      }, n.default.prototype.rotateY = function(e) {
        return this._assert3d("rotateY"), n.default._validateParameters("rotateY", arguments), this._renderer.rotateY(this._toRadians(e)), this
      }, n.default.prototype.rotateZ = function(e) {
        return this._assert3d("rotateZ"), n.default._validateParameters("rotateZ", arguments), this._renderer.rotateZ(this._toRadians(e)), this
      }, n.default.prototype.scale = function(e, t, r) {
        if (n.default._validateParameters("scale", arguments), e instanceof n.default.Vector) {
          var i = e;
          e = i.x, t = i.y, r = i.z
        } else if (e instanceof Array) {
          var a = e;
          e = a[0], t = a[1], r = a[2] || 1
        }
        return isNaN(t) ? t = r = e : isNaN(r) && (r = 1), this._renderer.scale.call(this._renderer, e, t, r), this
      }, n.default.prototype.shearX = function(e) {
        n.default._validateParameters("shearX", arguments);
        var t = this._toRadians(e);
        return this._renderer.applyMatrix(1, 0, Math.tan(t), 1, 0, 0), this
      }, n.default.prototype.shearY = function(e) {
        n.default._validateParameters("shearY", arguments);
        var t = this._toRadians(e);
        return this._renderer.applyMatrix(1, Math.tan(t), 0, 1, 0, 0), this
      }, n.default.prototype.translate = function(e, t, r) {
        return n.default._validateParameters("translate", arguments), this._renderer.isP3D ? this._renderer.translate(e, t, r) : this._renderer.translate(e, t), this
      };
      var a = n.default;
      r.default = a
    }, {
      "./main": 26
    }],
    40: [function(e, t, r) {
      "use strict";
      var i, a = (i = e("../core/main")) && i.__esModule ? i : {
        default: i
      };

      function n(e) {
        return function(e) {
          if (Array.isArray(e)) {
            for (var t = 0, r = new Array(e.length); t < e.length; t++) r[t] = e[t];
            return r
          }
        }(e) || function(e) {
          if (Symbol.iterator in Object(e) || "[object Arguments]" === Object.prototype.toString.call(e)) return Array.from(e)
        }(e) || function() {
          throw new TypeError("Invalid attempt to spread non-iterable instance")
        }()
      }

      function o(e) {
        return (o = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
          return typeof e
        } : function(e) {
          return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        })(e)
      }
      a.default.prototype.storeItem = function(e, t) {
        void 0 === t && console.log("You cannot store undefined variables using storeItem()");
        var r = o(t);
        switch (r) {
          case "number":
          case "boolean":
            t = t.toString();
            break;
          case "object":
            if (t instanceof a.default.Color) r = "p5.Color";
            else if (t instanceof a.default.Vector) {
              r = "p5.Vector", t = [t.x, t.y, t.z]
            }
            t = JSON.stringify(t)
        }
        localStorage.setItem(e, t);
        var i = "".concat(e, "p5TypeID");
        localStorage.setItem(i, r)
      }, a.default.prototype.getItem = function(e) {
        var t = localStorage.getItem(e),
          r = localStorage.getItem("".concat(e, "p5TypeID"));
        if (void 0 === r) console.log("Unable to determine type of item stored under ".concat(e, "in local storage. Did you save the item with something other than setItem()?"));
        else if (null !== t) switch (r) {
          case "number":
            t = parseInt(t);
            break;
          case "boolean":
            t = "true" === t;
            break;
          case "object":
            t = JSON.parse(t);
            break;
          case "p5.Color":
            t = JSON.parse(t), t = this.color.apply(this, n(t.levels));
            break;
          case "p5.Vector":
            t = JSON.parse(t), t = this.createVector.apply(this, n(t))
        }
        return t
      }, a.default.prototype.clearStorage = function() {
        localStorage.clear()
      }, a.default.prototype.removeItem = function(e) {
        "string" != typeof e && console.log("The argument that you passed to removeItem() - ".concat(e, " is not a string.")), localStorage.removeItem(e), localStorage.removeItem("".concat(e, "p5TypeID"))
      }
    }, {
      "../core/main": 26
    }],
    41: [function(e, t, r) {
      "use strict";
      Object.defineProperty(r, "__esModule", {
        value: !0
      }), r.default = void 0;
      var i, a = (i = e("../core/main")) && i.__esModule ? i : {
        default: i
      };
      a.default.prototype.createStringDict = function(e, t) {
        return a.default._validateParameters("createStringDict", arguments), new a.default.StringDict(e, t)
      }, a.default.prototype.createNumberDict = function(e, t) {
        return a.default._validateParameters("createNumberDict", arguments), new a.default.NumberDict(e, t)
      }, a.default.TypedDict = function(e, t) {
        return e instanceof Object ? this.data = e : (this.data = {}, this.data[e] = t), this
      }, a.default.TypedDict.prototype.size = function() {
        return Object.keys(this.data).length
      }, a.default.TypedDict.prototype.hasKey = function(e) {
        return this.data.hasOwnProperty(e)
      }, a.default.TypedDict.prototype.get = function(e) {
        if (this.data.hasOwnProperty(e)) return this.data[e];
        console.log("".concat(e, " does not exist in this Dictionary"))
      }, a.default.TypedDict.prototype.set = function(e, t) {
        this._validate(t) ? this.data[e] = t : console.log("Those values dont work for this dictionary type.")
      }, a.default.TypedDict.prototype._addObj = function(e) {
        for (var t in e) this.set(t, e[t])
      }, a.default.TypedDict.prototype.create = function(e, t) {
        e instanceof Object && void 0 === t ? this._addObj(e) : void 0 !== e ? this.set(e, t) : console.log("In order to create a new Dictionary entry you must pass an object or a key, value pair")
      }, a.default.TypedDict.prototype.clear = function() {
        this.data = {}
      }, a.default.TypedDict.prototype.remove = function(e) {
        if (!this.data.hasOwnProperty(e)) throw new Error("".concat(e, " does not exist in this Dictionary"));
        delete this.data[e]
      }, a.default.TypedDict.prototype.print = function() {
        for (var e in this.data) console.log("key:".concat(e, " value:").concat(this.data[e]))
      }, a.default.TypedDict.prototype.saveTable = function(e) {
        var t = "";
        for (var r in this.data) t += "".concat(r, ",").concat(this.data[r], "\n");
        var i = new Blob([t], {
          type: "text/csv"
        });
        a.default.prototype.downloadFile(i, e || "mycsv", "csv")
      }, a.default.TypedDict.prototype.saveJSON = function(e, t) {
        a.default.prototype.saveJSON(this.data, e, t)
      }, a.default.TypedDict.prototype._validate = function(e) {
        return !0
      }, a.default.StringDict = function() {
        for (var e = arguments.length, t = new Array(e), r = 0; r < e; r++) t[r] = arguments[r];
        a.default.TypedDict.apply(this, t)
      }, a.default.StringDict.prototype = Object.create(a.default.TypedDict.prototype), a.default.StringDict.prototype._validate = function(e) {
        return "string" == typeof e
      }, a.default.NumberDict = function() {
        for (var e = arguments.length, t = new Array(e), r = 0; r < e; r++) t[r] = arguments[r];
        a.default.TypedDict.apply(this, t)
      }, a.default.NumberDict.prototype = Object.create(a.default.TypedDict.prototype), a.default.NumberDict.prototype._validate = function(e) {
        return "number" == typeof e
      }, a.default.NumberDict.prototype.add = function(e, t) {
        this.data.hasOwnProperty(e) ? this.data[e] += t : console.log("The key - ".concat(e, " does not exist in this dictionary."))
      }, a.default.NumberDict.prototype.sub = function(e, t) {
        this.add(e, -t)
      }, a.default.NumberDict.prototype.mult = function(e, t) {
        this.data.hasOwnProperty(e) ? this.data[e] *= t : console.log("The key - ".concat(e, " does not exist in this dictionary."))
      }, a.default.NumberDict.prototype.div = function(e, t) {
        this.data.hasOwnProperty(e) ? this.data[e] /= t : console.log("The key - ".concat(e, " does not exist in this dictionary."))
      }, a.default.NumberDict.prototype._valueTest = function(e) {
        if (0 === Object.keys(this.data).length) throw new Error("Unable to search for a minimum or maximum value on an empty NumberDict");
        if (1 === Object.keys(this.data).length) return this.data[Object.keys(this.data)[0]];
        var t = this.data[Object.keys(this.data)[0]];
        for (var r in this.data) this.data[r] * e < t * e && (t = this.data[r]);
        return t
      }, a.default.NumberDict.prototype.minValue = function() {
        return this._valueTest(1)
      }, a.default.NumberDict.prototype.maxValue = function() {
        return this._valueTest(-1)
      }, a.default.NumberDict.prototype._keyTest = function(e) {
        if (0 === Object.keys(this.data).length) throw new Error("Unable to use minValue on an empty NumberDict");
        if (1 === Object.keys(this.data).length) return Object.keys(this.data)[0];
        for (var t = Object.keys(this.data)[0], r = 1; r < Object.keys(this.data).length; r++) Object.keys(this.data)[r] * e < t * e && (t = Object.keys(this.data)[r]);
        return t
      }, a.default.NumberDict.prototype.minKey = function() {
        return this._keyTest(1)
      }, a.default.NumberDict.prototype.maxKey = function() {
        return this._keyTest(-1)
      };
      var n = a.default.TypedDict;
      r.default = n
    }, {
      "../core/main": 26
    }],
    42: [function(e, t, r) {
      "use strict";
      Object.defineProperty(r, "__esModule", {
        value: !0
      }), r.default = void 0;
      var i, h = (i = e("../core/main")) && i.__esModule ? i : {
        default: i
      };

      function d(e) {
        return (d = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
          return typeof e
        } : function(e) {
          return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        })(e)
      }

      function s(e) {
        var t = document;
        return "string" == typeof e && "#" === e[0] ? (e = e.slice(1), t = document.getElementById(e) || document) : e instanceof h.default.Element ? t = e.elt : e instanceof HTMLElement && (t = e), t
      }

      function c(e, t, r) {
        (t._userNode ? t._userNode : document.body).appendChild(e);
        var i = r ? new h.default.MediaElement(e, t) : new h.default.Element(e, t);
        return t._elements.push(i), i
      }
      h.default.prototype.select = function(e, t) {
        h.default._validateParameters("select", arguments);
        var r = null,
          i = s(t);
        return (r = "." === e[0] ? (e = e.slice(1), (r = i.getElementsByClassName(e)).length ? r[0] : null) : "#" === e[0] ? (e = e.slice(1), i.getElementById(e)) : (r = i.getElementsByTagName(e)).length ? r[0] : null) ? this._wrapElement(r) : null
      }, h.default.prototype.selectAll = function(e, t) {
        h.default._validateParameters("selectAll", arguments);
        var r, i = [],
          a = s(t);
        if (r = "." === e[0] ? (e = e.slice(1), a.getElementsByClassName(e)) : a.getElementsByTagName(e))
          for (var n = 0; n < r.length; n++) {
            var o = this._wrapElement(r[n]);
            i.push(o)
          }
        return i
      }, h.default.prototype._wrapElement = function(e) {
        var t = Array.prototype.slice.call(e.children);
        if ("INPUT" !== e.tagName || "checkbox" !== e.type) return "VIDEO" === e.tagName || "AUDIO" === e.tagName ? new h.default.MediaElement(e, this) : "SELECT" === e.tagName ? this.createSelect(new h.default.Element(e, this)) : 0 < t.length && t.every(function(e) {
          return "INPUT" === e.tagName || "LABEL" === e.tagName
        }) ? this.createRadio(new h.default.Element(e, this)) : new h.default.Element(e, this);
        var r = new h.default.Element(e, this);
        return r.checked = function() {
          return 0 === arguments.length ? this.elt.checked : (arguments[0] ? this.elt.checked = !0 : this.elt.checked = !1, this)
        }, r
      }, h.default.prototype.removeElements = function(e) {
        h.default._validateParameters("removeElements", arguments);
        for (var t = 0; t < this._elements.length; t++) this._elements[t].elt instanceof HTMLCanvasElement || this._elements[t].remove()
      }, h.default.Element.prototype.changed = function(e) {
        return h.default.Element._adjustListener("change", e, this), this
      }, h.default.Element.prototype.input = function(e) {
        return h.default.Element._adjustListener("input", e, this), this
      };

      function a(e, t, r, i) {
        var a = document.createElement(t);
        "string" == typeof(r = r || "") && (r = [r]);
        for (var n = 0; n < r.length; n++) {
          var o = document.createElement("source");
          o.src = r[n], a.appendChild(o)
        }
        if (void 0 !== i) {
          a.addEventListener("canplaythrough", function e() {
            i(), a.removeEventListener("canplaythrough", e)
          })
        }
        var s = c(a, e, !0);
        return s.loadedmetadata = !1, a.addEventListener("loadedmetadata", function() {
          s.width = a.videoWidth, s.height = a.videoHeight, 0 === s.elt.width && (s.elt.width = a.videoWidth), 0 === s.elt.height && (s.elt.height = a.videoHeight), s.presetPlaybackRate && (s.elt.playbackRate = s.presetPlaybackRate, delete s.presetPlaybackRate), s.loadedmetadata = !0
        }), s
      } ["div", "p", "span"].forEach(function(r) {
        var e = "create" + r.charAt(0).toUpperCase() + r.slice(1);
        h.default.prototype[e] = function(e) {
          var t = document.createElement(r);
          return t.innerHTML = void 0 === e ? "" : e, c(t, this)
        }
      }), h.default.prototype.createImg = function() {
        h.default._validateParameters("createImg", arguments);
        var t, r = document.createElement("img"),
          i = arguments;
        return r.alt = i[1], 2 < i.length && "string" == typeof i[2] && (r.crossOrigin = i[2]), r.addEventListener("load", function() {
          t.width = r.offsetWidth || r.width, t.height = r.offsetHeight || r.height;
          var e = i[i.length - 1];
          "function" == typeof e && e()
        }), r.src = i[0], t = c(r, this)
      }, h.default.prototype.createA = function(e, t, r) {
        h.default._validateParameters("createA", arguments);
        var i = document.createElement("a");
        return i.href = e, i.innerHTML = t, r && (i.target = r), c(i, this)
      }, h.default.prototype.createSlider = function(e, t, r, i) {
        h.default._validateParameters("createSlider", arguments);
        var a = document.createElement("input");
        return a.type = "range", a.min = e, a.max = t, 0 === i ? a.step = 1e-18 : i && (a.step = i), "number" == typeof r && (a.value = r), c(a, this)
      }, h.default.prototype.createButton = function(e, t) {
        h.default._validateParameters("createButton", arguments);
        var r = document.createElement("button");
        return r.innerHTML = e, t && (r.value = t), c(r, this)
      }, h.default.prototype.createCheckbox = function() {
        h.default._validateParameters("createCheckbox", arguments);
        var e = document.createElement("div"),
          t = document.createElement("input");
        t.type = "checkbox", e.appendChild(t);
        var r = c(e, this);
        if (r.checked = function() {
            var e = r.elt.getElementsByTagName("input")[0];
            if (e) {
              if (0 === arguments.length) return e.checked;
              arguments[0] ? e.checked = !0 : e.checked = !1
            }
            return r
          }, this.value = function(e) {
            return r.value = e, this
          }, arguments[0]) {
          var i = Math.random().toString(36).slice(2),
            a = document.createElement("label");
          t.setAttribute("id", i), a.htmlFor = i, r.value(arguments[0]), a.appendChild(document.createTextNode(arguments[0])), e.appendChild(a)
        }
        return arguments[1] && (t.checked = !0), r
      }, h.default.prototype.createSelect = function() {
        var n, e;
        h.default._validateParameters("createSelect", arguments);
        var t = arguments[0];
        return "object" === d(t) && "SELECT" === t.elt.nodeName ? (e = t, n = this.elt = t.elt) : (n = document.createElement("select"), t && "boolean" == typeof t && n.setAttribute("multiple", "true"), e = c(n, this)), e.option = function(e, t) {
          for (var r, i = 0; i < this.elt.length; i++)
            if (this.elt[i].innerHTML === e) {
              r = i;
              break
            } if (void 0 !== r) !1 === t ? this.elt.remove(r) : this.elt[r].innerHTML === this.elt[r].value ? this.elt[r].innerHTML = this.elt[r].value = t : this.elt[r].value = t;
          else {
            var a = document.createElement("option");
            a.innerHTML = e, 1 < arguments.length ? a.value = t : a.value = e, n.appendChild(a), this._pInst._elements.push(a)
          }
        }, e.selected = function(e) {
          var t, r = [];
          if (0 < arguments.length) {
            for (t = 0; t < this.elt.length; t++) e.toString() === this.elt[t].value && (this.elt.selectedIndex = t);
            return this
          }
          if (this.elt.getAttribute("multiple")) {
            for (t = 0; t < this.elt.selectedOptions.length; t++) r.push(this.elt.selectedOptions[t].value);
            return r
          }
          return this.elt.value
        }, e
      }, h.default.prototype.createRadio = function(e) {
        h.default._validateParameters("createRadio", arguments);
        var a, i, t = document.querySelectorAll("input[type=radio]"),
          n = 0;
        if (1 < t.length)
          for (var r = t.length, o = t[0].name, s = t[1].name, l = n = 1; l < r; l++) o !== (s = t[l].name) && n++, o = s;
        else 1 === t.length && (n = 1);
        "object" === d(e) ? (i = e, a = this.elt = e.elt) : (a = document.createElement("div"), i = c(a, this)), i._getInputChildrenArray = function() {
          return Array.prototype.slice.call(this.elt.children).filter(function(e) {
            return "INPUT" === e.tagName
          })
        };
        var u = -1;
        return i.option = function(e, t) {
          var r = document.createElement("input");
          if (r.type = "radio", r.innerHTML = e, r.value = t || e, r.setAttribute("name", "defaultradio" + n), a.appendChild(r), e) {
            u++;
            var i = document.createElement("label");
            r.setAttribute("id", "defaultradio" + n + "-" + u), i.htmlFor = "defaultradio" + n + "-" + u, i.appendChild(document.createTextNode(e)), a.appendChild(i)
          }
          return r
        }, i.selected = function(e) {
          var t, r = i._getInputChildrenArray();
          if (e) {
            for (t = 0; t < r.length; t++) r[t].value === e && (r[t].checked = !0);
            return this
          }
          for (t = 0; t < r.length; t++)
            if (!0 === r[t].checked) return r[t].value
        }, i.value = function(e) {
          var t, r = i._getInputChildrenArray();
          if (e) {
            for (t = 0; t < r.length; t++) r[t].value === e && (r[t].checked = !0);
            return this
          }
          for (t = 0; t < r.length; t++)
            if (!0 === r[t].checked) return r[t].value;
          return ""
        }, i
      }, h.default.prototype.createColorPicker = function(e) {
        h.default._validateParameters("createColorPicker", arguments);
        var t, r = document.createElement("input");
        return r.type = "color", e ? e instanceof h.default.Color ? r.value = e.toString("#rrggbb") : (h.default.prototype._colorMode = "rgb", h.default.prototype._colorMaxes = {
          rgb: [255, 255, 255, 255],
          hsb: [360, 100, 100, 1],
          hsl: [360, 100, 100, 1]
        }, r.value = h.default.prototype.color(e).toString("#rrggbb")) : r.value = "#000000", (t = c(r, this)).color = function() {
          return e.mode && (h.default.prototype._colorMode = e.mode), e.maxes && (h.default.prototype._colorMaxes = e.maxes), h.default.prototype.color(this.elt.value)
        }, t
      }, h.default.prototype.createInput = function(e, t) {
        h.default._validateParameters("createInput", arguments);
        var r = document.createElement("input");
        return r.type = t || "text", e && (r.value = e), c(r, this)
      }, h.default.prototype.createFileInput = function(a, e) {
        if (h.default._validateParameters("createFileInput", arguments), window.File && window.FileReader && window.FileList && window.Blob) {
          var t = document.createElement("input");
          return t.type = "file", e && (t.multiple = "multiple"), t.addEventListener("change", function(e) {
            for (var t = e.target.files, r = 0; r < t.length; r++) {
              var i = t[r];
              h.default.File._load(i, a)
            }
          }, !1), c(t, this)
        }
        console.log("The File APIs are not fully supported in this browser. Cannot create element.")
      }, h.default.prototype.createVideo = function(e, t) {
        return h.default._validateParameters("createVideo", arguments), a(this, "video", e, t)
      }, h.default.prototype.createAudio = function(e, t) {
        return h.default._validateParameters("createAudio", arguments), a(this, "audio", e, t)
      }, h.default.prototype.VIDEO = "video", h.default.prototype.AUDIO = "audio",
        // void 0 === navigator.mediaDevices && (navigator.mediaDevices = {}), void 0 === navigator.mediaDevices.getUserMedia && (navigator.mediaDevices.getUserMedia = function(r) {
        // var i = navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
        // return i ? new Promise(function(e, t) {
          // i.call(navigator, r, e, t)
        // }) : Promise.reject(new Error("getUserMedia is not implemented in this browser"))
      // }),
      // h.default.prototype.createCapture = function() {
      //   h.default._validateParameters("createCapture", arguments);
      //   for (var e, t, r = !0, i = !0, a = 0; a < arguments.length; a++) arguments[a] === h.default.prototype.VIDEO ? i = !1 : arguments[a] === h.default.prototype.AUDIO ? r = !1 : "object" === d(arguments[a]) ? e = arguments[a] : "function" == typeof arguments[a] && (t = arguments[a]);
      //   if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw "getUserMedia not supported in this browser";
      //   var n = document.createElement("video");
      //   n.setAttribute("playsinline", ""), e || (e = {
      //     video: r,
      //     audio: i
      //   }), navigator.mediaDevices.getUserMedia(e).then(function(t) {
      //     try {
      //       "srcObject" in n ? n.srcObject = t : n.src = window.URL.createObjectURL(t)
      //     } catch (e) {
      //       n.src = t
      //     }
      //   }, function(e) {
      //     console.log(e)
      //   });
      //   var o = c(n, this, !0);
      //   return o.loadedmetadata = !1, n.addEventListener("loadedmetadata", function() {
      //     n.play(), n.width ? (o.width = n.videoWidth = n.width, o.height = n.videoHeight = n.height) : (o.width = o.elt.width = n.videoWidth, o.height = o.elt.height = n.videoHeight), o.loadedmetadata = !0, t && t(n.srcObject)
      //   }), o
      // },
      h.default.prototype.createElement = function(e, t) {
        h.default._validateParameters("createElement", arguments);
        var r = document.createElement(e);
        return void 0 !== t && (r.innerHTML = t), c(r, this)
      }, h.default.Element.prototype.addClass = function(e) {
        return this.elt.className ? this.hasClass(e) || (this.elt.className = this.elt.className + " " + e) : this.elt.className = e, this
      }, h.default.Element.prototype.removeClass = function(e) {
        return this.elt.classList.remove(e), this
      }, h.default.Element.prototype.hasClass = function(e) {
        return this.elt.classList.contains(e)
      }, h.default.Element.prototype.toggleClass = function(e) {
        return this.elt.classList.contains(e) ? this.elt.classList.remove(e) : this.elt.classList.add(e), this
      }, h.default.Element.prototype.child = function(e) {
        return void 0 === e ? this.elt.childNodes : ("string" == typeof e ? ("#" === e[0] && (e = e.substring(1)), e = document.getElementById(e)) : e instanceof h.default.Element && (e = e.elt), this.elt.appendChild(e), this)
      }, h.default.Element.prototype.center = function(e) {
        var t = this.elt.style.display,
          r = "none" === this.elt.style.display,
          i = "none" === this.parent().style.display,
          a = {
            x: this.elt.offsetLeft,
            y: this.elt.offsetTop
          };
        r && this.show(), this.elt.style.display = "block", this.position(0, 0), i && (this.parent().style.display = "block");
        var n = Math.abs(this.parent().offsetWidth - this.elt.offsetWidth),
          o = Math.abs(this.parent().offsetHeight - this.elt.offsetHeight),
          s = a.y,
          l = a.x;
        return "both" === e || void 0 === e ? this.position(n / 2, o / 2) : "horizontal" === e ? this.position(n / 2, s) : "vertical" === e && this.position(l, o / 2), this.style("display", t), r && this.hide(), i && (this.parent().style.display = "none"), this
      }, h.default.Element.prototype.html = function() {
        return 0 === arguments.length ? this.elt.innerHTML : (arguments[1] ? this.elt.innerHTML += arguments[0] : this.elt.innerHTML = arguments[0], this)
      }, h.default.Element.prototype.position = function() {
        return 0 === arguments.length ? {
          x: this.elt.offsetLeft,
          y: this.elt.offsetTop
        } : (this.elt.style.position = "absolute", this.elt.style.left = arguments[0] + "px", this.elt.style.top = arguments[1] + "px", this.x = arguments[0], this.y = arguments[1], this)
      }, h.default.Element.prototype._translate = function() {
        this.elt.style.position = "absolute";
        var e = "";
        return this.elt.style.transform && (e = (e = this.elt.style.transform.replace(/translate3d\(.*\)/g, "")).replace(/translate[X-Z]?\(.*\)/g, "")), 2 === arguments.length ? this.elt.style.transform = "translate(" + arguments[0] + "px, " + arguments[1] + "px)" : 2 < arguments.length && (this.elt.style.transform = "translate3d(" + arguments[0] + "px," + arguments[1] + "px," + arguments[2] + "px)", 3 === arguments.length ? this.elt.parentElement.style.perspective = "1000px" : this.elt.parentElement.style.perspective = arguments[3] + "px"), this.elt.style.transform += e, this
      }, h.default.Element.prototype._rotate = function() {
        var e = "";
        return this.elt.style.transform && (e = (e = this.elt.style.transform.replace(/rotate3d\(.*\)/g, "")).replace(/rotate[X-Z]?\(.*\)/g, "")), 1 === arguments.length ? this.elt.style.transform = "rotate(" + arguments[0] + "deg)" : 2 === arguments.length ? this.elt.style.transform = "rotate(" + arguments[0] + "deg, " + arguments[1] + "deg)" : 3 === arguments.length && (this.elt.style.transform = "rotateX(" + arguments[0] + "deg)", this.elt.style.transform += "rotateY(" + arguments[1] + "deg)", this.elt.style.transform += "rotateZ(" + arguments[2] + "deg)"), this.elt.style.transform += e, this
      }, h.default.Element.prototype.style = function(e, t) {
        if (t instanceof h.default.Color && (t = "rgba(" + t.levels[0] + "," + t.levels[1] + "," + t.levels[2] + "," + t.levels[3] / 255 + ")"), void 0 === t) {
          if (-1 === e.indexOf(":")) return window.getComputedStyle(this.elt).getPropertyValue(e);
          for (var r = e.split(";"), i = 0; i < r.length; i++) {
            var a = r[i].split(":");
            a[0] && a[1] && (this.elt.style[a[0].trim()] = a[1].trim())
          }
        } else if (this.elt.style[e] = t, "width" === e || "height" === e || "left" === e || "top" === e) {
          var n = t.replace(/\D+/g, "");
          this[e] = parseInt(n, 10)
        }
        return this
      }, h.default.Element.prototype.attribute = function(e, t) {
        if (null == this.elt.firstChild || "checkbox" !== this.elt.firstChild.type && "radio" !== this.elt.firstChild.type) return void 0 === t ? this.elt.getAttribute(e) : (this.elt.setAttribute(e, t), this);
        if (void 0 === t) return this.elt.firstChild.getAttribute(e);
        for (var r = 0; r < this.elt.childNodes.length; r++) this.elt.childNodes[r].setAttribute(e, t)
      }, h.default.Element.prototype.removeAttribute = function(e) {
        if (null != this.elt.firstChild && ("checkbox" === this.elt.firstChild.type || "radio" === this.elt.firstChild.type))
          for (var t = 0; t < this.elt.childNodes.length; t++) this.elt.childNodes[t].removeAttribute(e);
        return this.elt.removeAttribute(e), this
      }, h.default.Element.prototype.value = function() {
        return 0 < arguments.length ? (this.elt.value = arguments[0], this) : "range" === this.elt.type ? parseFloat(this.elt.value) : this.elt.value
      }, h.default.Element.prototype.show = function() {
        return this.elt.style.display = "block", this
      }, h.default.Element.prototype.hide = function() {
        return this.elt.style.display = "none", this
      }, h.default.Element.prototype.size = function(e, t) {
        if (0 === arguments.length) return {
          width: this.elt.offsetWidth,
          height: this.elt.offsetHeight
        };
        var r = e,
          i = t,
          a = h.default.prototype.AUTO;
        if (r !== a || i !== a) {
          if (r === a ? r = t * this.width / this.height : i === a && (i = e * this.height / this.width), this.elt instanceof HTMLCanvasElement) {
            var n, o = {},
              s = this.elt.getContext("2d");
            for (n in s) o[n] = s[n];
            for (n in this.elt.setAttribute("width", r * this._pInst._pixelDensity), this.elt.setAttribute("height", i * this._pInst._pixelDensity), this.elt.style.width = r + "px", this.elt.style.height = i + "px", this._pInst.scale(this._pInst._pixelDensity, this._pInst._pixelDensity), o) this.elt.getContext("2d")[n] = o[n]
          } else this.elt.style.width = r + "px", this.elt.style.height = i + "px", this.elt.width = r, this.elt.height = i;
          this.width = this.elt.offsetWidth, this.height = this.elt.offsetHeight, this._pInst && this._pInst._curElement && this._pInst._curElement.elt === this.elt && (this._pInst._setProperty("width", this.elt.offsetWidth), this._pInst._setProperty("height", this.elt.offsetHeight))
        }
        return this
      }, h.default.Element.prototype.remove = function() {
        for (var e in this._events) this.elt.removeEventListener(e, this._events[e]);
        this.elt && this.elt.parentNode && this.elt.parentNode.removeChild(this.elt)
      }, h.default.Element.prototype.drop = function(a, n) {
        if (window.File && window.FileReader && window.FileList && window.Blob) {
          if (!this._dragDisabled) {
            this._dragDisabled = !0;
            var e = function(e) {
              e.preventDefault()
            };
            this.elt.addEventListener("dragover", e), this.elt.addEventListener("dragleave", e)
          }
          h.default.Element._attachListener("drop", function(e) {
            e.preventDefault(), "function" == typeof n && n.call(this, e);
            for (var t = e.dataTransfer.files, r = 0; r < t.length; r++) {
              var i = t[r];
              h.default.File._load(i, a)
            }
          }, this)
        } else console.log("The File APIs are not fully supported in this browser.");
        return this
      }, h.default.MediaElement = function(i, e) {
        h.default.Element.call(this, i, e);
        var a = this;
        this.elt.crossOrigin = "anonymous", this._prevTime = 0, this._cueIDCounter = 0, this._cues = [], (this._pixelsState = this)._pixelDensity = 1, this._modified = !1, Object.defineProperty(a, "src", {
          get: function() {
            var e = a.elt.children[0].src,
              t = a.elt.src === window.location.href ? "" : a.elt.src;
            return e === window.location.href ? t : e
          },
          set: function(e) {
            for (var t = 0; t < a.elt.children.length; t++) a.elt.removeChild(a.elt.children[t]);
            var r = document.createElement("source");
            r.src = e, i.appendChild(r), a.elt.src = e, a.modified = !0
          }
        }), a._onended = function() {}, a.elt.onended = function() {
          a._onended(a)
        }
      }, h.default.MediaElement.prototype = Object.create(h.default.Element.prototype), h.default.MediaElement.prototype.play = function() {
        var e;
        return this.elt.currentTime === this.elt.duration && (this.elt.currentTime = 0), (e = (1 < this.elt.readyState || this.elt.load(), this.elt.play())) && e.catch && e.catch(function(e) {
          console.log("WARN: Element play method raised an error asynchronously", e)
        }), this
      }, h.default.MediaElement.prototype.stop = function() {
        return this.elt.pause(), this.elt.currentTime = 0, this
      }, h.default.MediaElement.prototype.pause = function() {
        return this.elt.pause(), this
      }, h.default.MediaElement.prototype.loop = function() {
        return this.elt.setAttribute("loop", !0), this.play(), this
      }, h.default.MediaElement.prototype.noLoop = function() {
        return this.elt.setAttribute("loop", !1), this
      }, h.default.MediaElement.prototype.autoplay = function(e) {
        return this.elt.setAttribute("autoplay", e), this
      }, h.default.MediaElement.prototype.volume = function(e) {
        if (void 0 === e) return this.elt.volume;
        this.elt.volume = e
      }, h.default.MediaElement.prototype.speed = function(e) {
        if (void 0 === e) return this.presetPlaybackRate || this.elt.playbackRate;
        this.loadedmetadata ? this.elt.playbackRate = e : this.presetPlaybackRate = e
      }, h.default.MediaElement.prototype.time = function(e) {
        return void 0 === e ? this.elt.currentTime : (this.elt.currentTime = e, this)
      }, h.default.MediaElement.prototype.duration = function() {
        return this.elt.duration
      }, h.default.MediaElement.prototype.pixels = [], h.default.MediaElement.prototype._ensureCanvas = function() {
        this.canvas || (this.canvas = document.createElement("canvas"), this.drawingContext = this.canvas.getContext("2d"), this.setModified(!0)), this.loadedmetadata && (this.canvas.width !== this.elt.width && (this.canvas.width = this.elt.width, this.canvas.height = this.elt.height, this.width = this.canvas.width, this.height = this.canvas.height), this.drawingContext.drawImage(this.elt, 0, 0, this.canvas.width, this.canvas.height), this.setModified(!0))
      }, h.default.MediaElement.prototype.loadPixels = function() {
        return this._ensureCanvas(), h.default.Renderer2D.prototype.loadPixels.apply(this, arguments)
      }, h.default.MediaElement.prototype.updatePixels = function(e, t, r, i) {
        return this.loadedmetadata && (this._ensureCanvas(), h.default.Renderer2D.prototype.updatePixels.call(this, e, t, r, i)), this.setModified(!0), this
      }, h.default.MediaElement.prototype.get = function() {
        return this._ensureCanvas(), h.default.Renderer2D.prototype.get.apply(this, arguments)
      }, h.default.MediaElement.prototype._getPixel = function() {
        return this.loadPixels(), h.default.Renderer2D.prototype._getPixel.apply(this, arguments)
      }, h.default.MediaElement.prototype.set = function(e, t, r) {
        this.loadedmetadata && (this._ensureCanvas(), h.default.Renderer2D.prototype.set.call(this, e, t, r), this.setModified(!0))
      }, h.default.MediaElement.prototype.copy = function() {
        this._ensureCanvas(), h.default.prototype.copy.apply(this, arguments)
      }, h.default.MediaElement.prototype.mask = function() {
        this.loadPixels(), this.setModified(!0), h.default.Image.prototype.mask.apply(this, arguments)
      }, h.default.MediaElement.prototype.isModified = function() {
        return this._modified
      }, h.default.MediaElement.prototype.setModified = function(e) {
        this._modified = e
      }, h.default.MediaElement.prototype.onended = function(e) {
        return this._onended = e, this
      }, h.default.MediaElement.prototype.connect = function(e) {
        var t, r;
        if ("function" == typeof h.default.prototype.getAudioContext) t = h.default.prototype.getAudioContext(), r = h.default.soundOut.input;
        else try {
          r = (t = e.context).destination
        } catch (e) {
          throw "connect() is meant to be used with Web Audio API or p5.sound.js"
        }
        this.audioSourceNode || (this.audioSourceNode = t.createMediaElementSource(this.elt), this.audioSourceNode.connect(r)), e ? e.input ? this.audioSourceNode.connect(e.input) : this.audioSourceNode.connect(e) : this.audioSourceNode.connect(r)
      }, h.default.MediaElement.prototype.disconnect = function() {
        if (!this.audioSourceNode) throw "nothing to disconnect";
        this.audioSourceNode.disconnect()
      }, h.default.MediaElement.prototype.showControls = function() {
        this.elt.style["text-align"] = "inherit", this.elt.controls = !0
      }, h.default.MediaElement.prototype.hideControls = function() {
        this.elt.controls = !1
      };
      var n = function(e, t, r, i) {
        this.callback = e, this.time = t, this.id = r, this.val = i
      };
      h.default.MediaElement.prototype.addCue = function(e, t, r) {
        var i = this._cueIDCounter++,
          a = new n(t, e, i, r);
        return this._cues.push(a), this.elt.ontimeupdate || (this.elt.ontimeupdate = this._onTimeUpdate.bind(this)), i
      }, h.default.MediaElement.prototype.removeCue = function(e) {
        for (var t = 0; t < this._cues.length; t++) this._cues[t].id === e && (console.log(e), this._cues.splice(t, 1));
        0 === this._cues.length && (this.elt.ontimeupdate = null)
      }, h.default.MediaElement.prototype.clearCues = function() {
        this._cues = [], this.elt.ontimeupdate = null
      }, h.default.MediaElement.prototype._onTimeUpdate = function() {
        for (var e = this.time(), t = 0; t < this._cues.length; t++) {
          var r = this._cues[t].time,
            i = this._cues[t].val;
          this._prevTime < r && r <= e && this._cues[t].callback(i)
        }
        this._prevTime = e
      }, h.default.File = function(e, t) {
        this.file = e, this._pInst = t;
        var r = e.type.split("/");
        this.type = r[0], this.subtype = r[1], this.name = e.name, this.size = e.size, this.data = void 0
      }, h.default.File._createLoader = function(r, i) {
        var e = new FileReader;
        return e.onload = function(e) {
          var t = new h.default.File(r);
          t.data = e.target.result, i(t)
        }, e
      }, h.default.File._load = function(e, t) {
        if (/^text\//.test(e.type)) h.default.File._createLoader(e, t).readAsText(e);
        else if (/^(video|audio)\//.test(e.type)) {
          var r = new h.default.File(e);
          r.data = URL.createObjectURL(e), t(r)
        } else h.default.File._createLoader(e, t).readAsDataURL(e)
      };
      var o = h.default;
      r.default = o
    }, {
      "../core/main": 26
    }],
    43: [function(e, t, r) {
      "use strict";
      Object.defineProperty(r, "__esModule", {
        value: !0
      }), r.default = void 0;
      var i, a = (i = e("../core/main")) && i.__esModule ? i : {
        default: i
      };
      a.default.prototype.deviceOrientation = void 0, a.default.prototype.accelerationX = 0, a.default.prototype.accelerationY = 0, a.default.prototype.accelerationZ = 0, a.default.prototype.pAccelerationX = 0, a.default.prototype.pAccelerationY = 0, a.default.prototype.pAccelerationZ = 0, a.default.prototype._updatePAccelerations = function() {
        this._setProperty("pAccelerationX", this.accelerationX), this._setProperty("pAccelerationY", this.accelerationY), this._setProperty("pAccelerationZ", this.accelerationZ)
      }, a.default.prototype.rotationX = 0, a.default.prototype.rotationY = 0, a.default.prototype.rotationZ = 0, a.default.prototype.pRotationX = 0, a.default.prototype.pRotationY = 0;
      var d = a.default.prototype.pRotationZ = 0,
        c = 0,
        f = 0,
        p = "clockwise",
        m = "clockwise",
        v = "clockwise";
      a.default.prototype.pRotateDirectionX = void 0, a.default.prototype.pRotateDirectionY = void 0, a.default.prototype.pRotateDirectionZ = void 0, a.default.prototype._updatePRotations = function() {
        this._setProperty("pRotationX", this.rotationX), this._setProperty("pRotationY", this.rotationY), this._setProperty("pRotationZ", this.rotationZ)
      }, a.default.prototype.turnAxis = void 0;
      var g = .5,
        y = 30;
      a.default.prototype.setMoveThreshold = function(e) {
        a.default._validateParameters("setMoveThreshold", arguments), g = e
      }, a.default.prototype.setShakeThreshold = function(e) {
        a.default._validateParameters("setShakeThreshold", arguments), y = e
      }, a.default.prototype._ondeviceorientation = function(e) {
        this._updatePRotations(), this._setProperty("rotationX", e.beta), this._setProperty("rotationY", e.gamma), this._setProperty("rotationZ", e.alpha), this._handleMotion()
      }, a.default.prototype._ondevicemotion = function(e) {
        this._updatePAccelerations(), this._setProperty("accelerationX", 2 * e.acceleration.x), this._setProperty("accelerationY", 2 * e.acceleration.y), this._setProperty("accelerationZ", 2 * e.acceleration.z), this._handleMotion()
      }, a.default.prototype._handleMotion = function() {
        90 === window.orientation || -90 === window.orientation ? this._setProperty("deviceOrientation", "landscape") : 0 === window.orientation ? this._setProperty("deviceOrientation", "portrait") : void 0 === window.orientation && this._setProperty("deviceOrientation", "undefined");
        var e = this.deviceMoved || window.deviceMoved;
        "function" == typeof e && (Math.abs(this.accelerationX - this.pAccelerationX) > g || Math.abs(this.accelerationY - this.pAccelerationY) > g || Math.abs(this.accelerationZ - this.pAccelerationZ) > g) && e();
        var t = this.deviceTurned || window.deviceTurned;
        if ("function" == typeof t) {
          var r = this.rotationX + 180,
            i = this.pRotationX + 180,
            a = d + 180;
          0 < r - i && r - i < 270 || r - i < -270 ? p = "clockwise" : (r - i < 0 || 270 < r - i) && (p = "counter-clockwise"), p !== this.pRotateDirectionX && (a = r), 90 < Math.abs(r - a) && Math.abs(r - a) < 270 && (a = r, this._setProperty("turnAxis", "X"), t()), this.pRotateDirectionX = p, d = a - 180;
          var n = this.rotationY + 180,
            o = this.pRotationY + 180,
            s = c + 180;
          0 < n - o && n - o < 270 || n - o < -270 ? m = "clockwise" : (n - o < 0 || 270 < n - this.pRotationY) && (m = "counter-clockwise"), m !== this.pRotateDirectionY && (s = n), 90 < Math.abs(n - s) && Math.abs(n - s) < 270 && (s = n, this._setProperty("turnAxis", "Y"), t()), this.pRotateDirectionY = m, c = s - 180, 0 < this.rotationZ - this.pRotationZ && this.rotationZ - this.pRotationZ < 270 || this.rotationZ - this.pRotationZ < -270 ? v = "clockwise" : (this.rotationZ - this.pRotationZ < 0 || 270 < this.rotationZ - this.pRotationZ) && (v = "counter-clockwise"), v !== this.pRotateDirectionZ && (f = this.rotationZ), 90 < Math.abs(this.rotationZ - f) && Math.abs(this.rotationZ - f) < 270 && (f = this.rotationZ, this._setProperty("turnAxis", "Z"), t()), this.pRotateDirectionZ = v, this._setProperty("turnAxis", void 0)
        }
        var l, u, h = this.deviceShaken || window.deviceShaken;
        "function" == typeof h && (null !== this.pAccelerationX && (l = Math.abs(this.accelerationX - this.pAccelerationX), u = Math.abs(this.accelerationY - this.pAccelerationY)), y < l + u && h())
      };
      var n = a.default;
      r.default = n
    }, {
      "../core/main": 26
    }],
    44: [function(e, t, r) {
      "use strict";
      Object.defineProperty(r, "__esModule", {
        value: !0
      }), r.default = void 0;
      var i, a = (i = e("../core/main")) && i.__esModule ? i : {
        default: i
      };
      a.default.prototype.isKeyPressed = !1, a.default.prototype.keyIsPressed = !1, a.default.prototype.key = "", a.default.prototype.keyCode = 0, a.default.prototype._onkeydown = function(e) {
        if (!this._downKeys[e.which]) {
          this._setProperty("isKeyPressed", !0), this._setProperty("keyIsPressed", !0), this._setProperty("keyCode", e.which), this._downKeys[e.which] = !0, this._setProperty("key", e.key || String.fromCharCode(e.which) || e.which);
          var t = this.keyPressed || window.keyPressed;
          if ("function" == typeof t && !e.charCode) !1 === t(e) && e.preventDefault()
        }
      }, a.default.prototype._onkeyup = function(e) {
        var t = this.keyReleased || window.keyReleased;
        (this._downKeys[e.which] = !1, this._areDownKeys() || (this._setProperty("isKeyPressed", !1), this._setProperty("keyIsPressed", !1)), this._setProperty("_lastKeyCodeTyped", null), this._setProperty("key", e.key || String.fromCharCode(e.which) || e.which), this._setProperty("keyCode", e.which), "function" == typeof t) && (!1 === t(e) && e.preventDefault())
      }, a.default.prototype._onkeypress = function(e) {
        if (e.which !== this._lastKeyCodeTyped) {
          this._setProperty("_lastKeyCodeTyped", e.which), this._setProperty("key", String.fromCharCode(e.which));
          var t = this.keyTyped || window.keyTyped;
          if ("function" == typeof t) !1 === t(e) && e.preventDefault()
        }
      }, a.default.prototype._onblur = function(e) {
        this._downKeys = {}
      }, a.default.prototype.keyIsDown = function(e) {
        return a.default._validateParameters("keyIsDown", arguments), this._downKeys[e] || !1
      }, a.default.prototype._areDownKeys = function() {
        for (var e in this._downKeys)
          if (this._downKeys.hasOwnProperty(e) && !0 === this._downKeys[e]) return !0;
        return !1
      };
      var n = a.default;
      r.default = n
    }, {
      "../core/main": 26
    }],
    45: [function(e, t, r) {
      "use strict";
      Object.defineProperty(r, "__esModule", {
        value: !0
      }), r.default = void 0;
      var i, a = (i = e("../core/main")) && i.__esModule ? i : {
          default: i
        },
        n = function(e) {
          {
            if (e && e.__esModule) return e;
            var t = {};
            if (null != e)
              for (var r in e)
                if (Object.prototype.hasOwnProperty.call(e, r)) {
                  var i = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(e, r) : {};
                  i.get || i.set ? Object.defineProperty(t, r, i) : t[r] = e[r]
                } return t.default = e, t
          }
        }(e("../core/constants"));
      a.default.prototype.movedX = 0, a.default.prototype.movedY = 0, a.default.prototype._hasMouseInteracted = !1, a.default.prototype.mouseX = 0, a.default.prototype.mouseY = 0, a.default.prototype.pmouseX = 0, a.default.prototype.pmouseY = 0, a.default.prototype.winMouseX = 0, a.default.prototype.winMouseY = 0, a.default.prototype.pwinMouseX = 0, a.default.prototype.pwinMouseY = 0, a.default.prototype.mouseButton = 0, a.default.prototype.mouseIsPressed = !1, a.default.prototype._updateNextMouseCoords = function(e) {
        if (null !== this._curElement && (!e.touches || 0 < e.touches.length)) {
          var t = function(e, t, r, i) {
            i && !i.clientX && (i.touches ? i = i.touches[0] : i.changedTouches && (i = i.changedTouches[0]));
            var a = e.getBoundingClientRect(),
              n = e.scrollWidth / t || 1,
              o = e.scrollHeight / r || 1;
            return {
              x: (i.clientX - a.left) / n,
              y: (i.clientY - a.top) / o,
              winX: i.clientX,
              winY: i.clientY,
              id: i.identifier
            }
          }(this._curElement.elt, this.width, this.height, e);
          this._setProperty("movedX", e.movementX), this._setProperty("movedY", e.movementY), this._setProperty("mouseX", t.x), this._setProperty("mouseY", t.y), this._setProperty("winMouseX", t.winX), this._setProperty("winMouseY", t.winY)
        }
        this._hasMouseInteracted || (this._updateMouseCoords(), this._setProperty("_hasMouseInteracted", !0))
      }, a.default.prototype._updateMouseCoords = function() {
        this._setProperty("pmouseX", this.mouseX), this._setProperty("pmouseY", this.mouseY), this._setProperty("pwinMouseX", this.winMouseX), this._setProperty("pwinMouseY", this.winMouseY), this._setProperty("_pmouseWheelDeltaY", this._mouseWheelDeltaY)
      }, a.default.prototype._setMouseButton = function(e) {
        1 === e.button ? this._setProperty("mouseButton", n.CENTER) : 2 === e.button ? this._setProperty("mouseButton", n.RIGHT) : this._setProperty("mouseButton", n.LEFT)
      }, a.default.prototype._onmousemove = function(e) {
        var t = this._isGlobal ? window : this;
        this._updateNextMouseCoords(e), this.mouseIsPressed ? "function" == typeof t.mouseDragged ? !1 === t.mouseDragged(e) && e.preventDefault() : "function" == typeof t.touchMoved && !1 === t.touchMoved(e) && e.preventDefault() : "function" == typeof t.mouseMoved && !1 === t.mouseMoved(e) && e.preventDefault()
      }, a.default.prototype._onmousedown = function(e) {
        var t = this._isGlobal ? window : this;
        this._setProperty("mouseIsPressed", !0), this._setMouseButton(e), this._updateNextMouseCoords(e), "function" == typeof t.mousePressed ? !1 === t.mousePressed(e) && e.preventDefault() : navigator.userAgent.toLowerCase().includes("safari") && "function" == typeof t.touchStarted && !1 === t.touchStarted(e) && e.preventDefault()
      }, a.default.prototype._onmouseup = function(e) {
        var t = this._isGlobal ? window : this;
        this._setProperty("mouseIsPressed", !1), "function" == typeof t.mouseReleased ? !1 === t.mouseReleased(e) && e.preventDefault() : "function" == typeof t.touchEnded && !1 === t.touchEnded(e) && e.preventDefault()
      }, a.default.prototype._ondragend = a.default.prototype._onmouseup, a.default.prototype._ondragover = a.default.prototype._onmousemove, a.default.prototype._onclick = function(e) {
        var t = this._isGlobal ? window : this;
        "function" == typeof t.mouseClicked && (!1 === t.mouseClicked(e) && e.preventDefault())
      }, a.default.prototype._ondblclick = function(e) {
        var t = this._isGlobal ? window : this;
        "function" == typeof t.doubleClicked && (!1 === t.doubleClicked(e) && e.preventDefault())
      }, a.default.prototype._mouseWheelDeltaY = 0, a.default.prototype._pmouseWheelDeltaY = 0, a.default.prototype._onwheel = function(e) {
        var t = this._isGlobal ? window : this;
        (this._setProperty("_mouseWheelDeltaY", e.deltaY), "function" == typeof t.mouseWheel) && (e.delta = e.deltaY, !1 === t.mouseWheel(e) && e.preventDefault())
      }, a.default.prototype.requestPointerLock = function() {
        var e = this._curElement.elt;
        return e.requestPointerLock = e.requestPointerLock || e.mozRequestPointerLock, e.requestPointerLock ? (e.requestPointerLock(), !0) : (console.log("requestPointerLock is not implemented in this browser"), !1)
      }, a.default.prototype.exitPointerLock = function() {
        document.exitPointerLock()
      };
      var o = a.default;
      r.default = o
    }, {
      "../core/constants": 20,
      "../core/main": 26
    }],
    46: [function(e, t, r) {
      "use strict";
      Object.defineProperty(r, "__esModule", {
        value: !0
      }), r.default = void 0;
      var i, a = (i = e("../core/main")) && i.__esModule ? i : {
        default: i
      };

      function n(e, t, r, i) {
        var a = 4 < arguments.length && void 0 !== arguments[4] ? arguments[4] : 0,
          n = e.getBoundingClientRect(),
          o = e.scrollWidth / t || 1,
          s = e.scrollHeight / r || 1,
          l = i.touches[a] || i.changedTouches[a];
        return {
          x: (l.clientX - n.left) / o,
          y: (l.clientY - n.top) / s,
          winX: l.clientX,
          winY: l.clientY,
          id: l.identifier
        }
      }
      a.default.prototype.touches = [], a.default.prototype._updateTouchCoords = function(e) {
        if (null !== this._curElement) {
          for (var t = [], r = 0; r < e.touches.length; r++) t[r] = n(this._curElement.elt, this.width, this.height, e, r);
          this._setProperty("touches", t)
        }
      }, a.default.prototype._ontouchstart = function(e) {
        var t = this._isGlobal ? window : this;
        this._setProperty("mouseIsPressed", !0), this._updateTouchCoords(e), this._updateNextMouseCoords(e), this._updateMouseCoords(), "function" == typeof t.touchStarted ? !1 === t.touchStarted(e) && e.preventDefault() : navigator.userAgent.toLowerCase().includes("safari") && "function" == typeof t.touchStarted && !1 === t.mousePressed(e) && e.preventDefault()
      }, a.default.prototype._ontouchmove = function(e) {
        var t = this._isGlobal ? window : this;
        this._updateTouchCoords(e), this._updateNextMouseCoords(e), "function" == typeof t.touchMoved ? !1 === t.touchMoved(e) && e.preventDefault() : "function" == typeof t.mouseDragged && !1 === t.mouseDragged(e) && e.preventDefault()
      }, a.default.prototype._ontouchend = function(e) {
        this._setProperty("mouseIsPressed", !1), this._updateTouchCoords(e), this._updateNextMouseCoords(e);
        var t = this._isGlobal ? window : this;
        "function" == typeof t.touchEnded ? !1 === t.touchEnded(e) && e.preventDefault() : "function" == typeof t.mouseReleased && !1 === t.mouseReleased(e) && e.preventDefault()
      };
      var o = a.default;
      r.default = o
    }, {
      "../core/main": 26
    }],
    47: [function(e, t, r) {
      "use strict";
      Object.defineProperty(r, "__esModule", {
        value: !0
      }), r.default = void 0;
      var P, L, R, O, D = {};

      function i(e, t) {
        for (var r, i, a, n, o, s, l, u, h, d, c = D._toPixels(e), f = e.width, p = e.height, m = f * p, v = new Int32Array(m), g = 0; g < m; g++) v[g] = D._getARGB(c, g);
        var y, _, b, x, w = new Int32Array(m),
          S = new Int32Array(m),
          M = new Int32Array(m),
          E = new Int32Array(m),
          T = 0;
        for (function(e) {
            var t = 3.5 * e | 0;
            if (P !== (t = t < 1 ? 1 : t < 248 ? t : 248)) {
              L = 1 + (P = t) << 1, R = new Int32Array(L), O = new Array(L);
              for (var r = 0; r < L; r++) O[r] = new Int32Array(256);
              for (var i, a, n, o, s = 1, l = t - 1; s < t; s++) {
                R[t + s] = R[l] = a = l * l, n = O[t + s], o = O[l--];
                for (var u = 0; u < 256; u++) n[u] = o[u] = a * u
              }
              i = R[t] = t * t, n = O[t];
              for (var h = 0; h < 256; h++) n[h] = i * h
            }
          }(t), _ = 0; _ < p; _++) {
          for (y = 0; y < f; y++) {
            if (n = a = i = o = r = 0, (s = y - P) < 0) d = -s, s = 0;
            else {
              if (f <= s) break;
              d = 0
            }
            for (b = d; b < L && !(f <= s); b++) {
              var C = v[s + T];
              o += (x = O[b])[(-16777216 & C) >>> 24], i += x[(16711680 & C) >> 16], a += x[(65280 & C) >> 8], n += x[255 & C], r += R[b], s++
            }
            w[l = T + y] = o / r, S[l] = i / r, M[l] = a / r, E[l] = n / r
          }
          T += f
        }
        for (h = (u = -P) * f, _ = T = 0; _ < p; _++) {
          for (y = 0; y < f; y++) {
            if (n = a = i = o = r = 0, u < 0) d = l = -u, s = y;
            else {
              if (p <= u) break;
              d = 0, l = u, s = y + h
            }
            for (b = d; b < L && !(p <= l); b++) o += (x = O[b])[w[s]], i += x[S[s]], a += x[M[s]], n += x[E[s]], r += R[b], l++, s += f;
            v[y + T] = o / r << 24 | i / r << 16 | a / r << 8 | n / r
          }
          T += f, h += f, u++
        }
        D._setPixels(c, v)
      }
      D._toPixels = function(e) {
        return e instanceof ImageData ? e.data : e.getContext("2d").getImageData(0, 0, e.width, e.height).data
      }, D._getARGB = function(e, t) {
        var r = 4 * t;
        return e[r + 3] << 24 & 4278190080 | e[r] << 16 & 16711680 | e[r + 1] << 8 & 65280 | 255 & e[r + 2]
      }, D._setPixels = function(e, t) {
        for (var r = 0, i = 0, a = e.length; i < a; i++) e[(r = 4 * i) + 0] = (16711680 & t[i]) >>> 16, e[r + 1] = (65280 & t[i]) >>> 8, e[r + 2] = 255 & t[i], e[r + 3] = (4278190080 & t[i]) >>> 24
      }, D._toImageData = function(e) {
        return e instanceof ImageData ? e : e.getContext("2d").getImageData(0, 0, e.width, e.height)
      }, D._createImageData = function(e, t) {
        return D._tmpCanvas = document.createElement("canvas"), D._tmpCtx = D._tmpCanvas.getContext("2d"), this._tmpCtx.createImageData(e, t)
      }, D.apply = function(e, t, r) {
        var i = e.getContext("2d"),
          a = i.getImageData(0, 0, e.width, e.height),
          n = t(a, r);
        n instanceof ImageData ? i.putImageData(n, 0, 0, 0, 0, e.width, e.height) : i.putImageData(a, 0, 0, 0, 0, e.width, e.height)
      }, D.threshold = function(e, t) {
        var r = D._toPixels(e);
        void 0 === t && (t = .5);
        for (var i = Math.floor(255 * t), a = 0; a < r.length; a += 4) {
          var n = void 0;
          n = i <= .2126 * r[a] + .7152 * r[a + 1] + .0722 * r[a + 2] ? 255 : 0, r[a] = r[a + 1] = r[a + 2] = n
        }
      }, D.gray = function(e) {
        for (var t = D._toPixels(e), r = 0; r < t.length; r += 4) {
          var i = .2126 * t[r] + .7152 * t[r + 1] + .0722 * t[r + 2];
          t[r] = t[r + 1] = t[r + 2] = i
        }
      }, D.opaque = function(e) {
        for (var t = D._toPixels(e), r = 0; r < t.length; r += 4) t[r + 3] = 255;
        return t
      }, D.invert = function(e) {
        for (var t = D._toPixels(e), r = 0; r < t.length; r += 4) t[r] = 255 - t[r], t[r + 1] = 255 - t[r + 1], t[r + 2] = 255 - t[r + 2]
      }, D.posterize = function(e, t) {
        var r = D._toPixels(e);
        if (t < 2 || 255 < t) throw new Error("Level must be greater than 2 and less than 255 for posterize");
        for (var i = t - 1, a = 0; a < r.length; a += 4) {
          var n = r[a],
            o = r[a + 1],
            s = r[a + 2];
          r[a] = 255 * (n * t >> 8) / i, r[a + 1] = 255 * (o * t >> 8) / i, r[a + 2] = 255 * (s * t >> 8) / i
        }
      }, D.dilate = function(e) {
        for (var t, r, i, a, n, o, s, l, u, h, d, c, f, p, m, v, g, y = D._toPixels(e), _ = 0, b = y.length ? y.length / 4 : 0, x = new Int32Array(b); _ < b;)
          for (r = (t = _) + e.width; _ < r;) i = a = D._getARGB(y, _), (s = _ - 1) < t && (s = _), r <= (o = _ + 1) && (o = _), (l = _ - e.width) < 0 && (l = 0), b <= (u = _ + e.width) && (u = _), c = D._getARGB(y, l), d = D._getARGB(y, s), f = D._getARGB(y, u), (n = 77 * (i >> 16 & 255) + 151 * (i >> 8 & 255) + 28 * (255 & i)) < (m = 77 * (d >> 16 & 255) + 151 * (d >> 8 & 255) + 28 * (255 & d)) && (a = d, n = m), n < (p = 77 * ((h = D._getARGB(y, o)) >> 16 & 255) + 151 * (h >> 8 & 255) + 28 * (255 & h)) && (a = h, n = p), n < (v = 77 * (c >> 16 & 255) + 151 * (c >> 8 & 255) + 28 * (255 & c)) && (a = c, n = v), n < (g = 77 * (f >> 16 & 255) + 151 * (f >> 8 & 255) + 28 * (255 & f)) && (a = f, n = g), x[_++] = a;
        D._setPixels(y, x)
      }, D.erode = function(e) {
        for (var t, r, i, a, n, o, s, l, u, h, d, c, f, p, m, v, g, y = D._toPixels(e), _ = 0, b = y.length ? y.length / 4 : 0, x = new Int32Array(b); _ < b;)
          for (r = (t = _) + e.width; _ < r;) i = a = D._getARGB(y, _), (s = _ - 1) < t && (s = _), r <= (o = _ + 1) && (o = _), (l = _ - e.width) < 0 && (l = 0), b <= (u = _ + e.width) && (u = _), c = D._getARGB(y, l), d = D._getARGB(y, s), f = D._getARGB(y, u), (m = 77 * (d >> 16 & 255) + 151 * (d >> 8 & 255) + 28 * (255 & d)) < (n = 77 * (i >> 16 & 255) + 151 * (i >> 8 & 255) + 28 * (255 & i)) && (a = d, n = m), (p = 77 * ((h = D._getARGB(y, o)) >> 16 & 255) + 151 * (h >> 8 & 255) + 28 * (255 & h)) < n && (a = h, n = p), (v = 77 * (c >> 16 & 255) + 151 * (c >> 8 & 255) + 28 * (255 & c)) < n && (a = c, n = v), (g = 77 * (f >> 16 & 255) + 151 * (f >> 8 & 255) + 28 * (255 & f)) < n && (a = f, n = g), x[_++] = a;
        D._setPixels(y, x)
      }, D.blur = function(e, t) {
        i(e, t)
      };
      var a = D;
      r.default = a
    }, {}],
    48: [function(e, t, r) {
      "use strict";
      Object.defineProperty(r, "__esModule", {
        value: !0
      }), r.default = void 0;
      var _ = i(e("../core/main")),
        b = i(e("omggif"));

      function i(e) {
        return e && e.__esModule ? e : {
          default: e
        }
      }
      var d = [];
      _.default.prototype.createImage = function(e, t) {
        return _.default._validateParameters("createImage", arguments), new _.default.Image(e, t)
      }, _.default.prototype.saveCanvas = function() {
        _.default._validateParameters("saveCanvas", arguments);
        var e, t, r, i, a = [].slice.call(arguments);
        switch (arguments[0] instanceof HTMLCanvasElement ? (e = arguments[0], a.shift()) : arguments[0] instanceof _.default.Element ? (e = arguments[0].elt, a.shift()) : e = this._curElement && this._curElement.elt, 1 <= a.length && (t = a[0]), 2 <= a.length && (r = a[1]), r = r || _.default.prototype._checkFileExtension(t, r)[1] || "png") {
          default:
            i = "image/png";
            break;
          case "jpeg":
          case "jpg":
            i = "image/jpeg"
        }
        e.toBlob(function(e) {
          _.default.prototype.downloadFile(e, t, r)
        }, i)
      }, _.default.prototype.saveGif = function(e, t) {
        var r = e.gifProperties,
          i = r.loopLimit;
        1 === i ? i = null : null === i && (i = 0);
        for (var a = r.delay / 10, n = {
            loop: i,
            delay: a
          }, o = new Uint8Array(e.width * e.height * r.numFrames * a), s = new b.default.GifWriter(o, e.width, e.height, n), l = [], u = 0; u < r.numFrames; u++) {
          for (var h = new Uint8Array(e.width * e.height), d = r.frames[u].data, c = d.length, f = 0, p = 0; f < c; f += 4, p++) {
            var m = d[f + 0] << 16 | d[f + 1] << 8 | d[f + 2] << 0,
              v = l.indexOf(m); - 1 === v ? (h[p] = l.length, l.push(m)) : h[p] = v
          }
          for (var g = 1; g < l.length;) g <<= 1;
          l.length = g, n.palette = new Uint32Array(l), s.addFrame(0, 0, e.width, e.height, h, n)
        }
        s.end();
        var y = new Blob([o], {
          type: "image/gif"
        });
        _.default.prototype.downloadFile(y, t, "gif")
      }, _.default.prototype.saveFrames = function(e, t, r, i, a) {
        _.default._validateParameters("saveFrames", arguments);
        var n = r || 3;
        n = _.default.prototype.constrain(n, 0, 15), n *= 1e3;
        var o = i || 15;
        o = _.default.prototype.constrain(o, 0, 22);
        var s = 0,
          l = _.default.prototype._makeFrame,
          u = this._curElement.elt,
          h = setInterval(function() {
            l(e + s, t, u), s++
          }, 1e3 / o);
        setTimeout(function() {
          if (clearInterval(h), a) a(d);
          else
            for (var e = d, t = 0; t < e.length; t++) {
              var r = e[t];
              _.default.prototype.downloadFile(r.imageData, r.filename, r.ext)
            }
          d = []
        }, n + .01)
      }, _.default.prototype._makeFrame = function(e, t, r) {
        var i, a;
        if (i = this ? this._curElement.elt : r, t) switch (t.toLowerCase()) {
          case "png":
            a = "image/png";
            break;
          case "jpeg":
          case "jpg":
            a = "image/jpeg";
            break;
          default:
            a = "image/png"
        } else t = "png", a = "image/png";
        var n = i.toDataURL(a);
        n = n.replace(a, "image/octet-stream");
        var o = {};
        o.imageData = n, o.filename = e, o.ext = t, d.push(o)
      };
      var a = _.default;
      r.default = a
    }, {
      "../core/main": 26,
      omggif: 10
    }],
    49: [function(e, t, r) {
      "use strict";
      Object.defineProperty(r, "__esModule", {
        value: !0
      }), r.default = void 0;
      var x = a(e("../core/main")),
        d = a(e("./filters")),
        w = a(e("../core/helpers")),
        i = function(e) {
          {
            if (e && e.__esModule) return e;
            var t = {};
            if (null != e)
              for (var r in e)
                if (Object.prototype.hasOwnProperty.call(e, r)) {
                  var i = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(e, r) : {};
                  i.get || i.set ? Object.defineProperty(t, r, i) : t[r] = e[r]
                } return t.default = e, t
          }
        }(e("../core/constants")),
        m = a(e("omggif"));

      function a(e) {
        return e && e.__esModule ? e : {
          default: e
        }
      }

      function S(e, t) {
        return 0 < e && e < t ? e : t
      }
      e("../core/error_helpers"), x.default.prototype.loadImage = function(r, i, a) {
        x.default._validateParameters("loadImage", arguments);
        var n = new x.default.Image(1, 1, this),
          o = this,
          e = new Request(r, {
            method: "GET",
            mode: "cors"
          });
        return fetch(r, e).then(function(e) {
          if (e.headers.get("content-type").includes("image/gif")) e.arrayBuffer().then(function(e) {
            e && function(e, r, t, i, a) {
              var n = new m.default.GifReader(e);
              r.width = r.canvas.width = n.width, r.height = r.canvas.height = n.height;
              var o = [],
                s = n.numFrames(),
                l = new Uint8ClampedArray(r.width * r.height * 4),
                u = 0;
              if (1 < s) {
                for (var h = function(e, t) {
                    try {
                      t.decodeAndBlitFrameRGBA(e, l)
                    } catch (e) {
                      x.default._friendlyFileLoadError(8, r.src), "function" == typeof i ? i(e) : console.error(e)
                    }
                  }, d = 0; d < s; d++) {
                  var c = n.frameInfo(d);
                  u += c.delay, 1 === n.frameInfo(d).disposal && 0 < d ? r.drawingContext.putImageData(o[d - 1], 0, 0) : (r.drawingContext.clearRect(0, 0, r.width, r.height), l = new Uint8ClampedArray(r.width * r.height * 4)), h(d, n);
                  var f = new ImageData(l, r.width, r.height);
                  r.drawingContext.putImageData(f, 0, 0), o.push(r.drawingContext.getImageData(0, 0, r.width, r.height))
                }
                var p = n.loopCount();
                null === p ? p = 1 : 0 === p && (p = null), u /= s, r.gifProperties = {
                  displayIndex: 0,
                  delay: 10 * u,
                  loopLimit: p,
                  loopCount: 0,
                  frames: o,
                  numFrames: s,
                  playing: !0,
                  timeDisplayed: 0
                }
              }
              "function" == typeof t && t(r);
              a()
            }(new Uint8Array(e), n, i, a, function(e) {
              o._decrementPreload()
            }.bind(o))
          }, function(e) {
            "function" == typeof a ? a(e) : console.error(e)
          });
          else {
            var t = new Image;
            t.onload = function() {
              n.width = n.canvas.width = t.width, n.height = n.canvas.height = t.height, n.drawingContext.drawImage(t, 0, 0), n.modified = !0, "function" == typeof i && i(n), o._decrementPreload()
            }, t.onerror = function(e) {
              x.default._friendlyFileLoadError(0, t.src), "function" == typeof a ? a(e) : console.error(e)
            }, 0 !== r.indexOf("data:image/") && (t.crossOrigin = "Anonymous"), t.src = r
          }
          n.modified = !0
        }), n
      }, x.default.prototype.image = function(e, t, r, i, a, n, o, s, l) {
        x.default._validateParameters("image", arguments);
        var u = e.width,
          h = e.height;
        e.elt && e.elt.videoWidth && !e.canvas && (u = e.elt.videoWidth, h = e.elt.videoHeight);
        var d = t,
          c = r,
          f = i || u,
          p = a || h,
          m = n || 0,
          v = o || 0,
          g = s || u,
          y = l || h;
        g = S(g, u), y = S(y, h);
        var _ = 1;
        e.elt && !e.canvas && e.elt.style.width && (_ = e.elt.videoWidth && !i ? e.elt.videoWidth : e.elt.width, _ /= parseInt(e.elt.style.width, 10)), m *= _, v *= _, y *= _, g *= _;
        var b = w.default.modeAdjust(d, c, f, p, this._renderer._imageMode);
        this._renderer.image(e, m, v, g, y, b.x, b.y, b.w, b.h)
      }, x.default.prototype.tint = function() {
        for (var e = arguments.length, t = new Array(e), r = 0; r < e; r++) t[r] = arguments[r];
        x.default._validateParameters("tint", t);
        var i = this.color.apply(this, t);
        this._renderer._tint = i.levels
      }, x.default.prototype.noTint = function() {
        this._renderer._tint = null
      }, x.default.prototype._getTintedImageCanvas = function(e) {
        if (!e.canvas) return e;
        var t = d.default._toPixels(e.canvas),
          r = document.createElement("canvas");
        r.width = e.canvas.width, r.height = e.canvas.height;
        for (var i = r.getContext("2d"), a = i.createImageData(e.canvas.width, e.canvas.height), n = a.data, o = 0; o < t.length; o += 4) {
          var s = t[o],
            l = t[o + 1],
            u = t[o + 2],
            h = t[o + 3];
          n[o] = s * this._renderer._tint[0] / 255, n[o + 1] = l * this._renderer._tint[1] / 255, n[o + 2] = u * this._renderer._tint[2] / 255, n[o + 3] = h * this._renderer._tint[3] / 255
        }
        return i.putImageData(a, 0, 0), r
      }, x.default.prototype.imageMode = function(e) {
        x.default._validateParameters("imageMode", arguments), e !== i.CORNER && e !== i.CORNERS && e !== i.CENTER || (this._renderer._imageMode = e)
      };
      var n = x.default;
      r.default = n
    }, {
      "../core/constants": 20,
      "../core/error_helpers": 22,
      "../core/helpers": 23,
      "../core/main": 26,
      "./filters": 47,
      omggif: 10
    }],
    50: [function(e, t, r) {
      "use strict";
      Object.defineProperty(r, "__esModule", {
        value: !0
      }), r.default = void 0;
      var a = n(e("../core/main")),
        i = n(e("./filters"));

      function n(e) {
        return e && e.__esModule ? e : {
          default: e
        }
      }
      a.default.Image = function(e, t) {
        this.width = e, this.height = t, this.canvas = document.createElement("canvas"), this.canvas.width = this.width, this.canvas.height = this.height, this.drawingContext = this.canvas.getContext("2d"), (this._pixelsState = this)._pixelDensity = 1, this.gifProperties = null, this._modified = !1, this.pixels = []
      }, a.default.Image.prototype._animateGif = function(e) {
        var t = this.gifProperties;
        if (t.playing && (t.timeDisplayed += e.deltaTime), t.timeDisplayed >= t.delay) {
          var r = Math.floor(t.timeDisplayed / t.delay);
          if (t.timeDisplayed = 0, t.displayIndex += r, t.loopCount = Math.floor(t.displayIndex / t.numFrames), null !== t.loopLimit && t.loopCount >= t.loopLimit) t.playing = !1;
          else {
            var i = t.displayIndex % t.numFrames;
            this.drawingContext.putImageData(t.frames[i], 0, 0), t.displayIndex = i, this.setModified(!0)
          }
        }
      }, a.default.Image.prototype._setProperty = function(e, t) {
        this[e] = t, this.setModified(!0)
      }, a.default.Image.prototype.loadPixels = function() {
        a.default.Renderer2D.prototype.loadPixels.call(this), this.setModified(!0)
      }, a.default.Image.prototype.updatePixels = function(e, t, r, i) {
        a.default.Renderer2D.prototype.updatePixels.call(this, e, t, r, i), this.setModified(!0)
      }, a.default.Image.prototype.get = function(e, t, r, i) {
        return a.default._validateParameters("p5.Image.get", arguments), a.default.Renderer2D.prototype.get.apply(this, arguments)
      }, a.default.Image.prototype._getPixel = a.default.Renderer2D.prototype._getPixel, a.default.Image.prototype.set = function(e, t, r) {
        a.default.Renderer2D.prototype.set.call(this, e, t, r), this.setModified(!0)
      }, a.default.Image.prototype.resize = function(e, t) {
        0 === e && 0 === t ? (e = this.canvas.width, t = this.canvas.height) : 0 === e ? e = this.canvas.width * t / this.canvas.height : 0 === t && (t = this.canvas.height * e / this.canvas.width), e = Math.floor(e), t = Math.floor(t);
        var r = document.createElement("canvas");
        if (r.width = e, r.height = t, this.gifProperties)
          for (var i = this.gifProperties, a = function(e, t) {
              for (var r = 0, i = 0; i < t.height; i++)
                for (var a = 0; a < t.width; a++) {
                  var n = Math.floor(a * e.width / t.width),
                    o = 4 * (Math.floor(i * e.height / t.height) * e.width + n);
                  t.data[r++] = e.data[o++], t.data[r++] = e.data[o++], t.data[r++] = e.data[o++], t.data[r++] = e.data[o++]
                }
            }, n = 0; n < i.numFrames; n++) {
            var o = this.drawingContext.createImageData(e, t);
            a(i.frames[n], o), i.frames[n] = o
          }
        r.getContext("2d").drawImage(this.canvas, 0, 0, this.canvas.width, this.canvas.height, 0, 0, r.width, r.height), this.canvas.width = this.width = e, this.canvas.height = this.height = t, this.drawingContext.drawImage(r, 0, 0, e, t, 0, 0, e, t), 0 < this.pixels.length && this.loadPixels(), this.setModified(!0)
      }, a.default.Image.prototype.copy = function() {
        for (var e = arguments.length, t = new Array(e), r = 0; r < e; r++) t[r] = arguments[r];
        a.default.prototype.copy.apply(this, t)
      }, a.default.Image.prototype.mask = function(e) {
        void 0 === e && (e = this);
        var t = this.drawingContext.globalCompositeOperation,
          r = 1;
        e instanceof a.default.Renderer && (r = e._pInst._pixelDensity);
        var i = [e, 0, 0, r * e.width, r * e.height, 0, 0, this.width, this.height];
        this.drawingContext.globalCompositeOperation = "destination-in", a.default.Image.prototype.copy.apply(this, i), this.drawingContext.globalCompositeOperation = t, this.setModified(!0)
      }, a.default.Image.prototype.filter = function(e, t) {
        i.default.apply(this.canvas, i.default[e], t), this.setModified(!0)
      }, a.default.Image.prototype.blend = function() {
        for (var e = arguments.length, t = new Array(e), r = 0; r < e; r++) t[r] = arguments[r];
        a.default.prototype.blend.apply(this, t), this.setModified(!0)
      }, a.default.Image.prototype.setModified = function(e) {
        this._modified = e
      }, a.default.Image.prototype.isModified = function() {
        return this._modified
      }, a.default.Image.prototype.save = function(e, t) {
        this.gifProperties ? a.default.prototype.saveGif(this, e) : a.default.prototype.saveCanvas(this.canvas, e, t)
      }, a.default.Image.prototype.reset = function() {
        if (this.gifProperties) {
          var e = this.gifProperties;
          e.playing = !0, e.timeSinceStart = 0, e.timeDisplayed = 0, e.loopCount = 0, e.displayIndex = 0, this.drawingContext.putImageData(e.frames[0], 0, 0)
        }
      }, a.default.Image.prototype.getCurrentFrame = function() {
        if (this.gifProperties) {
          var e = this.gifProperties;
          return e.displayIndex % e.numFrames
        }
      }, a.default.Image.prototype.setFrame = function(e) {
        if (this.gifProperties) {
          var t = this.gifProperties;
          e < t.numFrames && 0 <= e ? (t.timeDisplayed = 0, t.displayIndex = e, this.drawingContext.putImageData(t.frames[e], 0, 0)) : console.log("Cannot set GIF to a frame number that is higher than total number of frames or below zero.")
        }
      }, a.default.Image.prototype.numFrames = function() {
        if (this.gifProperties) return this.gifProperties.numFrames
      }, a.default.Image.prototype.play = function() {
        this.gifProperties && (this.gifProperties.playing = !0)
      }, a.default.Image.prototype.pause = function() {
        this.gifProperties && (this.gifProperties.playing = !1)
      }, a.default.Image.prototype.delay = function(e) {
        this.gifProperties && (this.gifProperties.delay = e)
      };
      var o = a.default.Image;
      r.default = o
    }, {
      "../core/main": 26,
      "./filters": 47
    }],
    51: [function(e, t, r) {
      "use strict";
      Object.defineProperty(r, "__esModule", {
        value: !0
      }), r.default = void 0;
      var f = a(e("../core/main")),
        i = a(e("./filters"));

      function a(e) {
        return e && e.__esModule ? e : {
          default: e
        }
      }
      e("../color/p5.Color"), f.default.prototype.pixels = [], f.default.prototype.blend = function() {
        for (var e = arguments.length, t = new Array(e), r = 0; r < e; r++) t[r] = arguments[r];
        var i;
        (f.default._validateParameters("blend", t), this._renderer) ? (i = this._renderer).blend.apply(i, t): f.default.Renderer2D.prototype.blend.apply(this, t)
      }, f.default.prototype.copy = function() {
        for (var e = arguments.length, t = new Array(e), r = 0; r < e; r++) t[r] = arguments[r];
        var i, a, n, o, s, l, u, h, d;
        if (f.default._validateParameters("copy", t), 9 === t.length) i = t[0], a = t[1], n = t[2], o = t[3], s = t[4], l = t[5], u = t[6], h = t[7], d = t[8];
        else {
          if (8 !== t.length) throw new Error("Signature not supported");
          i = this, a = t[0], n = t[1], o = t[2], s = t[3], l = t[4], u = t[5], h = t[6], d = t[7]
        }
        f.default.prototype._copyHelper(this, i, a, n, o, s, l, u, h, d)
      }, f.default.prototype._copyHelper = function(e, t, r, i, a, n, o, s, l, u) {
        t.loadPixels();
        var h = t.canvas.width / t.width,
          d = 0,
          c = 0;
        t._renderer && t._renderer.isP3D && (d = t.width / 2, c = t.height / 2), e._renderer && e._renderer.isP3D ? f.default.RendererGL.prototype.image.call(e._renderer, t, r + d, i + c, a, n, o, s, l, u) : e.drawingContext.drawImage(t.canvas, h * (r + d), h * (i + c), h * a, h * n, o, s, l, u)
      }, f.default.prototype.filter = function(e, t) {
        f.default._validateParameters("filter", arguments), void 0 !== this.canvas ? i.default.apply(this.canvas, i.default[e], t) : i.default.apply(this.elt, i.default[e], t)
      }, f.default.prototype.get = function(e, t, r, i) {
        var a;
        return f.default._validateParameters("get", arguments), (a = this._renderer).get.apply(a, arguments)
      }, f.default.prototype.loadPixels = function() {
        for (var e = arguments.length, t = new Array(e), r = 0; r < e; r++) t[r] = arguments[r];
        f.default._validateParameters("loadPixels", t), this._renderer.loadPixels()
      }, f.default.prototype.set = function(e, t, r) {
        this._renderer.set(e, t, r)
      }, f.default.prototype.updatePixels = function(e, t, r, i) {
        f.default._validateParameters("updatePixels", arguments), 0 !== this.pixels.length && this._renderer.updatePixels(e, t, r, i)
      };
      var n = f.default;
      r.default = n
    }, {
      "../color/p5.Color": 18,
      "../core/main": 26,
      "./filters": 47
    }],
    52: [function(e, t, r) {
      "use strict";
      Object.defineProperty(r, "__esModule", {
        value: !0
      }), r.default = void 0;
      var g = i(e("../core/main"));
      e("whatwg-fetch"), e("es6-promise/auto");
      var v = i(e("fetch-jsonp")),
        s = i(e("file-saver"));

      function i(e) {
        return e && e.__esModule ? e : {
          default: e
        }
      }

      function y(e) {
        return (y = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
          return typeof e
        } : function(e) {
          return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        })(e)
      }

      function _(e, t) {
        var r = {};
        if (void 0 === (t = t || []))
          for (var i = 0; i < e.length; i++) t[i.toString()] = i;
        for (var a = 0; a < t.length; a++) {
          var n = t[a],
            o = e[a];
          r[n] = o
        }
        return r
      }

      function m(e) {
        return e.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;")
      }

      function l(e, t) {
        t && !0 !== t && "true" !== t || (t = ""), e || (e = "untitled");
        var r = "";
        return e && e.includes(".") && (r = e.split(".").pop()), t && r !== t && (r = t, e = "".concat(e, ".").concat(r)), [e, r]
      }
      e("../core/error_helpers"), g.default.prototype.loadJSON = function() {
        for (var e = arguments.length, t = new Array(e), r = 0; r < e; r++) t[r] = arguments[r];
        g.default._validateParameters("loadJSON", t);
        for (var i, a, n, o = t[0], s = {}, l = "json", u = 1; u < t.length; u++) {
          var h = t[u];
          "string" == typeof h ? "jsonp" !== h && "json" !== h || (l = h) : "function" == typeof h ? i ? a = h : i = h : "object" === y(h) && (h.hasOwnProperty("jsonpCallback") || h.hasOwnProperty("jsonpCallbackFunction")) && (l = "jsonp", n = h)
        }
        var d = this;
        return this.httpDo(o, "GET", n, l, function(e) {
          for (var t in e) s[t] = e[t];
          void 0 !== i && i(e), d._decrementPreload()
        }, function(e) {
          if (g.default._friendlyFileLoadError(5, o), !a) throw e;
          a(e)
        }), s
      }, g.default.prototype.loadStrings = function() {
        for (var e = arguments.length, t = new Array(e), r = 0; r < e; r++) t[r] = arguments[r];
        g.default._validateParameters("loadStrings", t);
        for (var i, a, n = [], o = 1; o < t.length; o++) {
          var s = t[o];
          "function" == typeof s && (void 0 === i ? i = s : void 0 === a && (a = s))
        }
        var l = this;
        return g.default.prototype.httpDo.call(this, t[0], "GET", "text", function(e) {
          var t = e.replace(/\r\n/g, "\r").replace(/\n/g, "\r").split(/\r/);
          Array.prototype.push.apply(n, t), void 0 !== i && i(n), l._decrementPreload()
        }, function(e) {
          if (g.default._friendlyFileLoadError(3, e), !a) throw e;
          a(e)
        }), n
      }, g.default.prototype.loadTable = function(t) {
        var c, r, e = [],
          f = !1,
          i = t.substring(t.lastIndexOf(".") + 1, t.length),
          p = ",",
          a = !1;
        "tsv" === i && (p = "\t");
        for (var n = 1; n < arguments.length; n++)
          if ("function" == typeof arguments[n]) void 0 === c ? c = arguments[n] : void 0 === r && (r = arguments[n]);
          else if ("string" == typeof arguments[n])
          if (e.push(arguments[n]), "header" === arguments[n] && (f = !0), "csv" === arguments[n]) {
            if (a) throw new Error("Cannot set multiple separator types.");
            p = ",", a = !0
          } else if ("tsv" === arguments[n]) {
          if (a) throw new Error("Cannot set multiple separator types.");
          p = "\t", a = !0
        }
        var m = new g.default.Table,
          v = this;
        return this.httpDo(t, "GET", "table", function(e) {
          for (var t, r, i = {}, a = [], n = 0, o = null, s = function() {
              i.currentState = 0, i.token = ""
            }, l = function() {
              o.push(i.token), s()
            }, u = function() {
              i.currentState = 4, a.push(o), o = null
            };;) {
            if (null == (t = e[n++])) {
              if (i.escaped) throw new Error("Unclosed quote in file.");
              if (o) {
                l(), u();
                break
              }
            }
            if (null === o && (i.escaped = !1, o = [], s()), 0 === i.currentState) {
              if ('"' === t) {
                i.escaped = !0, i.currentState = 1;
                continue
              }
              i.currentState = 1
            }
            if (1 === i.currentState && i.escaped)
              if ('"' === t) '"' === e[n] ? (i.token += '"', n++) : (i.escaped = !1, i.currentState = 2);
              else {
                if ("\r" === t) continue;
                i.token += t
              }
            else "\r" === t ? ("\n" === e[n] && n++, l(), u()) : "\n" === t ? (l(), u()) : t === p ? l() : 1 === i.currentState && (i.token += t)
          }
          if (f) m.columns = a.shift();
          else
            for (var h = 0; h < a[0].length; h++) m.columns[h] = "null";
          for (var d = 0; d < a.length; d++)(1 !== a[d].length || "undefined" !== a[d][0] && "" !== a[d][0]) && ((r = new g.default.TableRow).arr = a[d], r.obj = _(a[d], m.columns), m.addRow(r));
          "function" == typeof c && c(m), v._decrementPreload()
        }, function(e) {
          g.default._friendlyFileLoadError(2, t), r ? r(e) : console.error(e)
        }), m
      }, g.default.prototype.loadXML = function() {
        for (var e = arguments.length, t = new Array(e), r = 0; r < e; r++) t[r] = arguments[r];
        for (var i, a, n = new g.default.XML, o = 1; o < t.length; o++) {
          var s = t[o];
          "function" == typeof s && (void 0 === i ? i = s : void 0 === a && (a = s))
        }
        var l = this;
        return this.httpDo(t[0], "GET", "xml", function(e) {
          for (var t in e) n[t] = e[t];
          void 0 !== i && i(n), l._decrementPreload()
        }, function(e) {
          if (g.default._friendlyFileLoadError(1, e), !a) throw e;
          a(e)
        }), n
      }, g.default.prototype.loadBytes = function(t, r, i) {
        var a = {},
          n = this;
        return this.httpDo(t, "GET", "arrayBuffer", function(e) {
          a.bytes = new Uint8Array(e), "function" == typeof r && r(a), n._decrementPreload()
        }, function(e) {
          if (g.default._friendlyFileLoadError(6, t), !i) throw e;
          i(e)
        }), a
      }, g.default.prototype.httpGet = function() {
        g.default._validateParameters("httpGet", arguments);
        var e = Array.prototype.slice.call(arguments);
        return e.splice(1, 0, "GET"), g.default.prototype.httpDo.apply(this, e)
      }, g.default.prototype.httpPost = function() {
        g.default._validateParameters("httpPost", arguments);
        var e = Array.prototype.slice.call(arguments);
        return e.splice(1, 0, "POST"), g.default.prototype.httpDo.apply(this, e)
      }, g.default.prototype.httpDo = function() {
        for (var i, e, t, r, a, n = {}, o = 0, s = "text/plain", l = arguments.length - 1; 0 < l && "function" == typeof(l < 0 || arguments.length <= l ? void 0 : arguments[l]); l--) o++;
        var u = arguments.length - o,
          h = arguments.length <= 0 ? void 0 : arguments[0];
        if (2 === u && "string" == typeof h && "object" === y(arguments.length <= 1 ? void 0 : arguments[1])) r = new Request(h, arguments.length <= 1 ? void 0 : arguments[1]), e = arguments.length <= 2 ? void 0 : arguments[2], t = arguments.length <= 3 ? void 0 : arguments[3];
        else {
          for (var d, c = "GET", f = 1; f < arguments.length; f++) {
            var p = f < 0 || arguments.length <= f ? void 0 : arguments[f];
            if ("string" == typeof p) "GET" === p || "POST" === p || "PUT" === p || "DELETE" === p ? c = p : "json" === p || "jsonp" === p || "binary" === p || "arrayBuffer" === p || "xml" === p || "text" === p || "table" === p ? i = p : d = p;
            else if ("number" == typeof p) d = p.toString();
            else if ("object" === y(p))
              if (p.hasOwnProperty("jsonpCallback") || p.hasOwnProperty("jsonpCallbackFunction"))
                for (var m in p) n[m] = p[m];
              else s = p instanceof g.default.XML ? (d = p.serialize(), "application/xml") : (d = JSON.stringify(p), "application/json");
            else "function" == typeof p && (e ? t = p : e = p)
          }
          r = new Request(h, {
            method: c,
            mode: "cors",
            body: d,
            headers: new Headers({
              "Content-Type": s
            })
          })
        }
        return i || (i = h.includes("json") ? "json" : h.includes("xml") ? "xml" : "text"), (a = (a = "jsonp" === i ? (0, v.default)(h, n) : fetch(r)).then(function(e) {
          if (!e.ok) {
            var t = new Error(e.body);
            throw t.status = e.status, t.ok = !1, t
          }
          var r = 0;
          switch ("jsonp" !== i && (r = e.headers.get("content-length")), r && 64e6 < r && g.default._friendlyFileLoadError(7, h), i) {
            case "json":
            case "jsonp":
              return e.json();
            case "binary":
              return e.blob();
            case "arrayBuffer":
              return e.arrayBuffer();
            case "xml":
              return e.text().then(function(e) {
                var t = (new DOMParser).parseFromString(e, "text/xml");
                return new g.default.XML(t.documentElement)
              });
            default:
              return e.text()
          }
        })).then(e || function() {}), a.catch(t || console.error), a
      }, window.URL = window.URL || window.webkitURL, g.default.prototype._pWriters = [], g.default.prototype.createWriter = function(e, t) {
        var r;
        for (var i in g.default.prototype._pWriters)
          if (g.default.prototype._pWriters[i].name === e) return r = new g.default.PrintWriter(e + this.millis(), t), g.default.prototype._pWriters.push(r), r;
        return r = new g.default.PrintWriter(e, t), g.default.prototype._pWriters.push(r), r
      }, g.default.PrintWriter = function(r, i) {
        var a = this;
        this.name = r, this.content = "", this.write = function(e) {
          this.content += e
        }, this.print = function(e) {
          this.content += "".concat(e, "\n")
        }, this.clear = function() {
          this.content = ""
        }, this.close = function() {
          var e = [];
          for (var t in e.push(this.content), g.default.prototype.writeFile(e, r, i), g.default.prototype._pWriters) g.default.prototype._pWriters[t].name === this.name && g.default.prototype._pWriters.splice(t, 1);
          a.clear(), a = {}
        }
      }, g.default.prototype.save = function(e, t, r) {
        var i = arguments,
          a = this._curElement ? this._curElement.elt : this.elt;
        if (0 !== i.length)
          if (i[0] instanceof g.default.Renderer || i[0] instanceof g.default.Graphics) g.default.prototype.saveCanvas(i[0].elt, i[1], i[2]);
          else if (1 === i.length && "string" == typeof i[0]) g.default.prototype.saveCanvas(a, i[0]);
        else switch (l(i[1], i[2])[1]) {
          case "json":
            return void g.default.prototype.saveJSON(i[0], i[1], i[2]);
          case "txt":
            return void g.default.prototype.saveStrings(i[0], i[1], i[2]);
          default:
            i[0] instanceof Array ? g.default.prototype.saveStrings(i[0], i[1], i[2]) : i[0] instanceof g.default.Table ? g.default.prototype.saveTable(i[0], i[1], i[2]) : i[0] instanceof g.default.Image ? g.default.prototype.saveCanvas(i[0].canvas, i[1]) : i[0] instanceof g.default.SoundFile && g.default.prototype.saveSound(i[0], i[1], i[2], i[3])
        } else g.default.prototype.saveCanvas(a)
      }, g.default.prototype.saveJSON = function(e, t, r) {
        var i;
        g.default._validateParameters("saveJSON", arguments), i = r ? JSON.stringify(e) : JSON.stringify(e, void 0, 2), this.saveStrings(i.split("\n"), t, "json")
      }, g.default.prototype.saveJSONObject = g.default.prototype.saveJSON, g.default.prototype.saveJSONArray = g.default.prototype.saveJSON, g.default.prototype.saveStrings = function(e, t, r) {
        g.default._validateParameters("saveStrings", arguments);
        for (var i = r || "txt", a = this.createWriter(t, i), n = 0; n < e.length; n++) e.length, a.print(e[n]);
        a.close(), a.clear()
      }, g.default.prototype.saveTable = function(e, t, r) {
        var i;
        g.default._validateParameters("saveTable", arguments), i = void 0 === r ? t.substring(t.lastIndexOf(".") + 1, t.length) : r;
        var a = this.createWriter(t, i),
          n = e.columns,
          o = ",";
        if ("tsv" === i && (o = "\t"), "html" !== i) {
          if ("0" !== n[0]) {
            for (var s = 0; s < n.length; s++) s < n.length - 1 ? a.write(n[s] + o) : a.write(n[s]);
            a.write("\n")
          }
          for (var l = 0; l < e.rows.length; l++) {
            var u = void 0;
            for (u = 0; u < e.rows[l].arr.length; u++) u < e.rows[l].arr.length - 1 ? a.write(e.rows[l].arr[u] + o) : (e.rows.length, a.write(e.rows[l].arr[u]));
            a.write("\n")
          }
        } else {
          a.print("<html>"), a.print("<head>");
          if ('="text/html;charset=utf-8" />', a.print('  <meta http-equiv="content-type" content="text/html;charset=utf-8" />'), a.print("</head>"), a.print("<body>"), a.print("  <table>"), "0" !== n[0]) {
            a.print("    <tr>");
            for (var h = 0; h < n.length; h++) {
              var d = m(n[h]);
              a.print("      <td>".concat(d)), a.print("      </td>")
            }
            a.print("    </tr>")
          }
          for (var c = 0; c < e.rows.length; c++) {
            a.print("    <tr>");
            for (var f = 0; f < e.columns.length; f++) {
              var p = m(e.rows[c].getString(f));
              a.print("      <td>".concat(p)), a.print("      </td>")
            }
            a.print("    </tr>")
          }
          a.print("  </table>"), a.print("</body>"), a.print("</html>")
        }
        a.close(), a.clear()
      }, g.default.prototype.writeFile = function(e, t, r) {
        var i = "application/octet-stream";
        g.default.prototype._isSafari() && (i = "text/plain");
        var a = new Blob(e, {
          type: i
        });
        g.default.prototype.downloadFile(a, t, r)
      }, g.default.prototype.downloadFile = function(e, t, r) {
        var i = l(t, r),
          a = i[0];
        if (e instanceof Blob) s.default.saveAs(e, a);
        else {
          var n = document.createElement("a");
          if (n.href = e, n.download = a, n.onclick = function(e) {
              var t;
              t = e, document.body.removeChild(t.target), e.stopPropagation()
            }, n.style.display = "none", document.body.appendChild(n), g.default.prototype._isSafari()) {
            var o = "Hello, Safari user! To download this file...\n";
            o += "1. Go to File --\x3e Save As.\n", o += '2. Choose "Page Source" as the Format.\n', o += '3. Name it with this extension: ."'.concat(i[1], '"'), alert(o)
          }
          n.click()
        }
      }, g.default.prototype._checkFileExtension = l, g.default.prototype._isSafari = function() {
        return 0 < Object.prototype.toString.call(window.HTMLElement).indexOf("Constructor")
      };
      var a = g.default;
      r.default = a
    }, {
      "../core/error_helpers": 22,
      "../core/main": 26,
      "es6-promise/auto": 4,
      "fetch-jsonp": 6,
      "file-saver": 7,
      "whatwg-fetch": 14
    }],
    53: [function(e, t, r) {
      "use strict";
      Object.defineProperty(r, "__esModule", {
        value: !0
      }), r.default = void 0;
      var i, a = (i = e("../core/main")) && i.__esModule ? i : {
        default: i
      };
      a.default.Table = function(e) {
        this.columns = [], this.rows = []
      }, a.default.Table.prototype.addRow = function(e) {
        var t = e || new a.default.TableRow;
        if (void 0 === t.arr || void 0 === t.obj) throw new Error("invalid TableRow: ".concat(t));
        return (t.table = this).rows.push(t), t
      }, a.default.Table.prototype.removeRow = function(e) {
        this.rows[e].table = null;
        var t = this.rows.splice(e + 1, this.rows.length);
        this.rows.pop(), this.rows = this.rows.concat(t)
      }, a.default.Table.prototype.getRow = function(e) {
        return this.rows[e]
      }, a.default.Table.prototype.getRows = function() {
        return this.rows
      }, a.default.Table.prototype.findRow = function(e, t) {
        if ("string" == typeof t) {
          for (var r = 0; r < this.rows.length; r++)
            if (this.rows[r].obj[t] === e) return this.rows[r]
        } else
          for (var i = 0; i < this.rows.length; i++)
            if (this.rows[i].arr[t] === e) return this.rows[i];
        return null
      }, a.default.Table.prototype.findRows = function(e, t) {
        var r = [];
        if ("string" == typeof t)
          for (var i = 0; i < this.rows.length; i++) this.rows[i].obj[t] === e && r.push(this.rows[i]);
        else
          for (var a = 0; a < this.rows.length; a++) this.rows[a].arr[t] === e && r.push(this.rows[a]);
        return r
      }, a.default.Table.prototype.matchRow = function(e, t) {
        if ("number" == typeof t) {
          for (var r = 0; r < this.rows.length; r++)
            if (this.rows[r].arr[t].match(e)) return this.rows[r]
        } else
          for (var i = 0; i < this.rows.length; i++)
            if (this.rows[i].obj[t].match(e)) return this.rows[i];
        return null
      }, a.default.Table.prototype.matchRows = function(e, t) {
        var r = [];
        if ("number" == typeof t)
          for (var i = 0; i < this.rows.length; i++) this.rows[i].arr[t].match(e) && r.push(this.rows[i]);
        else
          for (var a = 0; a < this.rows.length; a++) this.rows[a].obj[t].match(e) && r.push(this.rows[a]);
        return r
      }, a.default.Table.prototype.getColumn = function(e) {
        var t = [];
        if ("string" == typeof e)
          for (var r = 0; r < this.rows.length; r++) t.push(this.rows[r].obj[e]);
        else
          for (var i = 0; i < this.rows.length; i++) t.push(this.rows[i].arr[e]);
        return t
      }, a.default.Table.prototype.clearRows = function() {
        delete this.rows, this.rows = []
      }, a.default.Table.prototype.addColumn = function(e) {
        var t = e || null;
        this.columns.push(t)
      }, a.default.Table.prototype.getColumnCount = function() {
        return this.columns.length
      }, a.default.Table.prototype.getRowCount = function() {
        return this.rows.length
      }, a.default.Table.prototype.removeTokens = function(e, t) {
        for (var r = [], i = 0; i < e.length; i++) r.push(e.charAt(i).replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"));
        var a = new RegExp(r.join("|"), "g");
        if (void 0 === t)
          for (var n = 0; n < this.columns.length; n++)
            for (var o = 0; o < this.rows.length; o++) {
              var s = this.rows[o].arr[n];
              s = s.replace(a, ""), this.rows[o].arr[n] = s, this.rows[o].obj[this.columns[n]] = s
            } else if ("string" == typeof t)
              for (var l = 0; l < this.rows.length; l++) {
                var u = this.rows[l].obj[t];
                u = u.replace(a, ""), this.rows[l].obj[t] = u;
                var h = this.columns.indexOf(t);
                this.rows[l].arr[h] = u
              } else
                for (var d = 0; d < this.rows.length; d++) {
                  var c = this.rows[d].arr[t];
                  c = c.replace(a, ""), this.rows[d].arr[t] = c, this.rows[d].obj[this.columns[t]] = c
                }
      }, a.default.Table.prototype.trim = function(e) {
        var t = new RegExp(" ", "g");
        if (void 0 === e)
          for (var r = 0; r < this.columns.length; r++)
            for (var i = 0; i < this.rows.length; i++) {
              var a = this.rows[i].arr[r];
              a = a.replace(t, ""), this.rows[i].arr[r] = a, this.rows[i].obj[this.columns[r]] = a
            } else if ("string" == typeof e)
              for (var n = 0; n < this.rows.length; n++) {
                var o = this.rows[n].obj[e];
                o = o.replace(t, ""), this.rows[n].obj[e] = o;
                var s = this.columns.indexOf(e);
                this.rows[n].arr[s] = o
              } else
                for (var l = 0; l < this.rows.length; l++) {
                  var u = this.rows[l].arr[e];
                  u = u.replace(t, ""), this.rows[l].arr[e] = u, this.rows[l].obj[this.columns[e]] = u
                }
      }, a.default.Table.prototype.removeColumn = function(e) {
        var t, r;
        "string" == typeof e ? (t = e, r = this.columns.indexOf(e)) : (r = e, t = this.columns[e]);
        var i = this.columns.splice(r + 1, this.columns.length);
        this.columns.pop(), this.columns = this.columns.concat(i);
        for (var a = 0; a < this.rows.length; a++) {
          var n = this.rows[a].arr,
            o = n.splice(r + 1, n.length);
          n.pop(), this.rows[a].arr = n.concat(o), delete this.rows[a].obj[t]
        }
      }, a.default.Table.prototype.set = function(e, t, r) {
        this.rows[e].set(t, r)
      }, a.default.Table.prototype.setNum = function(e, t, r) {
        this.rows[e].setNum(t, r)
      }, a.default.Table.prototype.setString = function(e, t, r) {
        this.rows[e].setString(t, r)
      }, a.default.Table.prototype.get = function(e, t) {
        return this.rows[e].get(t)
      }, a.default.Table.prototype.getNum = function(e, t) {
        return this.rows[e].getNum(t)
      }, a.default.Table.prototype.getString = function(e, t) {
        return this.rows[e].getString(t)
      }, a.default.Table.prototype.getObject = function(e) {
        for (var t, r = {}, i = 0; i < this.rows.length; i++)
          if (t = this.rows[i].obj, "string" == typeof e) {
            if (!(0 <= this.columns.indexOf(e))) throw new Error('This table has no column named "'.concat(e, '"'));
            r[t[e]] = t
          } else r[i] = this.rows[i].obj;
        return r
      }, a.default.Table.prototype.getArray = function() {
        for (var e = [], t = 0; t < this.rows.length; t++) e.push(this.rows[t].arr);
        return e
      };
      var n = a.default;
      r.default = n
    }, {
      "../core/main": 26
    }],
    54: [function(e, t, r) {
      "use strict";
      Object.defineProperty(r, "__esModule", {
        value: !0
      }), r.default = void 0;
      var i, a = (i = e("../core/main")) && i.__esModule ? i : {
        default: i
      };
      a.default.TableRow = function(e, t) {
        var r = [],
          i = {};
        e && (t = t || ",", r = e.split(t));
        for (var a = 0; a < r.length; a++) {
          var n = a,
            o = r[a];
          i[n] = o
        }
        this.arr = r, this.obj = i, this.table = null
      }, a.default.TableRow.prototype.set = function(e, t) {
        if ("string" == typeof e) {
          var r = this.table.columns.indexOf(e);
          if (!(0 <= r)) throw new Error('This table has no column named "'.concat(e, '"'));
          this.obj[e] = t, this.arr[r] = t
        } else {
          if (!(e < this.table.columns.length)) throw new Error("Column #".concat(e, " is out of the range of this table"));
          this.arr[e] = t;
          var i = this.table.columns[e];
          this.obj[i] = t
        }
      }, a.default.TableRow.prototype.setNum = function(e, t) {
        var r = parseFloat(t);
        this.set(e, r)
      }, a.default.TableRow.prototype.setString = function(e, t) {
        var r = t.toString();
        this.set(e, r)
      }, a.default.TableRow.prototype.get = function(e) {
        return "string" == typeof e ? this.obj[e] : this.arr[e]
      }, a.default.TableRow.prototype.getNum = function(e) {
        var t;
        if ("NaN" === (t = "string" == typeof e ? parseFloat(this.obj[e]) : parseFloat(this.arr[e])).toString()) throw "Error: ".concat(this.obj[e], " is NaN (Not a Number)");
        return t
      }, a.default.TableRow.prototype.getString = function(e) {
        return "string" == typeof e ? this.obj[e].toString() : this.arr[e].toString()
      };
      var n = a.default;
      r.default = n
    }, {
      "../core/main": 26
    }],
    55: [function(e, t, r) {
      "use strict";
      Object.defineProperty(r, "__esModule", {
        value: !0
      }), r.default = void 0;
      var i, s = (i = e("../core/main")) && i.__esModule ? i : {
        default: i
      };

      function a(e) {
        for (var t = [], r = 0; r < e.length; r++) t.push(new s.default.XML(e[r]));
        return t
      }
      s.default.XML = function(e) {
        if (e) this.DOM = e;
        else {
          var t = document.implementation.createDocument(null, "doc");
          this.DOM = t.createElement("root")
        }
      }, s.default.XML.prototype.getParent = function() {
        return new s.default.XML(this.DOM.parentElement)
      }, s.default.XML.prototype.getName = function() {
        return this.DOM.tagName
      }, s.default.XML.prototype.setName = function(e) {
        var t = this.DOM.innerHTML,
          r = this.DOM.attributes,
          i = document.implementation.createDocument(null, "default").createElement(e);
        i.innerHTML = t;
        for (var a = 0; a < r.length; a++) i.setAttribute(r[a].nodeName, r.nodeValue);
        this.DOM = i
      }, s.default.XML.prototype.hasChildren = function() {
        return 0 < this.DOM.children.length
      }, s.default.XML.prototype.listChildren = function() {
        for (var e = [], t = 0; t < this.DOM.childNodes.length; t++) e.push(this.DOM.childNodes[t].nodeName);
        return e
      }, s.default.XML.prototype.getChildren = function(e) {
        return a(e ? this.DOM.getElementsByTagName(e) : this.DOM.children)
      }, s.default.XML.prototype.getChild = function(e) {
        if ("string" != typeof e) return new s.default.XML(this.DOM.children[e]);
        var t = !0,
          r = !1,
          i = void 0;
        try {
          for (var a, n = this.DOM.children[Symbol.iterator](); !(t = (a = n.next()).done); t = !0) {
            var o = a.value;
            if (o.tagName === e) return new s.default.XML(o)
          }
        } catch (e) {
          r = !0, i = e
        } finally {
          try {
            t || null == n.return || n.return()
          } finally {
            if (r) throw i
          }
        }
      }, s.default.XML.prototype.addChild = function(e) {
        e instanceof s.default.XML && this.DOM.appendChild(e.DOM)
      }, s.default.XML.prototype.removeChild = function(e) {
        var t = -1;
        if ("string" == typeof e) {
          for (var r = 0; r < this.DOM.children.length; r++)
            if (this.DOM.children[r].tagName === e) {
              t = r;
              break
            }
        } else t = e; - 1 !== t && this.DOM.removeChild(this.DOM.children[t])
      }, s.default.XML.prototype.getAttributeCount = function() {
        return this.DOM.attributes.length
      }, s.default.XML.prototype.listAttributes = function() {
        var e = [],
          t = !0,
          r = !1,
          i = void 0;
        try {
          for (var a, n = this.DOM.attributes[Symbol.iterator](); !(t = (a = n.next()).done); t = !0) {
            var o = a.value;
            e.push(o.nodeName)
          }
        } catch (e) {
          r = !0, i = e
        } finally {
          try {
            t || null == n.return || n.return()
          } finally {
            if (r) throw i
          }
        }
        return e
      }, s.default.XML.prototype.hasAttribute = function(e) {
        var t = {},
          r = !0,
          i = !1,
          a = void 0;
        try {
          for (var n, o = this.DOM.attributes[Symbol.iterator](); !(r = (n = o.next()).done); r = !0) {
            var s = n.value;
            t[s.nodeName] = s.nodeValue
          }
        } catch (e) {
          i = !0, a = e
        } finally {
          try {
            r || null == o.return || o.return()
          } finally {
            if (i) throw a
          }
        }
        return !!t[e]
      }, s.default.XML.prototype.getNum = function(e, t) {
        var r = {},
          i = !0,
          a = !1,
          n = void 0;
        try {
          for (var o, s = this.DOM.attributes[Symbol.iterator](); !(i = (o = s.next()).done); i = !0) {
            var l = o.value;
            r[l.nodeName] = l.nodeValue
          }
        } catch (e) {
          a = !0, n = e
        } finally {
          try {
            i || null == s.return || s.return()
          } finally {
            if (a) throw n
          }
        }
        return Number(r[e]) || t || 0
      }, s.default.XML.prototype.getString = function(e, t) {
        var r = {},
          i = !0,
          a = !1,
          n = void 0;
        try {
          for (var o, s = this.DOM.attributes[Symbol.iterator](); !(i = (o = s.next()).done); i = !0) {
            var l = o.value;
            r[l.nodeName] = l.nodeValue
          }
        } catch (e) {
          a = !0, n = e
        } finally {
          try {
            i || null == s.return || s.return()
          } finally {
            if (a) throw n
          }
        }
        return r[e] ? String(r[e]) : t || null
      }, s.default.XML.prototype.setAttribute = function(e, t) {
        this.DOM.setAttribute(e, t)
      }, s.default.XML.prototype.getContent = function(e) {
        return this.DOM.textContent.replace(/\s\s+/g, ",") || e || null
      }, s.default.XML.prototype.setContent = function(e) {
        this.DOM.children.length || (this.DOM.textContent = e)
      }, s.default.XML.prototype.serialize = function() {
        return (new XMLSerializer).serializeToString(this.DOM)
      };
      var n = s.default;
      r.default = n
    }, {
      "../core/main": 26
    }],
    56: [function(e, t, r) {
      "use strict";
      Object.defineProperty(r, "__esModule", {
        value: !0
      }), r.default = void 0;
      var i, s = (i = e("../core/main")) && i.__esModule ? i : {
        default: i
      };

      function a(e, t, r) {
        if ("function" == typeof Math.hypot) return Math.hypot.apply(null, arguments);
        for (var i = arguments.length, a = [], n = 0, o = 0; o < i; o++) {
          var s = arguments[o];
          if ((s = +s) === 1 / 0 || s === -1 / 0) return 1 / 0;
          n < (s = Math.abs(s)) && (n = s), a[o] = s
        }
        0 === n && (n = 1);
        for (var l = 0, u = 0, h = 0; h < i; h++) {
          var d = a[h] / n,
            c = d * d - u,
            f = l + c;
          u = f - l - c, l = f
        }
        return Math.sqrt(l) * n
      }
      s.default.prototype.abs = Math.abs, s.default.prototype.ceil = Math.ceil, s.default.prototype.constrain = function(e, t, r) {
        return s.default._validateParameters("constrain", arguments), Math.max(Math.min(e, r), t)
      }, s.default.prototype.dist = function() {
        for (var e = arguments.length, t = new Array(e), r = 0; r < e; r++) t[r] = arguments[r];
        return s.default._validateParameters("dist", t), 4 === t.length ? a(t[2] - t[0], t[3] - t[1]) : 6 === t.length ? a(t[3] - t[0], t[4] - t[1], t[5] - t[2]) : void 0
      }, s.default.prototype.exp = Math.exp, s.default.prototype.floor = Math.floor, s.default.prototype.lerp = function(e, t, r) {
        return s.default._validateParameters("lerp", arguments), r * (t - e) + e
      }, s.default.prototype.log = Math.log, s.default.prototype.mag = function(e, t) {
        return s.default._validateParameters("mag", arguments), a(e, t)
      }, s.default.prototype.map = function(e, t, r, i, a, n) {
        s.default._validateParameters("map", arguments);
        var o = (e - t) / (r - t) * (a - i) + i;
        return n ? i < a ? this.constrain(o, i, a) : this.constrain(o, a, i) : o
      }, s.default.prototype.max = function() {
        for (var e = arguments.length, t = new Array(e), r = 0; r < e; r++) t[r] = arguments[r];
        return s.default._validateParameters("max", t), t[0] instanceof Array ? Math.max.apply(null, t[0]) : Math.max.apply(null, t)
      }, s.default.prototype.min = function() {
        for (var e = arguments.length, t = new Array(e), r = 0; r < e; r++) t[r] = arguments[r];
        return s.default._validateParameters("min", t), t[0] instanceof Array ? Math.min.apply(null, t[0]) : Math.min.apply(null, t)
      }, s.default.prototype.norm = function(e, t, r) {
        return s.default._validateParameters("norm", arguments), this.map(e, t, r, 0, 1)
      }, s.default.prototype.pow = Math.pow, s.default.prototype.round = Math.round, s.default.prototype.sq = function(e) {
        return e * e
      }, s.default.prototype.sqrt = Math.sqrt;
      var n = s.default;
      r.default = n
    }, {
      "../core/main": 26
    }],
    57: [function(e, t, r) {
      "use strict";
      Object.defineProperty(r, "__esModule", {
        value: !0
      }), r.default = void 0;
      var i, a = (i = e("../core/main")) && i.__esModule ? i : {
        default: i
      };
      a.default.prototype.createVector = function(e, t, r) {
        return this instanceof a.default ? new a.default.Vector(this, arguments) : new a.default.Vector(e, t, r)
      };
      var n = a.default;
      r.default = n
    }, {
      "../core/main": 26
    }],
    58: [function(e, t, r) {
      "use strict";
      Object.defineProperty(r, "__esModule", {
        value: !0
      }), r.default = void 0;
      var i, a = (i = e("../core/main")) && i.__esModule ? i : {
        default: i
      };
      var _, b = 4095,
        x = 4,
        w = .5,
        S = function(e) {
          return .5 * (1 - Math.cos(e * Math.PI))
        };
      a.default.prototype.noise = function(e) {
        var t = 1 < arguments.length && void 0 !== arguments[1] ? arguments[1] : 0,
          r = 2 < arguments.length && void 0 !== arguments[2] ? arguments[2] : 0;
        if (null == _) {
          _ = new Array(4096);
          for (var i = 0; i < 4096; i++) _[i] = Math.random()
        }
        e < 0 && (e = -e), t < 0 && (t = -t), r < 0 && (r = -r);
        for (var a, n, o, s, l, u = Math.floor(e), h = Math.floor(t), d = Math.floor(r), c = e - u, f = t - h, p = r - d, m = 0, v = .5, g = 0; g < x; g++) {
          var y = u + (h << 4) + (d << 8);
          a = S(c), n = S(f), o = _[y & b], o += a * (_[y + 1 & b] - o), s = _[y + 16 & b], o += n * ((s += a * (_[y + 16 + 1 & b] - s)) - o), s = _[(y += 256) & b], s += a * (_[y + 1 & b] - s), l = _[y + 16 & b], s += n * ((l += a * (_[y + 16 + 1 & b] - l)) - s), m += (o += S(p) * (s - o)) * v, v *= w, u <<= 1, h <<= 1, d <<= 1, 1 <= (c *= 2) && (u++, c--), 1 <= (f *= 2) && (h++, f--), 1 <= (p *= 2) && (d++, p--)
        }
        return m
      }, a.default.prototype.noiseDetail = function(e, t) {
        0 < e && (x = e), 0 < t && (w = t)
      }, a.default.prototype.noiseSeed = function(e) {
        var t, r, i, a = (i = 4294967296, {
          setSeed: function(e) {
            r = t = (null == e ? Math.random() * i : e) >>> 0
          },
          getSeed: function() {
            return t
          },
          rand: function() {
            return (r = (1664525 * r + 1013904223) % i) / i
          }
        });
        a.setSeed(e), _ = new Array(4096);
        for (var n = 0; n < 4096; n++) _[n] = a.rand()
      };
      var n = a.default;
      r.default = n
    }, {
      "../core/main": 26
    }],
    59: [function(e, t, r) {
      "use strict";
      Object.defineProperty(r, "__esModule", {
        value: !0
      }), r.default = void 0;
      var i, s = (i = e("../core/main")) && i.__esModule ? i : {
          default: i
        },
        n = function(e) {
          {
            if (e && e.__esModule) return e;
            var t = {};
            if (null != e)
              for (var r in e)
                if (Object.prototype.hasOwnProperty.call(e, r)) {
                  var i = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(e, r) : {};
                  i.get || i.set ? Object.defineProperty(t, r, i) : t[r] = e[r]
                } return t.default = e, t
          }
        }(e("../core/constants"));
      s.default.Vector = function() {
        var e, t, r;
        r = arguments[0] instanceof s.default ? (this.p5 = arguments[0], e = arguments[1][0] || 0, t = arguments[1][1] || 0, arguments[1][2] || 0) : (e = arguments[0] || 0, t = arguments[1] || 0, arguments[2] || 0), this.x = e, this.y = t, this.z = r
      }, s.default.Vector.prototype.toString = function() {
        return "p5.Vector Object : [".concat(this.x, ", ").concat(this.y, ", ").concat(this.z, "]")
      }, s.default.Vector.prototype.set = function(e, t, r) {
        return e instanceof s.default.Vector ? (this.x = e.x || 0, this.y = e.y || 0, this.z = e.z || 0) : e instanceof Array ? (this.x = e[0] || 0, this.y = e[1] || 0, this.z = e[2] || 0) : (this.x = e || 0, this.y = t || 0, this.z = r || 0), this
      }, s.default.Vector.prototype.copy = function() {
        return this.p5 ? new s.default.Vector(this.p5, [this.x, this.y, this.z]) : new s.default.Vector(this.x, this.y, this.z)
      }, s.default.Vector.prototype.add = function(e, t, r) {
        return e instanceof s.default.Vector ? (this.x += e.x || 0, this.y += e.y || 0, this.z += e.z || 0) : e instanceof Array ? (this.x += e[0] || 0, this.y += e[1] || 0, this.z += e[2] || 0) : (this.x += e || 0, this.y += t || 0, this.z += r || 0), this
      }, s.default.Vector.prototype.sub = function(e, t, r) {
        return e instanceof s.default.Vector ? (this.x -= e.x || 0, this.y -= e.y || 0, this.z -= e.z || 0) : e instanceof Array ? (this.x -= e[0] || 0, this.y -= e[1] || 0, this.z -= e[2] || 0) : (this.x -= e || 0, this.y -= t || 0, this.z -= r || 0), this
      }, s.default.Vector.prototype.mult = function(e) {
        return "number" == typeof e && isFinite(e) ? (this.x *= e, this.y *= e, this.z *= e) : console.warn("p5.Vector.prototype.mult:", "n is undefined or not a finite number"), this
      }, s.default.Vector.prototype.div = function(e) {
        return "number" == typeof e && isFinite(e) ? 0 === e ? console.warn("p5.Vector.prototype.div:", "divide by 0") : (this.x /= e, this.y /= e, this.z /= e) : console.warn("p5.Vector.prototype.div:", "n is undefined or not a finite number"), this
      }, s.default.Vector.prototype.mag = function() {
        return Math.sqrt(this.magSq())
      }, s.default.Vector.prototype.magSq = function() {
        var e = this.x,
          t = this.y,
          r = this.z;
        return e * e + t * t + r * r
      }, s.default.Vector.prototype.dot = function(e, t, r) {
        return e instanceof s.default.Vector ? this.dot(e.x, e.y, e.z) : this.x * (e || 0) + this.y * (t || 0) + this.z * (r || 0)
      }, s.default.Vector.prototype.cross = function(e) {
        var t = this.y * e.z - this.z * e.y,
          r = this.z * e.x - this.x * e.z,
          i = this.x * e.y - this.y * e.x;
        return this.p5 ? new s.default.Vector(this.p5, [t, r, i]) : new s.default.Vector(t, r, i)
      }, s.default.Vector.prototype.dist = function(e) {
        return e.copy().sub(this).mag()
      }, s.default.Vector.prototype.normalize = function() {
        var e = this.mag();
        return 0 !== e && this.mult(1 / e), this
      }, s.default.Vector.prototype.limit = function(e) {
        var t = this.magSq();
        return e * e < t && this.div(Math.sqrt(t)).mult(e), this
      }, s.default.Vector.prototype.setMag = function(e) {
        return this.normalize().mult(e)
      }, s.default.Vector.prototype.heading = function() {
        var e = Math.atan2(this.y, this.x);
        return this.p5 ? this.p5._fromRadians(e) : e
      }, s.default.Vector.prototype.rotate = function(e) {
        var t = this.heading() + e;
        this.p5 && (t = this.p5._toRadians(t));
        var r = this.mag();
        return this.x = Math.cos(t) * r, this.y = Math.sin(t) * r, this
      }, s.default.Vector.prototype.angleBetween = function(e) {
        var t, r = this.dot(e) / (this.mag() * e.mag());
        return t = Math.acos(Math.min(1, Math.max(-1, r))), t *= Math.sign(this.cross(e).z || 1), this.p5 && (t = this.p5._fromRadians(t)), t
      }, s.default.Vector.prototype.lerp = function(e, t, r, i) {
        return e instanceof s.default.Vector ? this.lerp(e.x, e.y, e.z, t) : (this.x += (e - this.x) * i || 0, this.y += (t - this.y) * i || 0, this.z += (r - this.z) * i || 0, this)
      }, s.default.Vector.prototype.array = function() {
        return [this.x || 0, this.y || 0, this.z || 0]
      }, s.default.Vector.prototype.equals = function(e, t, r) {
        var i, a, n;
        return n = e instanceof s.default.Vector ? (i = e.x || 0, a = e.y || 0, e.z || 0) : e instanceof Array ? (i = e[0] || 0, a = e[1] || 0, e[2] || 0) : (i = e || 0, a = t || 0, r || 0), this.x === i && this.y === a && this.z === n
      }, s.default.Vector.fromAngle = function(e, t) {
        return void 0 === t && (t = 1), new s.default.Vector(t * Math.cos(e), t * Math.sin(e), 0)
      }, s.default.Vector.fromAngles = function(e, t, r) {
        void 0 === r && (r = 1);
        var i = Math.cos(t),
          a = Math.sin(t),
          n = Math.cos(e),
          o = Math.sin(e);
        return new s.default.Vector(r * o * a, -r * n, r * o * i)
      }, s.default.Vector.random2D = function() {
        return this.fromAngle(Math.random() * n.TWO_PI)
      }, s.default.Vector.random3D = function() {
        var e = Math.random() * n.TWO_PI,
          t = 2 * Math.random() - 1,
          r = Math.sqrt(1 - t * t),
          i = r * Math.cos(e),
          a = r * Math.sin(e);
        return new s.default.Vector(i, a, t)
      }, s.default.Vector.add = function(e, t, r) {
        return r ? r.set(e) : r = e.copy(), r.add(t), r
      }, s.default.Vector.sub = function(e, t, r) {
        return r ? r.set(e) : r = e.copy(), r.sub(t), r
      }, s.default.Vector.mult = function(e, t, r) {
        return r ? r.set(e) : r = e.copy(), r.mult(t), r
      }, s.default.Vector.div = function(e, t, r) {
        return r ? r.set(e) : r = e.copy(), r.div(t), r
      }, s.default.Vector.dot = function(e, t) {
        return e.dot(t)
      }, s.default.Vector.cross = function(e, t) {
        return e.cross(t)
      }, s.default.Vector.dist = function(e, t) {
        return e.dist(t)
      }, s.default.Vector.lerp = function(e, t, r, i) {
        return i ? i.set(e) : i = e.copy(), i.lerp(t, r), i
      }, s.default.Vector.mag = function(e) {
        var t = e.x,
          r = e.y,
          i = e.z,
          a = t * t + r * r + i * i;
        return Math.sqrt(a)
      };
      var a = s.default.Vector;
      r.default = a
    }, {
      "../core/constants": 20,
      "../core/main": 26
    }],
    60: [function(e, t, r) {
      "use strict";
      Object.defineProperty(r, "__esModule", {
        value: !0
      }), r.default = void 0;
      var i, a = (i = e("../core/main")) && i.__esModule ? i : {
        default: i
      };
      var n = "_lcg_random_state",
        o = 4294967296,
        s = 0;
      a.default.prototype._lcg = function(e) {
        return this[e] = (1664525 * this[e] + 1013904223) % o, this[e] / o
      }, a.default.prototype._lcgSetSeed = function(e, t) {
        this[e] = (null == t ? Math.random() * o : t) >>> 0
      }, a.default.prototype.randomSeed = function(e) {
        this._lcgSetSeed(n, e), this._gaussian_previous = !1
      }, a.default.prototype.random = function(e, t) {
        var r;
        if (a.default._validateParameters("random", arguments), r = null != this[n] ? this._lcg(n) : Math.random(), void 0 === e) return r;
        if (void 0 === t) return e instanceof Array ? e[Math.floor(r * e.length)] : r * e;
        if (t < e) {
          var i = e;
          e = t, t = i
        }
        return r * (t - e) + e
      }, a.default.prototype.randomGaussian = function(e, t) {
        var r, i, a, n;
        if (this._gaussian_previous) r = s, this._gaussian_previous = !1;
        else {
          for (; 1 <= (n = (i = this.random(2) - 1) * i + (a = this.random(2) - 1) * a););
          r = i * (n = Math.sqrt(-2 * Math.log(n) / n)), s = a * n, this._gaussian_previous = !0
        }
        return r * (t || 1) + (e || 0)
      };
      var l = a.default;
      r.default = l
    }, {
      "../core/main": 26
    }],
    61: [function(e, t, r) {
      "use strict";
      Object.defineProperty(r, "__esModule", {
        value: !0
      }), r.default = void 0;
      var i, a = (i = e("../core/main")) && i.__esModule ? i : {
          default: i
        },
        n = function(e) {
          {
            if (e && e.__esModule) return e;
            var t = {};
            if (null != e)
              for (var r in e)
                if (Object.prototype.hasOwnProperty.call(e, r)) {
                  var i = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(e, r) : {};
                  i.get || i.set ? Object.defineProperty(t, r, i) : t[r] = e[r]
                } return t.default = e, t
          }
        }(e("../core/constants"));
      a.default.prototype._angleMode = n.RADIANS, a.default.prototype.acos = function(e) {
        return this._fromRadians(Math.acos(e))
      }, a.default.prototype.asin = function(e) {
        return this._fromRadians(Math.asin(e))
      }, a.default.prototype.atan = function(e) {
        return this._fromRadians(Math.atan(e))
      }, a.default.prototype.atan2 = function(e, t) {
        return this._fromRadians(Math.atan2(e, t))
      }, a.default.prototype.cos = function(e) {
        return Math.cos(this._toRadians(e))
      }, a.default.prototype.sin = function(e) {
        return Math.sin(this._toRadians(e))
      }, a.default.prototype.tan = function(e) {
        return Math.tan(this._toRadians(e))
      }, a.default.prototype.degrees = function(e) {
        return e * n.RAD_TO_DEG
      }, a.default.prototype.radians = function(e) {
        return e * n.DEG_TO_RAD
      }, a.default.prototype.angleMode = function(e) {
        e !== n.DEGREES && e !== n.RADIANS || (this._angleMode = e)
      }, a.default.prototype._toRadians = function(e) {
        return this._angleMode === n.DEGREES ? e * n.DEG_TO_RAD : e
      }, a.default.prototype._toDegrees = function(e) {
        return this._angleMode === n.RADIANS ? e * n.RAD_TO_DEG : e
      }, a.default.prototype._fromRadians = function(e) {
        return this._angleMode === n.DEGREES ? e * n.RAD_TO_DEG : e
      };
      var o = a.default;
      r.default = o
    }, {
      "../core/constants": 20,
      "../core/main": 26
    }],
    62: [function(e, t, r) {
      "use strict";
      Object.defineProperty(r, "__esModule", {
        value: !0
      }), r.default = void 0;
      var i, a = (i = e("../core/main")) && i.__esModule ? i : {
        default: i
      };
      a.default.prototype.textAlign = function(e, t) {
        var r;
        return a.default._validateParameters("textAlign", arguments), (r = this._renderer).textAlign.apply(r, arguments)
      }, a.default.prototype.textLeading = function(e) {
        var t;
        return a.default._validateParameters("textLeading", arguments), (t = this._renderer).textLeading.apply(t, arguments)
      }, a.default.prototype.textSize = function(e) {
        var t;
        return a.default._validateParameters("textSize", arguments), (t = this._renderer).textSize.apply(t, arguments)
      }, a.default.prototype.textStyle = function(e) {
        var t;
        return a.default._validateParameters("textStyle", arguments), (t = this._renderer).textStyle.apply(t, arguments)
      }, a.default.prototype.textWidth = function() {
        for (var e, t = arguments.length, r = new Array(t), i = 0; i < t; i++) r[i] = arguments[i];
        return r[0] += "", a.default._validateParameters("textWidth", r), 0 === r[0].length ? 0 : (e = this._renderer).textWidth.apply(e, r)
      }, a.default.prototype.textAscent = function() {
        for (var e = arguments.length, t = new Array(e), r = 0; r < e; r++) t[r] = arguments[r];
        return a.default._validateParameters("textAscent", t), this._renderer.textAscent()
      }, a.default.prototype.textDescent = function() {
        for (var e = arguments.length, t = new Array(e), r = 0; r < e; r++) t[r] = arguments[r];
        return a.default._validateParameters("textDescent", t), this._renderer.textDescent()
      }, a.default.prototype._updateTextMetrics = function() {
        return this._renderer._updateTextMetrics()
      };
      var n = a.default;
      r.default = n
    }, {
      "../core/main": 26
    }],
    63: [function(e, t, r) {
      "use strict";
      Object.defineProperty(r, "__esModule", {
        value: !0
      }), r.default = void 0;
      var i, c = (i = e("../core/main")) && i.__esModule ? i : {
          default: i
        },
        a = o(e("../core/constants")),
        n = o(e("opentype.js"));

      function o(e) {
        if (e && e.__esModule) return e;
        var t = {};
        if (null != e)
          for (var r in e)
            if (Object.prototype.hasOwnProperty.call(e, r)) {
              var i = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(e, r) : {};
              i.get || i.set ? Object.defineProperty(t, r, i) : t[r] = e[r]
            } return t.default = e, t
      }
      e("../core/error_helpers"), c.default.prototype.loadFont = function(s, l, u) {
        c.default._validateParameters("loadFont", arguments);
        var h = new c.default.Font(this),
          d = this;
        return n.load(s, function(e, t) {
          if (e) return c.default._friendlyFileLoadError(4, s), void 0 !== u ? u(e) : void console.error(e, s);
          h.font = t, void 0 !== l && l(h), d._decrementPreload();
          var r, i, a = s.split("\\").pop().split("/").pop(),
            n = a.lastIndexOf("."),
            o = n < 1 ? null : a.substr(n + 1);
          ["ttf", "otf", "woff", "woff2"].includes(o) && (r = a.substr(0, n), (i = document.createElement("style")).appendChild(document.createTextNode("\n@font-face {\nfont-family: ".concat(r, ";\nsrc: url(").concat(s, ");\n}\n"))), document.head.appendChild(i))
        }), h
      }, c.default.prototype.text = function(e, t, r, i, a) {
        var n;
        return c.default._validateParameters("text", arguments), this._renderer._doFill || this._renderer._doStroke ? (n = this._renderer).text.apply(n, arguments) : this
      }, c.default.prototype.textFont = function(e, t) {
        if (c.default._validateParameters("textFont", arguments), arguments.length) {
          if (!e) throw new Error("null font passed to textFont");
          return this._renderer._setProperty("_textFont", e), t && (this._renderer._setProperty("_textSize", t), this._renderer._setProperty("_textLeading", t * a._DEFAULT_LEADMULT)), this._renderer._applyTextProperties()
        }
        return this._renderer._textFont
      };
      var s = c.default;
      r.default = s
    }, {
      "../core/constants": 20,
      "../core/error_helpers": 22,
      "../core/main": 26,
      "opentype.js": 11
    }],
    64: [function(e, t, r) {
      "use strict";
      Object.defineProperty(r, "__esModule", {
        value: !0
      }), r.default = void 0;
      var i, a = (i = e("../core/main")) && i.__esModule ? i : {
          default: i
        },
        m = function(e) {
          {
            if (e && e.__esModule) return e;
            var t = {};
            if (null != e)
              for (var r in e)
                if (Object.prototype.hasOwnProperty.call(e, r)) {
                  var i = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(e, r) : {};
                  i.get || i.set ? Object.defineProperty(t, r, i) : t[r] = e[r]
                } return t.default = e, t
          }
        }(e("../core/constants"));

      function f(e) {
        return (f = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
          return typeof e
        } : function(e) {
          return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
        })(e)
      }

      function p(e, t) {
        for (var r = function(e, t) {
            if ("object" !== f(e)) e = t;
            else
              for (var r in t) void 0 === e[r] && (e[r] = t[r]);
            return e
          }(t, {
            sampleFactor: .1,
            simplifyThreshold: 0
          }), i = l(e, 0, 1), a = i / (i * r.sampleFactor), n = [], o = 0; o < i; o += a) n.push(l(e, o));
        return r.simplifyThreshold && function(e) {
          for (var t = 1 < arguments.length && void 0 !== arguments[1] ? arguments[1] : 0, r = 0, i = e.length - 1; 3 < e.length && 0 <= i; --i) c(s(e, i - 1), s(e, i), s(e, i + 1), t) && (e.splice(i % e.length, 1), r++)
        }(n, r.simplifyThreshold), n
      }

      function v(e) {
        for (var t, r = [], i = 0; i < e.length; i++) "M" === e[i].type && (t && r.push(t), t = []), t.push(n(e[i]));
        return r.push(t), r
      }

      function n(e) {
        var t = [e.type];
        return "M" === e.type || "L" === e.type ? t.push(e.x, e.y) : "C" === e.type ? t.push(e.x1, e.y1, e.x2, e.y2, e.x, e.y) : "Q" === e.type && t.push(e.x1, e.y1, e.x, e.y), t
      }

      function s(e, t) {
        var r = e.length;
        return e[t < 0 ? t % r + r : t % r]
      }

      function c(e, t, r, i) {
        if (!i) return 0 == (a = e, o = r, ((n = t)[0] - a[0]) * (o[1] - a[1]) - (o[0] - a[0]) * (n[1] - a[1]));
        var a, n, o;
        void 0 === c.tmpPoint1 && (c.tmpPoint1 = [], c.tmpPoint2 = []);
        var s = c.tmpPoint1,
          l = c.tmpPoint2;
        s.x = t.x - e.x, s.y = t.y - e.y, l.x = r.x - t.x, l.y = r.y - t.y;
        var u = s.x * l.x + s.y * l.y,
          h = Math.sqrt(s.x * s.x + s.y * s.y),
          d = Math.sqrt(l.x * l.x + l.y * l.y);
        return Math.acos(u / (h * d)) < i
      }

      function d(e, t, r, i, a, n, o, s, l) {
        var u = 1 - l,
          h = Math.pow(u, 3),
          d = Math.pow(u, 2),
          c = l * l,
          f = c * l,
          p = h * e + 3 * d * l * r + 3 * u * l * l * a + f * o,
          m = h * t + 3 * d * l * i + 3 * u * l * l * n + f * s,
          v = e + 2 * l * (r - e) + c * (a - 2 * r + e),
          g = t + 2 * l * (i - t) + c * (n - 2 * i + t),
          y = r + 2 * l * (a - r) + c * (o - 2 * a + r),
          _ = i + 2 * l * (n - i) + c * (s - 2 * n + i),
          b = u * e + l * r,
          x = u * t + l * i,
          w = u * a + l * o,
          S = u * n + l * s,
          M = 90 - 180 * Math.atan2(v - y, g - _) / Math.PI;
        return (y < v || g < _) && (M += 180), {
          x: p,
          y: m,
          m: {
            x: v,
            y: g
          },
          n: {
            x: y,
            y: _
          },
          start: {
            x: b,
            y: x
          },
          end: {
            x: w,
            y: S
          },
          alpha: M
        }
      }

      function g(e, t, r, i, a, n, o, s, l) {
        return null == l ? y(e, t, r, i, a, n, o, s) : d(e, t, r, i, a, n, o, s, function(e, t, r, i, a, n, o, s, l) {
          if (l < 0 || y(e, t, r, i, a, n, o, s) < l) return;
          var u, h = .5,
            d = 1 - h;
          u = y(e, t, r, i, a, n, o, s, d);
          for (; .01 < Math.abs(u - l);) u = y(e, t, r, i, a, n, o, s, d += (u < l ? 1 : -1) * (h /= 2));
          return d
        }(e, t, r, i, a, n, o, s, l))
      }

      function l(e, t, r) {
        for (var i, a, n, o, s, l = 0, u = 0, h = (e = function(e, t) {
            var n, o = _(e),
              s = t && _(t),
              r = {
                x: 0,
                y: 0,
                bx: 0,
                by: 0,
                X: 0,
                Y: 0,
                qx: null,
                qy: null
              },
              i = {
                x: 0,
                y: 0,
                bx: 0,
                by: 0,
                X: 0,
                Y: 0,
                qx: null,
                qy: null
              },
              a = [],
              l = [],
              u = function(e, t, r) {
                var i, a;
                if (!e) return ["C", t.x, t.y, t.x, t.y, t.x, t.y];
                switch (e[0] in {
                    T: 1,
                    Q: 1
                  } || (t.qx = t.qy = null), e[0]) {
                  case "M":
                    t.X = e[1], t.Y = e[2];
                    break;
                  case "A":
                    e = ["C"].concat(function e(t, r, i, a, n, o, s, l, u, h) {
                      var d = Math.PI;
                      var c = 120 * d / 180;
                      var f;
                      var p;
                      var m;
                      var v;
                      var g = d / 180 * (+n || 0);
                      var y = [];
                      var _;
                      var b = function(e, t, r) {
                        var i = e * Math.cos(r) - t * Math.sin(r),
                          a = e * Math.sin(r) + t * Math.cos(r);
                        return {
                          x: i,
                          y: a
                        }
                      };
                      if (h) f = h[0], p = h[1], m = h[2], v = h[3];
                      else {
                        _ = b(t, r, -g), t = _.x, r = _.y, _ = b(l, u, -g), l = _.x, u = _.y;
                        var x = (t - l) / 2,
                          w = (r - u) / 2,
                          S = x * x / (i * i) + w * w / (a * a);
                        1 < S && (S = Math.sqrt(S), i *= S, a *= S);
                        var M = i * i,
                          E = a * a,
                          T = (o === s ? -1 : 1) * Math.sqrt(Math.abs((M * E - M * w * w - E * x * x) / (M * w * w + E * x * x)));
                        m = T * i * w / a + (t + l) / 2, v = T * -a * x / i + (r + u) / 2, f = Math.asin(((r - v) / a).toFixed(9)), p = Math.asin(((u - v) / a).toFixed(9)), (f = t < m ? d - f : f) < 0 && (f = 2 * d + f), (p = l < m ? d - p : p) < 0 && (p = 2 * d + p), s && p < f && (f -= 2 * d), !s && f < p && (p -= 2 * d)
                      }
                      var C = p - f;
                      if (Math.abs(C) > c) {
                        var P = p,
                          L = l,
                          R = u;
                        p = f + c * (s && f < p ? 1 : -1), l = m + i * Math.cos(p), u = v + a * Math.sin(p), y = e(l, u, i, a, n, 0, s, L, R, [p, P, m, v])
                      }
                      C = p - f;
                      var O = Math.cos(f),
                        D = Math.sin(f),
                        A = Math.cos(p),
                        I = Math.sin(p),
                        k = Math.tan(C / 4),
                        U = 4 / 3 * i * k,
                        F = 4 / 3 * a * k,
                        N = [t, r],
                        B = [t + U * D, r - F * O],
                        G = [l + U * I, u - F * A],
                        j = [l, u];
                      B[0] = 2 * N[0] - B[0];
                      B[1] = 2 * N[1] - B[1]; {
                        if (h) return [B, G, j].concat(y);
                        y = [B, G, j].concat(y).join().split(",");
                        for (var V = [], z = 0, H = y.length; z < H; z++) V[z] = z % 2 ? b(y[z - 1], y[z], g).y : b(y[z], y[z + 1], g).x;
                        return V
                      }
                    }.apply(0, [t.x, t.y].concat(e.slice(1))));
                    break;
                  case "S":
                    a = "C" === r || "S" === r ? (i = 2 * t.x - t.bx, 2 * t.y - t.by) : (i = t.x, t.y), e = ["C", i, a].concat(e.slice(1));
                    break;
                  case "T":
                    t.qy = "Q" === r || "T" === r ? (t.qx = 2 * t.x - t.qx, 2 * t.y - t.qy) : (t.qx = t.x, t.y), e = ["C"].concat(w(t.x, t.y, t.qx, t.qy, e[1], e[2]));
                    break;
                  case "Q":
                    t.qx = e[1], t.qy = e[2], e = ["C"].concat(w(t.x, t.y, e[1], e[2], e[3], e[4]));
                    break;
                  case "L":
                    e = ["C"].concat(x(t.x, t.y, e[1], e[2]));
                    break;
                  case "H":
                    e = ["C"].concat(x(t.x, t.y, e[1], t.y));
                    break;
                  case "V":
                    e = ["C"].concat(x(t.x, t.y, t.x, e[1]));
                    break;
                  case "Z":
                    e = ["C"].concat(x(t.x, t.y, t.X, t.Y))
                }
                return e
              },
              h = function(e, t) {
                if (7 < e[t].length) {
                  e[t].shift();
                  for (var r = e[t]; r.length;) a[t] = "A", s && (l[t] = "A"), e.splice(t++, 0, ["C"].concat(r.splice(0, 6)));
                  e.splice(t, 1), n = Math.max(o.length, s && s.length || 0)
                }
              },
              d = function(e, t, r, i, a) {
                e && t && "M" === e[a][0] && "M" !== t[a][0] && (t.splice(a, 0, ["M", i.x, i.y]), r.bx = 0, r.by = 0, r.x = e[a][1], r.y = e[a][2], n = Math.max(o.length, s && s.length || 0))
              },
              c = "",
              f = "";
            n = Math.max(o.length, s && s.length || 0);
            for (var p = 0; p < n; p++) {
              o[p] && (c = o[p][0]), "C" !== c && (a[p] = c, p && (f = a[p - 1])), o[p] = u(o[p], r, f), "A" !== a[p] && "C" === c && (a[p] = "C"), h(o, p), s && (s[p] && (c = s[p][0]), "C" !== c && (l[p] = c, p && (f = l[p - 1])), s[p] = u(s[p], i, f), "A" !== l[p] && "C" === c && (l[p] = "C"), h(s, p)), d(o, s, r, i, p), d(s, o, i, r, p);
              var m = o[p],
                v = s && s[p],
                g = m.length,
                y = s && v.length;
              r.x = m[g - 2], r.y = m[g - 1], r.bx = parseFloat(m[g - 4]) || r.x, r.by = parseFloat(m[g - 3]) || r.y, i.bx = s && (parseFloat(v[y - 4]) || i.x), i.by = s && (parseFloat(v[y - 3]) || i.y), i.x = s && v[y - 2], i.y = s && v[y - 1]
            }
            return s ? [o, s] : o
          }(e)).length; u < h; u++) {
          if ("M" === (n = e[u])[0]) i = +n[1], a = +n[2];
          else {
            if (t < l + (o = g(i, a, n[1], n[2], n[3], n[4], n[5], n[6])) && !r) return {
              x: (s = g(i, a, n[1], n[2], n[3], n[4], n[5], n[6], t - l)).x,
              y: s.y,
              alpha: s.alpha
            };
            l += o, i = +n[5], a = +n[6]
          }
          n.shift() + n
        }
        return (s = r ? l : d(i, a, n[0], n[1], n[2], n[3], n[4], n[5], 1)).alpha && (s = {
          x: s.x,
          y: s.y,
          alpha: s.alpha
        }), s
      }

      function _(e) {
        var t, r = [],
          i = 0,
          a = 0,
          n = 0,
          o = 0,
          s = 0;
        if (!e) return r;
        "M" === e[0][0] && (n = i = +e[0][1], o = a = +e[0][2], s++, r[0] = ["M", i, a]);
        for (var l, u, h = 3 === e.length && "M" === e[0][0] && "R" === e[1][0].toUpperCase() && "Z" === e[2][0].toUpperCase(), d = s, c = e.length; d < c; d++) {
          if (r.push(l = []), (u = e[d])[0] !== String.prototype.toUpperCase.call(u[0])) switch (l[0] = String.prototype.toUpperCase.call(u[0]), l[0]) {
              case "A":
                l[1] = u[1], l[2] = u[2], l[3] = u[3], l[4] = u[4], l[5] = u[5], l[6] = +(u[6] + i), l[7] = +(u[7] + a);
                break;
              case "V":
                l[1] = +u[1] + a;
                break;
              case "H":
                l[1] = +u[1] + i;
                break;
              case "R":
                for (var f = 2, p = (t = [i, a].concat(u.slice(1))).length; f < p; f++) t[f] = +t[f] + i, t[++f] = +t[f] + a;
                r.pop(), r = r.concat(b(t, h));
                break;
              case "M":
                n = +u[1] + i, o = +u[2] + a;
                break;
              default:
                for (var m = 1, v = u.length; m < v; m++) l[m] = +u[m] + (m % 2 ? i : a)
            } else if ("R" === u[0]) t = [i, a].concat(u.slice(1)), r.pop(), r = r.concat(b(t, h)), l = ["R"].concat(u.slice(-2));
            else
              for (var g = 0, y = u.length; g < y; g++) l[g] = u[g];
          switch (l[0]) {
            case "Z":
              i = n, a = o;
              break;
            case "H":
              i = l[1];
              break;
            case "V":
              a = l[1];
              break;
            case "M":
              n = l[l.length - 2], o = l[l.length - 1];
              break;
            default:
              i = l[l.length - 2], a = l[l.length - 1]
          }
        }
        return r
      }

      function b(e, t) {
        for (var r = [], i = 0, a = e.length; i < a - 2 * !t; i += 2) {
          var n = [{
            x: +e[i - 2],
            y: +e[i - 1]
          }, {
            x: +e[i],
            y: +e[i + 1]
          }, {
            x: +e[i + 2],
            y: +e[i + 3]
          }, {
            x: +e[i + 4],
            y: +e[i + 5]
          }];
          t ? i ? a - 4 === i ? n[3] = {
            x: +e[0],
            y: +e[1]
          } : a - 2 === i && (n[2] = {
            x: +e[0],
            y: +e[1]
          }, n[3] = {
            x: +e[2],
            y: +e[3]
          }) : n[0] = {
            x: +e[a - 2],
            y: +e[a - 1]
          } : a - 4 === i ? n[3] = n[2] : i || (n[0] = {
            x: +e[i],
            y: +e[i + 1]
          }), r.push(["C", (-n[0].x + 6 * n[1].x + n[2].x) / 6, (-n[0].y + 6 * n[1].y + n[2].y) / 6, (n[1].x + 6 * n[2].x - n[3].x) / 6, (n[1].y + 6 * n[2].y - n[3].y) / 6, n[2].x, n[2].y])
        }
        return r
      }

      function x(e, t, r, i) {
        return [e, t, r, i, r, i]
      }

      function w(e, t, r, i, a, n) {
        return [1 / 3 * e + 2 / 3 * r, 1 / 3 * t + 2 / 3 * i, 1 / 3 * a + 2 / 3 * r, 1 / 3 * n + 2 / 3 * i, a, n]
      }

      function y(e, t, r, i, a, n, o, s, l) {
        null == l && (l = 1);
        for (var u = (l = 1 < l ? 1 : l < 0 ? 0 : l) / 2, h = [-.1252, .1252, -.3678, .3678, -.5873, .5873, -.7699, .7699, -.9041, .9041, -.9816, .9816], d = 0, c = [.2491, .2491, .2335, .2335, .2032, .2032, .1601, .1601, .1069, .1069, .0472, .0472], f = 0; f < 12; f++) {
          var p = u * h[f] + u,
            m = S(p, e, r, a, o),
            v = S(p, t, i, n, s),
            g = m * m + v * v;
          d += c[f] * Math.sqrt(g)
        }
        return u * d
      }

      function S(e, t, r, i, a) {
        return e * (e * (-3 * t + 9 * r - 9 * i + 3 * a) + 6 * t - 12 * r + 6 * i) - 3 * t + 3 * r
      }
      a.default.Font = function(e) {
        this.parent = e, this.cache = {}, this.font = void 0
      }, a.default.Font.prototype.textBounds = function(e) {
        var t, r = 1 < arguments.length && void 0 !== arguments[1] ? arguments[1] : 0,
          i = 2 < arguments.length && void 0 !== arguments[2] ? arguments[2] : 0,
          a = 3 < arguments.length ? arguments[3] : void 0,
          n = 4 < arguments.length ? arguments[4] : void 0,
          o = n && n.renderer && n.renderer._pInst || this.parent,
          s = o._renderer.drawingContext;
        s.textAlign || m.LEFT, s.textBaseline || m.BASELINE;
        if (a = a || o._renderer._textSize, !t) {
          var l, u, h, d, c = [],
            f = [],
            p = this._scale(a);
          this.font.forEachGlyph(e, r, i, a, n, function(e, t, r, i) {
            var a = e.getMetrics();
            c.push(t + a.xMin * p), c.push(t + a.xMax * p), f.push(r + -a.yMin * p), f.push(r + -a.yMax * p)
          }), l = Math.min.apply(null, c), u = Math.min.apply(null, f), h = Math.max.apply(null, c), t = {
            x: l,
            y: u,
            h: Math.max.apply(null, f) - u,
            w: h - l,
            advance: l - r
          }, d = this._handleAlignment(o._renderer, e, t.x, t.y, t.w + t.advance), t.x = d.x, t.y = d.y
        }
        return t
      }, a.default.Font.prototype.textToPoints = function(e, t, r, i, a) {
        var n, o = 0,
          s = [],
          l = this._getGlyphs(e);
        i = i || this.parent._renderer._textSize;
        for (var u = 0; u < l.length; u++) {
          if (!(l[n = u].name && "space" === l[n].name || e.length === l.length && " " === e[n] || l[n].index && 3 === l[n].index))
            for (var h = v(l[u].getPath(t, r, i).commands), d = 0; d < h.length; d++)
              for (var c = p(h[d], a), f = 0; f < c.length; f++) c[f].x += o, s.push(c[f]);
          o += l[u].advanceWidth * this._scale(i)
        }
        return s
      }, a.default.Font.prototype._getGlyphs = function(e) {
        return this.font.stringToGlyphs(e)
      }, a.default.Font.prototype._getPath = function(e, t, r, i) {
        var a = (i && i.renderer && i.renderer._pInst || this.parent)._renderer,
          n = this._handleAlignment(a, e, t, r);
        return this.font.getPath(e, n.x, n.y, a._textSize, i)
      }, a.default.Font.prototype._getPathData = function(e, t, r, i) {
        var a = 3;
        return "string" == typeof e && 2 < arguments.length ? e = this._getPath(e, t, r, i) : "object" === f(t) && (i = t), i && "number" == typeof i.decimals && (a = i.decimals), e.toPathData(a)
      }, a.default.Font.prototype._getSVG = function(e, t, r, i) {
        var a = 3;
        return "string" == typeof e && 2 < arguments.length ? e = this._getPath(e, t, r, i) : "object" === f(t) && (i = t), i && ("number" == typeof i.decimals && (a = i.decimals), "number" == typeof i.strokeWidth && (e.strokeWidth = i.strokeWidth), void 0 !== i.fill && (e.fill = i.fill), void 0 !== i.stroke && (e.stroke = i.stroke)), e.toSVG(a)
      }, a.default.Font.prototype._renderPath = function(e, t, r, i) {
        var a, n = i && i.renderer || this.parent._renderer,
          o = n.drawingContext;
        a = "object" === f(e) && e.commands ? e.commands : this._getPath(e, t, r, i).commands, o.beginPath();
        var s = !0,
          l = !1,
          u = void 0;
        try {
          for (var h, d = a[Symbol.iterator](); !(s = (h = d.next()).done); s = !0) {
            var c = h.value;
            "M" === c.type ? o.moveTo(c.x, c.y) : "L" === c.type ? o.lineTo(c.x, c.y) : "C" === c.type ? o.bezierCurveTo(c.x1, c.y1, c.x2, c.y2, c.x, c.y) : "Q" === c.type ? o.quadraticCurveTo(c.x1, c.y1, c.x, c.y) : "Z" === c.type && o.closePath()
          }
        } catch (e) {
          l = !0, u = e
        } finally {
          try {
            s || null == d.return || d.return()
          } finally {
            if (l) throw u
          }
        }
        return n._doStroke && n._strokeSet && o.stroke(), n._doFill && (n._fillSet || n._setFill(m._DEFAULT_TEXT_FILL), o.fill()), this
      }, a.default.Font.prototype._textWidth = function(e, t) {
        return this.font.getAdvanceWidth(e, t)
      }, a.default.Font.prototype._textAscent = function(e) {
        return this.font.ascender * this._scale(e)
      }, a.default.Font.prototype._textDescent = function(e) {
        return -this.font.descender * this._scale(e)
      }, a.default.Font.prototype._scale = function(e) {
        return 1 / this.font.unitsPerEm * (e || this.parent._renderer._textSize)
      }, a.default.Font.prototype._handleAlignment = function(e, t, r, i, a) {
        var n = e._textSize;
        switch (void 0 === a && (a = this._textWidth(t, n)), e._textAlign) {
          case m.CENTER:
            r -= a / 2;
            break;
          case m.RIGHT:
            r -= a
        }
        switch (e._textBaseline) {
          case m.TOP:
            i += this._textAscent(n);
            break;
          case m.CENTER:
            i += this._textAscent(n) / 2;
            break;
          case m.BOTTOM:
            i -= this._textDescent(n)
        }
        return {
          x: r,
          y: i
        }
      };
      var o = a.default;
      r.default = o
    }, {
      "../core/constants": 20,
      "../core/main": 26
    }],
    65: [function(e, t, r) {
      "use strict";
      Object.defineProperty(r, "__esModule", {
        value: !0
      }), r.default = void 0;
      var i, a = (i = e("../core/main")) && i.__esModule ? i : {
        default: i
      };
      a.default.prototype.append = function(e, t) {
        return e.push(t), e
      }, a.default.prototype.arrayCopy = function(e, t, r, i, a) {
        var n, o;
        e = void 0 !== a ? (o = Math.min(a, e.length), n = i, e.slice(t, o + t)) : (o = void 0 !== r ? (o = r, Math.min(o, e.length)) : e.length, n = 0, r = t, e.slice(0, o)), Array.prototype.splice.apply(r, [n, o].concat(e))
      }, a.default.prototype.concat = function(e, t) {
        return e.concat(t)
      }, a.default.prototype.reverse = function(e) {
        return e.reverse()
      }, a.default.prototype.shorten = function(e) {
        return e.pop(), e
      }, a.default.prototype.shuffle = function(e, t) {
        for (var r, i, a = ArrayBuffer && ArrayBuffer.isView && ArrayBuffer.isView(e), n = (e = t || a ? e : e.slice()).length; 1 < n;) r = Math.random() * n | 0, i = e[--n], e[n] = e[r], e[r] = i;
        return e
      }, a.default.prototype.sort = function(e, t) {
        var r = t ? e.slice(0, Math.min(t, e.length)) : e,
          i = t ? e.slice(Math.min(t, e.length)) : [];
        return (r = "string" == typeof r[0] ? r.sort() : r.sort(function(e, t) {
          return e - t
        })).concat(i)
      }, a.default.prototype.splice = function(e, t, r) {
        return Array.prototype.splice.apply(e, [r, 0].concat(t)), e
      }, a.default.prototype.subset = function(e, t, r) {
        return void 0 !== r ? e.slice(t, t + r) : e.slice(t, e.length)
      };
      var n = a.default;
      r.default = n
    }, {
      "../core/main": 26
    }],
    66: [function(e, t, r) {
      "use strict";
      Object.defineProperty(r, "__esModule", {
        value: !0
      }), r.default = void 0;
      var i, a = (i = e("../core/main")) && i.__esModule ? i : {
        default: i
      };
      a.default.prototype.float = function(e) {
        return e instanceof Array ? e.map(parseFloat) : parseFloat(e)
      }, a.default.prototype.int = function(e) {
        var t = 1 < arguments.length && void 0 !== arguments[1] ? arguments[1] : 10;
        return e === 1 / 0 || "Infinity" === e ? 1 / 0 : e === -1 / 0 || "-Infinity" === e ? -1 / 0 : "string" == typeof e ? parseInt(e, t) : "number" == typeof e ? 0 | e : "boolean" == typeof e ? e ? 1 : 0 : e instanceof Array ? e.map(function(e) {
          return a.default.prototype.int(e, t)
        }) : void 0
      }, a.default.prototype.str = function(e) {
        return e instanceof Array ? e.map(a.default.prototype.str) : String(e)
      }, a.default.prototype.boolean = function(e) {
        return "number" == typeof e ? 0 !== e : "string" == typeof e ? "true" === e.toLowerCase() : "boolean" == typeof e ? e : e instanceof Array ? e.map(a.default.prototype.boolean) : void 0
      }, a.default.prototype.byte = function(e) {
        var t = a.default.prototype.int(e, 10);
        return "number" == typeof t ? (t + 128) % 256 - 128 : t instanceof Array ? t.map(a.default.prototype.byte) : void 0
      }, a.default.prototype.char = function(e) {
        return "number" != typeof e || isNaN(e) ? e instanceof Array ? e.map(a.default.prototype.char) : "string" == typeof e ? a.default.prototype.char(parseInt(e, 10)) : void 0 : String.fromCharCode(e)
      }, a.default.prototype.unchar = function(e) {
        return "string" == typeof e && 1 === e.length ? e.charCodeAt(0) : e instanceof Array ? e.map(a.default.prototype.unchar) : void 0
      }, a.default.prototype.hex = function(e, t) {
        if (t = null == t ? t = 8 : t, e instanceof Array) return e.map(function(e) {
          return a.default.prototype.hex(e, t)
        });
        if (e === 1 / 0 || e === -1 / 0) return (e === 1 / 0 ? "F" : "0").repeat(t);
        if ("number" == typeof e) {
          e < 0 && (e = 4294967295 + e + 1);
          for (var r = Number(e).toString(16).toUpperCase(); r.length < t;) r = "0".concat(r);
          return r.length >= t && (r = r.substring(r.length - t, r.length)), r
        }
      }, a.default.prototype.unhex = function(e) {
        return e instanceof Array ? e.map(a.default.prototype.unhex) : parseInt("0x".concat(e), 16)
      };
      var n = a.default;
      r.default = n
    }, {
      "../core/main": 26
    }],
    67: [function(e, t, r) {
      "use strict";
      Object.defineProperty(r, "__esModule", {
        value: !0
      }), r.default = void 0;
      var i, o = (i = e("../core/main")) && i.__esModule ? i : {
        default: i
      };

      function a(e, t, r) {
        var i = e < 0,
          a = i ? e.toString().substring(1) : e.toString(),
          n = a.indexOf("."),
          o = -1 !== n ? a.substring(0, n) : a,
          s = -1 !== n ? a.substring(n + 1) : "",
          l = i ? "-" : "";
        if (void 0 !== r) {
          var u = "";
          (-1 !== n || 0 < r - s.length) && (u = "."), s.length > r && (s = s.substring(0, r));
          for (var h = 0; h < t - o.length; h++) l += "0";
          l += o, l += u, l += s;
          for (var d = 0; d < r - s.length; d++) l += "0";
          return l
        }
        for (var c = 0; c < Math.max(t - o.length, 0); c++) l += "0";
        return l += a
      }

      function n(e, t) {
        var r = (e = e.toString()).indexOf("."),
          i = -1 !== r ? e.substring(r) : "",
          a = -1 !== r ? e.substring(0, r) : e;
        if (a = a.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","), 0 === t) i = "";
        else if (void 0 !== t)
          if (t > i.length)
            for (var n = t - (i += -1 === r ? "." : "").length + 1, o = 0; o < n; o++) i += "0";
          else i = i.substring(0, t + 1);
        return a + i
      }

      function s(e) {
        return 0 < parseFloat(e) ? "+".concat(e.toString()) : e.toString()
      }

      function l(e) {
        return 0 <= parseFloat(e) ? " ".concat(e.toString()) : e.toString()
      }
      e("../core/error_helpers"), o.default.prototype.join = function(e, t) {
        return o.default._validateParameters("join", arguments), e.join(t)
      }, o.default.prototype.match = function(e, t) {
        return o.default._validateParameters("match", arguments), e.match(t)
      }, o.default.prototype.matchAll = function(e, t) {
        o.default._validateParameters("matchAll", arguments);
        for (var r = new RegExp(t, "g"), i = r.exec(e), a = []; null !== i;) a.push(i), i = r.exec(e);
        return a
      }, o.default.prototype.nf = function(e, t, r) {
        return o.default._validateParameters("nf", arguments), e instanceof Array ? e.map(function(e) {
          return a(e, t, r)
        }) : "[object Arguments]" === Object.prototype.toString.call(e) ? 3 === e.length ? this.nf(e[0], e[1], e[2]) : 2 === e.length ? this.nf(e[0], e[1]) : this.nf(e[0]) : a(e, t, r)
      }, o.default.prototype.nfc = function(e, t) {
        return o.default._validateParameters("nfc", arguments), e instanceof Array ? e.map(function(e) {
          return n(e, t)
        }) : n(e, t)
      }, o.default.prototype.nfp = function() {
        for (var e = arguments.length, t = new Array(e), r = 0; r < e; r++) t[r] = arguments[r];
        o.default._validateParameters("nfp", t);
        var i = o.default.prototype.nf.apply(this, t);
        return i instanceof Array ? i.map(s) : s(i)
      }, o.default.prototype.nfs = function() {
        for (var e = arguments.length, t = new Array(e), r = 0; r < e; r++) t[r] = arguments[r];
        o.default._validateParameters("nfs", t);
        var i = o.default.prototype.nf.apply(this, t);
        return i instanceof Array ? i.map(l) : l(i)
      }, o.default.prototype.split = function(e, t) {
        return o.default._validateParameters("split", arguments), e.split(t)
      }, o.default.prototype.splitTokens = function(e, t) {
        var r;
        if (o.default._validateParameters("splitTokens", arguments), void 0 !== t) {
          var i = t,
            a = /\]/g.exec(i),
            n = /\[/g.exec(i);
          r = n && a ? (i = i.slice(0, a.index) + i.slice(a.index + 1), n = /\[/g.exec(i), i = i.slice(0, n.index) + i.slice(n.index + 1), new RegExp("[\\[".concat(i, "\\]]"), "g")) : a ? (i = i.slice(0, a.index) + i.slice(a.index + 1), new RegExp("[".concat(i, "\\]]"), "g")) : n ? (i = i.slice(0, n.index) + i.slice(n.index + 1), new RegExp("[".concat(i, "\\[]"), "g")) : new RegExp("[".concat(i, "]"), "g")
        } else r = /\s/g;
        return e.split(r).filter(function(e) {
          return e
        })
      }, o.default.prototype.trim = function(e) {
        return o.default._validateParameters("trim", arguments), e instanceof Array ? e.map(this.trim) : e.trim()
      };
      var u = o.default;
      r.default = u
    }, {
      "../core/error_helpers": 22,
      "../core/main": 26
    }],
    68: [function(e, t, r) {
      "use strict";
      Object.defineProperty(r, "__esModule", {
        value: !0
      }), r.default = void 0;
      var i, a = (i = e("../core/main")) && i.__esModule ? i : {
        default: i
      };
      a.default.prototype.day = function() {
        return (new Date).getDate()
      }, a.default.prototype.hour = function() {
        return (new Date).getHours()
      }, a.default.prototype.minute = function() {
        return (new Date).getMinutes()
      }, a.default.prototype.millis = function() {
        return window.performance.now()
      }, a.default.prototype.month = function() {
        return (new Date).getMonth() + 1
      }, a.default.prototype.second = function() {
        return (new Date).getSeconds()
      }, a.default.prototype.year = function() {
        return (new Date).getFullYear()
      };
      var n = a.default;
      r.default = n
    }, {
      "../core/main": 26
    }],
    69: [function(e, t, r) {
      "use strict";
      Object.defineProperty(r, "__esModule", {
        value: !0
      }), r.default = void 0;
      var i, T = (i = e("../core/main")) && i.__esModule ? i : {
        default: i
      };
      e("./p5.Geometry");
      var f = function(e) {
        {
          if (e && e.__esModule) return e;
          var t = {};
          if (null != e)
            for (var r in e)
              if (Object.prototype.hasOwnProperty.call(e, r)) {
                var i = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(e, r) : {};
                i.get || i.set ? Object.defineProperty(t, r, i) : t[r] = e[r]
              } return t.default = e, t
        }
      }(e("../core/constants"));
      T.default.prototype.plane = function(e, t, r, i) {
        this._assert3d("plane"), T.default._validateParameters("plane", arguments), void 0 === e && (e = 50), void 0 === t && (t = e), void 0 === r && (r = 1), void 0 === i && (i = 1);
        var a = "plane|".concat(r, "|").concat(i);
        if (!this._renderer.geometryInHash(a)) {
          var n = new T.default.Geometry(r, i, function() {
            for (var e, t, r, i = 0; i <= this.detailY; i++) {
              t = i / this.detailY;
              for (var a = 0; a <= this.detailX; a++) e = a / this.detailX, r = new T.default.Vector(e - .5, t - .5, 0), this.vertices.push(r), this.uvs.push(e, t)
            }
          });
          n.computeFaces().computeNormals(), r <= 1 && i <= 1 ? n._makeTriangleEdges()._edgesToVertices() : console.log("Cannot draw stroke on plane objects with more than 1 detailX or 1 detailY"), this._renderer.createBuffers(a, n)
        }
        return this._renderer.drawBuffersScaled(a, e, t, 1), this
      }, T.default.prototype.box = function(e, t, r, i, a) {
        this._assert3d("box"), T.default._validateParameters("box", arguments), void 0 === e && (e = 50), void 0 === t && (t = e), void 0 === r && (r = t);
        var n = this._renderer.attributes && this._renderer.attributes.perPixelLighting;
        void 0 === i && (i = n ? 1 : 4), void 0 === a && (a = n ? 1 : 4);
        var o = "box|".concat(i, "|").concat(a);
        if (!this._renderer.geometryInHash(o)) {
          var s = new T.default.Geometry(i, a, function() {
            var e = [
              [0, 4, 2, 6],
              [1, 3, 5, 7],
              [0, 1, 4, 5],
              [2, 6, 3, 7],
              [0, 2, 1, 3],
              [4, 5, 6, 7]
            ];
            this.strokeIndices = [
              [0, 1],
              [1, 3],
              [3, 2],
              [6, 7],
              [8, 9],
              [9, 11],
              [14, 15],
              [16, 17],
              [17, 19],
              [18, 19],
              [20, 21],
              [22, 23]
            ];
            for (var t = 0; t < e.length; t++) {
              for (var r = e[t], i = 4 * t, a = 0; a < 4; a++) {
                var n = r[a],
                  o = new T.default.Vector((2 * (1 & n) - 1) / 2, ((2 & n) - 1) / 2, ((4 & n) / 2 - 1) / 2);
                this.vertices.push(o), this.uvs.push(1 & a, (2 & a) / 2)
              }
              this.faces.push([i, i + 1, i + 2]), this.faces.push([i + 2, i + 1, i + 3])
            }
          });
          s.computeNormals(), i <= 4 && a <= 4 ? s._makeTriangleEdges()._edgesToVertices() : console.log("Cannot draw stroke on box objects with more than 4 detailX or 4 detailY"), this._renderer.createBuffers(o, s)
        }
        return this._renderer.drawBuffersScaled(o, e, t, r), this
      }, T.default.prototype.sphere = function(e, t, r) {
        return this._assert3d("sphere"), T.default._validateParameters("sphere", arguments), void 0 === e && (e = 50), void 0 === t && (t = 24), void 0 === r && (r = 16), this.ellipsoid(e, e, e, t, r), this
      };
      var l = function(e, t, r, i, a, n, o) {
        e = e <= 0 ? 1 : e, t = t < 0 ? 0 : t, r = r <= 0 ? e : r, i = i < 3 ? 3 : i;
        var s, l, u, h = (n = void 0 === n || n) ? -2 : 0,
          d = (a = a < 1 ? 1 : a) + ((o = void 0 === o ? 0 !== t : o) ? 2 : 0),
          c = Math.atan2(e - t, r),
          f = Math.sin(c),
          p = Math.cos(c);
        for (s = h; s <= d; ++s) {
          var m = s / a,
            v = r * m,
            g = void 0;
          for (g = s < 0 ? (m = v = 0, e) : a < s ? (v = r, m = 1, t) : e + (t - e) * m, -2 !== s && s !== a + 2 || (g = 0), v -= r / 2, l = 0; l < i; ++l) {
            var y = l / i,
              _ = 2 * Math.PI * y,
              b = Math.sin(_),
              x = Math.cos(_);
            this.vertices.push(new T.default.Vector(b * g, v, x * g));
            var w = void 0;
            w = s < 0 ? new T.default.Vector(0, -1, 0) : a < s && t ? new T.default.Vector(0, 1, 0) : new T.default.Vector(b * p, f, x * p), this.vertexNormals.push(w), this.uvs.push(y, m)
          }
        }
        var S = 0;
        if (n) {
          for (u = 0; u < i; ++u) {
            var M = (u + 1) % i;
            this.faces.push([S + u, S + i + M, S + i + u])
          }
          S += 2 * i
        }
        for (s = 0; s < a; ++s) {
          for (l = 0; l < i; ++l) {
            var E = (l + 1) % i;
            this.faces.push([S + l, S + E, S + i + E]), this.faces.push([S + l, S + i + E, S + i + l])
          }
          S += i
        }
        if (o)
          for (S += i, l = 0; l < i; ++l) this.faces.push([S + l, S + (l + 1) % i, S + i])
      };
      T.default.prototype.cylinder = function(e, t, r, i, a, n) {
        this._assert3d("cylinder"), T.default._validateParameters("cylinder", arguments), void 0 === e && (e = 50), void 0 === t && (t = e), void 0 === r && (r = 24), void 0 === i && (i = 1), void 0 === n && (n = !0), void 0 === a && (a = !0);
        var o = "cylinder|".concat(r, "|").concat(i, "|").concat(a, "|").concat(n);
        if (!this._renderer.geometryInHash(o)) {
          var s = new T.default.Geometry(r, i);
          l.call(s, 1, 1, 1, r, i, a, n), r <= 24 && i <= 16 ? s._makeTriangleEdges()._edgesToVertices() : console.log("Cannot draw stroke on cylinder objects with more than 24 detailX or 16 detailY"), this._renderer.createBuffers(o, s)
        }
        return this._renderer.drawBuffersScaled(o, e, t, e), this
      }, T.default.prototype.cone = function(e, t, r, i, a) {
        this._assert3d("cone"), T.default._validateParameters("cone", arguments), void 0 === e && (e = 50), void 0 === t && (t = e), void 0 === r && (r = 24), void 0 === i && (i = 1), void 0 === a && (a = !0);
        var n = "cone|".concat(r, "|").concat(i, "|").concat(a);
        if (!this._renderer.geometryInHash(n)) {
          var o = new T.default.Geometry(r, i);
          l.call(o, 1, 0, 1, r, i, a, !1), r <= 24 && i <= 16 ? o._makeTriangleEdges()._edgesToVertices() : console.log("Cannot draw stroke on cone objects with more than 24 detailX or 16 detailY"), this._renderer.createBuffers(n, o)
        }
        return this._renderer.drawBuffersScaled(n, e, t, e), this
      }, T.default.prototype.ellipsoid = function(e, t, r, i, a) {
        this._assert3d("ellipsoid"), T.default._validateParameters("ellipsoid", arguments), void 0 === e && (e = 50), void 0 === t && (t = e), void 0 === r && (r = e), void 0 === i && (i = 24), void 0 === a && (a = 16);
        var n = "ellipsoid|".concat(i, "|").concat(a);
        if (!this._renderer.geometryInHash(n)) {
          var o = new T.default.Geometry(i, a, function() {
            for (var e = 0; e <= this.detailY; e++)
              for (var t = e / this.detailY, r = Math.PI * t - Math.PI / 2, i = Math.cos(r), a = Math.sin(r), n = 0; n <= this.detailX; n++) {
                var o = n / this.detailX,
                  s = 2 * Math.PI * o,
                  l = Math.cos(s),
                  u = Math.sin(s),
                  h = new T.default.Vector(i * u, a, i * l);
                this.vertices.push(h), this.vertexNormals.push(h), this.uvs.push(o, t)
              }
          });
          o.computeFaces(), i <= 24 && a <= 24 ? o._makeTriangleEdges()._edgesToVertices() : console.log("Cannot draw stroke on ellipsoids with more than 24 detailX or 24 detailY"), this._renderer.createBuffers(n, o)
        }
        return this._renderer.drawBuffersScaled(n, e, t, r), this
      }, T.default.prototype.torus = function(e, t, r, i) {
        if (this._assert3d("torus"), T.default._validateParameters("torus", arguments), void 0 === e) e = 50;
        else if (!e) return;
        if (void 0 === t) t = 10;
        else if (!t) return;
        void 0 === r && (r = 24), void 0 === i && (i = 16);
        var f = (t / e).toPrecision(4),
          a = "torus|".concat(f, "|").concat(r, "|").concat(i);
        if (!this._renderer.geometryInHash(a)) {
          var n = new T.default.Geometry(r, i, function() {
            for (var e = 0; e <= this.detailY; e++)
              for (var t = e / this.detailY, r = 2 * Math.PI * t, i = Math.cos(r), a = Math.sin(r), n = 1 + f * i, o = 0; o <= this.detailX; o++) {
                var s = o / this.detailX,
                  l = 2 * Math.PI * s,
                  u = Math.cos(l),
                  h = Math.sin(l),
                  d = new T.default.Vector(n * u, n * h, f * a),
                  c = new T.default.Vector(i * u, i * h, a);
                this.vertices.push(d), this.vertexNormals.push(c), this.uvs.push(s, t)
              }
          });
          n.computeFaces(), r <= 24 && i <= 16 ? n._makeTriangleEdges()._edgesToVertices() : console.log("Cannot draw strokes on torus object with more than 24 detailX or 16 detailY"), this._renderer.createBuffers(a, n)
        }
        return this._renderer.drawBuffersScaled(a, e, e, e), this
      }, T.default.RendererGL.prototype.point = function(e, t, r) {
        void 0 === r && (r = 0);
        var i = [];
        return i.push(new T.default.Vector(e, t, r)), this._drawPoints(i, this._pointVertexBuffer), this
      }, T.default.RendererGL.prototype.triangle = function(e) {
        var t = e[0],
          r = e[1],
          i = e[2],
          a = e[3],
          n = e[4],
          o = e[5];
        if (!this.geometryInHash("tri")) {
          var s = new T.default.Geometry(1, 1, function() {
            var e = [];
            e.push(new T.default.Vector(0, 0, 0)), e.push(new T.default.Vector(0, 1, 0)), e.push(new T.default.Vector(1, 0, 0)), this.strokeIndices = [
              [0, 1],
              [1, 2],
              [2, 0]
            ], this.vertices = e, this.faces = [
              [0, 1, 2]
            ], this.uvs = [0, 0, 0, 1, 1, 1]
          });
          s._makeTriangleEdges()._edgesToVertices(), s.computeNormals(), this.createBuffers("tri", s)
        }
        var l = this.uMVMatrix.copy();
        try {
          var u = new T.default.Matrix([i - t, a - r, 0, 0, n - t, o - r, 0, 0, 0, 0, 1, 0, t, r, 0, 1]).mult(this.uMVMatrix);
          this.uMVMatrix = u, this.drawBuffers("tri")
        } finally {
          this.uMVMatrix = l
        }
        return this
      }, T.default.RendererGL.prototype.ellipse = function(e) {
        this.arc(e[0], e[1], e[2], e[3], 0, f.TWO_PI, f.OPEN, e[4])
      }, T.default.RendererGL.prototype.arc = function(e) {
        var t, r, i = e,
          a = arguments[1],
          n = arguments[2],
          o = arguments[3],
          s = arguments[4],
          l = arguments[5],
          u = arguments[6],
          h = arguments[7] || 25;
        if (r = Math.abs(l - s) >= f.TWO_PI ? "".concat(t = "ellipse", "|").concat(h, "|") : "".concat(t = "arc", "|").concat(s, "|").concat(l, "|").concat(u, "|").concat(h, "|"), !this.geometryInHash(r)) {
          var d = new T.default.Geometry(h, 1, function() {
            if (this.strokeIndices = [], s.toFixed(10) !== l.toFixed(10)) {
              u !== f.PIE && void 0 !== u || (this.vertices.push(new T.default.Vector(.5, .5, 0)), this.uvs.push([.5, .5]));
              for (var e = 0; e <= h; e++) {
                var t = e / h * (l - s) + s,
                  r = .5 + Math.cos(t) / 2,
                  i = .5 + Math.sin(t) / 2;
                this.vertices.push(new T.default.Vector(r, i, 0)), this.uvs.push([r, i]), e < h - 1 && (this.faces.push([0, e + 1, e + 2]), this.strokeIndices.push([e + 1, e + 2]))
              }
              switch (u) {
                case f.PIE:
                  this.faces.push([0, this.vertices.length - 2, this.vertices.length - 1]), this.strokeIndices.push([0, 1]), this.strokeIndices.push([this.vertices.length - 2, this.vertices.length - 1]), this.strokeIndices.push([0, this.vertices.length - 1]);
                  break;
                case f.CHORD:
                  this.strokeIndices.push([0, 1]), this.strokeIndices.push([0, this.vertices.length - 1]);
                  break;
                case f.OPEN:
                  this.strokeIndices.push([0, 1]);
                  break;
                default:
                  this.faces.push([0, this.vertices.length - 2, this.vertices.length - 1]), this.strokeIndices.push([this.vertices.length - 2, this.vertices.length - 1])
              }
            }
          });
          d.computeNormals(), h <= 50 ? d._makeTriangleEdges()._edgesToVertices(d) : console.log("Cannot stroke ".concat(t, " with more than 50 detail")), this.createBuffers(r, d)
        }
        var c = this.uMVMatrix.copy();
        try {
          this.uMVMatrix.translate([i, a, 0]), this.uMVMatrix.scale(n, o, 1), this.drawBuffers(r)
        } finally {
          this.uMVMatrix = c
        }
        return this
      }, T.default.RendererGL.prototype.rect = function(e) {
        var t = this._pInst._glAttributes.perPixelLighting,
          r = e[0],
          i = e[1],
          a = e[2],
          n = e[3],
          o = e[4] || (t ? 1 : 24),
          s = e[5] || (t ? 1 : 16),
          l = "rect|".concat(o, "|").concat(s);
        if (!this.geometryInHash(l)) {
          var u = new T.default.Geometry(o, s, function() {
            for (var e = 0; e <= this.detailY; e++)
              for (var t = e / this.detailY, r = 0; r <= this.detailX; r++) {
                var i = r / this.detailX,
                  a = new T.default.Vector(i, t, 0);
                this.vertices.push(a), this.uvs.push(i, t)
              }
            0 < o && 0 < s && (this.strokeIndices = [
              [0, o],
              [o, (o + 1) * (s + 1) - 1],
              [(o + 1) * (s + 1) - 1, (o + 1) * s],
              [(o + 1) * s, 0]
            ])
          });
          u.computeFaces().computeNormals()._makeTriangleEdges()._edgesToVertices(), this.createBuffers(l, u)
        }
        var h = this.uMVMatrix.copy();
        try {
          this.uMVMatrix.translate([r, i, 0]), this.uMVMatrix.scale(a, n, 1), this.drawBuffers(l)
        } finally {
          this.uMVMatrix = h
        }
        return this
      }, T.default.RendererGL.prototype.quad = function(e, t, r, i, a, n, o, s, l, u, h, d) {
        var c = "quad|".concat(e, "|").concat(t, "|").concat(r, "|").concat(i, "|").concat(a, "|").concat(n, "|").concat(o, "|").concat(s, "|").concat(l, "|").concat(u, "|").concat(h, "|").concat(d);
        if (!this.geometryInHash(c)) {
          var f = new T.default.Geometry(2, 2, function() {
            this.vertices.push(new T.default.Vector(e, t, r)), this.vertices.push(new T.default.Vector(i, a, n)), this.vertices.push(new T.default.Vector(o, s, l)), this.vertices.push(new T.default.Vector(u, h, d)), this.uvs.push(0, 0, 1, 0, 1, 1, 0, 1), this.strokeIndices = [
              [0, 1],
              [1, 2],
              [2, 3],
              [3, 0]
            ]
          });
          f.computeNormals()._makeTriangleEdges()._edgesToVertices(), f.faces = [
            [0, 1, 2],
            [2, 3, 0]
          ], this.createBuffers(c, f)
        }
        return this.drawBuffers(c), this
      }, T.default.RendererGL.prototype.bezier = function(e, t, r, i, a, n, o, s, l, u, h, d) {
        8 === arguments.length && (h = s, u = o, s = n, o = a, a = i, i = r, r = n = l = d = 0);
        var c = this._pInst._bezierDetail || 20;
        this.beginShape();
        for (var f = 0; f <= c; f++) {
          var p = Math.pow(1 - f / c, 3),
            m = f / c * 3 * Math.pow(1 - f / c, 2),
            v = 3 * Math.pow(f / c, 2) * (1 - f / c),
            g = Math.pow(f / c, 3);
          this.vertex(e * p + i * m + o * v + u * g, t * p + a * m + s * v + h * g, r * p + n * m + l * v + d * g)
        }
        return this.endShape(), this
      }, T.default.RendererGL.prototype.curve = function(e, t, r, i, a, n, o, s, l, u, h, d) {
        8 === arguments.length && (u = o, h = s, o = a, s = i, a = i = r, r = n = l = d = 0);
        var c = this._pInst._curveDetail;
        this.beginShape();
        for (var f = 0; f <= c; f++) {
          var p = .5 * Math.pow(f / c, 3),
            m = .5 * Math.pow(f / c, 2),
            v = f / c * .5,
            g = p * (3 * i - e - 3 * o + u) + m * (2 * e - 5 * i + 4 * o - u) + v * (-e + o) + 2 * i * .5,
            y = p * (3 * a - t - 3 * s + h) + m * (2 * t - 5 * a + 4 * s - h) + v * (-t + s) + 2 * a * .5,
            _ = p * (3 * n - r - 3 * l + d) + m * (2 * r - 5 * n + 4 * l - d) + v * (-r + l) + 2 * n * .5;
          this.vertex(g, y, _)
        }
        return this.endShape(), this
      }, T.default.RendererGL.prototype.line = function() {
        return 6 === arguments.length ? (this.beginShape(), this.vertex(arguments.length <= 0 ? void 0 : arguments[0], arguments.length <= 1 ? void 0 : arguments[1], arguments.length <= 2 ? void 0 : arguments[2]), this.vertex(arguments.length <= 3 ? void 0 : arguments[3], arguments.length <= 4 ? void 0 : arguments[4], arguments.length <= 5 ? void 0 : arguments[5]), this.endShape()) : 4 === arguments.length && (this.beginShape(), this.vertex(arguments.length <= 0 ? void 0 : arguments[0], arguments.length <= 1 ? void 0 : arguments[1], 0), this.vertex(arguments.length <= 2 ? void 0 : arguments[2], arguments.length <= 3 ? void 0 : arguments[3], 0), this.endShape()), this
      }, T.default.RendererGL.prototype.bezierVertex = function() {
        if (0 === this.immediateMode._bezierVertex.length) throw Error("vertex() must be used once before calling bezierVertex()");
        var e, t, r, i, a, n = [],
          o = [],
          s = [],
          l = arguments.length;
        if ((e = 0) === this._lookUpTableBezier.length || this._lutBezierDetail !== this._pInst._curveDetail) {
          this._lookUpTableBezier = [], this._lutBezierDetail = this._pInst._curveDetail;
          for (var u = 1 / this._lutBezierDetail, h = 0, d = 1, c = 0; h < 1;) {
            if (e = parseFloat(h.toFixed(6)), this._lookUpTableBezier[c] = this._bezierCoefficients(e), d.toFixed(6) === u.toFixed(6)) {
              e = parseFloat(d.toFixed(6)) + parseFloat(h.toFixed(6)), ++c, this._lookUpTableBezier[c] = this._bezierCoefficients(e);
              break
            }
            h += u, d -= u, ++c
          }
        }
        var f = this._lookUpTableBezier.length;
        if (6 === l) {
          for (this.isBezier = !0, n = [this.immediateMode._bezierVertex[0], arguments.length <= 0 ? void 0 : arguments[0], arguments.length <= 2 ? void 0 : arguments[2], arguments.length <= 4 ? void 0 : arguments[4]], o = [this.immediateMode._bezierVertex[1], arguments.length <= 1 ? void 0 : arguments[1], arguments.length <= 3 ? void 0 : arguments[3], arguments.length <= 5 ? void 0 : arguments[5]], a = 0; a < f; a++) t = n[0] * this._lookUpTableBezier[a][0] + n[1] * this._lookUpTableBezier[a][1] + n[2] * this._lookUpTableBezier[a][2] + n[3] * this._lookUpTableBezier[a][3], r = o[0] * this._lookUpTableBezier[a][0] + o[1] * this._lookUpTableBezier[a][1] + o[2] * this._lookUpTableBezier[a][2] + o[3] * this._lookUpTableBezier[a][3], this.vertex(t, r);
          this.immediateMode._bezierVertex[0] = arguments.length <= 4 ? void 0 : arguments[4], this.immediateMode._bezierVertex[1] = arguments.length <= 5 ? void 0 : arguments[5]
        } else if (9 === l) {
          for (this.isBezier = !0, n = [this.immediateMode._bezierVertex[0], arguments.length <= 0 ? void 0 : arguments[0], arguments.length <= 3 ? void 0 : arguments[3], arguments.length <= 6 ? void 0 : arguments[6]], o = [this.immediateMode._bezierVertex[1], arguments.length <= 1 ? void 0 : arguments[1], arguments.length <= 4 ? void 0 : arguments[4], arguments.length <= 7 ? void 0 : arguments[7]], s = [this.immediateMode._bezierVertex[2], arguments.length <= 2 ? void 0 : arguments[2], arguments.length <= 5 ? void 0 : arguments[5], arguments.length <= 8 ? void 0 : arguments[8]], a = 0; a < f; a++) t = n[0] * this._lookUpTableBezier[a][0] + n[1] * this._lookUpTableBezier[a][1] + n[2] * this._lookUpTableBezier[a][2] + n[3] * this._lookUpTableBezier[a][3], r = o[0] * this._lookUpTableBezier[a][0] + o[1] * this._lookUpTableBezier[a][1] + o[2] * this._lookUpTableBezier[a][2] + o[3] * this._lookUpTableBezier[a][3], i = s[0] * this._lookUpTableBezier[a][0] + s[1] * this._lookUpTableBezier[a][1] + s[2] * this._lookUpTableBezier[a][2] + s[3] * this._lookUpTableBezier[a][3], this.vertex(t, r, i);
          this.immediateMode._bezierVertex[0] = arguments.length <= 6 ? void 0 : arguments[6], this.immediateMode._bezierVertex[1] = arguments.length <= 7 ? void 0 : arguments[7], this.immediateMode._bezierVertex[2] = arguments.length <= 8 ? void 0 : arguments[8]
        }
      }, T.default.RendererGL.prototype.quadraticVertex = function() {
        if (0 === this.immediateMode._quadraticVertex.length) throw Error("vertex() must be used once before calling quadraticVertex()");
        var e, t, r, i, a, n = [],
          o = [],
          s = [],
          l = arguments.length;
        if ((e = 0) === this._lookUpTableQuadratic.length || this._lutQuadraticDetail !== this._pInst._curveDetail) {
          this._lookUpTableQuadratic = [], this._lutQuadraticDetail = this._pInst._curveDetail;
          for (var u = 1 / this._lutQuadraticDetail, h = 0, d = 1, c = 0; h < 1;) {
            if (e = parseFloat(h.toFixed(6)), this._lookUpTableQuadratic[c] = this._quadraticCoefficients(e), d.toFixed(6) === u.toFixed(6)) {
              e = parseFloat(d.toFixed(6)) + parseFloat(h.toFixed(6)), ++c, this._lookUpTableQuadratic[c] = this._quadraticCoefficients(e);
              break
            }
            h += u, d -= u, ++c
          }
        }
        var f = this._lookUpTableQuadratic.length;
        if (4 === l) {
          for (this.isQuadratic = !0, n = [this.immediateMode._quadraticVertex[0], arguments.length <= 0 ? void 0 : arguments[0], arguments.length <= 2 ? void 0 : arguments[2]], o = [this.immediateMode._quadraticVertex[1], arguments.length <= 1 ? void 0 : arguments[1], arguments.length <= 3 ? void 0 : arguments[3]], a = 0; a < f; a++) t = n[0] * this._lookUpTableQuadratic[a][0] + n[1] * this._lookUpTableQuadratic[a][1] + n[2] * this._lookUpTableQuadratic[a][2], r = o[0] * this._lookUpTableQuadratic[a][0] + o[1] * this._lookUpTableQuadratic[a][1] + o[2] * this._lookUpTableQuadratic[a][2], this.vertex(t, r);
          this.immediateMode._quadraticVertex[0] = arguments.length <= 2 ? void 0 : arguments[2], this.immediateMode._quadraticVertex[1] = arguments.length <= 3 ? void 0 : arguments[3]
        } else if (6 === l) {
          for (this.isQuadratic = !0, n = [this.immediateMode._quadraticVertex[0], arguments.length <= 0 ? void 0 : arguments[0], arguments.length <= 3 ? void 0 : arguments[3]], o = [this.immediateMode._quadraticVertex[1], arguments.length <= 1 ? void 0 : arguments[1], arguments.length <= 4 ? void 0 : arguments[4]], s = [this.immediateMode._quadraticVertex[2], arguments.length <= 2 ? void 0 : arguments[2], arguments.length <= 5 ? void 0 : arguments[5]], a = 0; a < f; a++) t = n[0] * this._lookUpTableQuadratic[a][0] + n[1] * this._lookUpTableQuadratic[a][1] + n[2] * this._lookUpTableQuadratic[a][2], r = o[0] * this._lookUpTableQuadratic[a][0] + o[1] * this._lookUpTableQuadratic[a][1] + o[2] * this._lookUpTableQuadratic[a][2], i = s[0] * this._lookUpTableQuadratic[a][0] + s[1] * this._lookUpTableQuadratic[a][1] + s[2] * this._lookUpTableQuadratic[a][2], this.vertex(t, r, i);
          this.immediateMode._quadraticVertex[0] = arguments.length <= 3 ? void 0 : arguments[3], this.immediateMode._quadraticVertex[1] = arguments.length <= 4 ? void 0 : arguments[4], this.immediateMode._quadraticVertex[2] = arguments.length <= 5 ? void 0 : arguments[5]
        }
      }, T.default.RendererGL.prototype.curveVertex = function() {
        var e, t, r, i, a, n = [],
          o = [],
          s = [];
        e = 0;
        var l = arguments.length;
        if (0 === this._lookUpTableBezier.length || this._lutBezierDetail !== this._pInst._curveDetail) {
          this._lookUpTableBezier = [], this._lutBezierDetail = this._pInst._curveDetail;
          for (var u = 1 / this._lutBezierDetail, h = 0, d = 1, c = 0; h < 1;) {
            if (e = parseFloat(h.toFixed(6)), this._lookUpTableBezier[c] = this._bezierCoefficients(e), d.toFixed(6) === u.toFixed(6)) {
              e = parseFloat(d.toFixed(6)) + parseFloat(h.toFixed(6)), ++c, this._lookUpTableBezier[c] = this._bezierCoefficients(e);
              break
            }
            h += u, d -= u, ++c
          }
        }
        var f = this._lookUpTableBezier.length;
        if (2 === l) {
          if (this.immediateMode._curveVertex.push(arguments.length <= 0 ? void 0 : arguments[0]), this.immediateMode._curveVertex.push(arguments.length <= 1 ? void 0 : arguments[1]), 8 === this.immediateMode._curveVertex.length) {
            for (this.isCurve = !0, n = this._bezierToCatmull([this.immediateMode._curveVertex[0], this.immediateMode._curveVertex[2], this.immediateMode._curveVertex[4], this.immediateMode._curveVertex[6]]), o = this._bezierToCatmull([this.immediateMode._curveVertex[1], this.immediateMode._curveVertex[3], this.immediateMode._curveVertex[5], this.immediateMode._curveVertex[7]]), a = 0; a < f; a++) t = n[0] * this._lookUpTableBezier[a][0] + n[1] * this._lookUpTableBezier[a][1] + n[2] * this._lookUpTableBezier[a][2] + n[3] * this._lookUpTableBezier[a][3], r = o[0] * this._lookUpTableBezier[a][0] + o[1] * this._lookUpTableBezier[a][1] + o[2] * this._lookUpTableBezier[a][2] + o[3] * this._lookUpTableBezier[a][3], this.vertex(t, r);
            for (a = 0; a < l; a++) this.immediateMode._curveVertex.shift()
          }
        } else if (3 === l && (this.immediateMode._curveVertex.push(arguments.length <= 0 ? void 0 : arguments[0]), this.immediateMode._curveVertex.push(arguments.length <= 1 ? void 0 : arguments[1]), this.immediateMode._curveVertex.push(arguments.length <= 2 ? void 0 : arguments[2]), 12 === this.immediateMode._curveVertex.length)) {
          for (this.isCurve = !0, n = this._bezierToCatmull([this.immediateMode._curveVertex[0], this.immediateMode._curveVertex[3], this.immediateMode._curveVertex[6], this.immediateMode._curveVertex[9]]), o = this._bezierToCatmull([this.immediateMode._curveVertex[1], this.immediateMode._curveVertex[4], this.immediateMode._curveVertex[7], this.immediateMode._curveVertex[10]]), s = this._bezierToCatmull([this.immediateMode._curveVertex[2], this.immediateMode._curveVertex[5], this.immediateMode._curveVertex[8], this.immediateMode._curveVertex[11]]), a = 0; a < f; a++) t = n[0] * this._lookUpTableBezier[a][0] + n[1] * this._lookUpTableBezier[a][1] + n[2] * this._lookUpTableBezier[a][2] + n[3] * this._lookUpTableBezier[a][3], r = o[0] * this._lookUpTableBezier[a][0] + o[1] * this._lookUpTableBezier[a][1] + o[2] * this._lookUpTableBezier[a][2] + o[3] * this._lookUpTableBezier[a][3], i = s[0] * this._lookUpTableBezier[a][0] + s[1] * this._lookUpTableBezier[a][1] + s[2] * this._lookUpTableBezier[a][2] + s[3] * this._lookUpTableBezier[a][3], this.vertex(t, r, i);
          for (a = 0; a < l; a++) this.immediateMode._curveVertex.shift()
        }
      }, T.default.RendererGL.prototype.image = function(e, t, r, i, a, n, o, s, l) {
        this._isErasing && this.blendMode(this._cachedBlendMode), this._pInst.push(), this._pInst.texture(e), this._pInst.textureMode(f.NORMAL);
        var u = 0;
        t <= e.width && (u = t / e.width);
        var h = 1;
        t + i <= e.width && (h = (t + i) / e.width);
        var d = 0;
        r <= e.height && (d = r / e.height);
        var c = 1;
        r + a <= e.height && (c = (r + a) / e.height), this.beginShape(), this.vertex(n, o, 0, u, d), this.vertex(n + s, o, 0, h, d), this.vertex(n + s, o + l, 0, h, c), this.vertex(n, o + l, 0, u, c), this.endShape(f.CLOSE), this._pInst.pop(), this._isErasing && this.blendMode(f.REMOVE)
      };
      var a = T.default;
      r.default = a
    }, {
      "../core/constants": 20,
      "../core/main": 26,
      "./p5.Geometry": 75
    }],
    70: [function(e, t, r) {
      "use strict";
      Object.defineProperty(r, "__esModule", {
        value: !0
      }), r.default = void 0;
      var i, c = (i = e("../core/main")) && i.__esModule ? i : {
          default: i
        },
        a = function(e) {
          {
            if (e && e.__esModule) return e;
            var t = {};
            if (null != e)
              for (var r in e)
                if (Object.prototype.hasOwnProperty.call(e, r)) {
                  var i = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(e, r) : {};
                  i.get || i.set ? Object.defineProperty(t, r, i) : t[r] = e[r]
                } return t.default = e, t
          }
        }(e("../core/constants"));
      c.default.prototype.orbitControl = function(e, t, r) {
        if (this._assert3d("orbitControl"), c.default._validateParameters("orbitControl", arguments), this.mouseX < this.width && 0 < this.mouseX && this.mouseY < this.height && 0 < this.mouseY) {
          var i = this._renderer._curCamera;
          void 0 === e && (e = 1), void 0 === t && (t = e), void 0 === r && (r = .5), !0 !== this.contextMenuDisabled && (this.canvas.oncontextmenu = function() {
            return !1
          }, this._setProperty("contextMenuDisabled", !0)), !0 !== this.wheelDefaultDisabled && (this.canvas.onwheel = function() {
            return !1
          }, this._setProperty("wheelDefaultDisabled", !0));
          var a = this.height < this.width ? this.height : this.width;
          if (this._mouseWheelDeltaY !== this._pmouseWheelDeltaY && (0 < this._mouseWheelDeltaY ? this._renderer._curCamera._orbit(0, 0, r * a) : this._renderer._curCamera._orbit(0, 0, -r * a)), this.mouseIsPressed)
            if (this.mouseButton === this.LEFT) {
              var n = -e * (this.mouseX - this.pmouseX) / a,
                o = t * (this.mouseY - this.pmouseY) / a;
              this._renderer._curCamera._orbit(n, o, 0)
            } else if (this.mouseButton === this.RIGHT) {
            var s = i._getLocalAxes(),
              l = Math.sqrt(s.x[0] * s.x[0] + s.x[2] * s.x[2]);
            0 !== l && (s.x[0] /= l, s.x[2] /= l);
            var u = Math.sqrt(s.y[0] * s.y[0] + s.y[2] * s.y[2]);
            0 !== u && (s.y[0] /= u, s.y[2] /= u);
            var h = -1 * e * (this.mouseX - this.pmouseX),
              d = -1 * t * (this.mouseY - this.pmouseY);
            i.setPosition(i.eyeX + h * s.x[0] + d * s.z[0], i.eyeY, i.eyeZ + h * s.x[2] + d * s.z[2])
          }
          return this
        }
      }, c.default.prototype.debugMode = function() {
        this._assert3d("debugMode");
        for (var e = arguments.length, t = new Array(e), r = 0; r < e; r++) t[r] = arguments[r];
        c.default._validateParameters("debugMode", t);
        for (var i = this._registeredMethods.post.length - 1; 0 <= i; i--) this._registeredMethods.post[i].toString() !== this._grid().toString() && this._registeredMethods.post[i].toString() !== this._axesIcon().toString() || this._registeredMethods.post.splice(i, 1);
        t[0] === a.GRID ? this.registerMethod("post", this._grid.call(this, t[1], t[2], t[3], t[4], t[5])) : t[0] === a.AXES ? this.registerMethod("post", this._axesIcon.call(this, t[1], t[2], t[3], t[4])) : (this.registerMethod("post", this._grid.call(this, t[0], t[1], t[2], t[3], t[4])), this.registerMethod("post", this._axesIcon.call(this, t[5], t[6], t[7], t[8])))
      }, c.default.prototype.noDebugMode = function() {
        this._assert3d("noDebugMode");
        for (var e = this._registeredMethods.post.length - 1; 0 <= e; e--) this._registeredMethods.post[e].toString() !== this._grid().toString() && this._registeredMethods.post[e].toString() !== this._axesIcon().toString() || this._registeredMethods.post.splice(e, 1)
      }, c.default.prototype._grid = function(e, r, i, a, n) {
        void 0 === e && (e = this.width / 2), void 0 === r && (r = Math.round(e / 30) < 4 ? 4 : Math.round(e / 30)), void 0 === i && (i = 0), void 0 === a && (a = 0), void 0 === n && (n = 0);
        var o = e / r,
          s = e / 2;
        return function() {
          this.push(), this.stroke(255 * this._renderer.curStrokeColor[0], 255 * this._renderer.curStrokeColor[1], 255 * this._renderer.curStrokeColor[2]), this._renderer.uMVMatrix.set(this._renderer._curCamera.cameraMatrix.mat4[0], this._renderer._curCamera.cameraMatrix.mat4[1], this._renderer._curCamera.cameraMatrix.mat4[2], this._renderer._curCamera.cameraMatrix.mat4[3], this._renderer._curCamera.cameraMatrix.mat4[4], this._renderer._curCamera.cameraMatrix.mat4[5], this._renderer._curCamera.cameraMatrix.mat4[6], this._renderer._curCamera.cameraMatrix.mat4[7], this._renderer._curCamera.cameraMatrix.mat4[8], this._renderer._curCamera.cameraMatrix.mat4[9], this._renderer._curCamera.cameraMatrix.mat4[10], this._renderer._curCamera.cameraMatrix.mat4[11], this._renderer._curCamera.cameraMatrix.mat4[12], this._renderer._curCamera.cameraMatrix.mat4[13], this._renderer._curCamera.cameraMatrix.mat4[14], this._renderer._curCamera.cameraMatrix.mat4[15]);
          for (var e = 0; e <= r; e++) this.beginShape(this.LINES), this.vertex(-s + i, a, e * o - s + n), this.vertex(+s + i, a, e * o - s + n), this.endShape();
          for (var t = 0; t <= r; t++) this.beginShape(this.LINES), this.vertex(t * o - s + i, a, -s + n), this.vertex(t * o - s + i, a, +s + n), this.endShape();
          this.pop()
        }
      }, c.default.prototype._axesIcon = function(e, t, r, i) {
        return void 0 === e && (e = 40 < this.width / 20 ? this.width / 20 : 40), void 0 === t && (t = -this.width / 4), void 0 === r && (r = t), void 0 === i && (i = t),
          function() {
            this.push(), this._renderer.uMVMatrix.set(this._renderer._curCamera.cameraMatrix.mat4[0], this._renderer._curCamera.cameraMatrix.mat4[1], this._renderer._curCamera.cameraMatrix.mat4[2], this._renderer._curCamera.cameraMatrix.mat4[3], this._renderer._curCamera.cameraMatrix.mat4[4], this._renderer._curCamera.cameraMatrix.mat4[5], this._renderer._curCamera.cameraMatrix.mat4[6], this._renderer._curCamera.cameraMatrix.mat4[7], this._renderer._curCamera.cameraMatrix.mat4[8], this._renderer._curCamera.cameraMatrix.mat4[9], this._renderer._curCamera.cameraMatrix.mat4[10], this._renderer._curCamera.cameraMatrix.mat4[11], this._renderer._curCamera.cameraMatrix.mat4[12], this._renderer._curCamera.cameraMatrix.mat4[13], this._renderer._curCamera.cameraMatrix.mat4[14], this._renderer._curCamera.cameraMatrix.mat4[15]), this.strokeWeight(2), this.stroke(255, 0, 0), this.beginShape(this.LINES), this.vertex(t, r, i), this.vertex(t + e, r, i), this.endShape(), this.stroke(0, 255, 0), this.beginShape(this.LINES), this.vertex(t, r, i), this.vertex(t, r + e, i), this.endShape(), this.stroke(0, 0, 255), this.beginShape(this.LINES), this.vertex(t, r, i), this.vertex(t, r, i + e), this.endShape(), this.pop()
          }
      };
      var n = c.default;
      r.default = n
    }, {
      "../core/constants": 20,
      "../core/main": 26
    }],
    71: [function(e, t, r) {
      "use strict";
      Object.defineProperty(r, "__esModule", {
        value: !0
      }), r.default = void 0;
      var i, m = (i = e("../core/main")) && i.__esModule ? i : {
        default: i
      };
      m.default.prototype.ambientLight = function(e, t, r, i) {
        this._assert3d("ambientLight"), m.default._validateParameters("ambientLight", arguments);
        var a = this.color.apply(this, arguments);
        return this._renderer.ambientLightColors.push(a._array[0], a._array[1], a._array[2]), this._renderer._enableLighting = !0, this
      }, m.default.prototype.specularColor = function(e, t, r) {
        this._assert3d("specularColor"), m.default._validateParameters("specularColor", arguments);
        var i = this.color.apply(this, arguments);
        return this._renderer.specularColors = [i._array[0], i._array[1], i._array[2]], this
      }, m.default.prototype.directionalLight = function(e, t, r, i, a, n) {
        var o, s, l, u;
        this._assert3d("directionalLight"), m.default._validateParameters("directionalLight", arguments), o = e instanceof m.default.Color ? e : this.color(e, t, r);
        var h = arguments[arguments.length - 1];
        u = "number" == typeof h ? (s = arguments[arguments.length - 3], l = arguments[arguments.length - 2], arguments[arguments.length - 1]) : (s = h.x, l = h.y, h.z);
        var d = Math.sqrt(s * s + l * l + u * u);
        return this._renderer.directionalLightDirections.push(s / d, l / d, u / d), this._renderer.directionalLightDiffuseColors.push(o._array[0], o._array[1], o._array[2]), Array.prototype.push.apply(this._renderer.directionalLightSpecularColors, this._renderer.specularColors), this._renderer._enableLighting = !0, this
      }, m.default.prototype.pointLight = function(e, t, r, i, a, n) {
        var o, s, l, u;
        this._assert3d("pointLight"), m.default._validateParameters("pointLight", arguments), o = e instanceof m.default.Color ? e : this.color(e, t, r);
        var h = arguments[arguments.length - 1];
        return u = "number" == typeof h ? (s = arguments[arguments.length - 3], l = arguments[arguments.length - 2], arguments[arguments.length - 1]) : (s = h.x, l = h.y, h.z), this._renderer.pointLightPositions.push(s, l, u), this._renderer.pointLightDiffuseColors.push(o._array[0], o._array[1], o._array[2]), Array.prototype.push.apply(this._renderer.pointLightSpecularColors, this._renderer.specularColors), this._renderer._enableLighting = !0, this
      }, m.default.prototype.lights = function() {
        return this._assert3d("lights"), this.ambientLight(128, 128, 128), this.directionalLight(128, 128, 128, 0, 0, -1), this
      }, m.default.prototype.lightFalloff = function(e, t, r) {
        return this._assert3d("lightFalloff"), m.default._validateParameters("lightFalloff", arguments), e < 0 && (e = 0, console.warn("Value of constant argument in lightFalloff() should be never be negative. Set to 0.")), t < 0 && (t = 0, console.warn("Value of linear argument in lightFalloff() should be never be negative. Set to 0.")), r < 0 && (r = 0, console.warn("Value of quadratic argument in lightFalloff() should be never be negative. Set to 0.")), 0 === e && 0 === t && 0 === r && (e = 1, console.warn("Either one of the three arguments in lightFalloff() should be greater than zero. Set constant argument to 1.")), this._renderer.constantAttenuation = e, this._renderer.linearAttenuation = t, this._renderer.quadraticAttenuation = r, this
      }, m.default.prototype.spotLight = function(e, t, r, i, a, n, o, s, l, u, h) {
        var d, c, f;
        this._assert3d("spotLight"), m.default._validateParameters("spotLight", arguments);
        var p = arguments.length;
        switch (p) {
          case 11:
          case 10:
            d = this.color(e, t, r), c = new m.default.Vector(i, a, n), f = new m.default.Vector(o, s, l);
            break;
          case 9:
            e instanceof m.default.Color ? (d = e, c = new m.default.Vector(t, r, i), f = new m.default.Vector(a, n, o), u = s, h = l) : i instanceof m.default.Vector ? (d = this.color(e, t, r), c = i, f = new m.default.Vector(a, n, o), u = s, h = l) : o instanceof m.default.Vector ? (d = this.color(e, t, r), c = new m.default.Vector(i, a, n), f = o, u = s, h = l) : (d = this.color(e, t, r), c = new m.default.Vector(i, a, n), f = new m.default.Vector(o, s, l));
            break;
          case 8:
            u = (f = e instanceof m.default.Color ? (d = e, c = new m.default.Vector(t, r, i), new m.default.Vector(a, n, o)) : i instanceof m.default.Vector ? (d = this.color(e, t, r), c = i, new m.default.Vector(a, n, o)) : (d = this.color(e, t, r), c = new m.default.Vector(i, a, n), o), s);
            break;
          case 7:
            e instanceof m.default.Color && t instanceof m.default.Vector ? (d = e, c = t, f = new m.default.Vector(r, i, a), u = n, h = o) : e instanceof m.default.Color && a instanceof m.default.Vector ? (d = e, c = new m.default.Vector(t, r, i), f = a, u = n, h = o) : i instanceof m.default.Vector && a instanceof m.default.Vector ? (d = this.color(e, t, r), c = i, f = a, u = n, h = o) : f = e instanceof m.default.Color ? (d = e, c = new m.default.Vector(t, r, i), new m.default.Vector(a, n, o)) : i instanceof m.default.Vector ? (d = this.color(e, t, r), c = i, new m.default.Vector(a, n, o)) : (d = this.color(e, t, r), c = new m.default.Vector(i, a, n), o);
            break;
          case 6:
            i instanceof m.default.Vector && a instanceof m.default.Vector ? (d = this.color(e, t, r), c = i, f = a, u = n) : e instanceof m.default.Color && a instanceof m.default.Vector ? (d = e, c = new m.default.Vector(t, r, i), f = a, u = n) : e instanceof m.default.Color && t instanceof m.default.Vector && (d = e, c = t, f = new m.default.Vector(r, i, a), u = n);
            break;
          case 5:
            e instanceof m.default.Color && t instanceof m.default.Vector && r instanceof m.default.Vector ? (d = e, c = t, f = r, u = i, h = a) : i instanceof m.default.Vector && a instanceof m.default.Vector ? (d = this.color(e, t, r), c = i, f = a) : e instanceof m.default.Color && a instanceof m.default.Vector ? (d = e, c = new m.default.Vector(t, r, i), f = a) : e instanceof m.default.Color && t instanceof m.default.Vector && (d = e, c = t, f = new m.default.Vector(r, i, a));
            break;
          case 4:
            d = e, c = t, f = r, u = i;
            break;
          case 3:
            d = e, c = t, f = r;
            break;
          default:
            return console.warn("Sorry, input for spotlight() is not in prescribed format. Too ".concat(p < 3 ? "few" : "many", " arguments were provided")), this
        }
        return this._renderer.spotLightDiffuseColors.push(d._array[0], d._array[1], d._array[2]), Array.prototype.push.apply(this._renderer.spotLightSpecularColors, this._renderer.specularColors), this._renderer.spotLightPositions.push(c.x, c.y, c.z), f.normalize(), this._renderer.spotLightDirections.push(f.x, f.y, f.z), void 0 === u && (u = Math.PI / 3), void 0 !== h && h < 1 ? (h = 1, console.warn("Value of concentration needs to be greater than 1. Setting it to 1")) : void 0 === h && (h = 100), u = this._renderer._pInst._toRadians(u), this._renderer.spotLightAngle.push(Math.cos(u)), this._renderer.spotLightConc.push(h), this._renderer._enableLighting = !0, this
      }, m.default.prototype.noLights = function() {
        return this._assert3d("noLights"), m.default._validateParameters("noLights", arguments), this._renderer.ambientLightColors.length = 0, this._renderer.specularColors = [1, 1, 1], this._renderer.directionalLightDirections.length = 0, this._renderer.directionalLightDiffuseColors.length = 0, this._renderer.directionalLightSpecularColors.length = 0, this._renderer.pointLightPositions.length = 0, this._renderer.pointLightDiffuseColors.length = 0, this._renderer.pointLightSpecularColors.length = 0, this._renderer.spotLightPositions.length = 0, this._renderer.spotLightDirections.length = 0, this._renderer.spotLightDiffuseColors.length = 0, this._renderer.spotLightSpecularColors.length = 0, this._renderer.spotLightAngle.length = 0, this._renderer.spotLightConc.length = 0, this._renderer.constantAttenuation = 1, this._renderer.linearAttenuation = 0, this._renderer.quadraticAttenuation = 0, this._renderer._useShininess = 1, this
      };
      var a = m.default;
      r.default = a
    }, {
      "../core/main": 26
    }],
    72: [function(e, t, r) {
      "use strict";
      Object.defineProperty(r, "__esModule", {
        value: !0
      }), r.default = void 0;
      var i, S = (i = e("../core/main")) && i.__esModule ? i : {
        default: i
      };

      function s(e, t, r) {
        for (var i = 0, a = e.length; i < a; i++)
          if (e[i] !== t.getUint8(r + i, !1)) return !1;
        return !0
      }
      e("./p5.Geometry"), S.default.prototype.loadModel = function(e) {
        var t, r, i;
        S.default._validateParameters("loadModel", arguments), i = "boolean" == typeof arguments[1] ? (t = arguments[1], r = arguments[2], arguments[3]) : (t = !1, r = arguments[1], arguments[2]);
        var a = e.slice(-4),
          n = new S.default.Geometry;
        n.gid = "".concat(e, "|").concat(t);
        var o = this;
        return ".stl" === a ? this.httpDo(e, "GET", "arrayBuffer", function(e) {
          ! function(e, t) {
            if (function(e) {
                for (var t = new DataView(e), r = [115, 111, 108, 105, 100], i = 0; i < 5; i++)
                  if (s(r, t, i)) return !1;
                return !0
              }(t)) ! function(e, t) {
              for (var r, i, a, n, o, s, l, u = new DataView(t), h = u.getUint32(80, !0), d = !1, c = 0; c < 70; c++) 1129270351 === u.getUint32(c, !1) && 82 === u.getUint8(c + 4) && 61 === u.getUint8(c + 5) && (d = !0, n = [], o = u.getUint8(c + 6) / 255, s = u.getUint8(c + 7) / 255, l = u.getUint8(c + 8) / 255);
              for (var f = 0; f < h; f++) {
                var p = 84 + 50 * f,
                  m = u.getFloat32(p, !0),
                  v = u.getFloat32(p + 4, !0),
                  g = u.getFloat32(p + 8, !0);
                if (d) {
                  var y = u.getUint16(p + 48, !0);
                  a = 0 == (32768 & y) ? (r = (31 & y) / 31, i = (y >> 5 & 31) / 31, (y >> 10 & 31) / 31) : (r = o, i = s, l)
                }
                for (var _ = 1; _ <= 3; _++) {
                  var b = p + 12 * _,
                    x = new S.default.Vector(u.getFloat32(b, !0), u.getFloat32(b + 8, !0), u.getFloat32(b + 4, !0));
                  e.vertices.push(x), d && n.push(r, i, a)
                }
                var w = new S.default.Vector(m, v, g);
                e.vertexNormals.push(w, w, w), e.faces.push([3 * f, 3 * f + 1, 3 * f + 2]), e.uvs.push([0, 0], [0, 0], [0, 0])
              }
            }(e, t);
            else {
              var r = new DataView(t);
              if (!("TextDecoder" in window)) return console.warn("Sorry, ASCII STL loading only works in browsers that support TextDecoder (https://caniuse.com/#feat=textencoder)");
              var i = new TextDecoder("utf-8"),
                a = i.decode(r),
                n = a.split("\n");
              ! function(e, t) {
                for (var r, i, a = "", n = [], o = 0; o < t.length; ++o) {
                  for (var s = t[o].trim(), l = s.split(" "), u = 0; u < l.length; ++u) "" === l[u] && l.splice(u, 1);
                  if (0 !== l.length) switch (a) {
                    case "":
                      if ("solid" !== l[0]) return console.error(s), console.error('Invalid state "'.concat(l[0], '", should be "solid"'));
                      a = "solid";
                      break;
                    case "solid":
                      if ("facet" !== l[0] || "normal" !== l[1]) return console.error(s), console.error('Invalid state "'.concat(l[0], '", should be "facet normal"'));
                      r = new S.default.Vector(parseFloat(l[2]), parseFloat(l[3]), parseFloat(l[4])), e.vertexNormals.push(r, r, r), a = "facet normal";
                      break;
                    case "facet normal":
                      if ("outer" !== l[0] || "loop" !== l[1]) return console.error(s), console.error('Invalid state "'.concat(l[0], '", should be "outer loop"'));
                      a = "vertex";
                      break;
                    case "vertex":
                      if ("vertex" === l[0]) i = new S.default.Vector(parseFloat(l[1]), parseFloat(l[2]), parseFloat(l[3])), e.vertices.push(i), e.uvs.push([0, 0]), n.push(e.vertices.indexOf(i));
                      else {
                        if ("endloop" !== l[0]) return console.error(s), console.error('Invalid state "'.concat(l[0], '", should be "vertex" or "endloop"'));
                        e.faces.push(n), n = [], a = "endloop"
                      }
                      break;
                    case "endloop":
                      if ("endfacet" !== l[0]) return console.error(s), console.error('Invalid state "'.concat(l[0], '", should be "endfacet"'));
                      a = "endfacet";
                      break;
                    case "endfacet":
                      if ("endsolid" === l[0]);
                      else {
                        if ("facet" !== l[0] || "normal" !== l[1]) return console.error(s), console.error('Invalid state "'.concat(l[0], '", should be "endsolid" or "facet normal"'));
                        r = new S.default.Vector(parseFloat(l[2]), parseFloat(l[3]), parseFloat(l[4])), e.vertexNormals.push(r, r, r), a = "facet normal"
                      }
                      break;
                    default:
                      console.error('Invalid state "'.concat(a, '"'))
                  }
                }
              }(e, n)
            }
          }(n, e), t && n.normalize(), o._decrementPreload(), "function" == typeof r && r(n)
        }, i) : ".obj" === a ? this.loadStrings(e, function(e) {
          ! function(e, t) {
            for (var r = {
                v: [],
                vt: [],
                vn: []
              }, i = {}, a = 0; a < t.length; ++a) {
              var n = t[a].trim().split(/\b\s+/);
              if (0 < n.length)
                if ("v" === n[0] || "vn" === n[0]) {
                  var o = new S.default.Vector(parseFloat(n[1]), parseFloat(n[2]), parseFloat(n[3]));
                  r[n[0]].push(o)
                } else if ("vt" === n[0]) {
                var s = [parseFloat(n[1]), parseFloat(n[2])];
                r[n[0]].push(s)
              } else if ("f" === n[0])
                for (var l = 3; l < n.length; ++l) {
                  for (var u = [], h = [1, l - 1, l], d = 0; d < h.length; ++d) {
                    var c = n[h[d]],
                      f = 0;
                    if (void 0 !== i[c]) f = i[c];
                    else {
                      for (var p = c.split("/"), m = 0; m < p.length; m++) p[m] = parseInt(p[m]) - 1;
                      f = i[c] = e.vertices.length, e.vertices.push(r.v[p[0]].copy()), r.vt[p[1]] ? e.uvs.push(r.vt[p[1]].slice()) : e.uvs.push([0, 0]), r.vn[p[2]] && e.vertexNormals.push(r.vn[p[2]].copy())
                    }
                    u.push(f)
                  }
                  u[0] !== u[1] && u[0] !== u[2] && u[1] !== u[2] && e.faces.push(u)
                }
            }
            0 === e.vertexNormals.length && e.computeNormals()
          }(n, e), t && n.normalize(), o._decrementPreload(), "function" == typeof r && r(n)
        }, i) : (S.default._friendlyFileLoadError(3, e), i ? i() : console.error("Sorry, the file type is invalid. Only OBJ and STL files are supported.")), n
      }, S.default.prototype.model = function(e) {
        this._assert3d("model"), S.default._validateParameters("model", arguments), 0 < e.vertices.length && (this._renderer.geometryInHash(e.gid) || (e._makeTriangleEdges()._edgesToVertices(), this._renderer.createBuffers(e.gid, e)), this._renderer.drawBuffers(e.gid))
      };
      var a = S.default;
      r.default = a
    }, {
      "../core/main": 26,
      "./p5.Geometry": 75
    }],
    73: [function(e, t, r) {
      "use strict";
      Object.defineProperty(r, "__esModule", {
        value: !0
      }), r.default = void 0;
      var i, u = (i = e("../core/main")) && i.__esModule ? i : {
          default: i
        },
        a = function(e) {
          {
            if (e && e.__esModule) return e;
            var t = {};
            if (null != e)
              for (var r in e)
                if (Object.prototype.hasOwnProperty.call(e, r)) {
                  var i = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(e, r) : {};
                  i.get || i.set ? Object.defineProperty(t, r, i) : t[r] = e[r]
                } return t.default = e, t
          }
        }(e("../core/constants"));
      e("./p5.Texture"), u.default.prototype.loadShader = function(e, t, r, i) {
        u.default._validateParameters("loadShader", arguments), i || (i = console.error);
        var a = new u.default.Shader,
          n = this,
          o = !1,
          s = !1,
          l = function() {
            n._decrementPreload(), r && r(a)
          };
        return this.loadStrings(e, function(e) {
          a._vertSrc = e.join("\n"), s = !0, o && l()
        }, i), this.loadStrings(t, function(e) {
          a._fragSrc = e.join("\n"), o = !0, s && l()
        }, i), a
      }, u.default.prototype.createShader = function(e, t) {
        return this._assert3d("createShader"), u.default._validateParameters("createShader", arguments), new u.default.Shader(this._renderer, e, t)
      }, u.default.prototype.shader = function(e) {
        return this._assert3d("shader"), u.default._validateParameters("shader", arguments), void 0 === e._renderer && (e._renderer = this._renderer), e.isStrokeShader() ? this._renderer.userStrokeShader = e : (this._renderer.userFillShader = e, this._renderer._useNormalMaterial = !1), e.init(), this
      }, u.default.prototype.resetShader = function() {
        return this._renderer.userFillShader = this._renderer.userStrokeShader = null, this
      }, u.default.prototype.normalMaterial = function() {
        this._assert3d("normalMaterial");
        for (var e = arguments.length, t = new Array(e), r = 0; r < e; r++) t[r] = arguments[r];
        return u.default._validateParameters("normalMaterial", t), this._renderer.drawMode = a.FILL, this._renderer._useSpecularMaterial = !1, this._renderer._useEmissiveMaterial = !1, this._renderer._useNormalMaterial = !0, this._renderer.curFillColor = [1, 1, 1, 1], this._renderer._setProperty("_doFill", !0), this.noStroke(), this
      }, u.default.prototype.texture = function(e) {
        return this._assert3d("texture"), u.default._validateParameters("texture", arguments), e.gifProperties && e._animateGif(this), this._renderer.drawMode = a.TEXTURE, this._renderer._useSpecularMaterial = !1, this._renderer._useEmissiveMaterial = !1, this._renderer._useNormalMaterial = !1, this._renderer._tex = e, this._renderer._setProperty("_doFill", !0), this
      }, u.default.prototype.textureMode = function(e) {
        e !== a.IMAGE && e !== a.NORMAL ? console.warn("You tried to set ".concat(e, " textureMode only supports IMAGE & NORMAL ")) : this._renderer.textureMode = e
      }, u.default.prototype.textureWrap = function(e) {
        var t = 1 < arguments.length && void 0 !== arguments[1] ? arguments[1] : e;
        this._renderer.textureWrapX = e, this._renderer.textureWrapY = t;
        for (var r = this._renderer.textures, i = 0; i < r.length; i++) r[i].setWrapMode(e, t)
      }, u.default.prototype.ambientMaterial = function(e, t, r, i) {
        this._assert3d("ambientMaterial"), u.default._validateParameters("ambientMaterial", arguments);
        var a = u.default.prototype.color.apply(this, arguments);
        return this._renderer.curFillColor = a._array, this._renderer._useSpecularMaterial = !1, this._renderer._useEmissiveMaterial = !1, this._renderer._useNormalMaterial = !1, this._renderer._enableLighting = !0, this._renderer._tex = null, this
      }, u.default.prototype.emissiveMaterial = function(e, t, r, i) {
        this._assert3d("emissiveMaterial"), u.default._validateParameters("emissiveMaterial", arguments);
        var a = u.default.prototype.color.apply(this, arguments);
        return this._renderer.curFillColor = a._array, this._renderer._useSpecularMaterial = !1, this._renderer._useEmissiveMaterial = !0, this._renderer._useNormalMaterial = !1, this._renderer._enableLighting = !0, this._renderer._tex = null, this
      }, u.default.prototype.specularMaterial = function(e, t, r, i) {
        this._assert3d("specularMaterial"), u.default._validateParameters("specularMaterial", arguments);
        var a = u.default.prototype.color.apply(this, arguments);
        return this._renderer.curFillColor = a._array, this._renderer._useSpecularMaterial = !0, this._renderer._useEmissiveMaterial = !1, this._renderer._useNormalMaterial = !1, this._renderer._enableLighting = !0, this._renderer._tex = null, this
      }, u.default.prototype.shininess = function(e) {
        return this._assert3d("shininess"), u.default._validateParameters("shininess", arguments), e < 1 && (e = 1), this._renderer._useShininess = e, this
      }, u.default.RendererGL.prototype._applyColorBlend = function(e) {
        var t = this.GL,
          r = this.drawMode === a.TEXTURE;
        return r || e[e.length - 1] < 1 || this._isErasing ? (t.depthMask(r), t.enable(t.BLEND), this._applyBlendMode()) : (t.depthMask(!0), t.disable(t.BLEND)), e
      }, u.default.RendererGL.prototype._applyBlendMode = function() {
        var e = this.GL;
        switch (this.curBlendMode) {
          case a.BLEND:
          case a.ADD:
            e.blendEquation(e.FUNC_ADD), e.blendFunc(e.SRC_ALPHA, e.ONE_MINUS_SRC_ALPHA);
            break;
          case a.REMOVE:
            e.blendEquation(e.FUNC_REVERSE_SUBTRACT), e.blendFunc(e.SRC_ALPHA, e.DST_ALPHA);
            break;
          case a.MULTIPLY:
            e.blendEquationSeparate(e.FUNC_ADD, e.FUNC_ADD), e.blendFuncSeparate(e.ZERO, e.SRC_COLOR, e.ONE, e.ONE);
            break;
          case a.SCREEN:
            e.blendEquationSeparate(e.FUNC_ADD, e.FUNC_ADD), e.blendFuncSeparate(e.ONE_MINUS_DST_COLOR, e.ONE, e.ONE, e.ONE);
            break;
          case a.EXCLUSION:
            e.blendEquationSeparate(e.FUNC_ADD, e.FUNC_ADD), e.blendFuncSeparate(e.ONE_MINUS_DST_COLOR, e.ONE_MINUS_SRC_COLOR, e.ONE, e.ONE);
            break;
          case a.REPLACE:
            e.blendEquation(e.FUNC_ADD), e.blendFunc(e.ONE, e.ZERO);
            break;
          case a.SUBTRACT:
            e.blendEquationSeparate(e.FUNC_REVERSE_SUBTRACT, e.FUNC_ADD), e.blendFuncSeparate(e.SRC_ALPHA, e.ONE, e.ONE, e.ONE);
            break;
          case a.DARKEST:
            this.blendExt ? (e.blendEquationSeparate(this.blendExt.MIN_EXT, e.FUNC_ADD), e.blendFuncSeparate(e.ONE, e.ONE, e.ONE, e.ONE)) : console.warn("blendMode(DARKEST) does not work in your browser in WEBGL mode.");
            break;
          case a.LIGHTEST:
            this.blendExt ? (e.blendEquationSeparate(this.blendExt.MAX_EXT, e.FUNC_ADD), e.blendFuncSeparate(e.ONE, e.ONE, e.ONE, e.ONE)) : console.warn("blendMode(LIGHTEST) does not work in your browser in WEBGL mode.");
            break;
          default:
            console.error("Oops! Somehow RendererGL set curBlendMode to an unsupported mode.")
        }
      };
      var n = u.default;
      r.default = n
    }, {
      "../core/constants": 20,
      "../core/main": 26,
      "./p5.Texture": 81
    }],
    74: [function(e, t, r) {
      "use strict";
      Object.defineProperty(r, "__esModule", {
        value: !0
      }), r.default = void 0;
      var i, m = (i = e("../core/main")) && i.__esModule ? i : {
        default: i
      };
      m.default.prototype.camera = function() {
        var e;
        this._assert3d("camera");
        for (var t = arguments.length, r = new Array(t), i = 0; i < t; i++) r[i] = arguments[i];
        return m.default._validateParameters("camera", r), (e = this._renderer._curCamera).camera.apply(e, r), this
      }, m.default.prototype.perspective = function() {
        var e;
        this._assert3d("perspective");
        for (var t = arguments.length, r = new Array(t), i = 0; i < t; i++) r[i] = arguments[i];
        return m.default._validateParameters("perspective", r), (e = this._renderer._curCamera).perspective.apply(e, r), this
      }, m.default.prototype.ortho = function() {
        var e;
        this._assert3d("ortho");
        for (var t = arguments.length, r = new Array(t), i = 0; i < t; i++) r[i] = arguments[i];
        return m.default._validateParameters("ortho", r), (e = this._renderer._curCamera).ortho.apply(e, r), this
      }, m.default.prototype.frustum = function() {
        var e;
        this._assert3d("frustum");
        for (var t = arguments.length, r = new Array(t), i = 0; i < t; i++) r[i] = arguments[i];
        return m.default._validateParameters("frustum", r), (e = this._renderer._curCamera).frustum.apply(e, r), this
      }, m.default.prototype.createCamera = function() {
        this._assert3d("createCamera");
        var e = new m.default.Camera(this._renderer);
        return e._computeCameraDefaultSettings(), e._setDefaultCamera(), this._renderer._curCamera = e
      }, m.default.Camera = function(e) {
        this._renderer = e, this.cameraType = "default", this.cameraMatrix = new m.default.Matrix, this.projMatrix = new m.default.Matrix
      }, m.default.Camera.prototype.perspective = function(e, t, r, i) {
        this.cameraType = 0 < arguments.length ? "custom" : "default", this.cameraFOV = void 0 === e ? e = this.defaultCameraFOV : this._renderer._pInst._toRadians(e), void 0 === t && (t = this.defaultAspectRatio), void 0 === r && (r = this.defaultCameraNear), void 0 === i && (i = this.defaultCameraFar), r <= 1e-4 && (r = .01, console.log("Avoid perspective near plane values close to or below 0. Setting value to 0.01.")), i < r && console.log("Perspective far plane value is less than near plane value. Nothing will be shown."), this.aspectRatio = t, this.cameraNear = r, this.cameraFar = i, this.projMatrix = m.default.Matrix.identity();
        var a = 1 / Math.tan(this.cameraFOV / 2),
          n = 1 / (this.cameraNear - this.cameraFar);
        this.projMatrix.set(a / t, 0, 0, 0, 0, -a, 0, 0, 0, 0, (i + r) * n, -1, 0, 0, 2 * i * r * n, 0), this._isActive() && this._renderer.uPMatrix.set(this.projMatrix.mat4[0], this.projMatrix.mat4[1], this.projMatrix.mat4[2], this.projMatrix.mat4[3], this.projMatrix.mat4[4], this.projMatrix.mat4[5], this.projMatrix.mat4[6], this.projMatrix.mat4[7], this.projMatrix.mat4[8], this.projMatrix.mat4[9], this.projMatrix.mat4[10], this.projMatrix.mat4[11], this.projMatrix.mat4[12], this.projMatrix.mat4[13], this.projMatrix.mat4[14], this.projMatrix.mat4[15])
      }, m.default.Camera.prototype.ortho = function(e, t, r, i, a, n) {
        void 0 === e && (e = -this._renderer.width / 2), void 0 === t && (t = +this._renderer.width / 2), void 0 === r && (r = -this._renderer.height / 2), void 0 === i && (i = +this._renderer.height / 2), void 0 === a && (a = 0), void 0 === n && (n = Math.max(this._renderer.width, this._renderer.height));
        var o = t - e,
          s = i - r,
          l = n - a,
          u = 2 / o,
          h = 2 / s,
          d = -2 / l,
          c = -(t + e) / o,
          f = -(i + r) / s,
          p = -(n + a) / l;
        this.projMatrix = m.default.Matrix.identity(), this.projMatrix.set(u, 0, 0, 0, 0, -h, 0, 0, 0, 0, d, 0, c, f, p, 1), this._isActive() && this._renderer.uPMatrix.set(this.projMatrix.mat4[0], this.projMatrix.mat4[1], this.projMatrix.mat4[2], this.projMatrix.mat4[3], this.projMatrix.mat4[4], this.projMatrix.mat4[5], this.projMatrix.mat4[6], this.projMatrix.mat4[7], this.projMatrix.mat4[8], this.projMatrix.mat4[9], this.projMatrix.mat4[10], this.projMatrix.mat4[11], this.projMatrix.mat4[12], this.projMatrix.mat4[13], this.projMatrix.mat4[14], this.projMatrix.mat4[15]), this.cameraType = "custom"
      }, m.default.Camera.prototype.frustum = function(e, t, r, i, a, n) {
        void 0 === e && (e = -this._renderer.width / 2), void 0 === t && (t = +this._renderer.width / 2), void 0 === r && (r = -this._renderer.height / 2), void 0 === i && (i = +this._renderer.height / 2), void 0 === a && (a = 0), void 0 === n && (n = Math.max(this._renderer.width, this._renderer.height));
        var o = t - e,
          s = i - r,
          l = n - a,
          u = 2 * a / o,
          h = 2 * a / s,
          d = -2 * n * a / l,
          c = (t + e) / o,
          f = (i + r) / s,
          p = -(n + a) / l;
        this.projMatrix = m.default.Matrix.identity(), this.projMatrix.set(u, 0, 0, 0, 0, h, 0, 0, c, f, p, -1, 0, 0, d, 0), this._isActive() && this._renderer.uPMatrix.set(this.projMatrix.mat4[0], this.projMatrix.mat4[1], this.projMatrix.mat4[2], this.projMatrix.mat4[3], this.projMatrix.mat4[4], this.projMatrix.mat4[5], this.projMatrix.mat4[6], this.projMatrix.mat4[7], this.projMatrix.mat4[8], this.projMatrix.mat4[9], this.projMatrix.mat4[10], this.projMatrix.mat4[11], this.projMatrix.mat4[12], this.projMatrix.mat4[13], this.projMatrix.mat4[14], this.projMatrix.mat4[15]), this.cameraType = "custom"
      }, m.default.Camera.prototype._rotateView = function(e, t, r, i) {
        var a = this.centerX,
          n = this.centerY,
          o = this.centerZ;
        a -= this.eyeX, n -= this.eyeY, o -= this.eyeZ;
        var s = m.default.Matrix.identity(this._renderer._pInst);
        s.rotate(this._renderer._pInst._toRadians(e), t, r, i);
        var l = [a * s.mat4[0] + n * s.mat4[4] + o * s.mat4[8], a * s.mat4[1] + n * s.mat4[5] + o * s.mat4[9], a * s.mat4[2] + n * s.mat4[6] + o * s.mat4[10]];
        l[0] += this.eyeX, l[1] += this.eyeY, l[2] += this.eyeZ, this.camera(this.eyeX, this.eyeY, this.eyeZ, l[0], l[1], l[2], this.upX, this.upY, this.upZ)
      }, m.default.Camera.prototype.pan = function(e) {
        var t = this._getLocalAxes();
        this._rotateView(e, t.y[0], t.y[1], t.y[2])
      }, m.default.Camera.prototype.tilt = function(e) {
        var t = this._getLocalAxes();
        this._rotateView(e, t.x[0], t.x[1], t.x[2])
      }, m.default.Camera.prototype.lookAt = function(e, t, r) {
        this.camera(this.eyeX, this.eyeY, this.eyeZ, e, t, r, this.upX, this.upY, this.upZ)
      }, m.default.Camera.prototype.camera = function(e, t, r, i, a, n, o, s, l) {
        void 0 === e && (e = this.defaultEyeX, t = this.defaultEyeY, r = this.defaultEyeZ, i = e, a = t, s = 1, l = o = n = 0), this.eyeX = e, this.eyeY = t, this.eyeZ = r, this.centerX = i, this.centerY = a, this.centerZ = n, this.upX = o, this.upY = s, this.upZ = l;
        var u = this._getLocalAxes();
        this.cameraMatrix.set(u.x[0], u.y[0], u.z[0], 0, u.x[1], u.y[1], u.z[1], 0, u.x[2], u.y[2], u.z[2], 0, 0, 0, 0, 1);
        var h = -e,
          d = -t,
          c = -r;
        return this.cameraMatrix.translate([h, d, c]), this._isActive() && this._renderer.uMVMatrix.set(this.cameraMatrix.mat4[0], this.cameraMatrix.mat4[1], this.cameraMatrix.mat4[2], this.cameraMatrix.mat4[3], this.cameraMatrix.mat4[4], this.cameraMatrix.mat4[5], this.cameraMatrix.mat4[6], this.cameraMatrix.mat4[7], this.cameraMatrix.mat4[8], this.cameraMatrix.mat4[9], this.cameraMatrix.mat4[10], this.cameraMatrix.mat4[11], this.cameraMatrix.mat4[12], this.cameraMatrix.mat4[13], this.cameraMatrix.mat4[14], this.cameraMatrix.mat4[15]), this
      }, m.default.Camera.prototype.move = function(e, t, r) {
        var i = this._getLocalAxes(),
          a = [i.x[0] * e, i.x[1] * e, i.x[2] * e],
          n = [i.y[0] * t, i.y[1] * t, i.y[2] * t],
          o = [i.z[0] * r, i.z[1] * r, i.z[2] * r];
        this.camera(this.eyeX + a[0] + n[0] + o[0], this.eyeY + a[1] + n[1] + o[1], this.eyeZ + a[2] + n[2] + o[2], this.centerX + a[0] + n[0] + o[0], this.centerY + a[1] + n[1] + o[1], this.centerZ + a[2] + n[2] + o[2], 0, 1, 0)
      }, m.default.Camera.prototype.setPosition = function(e, t, r) {
        var i = e - this.eyeX,
          a = t - this.eyeY,
          n = r - this.eyeZ;
        this.camera(e, t, r, this.centerX + i, this.centerY + a, this.centerZ + n, 0, 1, 0)
      }, m.default.Camera.prototype._computeCameraDefaultSettings = function() {
        this.defaultCameraFOV = 60 / 180 * Math.PI, this.defaultAspectRatio = this._renderer.width / this._renderer.height, this.defaultEyeX = 0, this.defaultEyeY = 0, this.defaultEyeZ = this._renderer.height / 2 / Math.tan(this.defaultCameraFOV / 2), this.defaultCenterX = 0, this.defaultCenterY = 0, this.defaultCenterZ = 0, this.defaultCameraNear = .1 * this.defaultEyeZ, this.defaultCameraFar = 10 * this.defaultEyeZ
      }, m.default.Camera.prototype._setDefaultCamera = function() {
        this.cameraFOV = this.defaultCameraFOV, this.aspectRatio = this.defaultAspectRatio, this.eyeX = this.defaultEyeX, this.eyeY = this.defaultEyeY, this.eyeZ = this.defaultEyeZ, this.centerX = this.defaultCenterX, this.centerY = this.defaultCenterY, this.centerZ = this.defaultCenterZ, this.upX = 0, this.upY = 1, this.upZ = 0, this.cameraNear = this.defaultCameraNear, this.cameraFar = this.defaultCameraFar, this.perspective(), this.camera(), this.cameraType = "default"
      }, m.default.Camera.prototype._resize = function() {
        "default" === this.cameraType ? (this._computeCameraDefaultSettings(), this._setDefaultCamera()) : this.perspective(this.cameraFOV, this._renderer.width / this._renderer.height)
      }, m.default.Camera.prototype.copy = function() {
        var e = new m.default.Camera(this._renderer);
        return e.cameraFOV = this.cameraFOV, e.aspectRatio = this.aspectRatio, e.eyeX = this.eyeX, e.eyeY = this.eyeY, e.eyeZ = this.eyeZ, e.centerX = this.centerX, e.centerY = this.centerY, e.centerZ = this.centerZ, e.cameraNear = this.cameraNear, e.cameraFar = this.cameraFar, e.cameraType = this.cameraType, e.cameraMatrix = this.cameraMatrix.copy(), e.projMatrix = this.projMatrix.copy(), e
      }, m.default.Camera.prototype._getLocalAxes = function() {
        var e = this.eyeX - this.centerX,
          t = this.eyeY - this.centerY,
          r = this.eyeZ - this.centerZ,
          i = Math.sqrt(e * e + t * t + r * r);
        0 !== i && (e /= i, t /= i, r /= i);
        var a = this.upX,
          n = this.upY,
          o = this.upZ,
          s = n * r - o * t,
          l = -a * r + o * e,
          u = a * t - n * e;
        a = t * u - r * l, n = -e * u + r * s, o = e * l - t * s;
        var h = Math.sqrt(s * s + l * l + u * u);
        0 !== h && (s /= h, l /= h, u /= h);
        var d = Math.sqrt(a * a + n * n + o * o);
        return 0 !== d && (a /= d, n /= d, o /= d), {
          x: [s, l, u],
          y: [a, n, o],
          z: [e, t, r]
        }
      }, m.default.Camera.prototype._orbit = function(e, t, r) {
        var i = this.eyeX - this.centerX,
          a = this.eyeY - this.centerY,
          n = this.eyeZ - this.centerZ,
          o = Math.sqrt(i * i + a * a + n * n),
          s = Math.atan2(i, n),
          l = Math.acos(Math.max(-1, Math.min(1, a / o)));
        s += e, (o += r) < 0 && (o = .1), (l += t) > Math.PI ? l = Math.PI : l <= 0 && (l = .001);
        var u = Math.sin(l) * o * Math.sin(s),
          h = Math.cos(l) * o,
          d = Math.sin(l) * o * Math.cos(s);
        this.camera(u + this.centerX, h + this.centerY, d + this.centerZ, this.centerX, this.centerY, this.centerZ, 0, 1, 0)
      }, m.default.Camera.prototype._isActive = function() {
        return this === this._renderer._curCamera
      }, m.default.prototype.setCamera = function(e) {
        this._renderer._curCamera = e, this._renderer.uPMatrix.set(e.projMatrix.mat4[0], e.projMatrix.mat4[1], e.projMatrix.mat4[2], e.projMatrix.mat4[3], e.projMatrix.mat4[4], e.projMatrix.mat4[5], e.projMatrix.mat4[6], e.projMatrix.mat4[7], e.projMatrix.mat4[8], e.projMatrix.mat4[9], e.projMatrix.mat4[10], e.projMatrix.mat4[11], e.projMatrix.mat4[12], e.projMatrix.mat4[13], e.projMatrix.mat4[14], e.projMatrix.mat4[15])
      };
      var a = m.default.Camera;
      r.default = a
    }, {
      "../core/main": 26
    }],
    75: [function(e, t, r) {
      "use strict";
      Object.defineProperty(r, "__esModule", {
        value: !0
      }), r.default = void 0;
      var i, h = (i = e("../core/main")) && i.__esModule ? i : {
        default: i
      };
      h.default.Geometry = function(e, t, r) {
        return this.vertices = [], this.lineVertices = [], this.lineNormals = [], this.vertexNormals = [], this.faces = [], this.uvs = [], this.edges = [], this.detailX = void 0 !== e ? e : 1, this.detailY = void 0 !== t ? t : 1, this.dirtyFlags = {}, r instanceof Function && r.call(this), this
      }, h.default.Geometry.prototype.reset = function() {
        this.lineVertices.length = 0, this.lineNormals.length = 0, this.vertices.length = 0, this.edges.length = 0, this.vertexColors.length = 0, this.vertexNormals.length = 0, this.uvs.length = 0, this.dirtyFlags = {}
      }, h.default.Geometry.prototype.computeFaces = function() {
        this.faces.length = 0;
        for (var e, t, r, i, a = this.detailX + 1, n = 0; n < this.detailY; n++)
          for (var o = 0; o < this.detailX; o++) t = (e = n * a + o) + 1, r = (n + 1) * a + o + 1, i = (n + 1) * a + o, this.faces.push([e, t, i]), this.faces.push([i, t, r]);
        return this
      }, h.default.Geometry.prototype._getFaceNormal = function(e) {
        var t = this.faces[e],
          r = this.vertices[t[0]],
          i = this.vertices[t[1]],
          a = this.vertices[t[2]],
          n = h.default.Vector.sub(i, r),
          o = h.default.Vector.sub(a, r),
          s = h.default.Vector.cross(n, o),
          l = h.default.Vector.mag(s),
          u = l / (h.default.Vector.mag(n) * h.default.Vector.mag(o));
        return 0 === u || isNaN(u) ? (console.warn("p5.Geometry.prototype._getFaceNormal:", "face has colinear sides or a repeated vertex"), s) : (1 < u && (u = 1), s.mult(Math.asin(u) / l))
      }, h.default.Geometry.prototype.computeNormals = function() {
        var e, t = this.vertexNormals,
          r = this.vertices,
          i = this.faces;
        for (e = t.length = 0; e < r.length; ++e) t.push(new h.default.Vector);
        for (var a = 0; a < i.length; ++a)
          for (var n = i[a], o = this._getFaceNormal(a), s = 0; s < 3; ++s) {
            t[n[s]].add(o)
          }
        for (e = 0; e < r.length; ++e) t[e].normalize();
        return this
      }, h.default.Geometry.prototype.averageNormals = function() {
        for (var e = 0; e <= this.detailY; e++) {
          var t = this.detailX + 1,
            r = h.default.Vector.add(this.vertexNormals[e * t], this.vertexNormals[e * t + this.detailX]);
          r = h.default.Vector.div(r, 2), this.vertexNormals[e * t] = r, this.vertexNormals[e * t + this.detailX] = r
        }
        return this
      }, h.default.Geometry.prototype.averagePoleNormals = function() {
        for (var e = new h.default.Vector(0, 0, 0), t = 0; t < this.detailX; t++) e.add(this.vertexNormals[t]);
        e = h.default.Vector.div(e, this.detailX);
        for (var r = 0; r < this.detailX; r++) this.vertexNormals[r] = e;
        e = new h.default.Vector(0, 0, 0);
        for (var i = this.vertices.length - 1; i > this.vertices.length - 1 - this.detailX; i--) e.add(this.vertexNormals[i]);
        e = h.default.Vector.div(e, this.detailX);
        for (var a = this.vertices.length - 1; a > this.vertices.length - 1 - this.detailX; a--) this.vertexNormals[a] = e;
        return this
      }, h.default.Geometry.prototype._makeTriangleEdges = function() {
        if (this.edges.length = 0, Array.isArray(this.strokeIndices))
          for (var e = 0, t = this.strokeIndices.length; e < t; e++) this.edges.push(this.strokeIndices[e]);
        else
          for (var r = 0; r < this.faces.length; r++) this.edges.push([this.faces[r][0], this.faces[r][1]]), this.edges.push([this.faces[r][1], this.faces[r][2]]), this.edges.push([this.faces[r][2], this.faces[r][0]]);
        return this
      }, h.default.Geometry.prototype._edgesToVertices = function() {
        this.lineVertices.length = 0;
        for (var e = this.lineNormals.length = 0; e < this.edges.length; e++) {
          var t = this.vertices[this.edges[e][0]],
            r = this.vertices[this.edges[e][1]],
            i = r.copy().sub(t).normalize(),
            a = t.array(),
            n = t.array(),
            o = r.array(),
            s = r.array(),
            l = i.array(),
            u = i.array();
          l.push(1), u.push(-1), this.lineNormals.push(l, u, l, l, u, u), this.lineVertices.push(a, n, o, o, n, s)
        }
        return this
      }, h.default.Geometry.prototype.normalize = function() {
        if (0 < this.vertices.length) {
          for (var e = this.vertices[0].copy(), t = this.vertices[0].copy(), r = 0; r < this.vertices.length; r++) e.x = Math.max(e.x, this.vertices[r].x), t.x = Math.min(t.x, this.vertices[r].x), e.y = Math.max(e.y, this.vertices[r].y), t.y = Math.min(t.y, this.vertices[r].y), e.z = Math.max(e.z, this.vertices[r].z), t.z = Math.min(t.z, this.vertices[r].z);
          for (var i = h.default.Vector.lerp(e, t, .5), a = h.default.Vector.sub(e, t), n = 200 / Math.max(Math.max(a.x, a.y), a.z), o = 0; o < this.vertices.length; o++) this.vertices[o].sub(i), this.vertices[o].mult(n)
        }
        return this
      };
      var a = h.default.Geometry;
      r.default = a
    }, {
      "../core/main": 26
    }],
    76: [function(e, t, r) {
      "use strict";
      Object.defineProperty(r, "__esModule", {
        value: !0
      }), r.default = void 0;
      var i, R = (i = e("../core/main")) && i.__esModule ? i : {
        default: i
      };
      var a = Array,
        O = function(e) {
          return e instanceof Array
        };
      "undefined" != typeof Float32Array && (a = Float32Array, O = function(e) {
        return e instanceof Array || e instanceof Float32Array
      }), R.default.Matrix = function() {
        for (var e = new Array(arguments.length), t = 0; t < e.length; ++t) e[t] = arguments[t];
        return e.length && e[e.length - 1] instanceof R.default && (this.p5 = e[e.length - 1]), "mat3" === e[0] ? this.mat3 = Array.isArray(e[1]) ? e[1] : new a([1, 0, 0, 0, 1, 0, 0, 0, 1]) : this.mat4 = Array.isArray(e[0]) ? e[0] : new a([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]), this
      }, R.default.Matrix.prototype.set = function(e) {
        return e instanceof R.default.Matrix ? this.mat4 = e.mat4 : O(e) ? this.mat4 = e : 16 === arguments.length && (this.mat4[0] = e, this.mat4[1] = arguments[1], this.mat4[2] = arguments[2], this.mat4[3] = arguments[3], this.mat4[4] = arguments[4], this.mat4[5] = arguments[5], this.mat4[6] = arguments[6], this.mat4[7] = arguments[7], this.mat4[8] = arguments[8], this.mat4[9] = arguments[9], this.mat4[10] = arguments[10], this.mat4[11] = arguments[11], this.mat4[12] = arguments[12], this.mat4[13] = arguments[13], this.mat4[14] = arguments[14], this.mat4[15] = arguments[15]), this
      }, R.default.Matrix.prototype.get = function() {
        return new R.default.Matrix(this.mat4, this.p5)
      }, R.default.Matrix.prototype.copy = function() {
        var e = new R.default.Matrix(this.p5);
        return e.mat4[0] = this.mat4[0], e.mat4[1] = this.mat4[1], e.mat4[2] = this.mat4[2], e.mat4[3] = this.mat4[3], e.mat4[4] = this.mat4[4], e.mat4[5] = this.mat4[5], e.mat4[6] = this.mat4[6], e.mat4[7] = this.mat4[7], e.mat4[8] = this.mat4[8], e.mat4[9] = this.mat4[9], e.mat4[10] = this.mat4[10], e.mat4[11] = this.mat4[11], e.mat4[12] = this.mat4[12], e.mat4[13] = this.mat4[13], e.mat4[14] = this.mat4[14], e.mat4[15] = this.mat4[15], e
      }, R.default.Matrix.identity = function(e) {
        return new R.default.Matrix(e)
      }, R.default.Matrix.prototype.transpose = function(e) {
        var t, r, i, a, n, o;
        return e instanceof R.default.Matrix ? (t = e.mat4[1], r = e.mat4[2], i = e.mat4[3], a = e.mat4[6], n = e.mat4[7], o = e.mat4[11], this.mat4[0] = e.mat4[0], this.mat4[1] = e.mat4[4], this.mat4[2] = e.mat4[8], this.mat4[3] = e.mat4[12], this.mat4[4] = t, this.mat4[5] = e.mat4[5], this.mat4[6] = e.mat4[9], this.mat4[7] = e.mat4[13], this.mat4[8] = r, this.mat4[9] = a, this.mat4[10] = e.mat4[10], this.mat4[11] = e.mat4[14], this.mat4[12] = i, this.mat4[13] = n, this.mat4[14] = o, this.mat4[15] = e.mat4[15]) : O(e) && (t = e[1], r = e[2], i = e[3], a = e[6], n = e[7], o = e[11], this.mat4[0] = e[0], this.mat4[1] = e[4], this.mat4[2] = e[8], this.mat4[3] = e[12], this.mat4[4] = t, this.mat4[5] = e[5], this.mat4[6] = e[9], this.mat4[7] = e[13], this.mat4[8] = r, this.mat4[9] = a, this.mat4[10] = e[10], this.mat4[11] = e[14], this.mat4[12] = i, this.mat4[13] = n, this.mat4[14] = o, this.mat4[15] = e[15]), this
      }, R.default.Matrix.prototype.invert = function(e) {
        var t, r, i, a, n, o, s, l, u, h, d, c, f, p, m, v;
        e instanceof R.default.Matrix ? (t = e.mat4[0], r = e.mat4[1], i = e.mat4[2], a = e.mat4[3], n = e.mat4[4], o = e.mat4[5], s = e.mat4[6], l = e.mat4[7], u = e.mat4[8], h = e.mat4[9], d = e.mat4[10], c = e.mat4[11], f = e.mat4[12], p = e.mat4[13], m = e.mat4[14], v = e.mat4[15]) : O(e) && (t = e[0], r = e[1], i = e[2], a = e[3], n = e[4], o = e[5], s = e[6], l = e[7], u = e[8], h = e[9], d = e[10], c = e[11], f = e[12], p = e[13], m = e[14], v = e[15]);
        var g = t * o - r * n,
          y = t * s - i * n,
          _ = t * l - a * n,
          b = r * s - i * o,
          x = r * l - a * o,
          w = i * l - a * s,
          S = u * p - h * f,
          M = u * m - d * f,
          E = u * v - c * f,
          T = h * m - d * p,
          C = h * v - c * p,
          P = d * v - c * m,
          L = g * P - y * C + _ * T + b * E - x * M + w * S;
        return L ? (L = 1 / L, this.mat4[0] = (o * P - s * C + l * T) * L, this.mat4[1] = (i * C - r * P - a * T) * L, this.mat4[2] = (p * w - m * x + v * b) * L, this.mat4[3] = (d * x - h * w - c * b) * L, this.mat4[4] = (s * E - n * P - l * M) * L, this.mat4[5] = (t * P - i * E + a * M) * L, this.mat4[6] = (m * _ - f * w - v * y) * L, this.mat4[7] = (u * w - d * _ + c * y) * L, this.mat4[8] = (n * C - o * E + l * S) * L, this.mat4[9] = (r * E - t * C - a * S) * L, this.mat4[10] = (f * x - p * _ + v * g) * L, this.mat4[11] = (h * _ - u * x - c * g) * L, this.mat4[12] = (o * M - n * T - s * S) * L, this.mat4[13] = (t * T - r * M + i * S) * L, this.mat4[14] = (p * y - f * b - m * g) * L, this.mat4[15] = (u * b - h * y + d * g) * L, this) : null
      }, R.default.Matrix.prototype.invert3x3 = function() {
        var e = this.mat3[0],
          t = this.mat3[1],
          r = this.mat3[2],
          i = this.mat3[3],
          a = this.mat3[4],
          n = this.mat3[5],
          o = this.mat3[6],
          s = this.mat3[7],
          l = this.mat3[8],
          u = l * a - n * s,
          h = -l * i + n * o,
          d = s * i - a * o,
          c = e * u + t * h + r * d;
        return c ? (c = 1 / c, this.mat3[0] = u * c, this.mat3[1] = (-l * t + r * s) * c, this.mat3[2] = (n * t - r * a) * c, this.mat3[3] = h * c, this.mat3[4] = (l * e - r * o) * c, this.mat3[5] = (-n * e + r * i) * c, this.mat3[6] = d * c, this.mat3[7] = (-s * e + t * o) * c, this.mat3[8] = (a * e - t * i) * c, this) : null
      }, R.default.Matrix.prototype.transpose3x3 = function(e) {
        var t = e[1],
          r = e[2],
          i = e[5];
        return this.mat3[1] = e[3], this.mat3[2] = e[6], this.mat3[3] = t, this.mat3[5] = e[7], this.mat3[6] = r, this.mat3[7] = i, this
      }, R.default.Matrix.prototype.inverseTranspose = function(e) {
        void 0 === this.mat3 ? console.error("sorry, this function only works with mat3") : (this.mat3[0] = e.mat4[0], this.mat3[1] = e.mat4[1], this.mat3[2] = e.mat4[2], this.mat3[3] = e.mat4[4], this.mat3[4] = e.mat4[5], this.mat3[5] = e.mat4[6], this.mat3[6] = e.mat4[8], this.mat3[7] = e.mat4[9], this.mat3[8] = e.mat4[10]);
        var t = this.invert3x3();
        if (t) t.transpose3x3(this.mat3);
        else
          for (var r = 0; r < 9; r++) this.mat3[r] = 0;
        return this
      }, R.default.Matrix.prototype.determinant = function() {
        var e = this.mat4[0] * this.mat4[5] - this.mat4[1] * this.mat4[4],
          t = this.mat4[0] * this.mat4[6] - this.mat4[2] * this.mat4[4],
          r = this.mat4[0] * this.mat4[7] - this.mat4[3] * this.mat4[4],
          i = this.mat4[1] * this.mat4[6] - this.mat4[2] * this.mat4[5],
          a = this.mat4[1] * this.mat4[7] - this.mat4[3] * this.mat4[5],
          n = this.mat4[2] * this.mat4[7] - this.mat4[3] * this.mat4[6],
          o = this.mat4[8] * this.mat4[13] - this.mat4[9] * this.mat4[12],
          s = this.mat4[8] * this.mat4[14] - this.mat4[10] * this.mat4[12],
          l = this.mat4[8] * this.mat4[15] - this.mat4[11] * this.mat4[12],
          u = this.mat4[9] * this.mat4[14] - this.mat4[10] * this.mat4[13],
          h = this.mat4[9] * this.mat4[15] - this.mat4[11] * this.mat4[13];
        return e * (this.mat4[10] * this.mat4[15] - this.mat4[11] * this.mat4[14]) - t * h + r * u + i * l - a * s + n * o
      }, R.default.Matrix.prototype.mult = function(e) {
        var t;
        if (e === this || e === this.mat4) t = this.copy().mat4;
        else if (e instanceof R.default.Matrix) t = e.mat4;
        else if (O(e)) t = e;
        else {
          if (16 !== arguments.length) return;
          t = arguments
        }
        var r = this.mat4[0],
          i = this.mat4[1],
          a = this.mat4[2],
          n = this.mat4[3];
        return this.mat4[0] = r * t[0] + i * t[4] + a * t[8] + n * t[12], this.mat4[1] = r * t[1] + i * t[5] + a * t[9] + n * t[13], this.mat4[2] = r * t[2] + i * t[6] + a * t[10] + n * t[14], this.mat4[3] = r * t[3] + i * t[7] + a * t[11] + n * t[15], r = this.mat4[4], i = this.mat4[5], a = this.mat4[6], n = this.mat4[7], this.mat4[4] = r * t[0] + i * t[4] + a * t[8] + n * t[12], this.mat4[5] = r * t[1] + i * t[5] + a * t[9] + n * t[13], this.mat4[6] = r * t[2] + i * t[6] + a * t[10] + n * t[14], this.mat4[7] = r * t[3] + i * t[7] + a * t[11] + n * t[15], r = this.mat4[8], i = this.mat4[9], a = this.mat4[10], n = this.mat4[11], this.mat4[8] = r * t[0] + i * t[4] + a * t[8] + n * t[12], this.mat4[9] = r * t[1] + i * t[5] + a * t[9] + n * t[13], this.mat4[10] = r * t[2] + i * t[6] + a * t[10] + n * t[14], this.mat4[11] = r * t[3] + i * t[7] + a * t[11] + n * t[15], r = this.mat4[12], i = this.mat4[13], a = this.mat4[14], n = this.mat4[15], this.mat4[12] = r * t[0] + i * t[4] + a * t[8] + n * t[12], this.mat4[13] = r * t[1] + i * t[5] + a * t[9] + n * t[13], this.mat4[14] = r * t[2] + i * t[6] + a * t[10] + n * t[14], this.mat4[15] = r * t[3] + i * t[7] + a * t[11] + n * t[15], this
      }, R.default.Matrix.prototype.apply = function(e) {
        var t;
        if (e === this || e === this.mat4) t = this.copy().mat4;
        else if (e instanceof R.default.Matrix) t = e.mat4;
        else if (O(e)) t = e;
        else {
          if (16 !== arguments.length) return;
          t = arguments
        }
        var r = this.mat4,
          i = r[0],
          a = r[4],
          n = r[8],
          o = r[12];
        r[0] = t[0] * i + t[1] * a + t[2] * n + t[3] * o, r[4] = t[4] * i + t[5] * a + t[6] * n + t[7] * o, r[8] = t[8] * i + t[9] * a + t[10] * n + t[11] * o, r[12] = t[12] * i + t[13] * a + t[14] * n + t[15] * o;
        var s = r[1],
          l = r[5],
          u = r[9],
          h = r[13];
        r[1] = t[0] * s + t[1] * l + t[2] * u + t[3] * h, r[5] = t[4] * s + t[5] * l + t[6] * u + t[7] * h, r[9] = t[8] * s + t[9] * l + t[10] * u + t[11] * h, r[13] = t[12] * s + t[13] * l + t[14] * u + t[15] * h;
        var d = r[2],
          c = r[6],
          f = r[10],
          p = r[14];
        r[2] = t[0] * d + t[1] * c + t[2] * f + t[3] * p, r[6] = t[4] * d + t[5] * c + t[6] * f + t[7] * p, r[10] = t[8] * d + t[9] * c + t[10] * f + t[11] * p, r[14] = t[12] * d + t[13] * c + t[14] * f + t[15] * p;
        var m = r[3],
          v = r[7],
          g = r[11],
          y = r[15];
        return r[3] = t[0] * m + t[1] * v + t[2] * g + t[3] * y, r[7] = t[4] * m + t[5] * v + t[6] * g + t[7] * y, r[11] = t[8] * m + t[9] * v + t[10] * g + t[11] * y, r[15] = t[12] * m + t[13] * v + t[14] * g + t[15] * y, this
      }, R.default.Matrix.prototype.scale = function(e, t, r) {
        return e instanceof R.default.Vector ? (t = e.y, r = e.z, e = e.x) : e instanceof Array && (t = e[1], r = e[2], e = e[0]), this.mat4[0] *= e, this.mat4[1] *= e, this.mat4[2] *= e, this.mat4[3] *= e, this.mat4[4] *= t, this.mat4[5] *= t, this.mat4[6] *= t, this.mat4[7] *= t, this.mat4[8] *= r, this.mat4[9] *= r, this.mat4[10] *= r, this.mat4[11] *= r, this
      }, R.default.Matrix.prototype.rotate = function(e, t, r, i) {
        t instanceof R.default.Vector ? (r = t.y, i = t.z, t = t.x) : t instanceof Array && (r = t[1], i = t[2], t = t[0]);
        var a = Math.sqrt(t * t + r * r + i * i);
        t *= 1 / a, r *= 1 / a, i *= 1 / a;
        var n = this.mat4[0],
          o = this.mat4[1],
          s = this.mat4[2],
          l = this.mat4[3],
          u = this.mat4[4],
          h = this.mat4[5],
          d = this.mat4[6],
          c = this.mat4[7],
          f = this.mat4[8],
          p = this.mat4[9],
          m = this.mat4[10],
          v = this.mat4[11],
          g = Math.sin(e),
          y = Math.cos(e),
          _ = 1 - y,
          b = t * t * _ + y,
          x = r * t * _ + i * g,
          w = i * t * _ - r * g,
          S = t * r * _ - i * g,
          M = r * r * _ + y,
          E = i * r * _ + t * g,
          T = t * i * _ + r * g,
          C = r * i * _ - t * g,
          P = i * i * _ + y;
        return this.mat4[0] = n * b + u * x + f * w, this.mat4[1] = o * b + h * x + p * w, this.mat4[2] = s * b + d * x + m * w, this.mat4[3] = l * b + c * x + v * w, this.mat4[4] = n * S + u * M + f * E, this.mat4[5] = o * S + h * M + p * E, this.mat4[6] = s * S + d * M + m * E, this.mat4[7] = l * S + c * M + v * E, this.mat4[8] = n * T + u * C + f * P, this.mat4[9] = o * T + h * C + p * P, this.mat4[10] = s * T + d * C + m * P, this.mat4[11] = l * T + c * C + v * P, this
      }, R.default.Matrix.prototype.translate = function(e) {
        var t = e[0],
          r = e[1],
          i = e[2] || 0;
        this.mat4[12] += this.mat4[0] * t + this.mat4[4] * r + this.mat4[8] * i, this.mat4[13] += this.mat4[1] * t + this.mat4[5] * r + this.mat4[9] * i, this.mat4[14] += this.mat4[2] * t + this.mat4[6] * r + this.mat4[10] * i, this.mat4[15] += this.mat4[3] * t + this.mat4[7] * r + this.mat4[11] * i
      }, R.default.Matrix.prototype.rotateX = function(e) {
        this.rotate(e, 1, 0, 0)
      }, R.default.Matrix.prototype.rotateY = function(e) {
        this.rotate(e, 0, 1, 0)
      }, R.default.Matrix.prototype.rotateZ = function(e) {
        this.rotate(e, 0, 0, 1)
      }, R.default.Matrix.prototype.perspective = function(e, t, r, i) {
        var a = 1 / Math.tan(e / 2),
          n = 1 / (r - i);
        return this.mat4[0] = a / t, this.mat4[1] = 0, this.mat4[2] = 0, this.mat4[3] = 0, this.mat4[4] = 0, this.mat4[5] = a, this.mat4[6] = 0, this.mat4[7] = 0, this.mat4[8] = 0, this.mat4[9] = 0, this.mat4[10] = (i + r) * n, this.mat4[11] = -1, this.mat4[12] = 0, this.mat4[13] = 0, this.mat4[14] = 2 * i * r * n, this.mat4[15] = 0, this
      }, R.default.Matrix.prototype.ortho = function(e, t, r, i, a, n) {
        var o = 1 / (e - t),
          s = 1 / (r - i),
          l = 1 / (a - n);
        return this.mat4[0] = -2 * o, this.mat4[1] = 0, this.mat4[2] = 0, this.mat4[3] = 0, this.mat4[4] = 0, this.mat4[5] = -2 * s, this.mat4[6] = 0, this.mat4[7] = 0, this.mat4[8] = 0, this.mat4[9] = 0, this.mat4[10] = 2 * l, this.mat4[11] = 0, this.mat4[12] = (e + t) * o, this.mat4[13] = (i + r) * s, this.mat4[14] = (n + a) * l, this.mat4[15] = 1, this
      };
      var n = R.default.Matrix;
      r.default = n
    }, {
      "../core/main": 26
    }],
    77: [function(e, t, r) {
      "use strict";
      Object.defineProperty(r, "__esModule", {
        value: !0
      }), r.default = void 0;
      var i, p = (i = e("../core/main")) && i.__esModule ? i : {
          default: i
        },
        m = function(e) {
          {
            if (e && e.__esModule) return e;
            var t = {};
            if (null != e)
              for (var r in e)
                if (Object.prototype.hasOwnProperty.call(e, r)) {
                  var i = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(e, r) : {};
                  i.get || i.set ? Object.defineProperty(t, r, i) : t[r] = e[r]
                } return t.default = e, t
          }
        }(e("../core/constants"));
      p.default.RendererGL.prototype.beginShape = function(e) {
        return this.immediateMode.shapeMode = void 0 !== e ? e : m.LINE_STRIP, void 0 === this.immediateMode.vertices ? (this.immediateMode.vertices = [], this.immediateMode.edges = [], this.immediateMode.lineVertices = [], this.immediateMode.vertexColors = [], this.immediateMode.lineNormals = [], this.immediateMode.uvCoords = [], this.immediateMode.vertexBuffer = this.GL.createBuffer(), this.immediateMode.colorBuffer = this.GL.createBuffer(), this.immediateMode.uvBuffer = this.GL.createBuffer(), this.immediateMode.lineVertexBuffer = this.GL.createBuffer(), this.immediateMode.lineNormalBuffer = this.GL.createBuffer(), this.immediateMode.pointVertexBuffer = this.GL.createBuffer(), this.immediateMode._bezierVertex = [], this.immediateMode._quadraticVertex = [], this.immediateMode._curveVertex = [], this.immediateMode._isCoplanar = !0, this.immediateMode._testIfCoplanar = null) : (this.immediateMode.vertices.length = 0, this.immediateMode.edges.length = 0, this.immediateMode.lineVertices.length = 0, this.immediateMode.lineNormals.length = 0, this.immediateMode.vertexColors.length = 0, this.immediateMode.uvCoords.length = 0), this.isImmediateDrawing = !0, this
      }, p.default.RendererGL.prototype.vertex = function(e, t) {
        var r, i, a;
        r = i = a = 0, 3 === arguments.length ? r = arguments[2] : 4 === arguments.length ? (i = arguments[2], a = arguments[3]) : 5 === arguments.length && (r = arguments[2], i = arguments[3], a = arguments[4]), null == this.immediateMode._testIfCoplanar ? this.immediateMode._testIfCoplanar = r : this.immediateMode._testIfCoplanar !== r && (this.immediateMode._isCoplanar = !1);
        var n = new p.default.Vector(e, t, r);
        this.immediateMode.vertices.push(n);
        var o = this.curFillColor || [.5, .5, .5, 1];
        return this.immediateMode.vertexColors.push(o[0], o[1], o[2], o[3]), this.textureMode === m.IMAGE && (null !== this._tex ? 0 < this._tex.width && 0 < this._tex.height && (i /= this._tex.width, a /= this._tex.height) : null === this._tex && 4 <= arguments.length && console.warn("You must first call texture() before using vertex() with image based u and v coordinates")), this.immediateMode.uvCoords.push(i, a), this.immediateMode._bezierVertex[0] = e, this.immediateMode._bezierVertex[1] = t, this.immediateMode._bezierVertex[2] = r, this.immediateMode._quadraticVertex[0] = e, this.immediateMode._quadraticVertex[1] = t, this.immediateMode._quadraticVertex[2] = r, this
      }, p.default.RendererGL.prototype.endShape = function(e, t, r, i, a, n) {
        if (this.immediateMode.shapeMode === m.POINTS) this._drawPoints(this.immediateMode.vertices, this.immediateMode.pointVertexBuffer);
        else if (1 < this.immediateMode.vertices.length) {
          if (this._doStroke && this.drawMode !== m.TEXTURE) {
            if (this.immediateMode.shapeMode === m.TRIANGLE_STRIP) {
              var o;
              for (o = 0; o < this.immediateMode.vertices.length - 2; o++) this.immediateMode.edges.push([o, o + 1]), this.immediateMode.edges.push([o, o + 2]);
              this.immediateMode.edges.push([o, o + 1])
            } else if (this.immediateMode.shapeMode === m.TRIANGLES)
              for (var s = 0; s < this.immediateMode.vertices.length - 2; s += 3) this.immediateMode.edges.push([s, s + 1]), this.immediateMode.edges.push([s + 1, s + 2]), this.immediateMode.edges.push([s + 2, s]);
            else if (this.immediateMode.shapeMode === m.LINES)
              for (var l = 0; l < this.immediateMode.vertices.length - 1; l += 2) this.immediateMode.edges.push([l, l + 1]);
            else
              for (var u = 0; u < this.immediateMode.vertices.length - 1; u++) this.immediateMode.edges.push([u, u + 1]);
            e === m.CLOSE && this.immediateMode.edges.push([this.immediateMode.vertices.length - 1, 0]), p.default.Geometry.prototype._edgesToVertices.call(this.immediateMode), this._drawStrokeImmediateMode()
          }
          if (this._doFill && this.immediateMode.shapeMode !== m.LINES) {
            if (this.isBezier || this.isQuadratic || this.isCurve || this.immediateMode.shapeMode === m.LINE_STRIP && this.drawMode === m.FILL && !0 === this.immediateMode._isCoplanar) {
              this.immediateMode.shapeMode = m.TRIANGLES;
              var h = [new Float32Array(this._vToNArray(this.immediateMode.vertices))],
                d = this._triangulate(h);
              this.immediateMode.vertices = [];
              for (var c = 0, f = d.length; c < f; c += 3) this.vertex(d[c], d[c + 1], d[c + 2])
            }
            0 < this.immediateMode.vertices.length && this._drawFillImmediateMode(e, t, r, i, a, n)
          }
        }
        return this.immediateMode.vertices.length = 0, this.immediateMode.vertexColors.length = 0, this.immediateMode.uvCoords.length = 0, this.isImmediateDrawing = !1, this.isBezier = !1, this.isQuadratic = !1, this.isCurve = !1, this.immediateMode._bezierVertex.length = 0, this.immediateMode._quadraticVertex.length = 0, this.immediateMode._curveVertex.length = 0, this.immediateMode._isCoplanar = !0, this.immediateMode._testIfCoplanar = null, this
      }, p.default.RendererGL.prototype._drawFillImmediateMode = function(e, t, r, i, a, n) {
        var o = this.GL,
          s = this._getImmediateFillShader();
        if (this._setFillUniforms(s), s.attributes.aPosition && (this._bindBuffer(this.immediateMode.vertexBuffer, o.ARRAY_BUFFER, this._vToNArray(this.immediateMode.vertices), Float32Array, o.DYNAMIC_DRAW), s.enableAttrib(s.attributes.aPosition, 3)), this.drawMode === m.FILL && s.attributes.aVertexColor && (this._bindBuffer(this.immediateMode.colorBuffer, o.ARRAY_BUFFER, this.immediateMode.vertexColors, Float32Array, o.DYNAMIC_DRAW), s.enableAttrib(s.attributes.aVertexColor, 4)), this.drawMode === m.TEXTURE && s.attributes.aTexCoord && (this._bindBuffer(this.immediateMode.uvBuffer, o.ARRAY_BUFFER, this.immediateMode.uvCoords, Float32Array, o.DYNAMIC_DRAW), s.enableAttrib(s.attributes.aTexCoord, 2)), this.drawMode === m.FILL || this.drawMode === m.TEXTURE) switch (this.immediateMode.shapeMode) {
          case m.LINE_STRIP:
          case m.LINES:
            this.immediateMode.shapeMode = m.TRIANGLE_FAN
        } else switch (this.immediateMode.shapeMode) {
          case m.LINE_STRIP:
          case m.LINES:
            this.immediateMode.shapeMode = m.LINE_LOOP
        }
        if (this.immediateMode.shapeMode === m.QUADS || this.immediateMode.shapeMode === m.QUAD_STRIP) throw new Error("sorry, ".concat(this.immediateMode.shapeMode, " not yet implemented in webgl mode."));
        this._applyColorBlend(this.curFillColor), o.enable(o.BLEND), o.drawArrays(this.immediateMode.shapeMode, 0, this.immediateMode.vertices.length), s.unbindShader()
      }, p.default.RendererGL.prototype._drawStrokeImmediateMode = function() {
        var e = this.GL,
          t = this._getImmediateStrokeShader();
        this._setStrokeUniforms(t), t.attributes.aPosition && (this._bindBuffer(this.immediateMode.lineVertexBuffer, e.ARRAY_BUFFER, this._flatten(this.immediateMode.lineVertices), Float32Array, e.STATIC_DRAW), t.enableAttrib(t.attributes.aPosition, 3)), t.attributes.aDirection && (this._bindBuffer(this.immediateMode.lineNormalBuffer, e.ARRAY_BUFFER, this._flatten(this.immediateMode.lineNormals), Float32Array, e.STATIC_DRAW), t.enableAttrib(t.attributes.aDirection, 4)), this._applyColorBlend(this.curStrokeColor), e.drawArrays(e.TRIANGLES, 0, this.immediateMode.lineVertices.length), t.unbindShader()
      };
      var a = p.default.RendererGL;
      r.default = a
    }, {
      "../core/constants": 20,
      "../core/main": 26
    }],
    78: [function(e, t, r) {
      "use strict";
      Object.defineProperty(r, "__esModule", {
        value: !0
      }), r.default = void 0;
      var i, o = (i = e("../core/main")) && i.__esModule ? i : {
        default: i
      };

      function a(e, t, r, i, a) {
        this.size = e, this.src = t, this.dst = r, this.attr = i, this.map = a
      }
      e("./p5.RendererGL");
      var n = o.default.RendererGL.prototype._flatten,
        s = o.default.RendererGL.prototype._vToNArray,
        u = [new a(3, "lineVertices", "lineVertexBuffer", "aPosition", n), new a(4, "lineNormals", "lineNormalBuffer", "aDirection", n)],
        h = [new a(3, "vertices", "vertexBuffer", "aPosition", s), new a(3, "vertexNormals", "normalBuffer", "aNormal", s), new a(4, "vertexColors", "colorBuffer", "aMaterialColor"), new a(3, "vertexAmbients", "ambientBuffer", "aAmbientColor"), new a(2, "uvs", "uvBuffer", "aTexCoord", n)];
      o.default.RendererGL._textBuffers = [new a(3, "vertices", "vertexBuffer", "aPosition", s), new a(2, "uvs", "uvBuffer", "aTexCoord", n)];
      var d = 0;
      o.default.RendererGL.prototype._initBufferDefaults = function(e) {
        if (this._freeBuffers(e), 1e3 < ++d) {
          var t = Object.keys(this.gHash)[0];
          delete this.gHash[t], d--
        }
        return this.gHash[e] = {}
      }, o.default.RendererGL.prototype._freeBuffers = function(e) {
        var s = this.gHash[e];
        if (s) {
          delete this.gHash[e], d--;
          var l = this.GL;
          s.indexBuffer && l.deleteBuffer(s.indexBuffer), t(u), t(h)
        }

        function t(e) {
          var t = !0,
            r = !1,
            i = void 0;
          try {
            for (var a, n = e[Symbol.iterator](); !(t = (a = n.next()).done); t = !0) {
              var o = a.value;
              s[o.dst] && (l.deleteBuffer(s[o.dst]), s[o.dst] = null)
            }
          } catch (e) {
            r = !0, i = e
          } finally {
            try {
              t || null == n.return || n.return()
            } finally {
              if (r) throw i
            }
          }
        }
      }, o.default.RendererGL.prototype._prepareBuffers = function(e, t, r) {
        var i = e.model,
          a = t.attributes,
          n = this.GL,
          o = !0,
          s = !1,
          l = void 0;
        try {
          for (var u, h = r[Symbol.iterator](); !(o = (u = h.next()).done); o = !0) {
            var d = u.value,
              c = a[d.attr];
            if (c) {
              var f = e[d.dst],
                p = i[d.src];
              if (p) {
                var m = !f;
                if (m && (e[d.dst] = f = n.createBuffer()), n.bindBuffer(n.ARRAY_BUFFER, f), m || !1 !== i.dirtyFlags[d.src]) {
                  var v = d.map,
                    g = v ? v(p) : p;
                  this._bindBuffer(f, n.ARRAY_BUFFER, g), i.dirtyFlags[d.src] = !1
                }
                t.enableAttrib(c, d.size)
              } else f && (n.deleteBuffer(f), e[d.dst] = null), n.disableVertexAttribArray(c.index)
            }
          }
        } catch (e) {
          s = !0, l = e
        } finally {
          try {
            o || null == h.return || h.return()
          } finally {
            if (s) throw l
          }
        }
      }, o.default.RendererGL.prototype.createBuffers = function(e, t) {
        var r = this.GL,
          i = this._initBufferDefaults(e);
        i.model = t;
        var a = i.indexBuffer;
        if (t.faces.length) {
          a || (a = i.indexBuffer = r.createBuffer());
          var n = o.default.RendererGL.prototype._flatten(t.faces);
          this._bindBuffer(a, r.ELEMENT_ARRAY_BUFFER, n, Uint16Array), i.vertexCount = 3 * t.faces.length
        } else a && (r.deleteBuffer(a), i.indexBuffer = null), i.vertexCount = t.vertices ? t.vertices.length : 0;
        return i.lineVertexCount = t.lineVertices ? t.lineVertices.length : 0, i
      }, o.default.RendererGL.prototype.drawBuffers = function(e) {
        var t = this.GL,
          r = this.gHash[e];
        if (this._doStroke && 0 < r.lineVertexCount) {
          var i = this._getRetainedStrokeShader();
          this._setStrokeUniforms(i), this._prepareBuffers(r, i, u), this._applyColorBlend(this.curStrokeColor), this._drawArrays(t.TRIANGLES, e), i.unbindShader()
        }
        if (this._doFill) {
          var a = this._getRetainedFillShader();
          this._setFillUniforms(a), this._prepareBuffers(r, a, h), r.indexBuffer && this._bindBuffer(r.indexBuffer, t.ELEMENT_ARRAY_BUFFER), this._applyColorBlend(this.curFillColor), this._drawElements(t.TRIANGLES, e), a.unbindShader()
        }
        return this
      }, o.default.RendererGL.prototype.drawBuffersScaled = function(e, t, r, i) {
        var a = this.uMVMatrix.copy();
        try {
          this.uMVMatrix.scale(t, r, i), this.drawBuffers(e)
        } finally {
          this.uMVMatrix = a
        }
      }, o.default.RendererGL.prototype._drawArrays = function(e, t) {
        return this.GL.drawArrays(e, 0, this.gHash[t].lineVertexCount), this
      }, o.default.RendererGL.prototype._drawElements = function(e, t) {
        var r = this.gHash[t],
          i = this.GL;
        r.indexBuffer ? i.drawElements(i.TRIANGLES, r.vertexCount, i.UNSIGNED_SHORT, 0) : i.drawArrays(e || i.TRIANGLES, 0, r.vertexCount)
      }, o.default.RendererGL.prototype._drawPoints = function(e, t) {
        var r = this.GL,
          i = this._getImmediatePointShader();
        this._setPointUniforms(i), this._bindBuffer(t, r.ARRAY_BUFFER, this._vToNArray(e), Float32Array, r.STATIC_DRAW), i.enableAttrib(i.attributes.aPosition, 3), r.drawArrays(r.Points, 0, e.length), i.unbindShader()
      };
      var l = o.default.RendererGL;
      r.default = l
    }, {
      "../core/main": 26,
      "./p5.RendererGL": 79
    }],
    79: [function(e, t, r) {
      "use strict";
      Object.defineProperty(r, "__esModule", {
        value: !0
      }), r.default = void 0;
      var u = a(e("../core/main")),
        n = function(e) {
          {
            if (e && e.__esModule) return e;
            var t = {};
            if (null != e)
              for (var r in e)
                if (Object.prototype.hasOwnProperty.call(e, r)) {
                  var i = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(e, r) : {};
                  i.get || i.set ? Object.defineProperty(t, r, i) : t[r] = e[r]
                } return t.default = e, t
          }
        }(e("../core/constants")),
        i = a(e("libtess"));
      e("./p5.Shader"), e("./p5.Camera"), e("../core/p5.Renderer"), e("./p5.Matrix");
      e("path");

      function a(e) {
        return e && e.__esModule ? e : {
          default: e
        }
      }

      function o(e) {
        return function(e) {
          if (Array.isArray(e)) {
            for (var t = 0, r = new Array(e.length); t < e.length; t++) r[t] = e[t];
            return r
          }
        }(e) || function(e) {
          if (Symbol.iterator in Object(e) || "[object Arguments]" === Object.prototype.toString.call(e)) return Array.from(e)
        }(e) || function() {
          throw new TypeError("Invalid attempt to spread non-iterable instance")
        }()
      }
      var s = "precision mediump float;\n\nuniform mat4 uViewMatrix;\n\nuniform bool uUseLighting;\n\nuniform int uAmbientLightCount;\nuniform vec3 uAmbientColor[8];\n\nuniform int uDirectionalLightCount;\nuniform vec3 uLightingDirection[8];\nuniform vec3 uDirectionalDiffuseColors[8];\nuniform vec3 uDirectionalSpecularColors[8];\n\nuniform int uPointLightCount;\nuniform vec3 uPointLightLocation[8];\nuniform vec3 uPointLightDiffuseColors[8];\t\nuniform vec3 uPointLightSpecularColors[8];\n\nuniform int uSpotLightCount;\nuniform float uSpotLightAngle[8];\nuniform float uSpotLightConc[8];\nuniform vec3 uSpotLightDiffuseColors[8];\nuniform vec3 uSpotLightSpecularColors[8];\nuniform vec3 uSpotLightLocation[8];\nuniform vec3 uSpotLightDirection[8];\n\nuniform bool uSpecular;\nuniform float uShininess;\n\nuniform float uConstantAttenuation;\nuniform float uLinearAttenuation;\nuniform float uQuadraticAttenuation;\n\nconst float specularFactor = 2.0;\nconst float diffuseFactor = 0.73;\n\nstruct LightResult {\n  float specular;\n  float diffuse;\n};\n\nfloat _phongSpecular(\n  vec3 lightDirection,\n  vec3 viewDirection,\n  vec3 surfaceNormal,\n  float shininess) {\n\n  vec3 R = reflect(lightDirection, surfaceNormal);\n  return pow(max(0.0, dot(R, viewDirection)), shininess);\n}\n\nfloat _lambertDiffuse(vec3 lightDirection, vec3 surfaceNormal) {\n  return max(0.0, dot(-lightDirection, surfaceNormal));\n}\n\nLightResult _light(vec3 viewDirection, vec3 normal, vec3 lightVector) {\n\n  vec3 lightDir = normalize(lightVector);\n\n  //compute our diffuse & specular terms\n  LightResult lr;\n  if (uSpecular)\n    lr.specular = _phongSpecular(lightDir, viewDirection, normal, uShininess);\n  lr.diffuse = _lambertDiffuse(lightDir, normal);\n  return lr;\n}\n\nvoid totalLight(\n  vec3 modelPosition,\n  vec3 normal,\n  out vec3 totalDiffuse,\n  out vec3 totalSpecular\n) {\n\n  totalSpecular = vec3(0.0);\n\n  if (!uUseLighting) {\n    totalDiffuse = vec3(1.0);\n    return;\n  }\n\n  totalDiffuse = vec3(0.0);\n\n  vec3 viewDirection = normalize(-modelPosition);\n\n  for (int j = 0; j < 8; j++) {\n    if (j < uDirectionalLightCount) {\n      vec3 lightVector = (uViewMatrix * vec4(uLightingDirection[j], 0.0)).xyz;\n      vec3 lightColor = uDirectionalDiffuseColors[j];\n      vec3 specularColor = uDirectionalSpecularColors[j];\n      LightResult result = _light(viewDirection, normal, lightVector);\n      totalDiffuse += result.diffuse * lightColor;\n      totalSpecular += result.specular * lightColor * specularColor;\n    }\n\n    if (j < uPointLightCount) {\n      vec3 lightPosition = (uViewMatrix * vec4(uPointLightLocation[j], 1.0)).xyz;\n      vec3 lightVector = modelPosition - lightPosition;\n    \n      //calculate attenuation\n      float lightDistance = length(lightVector);\n      float lightFalloff = 1.0 / (uConstantAttenuation + lightDistance * uLinearAttenuation + (lightDistance * lightDistance) * uQuadraticAttenuation);\n      vec3 lightColor = lightFalloff * uPointLightDiffuseColors[j];\n      vec3 specularColor = lightFalloff * uPointLightSpecularColors[j];\n\n      LightResult result = _light(viewDirection, normal, lightVector);\n      totalDiffuse += result.diffuse * lightColor;\n      totalSpecular += result.specular * lightColor * specularColor;\n    }\n\n    if(j < uSpotLightCount) {\n      vec3 lightPosition = (uViewMatrix * vec4(uSpotLightLocation[j], 1.0)).xyz;\n      vec3 lightVector = modelPosition - lightPosition;\n    \n      float lightDistance = length(lightVector);\n      float lightFalloff = 1.0 / (uConstantAttenuation + lightDistance * uLinearAttenuation + (lightDistance * lightDistance) * uQuadraticAttenuation);\n\n      vec3 lightDirection = (uViewMatrix * vec4(uSpotLightDirection[j], 0.0)).xyz;\n      float spotDot = dot(normalize(lightVector), normalize(lightDirection));\n      float spotFalloff;\n      if(spotDot < uSpotLightAngle[j]) {\n        spotFalloff = 0.0;\n      }\n      else {\n        spotFalloff = pow(spotDot, uSpotLightConc[j]);\n      }\n      lightFalloff *= spotFalloff;\n\n      vec3 lightColor = uSpotLightDiffuseColors[j];\n      vec3 specularColor = uSpotLightSpecularColors[j];\n     \n      LightResult result = _light(viewDirection, normal, lightVector);\n      \n      totalDiffuse += result.diffuse * lightColor * lightFalloff;\n      totalSpecular += result.specular * lightColor * specularColor * lightFalloff;\n    }\n  }\n\n  totalDiffuse *= diffuseFactor;\n  totalSpecular *= specularFactor;\n}\n",
        l = {
          immediateVert: "attribute vec3 aPosition;\nattribute vec4 aVertexColor;\n\nuniform mat4 uModelViewMatrix;\nuniform mat4 uProjectionMatrix;\nuniform float uResolution;\nuniform float uPointSize;\n\nvarying vec4 vColor;\nvoid main(void) {\n  vec4 positionVec4 = vec4(aPosition, 1.0);\n  gl_Position = uProjectionMatrix * uModelViewMatrix * positionVec4;\n  vColor = aVertexColor;\n  gl_PointSize = uPointSize;\n}\n",
          vertexColorVert: "attribute vec3 aPosition;\nattribute vec4 aVertexColor;\n\nuniform mat4 uModelViewMatrix;\nuniform mat4 uProjectionMatrix;\n\nvarying vec4 vColor;\n\nvoid main(void) {\n  vec4 positionVec4 = vec4(aPosition, 1.0);\n  gl_Position = uProjectionMatrix * uModelViewMatrix * positionVec4;\n  vColor = aVertexColor;\n}\n",
          vertexColorFrag: "precision mediump float;\nvarying vec4 vColor;\nvoid main(void) {\n  gl_FragColor = vColor;\n}",
          normalVert: "attribute vec3 aPosition;\nattribute vec3 aNormal;\nattribute vec2 aTexCoord;\n\nuniform mat4 uModelViewMatrix;\nuniform mat4 uProjectionMatrix;\nuniform mat3 uNormalMatrix;\n\nvarying vec3 vVertexNormal;\nvarying highp vec2 vVertTexCoord;\n\nvoid main(void) {\n  vec4 positionVec4 = vec4(aPosition, 1.0);\n  gl_Position = uProjectionMatrix * uModelViewMatrix * positionVec4;\n  vVertexNormal = normalize(vec3( uNormalMatrix * aNormal ));\n  vVertTexCoord = aTexCoord;\n}\n",
          normalFrag: "precision mediump float;\nvarying vec3 vVertexNormal;\nvoid main(void) {\n  gl_FragColor = vec4(vVertexNormal, 1.0);\n}",
          basicFrag: "precision mediump float;\nuniform vec4 uMaterialColor;\nvoid main(void) {\n  gl_FragColor = uMaterialColor;\n}",
          lightVert: s + "// include lighting.glgl\n\nattribute vec3 aPosition;\nattribute vec3 aNormal;\nattribute vec2 aTexCoord;\n\nuniform mat4 uModelViewMatrix;\nuniform mat4 uProjectionMatrix;\nuniform mat3 uNormalMatrix;\n\nvarying highp vec2 vVertTexCoord;\nvarying vec3 vDiffuseColor;\nvarying vec3 vSpecularColor;\n\nvoid main(void) {\n\n  vec4 viewModelPosition = uModelViewMatrix * vec4(aPosition, 1.0);\n  gl_Position = uProjectionMatrix * viewModelPosition;\n\n  vec3 vertexNormal = normalize(uNormalMatrix * aNormal);\n  vVertTexCoord = aTexCoord;\n\n  totalLight(viewModelPosition.xyz, vertexNormal, vDiffuseColor, vSpecularColor);\n\n  for (int i = 0; i < 8; i++) {\n    if (i < uAmbientLightCount) {\n      vDiffuseColor += uAmbientColor[i];\n    }\n  }\n}\n",
          lightTextureFrag: "precision mediump float;\n\nuniform vec4 uMaterialColor;\nuniform vec4 uTint;\nuniform sampler2D uSampler;\nuniform bool isTexture;\nuniform bool uEmissive;\n\nvarying highp vec2 vVertTexCoord;\nvarying vec3 vDiffuseColor;\nvarying vec3 vSpecularColor;\n\nvoid main(void) {\n  if(uEmissive && !isTexture) {\n    gl_FragColor = uMaterialColor;\n  }\n  else {\n    gl_FragColor = isTexture ? texture2D(uSampler, vVertTexCoord) * (uTint / vec4(255, 255, 255, 255)) : uMaterialColor;\n    gl_FragColor.rgb = gl_FragColor.rgb * vDiffuseColor + vSpecularColor;\n  }\n}",
          phongVert: "precision mediump float;\nprecision mediump int;\n\nattribute vec3 aPosition;\nattribute vec3 aNormal;\nattribute vec2 aTexCoord;\n\nuniform vec3 uAmbientColor[8];\n\nuniform mat4 uModelViewMatrix;\nuniform mat4 uProjectionMatrix;\nuniform mat3 uNormalMatrix;\nuniform int uAmbientLightCount;\n\nvarying vec3 vNormal;\nvarying vec2 vTexCoord;\nvarying vec3 vViewPosition;\nvarying vec3 vAmbientColor;\n\nvoid main(void) {\n\n  vec4 viewModelPosition = uModelViewMatrix * vec4(aPosition, 1.0);\n\n  // Pass varyings to fragment shader\n  vViewPosition = viewModelPosition.xyz;\n  gl_Position = uProjectionMatrix * viewModelPosition;  \n\n  vNormal = uNormalMatrix * aNormal;\n  vTexCoord = aTexCoord;\n\n  // TODO: this should be a uniform\n  vAmbientColor = vec3(0.0);\n  for (int i = 0; i < 8; i++) {\n    if (i < uAmbientLightCount) {\n      vAmbientColor += uAmbientColor[i];\n    }\n  }\n}\n",
          phongFrag: s + "// include lighting.glsl\nprecision highp float;\n\nuniform vec4 uMaterialColor;\nuniform sampler2D uSampler;\nuniform bool isTexture;\nuniform bool uEmissive;\n\nvarying vec3 vNormal;\nvarying vec2 vTexCoord;\nvarying vec3 vViewPosition;\nvarying vec3 vAmbientColor;\n\nvoid main(void) {\n\n  vec3 diffuse;\n  vec3 specular;\n  totalLight(vViewPosition, normalize(vNormal), diffuse, specular);\n\n  if(uEmissive && !isTexture) {\n    gl_FragColor = uMaterialColor;\n  }\n  else {\n    gl_FragColor = isTexture ? texture2D(uSampler, vTexCoord) : uMaterialColor;\n    gl_FragColor.rgb = gl_FragColor.rgb * (diffuse + vAmbientColor) + specular;\n  }\n}",
          fontVert: "precision mediump float;\n\nattribute vec3 aPosition;\nattribute vec2 aTexCoord;\nuniform mat4 uModelViewMatrix;\nuniform mat4 uProjectionMatrix;\n\nuniform vec4 uGlyphRect;\nuniform float uGlyphOffset;\n\nvarying vec2 vTexCoord;\nvarying float w;\n\nvoid main() {\n  vec4 positionVec4 = vec4(aPosition, 1.0);\n\n  // scale by the size of the glyph's rectangle\n  positionVec4.xy *= uGlyphRect.zw - uGlyphRect.xy;\n\n  // move to the corner of the glyph\n  positionVec4.xy += uGlyphRect.xy;\n\n  // move to the letter's line offset\n  positionVec4.x += uGlyphOffset;\n  \n  gl_Position = uProjectionMatrix * uModelViewMatrix * positionVec4;\n  vTexCoord = aTexCoord;\n  w = gl_Position.w;\n}\n",
          fontFrag: "#extension GL_OES_standard_derivatives : enable\nprecision mediump float;\n\n#if 0\n  // simulate integer math using floats\n\t#define int float\n\t#define ivec2 vec2\n\t#define INT(x) float(x)\n\n\tint ifloor(float v) { return floor(v); }\n\tivec2 ifloor(vec2 v) { return floor(v); }\n\n#else\n  // use native integer math\n\tprecision highp int;\n\t#define INT(x) x\n\n\tint ifloor(float v) { return int(v); }\n\tint ifloor(int v) { return v; }\n\tivec2 ifloor(vec2 v) { return ivec2(v); }\n\n#endif\n\nuniform sampler2D uSamplerStrokes;\nuniform sampler2D uSamplerRowStrokes;\nuniform sampler2D uSamplerRows;\nuniform sampler2D uSamplerColStrokes;\nuniform sampler2D uSamplerCols;\n\nuniform ivec2 uStrokeImageSize;\nuniform ivec2 uCellsImageSize;\nuniform ivec2 uGridImageSize;\n\nuniform ivec2 uGridOffset;\nuniform ivec2 uGridSize;\nuniform vec4 uMaterialColor;\n\nvarying vec2 vTexCoord;\n\n// some helper functions\nint round(float v) { return ifloor(v + 0.5); }\nivec2 round(vec2 v) { return ifloor(v + 0.5); }\nfloat saturate(float v) { return clamp(v, 0.0, 1.0); }\nvec2 saturate(vec2 v) { return clamp(v, 0.0, 1.0); }\n\nint mul(float v1, int v2) {\n  return ifloor(v1 * float(v2));\n}\n\nivec2 mul(vec2 v1, ivec2 v2) {\n  return ifloor(v1 * vec2(v2) + 0.5);\n}\n\n// unpack a 16-bit integer from a float vec2\nint getInt16(vec2 v) {\n  ivec2 iv = round(v * 255.0);\n  return iv.x * INT(128) + iv.y;\n}\n\nvec2 pixelScale;\nvec2 coverage = vec2(0.0);\nvec2 weight = vec2(0.5);\nconst float minDistance = 1.0/8192.0;\nconst float hardness = 1.05; // amount of antialias\n\n// the maximum number of curves in a glyph\nconst int N = INT(250);\n\n// retrieves an indexed pixel from a sampler\nvec4 getTexel(sampler2D sampler, int pos, ivec2 size) {\n  int width = size.x;\n  int y = ifloor(pos / width);\n  int x = pos - y * width;  // pos % width\n\n  return texture2D(sampler, (vec2(x, y) + 0.5) / vec2(size));\n}\n\nvoid calulateCrossings(vec2 p0, vec2 p1, vec2 p2, out vec2 C1, out vec2 C2) {\n\n  // get the coefficients of the quadratic in t\n  vec2 a = p0 - p1 * 2.0 + p2;\n  vec2 b = p0 - p1;\n  vec2 c = p0 - vTexCoord;\n\n  // found out which values of 't' it crosses the axes\n  vec2 surd = sqrt(max(vec2(0.0), b * b - a * c));\n  vec2 t1 = ((b - surd) / a).yx;\n  vec2 t2 = ((b + surd) / a).yx;\n\n  // approximate straight lines to avoid rounding errors\n  if (abs(a.y) < 0.001)\n    t1.x = t2.x = c.y / (2.0 * b.y);\n\n  if (abs(a.x) < 0.001)\n    t1.y = t2.y = c.x / (2.0 * b.x);\n\n  // plug into quadratic formula to find the corrdinates of the crossings\n  C1 = ((a * t1 - b * 2.0) * t1 + c) * pixelScale;\n  C2 = ((a * t2 - b * 2.0) * t2 + c) * pixelScale;\n}\n\nvoid coverageX(vec2 p0, vec2 p1, vec2 p2) {\n\n  vec2 C1, C2;\n  calulateCrossings(p0, p1, p2, C1, C2);\n\n  // determine on which side of the x-axis the points lie\n  bool y0 = p0.y > vTexCoord.y;\n  bool y1 = p1.y > vTexCoord.y;\n  bool y2 = p2.y > vTexCoord.y;\n\n  // could web be under the curve (after t1)?\n  if (y1 ? !y2 : y0) {\n    // add the coverage for t1\n    coverage.x += saturate(C1.x + 0.5);\n    // calculate the anti-aliasing for t1\n    weight.x = min(weight.x, abs(C1.x));\n  }\n\n  // are we outside the curve (after t2)?\n  if (y1 ? !y0 : y2) {\n    // subtract the coverage for t2\n    coverage.x -= saturate(C2.x + 0.5);\n    // calculate the anti-aliasing for t2\n    weight.x = min(weight.x, abs(C2.x));\n  }\n}\n\n// this is essentially the same as coverageX, but with the axes swapped\nvoid coverageY(vec2 p0, vec2 p1, vec2 p2) {\n\n  vec2 C1, C2;\n  calulateCrossings(p0, p1, p2, C1, C2);\n\n  bool x0 = p0.x > vTexCoord.x;\n  bool x1 = p1.x > vTexCoord.x;\n  bool x2 = p2.x > vTexCoord.x;\n\n  if (x1 ? !x2 : x0) {\n    coverage.y -= saturate(C1.y + 0.5);\n    weight.y = min(weight.y, abs(C1.y));\n  }\n\n  if (x1 ? !x0 : x2) {\n    coverage.y += saturate(C2.y + 0.5);\n    weight.y = min(weight.y, abs(C2.y));\n  }\n}\n\nvoid main() {\n\n  // calculate the pixel scale based on screen-coordinates\n  pixelScale = hardness / fwidth(vTexCoord);\n\n  // which grid cell is this pixel in?\n  ivec2 gridCoord = ifloor(vTexCoord * vec2(uGridSize));\n\n  // intersect curves in this row\n  {\n    // the index into the row info bitmap\n    int rowIndex = gridCoord.y + uGridOffset.y;\n    // fetch the info texel\n    vec4 rowInfo = getTexel(uSamplerRows, rowIndex, uGridImageSize);\n    // unpack the rowInfo\n    int rowStrokeIndex = getInt16(rowInfo.xy);\n    int rowStrokeCount = getInt16(rowInfo.zw);\n\n    for (int iRowStroke = INT(0); iRowStroke < N; iRowStroke++) {\n      if (iRowStroke >= rowStrokeCount)\n        break;\n\n      // each stroke is made up of 3 points: the start and control point\n      // and the start of the next curve.\n      // fetch the indices of this pair of strokes:\n      vec4 strokeIndices = getTexel(uSamplerRowStrokes, rowStrokeIndex++, uCellsImageSize);\n\n      // unpack the stroke index\n      int strokePos = getInt16(strokeIndices.xy);\n\n      // fetch the two strokes\n      vec4 stroke0 = getTexel(uSamplerStrokes, strokePos + INT(0), uStrokeImageSize);\n      vec4 stroke1 = getTexel(uSamplerStrokes, strokePos + INT(1), uStrokeImageSize);\n\n      // calculate the coverage\n      coverageX(stroke0.xy, stroke0.zw, stroke1.xy);\n    }\n  }\n\n  // intersect curves in this column\n  {\n    int colIndex = gridCoord.x + uGridOffset.x;\n    vec4 colInfo = getTexel(uSamplerCols, colIndex, uGridImageSize);\n    int colStrokeIndex = getInt16(colInfo.xy);\n    int colStrokeCount = getInt16(colInfo.zw);\n    \n    for (int iColStroke = INT(0); iColStroke < N; iColStroke++) {\n      if (iColStroke >= colStrokeCount)\n        break;\n\n      vec4 strokeIndices = getTexel(uSamplerColStrokes, colStrokeIndex++, uCellsImageSize);\n\n      int strokePos = getInt16(strokeIndices.xy);\n      vec4 stroke0 = getTexel(uSamplerStrokes, strokePos + INT(0), uStrokeImageSize);\n      vec4 stroke1 = getTexel(uSamplerStrokes, strokePos + INT(1), uStrokeImageSize);\n      coverageY(stroke0.xy, stroke0.zw, stroke1.xy);\n    }\n  }\n\n  weight = saturate(1.0 - weight * 2.0);\n  float distance = max(weight.x + weight.y, minDistance); // manhattan approx.\n  float antialias = abs(dot(coverage, weight) / distance);\n  float cover = min(abs(coverage.x), abs(coverage.y));\n  gl_FragColor = uMaterialColor;\n  gl_FragColor.a *= saturate(max(antialias, cover));\n}",
          lineVert: "/*\n  Part of the Processing project - http://processing.org\n  Copyright (c) 2012-15 The Processing Foundation\n  Copyright (c) 2004-12 Ben Fry and Casey Reas\n  Copyright (c) 2001-04 Massachusetts Institute of Technology\n  This library is free software; you can redistribute it and/or\n  modify it under the terms of the GNU Lesser General Public\n  License as published by the Free Software Foundation, version 2.1.\n  This library is distributed in the hope that it will be useful,\n  but WITHOUT ANY WARRANTY; without even the implied warranty of\n  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU\n  Lesser General Public License for more details.\n  You should have received a copy of the GNU Lesser General\n  Public License along with this library; if not, write to the\n  Free Software Foundation, Inc., 59 Temple Place, Suite 330,\n  Boston, MA  02111-1307  USA\n*/\n\n#define PROCESSING_LINE_SHADER\n\nuniform mat4 uModelViewMatrix;\nuniform mat4 uProjectionMatrix;\nuniform float uStrokeWeight;\n\nuniform vec4 uViewport;\nuniform int uPerspective;\n\nattribute vec4 aPosition;\nattribute vec4 aDirection;\n  \nvoid main() {\n  // using a scale <1 moves the lines towards the camera\n  // in order to prevent popping effects due to half of\n  // the line disappearing behind the geometry faces.\n  vec3 scale = vec3(0.9995);\n\n  vec4 posp = uModelViewMatrix * aPosition;\n  vec4 posq = uModelViewMatrix * (aPosition + vec4(aDirection.xyz, 0));\n\n  // Moving vertices slightly toward the camera\n  // to avoid depth-fighting with the fill triangles.\n  // Discussed here:\n  // http://www.opengl.org/discussion_boards/ubbthreads.php?ubb=showflat&Number=252848  \n  posp.xyz = posp.xyz * scale;\n  posq.xyz = posq.xyz * scale;\n\n  vec4 p = uProjectionMatrix * posp;\n  vec4 q = uProjectionMatrix * posq;\n\n  // formula to convert from clip space (range -1..1) to screen space (range 0..[width or height])\n  // screen_p = (p.xy/p.w + <1,1>) * 0.5 * uViewport.zw\n\n  // prevent division by W by transforming the tangent formula (div by 0 causes\n  // the line to disappear, see https://github.com/processing/processing/issues/5183)\n  // t = screen_q - screen_p\n  //\n  // tangent is normalized and we don't care which aDirection it points to (+-)\n  // t = +- normalize( screen_q - screen_p )\n  // t = +- normalize( (q.xy/q.w+<1,1>)*0.5*uViewport.zw - (p.xy/p.w+<1,1>)*0.5*uViewport.zw )\n  //\n  // extract common factor, <1,1> - <1,1> cancels out\n  // t = +- normalize( (q.xy/q.w - p.xy/p.w) * 0.5 * uViewport.zw )\n  //\n  // convert to common divisor\n  // t = +- normalize( ((q.xy*p.w - p.xy*q.w) / (p.w*q.w)) * 0.5 * uViewport.zw )\n  //\n  // remove the common scalar divisor/factor, not needed due to normalize and +-\n  // (keep uViewport - can't remove because it has different components for x and y\n  //  and corrects for aspect ratio, see https://github.com/processing/processing/issues/5181)\n  // t = +- normalize( (q.xy*p.w - p.xy*q.w) * uViewport.zw )\n\n  vec2 tangent = normalize((q.xy*p.w - p.xy*q.w) * uViewport.zw);\n\n  // flip tangent to normal (it's already normalized)\n  vec2 normal = vec2(-tangent.y, tangent.x);\n\n  float thickness = aDirection.w * uStrokeWeight;\n  vec2 offset = normal * thickness / 2.0;\n\n  vec2 curPerspScale;\n\n  if(uPerspective == 1) {\n    // Perspective ---\n    // convert from world to clip by multiplying with projection scaling factor\n    // to get the right thickness (see https://github.com/processing/processing/issues/5182)\n    // invert Y, projections in Processing invert Y\n    curPerspScale = (uProjectionMatrix * vec4(1, -1, 0, 0)).xy;\n  } else {\n    // No Perspective ---\n    // multiply by W (to cancel out division by W later in the pipeline) and\n    // convert from screen to clip (derived from clip to screen above)\n    curPerspScale = p.w / (0.5 * uViewport.zw);\n  }\n\n  gl_Position.xy = p.xy + offset.xy * curPerspScale;\n  gl_Position.zw = p.zw;\n}\n",
          lineFrag: "precision mediump float;\nprecision mediump int;\n\nuniform vec4 uMaterialColor;\n\nvoid main() {\n  gl_FragColor = uMaterialColor;\n}",
          pointVert: "attribute vec3 aPosition;\nuniform float uPointSize;\nvarying float vStrokeWeight;\nuniform mat4 uModelViewMatrix;\nuniform mat4 uProjectionMatrix;\nvoid main() {\n\tvec4 positionVec4 =  vec4(aPosition, 1.0);\n\tgl_Position = uProjectionMatrix * uModelViewMatrix * positionVec4;\n\tgl_PointSize = uPointSize;\n\tvStrokeWeight = uPointSize;\n}",
          pointFrag: "precision mediump float;\nprecision mediump int;\nuniform vec4 uMaterialColor;\nvarying float vStrokeWeight;\n\nvoid main(){\n\tfloat mask = 0.0;\n\n\t// make a circular mask using the gl_PointCoord (goes from 0 - 1 on a point)\n    // might be able to get a nicer edge on big strokeweights with smoothstep but slightly less performant\n\n\tmask = step(0.98, length(gl_PointCoord * 2.0 - 1.0));\n\n\t// if strokeWeight is 1 or less lets just draw a square\n\t// this prevents weird artifacting from carving circles when our points are really small\n\t// if strokeWeight is larger than 1, we just use it as is\n\n\tmask = mix(0.0, mask, clamp(floor(vStrokeWeight - 0.5),0.0,1.0));\n\n\t// throw away the borders of the mask\n    // otherwise we get weird alpha blending issues\n\n\tif(mask > 0.98){\n      discard;\n  \t}\n\n  \tgl_FragColor = vec4(uMaterialColor.rgb * (1.0 - mask), uMaterialColor.a) ;\n}"
        };
      u.default.RendererGL = function(e, t, r, i) {
        return u.default.Renderer.call(this, e, t, r), this._setAttributeDefaults(t), this._initContext(), this.isP3D = !0, this.GL = this.drawingContext, this._isErasing = !1, this._enableLighting = !1, this.ambientLightColors = [], this.specularColors = [1, 1, 1], this.directionalLightDirections = [], this.directionalLightDiffuseColors = [], this.directionalLightSpecularColors = [], this.pointLightPositions = [], this.pointLightDiffuseColors = [], this.pointLightSpecularColors = [], this.spotLightPositions = [], this.spotLightDirections = [], this.spotLightDiffuseColors = [], this.spotLightSpecularColors = [], this.spotLightAngle = [], this.spotLightConc = [], this.drawMode = n.FILL, this.curFillColor = this._cachedFillStyle = [1, 1, 1, 1], this.curStrokeColor = this._cachedStrokeStyle = [0, 0, 0, 1], this.curBlendMode = this._cachedBlendMode = n.BLEND, this.blendExt = this.GL.getExtension("EXT_blend_minmax"), this._useSpecularMaterial = !1, this._useEmissiveMaterial = !1, this._useNormalMaterial = !1, this._useShininess = 1, this._tint = [255, 255, 255, 255], this.constantAttenuation = 1, this.linearAttenuation = 0, this.quadraticAttenuation = 0, this.uMVMatrix = new u.default.Matrix, this.uPMatrix = new u.default.Matrix, this.uNMatrix = new u.default.Matrix("mat3"), this._curCamera = new u.default.Camera(this), this._curCamera._computeCameraDefaultSettings(), this._curCamera._setDefaultCamera(), this.gHash = {}, this._defaultLightShader = void 0, this._defaultImmediateModeShader = void 0, this._defaultNormalShader = void 0, this._defaultColorShader = void 0, this._defaultPointShader = void 0, this._pointVertexBuffer = this.GL.createBuffer(), this.userFillShader = void 0, this.userStrokeShader = void 0, this.userPointShader = void 0, this.isImmediateDrawing = !1, this.immediateMode = {}, this.pointSize = 5, this.curStrokeWeight = 1, this.textures = [], this.textureMode = n.IMAGE, this.textureWrapX = n.CLAMP, this.textureWrapY = n.CLAMP, this._tex = null, this._curveTightness = 6, this._lookUpTableBezier = [], this._lookUpTableQuadratic = [], this._lutBezierDetail = 0, this._lutQuadraticDetail = 0, this._tessy = this._initTessy(), this.fontInfos = {}, this
      }, u.default.RendererGL.prototype = Object.create(u.default.Renderer.prototype), u.default.RendererGL.prototype._setAttributeDefaults = function(e) {
        var t = {
          alpha: !0,
          depth: !0,
          stencil: !0,
          antialias: !1,
          premultipliedAlpha: !1,
          preserveDrawingBuffer: !0,
          perPixelLighting: !1
        };
        null === e._glAttributes ? e._glAttributes = t : e._glAttributes = Object.assign(t, e._glAttributes)
      }, u.default.RendererGL.prototype._initContext = function() {
        try {
          if (this.drawingContext = this.canvas.getContext("webgl", this._pInst._glAttributes) || this.canvas.getContext("experimental-webgl", this._pInst._glAttributes), null === this.drawingContext) throw new Error("Error creating webgl context");
          var e = this.drawingContext;
          e.enable(e.DEPTH_TEST), e.depthFunc(e.LEQUAL), e.viewport(0, 0, e.drawingBufferWidth, e.drawingBufferHeight), this._viewport = this.drawingContext.getParameter(this.drawingContext.VIEWPORT)
        } catch (e) {
          throw e
        }
      }, u.default.RendererGL.prototype._resetContext = function(e, t) {
        var r = this.width,
          i = this.height,
          a = this.canvas.id,
          n = this._pInst instanceof u.default.Graphics;
        if (n) {
          var o = this._pInst;
          o.canvas.parentNode.removeChild(o.canvas), o.canvas = document.createElement("canvas"), (o._pInst._userNode || document.body).appendChild(o.canvas), u.default.Element.call(o, o.canvas, o._pInst), o.width = r, o.height = i
        } else {
          var s = this.canvas;
          s && s.parentNode.removeChild(s), (s = document.createElement("canvas")).id = a, this._pInst._userNode ? this._pInst._userNode.appendChild(s) : document.body.appendChild(s), this._pInst.canvas = s
        }
        var l = new u.default.RendererGL(this._pInst.canvas, this._pInst, !n);
        this._pInst._setProperty("_renderer", l), l.resize(r, i), l._applyDefaults(), n || this._pInst._elements.push(l), "function" == typeof t && setTimeout(function() {
          t.apply(window._renderer, e)
        }, 0)
      }, u.default.prototype.setAttributes = function(e, t) {
        if (void 0 !== this._glAttributes) {
          var r = !0;
          if (void 0 !== t ? (null === this._glAttributes && (this._glAttributes = {}), this._glAttributes[e] !== t && (this._glAttributes[e] = t, r = !1)) : e instanceof Object && this._glAttributes !== e && (this._glAttributes = e, r = !1), this._renderer.isP3D && !r) {
            if (!this._setupDone)
              for (var i in this._renderer.gHash)
                if (this._renderer.gHash.hasOwnProperty(i)) return void console.error("Sorry, Could not set the attributes, you need to call setAttributes() before calling the other drawing methods in setup()");
            this.push(), this._renderer._resetContext(), this.pop(), this._renderer._curCamera && (this._renderer._curCamera._renderer = this._renderer)
          }
        } else console.log("You are trying to use setAttributes on a p5.Graphics object that does not use a WEBGL renderer.")
      }, u.default.RendererGL.prototype._update = function() {
        this.uMVMatrix.set(this._curCamera.cameraMatrix.mat4[0], this._curCamera.cameraMatrix.mat4[1], this._curCamera.cameraMatrix.mat4[2], this._curCamera.cameraMatrix.mat4[3], this._curCamera.cameraMatrix.mat4[4], this._curCamera.cameraMatrix.mat4[5], this._curCamera.cameraMatrix.mat4[6], this._curCamera.cameraMatrix.mat4[7], this._curCamera.cameraMatrix.mat4[8], this._curCamera.cameraMatrix.mat4[9], this._curCamera.cameraMatrix.mat4[10], this._curCamera.cameraMatrix.mat4[11], this._curCamera.cameraMatrix.mat4[12], this._curCamera.cameraMatrix.mat4[13], this._curCamera.cameraMatrix.mat4[14], this._curCamera.cameraMatrix.mat4[15]), this.ambientLightColors.length = 0, this.specularColors = [1, 1, 1], this.directionalLightDirections.length = 0, this.directionalLightDiffuseColors.length = 0, this.directionalLightSpecularColors.length = 0, this.pointLightPositions.length = 0, this.pointLightDiffuseColors.length = 0, this.pointLightSpecularColors.length = 0, this.spotLightPositions.length = 0, this.spotLightDirections.length = 0, this.spotLightDiffuseColors.length = 0, this.spotLightSpecularColors.length = 0, this.spotLightAngle.length = 0, this.spotLightConc.length = 0, this._enableLighting = !1, this._tint = [255, 255, 255, 255], this.GL.clear(this.GL.DEPTH_BUFFER_BIT)
      }, u.default.RendererGL.prototype.background = function() {
        var e, t = (e = this._pInst).color.apply(e, arguments),
          r = t.levels[0] / 255,
          i = t.levels[1] / 255,
          a = t.levels[2] / 255,
          n = t.levels[3] / 255;
        this.GL.clearColor(r, i, a, n), this.GL.depthMask(!0), this.GL.clear(this.GL.COLOR_BUFFER_BIT | this.GL.DEPTH_BUFFER_BIT)
      }, u.default.RendererGL.prototype.fill = function(e, t, r, i) {
        var a = u.default.prototype.color.apply(this._pInst, arguments);
        this.curFillColor = a._array, this.drawMode = n.FILL, this._useNormalMaterial = !1, this._tex = null
      }, u.default.RendererGL.prototype.stroke = function(e, t, r, i) {
        i = 255;
        var a = u.default.prototype.color.apply(this._pInst, arguments);
        this.curStrokeColor = a._array
      }, u.default.RendererGL.prototype.strokeCap = function(e) {
        console.error("Sorry, strokeCap() is not yet implemented in WEBGL mode")
      }, u.default.RendererGL.prototype.strokeJoin = function(e) {
        console.error("Sorry, strokeJoin() is not yet implemented in WEBGL mode")
      }, u.default.RendererGL.prototype.blendMode = function(e) {
        e === n.DARKEST || e === n.LIGHTEST || e === n.ADD || e === n.BLEND || e === n.SUBTRACT || e === n.SCREEN || e === n.EXCLUSION || e === n.REPLACE || e === n.MULTIPLY || e === n.REMOVE ? this.curBlendMode = e : e !== n.BURN && e !== n.OVERLAY && e !== n.HARD_LIGHT && e !== n.SOFT_LIGHT && e !== n.DODGE || console.warn("BURN, OVERLAY, HARD_LIGHT, SOFT_LIGHT, and DODGE only work for blendMode in 2D mode.")
      }, u.default.RendererGL.prototype.erase = function(e, t) {
        this._isErasing || (this._cachedBlendMode = this.curBlendMode, this.blendMode(n.REMOVE), this._cachedFillStyle = this.curFillColor.slice(), this.curFillColor = [1, 1, 1, e / 255], this._cachedStrokeStyle = this.curStrokeColor.slice(), this.curStrokeColor = [1, 1, 1, t / 255], this._isErasing = !0)
      }, u.default.RendererGL.prototype.noErase = function() {
        this._isErasing && (this.curFillColor = this._cachedFillStyle.slice(), this.curStrokeColor = this._cachedStrokeStyle.slice(), this.blendMode(this._cachedBlendMode), this._isErasing = !1)
      }, u.default.RendererGL.prototype.strokeWeight = function(e) {
        this.curStrokeWeight !== e && (this.pointSize = e, this.curStrokeWeight = e)
      }, u.default.RendererGL.prototype._getPixel = function(e, t) {
        var r;
        return r = new Uint8Array(4), this.drawingContext.readPixels(e, t, 1, 1, this.drawingContext.RGBA, this.drawingContext.UNSIGNED_BYTE, r), [r[0], r[1], r[2], r[3]]
      }, u.default.RendererGL.prototype.loadPixels = function() {
        var e = this._pixelsState;
        if (!0 === this._pInst._glAttributes.preserveDrawingBuffer) {
          var t = e.pixels,
            r = this.GL.drawingBufferWidth * this.GL.drawingBufferHeight * 4;
          t instanceof Uint8Array && t.length === r || (t = new Uint8Array(r), this._pixelsState._setProperty("pixels", t));
          var i = this._pInst._pixelDensity;
          this.GL.readPixels(0, 0, this.width * i, this.height * i, this.GL.RGBA, this.GL.UNSIGNED_BYTE, t)
        } else console.log("loadPixels only works in WebGL when preserveDrawingBuffer is true.")
      }, u.default.RendererGL.prototype.geometryInHash = function(e) {
        return void 0 !== this.gHash[e]
      }, u.default.RendererGL.prototype.resize = function(e, t) {
        u.default.Renderer.prototype.resize.call(this, e, t), this.GL.viewport(0, 0, this.GL.drawingBufferWidth, this.GL.drawingBufferHeight), this._viewport = this.GL.getParameter(this.GL.VIEWPORT), this._curCamera._resize();
        var r = this._pixelsState;
        void 0 !== r.pixels && r._setProperty("pixels", new Uint8Array(this.GL.drawingBufferWidth * this.GL.drawingBufferHeight * 4))
      }, u.default.RendererGL.prototype.clear = function() {
        var e = (arguments.length <= 0 ? void 0 : arguments[0]) || 0,
          t = (arguments.length <= 1 ? void 0 : arguments[1]) || 0,
          r = (arguments.length <= 2 ? void 0 : arguments[2]) || 0,
          i = (arguments.length <= 3 ? void 0 : arguments[3]) || 0;
        this.GL.clearColor(e, t, r, i), this.GL.clear(this.GL.COLOR_BUFFER_BIT | this.GL.DEPTH_BUFFER_BIT)
      }, u.default.RendererGL.prototype.applyMatrix = function(e, t, r, i, a, n) {
        16 === arguments.length ? u.default.Matrix.prototype.apply.apply(this.uMVMatrix, arguments) : this.uMVMatrix.apply([e, t, 0, 0, r, i, 0, 0, 0, 0, 1, 0, a, n, 0, 1])
      }, u.default.RendererGL.prototype.translate = function(e, t, r) {
        return e instanceof u.default.Vector && (r = e.z, t = e.y, e = e.x), this.uMVMatrix.translate([e, t, r]), this
      }, u.default.RendererGL.prototype.scale = function(e, t, r) {
        return this.uMVMatrix.scale(e, t, r), this
      }, u.default.RendererGL.prototype.rotate = function(e, t) {
        return void 0 === t ? this.rotateZ(e) : (u.default.Matrix.prototype.rotate.apply(this.uMVMatrix, arguments), this)
      }, u.default.RendererGL.prototype.rotateX = function(e) {
        return this.rotate(e, 1, 0, 0), this
      }, u.default.RendererGL.prototype.rotateY = function(e) {
        return this.rotate(e, 0, 1, 0), this
      }, u.default.RendererGL.prototype.rotateZ = function(e) {
        return this.rotate(e, 0, 0, 1), this
      }, u.default.RendererGL.prototype.push = function() {
        var e = u.default.Renderer.prototype.push.apply(this),
          t = e.properties;
        return t.uMVMatrix = this.uMVMatrix.copy(), t.uPMatrix = this.uPMatrix.copy(), t._curCamera = this._curCamera, this._curCamera = this._curCamera.copy(), t.ambientLightColors = this.ambientLightColors.slice(), t.specularColors = this.specularColors.slice(), t.directionalLightDirections = this.directionalLightDirections.slice(), t.directionalLightDiffuseColors = this.directionalLightDiffuseColors.slice(), t.directionalLightSpecularColors = this.directionalLightSpecularColors.slice(), t.pointLightPositions = this.pointLightPositions.slice(), t.pointLightDiffuseColors = this.pointLightDiffuseColors.slice(), t.pointLightSpecularColors = this.pointLightSpecularColors.slice(), t.spotLightPositions = this.spotLightPositions.slice(), t.spotLightDirections = this.spotLightDirections.slice(), t.spotLightDiffuseColors = this.spotLightDiffuseColors.slice(), t.spotLightSpecularColors = this.spotLightSpecularColors.slice(), t.spotLightAngle = this.spotLightAngle.slice(), t.spotLightConc = this.spotLightConc.slice(), t.userFillShader = this.userFillShader, t.userStrokeShader = this.userStrokeShader, t.userPointShader = this.userPointShader, t.pointSize = this.pointSize, t.curStrokeWeight = this.curStrokeWeight, t.curStrokeColor = this.curStrokeColor, t.curFillColor = this.curFillColor, t._useSpecularMaterial = this._useSpecularMaterial, t._useEmissiveMaterial = this._useEmissiveMaterial, t._useShininess = this._useShininess, t.constantAttenuation = this.constantAttenuation, t.linearAttenuation = this.linearAttenuation, t.quadraticAttenuation = this.quadraticAttenuation, t._enableLighting = this._enableLighting, t._useNormalMaterial = this._useNormalMaterial, t._tex = this._tex, t.drawMode = this.drawMode, e
      }, u.default.RendererGL.prototype.resetMatrix = function() {
        return this.uMVMatrix = u.default.Matrix.identity(this._pInst), this
      }, u.default.RendererGL.prototype._getImmediateStrokeShader = function() {
        var e = this.userStrokeShader;
        return e && e.isStrokeShader() ? e : this._getLineShader()
      }, u.default.RendererGL.prototype._getRetainedStrokeShader = u.default.RendererGL.prototype._getImmediateStrokeShader, u.default.RendererGL.prototype._getImmediateFillShader = function() {
        if (this._useNormalMaterial) return console.log("Sorry, normalMaterial() does not currently work with custom WebGL geometry created with beginShape(). Falling back to standard fill material."), this._getImmediateModeShader();
        var e = this.userFillShader;
        if (this._enableLighting) {
          if (!e || !e.isLightShader()) return this._getLightShader()
        } else if (this._tex) {
          if (!e || !e.isTextureShader()) return this._getLightShader()
        } else if (!e) return this._getImmediateModeShader();
        return e
      }, u.default.RendererGL.prototype._getRetainedFillShader = function() {
        if (this._useNormalMaterial) return this._getNormalShader();
        var e = this.userFillShader;
        if (this._enableLighting) {
          if (!e || !e.isLightShader()) return this._getLightShader()
        } else if (this._tex) {
          if (!e || !e.isTextureShader()) return this._getLightShader()
        } else if (!e) return this._getColorShader();
        return e
      }, u.default.RendererGL.prototype._getImmediatePointShader = function() {
        var e = this.userPointShader;
        return e && e.isPointShader() ? e : this._getPointShader()
      }, u.default.RendererGL.prototype._getRetainedLineShader = u.default.RendererGL.prototype._getImmediateLineShader, u.default.RendererGL.prototype._getLightShader = function() {
        return this._defaultLightShader || (this._pInst._glAttributes.perPixelLighting ? this._defaultLightShader = new u.default.Shader(this, l.phongVert, l.phongFrag) : this._defaultLightShader = new u.default.Shader(this, l.lightVert, l.lightTextureFrag)), this._defaultLightShader
      }, u.default.RendererGL.prototype._getImmediateModeShader = function() {
        return this._defaultImmediateModeShader || (this._defaultImmediateModeShader = new u.default.Shader(this, l.immediateVert, l.vertexColorFrag)), this._defaultImmediateModeShader
      }, u.default.RendererGL.prototype._getNormalShader = function() {
        return this._defaultNormalShader || (this._defaultNormalShader = new u.default.Shader(this, l.normalVert, l.normalFrag)), this._defaultNormalShader
      }, u.default.RendererGL.prototype._getColorShader = function() {
        return this._defaultColorShader || (this._defaultColorShader = new u.default.Shader(this, l.normalVert, l.basicFrag)), this._defaultColorShader
      }, u.default.RendererGL.prototype._getPointShader = function() {
        return this._defaultPointShader || (this._defaultPointShader = new u.default.Shader(this, l.pointVert, l.pointFrag)), this._defaultPointShader
      }, u.default.RendererGL.prototype._getLineShader = function() {
        return this._defaultLineShader || (this._defaultLineShader = new u.default.Shader(this, l.lineVert, l.lineFrag)), this._defaultLineShader
      }, u.default.RendererGL.prototype._getFontShader = function() {
        return this._defaultFontShader || (this.GL.getExtension("OES_standard_derivatives"), this._defaultFontShader = new u.default.Shader(this, l.fontVert, l.fontFrag)), this._defaultFontShader
      }, u.default.RendererGL.prototype._getEmptyTexture = function() {
        if (!this._emptyTexture) {
          var e = new u.default.Image(1, 1);
          e.set(0, 0, 255), this._emptyTexture = new u.default.Texture(this, e)
        }
        return this._emptyTexture
      }, u.default.RendererGL.prototype.getTexture = function(e) {
        var t = this.textures,
          r = !0,
          i = !1,
          a = void 0;
        try {
          for (var n, o = t[Symbol.iterator](); !(r = (n = o.next()).done); r = !0) {
            var s = n.value;
            if (s.src === e) return s
          }
        } catch (e) {
          i = !0, a = e
        } finally {
          try {
            r || null == o.return || o.return()
          } finally {
            if (i) throw a
          }
        }
        var l = new u.default.Texture(this, e);
        return t.push(l), l
      }, u.default.RendererGL.prototype._setStrokeUniforms = function(e) {
        e.bindShader(), e.setUniform("uMaterialColor", this.curStrokeColor), e.setUniform("uStrokeWeight", this.curStrokeWeight)
      }, u.default.RendererGL.prototype._setFillUniforms = function(e) {
        e.bindShader(), e.setUniform("uMaterialColor", this.curFillColor), e.setUniform("isTexture", !!this._tex), this._tex && e.setUniform("uSampler", this._tex), e.setUniform("uTint", this._tint), e.setUniform("uSpecular", this._useSpecularMaterial), e.setUniform("uEmissive", this._useEmissiveMaterial), e.setUniform("uShininess", this._useShininess), e.setUniform("uUseLighting", this._enableLighting);
        var t = this.pointLightDiffuseColors.length / 3;
        e.setUniform("uPointLightCount", t), e.setUniform("uPointLightLocation", this.pointLightPositions), e.setUniform("uPointLightDiffuseColors", this.pointLightDiffuseColors), e.setUniform("uPointLightSpecularColors", this.pointLightSpecularColors);
        var r = this.directionalLightDiffuseColors.length / 3;
        e.setUniform("uDirectionalLightCount", r), e.setUniform("uLightingDirection", this.directionalLightDirections), e.setUniform("uDirectionalDiffuseColors", this.directionalLightDiffuseColors), e.setUniform("uDirectionalSpecularColors", this.directionalLightSpecularColors);
        var i = this.ambientLightColors.length / 3;
        e.setUniform("uAmbientLightCount", i), e.setUniform("uAmbientColor", this.ambientLightColors);
        var a = this.spotLightDiffuseColors.length / 3;
        e.setUniform("uSpotLightCount", a), e.setUniform("uSpotLightAngle", this.spotLightAngle), e.setUniform("uSpotLightConc", this.spotLightConc), e.setUniform("uSpotLightDiffuseColors", this.spotLightDiffuseColors), e.setUniform("uSpotLightSpecularColors", this.spotLightSpecularColors), e.setUniform("uSpotLightLocation", this.spotLightPositions), e.setUniform("uSpotLightDirection", this.spotLightDirections), e.setUniform("uConstantAttenuation", this.constantAttenuation), e.setUniform("uLinearAttenuation", this.linearAttenuation), e.setUniform("uQuadraticAttenuation", this.quadraticAttenuation), e.bindTextures()
      }, u.default.RendererGL.prototype._setPointUniforms = function(e) {
        e.bindShader(), e.setUniform("uMaterialColor", this.curStrokeColor), e.setUniform("uPointSize", this.pointSize)
      }, u.default.RendererGL.prototype._bindBuffer = function(e, t, r, i, a) {
        if (t || (t = this.GL.ARRAY_BUFFER), this.GL.bindBuffer(t, e), void 0 !== r) {
          var n = new(i || Float32Array)(r);
          this.GL.bufferData(t, n, a || this.GL.STATIC_DRAW)
        }
      }, u.default.RendererGL.prototype._flatten = function(e) {
        if (0 === e.length) return [];
        if (2e4 < e.length) {
          var t, r = Object.prototype.toString,
            i = [],
            a = e.slice();
          for (t = a.pop();
            "[object Array]" === r.call(t) ? a.push.apply(a, o(t)) : i.push(t), a.length && void 0 !== (t = a.pop()););
          return i.reverse(), i
        }
        var n;
        return (n = []).concat.apply(n, o(e))
      }, u.default.RendererGL.prototype._vToNArray = function(e) {
        var t = [],
          r = !0,
          i = !1,
          a = void 0;
        try {
          for (var n, o = e[Symbol.iterator](); !(r = (n = o.next()).done); r = !0) {
            var s = n.value;
            t.push(s.x, s.y, s.z)
          }
        } catch (e) {
          i = !0, a = e
        } finally {
          try {
            r || null == o.return || o.return()
          } finally {
            if (i) throw a
          }
        }
        return t
      }, u.default.prototype._assert3d = function(e) {
        if (!this._renderer.isP3D) throw new Error("".concat(e, "() is only supported in WEBGL mode. If you'd like to use 3D graphics and WebGL, see  https://p5js.org/examples/form-3d-primitives.html for more information."))
      }, u.default.RendererGL.prototype._initTessy = function() {
        var e = new i.default.GluTesselator;
        return e.gluTessCallback(i.default.gluEnum.GLU_TESS_VERTEX_DATA, function(e, t) {
          t[t.length] = e[0], t[t.length] = e[1], t[t.length] = e[2]
        }), e.gluTessCallback(i.default.gluEnum.GLU_TESS_BEGIN, function(e) {
          e !== i.default.primitiveType.GL_TRIANGLES && console.log("expected TRIANGLES but got type: ".concat(e))
        }), e.gluTessCallback(i.default.gluEnum.GLU_TESS_ERROR, function(e) {
          console.log("error callback"), console.log("error number: ".concat(e))
        }), e.gluTessCallback(i.default.gluEnum.GLU_TESS_COMBINE, function(e, t, r) {
          return [e[0], e[1], e[2]]
        }), e.gluTessCallback(i.default.gluEnum.GLU_TESS_EDGE_FLAG, function(e) {}), e
      }, u.default.RendererGL.prototype._triangulate = function(e) {
        this._tessy.gluTessNormal(0, 0, 1);
        var t = [];
        this._tessy.gluTessBeginPolygon(t);
        for (var r = 0; r < e.length; r++) {
          this._tessy.gluTessBeginContour();
          for (var i = e[r], a = 0; a < i.length; a += 3) {
            var n = [i[a], i[a + 1], i[a + 2]];
            this._tessy.gluTessVertex(n, n)
          }
          this._tessy.gluTessEndContour()
        }
        return this._tessy.gluTessEndPolygon(), t
      }, u.default.RendererGL.prototype._bezierCoefficients = function(e) {
        var t = e * e,
          r = 1 - e,
          i = r * r;
        return [i * r, 3 * i * e, 3 * r * t, t * e]
      }, u.default.RendererGL.prototype._quadraticCoefficients = function(e) {
        var t = 1 - e;
        return [t * t, 2 * t * e, e * e]
      }, u.default.RendererGL.prototype._bezierToCatmull = function(e) {
        return [e[1], e[1] + (e[2] - e[0]) / this._curveTightness, e[2] - (e[3] - e[1]) / this._curveTightness, e[2]]
      };
      var h = u.default.RendererGL;
      r.default = h
    }, {
      "../core/constants": 20,
      "../core/main": 26,
      "../core/p5.Renderer": 29,
      "./p5.Camera": 74,
      "./p5.Matrix": 76,
      "./p5.Shader": 80,
      libtess: 9,
      path: 12
    }],
    80: [function(e, t, r) {
      "use strict";
      Object.defineProperty(r, "__esModule", {
        value: !0
      }), r.default = void 0;
      var i, a = (i = e("../core/main")) && i.__esModule ? i : {
        default: i
      };
      a.default.Shader = function(e, t, r) {
        this._renderer = e, this._vertSrc = t, this._fragSrc = r, this._vertShader = -1, this._fragShader = -1, this._glProgram = 0, this._loadedAttributes = !1, this.attributes = {}, this._loadedUniforms = !1, this.uniforms = {}, this._bound = !1, this.samplers = []
      }, a.default.Shader.prototype.init = function() {
        if (0 === this._glProgram) {
          var e = this._renderer.GL;
          if (this._vertShader = e.createShader(e.VERTEX_SHADER), e.shaderSource(this._vertShader, this._vertSrc), e.compileShader(this._vertShader), !e.getShaderParameter(this._vertShader, e.COMPILE_STATUS)) return console.error("Yikes! An error occurred compiling the vertex shader:".concat(e.getShaderInfoLog(this._vertShader))), null;
          if (this._fragShader = e.createShader(e.FRAGMENT_SHADER), e.shaderSource(this._fragShader, this._fragSrc), e.compileShader(this._fragShader), !e.getShaderParameter(this._fragShader, e.COMPILE_STATUS)) return console.error("Darn! An error occurred compiling the fragment shader:".concat(e.getShaderInfoLog(this._fragShader))), null;
          this._glProgram = e.createProgram(), e.attachShader(this._glProgram, this._vertShader), e.attachShader(this._glProgram, this._fragShader), e.linkProgram(this._glProgram), e.getProgramParameter(this._glProgram, e.LINK_STATUS) || console.error("Snap! Error linking shader program: ".concat(e.getProgramInfoLog(this._glProgram))), this._loadAttributes(), this._loadUniforms()
        }
        return this
      }, a.default.Shader.prototype._loadAttributes = function() {
        if (!this._loadedAttributes) {
          this.attributes = {};
          for (var e = this._renderer.GL, t = e.getProgramParameter(this._glProgram, e.ACTIVE_ATTRIBUTES), r = 0; r < t; ++r) {
            var i = e.getActiveAttrib(this._glProgram, r),
              a = i.name,
              n = e.getAttribLocation(this._glProgram, a),
              o = {};
            o.name = a, o.location = n, o.index = r, o.type = i.type, o.size = i.size, this.attributes[a] = o
          }
          this._loadedAttributes = !0
        }
      }, a.default.Shader.prototype._loadUniforms = function() {
        if (!this._loadedUniforms) {
          for (var e = this._renderer.GL, t = e.getProgramParameter(this._glProgram, e.ACTIVE_UNIFORMS), r = 0, i = 0; i < t; ++i) {
            var a = e.getActiveUniform(this._glProgram, i),
              n = {};
            n.location = e.getUniformLocation(this._glProgram, a.name), n.size = a.size;
            var o = a.name;
            1 < a.size && (o = o.substring(0, o.indexOf("[0]"))), n.name = o, n.type = a.type, n.type === e.SAMPLER_2D && (n.samplerIndex = r, r++, this.samplers.push(n)), this.uniforms[o] = n
          }
          this._loadedUniforms = !0
        }
      }, a.default.Shader.prototype.compile = function() {}, a.default.Shader.prototype.bindShader = function() {
        this.init(), this._bound || (this.useProgram(), this._bound = !0, this._setMatrixUniforms(), this.setUniform("uViewport", this._renderer._viewport))
      }, a.default.Shader.prototype.unbindShader = function() {
        return this._bound && (this.unbindTextures(), this._bound = !1), this
      }, a.default.Shader.prototype.bindTextures = function() {
        var e = this._renderer.GL,
          t = !0,
          r = !1,
          i = void 0;
        try {
          for (var a, n = this.samplers[Symbol.iterator](); !(t = (a = n.next()).done); t = !0) {
            var o = a.value,
              s = o.texture;
            void 0 === s && (s = this._renderer._getEmptyTexture()), e.activeTexture(e.TEXTURE0 + o.samplerIndex), s.bindTexture(), s.update(), e.uniform1i(o.location, o.samplerIndex)
          }
        } catch (e) {
          r = !0, i = e
        } finally {
          try {
            t || null == n.return || n.return()
          } finally {
            if (r) throw i
          }
        }
      }, a.default.Shader.prototype.updateTextures = function() {
        var e = !0,
          t = !1,
          r = void 0;
        try {
          for (var i, a = this.samplers[Symbol.iterator](); !(e = (i = a.next()).done); e = !0) {
            var n = i.value.texture;
            n && n.update()
          }
        } catch (e) {
          t = !0, r = e
        } finally {
          try {
            e || null == a.return || a.return()
          } finally {
            if (t) throw r
          }
        }
      }, a.default.Shader.prototype.unbindTextures = function() {}, a.default.Shader.prototype._setMatrixUniforms = function() {
        this.setUniform("uProjectionMatrix", this._renderer.uPMatrix.mat4), this.isStrokeShader() && ("default" === this._renderer._curCamera.cameraType ? this.setUniform("uPerspective", 1) : this.setUniform("uPerspective", 0)), this.setUniform("uModelViewMatrix", this._renderer.uMVMatrix.mat4), this.setUniform("uViewMatrix", this._renderer._curCamera.cameraMatrix.mat4), this.uniforms.uNormalMatrix && (this._renderer.uNMatrix.inverseTranspose(this._renderer.uMVMatrix), this.setUniform("uNormalMatrix", this._renderer.uNMatrix.mat3))
      }, a.default.Shader.prototype.useProgram = function() {
        return this._renderer.GL.useProgram(this._glProgram), this
      }, a.default.Shader.prototype.setUniform = function(e, t) {
        var r = this.uniforms[e];
        if (r) {
          var i = r.location,
            a = this._renderer.GL;
          switch (this.useProgram(), r.type) {
            case a.BOOL:
              !0 === t ? a.uniform1i(i, 1) : a.uniform1i(i, 0);
              break;
            case a.INT:
              1 < r.size ? t.length && a.uniform1iv(i, t) : a.uniform1i(i, t);
              break;
            case a.FLOAT:
              1 < r.size ? t.length && a.uniform1fv(i, t) : a.uniform1f(i, t);
              break;
            case a.FLOAT_MAT3:
              a.uniformMatrix3fv(i, !1, t);
              break;
            case a.FLOAT_MAT4:
              a.uniformMatrix4fv(i, !1, t);
              break;
            case a.FLOAT_VEC2:
              1 < r.size ? t.length && a.uniform2fv(i, t) : a.uniform2f(i, t[0], t[1]);
              break;
            case a.FLOAT_VEC3:
              1 < r.size ? t.length && a.uniform3fv(i, t) : a.uniform3f(i, t[0], t[1], t[2]);
              break;
            case a.FLOAT_VEC4:
              1 < r.size ? t.length && a.uniform4fv(i, t) : a.uniform4f(i, t[0], t[1], t[2], t[3]);
              break;
            case a.INT_VEC2:
              1 < r.size ? t.length && a.uniform2iv(i, t) : a.uniform2i(i, t[0], t[1]);
              break;
            case a.INT_VEC3:
              1 < r.size ? t.length && a.uniform3iv(i, t) : a.uniform3i(i, t[0], t[1], t[2]);
              break;
            case a.INT_VEC4:
              1 < r.size ? t.length && a.uniform4iv(i, t) : a.uniform4i(i, t[0], t[1], t[2], t[3]);
              break;
            case a.SAMPLER_2D:
              a.activeTexture(a.TEXTURE0 + r.samplerIndex), r.texture = this._renderer.getTexture(t), a.uniform1i(r.location, r.samplerIndex)
          }
          return this
        }
      }, a.default.Shader.prototype.isLightShader = function() {
        return void 0 !== this.attributes.aNormal || void 0 !== this.uniforms.uUseLighting || void 0 !== this.uniforms.uAmbientLightCount || void 0 !== this.uniforms.uDirectionalLightCount || void 0 !== this.uniforms.uPointLightCount || void 0 !== this.uniforms.uAmbientColor || void 0 !== this.uniforms.uDirectionalDiffuseColors || void 0 !== this.uniforms.uDirectionalSpecularColors || void 0 !== this.uniforms.uPointLightLocation || void 0 !== this.uniforms.uPointLightDiffuseColors || void 0 !== this.uniforms.uPointLightSpecularColors || void 0 !== this.uniforms.uLightingDirection || void 0 !== this.uniforms.uSpecular
      }, a.default.Shader.prototype.isTextureShader = function() {
        return 0 < this.samplerIndex
      }, a.default.Shader.prototype.isColorShader = function() {
        return void 0 !== this.attributes.aVertexColor || void 0 !== this.uniforms.uMaterialColor
      }, a.default.Shader.prototype.isTexLightShader = function() {
        return this.isLightShader() && this.isTextureShader()
      }, a.default.Shader.prototype.isStrokeShader = function() {
        return void 0 !== this.uniforms.uStrokeWeight
      }, a.default.Shader.prototype.enableAttrib = function(e, t, r, i, a, n) {
        if (e) {
          0;
          var o = e.location;
          if (-1 !== o) {
            var s = this._renderer.GL;
            s.enableVertexAttribArray(o), s.vertexAttribPointer(o, t, r || s.FLOAT, i || !1, a || 0, n || 0)
          }
        }
        return this
      };
      var n = a.default.Shader;
      r.default = n
    }, {
      "../core/main": 26
    }],
    81: [function(e, t, r) {
      "use strict";
      Object.defineProperty(r, "__esModule", {
        value: !0
      }), r.default = void 0;
      var i, a = (i = e("../core/main")) && i.__esModule ? i : {
          default: i
        },
        o = function(e) {
          {
            if (e && e.__esModule) return e;
            var t = {};
            if (null != e)
              for (var r in e)
                if (Object.prototype.hasOwnProperty.call(e, r)) {
                  var i = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(e, r) : {};
                  i.get || i.set ? Object.defineProperty(t, r, i) : t[r] = e[r]
                } return t.default = e, t
          }
        }(e("../core/constants"));
      a.default.Texture = function(e, t) {
        this._renderer = e;
        var r = this._renderer.GL;
        this.src = t, this.glTex = void 0, this.glTarget = r.TEXTURE_2D, this.glFormat = r.RGBA, this.mipmaps = !1, this.glMinFilter = r.LINEAR, this.glMagFilter = r.LINEAR, this.glWrapS = r.CLAMP_TO_EDGE, this.glWrapT = r.CLAMP_TO_EDGE, this.isSrcMediaElement = void 0 !== a.default.MediaElement && t instanceof a.default.MediaElement, this._videoPrevUpdateTime = 0, this.isSrcHTMLElement = void 0 !== a.default.Element && t instanceof a.default.Element && !(t instanceof a.default.Graphics), this.isSrcP5Image = t instanceof a.default.Image, this.isSrcP5Graphics = t instanceof a.default.Graphics, this.isImageData = "undefined" != typeof ImageData && t instanceof ImageData;
        var i = this._getTextureDataFromSource();
        return this.width = i.width, this.height = i.height, this.init(i), this
      }, a.default.Texture.prototype._getTextureDataFromSource = function() {
        var e;
        return this.isSrcP5Image ? e = this.src.canvas : this.isSrcMediaElement || this.isSrcP5Graphics || this.isSrcHTMLElement ? e = this.src.elt : this.isImageData && (e = this.src), e
      }, a.default.Texture.prototype.init = function(e) {
        var t = this._renderer.GL;
        if (this.glTex = t.createTexture(), this.glWrapS = this._renderer.textureWrapX, this.glWrapT = this._renderer.textureWrapY, this.setWrapMode(this.glWrapS, this.glWrapT), this.bindTexture(), t.texParameteri(t.TEXTURE_2D, t.TEXTURE_MAG_FILTER, this.glMagFilter), t.texParameteri(t.TEXTURE_2D, t.TEXTURE_MIN_FILTER, this.glMinFilter), 0 === this.width || 0 === this.height || this.isSrcMediaElement && !this.src.loadedmetadata) {
          var r = new Uint8Array([1, 1, 1, 1]);
          t.texImage2D(this.glTarget, 0, t.RGBA, 1, 1, 0, this.glFormat, t.UNSIGNED_BYTE, r)
        } else t.texImage2D(this.glTarget, 0, this.glFormat, this.glFormat, t.UNSIGNED_BYTE, e)
      }, a.default.Texture.prototype.update = function() {
        var e = this.src;
        if (0 === e.width || 0 === e.height) return !1;
        var t = this._getTextureDataFromSource(),
          r = !1,
          i = this._renderer.GL;
        return t.width !== this.width || t.height !== this.height ? (r = !0, this.width = t.width, this.height = t.height, this.isSrcP5Image ? e.setModified(!1) : (this.isSrcMediaElement || this.isSrcHTMLElement) && e.setModified(!0)) : this.isSrcP5Image ? e.isModified() && (r = !0, e.setModified(!1)) : this.isSrcMediaElement ? e.isModified() ? (r = !0, e.setModified(!1)) : e.loadedmetadata && this._videoPrevUpdateTime !== e.time() && (this._videoPrevUpdateTime = e.time(), r = !0) : this.isImageData ? e._dirty && (r = !(e._dirty = !1)) : r = !0, r && (this.bindTexture(), i.texImage2D(this.glTarget, 0, this.glFormat, this.glFormat, i.UNSIGNED_BYTE, t)), r
      }, a.default.Texture.prototype.bindTexture = function() {
        return this._renderer.GL.bindTexture(this.glTarget, this.glTex), this
      }, a.default.Texture.prototype.unbindTexture = function() {
        this._renderer.GL.bindTexture(this.glTarget, null)
      }, a.default.Texture.prototype.setInterpolation = function(e, t) {
        var r = this._renderer.GL;
        e === o.NEAREST ? this.glMinFilter = r.NEAREST : this.glMinFilter = r.LINEAR, t === o.NEAREST ? this.glMagFilter = r.NEAREST : this.glMagFilter = r.LINEAR, this.bindTexture(), r.texParameteri(r.TEXTURE_2D, r.TEXTURE_MIN_FILTER, this.glMinFilter), r.texParameteri(r.TEXTURE_2D, r.TEXTURE_MAG_FILTER, this.glMagFilter), this.unbindTexture()
      }, a.default.Texture.prototype.setWrapMode = function(e, t) {
        var r = this._renderer.GL,
          i = function(e) {
            return 0 == (e & e - 1)
          },
          a = i(this.width),
          n = i(this.height);
        e === o.REPEAT ? this.glWrapS = a && n ? r.REPEAT : (console.warn("You tried to set the wrap mode to REPEAT but the texture size is not a power of two. Setting to CLAMP instead"), r.CLAMP_TO_EDGE) : e === o.MIRROR ? this.glWrapS = a && n ? r.MIRRORED_REPEAT : (console.warn("You tried to set the wrap mode to MIRROR but the texture size is not a power of two. Setting to CLAMP instead"), r.CLAMP_TO_EDGE) : this.glWrapS = r.CLAMP_TO_EDGE, t === o.REPEAT ? this.glWrapT = a && n ? r.REPEAT : (console.warn("You tried to set the wrap mode to REPEAT but the texture size is not a power of two. Setting to CLAMP instead"), r.CLAMP_TO_EDGE) : t === o.MIRROR ? this.glWrapT = a && n ? r.MIRRORED_REPEAT : (console.warn("You tried to set the wrap mode to MIRROR but the texture size is not a power of two. Setting to CLAMP instead"), r.CLAMP_TO_EDGE) : this.glWrapT = r.CLAMP_TO_EDGE, this.bindTexture(), r.texParameteri(r.TEXTURE_2D, r.TEXTURE_WRAP_S, this.glWrapS), r.texParameteri(r.TEXTURE_2D, r.TEXTURE_WRAP_T, this.glWrapT), this.unbindTexture()
      };
      var n = a.default.Texture;
      r.default = n
    }, {
      "../core/constants": 20,
      "../core/main": 26
    }],
    82: [function(e, t, r) {
      "use strict";
      var i, j = (i = e("../core/main")) && i.__esModule ? i : {
          default: i
        },
        P = function(e) {
          {
            if (e && e.__esModule) return e;
            var t = {};
            if (null != e)
              for (var r in e)
                if (Object.prototype.hasOwnProperty.call(e, r)) {
                  var i = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(e, r) : {};
                  i.get || i.set ? Object.defineProperty(t, r, i) : t[r] = e[r]
                } return t.default = e, t
          }
        }(e("../core/constants"));
      e("./p5.Shader"), e("./p5.RendererGL.Retained"), j.default.RendererGL.prototype._applyTextProperties = function() {}, j.default.RendererGL.prototype.textWidth = function(e) {
        return this._isOpenType() ? this._textFont._textWidth(e, this._textSize) : 0
      };

      function a(e, t) {
        this.width = e, this.height = t, this.infos = [], this.findImage = function(e) {
          var t, r, i = this.width * this.height;
          if (i < e) throw new Error("font is too complex to render in 3D");
          for (var a = this.infos.length - 1; 0 <= a; --a) {
            var n = this.infos[a];
            if (n.index + e < i) {
              r = (t = n).imageData;
              break
            }
          }
          if (!t) {
            try {
              r = new ImageData(this.width, this.height)
            } catch (e) {
              var o = document.getElementsByTagName("canvas")[0],
                s = !o;
              o || ((o = document.createElement("canvas")).style.display = "none", document.body.appendChild(o));
              var l = o.getContext("2d");
              l && (r = l.createImageData(this.width, this.height)), s && document.body.removeChild(o)
            }
            t = {
              index: 0,
              imageData: r
            }, this.infos.push(t)
          }
          var u = t.index;
          return t.index += e, r._dirty = !0, {
            imageData: r,
            index: u
          }
        }
      }

      function V(e, t, r, i, a) {
        var n = e.imageData.data,
          o = 4 * e.index++;
        n[o++] = t, n[o++] = r, n[o++] = i, n[o++] = a
      }
      var z = Math.sqrt(3),
        L = function(e) {
          this.font = e, this.strokeImageInfos = new a(64, 64), this.colDimImageInfos = new a(64, 64), this.rowDimImageInfos = new a(64, 64), this.colCellImageInfos = new a(64, 64), this.rowCellImageInfos = new a(64, 64), this.glyphInfos = {}, this.getGlyphInfo = function(e) {
            var t = this.glyphInfos[e.index];
            if (t) return t;
            var r, i = e.getBoundingBox(),
              a = i.x1,
              n = i.y1,
              o = i.x2 - a,
              s = i.y2 - n,
              l = e.path.commands;
            if (0 === o || 0 === s || !l.length) return this.glyphInfos[e.index] = {};
            var u, h, d, c, f = [],
              p = [],
              m = [];
            for (r = 8; 0 <= r; --r) m.push([]);
            for (r = 8; 0 <= r; --r) p.push([]);

            function v(e, t, r) {
              var i = f.length;

              function a(e, t, r) {
                for (var i = e.length; 0 < i--;) {
                  var a = e[i];
                  a < t && (t = a), r < a && (r = a)
                }
                return {
                  min: t,
                  max: r
                }
              }
              f.push(r);
              for (var n = a(e, 1, 0), o = Math.max(Math.floor(9 * n.min), 0), s = Math.min(Math.ceil(9 * n.max), 9), l = o; l < s; ++l) m[l].push(i);
              for (var u = a(t, 1, 0), h = Math.max(Math.floor(9 * u.min), 0), d = Math.min(Math.ceil(9 * u.max), 9), c = h; c < d; ++c) p[c].push(i)
            }

            function g(e) {
              return (t = (i = 255) * e) < (r = 0) ? r : i < t ? i : t;
              var t, r, i
            }

            function w(e, t, r, i) {
              this.p0 = e, this.c0 = t, this.c1 = r, this.p1 = i, this.toQuadratic = function() {
                return {
                  x: this.p0.x,
                  y: this.p0.y,
                  x1: this.p1.x,
                  y1: this.p1.y,
                  cx: (3 * (this.c0.x + this.c1.x) - (this.p0.x + this.p1.x)) / 4,
                  cy: (3 * (this.c0.y + this.c1.y) - (this.p0.y + this.p1.y)) / 4
                }
              }, this.quadError = function() {
                return j.default.Vector.sub(j.default.Vector.sub(this.p1, this.p0), j.default.Vector.mult(j.default.Vector.sub(this.c1, this.c0), 3)).mag() / 2
              }, this.split = function(e) {
                var t = j.default.Vector.lerp(this.p0, this.c0, e),
                  r = j.default.Vector.lerp(this.c0, this.c1, e),
                  i = j.default.Vector.lerp(t, r, e);
                this.c1 = j.default.Vector.lerp(this.c1, this.p1, e), this.c0 = j.default.Vector.lerp(r, this.c1, e);
                var a = j.default.Vector.lerp(i, this.c0, e),
                  n = new w(this.p0, t, i, a);
                return this.p0 = a, n
              }, this.splitInflections = function() {
                var e = j.default.Vector.sub(this.c0, this.p0),
                  t = j.default.Vector.sub(j.default.Vector.sub(this.c1, this.c0), e),
                  r = j.default.Vector.sub(j.default.Vector.sub(j.default.Vector.sub(this.p1, this.c1), e), j.default.Vector.mult(t, 2)),
                  i = [],
                  a = t.x * r.y - t.y * r.x;
                if (0 !== a) {
                  var n = e.x * r.y - e.y * r.x,
                    o = e.x * t.y - e.y * t.x,
                    s = n * n - 4 * a * o;
                  if (0 <= s) {
                    a < 0 && (a = -a, n = -n, o = -o);
                    var l = Math.sqrt(s),
                      u = (-n - l) / (2 * a),
                      h = (-n + l) / (2 * a);
                    0 < u && u < 1 && (i.push(this.split(u)), h = 1 - (1 - h) / (1 - u)), 0 < h && h < 1 && i.push(this.split(h))
                  }
                }
                return i.push(this), i
              }
            }

            function y(e, t, r, i, a, n, o, s) {
              var l = new w(new j.default.Vector(e, t), new j.default.Vector(r, i), new j.default.Vector(a, n), new j.default.Vector(o, s)).splitInflections(),
                u = [],
                h = 30 / z,
                d = !0,
                c = !1,
                f = void 0;
              try {
                for (var p, m = l[Symbol.iterator](); !(d = (p = m.next()).done); d = !0) {
                  for (var v = p.value, g = [], y = void 0; !(.125 <= (y = h / v.quadError()));) {
                    var _ = Math.pow(y, 1 / 3),
                      b = v.split(_),
                      x = v.split(1 - _ / (1 - _));
                    u.push(b), g.push(v), v = x
                  }
                  y < 1 && u.push(v.split(.5)), u.push(v), Array.prototype.push.apply(u, g.reverse())
                }
              } catch (e) {
                c = !0, f = e
              } finally {
                try {
                  d || null == m.return || m.return()
                } finally {
                  if (c) throw f
                }
              }
              return u
            }

            function _(e, t, r, i) {
              v([e, r], [t, i], {
                x: e,
                y: t,
                cx: (e + r) / 2,
                cy: (t + i) / 2
              })
            }

            function b(e, t, r, i) {
              return Math.abs(r - e) < 1e-5 && Math.abs(i - t) < 1e-5
            }
            var x = !0,
              S = !1,
              M = void 0;
            try {
              for (var E, T = l[Symbol.iterator](); !(x = (E = T.next()).done); x = !0) {
                var C = E.value,
                  P = (C.x - a) / o,
                  L = (C.y - n) / s;
                if (!b(u, h, P, L)) {
                  switch (C.type) {
                    case "M":
                      d = P, c = L;
                      break;
                    case "L":
                      _(u, h, P, L);
                      break;
                    case "Q":
                      var R = (C.x1 - a) / o,
                        O = (C.y1 - n) / s;
                      v([u, P, R], [h, L, O], {
                        x: u,
                        y: h,
                        cx: R,
                        cy: O
                      });
                      break;
                    case "Z":
                      b(u, h, d, c) ? f.push({
                        x: u,
                        y: h
                      }) : (_(u, h, d, c), f.push({
                        x: d,
                        y: c
                      }));
                      break;
                    case "C":
                      for (var D = y(u, h, (C.x1 - a) / o, (C.y1 - n) / s, (C.x2 - a) / o, (C.y2 - n) / s, P, L), A = 0; A < D.length; A++) {
                        var I = D[A].toQuadratic();
                        v([I.x, I.x1, I.cx], [I.y, I.y1, I.cy], I)
                      }
                      break;
                    default:
                      throw new Error("unknown command type: ".concat(C.type))
                  }
                  u = P, h = L
                }
              }
            } catch (e) {
              S = !0, M = e
            } finally {
              try {
                x || null == T.return || T.return()
              } finally {
                if (S) throw M
              }
            }
            for (var k = f.length, U = this.strokeImageInfos.findImage(k), F = U.index, N = 0; N < k; ++N) {
              var B = f[N];
              V(U, g(B.x), g(B.y), g(B.cx), g(B.cy))
            }

            function G(e, t, r) {
              for (var i = e.length, a = t.findImage(i), n = a.index, o = 0, s = 0; s < i; ++s) o += e[s].length;
              for (var l = r.findImage(o), u = 0; u < i; ++u) {
                var h = e[u],
                  d = h.length,
                  c = l.index;
                V(a, c >> 7, 127 & c, d >> 7, 127 & d);
                for (var f = 0; f < d; ++f) {
                  var p = h[f] + F;
                  V(l, p >> 7, 127 & p, 0, 0)
                }
              }
              return {
                cellImageInfo: l,
                dimOffset: n,
                dimImageInfo: a
              }
            }
            return (t = this.glyphInfos[e.index] = {
              glyph: e,
              uGlyphRect: [i.x1, -i.y1, i.x2, -i.y2],
              strokeImageInfo: U,
              strokes: f,
              colInfo: G(m, this.colDimImageInfos, this.colCellImageInfos),
              rowInfo: G(p, this.rowDimImageInfos, this.rowCellImageInfos)
            }).uGridOffset = [t.colInfo.dimOffset, t.rowInfo.dimOffset], t
          }
        };
      j.default.RendererGL.prototype._renderText = function(e, t, r, i, a) {
        if (this._textFont && "string" != typeof this._textFont) {
          if (!(a <= i) && this._doFill) {
            if (!this._isOpenType()) return console.log("WEBGL: only Opentype (.otf) and Truetype (.ttf) fonts are supported"), e;
            e.push();
            var n = this._doStroke,
              o = this.drawMode;
            this._doStroke = !1, this.drawMode = P.TEXTURE;
            var s = this._textFont.font,
              l = this._textFont._fontInfo;
            l || (l = this._textFont._fontInfo = new L(s));
            var u = this._textFont._handleAlignment(this, t, r, i),
              h = this._textSize / s.unitsPerEm;
            this.translate(u.x, u.y, 0), this.scale(h, h, 1);
            var d = this.GL,
              c = !this._defaultFontShader,
              f = this._getFontShader();
            f.init(), f.bindShader(), c && (f.setUniform("uGridImageSize", [64, 64]), f.setUniform("uCellsImageSize", [64, 64]), f.setUniform("uStrokeImageSize", [64, 64]), f.setUniform("uGridSize", [9, 9])), this._applyColorBlend(this.curFillColor);
            var p = this.gHash.glyph;
            if (!p) {
              var m = this._textGeom = new j.default.Geometry(1, 1, function() {
                for (var e = 0; e <= 1; e++)
                  for (var t = 0; t <= 1; t++) this.vertices.push(new j.default.Vector(t, e, 0)), this.uvs.push(t, e)
              });
              m.computeFaces().computeNormals(), p = this.createBuffers("glyph", m)
            }
            this._prepareBuffers(p, f, j.default.RendererGL._textBuffers), this._bindBuffer(p.indexBuffer, d.ELEMENT_ARRAY_BUFFER), f.setUniform("uMaterialColor", this.curFillColor);
            try {
              var v = 0,
                g = null,
                y = s.stringToGlyphs(t),
                _ = !0,
                b = !1,
                x = void 0;
              try {
                for (var w, S = y[Symbol.iterator](); !(_ = (w = S.next()).done); _ = !0) {
                  var M = w.value;
                  g && (v += s.getKerningValue(g, M));
                  var E = l.getGlyphInfo(M);
                  if (E.uGlyphRect) {
                    var T = E.rowInfo,
                      C = E.colInfo;
                    f.setUniform("uSamplerStrokes", E.strokeImageInfo.imageData), f.setUniform("uSamplerRowStrokes", T.cellImageInfo.imageData), f.setUniform("uSamplerRows", T.dimImageInfo.imageData), f.setUniform("uSamplerColStrokes", C.cellImageInfo.imageData), f.setUniform("uSamplerCols", C.dimImageInfo.imageData), f.setUniform("uGridOffset", E.uGridOffset), f.setUniform("uGlyphRect", E.uGlyphRect), f.setUniform("uGlyphOffset", v), f.bindTextures(), d.drawElements(d.TRIANGLES, 6, this.GL.UNSIGNED_SHORT, 0)
                  }
                  v += M.advanceWidth, g = M
                }
              } catch (e) {
                b = !0, x = e
              } finally {
                try {
                  _ || null == S.return || S.return()
                } finally {
                  if (b) throw x
                }
              }
            } finally {
              f.unbindShader(), this._doStroke = n, this.drawMode = o, e.pop()
            }
            return e
          }
        } else console.log("WEBGL: you must load and set a font before drawing text. See `loadFont` and `textFont` for more details.")
      }
    }, {
      "../core/constants": 20,
      "../core/main": 26,
      "./p5.RendererGL.Retained": 78,
      "./p5.Shader": 80
    }]
  }, {}, [15])(15)
});