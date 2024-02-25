import chrome from "selenium-webdriver/chrome";
import {Browser, Builder, By, until, WebDriver} from "selenium-webdriver";
import {JSDOM} from "jsdom";
import fs from "fs";
import * as https from "https";

export const pagesScrapper = async () => {
    const globalLinks: string[] = [];
    const chromeOptions = new chrome.Options();
    chromeOptions.addArguments("user-agent=\"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36\"");
    chromeOptions.addArguments("--disable-blink-features=AutomationControlled");
    let driver = await new Builder()
        .forBrowser(Browser.CHROME)
        .withCapabilities(chromeOptions)
        .build();
    const getUrl = (pageNum: number) => `https://www.avito.ru/ekaterinburg/kvartiry/prodam-ASgBAgICAUSSA8YQ?context=H4sIAAAAAAAA_0q0MrSqLraysFJKK8rPDUhMT1WyLrYyNLNSKk5NLErOcMsvyg3PTElPLVGyrgUEAAD__xf8iH4tAAAA%3Fp%3D1&p=${pageNum}`;
    try {
        await driver.get(getUrl(1));
        for (let i = 2; i <= 100; i++) {
            await driver.wait(until.elementLocated(By.css("body div[class^='uxs']")));
            const html = await driver.getPageSource();
            const dom = new JSDOM(html);
            const links = [...dom.window.document.querySelectorAll("[data-marker=catalog-serp] [data-marker=item]")].map(card => {
                if (card) {
                    const anchor = card.querySelector("a[itemprop=url]");
                    if (anchor) {
                        return (anchor as HTMLAnchorElement).href;
                    } else {
                        return "empty";
                    }
                } else {
                    return "empty";
                }
            });
            console.log(`page: ${i}; links: ${links.length}; all_links: ${globalLinks.length}`);
            globalLinks.push(...links);
            await driver.navigate().to(getUrl(i));
        }
    } catch (error) {
        // ignore
    } finally {
        await driver.quit();
    }

    fs.writeFile(`htmls/links_parsed.json`, JSON.stringify(globalLinks), (err) => {
        if (err) {
            console.log("all bad");
        } else {
            console.log("good");
        }
    });
};

