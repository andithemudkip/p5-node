# p5-node

### What is this?

A Node.js implementation of the [p5.js][p5js] library.
(using `node-canvas` and `jsdom`, along with a bunch of other modules)

### FAQ

Why?

> yes

Does everything from p5 work?

> most things work, except for stuff like 3D (webgl is not a thing in node), interacting with the canvas (mouse, keyboard, window events) - because, duh, there's no window, and certain things that i didn't feel like implementing because there are a bunch of better alternatives for Node (like httpDo, httpGet, and httpPost can be easily replaced by just using `request` or `axios`)

Is the syntax the same?

> for most things, yes - you can find the docs below for the features that are different from the official p5 browser library

## Installing

```shell
$ npm i --s p5-node
```

## Getting Started

All p5 methods must be preceded by the variable you pass to the sketch function.

```js
const p5 = require('p5-node');

function sketch(p) {
    p.setup = () => {
        p.createCanvas(200, 200);
    }
    p.draw = () => {
        p.background(50);
        p.text('hello world!', 50, 100);
    }
}

let p5Instance = p5.createSketch(sketch);

```

Of course, we can't see this because there is no window, so we should save the canvas as an image.

```js
const p5 = require('p5-node');

function sketch(p) {
    p.setup = () => {
        let canvas = p.createCanvas(200, 200);
        setTimeout(() => {
            p.saveCanvas(canvas, 'myCanvas', 'png').then(filename => {
                console.log(`saved the canvas as ${filename}`);
            });
        }, 100);
    }
    p.draw = () => {
        p.background(50);
        p.text('hello world!', 50, 100);
    }
}

let p5Instance = p5.createSketch(sketch);
```

## Preloading

I couldn't get the p5 preload to work. I wrote my own version.

#### Basic usage

