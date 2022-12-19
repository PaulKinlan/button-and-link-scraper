import puppeteer from "puppeteer";
import minimist from "minimist";  
import { v4 as uuidv4 } from "uuid";

const log = (str) => process.stdout.write(str);

async function navigate(browser, url) {
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "networkidle2" });
  return page;
}

async function extractLinks(page) {
  // Extract the results from the page.
  const anchors = await page.$$("a:not(:has(img))"); // text links...
  const output = [];

  for (const anchor of anchors) {
    const bounding = await anchor.boundingBox();
    if (bounding != null) {
      const rect = await page.evaluate((el) => {
        const { x, y, width, height } = el.getBoundingClientRect();
        return { x: x - 10, y: y - 10, width: width + 20, height: height + 20 };
      }, anchor);

      output.push([
        await page.screenshot({
          clip: rect,
          path: `./data/images/links/${uuidv4()}.png`,
        }),
      ]);
    }
  }

  return output;
}

async function extractButtons(page) {
  const buttons = await page.$$(
    "button, input[type='button'], input[type='submit'], input[type='reset'] "
  );
  const output = [];

  for (const button of buttons) {
    const bounding = await button.boundingBox();
    if (bounding != null) {
      const rect = await page.evaluate((el) => {
        const { x, y, width, height } = el.getBoundingClientRect();
        return { x: x - 10, y: y - 10, width: width + 20, height: height + 20  }; // w + h + 20 because x and y are -10
      }, button);

      output.push([
        await page.screenshot({
          clip: rect,
          path: `./data/images/buttons/${uuidv4()}.png`,
        }),
      ]);
    }
  }

  return output;
}

async function get(urls = [], browser) {
  const results = { allButtons: {}, allLinks: {} };
  for (let urlIdx = 0; urlIdx < urls.length; urlIdx++) {
    const url = urls[urlIdx];
    log(`Fetching ${urlIdx +1 }/${urls.length + 1} ${url}`);
    
    const page = await navigate(browser, url);
    results.allButtons[url] = await extractButtons(page);
    results.allLinks[url] = await extractLinks(page);

    log(`. Done. Buttons: ${results.allButtons[url].length},  Links: ${results.allLinks[url].length}\n`);
    await page.close();
  }
  return results;
}

async function init(urls) {
  const browser = await puppeteer.launch();

  const results = await get(urls, browser);

  browser.close();

  return "done";
}

const args = minimist(process.argv.slice(2));

init(args.url).then(console.log());
