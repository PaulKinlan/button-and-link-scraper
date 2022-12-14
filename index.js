import puppeteer from "puppeteer";
import { v4 as uuidv4 } from "uuid";

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
        return { x, y, width, height };
      }, anchor);

      output.push([
        await page.screenshot({
          clip: rect,
          path: `./images/links/${uuidv4()}.png`,
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
        return { x, y, width, height };
      }, button);

      output.push([
        await page.screenshot({
          clip: rect,
          path: `./images/buttons/${uuidv4()}.png`,
        }),
      ]);
    }
  }

  return output;
}

async function get(urls = [], browser) {
  const results = { allButtons: {}, allLinks: {} };
  for (const url of urls) {
    const page = await navigate(browser, url);
    results.allButtons[url] = await extractButtons(page);
    results.allLinks[url] = await extractLinks(page);
    await page.close();
  }
  return results;
}

async function init() {
  const browser = await puppeteer.launch();

  const results = await get(["https://www.eurosport.fr/"], browser);

  browser.close();

  return "done";
}

init().then(console.log());