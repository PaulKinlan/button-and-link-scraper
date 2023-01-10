import puppeteer from "puppeteer";
import minimist from "minimist";
import { v4 as uuidv4 } from "uuid";
import sharp from "sharp";

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

function saveScreenshot(buffer, uuid, className, state) {
  const image = sharp(buffer);
  image.clone().png().toFile(`./data/images/${className}/${uuid}-${state}.png`);
  image
    .clone()
    .jpeg({ quality: 25 })
    .toFile(`./data/images/${className}/${uuid}-${state}.jpeg`);
}

async function extractLinks(page) {
  // Extract the results from the page.
  const anchors = await page.$$(
    "a:not([role=button]):not(:has(img)):not(:has(button))"
  ); // text links only, that are not simulated buttons
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
      const screenshot = await page.screenshot({
        clip: rect,
      });
      output.push(screenshot);
      saveScreenshot(screenshot, uuid, "text-links", "normal");
    }
  }

  return output;
}

async function extractButtons(page) {
  const buttons = await page.$$(
    "button, input[type='button'], input[type='submit'], input[type='reset'], input[type='file']"
  );
  const output = [];
  for (const button of buttons) {
    const bounding = await button.boundingBox();
    if (bounding != null) {
      const rect = await page.evaluate((el) => {
        function isOccluded(element) {
          const { x, y, width, height } = element.getBoundingClientRect();
          const padding = 10;

          // We inset {padding}px to avoid the edges of the button.
          const elementsTopLeft = document.elementsFromPoint(
            x + padding,
            y + padding
          );
          const elementsTopRight = document.elementsFromPoint(
            x + width - padding,
            y + padding
          );
          const elementsBottomLeft = document.elementsFromPoint(
            x + padding,
            y + height - padding
          );
          const elementsBottomRight = document.elementsFromPoint(
            x + width - padding,
            y + height - padding
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
      const screenshot = await page.screenshot({
        clip: rect,
      });

      await button.hover();

      const screenshotHover = await page.screenshot({
        clip: rect,
      });

      output.push(screenshot);
      output.push(screenshotHover);
      saveScreenshot(screenshot, uuid, "buttons", "normal");
      saveScreenshot(screenshotHover, uuid, "buttons", "hover");
    }
  }

  return output;
}

async function get(urls = [], browser) {
  for (let urlIdx = 0; urlIdx < urls.length; urlIdx++) {
    let line = urls[urlIdx];
    let [filter, url] = line.split(/:(.*)/);
    let extract = {
      button: filter.includes("button"),
      link: filter.includes("link"),
    };

    log(`Fetching ${urlIdx + 1}/${urls.length} ${url}`);

    const page = await navigate(browser, url);

    if (page != null) {
      try {
        let buttons, links;

        if (extract.button) {
          buttons = await extractButtons(page);
        }
        if (extract.link) {
          links = await extractLinks(page);
        }

        log(
          `. Done. Buttons: ${buttons.length || 0}, Links: ${
            links.length || 0
          }\n`
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
  return;
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
