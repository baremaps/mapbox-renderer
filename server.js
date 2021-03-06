let request = require('request');
let express = require('express');
let sharp = require('sharp');
let mbgl = require('@mapbox/mapbox-gl-native');
const puppeteer = require('puppeteer');

let app = express();
let port = 8080;

app.use(express.static('public'));

app.get('/map', (req, response) => {
    let style = req.query.style;
    let ratio = parseFloat(req.query.ratio);
    let width = parseInt(req.query.width);
    let height = parseInt(req.query.height);
    let lon = parseFloat(req.query.lon);
    let lat = parseFloat(req.query.lat);
    let zoom = parseInt(req.query.zoom);
    let bearing = parseInt(req.query.bearing);
    let pitch = parseInt(req.query.pitch);

    request({
        url: style
    }, function (err, res, body) {
        let map = new mbgl.Map({
            ratio: ratio,
            request: function (req, callback) {
                request({
                    url: req.url,
                    encoding: null,
                    gzip: true
                }, function (err, res, body) {
                    if (err) {
                        callback(err);
                    } else if (res.statusCode == 200) {
                        let response = {};
                        if (res.headers.modified) { response.modified = new Date(res.headers.modified); }
                        if (res.headers.expires) { response.expires = new Date(res.headers.expires); }
                        if (res.headers.etag) { response.etag = res.headers.etag; }
                        response.data = body;
                        callback(null, response);
                    } else {
                        callback(new Error(JSON.parse(body).message));
                    }
                });
            },
        });
        map.load(body);
        map.render({
            zoom: zoom,
            center: [lat, lon],
            width: width,
            height: height,
            bearing: bearing,
            pitch: pitch
        }, function (err, buffer) {
            if (err) throw err;
            map.release();
            let image = sharp(buffer, {
                raw: {
                    width: width * ratio,
                    height: height * ratio,
                    channels: 4
                }
            });
            response.set('Content-Type', 'image/png')
            image.png().pipe(response);
        });
    });
});

app.get('/report', async (req, response) => {
    let url = req.query.url;
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url, {waitUntil: 'networkidle0'});
    let pdf = await page.pdf({format: 'A4',
    displayHeaderFooter: true,
    headerTemplate: `
    <div style="font-size: 10px; padding-top: 5px; text-align: center; width: 100%;">
      <span>Camptocamp Demo Report</span>
    </div>
    `,
    footerTemplate: `
    <div style="font-size: 10px; padding-top: 5px; text-align: center; width: 100%;">
      <span><span class="pageNumber"></span>
    </div>
    `});
    await browser.close();
    response.set('Content-Type', 'application/pdf');
    response.send(pdf);
});


app.listen(port, () => console.log(`App listening on port ${port}!`));
