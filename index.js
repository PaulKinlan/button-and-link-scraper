import puppeteer from "puppeteer";
import { v4 as uuidv4 } from 'uuid';


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
    output.push([await anchor.screenshot({ path: `./images/links/${uuidv4()}.png`})]);
  }

  return output;
}

async function extractButtons(page) {
  const buttons = await page.$$(
    "button, input[type='button'], input[type='submit'] "
  );
  const output = [];

  for (const button of buttons) {
    output.push([await button.screenshot({ path: `./images/buttons/${uuidv4()}.png`})]);
  }

  return output;
}

async function get(urls = [], browser) {
  const results = { allButtons: {}, allLinks: {} };
  for (const url of urls) {
    const page = await navigate(browser, url);
    results.allButtons[url] = await extractButtons(page);
    results.allLinks[url] = await extractLinks(page);
    page.close();
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
