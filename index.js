import puppeteer from "puppeteer";
import minimist from "minimist";
import { v4 as uuidv4 } from "uuid";

const log = (str) => process.stdout.write(str);

async function navigate(browser, url) {
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: "load" });

    page.on("console", (msg) => console.log(msg.text()));
    page.addStyleTag({ content: "* { scroll-behavior: auto !important; }" });

    return page;
  } catch (e) {
    if (page != null) page.close();
    return null;
  }
}

async function extractLinks(page) {
  // Extract the results from the page.
  const anchors = await page.$$("a:not(:has(img))"); // text links only
  const output = [];

  for (const anchor of anchors) {
    const bounding = await anchor.boundingBox();
    if (bounding != null) {
      const rect = await page.evaluate((el) => {
        el.scrollIntoView({
          behavior: "auto",
          block: "center",
          inline: "center",
        });
        const { x, y, width, height } = el.getBoundingClientRect();
        const elements = document.elementsFromPoint(
          x + width / 2,
          y + height / 2
        );

        // We only want the link where it is in the chain of elements. (likely visible from the current point.)
        if (elements.indexOf(el) == 0) {
          // > -1
          return {
            x: Math.max(window.scrollX + x - 10, 0),
            y: Math.max(window.scrollY + y - 10, 0),
            width: width + 20,
            height: height + 20,
          };
        }
        // We ignore these later.
        return { width: 0, height: 0 };
      }, anchor);

      if (rect.width == 0 || rect.height == 0) continue; // skip small links (like the ones in the footer) - 50 because we added 20 to the width and height and 30 is probably the smallest link

      const uuid = uuidv4();
      output.push([
        await page.screenshot({
          clip: rect,
          path: `./data/images/text-links/${uuid}.png`,
        }),
      ]);

      await anchor.hover();

      output.push([
        await page.screenshot({
          clip: rect,
          path: `./data/images/text-links/${uuid}-hover.png`,
        }),
      ]);
    }
  }

  return output;
}

async function extractImageLinks(page) {
  // Extract the results from the page.
  const anchors = await page.$$("a:has(img)"); // image links only
  const output = [];

  for (const anchor of anchors) {
    const bounding = await anchor.boundingBox();
    if (bounding != null) {
      const rect = await page.evaluate((el) => {
        function isOccluded(element) {
          const { x, y, width, height } = element.getBoundingClientRect();

          // We inset 5px to avoid the edges of the button.
          const elementsTopLeft = document.elementsFromPoint(x + 5, y + 5);
          const elementsTopRight = document.elementsFromPoint(
            x + width - 5,
            y + 5
          );
          const elementsBottomLeft = document.elementsFromPoint(
            x + 5,
            y + height - 5
          );
          const elementsBottomRight = document.elementsFromPoint(
            x + width - 5,
            y + height - 5
          );

          if (
            elementsTopLeft.indexOf(element) == -1 ||
            elementsTopRight.indexOf(element) == -1 ||
            elementsBottomLeft.indexOf(element) == -1 ||
            elementsBottomRight.indexOf(element) == -1
          ) {
            return true;
          }

          return false;
        }

        el.scrollIntoView({
          behavior: "auto",
          block: "center",
          inline: "center",
        });

        if (isOccluded(el)) {
          return { width: 0, height: 0 };
        }

        const { x, y, width, height } = el.getBoundingClientRect();
        const elements = document.elementsFromPoint(
          x + width / 2,
          y + height / 2
        );

        // We only want the link where it is in the chain of elements. (likely visible from the current point.)
        if (elements.indexOf(el) > -1) {
          return {
            x: Math.max(window.scrollX + x - 10, 0),
            y: Math.max(window.scrollY + y - 10, 0),
            width: width + 20,
            height: height + 20,
          };
        }
        // We ignore these later.
        return { width: 0, height: 0 };
      }, anchor);

      if (rect.width == 0 || rect.height == 0) continue; // skip small links (like the ones in the footer) - 50 because we added 20 to the width and height and 30 is probably the smallest link

      const uuid = uuidv4();
      output.push([
        await page.screenshot({
          clip: rect,
          path: `./data/images/image-links/${uuid}.png`,
        }),
      ]);

      await anchor.hover();

      output.push([
        await page.screenshot({
          clip: rect,
          path: `./data/images/image-links/${uuid}-hover.png`,
        }),
      ]);
    }
  }

  return output;
}