export const adScrapper = async (adPaths: string[], savePath: string) => {
    const baseUrl = "https://www.avito.ru";

    if (!tryMakeFolder(savePath)) return;

    const chromeOptions = new chrome.Options();
    chromeOptions.addArguments("user-agent=\"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36\"");
    chromeOptions.addArguments("--disable-blink-features=AutomationControlled");
    let driver = await new Builder()
        .forBrowser(Browser.CHROME)
        .withCapabilities(chromeOptions)
        .build();
    try {
        for (const adPath of adPaths) {
            await driver.get(baseUrl + adPath);
            const folderSaveName = adPath.replace(/[<>:"\/\\|?*]/g, "");
            if (!tryMakeFolder(`${savePath}/${folderSaveName}`)) return;
            console.log(`parsing for ${folderSaveName}`);
            await getDescription(driver, `${savePath}/${folderSaveName}`);
            await getMiniatures(driver, `${savePath}/${folderSaveName}/miniatures`);
            await getBigPhotos(driver, `${savePath}/${folderSaveName}/bigPhotos`);
        }
    } catch
        (error) {
        // ignore
    } finally {
        await driver.quit();
    }
};

const getDescription = async (driver: WebDriver, savePath: string) => {
    await driver.wait(until.elementLocated(By.css("[data-marker='item-view/item-description']")));
    const html = await driver.getPageSource();
    const dom = new JSDOM(html);
    console.log("------------------------------------- DESCR -------------------------------------")
    console.log(`description for ${savePath}`);
    let descr = [...dom.window.document
        .querySelector("[data-marker='item-view/item-description']")!
        .querySelectorAll("p")]
        .map(p => p.innerText).join(" ");
    if (descr === undefined || descr === null || descr === "") {
        descr = (dom.window.document.querySelector("[data-marker='item-view/item-description']") as HTMLDivElement).innerText;
    }
    if (descr === undefined || descr === null || descr === "") {
        descr = [...dom.window.document
            .querySelector("[data-marker='item-view/item-description']")!
            .querySelectorAll("p")]
            .map(p => p.innerHTML).join(" ");
    }
    if (descr === undefined || descr === null || descr === "") {
        descr = (dom.window.document.querySelector("[data-marker='item-view/item-description']") as HTMLDivElement).innerText;
    }
    console.log(`saving description length ${descr.length} for ${savePath}`);
    fs.writeFile(`${savePath}/descr.txt`, descr, "utf-8", (err) => {
        if (err) {
            console.log(`${savePath} descr error`);
        } else {
            console.log(`${savePath} descr good`);
        }
    });
    console.log("------------------------------------- DESCR -------------------------------------")
};

const tryMakeFolder = (path: string) => {
    try {
        if (!fs.existsSync(path)) {
            fs.mkdirSync(path);
            console.log(`created folder ${path}`);
        }
        return true;
    } catch (err) {
        console.log(err);
        return false;
    }
};

const downloadPicture = async (url: string, path: string) => {
    const imageName = url.slice(url.lastIndexOf("/")).replace(/[<>:"\/\\|?*]/g, "") + ".jpeg";
    if (!tryMakeFolder(path)) return;
    const imagePath = `${path}/${imageName}`;
    const file = fs.createWriteStream(imagePath);
    https.get(url, response => {
        response.pipe(file);
        file.on("finish", () => {
            file.close();
            // console.log(`Image downloaded as ${imageName}`);
        }).on("error", (err) => {
            fs.unlink(imagePath, (err) => {
                if (err) throw err;
                // console.log(`${imagePath} was deleted`);
            });
            // console.error(`Error downloading image: ${err.message}`);
        });
    });
};

const getMiniatures = async (driver: WebDriver, path: string) => {
    console.log("------------------------------------- MINIS -------------------------------------")
    await driver.wait(until.elementLocated(By.css("[data-marker='image-preview/preview-wrapper']")));
    const html = await driver.getPageSource();
    const dom = new JSDOM(html);
    console.log(`minis for ${path}`);
    const miniaturesLinks = [...dom.window.document.querySelectorAll("[data-marker='image-preview/preview-wrapper'] li[data-type='image'] img")]
        .map(i => (i as HTMLImageElement).src);
    console.log(`saving ${miniaturesLinks.length} minis for ${path}`);
    miniaturesLinks.forEach(link => downloadPicture(link, path));
    console.log("------------------------------------- MINIS -------------------------------------")
};

const getBigPhotos = async (driver: WebDriver, path: string) => {
    console.log("------------------------------------- BIGIS -------------------------------------")
    await driver.wait(until.elementLocated(By.css("[data-marker='image-preview/preview-wrapper']")));
    const html = await driver.getPageSource();
    const dom = new JSDOM(html);
    console.log(`bigis for ${path}`);
    const miniatures = [...dom.window.document.querySelectorAll("[data-marker='image-preview/preview-wrapper'] li[data-type='image']")];
    const bigPhotoLinks = [];
    for (const mini of miniatures) {
        const index = (mini as HTMLElement).dataset.index;
        const miniEl = driver.findElement(By.css(`[data-marker='image-preview/item'][data-index='${index}']`));
        console.log(`click on mini number ${index}`);
        await miniEl.click();
        await driver.wait(until.elementLocated(By.css(`[data-marker='image-frame/image-wrapper'][data-image-id='${index}']`)));
        const selector = `[data-marker='image-frame/image-wrapper'][data-image-id='${index}'] img`
        bigPhotoLinks.push(await driver.findElement(By.css(selector)).getAttribute("src"));
    }
    console.log(`saving ${bigPhotoLinks.length} bigis for ${path}`);
    bigPhotoLinks.forEach(link => downloadPicture(link, path));
    console.log("------------------------------------- BIGIS -------------------------------------")
};

const delay = (ms: number) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}