You can pass the [built-in preload functions](#Built-in preload functions)

```js
const p5 = require('p5-node');

let resourcesToPreload = {
    catImage: p5.loadImage('cat.png')
}

function sketch(p, preloaded) {
    let catImg = preloaded.catImage;
    p.setup = () => {
        let canvas = p.createCanvas(100, 100);
        p.image(catImg, 20, 20, 60, 60);
        
        p.saveCanvas(canvas, 'out', 'png').then(() => {
            console.log('saved canvas as out.png');
        }).catch(console.error)

        p.noLoop();
    }
}

let p5Instance = p5.createSketch(sketch, resourcesToPreload);
```

or you can pass in your own functions (both sync and async work!)

```js
let resourcesToPreload = {
    myVar: () => {
        return 5+2;
    },
    myVar2: () => {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                resolve('thing');
            }, 500);
        });
    },
    myVar3: new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve('thing');
        }, 500);
    })
}
```

## Fonts

### !! make sure you load fonts before creating the sketch !!

> "Why can I not use `loadFont` in preload?" - you might ask
>
> > and the answer to that is: because I couldn't get it to work lmao

Loading custom fonts can be done using the `loadFont` method

```js
p5.loadFont({ path: String, family: String})
//or
p5.loadFont(filename: String)
```

example:

```js
const p5 = require('p5-node');

let sugarpunch;
sugarpunch = p5.loadFont({ path: 'SugarpunchDEMO.otf', family: 'Sugarpunch' });
//OR
sugarpunch = p5.loadFont('SugarpunchDEMO.otf');

function sketch(p) {
    p.setup = () => {
        let canvas = p.createCanvas(100, 100);
        p.textFont(sugarpunch); // or p.textFont('Sugarpunch')
        p.text('some text using the font', 20, 20);
        
        p.saveCanvas(canvas, 'out', 'png').then(f => {
            console.log(`saved canvas as ${f}`);
        }).catch(console.error)

        p.noLoop();
    }
}

let p5Instance = p5.createSketch(sketch);

```



## Built-in preload functions

note: when passed as preload functions to p5.createSketch you shouldn't use the callback; otherwise, if you're using them inside your sketch you can either use the callback or `.then` as they return promises.

note2: when using them in preload they are methods of the `p5` object, when using them inside your sketch they are methods of the `p` (in my case) object.

### loadImage

> `loadImage(filename: String[, callback: Function])`

returns: Promise

### loadJSON

> `loadJSON(filename: String[, callback: Function]);`

returns: Promise

### loadStrings

> `loadStrings(filename: String[, callback: Function]);`

returns: Promise



## Built-in save functions

### saveCanvas

> `saveCanvas(canvas: Canvas, filename: String [, extension: String])`

returns: Promise

### saveFrames

Saves the frames as `png` or `jpg` in the output folder with names like `frame-001.png`, or as a gif with the name of the folder.

> `saveFrames(canvas: Canvas, outFolder: String, extension: String, duration: Number, frameRate: Number)`

- extension - `png` or `jpg`
- duration - duration in seconds for how long to capture

> `saveFrames(canvas: Canvas, outFolder: String, options: Object, duration: Number, frameRate: Number)`

by replacing the extension with an object we are saving the animation as a gif

available options:

- repeat (0 for repeat, -1 for no repeat)
- quality (0 - 10) - the quality of the gif

returns: Promise

### saveJSON

Saves an Object as a JSON file

> `saveJSON(object: Object, filename: String[, optimize: Boolean])`

- object - the JavaScript object that you are saving
- filename - the filename
- optimize - If true, removes line breaks and spaces from the output file to optimize file size (but not readability). [default: false]

returns: Promise

### saveStrings

Saves an array of strings as a file

> `saveStrings(list: Array, filename: String[, extension: String, separator: String])`

- list - the JavaScript array that you are saving
- filename - the filename
- extension - the file extension [default: txt]
- separator - what to separate the items of the array with [default: `\n` (new line)]

returns: Promise

## Registering your own methods

`p5.registerMethod(name: String, method: Function)`

```js
p5.registerMethod('addNumbers', (x, y) => {
   return x + y; 
});
...
function sketch(p) {
    p.setup = () => {
        console.log(p.addNumbers(20, 5)); //25
        p.noLoop();
    }
}
```

Don't use arrow notation if you want to use p5 features in your methods. If you use arrow notation the module cannot bind p5 to your method and thus you won't be able to use it.

```js
p5.registerMethod('methodName', (arg1, arg2) => {
    console.log(this.p5); //undefined
});

p5.registerMethod('methodName', function(arg1, arg2) {
    console.log(this.p5); //the p5 object (with all the methods)
});
```

The following strings can be passed to `registerMethod` instead of the method name to affect when that method is automatically called.

- **pre** — Called at the beginning of `draw()`. It can affect drawing.
- **post** — Called at the end of `draw()`.
- **init** — Called when the sketch is first initialized, just before the sketch initialization function (the one that was passed into the `p5`constructor) is executed.

Example:

```js
p5.registerMethod('init', () => {
    console.log('called when initialization is finished');
});

p5.registerMethod('pre', () => {
    console.log('every frame, at the start of draw');
});

p5.registerMethod('post', () => {
    console.log('every frame, at the end of draw');
});
```



## Registering your own plugins

Want to create your own plugins? I've got you covered fam.

```js
//myp5Plugin.js
module.exports = {
    mapNumbers: function(arg1, arg2, arg3, arg4, arg5) {
        return this.p5.map(arg1, arg2, arg3, arg4, arg5);
    }
}
```

```js
let p5 = require('p5-node');
p5.registerPlugin(require('./myp5Plugin'));

function sketch(p) {
    p.setup = () => {
        console.log(p.mapNumbers(5, 1, 10, 1, 100)); //45
        p.noLoop();
    }
}

let p5Instance = p5.createSketch(sketch);
```





[p5js]: https://p5js.org	"p5 js"