async function extractButtons(page) {
  const buttons = await page.$$(
    "button, input[type='button'], input[type='submit'], input[type='reset']"
  );
  const output = [];
  for (const button of buttons) {
    const bounding = await button.boundingBox();
    if (bounding != null) {
      const rect = await page.evaluate((el) => {
        function isOccluded(element) {
          const { x, y, width, height } = element.getBoundingClientRect();

          // We inset 5px to avoid the edges of the button.
          const elementsTopLeft = document.elementsFromPoint(x + 5, y + 5);
          const elementsTopRight = document.elementsFromPoint(
            x + width - 5,
            y + 5
          );
          const elementsBottomLeft = document.elementsFromPoint(
            x + 5,
            y + height - 5
          );
          const elementsBottomRight = document.elementsFromPoint(
            x + width - 5,
            y + height - 5
          );

          if (
            elementsTopLeft.indexOf(element) == -1 ||
            elementsTopRight.indexOf(element) == -1 ||
            elementsBottomLeft.indexOf(element) == -1 ||
            elementsBottomRight.indexOf(element) == -1
          ) {
            return true;
          }

          return false;
        }

        el.scrollIntoView({
          behavior: "auto",
          block: "center",
          inline: "center",
        }); // reduce the chance of position: fixed elements blocking this element.

        if (isOccluded(el)) {
          return { width: 0, height: 0 };
        }

        const { x, y, width, height } = el.getBoundingClientRect();

        const elements = document.elementsFromPoint(
          x + width / 2,
          y + height / 2
        );

        // We only want the button where it is clearly the top level element.
        if (elements.indexOf(el) > -1) {
          return {
            x: Math.max(window.scrollX + x - 10, 0),
            y: Math.max(window.scrollY + y - 10, 0),
            width: width + 20,
            height: height + 20,
          };
        }
        // We ignore these later.
        return { width: 0, height: 0 };
      }, button);

      if (rect.width == 0 || rect.height == 0) continue; // skip small buttons (like the ones in the footer

      const uuid = uuidv4();
      output.push([
        await page.screenshot({
          clip: rect,
          path: `./data/images/buttons/${uuid}.png`,
        }),
      ]);

      await button.hover();

      output.push([
        await page.screenshot({
          clip: rect,
          path: `./data/images/buttons/${uuid}-hover.png`,
        }),
      ]);
    }
  }

  return output;
}

async function get(urls = [], browser) {
  const results = { allButtons: {}, allLinks: {}, allImageLinks: {} };
  for (let urlIdx = 0; urlIdx < urls.length; urlIdx++) {
    const url = urls[urlIdx];
    log(`Fetching ${urlIdx + 1}/${urls.length} ${url}`);

    const page = await navigate(browser, url);

    if (page != null) {
      try {
        results.allButtons[url] = await extractButtons(page);
        results.allLinks[url] = await extractLinks(page);
        //results.allImageLinks[url] = await extractImageLinks(page);

        log(
          `. Done. Buttons: ${results.allButtons[url].length}, Links: ${results.allLinks[url].length}, Image Links: ${results.allImageLinks[url].length}\n`
        );
      } catch (e) {
        log(`. Failed.`);
        console.log(`url ${url} failed with error ${e}`);
      }
      await page.close();
    } else {
      log(`. Failed.`);
      console.log(`url ${url} failed`);
    }
  }
  return results;
}

async function init(urls) {
  const browser = await puppeteer.launch({
    devtools: false,
    defaultViewport: null,
  });

  await get(urls, browser);

  browser.close();

  return "done";
}

const args = minimist(process.argv.slice(2));

init(typeof args.url == "string" ? [args.url] : args.url).then(console.log());
