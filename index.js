const benchmark = require('nodemark');
const fs = require('fs');
const binaryPNG = fs.readFileSync('../ImageScript/tests/targets/image.png');
const binaryJPEG = fs.readFileSync('../ImageScript/tests/targets/external.jpg');

const Jimp = require('jimp');
const ImageScript = require('../ImageScript');
const canvas = require('canvas');

(async () => {
    const decoded = {
        ImageScript: await ImageScript.Image.decode(binaryPNG),
        Jimp: await Jimp.read(binaryPNG),
        Canvas: await (async () => {
            const image = await canvas.loadImage(binaryPNG);
            const c = canvas.createCanvas(image.width, image.height);
            const ctx = c.getContext('2d');
            ctx.drawImage(image, 0, 0);
            return c;
        })()
    };

    const overlays = {
        ImageScript: new ImageScript.Image(decoded.ImageScript.width, decoded.ImageScript.height),
        Jimp: new Jimp(decoded.Jimp.bitmap.width, decoded.Jimp.bitmap.height),
        Canvas: await canvas.createCanvas(decoded.Canvas.width, decoded.Canvas.height)
    };

    const overlayColors = [0xff001880, 0xffa52c80, 0xffff4180, 0x00801880, 0x0000f980, 0x86007d80];

    overlays.ImageScript.fill((x, y) => overlayColors[~~(y / overlays.ImageScript.height * overlayColors.length)]);

    overlays.Jimp.scan(0, 0, overlays.Jimp.bitmap.width, overlays.Jimp.bitmap.height, (x, y, idx) => {
        const color = ImageScript.Image.colorToRGBA(overlayColors[~~(y / overlays.ImageScript.height * overlayColors.length)]);
        for (let i = 0; i < 4; i++)
            overlays.Jimp.bitmap[idx + i] = color[i];
    });

    {
        const ctx = overlays.Canvas.getContext('2d');
        for (let i = 0; i < overlayColors.length; i++) {
            const [r, g, b, a] = ImageScript.Image.colorToRGBA(overlayColors[i]);
            ctx.beginPath();
            ctx.fillRect(0, overlays.Canvas.height * (i / overlayColors.length), overlays.Canvas.width, overlays.Canvas.height / overlayColors.length);
            ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
            ctx.closePath();
        }
    }

    const tests = {
        create: {
            ImageScript: async () => new ImageScript.Image(1024, 1024),
            Jimp: async () => new Jimp(1024, 1024),
            Canvas: async () => canvas.createCanvas(1024, 1024)
        },
        decode_png: {
            ImageScript: ImageScript.Image.decode.bind(ImageScript.Image, binaryPNG),
            Jimp: Jimp.read.bind(Jimp, binaryPNG),
            Canvas: async () => {
                const image = await canvas.loadImage(binaryPNG);
                const c = canvas.createCanvas(image.width, image.height);
                const ctx = c.getContext('2d');
                ctx.drawImage(image, 0, 0);
            }
        },
        decode_jpeg: {
            ImageScript: ImageScript.Image.decode.bind(ImageScript.Image, binaryJPEG),
            Jimp: Jimp.read.bind(Jimp, binaryJPEG),
            Canvas: async () => {
                const image = await canvas.loadImage(binaryJPEG);
                const c = canvas.createCanvas(image.width, image.height);
                const ctx = c.getContext('2d');
                ctx.drawImage(image, 0, 0);
            }
        },
        encode_png: {
            ImageScript: decoded.ImageScript.encode.bind(decoded.ImageScript),
            Jimp: decoded.Jimp.getBufferAsync.bind(decoded.Jimp, 'image/png'),
            Canvas: async () => decoded.Canvas.toBuffer()
        },
        encode_jpeg: {
            ImageScript: decoded.ImageScript.encodeJPEG.bind(decoded.ImageScript),
            Jimp: decoded.Jimp.getBufferAsync.bind(decoded.Jimp, 'image/jpeg'),
            Canvas: async () => decoded.Canvas.toBuffer('image/jpeg')
        },
        composite: {
            ImageScript: async () => decoded.ImageScript.clone().composite(overlays.ImageScript),
            Jimp: async () => decoded.Jimp.clone().composite(overlays.Jimp, 0, 0),
            Canvas: async () => {
                // recommended way of cloning a canvas..
                const newCanvas = canvas.createCanvas(decoded.Canvas.width, decoded.Canvas.height);
                const ctx = newCanvas.getContext('2d');
                ctx.drawImage(decoded.Canvas, 0, 0);

                ctx.drawImage(overlays.Canvas, 0, 0);
            }
        },
        fill_static: {
            ImageScript: async () => new ImageScript.Image(1024, 1024).fill(0xffffffff),
            Jimp: async () => new Jimp(1024, 1024, 0xffffffff),
            Canvas: async () => {
                const c = canvas.createCanvas(1024, 1024);
                const ctx = c.getContext('2d');
                ctx.fillRect(0, 0, 1024, 1024);
            }
        },
        fill_func: {
            ImageScript: async () => new ImageScript.Image(1024, 1024).fill((x, y) => (x + y) / (1024 + 1024)),
            Jimp: async () => {
                const image = new Jimp(1024, 1024);
                image.scan(0, 0, image.bitmap.width, image.bitmap.height, (x, y, idx) => {
                    const color = (x + y) / (1024 + 1024);
                    const rgba = [color >> 24 & 0xff, color >> 16 & 0xff, color >> 8 & 0xff, color & 0xff]
                    for (let i = 0; i < 4; i++)
                        overlays.Jimp.bitmap[idx + i] = rgba[i];
                });
            },
            Canvas: async () => {
                // maybe unfair, canvas isn't designed for bitmap operations
                const c = canvas.createCanvas(1024, 1024);
                const ctx = c.getContext('2d');
                for (let x = 0; x < c.width; x++) {
                    for (let y = 0; y < c.height; y++) {
                        const color = (x + y) / (1024 + 1024);
                        const [r, g, b, a] = ImageScript.Image.colorToRGBA(color);

                        ctx.beginPath();
                        ctx.fillRect(x, y, 1, 1);
                        ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
                        ctx.closePath();
                    }
                }
            }
        },
        set_channel: {
            ImageScript: async () => decoded.ImageScript.clone().opacity(.5, true),
            Jimp: async () => decoded.Jimp.clone().opacity(.5)
        },
        clone: {
            ImageScript: async () => decoded.ImageScript.clone(),
            Jimp: async () => decoded.Jimp.clone(),
            Canvas: async () => {
                const newCanvas = canvas.createCanvas(decoded.Canvas.width, decoded.Canvas.height);
                const ctx = newCanvas.getContext('2d');
                ctx.drawImage(decoded.Canvas, 0, 0);
            }
        },
        crop: {
            ImageScript: async () => decoded.ImageScript.clone().crop(16, 16, 16, 16),
            Jimp: async () => decoded.Jimp.clone().crop(16, 16, 16, 16),
            Canvas: async () => {
                const newCanvas = canvas.createCanvas(16, 16);
                const ctx = newCanvas.getContext('2d');
                ctx.drawImage(decoded.Canvas, -16, -16);
            }
        }
    };

    const results = {};
    let t = 0;
    const c = Object.keys(tests).map(k => Object.keys(tests[k]).length).reduce((a, b) => a + b, 0);
    for (const [test, runners] of Object.entries(tests)) {
        results[test] = {};

        for (const [name, fn] of Object.entries(runners)) {
            process.stdout.write(`running tests, ${Math.round(t / c * 100)}% done\r`);
            const result = await benchmark(callback => fn().then(() => callback()).catch(err => callback(err)));
            results[test][name] = Math.round(1000000000 / result.mean * 100) / 100;
            t++;

            await new Promise(r => setTimeout(r, 3000));
        }
    }

    process.stdout.clearLine();

    let str = '';
    const orig = process.stdout.write;
    process.stdout.write = msg => str += msg;

    console.log('ImageScript Benchmark');
    console.log('operations per second');
    console.table(results);

    process.stdout.write = orig;

    console.log(str);

    const cleanStr = str.replace(/\x1b\[\d+m/g, '');
    fs.writeFileSync('README.md', `# ImageScript benchmark\n\n\`\`\`\n${cleanStr.split('\n').slice(1, Infinity).join('\n').replace(/\n/g, '  \n')}\`\`\``);
    fs.writeFileSync('results.json', JSON.stringify(results));

    const font = fs.readFileSync('C:\\Windows\\Fonts\\consola.ttf');
    const text = await ImageScript.Image.renderText(font, 128, cleanStr, 0x000000ff);
    const img = new ImageScript.Image(text.width, text.height);
    img.fill(0xffffffff);
    img.composite(text);
    const enc = await img.encode();
    fs.writeFileSync('results.png', enc);
})();