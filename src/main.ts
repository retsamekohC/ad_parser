import {adScrapper, pagesScrapper} from "./scrappers";
import fs from "fs";

const adPaths = JSON.parse(fs.readFileSync("htmls/links_parsed.json", {encoding: "utf-8"}));

adScrapper(
    [
        "/ekaterinburg/kvartiry/3-k._kvartira_919_m_2035_et._3749692828"
    ],
    "htmls/first_try");