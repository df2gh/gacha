
import {
  ITEM, WEPON, DOLL, UNKNOWN,
  R, SR, SSR,
  ENTRIES, POOLS,
} from "./data_ja.js";

const PERMANENT_DOLLS = {
  1015: 1, // ヴェプリー
  1021: 1, // ペリティア
  1025: 1, // トロロ
  1027: 1, // 瓊玖
  1029: 1, // サブリナ
  1033: 1, // モシン・ナガン
  1043: 1, // フェイ
};

//const PERMANENT_DOLL_PU_1 = ; // 1025, トロロ 2024-12-26 - 2025-01-15
//const PERMANENT_DOLL_PU_2 = ; // 1033, モシン・ナガン 2025-01-16 - 2025-02-05

const PERMANENT_WEPONS = {
  11016: 1, // ハートハンター
  11020: 1, // ミラージュ
  10333: 1, // ミエティエリ
  11038: 1, //遊星
  11044: 1, // 金石奏
  11047: 1, // メッツァルーナ
  //: 1, //
};

//const PERMANENT_WEPON_PU_1 = ; // 遊星
//const PERMANENT_WEPON_PU_2 = ; // ミエティエリ

const API_ADDR = "https://gf2-gacha-record-jp.haoplay.com/list";
const UNKNOWN_FORM = "https://tally.so/r/wLgEdy";

const CATEGORY_STANDARD = "1";
const CATEGORY_LIMITED = "3";
const CATEGORY_WEPON = "4";
const CATEGORY_STARTDASH = "5";
const CATEGORY_MISTERYBOX = "8";
const CATEGORIES = [
  CATEGORY_STANDARD, CATEGORY_LIMITED, CATEGORY_WEPON,
  CATEGORY_STARTDASH, CATEGORY_MISTERYBOX,
];
const CATEGORY_MAP = {
  "standard": CATEGORY_STANDARD, "limited": CATEGORY_LIMITED,
  "wepon": CATEGORY_WEPON, "startdash": CATEGORY_STARTDASH, "misterybox": CATEGORY_MISTERYBOX,
};

/// Returns category ID from its category name.
function getCategory(name) {
  return CATEGORY_MAP[name];
}

let currentCategory = "";
let misteryboxLoaded = false;
let historyManager = null;
const fetchedEntry = {};
const parsedData = {};

window.addEventListener("load", function () {
  historyManager = new HistoryManager();
  addListener("how-to-button", "click", () => { showElement("how-to", true); });
  addListener("how-to-close", "click", () => { showElement("how-to", false); });
  addListener("setup-button", "click", () => { showElement("setup", true); });
  addListener("player-data-button", "click", readUserDataFromPlayerData);
  addListener("data-set-button", "click", readFromDataSet);
  addListener("history-button", "click", () => { loadHistory(); showElement("history", true); });
  addListener("history-close", "click", () => { showElement("history", false); });
  addListener("history-upload", "click", () => { getElement("history-file").click(); });
  addListener("history-file", "change", historyUpload);
  addListener("image-sr", "click", () => { imageListSwitch("sr"); });
  addListener("image-ssr", "click", () => { imageListSwitch("ssr"); });
  addListener("list-r", "click", () => { listSwitch("r"); });
  addListener("list-sr", "click", () => { listSwitch("sr"); });
  addListener("list-ssr", "click", () => { listSwitch("ssr"); });
  addListener("misterybox-image-download", "click", () => {
    const canvas = getElement("misterybox-image");
    const link = getElement("misterybox-image-link");
    link.href = canvas.toDataURL("image/png");
    link.download = `misterybox-${fileDate(new Date())}`;
    link.click();
  });
  addListener("history-server-download", "click", () => { fetchHistoryAndDownload(CATEGORIES, "dfl2"); });
  addListener("history-all-download", "click", () => { downloadAllHistory(CATEGORIES, "dfl2"); });

  for (const element of document.getElementsByClassName("category")) {
    element.addEventListener("click", clickCategory);
  }

  const m = new UserDataManager();
  if (!m.hasData()) {
    showElement("setup", true);
  }
});

/// Changes category if category div is clicked.
function clickCategory(ev) {
  let node = ev.target;
  while (node.tagName != "DIV") {
    node = node.parentNode;
  }
  const categoryName = node.id;
  if (currentCategory == categoryName) {
    return;
  }
  switchCategory(categoryName);
  if (categoryName == "misterybox") {
    if (!misteryboxLoaded) {
      misteryboxLoaded = true;
      loadMisteryboxImages();
    }
    showElement("stat", false);
    showElement("image-result", false);
    showElement("list-result", true);
  } else {
    showElement("misterybox-outer", false);
  }
  loadData(categoryName);
  if (categoryName == "misterybox") {
    showElement("misterybox-outer", true);
  } else {
    showElement("stat", true);
    showElement("image-result", true);
    showElement("list-result", true);
  }
  currentCategory = categoryName;
}

/// Loads images for misterybox used in the canvas drawing.
function loadMisteryboxImages() {
  const ENTRIES = [
    1021, // SSR
    11007, 11014, 11015, 11021, 11023, 11040, 11026, // SR
    2, 25, 8301, 8328, 8329, 8330, 9008, 9009, 9010, 9011, 300003 // R
  ];
  const div = getElement("misterybox-images");
  for (const id of ENTRIES) {
    addImage(div, id, `assets/misterybox/mb${id}.png`, 50, 50, "", "");
  }
}

/// Loads and fills data for specified category.
async function loadData(categoryName) {
  const category = getCategory(categoryName);
  if (category == currentCategory) {
    return;
  }
  if (parsedData[category]) {
    // use parsed data
    if (categoryName == "misterybox") {
      showElement("misterybox-image-download", true);
      fillMisteryboxList();
    } else {
      fillGachaResult(category);
    }
  } else {
    // read history and fetch data from the server
    await historyManager.readCategoryData(category);
    await loadDataFromServer(category);
    const histories = await historyManager.readCategoryData(category);
    const fetched = fetchedEntry[category];
    if (histories.length > 0) {
      fetched.findDuplicated(histories[0]);
    }
    await historyManager.appendCategoryHistory(category, fetched);

    if (category == CATEGORY_MISTERYBOX) {
      const analyzer = new MisteryboxAnalyzer(category);
      for (let i = histories.length - 1; i >= 0; i--) {
        const history = histories[i];
        analyzer.analyze(history);
      }
      analyzer.analyze(fetched);
      analyzer.done();
      parsedData[category] = analyzer;

      fillMisteryboxResult();
      showElement("misterybox-image-download", true);
    } else {
      const analyzer = new GachaAnalyzer(category);
      for (let i = histories.length - 1; i >= 0; i--) {
        const history = histories[i];
        analyzer.analyze(history);
      }
      analyzer.analyze(fetched);
      analyzer.done();
      parsedData[category] = analyzer;

      fillGachaResult(category);
    }
  }
}

/// Loads data from the server for the passed category.
async function loadDataFromServer(category) {
  const userData = new UserDataManager().read();
  const entries = [];
  const mostRecent = await historyManager.mostRecentTime(category);
  const f = new Fetcher(userData.uid, userData.token, category, entries, mostRecent);
  await f.fetch();
  fetchedEntry[category] = new History(category, entries, "");
}

const MISTERYBOX_ENTRIES_SSR = {1021: 1};
const MISTERYBOX_ENTRIES_SR = {
  11007: 1, 11014: 1, 11015: 1, 11021: 1, 11023: 1, 11040: 1, 11026: 1};
const MISTERYBOX_ENTRIES_R = {
  2: 1, 25: 1, 8301: 1, 8328: 1, 8329: 1, 8330: 1, 9008: 1, 9009: 1, 9010: 1, 9011: 1, 300003: 1};

/// Analyzes misterybox result.
class MisteryboxAnalyzer {
  constructor() {
    this.category = CATEGORY_MISTERYBOX;
    this.count = 0;
    this.ssr = 1;
    this.sr = 1;
    this.rarities = [0, 0, 0]; // R, SR, SSR
    this.picked = new Map();
    this.items = [];
  }

  /// Analyze passed history.
  analyze(history) {
    const items = this.items;
    const count = history.count();
    const picked = this.picked;
    const entries = history.data;
    let ssr = this.ssr, sr = this.sr;
    let n = this.count + 1;
    for (let i = history.startIndex; i <= history.endIndex; i++) {
      const entry = entries[i];
      const item = entry.item;
      const v = ENTRIES[item];
      const value = picked.get(item);
      if (value !== undefined) {
        picked.set(item, value + 1);
      } else {
        picked.set(item, 1);
      }
      let rarity = R;
      let counter = 0;
      if (MISTERYBOX_ENTRIES_SSR[item]) {
        rarity = SSR;
        counter = ssr;
        ssr = 0, sr = 0;
      } else if (MISTERYBOX_ENTRIES_SR[item]) {
        rarity = SR;
        counter = sr;
        sr = 0;
      }
      items.push({
        name: v[0],
        count: counter,
        index: n,
        rarity: rarity,
        date: dateString(new Date(entry.time * 1000)),
      });
      n += 1, ssr += 1, sr += 1;
    }
    this.count += count;
    this.ssr = ssr;
    this.sr = sr;
  }

  done() {
    const rarities = this.rarities;
    this.picked.forEach((value, key) => {
      const entry = ENTRIES[key];
      if (MISTERYBOX_ENTRIES_SSR[key]) {
        rarities[2] += value;
      } else if (MISTERYBOX_ENTRIES_SR[key]) {
        rarities[1] += value;
      } else if (MISTERYBOX_ENTRIES_R[key]) {
        rarities[0] += value;
      } else {
        console.log(`Error, wrong item found: ${key}`);
      }
    });
  }
}

const WIN = 1;
const LOSE = 0;
const SETTLED = 2;

/// Analyzes gacha result.
class GachaAnalyzer {
  constructor(category) {
    this.category = category;
    this.items = [];
    this.count = 0;
    this.ssrCount = 0;
    this.srCount = 0;
    this.ssr = 1;
    this.sr = 1;
    // lose check for limited, wepon
    this.needsLoseCheck = category == CATEGORY_LIMITED || category == CATEGORY_WEPON;
    this.isLosable = true;
    this.loseCount = 0;
    this.losableCount = 0;
  }

  /// Analyzes passed history.
  analyze(history) {
    const data = {};
    const count = history.count();
    const entries = history.data;

    const items = this.items;
    const needsLoseCheck = this.needsLoseCheck;
    let ssrCount = this.ssrCount, srCount = this.srCount;
    let ssr = this.ssr, sr = this.sr;
    let n = this.count + 1;
    for (let i = history.endIndex; i >= history.startIndex; i--) {
      const entry = entries[i];
      const item = entry.item;
      const date = new Date(entry.time * 1000);
      let unknown = false;
      let v = ENTRIES[item];
      if (v === undefined) {
        v = ["Unknown", 3, 3];
        unknown = true;
      }
      let name = v[0];
      const rarity = v[1];
      let ssrState = LOSE;
      let skip = false;
      let counter = 0;
      if (rarity == SSR) {
        counter = ssr;
        ssr = 0, sr = 0;
        ssrCount += 1;
        if (needsLoseCheck) {
          const permanent = this.isPermanent(item, this.category, entry.pool_id);
          if (this.isLosable) {
            this.losableCount += 1;
            if (permanent) {
              // lose
              ssrState = LOSE;
              this.loseCount += 1;
              this.isLosable = false; // next is not losable
            } else {
              ssrState = WIN;
              this.isLosable = true;
            }
          } else {
            ssrState = SETTLED;
            this.isLosable = true;
          }
        }
      } else if (rarity == SR) {
        counter = sr;
        sr = 0;
        srCount += 1;
      } else if (rarity == R) {
        counter = "";
      } else {
        skip = !unknown;
      }
      if (!skip) {
        if (unknown) {
          name = `${name} ${item} (${entry.pool_id})`;
        }
        items.push({
          id: item,
          name: name,
          rarity: rarity,
          count: counter,
          pool_id: entry.pool_id,
          date: dateString(date),
          index: n,
          kind: v[2],
          ssr_state: ssrState, // only for SSR
        });
      }
      n += 1, ssr += 1, sr += 1;
    }

    this.count += count;
    this.ssrCount = ssrCount;
    this.srCount = srCount;
    this.ssr = ssr;
    this.sr = sr;
    return data;
  }

  /// Returns `true` if specified id is a permanent doll or wepon.
  isPermanent(id, category, pool) {
    if (category == CATEGORY_LIMITED) {
      /*
      if (pool == PERMANENT_DOLL_PU_1) {
        return id != 1025; // トロロ
      } else if (pool == PERMANENT_DOLL_PU_2) {
        return id != 1033; // モシン・ナガン
      } else {
      */
      return PERMANENT_DOLLS[id] !== undefined;
      //}
    } else if (category == CATEGORY_WEPON) {
      /*
      if (pool == PERMANENT_WEPON_PU_1) {
        return id != ; // 遊星
      } else if (pool == PERMANENT_WEPON_PU_2) {
        return id != ; // ミエティエリ
      } else {
      */
      return PERMANENT_WEPONS[id] !== undefined;
      //}
    } else {
      return false;
    }
  }

  /// Calculates total result.
  done() {
    let ssrPityTotal = 0, srPityTotal = 0;
    for (const item of this.items) {
      const pity = item.count;
      if (item.rarity == SSR) {
        ssrPityTotal += pity;
      } else if (item.rarity == SR) {
        srPityTotal += pity;
      }
    }
    this.ssrAverage = roundRatio(ssrPityTotal / this.ssrCount);
    this.srAverage = roundRatio(srPityTotal / this.srCount);
  }
}

/// Fills misterybox result.
function fillMisteryboxResult() {
  const data = parsedData[CATEGORY_MISTERYBOX];
  const ctx = getElement("misterybox-image").getContext("2d");
  ctx.fillStyle = "#FFF";
  ctx.fillRect(0, 0, 600, 380);
  ctx.fillStyle = "black";
  ctx.font = "bold 16px sans-serif";
  ctx.fillText(`ミステリーボックス - ${data.count} 回中`, 10, 17);
  fillMisteryboxImageRarity(ctx, data, 2, [1021], 25);
  fillMisteryboxImageRarity(ctx, data, 1, [11007, 11014, 11015, 11021, 11023, 11040, 11026], 140);
  fillMisteryboxImageRarity(ctx, data, 0, [2, 25, 8301, 8328, 8329, 8330, 9008, 9009, 9010, 9011, 300003], 255);

  fillMisteryboxList();
}

/// Fills rarity related part of the misterybox result.
function fillMisteryboxImageRarity(ctx, data, rarity, ids, start_y) {
  const RARITIES = ["R", "SR", "SSR"];
  const SEP = 53;
  const count = data.count;
  let x = 10, y = 0;

  ctx.font = "bold 16px sans-serif";
  ctx.fillStyle = "#DDD";
  ctx.fillRect(5, start_y, 590, 20);
  ctx.fillStyle = "black";
  ctx.textAlign = "left";
  ctx.fillText(`${RARITIES[rarity]} - ${roundRatio(data.rarities[rarity] / count * 100)}%`, 10, start_y + 16);

  ctx.font = "12px sans-serif";
  ctx.textAlign = "center";
  for (const id of ids) {
    ctx.drawImage(getElement(id.toString()), x, start_y + 25);
    const c = data.picked.get(id);
    const p = `${roundRatio(c / count * 100)}%`;
    ctx.fillText(c, x + 25, start_y + 90, 50);
    ctx.fillText(p, x + 25, start_y + 105, 50);
    x += SEP;
  }
}

function fillMisteryboxList() {
  const BASE_ID = "list-table";
  const data = parsedData[getCategory("misterybox")];

  const parent = getElement("list-container");
  removeElement(BASE_ID);
  const tc = new TableCreator(parent, BASE_ID);
  tc.addRow(["list-entry", "list-dark"]);
  tc.addCells([
    { text: "#", classes: ["list-number-heading"] },
    { text: "名前", classes: ["list-name-heading"] },
    { text: "間隔", classes: ["list-pity-heading"] },
    { text: "時刻", classes: ["list-date-heading"] },
  ]);

  const items = data.items;
  for (let i = items.length - 1, n = 0; i >= 0; i--, n++) {
    const item = items[i];
    tc.addRow([
      listRarityClass(item.rarity),
      "list-entry",
      n % 2 == 0 ? "list-light" : "list-dark"
    ]);
    tc.addCells([
      { text: item.index, classes: ["list-number"] },
      { text: item.name, classes: ["list-name", listRarityNameClass(item.rarity)] },
      { text: item.rarity == R ? "" : item.count, classes: ["list-pity"] },
      { text: item.date, classes: ["list-date"] },
    ]);
  }
  listRarityApply();
}

/// Fills gacha result for the specified category.
function fillGachaResult(category) {
  const data = parsedData[category];
  const count = data.count;

  setText("pull-count", data.count);
  setText("ssr-count", data.ssrCount);
  setText("sr-count", data.srCount);
  setText("ssr-average", data.ssrAverage);
  setText("sr-average", data.srAverage);

  if (category == CATEGORY_LIMITED || category == CATEGORY_WEPON) {
    setText("lose-ratio", `${data.loseCount}/${data.losableCount}`);
    setText("lose-wsettled-ratio", `${data.loseCount}/${data.ssrCount}`);
  } else {
    setText("lose-ratio", "--");
    setText("lose-wsettled-ratio", "--");
  }

  fillGachaImageList(category);
  fillGachaList(category);
}

/// Fills gacha result in the image list.
function fillGachaImageList(category) {
  const BASE_ID = "image-div";
  const data = parsedData[category];

  const parent = getElement("image-container");
  removeElement(BASE_ID);
  const div = addElement(parent, "div");
  div.id = BASE_ID;
  const showSSRState = category == CATEGORY_LIMITED || category == CATEGORY_WEPON;
  const showBanner = category == CATEGORY_LIMITED || category == CATEGORY_WEPON;

  const items = data.items;
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    if (item.rarity == R) {
      continue;
    }
    const child = addElement(div, "div", ["item", imageRarityClass(item.rarity)]);
    if (item.rarity != UNKNOWN) {
      const dir = item.kind == DOLL ? "dolls" : "wepons";
      const image = addElement(child, "img");
      image.src = `assets/${dir}/${item.id}.png`;
      image.alt = item.name;
      image.title = item.name;
      image.width = "60";
      image.height = "60";
    } else {
      const div = addElement(child, "div");
      div.classList.add("unknown-placeholder");
      const name = `不明報告(${item.id})`
      const poolName = showBanner ? getPoolName(item.pool_id) : "";
      const a = addUnknownReportLink(div, name, item, "", category, poolName);
      a.classList.add("unknown-image-link");
    }
    const counter = addElement(child, "div",
      ["item-count", imageRarityBackgroundClass(item.rarity)]);
    counter.textContent = `#${item.count}`;
    if (item.rarity == SSR && showSSRState) {
      const state = addElement(child, "div",
        ["item-ssr-state", "item-bg-ssr"]);
      state.appendChild(ssrWinState(item.ssr_state));
    }
  }
  imageListRarityApply();
}

/// Returns mark for lose, win or settled on SSR pull.
function ssrWinState(ssrState) {
  return ssrState == WIN ? getMark('circle') : ssrState == LOSE ? getMark('cross') : getMark('triangle');
}

/// Returns cloned node for the specified mark.
function getMark(id) {
  const node = getElement(id).cloneNode(true);
  node.id = "";
  return node;
}

/// Returns class name for image rarity for the passed ratity.
function imageRarityClass(r) {
  return r == SSR ? "item-ssr" : r == SR ? "item-sr" : r == R ? "item-r" : "item-unknown";
}

/// Returns class name for background color for the passed rarity.
function imageRarityBackgroundClass(r) {
  return r == SSR ? "item-bg-ssr" : r == SR ? "item-bg-sr" : r == R ? "item-bg-r" : "item-bg-unknown";
}

/// Fills gacha result in the list for the passed category.
function fillGachaList(category) {
  const BASE_ID = "list-table";
  const data = parsedData[category];
  const showBanner = category == CATEGORY_LIMITED || category == CATEGORY_WEPON;

  const parent = getElement("list-container");
  removeElement(BASE_ID);
  const tc = new TableCreator(parent, BASE_ID);
  tc.addRow(["list-entry", "list-dark"]);
  tc.addCells([
    { text: "#", classes: ["list-number-heading"], },
    { text: "名前", classes: ["list-name-heading"], },
    { text: "間隔", classes: ["list-pity-heading"], },
    { text: "訪問回", classes: ["list-banner-heading"], skip: !showBanner, },
    { text: "時刻", classes: ["list-date-heading"], },
  ]);

  const items = data.items;
  for (let i = items.length - 1, n = 0; i >= 0; i--, n++) {
    const item = items[i];
    tc.addRow([
      listRarityClass(item.rarity),
      "list-entry",
      n % 2 == 0 ? "list-light" : "list-dark"
    ]);
    tc.addCell({ text: item.index, classes: ["list-number"] });
    if (item.rarity != UNKNOWN) {
      tc.addCell({ text: item.name, classes: ["list-name", listRarityNameClass(item.rarity)]});
    } else {
      // unknown
      const name = `不明報告(${item.id})`
      const poolName = showBanner ? getPoolName(item.pool_id) : "";
      addUnknownReportLink(tc.tr, name, item, "", category, poolName);
    }
    tc.addCell({ text: item.count, classes: ["list-pity"], });
    if (showBanner) {
      const pool = POOLS[item.pool_id];
      if (pool) {
        const poolName = pool[0];
        tc.addCell({ text: poolName, classes: ["list-banner"] });
      } else {
        // unknown pool
        const name = `不明報告(${item.pool_id})`;
        addUnknownReportLink(tc.tr, name, item, item.name, category, "");
      }
    }
    tc.addCell({ text: item.date, classes: ["list-date"] });
  }
  listRarityApply();
}

/// Add link for reporting unknown item.
function addUnknownReportLink(parent, text, item, name, category, pool_name) {
  const kind = unknownKind(category);
  const date = unknownDateString(item.date);
  const href = `${UNKNOWN_FORM}?item=${item.id}&pool_id=${item.pool_id}&time=${date}&name=${name}&kind=${kind}&pool_name=${pool_name}`;
  return addLink(parent, text, href, "_blank");
}

/// Returns pool name.
function getPoolName(pool_id) {
  const pool = POOLS[pool_id];
  return pool ? pool[0] : "";
}

/// Returns kind of unknown entry.
function unknownKind(category) {
  return category == CATEGORY_LIMITED ? "limited" : category == CATEGORY_WEPON ? "wepon" : "standard";
}

/// Returns date only from formatted time.
function unknownDateString(date) {
  return date.split(' ')[0];
}

/// Returns class name of a rarity for the list entry.
function listRarityClass(rarity) {
  return rarity == SSR ? "ssr-list" : rarity == SR ? "sr-list" : rarity == R ? "r-list" : "unknown-list";
}

/// Returns class name of a rarity for the name in the list.
function listRarityNameClass(rarity) {
  return rarity == SSR ? "ssr-name" : rarity == SR ? "sr-name" : rarity == R ? "r-name" : "unknown-name";
}

/// Updates button state for the rarity switch.
function updateButtonState(rarity, prefix) {
  const ON_CLASS = `toggle-${rarity}-on`;
  const OFF_CLASS = `toggle-${rarity}-off`;
  const button = getElement(`${prefix}-${rarity}`);

  if (button.classList.contains(ON_CLASS)) {
    button.classList.remove(ON_CLASS);
    button.classList.add(OFF_CLASS);
  } else if (button.classList.contains(OFF_CLASS)) {
    button.classList.remove(OFF_CLASS);
    button.classList.add(ON_CLASS);
  }
}

/// Returns button state for the rarity switch.
function getRarityState(rarity, prefix) {
  const ON_CLASS = `toggle-${rarity}-on`;
  const button = getElement(`${prefix}-${rarity}`);
  return button.classList.contains(ON_CLASS);
}

/// Applies rarity switch for the image list.
function imageListRarityApply() {
  const ssrVisible = getRarityState("ssr", "image");
  const srVisible = getRarityState("sr", "image");
  const rVisible = false; //getRarityState("r", "image");

  const ssrClass = "item-ssr";
  const srClass = "item-sr";
  const rClass = "item-r";
  const div = getElement("image-div");
  let node = div.firstElementChild;
  while (node) {
    if (node.classList.contains(ssrClass)) {
      showNode(node, ssrVisible);
    } else if (node.classList.contains(srClass)) {
      showNode(node, srVisible);
    } else if (node.classList.contains(rClass)) {
      showNode(node, rVisible);
    }
    node = node.nextElementSibling;
  }
}

/// Switches rarity visibility for the image list.
function imageListSwitch(rarity) {
  updateButtonState(rarity, "image");
  imageListRarityApply();
}

/// Applies rarity switch for the list.
function listRarityApply() {
  const ssrVisible = getRarityState("ssr", "list");
  const srVisible = getRarityState("sr", "list");
  const rVisible = getRarityState("r", "list");

  const ssrClass = "ssr-list";
  const srClass = "sr-list";
  const rClass = "r-list";
  const table = getElement("list-table");
  const heading = table.firstElementChild;
  let n = 0;
  let node = heading.nextElementSibling;
  while (node) {
    if (node.classList.contains(ssrClass)) {
      showNode(node, ssrVisible);
      if (ssrVisible) {
        n += 1;
      }
    } else if (node.classList.contains(srClass)) {
      showNode(node, srVisible);
      if (srVisible) {
        n += 1;
      }
    } else if (node.classList.contains(rClass)) {
      showNode(node, rVisible);
      if (rVisible) {
        n += 1;
      }
    } else {
      showNode(node, true);
      n += 1;
    }

    node.classList.remove("list-light");
    node.classList.remove("list-dark");
    node.classList.add(n % 2 == 1 ? "list-light" : "list-dark");
    node = node.nextElementSibling;
  }
}

/// Switches rarity visibility for the list.
function listSwitch(rarity) {
  updateButtonState(rarity, "list");
  listRarityApply();
}

/// Switches category.
function switchCategory(categoryName) {
  for (const element of document.getElementsByClassName("category")) {
    if (element.id == categoryName) {
      element.classList.add("category-selected");
    } else {
      element.classList.remove("category-selected");
    }
  }
}

/// Fetches gacha data from the server.
/// type_id: 1: 常駐訪問, 3: 限定訪問, 4: 軍備拡張
/// 5: スタートダッシュ訪問, 8: ミステリーボックス
class Fetcher {
  constructor(uid, token, type_id, entries, lastTime) {
    this.uid = uid;
    this.token = token;
    this.type_id = type_id;
    this.next_id = null;
    this.target = API_ADDR;
    this.entries = entries;
    this.lastTime = lastTime;
  }

  /// Fetches sequentially.
  async fetch() {
    if (!await this.fetchNext()) {
      return;
    }
    while (true) {
      if (this.next_id) {
        if (!await this.fetchNext()) {
          return;
        }
      } else {
        break;
      }
    }
  }

  /// Fetches next entries.
  /// Fetch more if `true` returned.
  async fetchNext() {
    const limit = 20;
    let data = `type_id=${this.type_id}&u=${this.uid}&limit=${limit}`;
    if (this.next_id !== null && this.next_id != "") {
      data += `&next=${this.next_id}`;
    }
    const headers = new Headers({
      "Authorization": this.token,
      "Accept": "application/json, text/plain, */*",
      "Content-Type": "application/x-www-form-urlencoded",
    });
    const options = {
      method: "POST",
      headers: headers,
      body: data,
    };
    const req = new Request(this.target, options);
    const response = await window.fetch(req);
    if (!response.ok) {
      console.log("no response");
      return false;
    } else {
      const blob = await response.blob();
      const s = await blob.text();
      return await this.parseResult(s);
    }
  }

  /// Parses response result from the server.
  /// Fetch more if `true` returned.
  async parseResult(s) {
    const data = JSON.parse(s);
    if (data.code != 0 && data.message != "OK") {
      // uid or token is wrong
      setText("error", "uid または token が違います");
      showElement("error", true);
      showElement("setup", true);
      return;
    }
    this.next_id = data.data.next;

    // data.list entries: {pool_id, item, time}
    for (let entry of data.data.list) {
      this.entries.push(entry);
    }
    if (this.entries.length > 0) {
      return this.entries[this.entries.length - 1].time > this.lastTime;
    } else {
      return false;
    }
  }
}

/// Manages user specific data.
class UserDataManager {
  constuctor() {
  }

  /// Returns key name for the user data.
  getDataKey() {
    return "user-data";
  }

  /// Returns `true` if user data is stored in the storage.
  hasData() {
    return localStorage.getItem(this.getDataKey()) !== null;
  }

  /// Reads user data from the storage.
  read() {
    const s = localStorage.getItem(this.getDataKey());
    return JSON.parse(s);
  }

  /// Stores user data into the storage.
  store = (uid, token) => {
    const data = { uid: uid, token: token };
    localStorage.setItem(this.getDataKey(), JSON.stringify(data));
  }
}

/// Reads user data from player data.
function readUserDataFromPlayerData() {
  const s = getValue("player-data");
  try {
    const data = JSON.parse(s);
    readUserData(data.uid, data.token);
  } catch (e) {
    console.log(e);
  }
}

/// Reads from set of uid and token.
function readFromDataSet() {
  const uid = getValue("uid");
  const token = getValue("token");
  readUserData(uid, token);
}

/// Stores user data.
function readUserData(uid, token) {
  const m = new UserDataManager();
  m.store(uid, token);

  showElement("setup", false);
  showElement("error", false);
}

/// Fetches data from the server and let user download it.
async function fetchHistoryAndDownload(categories, prefix) {
  const userData = new UserDataManager().read();

  const history = {};
  for (const category of categories) {
    const entries = [];
    const f = new Fetcher(userData.uid, userData.token, category, entries, 0);
    await f.fetch();
    history[category] = entries;
  }
  const date = new Date();
  const name = `${prefix}-${fileDate(date)}.gz`;
  await downloadData(history, name);
}

/// Download all histories.
async function downloadAllHistory(categories, prefix) {
  const data = {};

  for (const category of categories) {
    await historyManager.readCategoryData(category);
    await loadDataFromServer(category);
    const histories = await historyManager.readCategoryData(category);
    const fetched = fetchedEntry[category];
    if (histories.length > 0) {
      fetched.findDuplicated(histories[0]);
    }
    await historyManager.appendCategoryHistory(category, fetched);
    const merger = new HistoryMerger();
    for (const history of histories) {
        merger.merge(history);
    }
    merger.merge(fetched);
    merger.done();
    data[category] = merger.data;
  }

  const date = new Date();
  const name = `${prefix}-${fileDate(date)}.gz`;
  await downloadData(data, name);
}

/// Let user download some data with its file name.
async function downloadData(data, name) {
  const ab = await compressData(data);
  const blob = new Blob([ab], {type: "application/gzip"});
  startDownload(blob, "download-link", name);
}

/// Merges history entries in a single list.
class HistoryMerger {
  constructor() {
    this.data = [];
  }

  merge(history) {
    const data = this.data;
    const entries = history.data;
    for (let i = history.endIndex; i >= history.startIndex; i--) {
      data.push(entries[i]);
    }
  }

  done() {
    this.data.reverse();
  }
}

/// Upload file executed by the file change event.
/// Reloads page after upload finished.
async function historyUpload() {
  const element = getElement("history-file");
  if (element.files.length == 1) {
    const f = element.files[0];
    if (f.name.endsWith(".json")) {
      const s = await f.text();
      const data = JSON.parse(s);
      historyManager.addNewUploaded(data);
      location.reload();
    } else {
      const data = await decompressData(f);
      if (data) {
        historyManager.addNewUploaded(data);
        location.reload();
      }
    }
  }
}

/// History entry for uploaded history.
class UploadedHistory {
  constructor(name, data) {
    this.data = data;
    this.name = name;
    this.timeList = {};
    this.start = 9744761443;
    this.end = 0;
    this.parseTime();
  }

  /// Returns number of entries in this history.
  count() {
    let n = 0;
    for (const category of CATEGORIES) {
      const a = this.data[category];
      if (a) {
        n += a.length;
      }
    }
    return ;
  }

  /// Updates time data from all categories.
  parseTime() {
    for (const category of CATEGORIES) {
      const a = this.data[category];
      if (a) {
        if (a.length > 0) {
          this.timeList[category] = [a[0].time, a[a.length - 1].time];
        }
      }
    }
  }

  /// Returns first time and last time for this history.
  getTime() {
    let start = this.start;
    let end = this.end;
    for (const category of CATEGORIES) {
      const t = this.timeList[category];
      if (t) {
        start = t[0] < start ? t[0] : start;
        end = t[1] > end ? t[1] : end;
      }
    }
    this.start = start;
    this.end = end;
    return [start, end];
  }

  /// Merges two histories and returns combined new history.
  static merge(a, b) {
    // makes b newer
    let aa = a, bb = b;
    if (a.start > b.start) {
      aa = b;
      bb = a;
    }
    let data;
    const v = mergePoint(aa, bb);
    if (v !== null) {
      if (v.op == "top") {
        data = aa.concat(bb);
      } else if (v.op == "bottom") {
        data = bb.concat(aa);
      } else if (v.index !== undefined) {
        data = Array.from(aa);
        data = data.concat(bb);
      }
    } else {
      data = [];
    }
    return new UploadedHistory("", data);
  }
}

/// Loads history into the table.
async function loadHistory() {
  const data = [];
  await historyManager.loadAllUploaded(data);

  const table = getElement("history-table");
  clearChildren(table);
  const tc = new TableCreator(null, "", table);
  tc.addRow([]);
  tc.addCells([
    { text: "キー", classes: [] },
    { text: "最初", classes: [] },
    { text: "最後", classes: [] },
    { text: "", classes: [] }, // remove button
    { text: "", classes: [] }, // download button
  ]);

  for (const entry of data) {
    addHistoryRow(tc, entry);
  }
}

/// Adds history row.
function addHistoryRow(tc, entry) {
  const t = entry.getTime();
  const table = tc.table;
  const tr = tc.addRow([], `history-key-${entry.name}`);
  tc.addCells([
    { text: entry.name, classes: [] },
    { text: dateString(new Date(t[0] * 1000)), classes: [] },
    { text: dateString(new Date(t[1] * 1000)), classes: [] },
  ]);

  const removeTd = addElement(tr, "td");
  const removeButton = addButton(removeTd, "削除");
  removeButton.setAttribute("key", entry.name);
  removeButton.addEventListener("click", removeHistory);

  const downloadTd = addElement(tr, "td");
  const downloadButton = addButton(downloadTd, "ダウンロード");
  downloadButton.setAttribute("key", entry.name);
  downloadButton.addEventListener("click", downloadHistory);
}

/// Removes selected history.
async function removeHistory(ev) {
  const key = ev.target.getAttribute("key");
  historyManager.removeData(key);
  removeElement(`history-key-${key}`);
}

/// Downloads selected history.
async function downloadHistory(ev) {
  const key = ev.target.getAttribute("key");
  const history = await historyManager.getHistory(key);
  if (history) {
    const [start, end] = history.getTime();
    downloadData(history.data, `dfl2-${fileDate(new Date(start * 1000))}-${fileDate(new Date(end * 1000))}`);
  } else {
    console.log(`history not found: ${key}`);
  }
}

/// History entry.
class History {
  constructor(category, data, key) {
    this.category = category.toString();
    this.data = data;
    this.key = key;
    this.startTime = this.data.length > 0 ? this.data[this.data.length-1].time : 0;
    this.endTime = this.data.length > 0 ? this.data[0].time : 0;
    this.startIndex = this.data.length > 0 ? 0 : -1;
    this.endIndex = this.data.length > 0 ? this.data.length - 1 : -1;
  }

  /// Returns number of valid entries.
  count() {
    return this.endIndex - this.startIndex + 1;
  }

  /// Compare with another history by their time of first entry.
  cmp(another) {
    return this.startTime < another.startTime;
  }

  toString() {
    return `{History, ${this.data.length}, ${this.endTime}-${this.startTime}, ${this.key}}`;
  }

  /// Appends valid data into passed array.
  appendTo(target) {
    const data = this.data;
    for (let i = this.startIndex; i <= this.endIndex; i++) {
      target.push(data[i]);
    }
  }

  /// Tries to find duplicated entries between two histories.
  /// If duplication is found, start index of the another history is updated.
  /// this.[end - start] - another.[end - start]
  findDuplicated(another) {
    if (this.startTime <= another.endTime) {
      // update end index
      // find first matched position by the time
      const item = this.data[this.data.length - 1];
      const t = item.time;
      let pos = another.data.findLastIndex((element) => matchItem(element, item));
      if (pos == -1) {
        return; // somethings wrong
      }
      let index;
      while (true) {
        // compare to top
        let status = true;
        let ai = this.data.length - 1;
        let hi = pos;
        while (ai >= 0 && hi >= 0) {
          if (!matchItem(this.data[ai], another.data[hi])) {
            status = false;
            break; // restart from above
          }
          ai -= 1;
          hi -= 1;
        }
        if (hi <= 0 && status) {
          index = pos;
          break;
        } else {
          // todo, faster reposition
          pos -= 1;
          continue;
        }
      }
      another.startIndex = index + 1;
    }
  }
}

/// Checks equallity between two gacha entries.
function matchItem(a, b) {
  return a.pool_item == b.pool_item &&
    a.item == b.item && a.time == b.time;
}

/// Manages history.
/// hN: uploaded history
/// C-N: category cache, 500 records in each entries
class HistoryManager {
  constructor() {
    this.categories = {};
  }

  /// Compresses data for storing into the storage.
  async compressData(data) {
    const ab = await compressData(data);
    return bytesToBase64(new Uint8Array(ab));
  }

  /// Decompresses data from the storage.
  async decompressData(b64) {
    const bbs = base64ToBytes(b64);
    return await decompressData(new Blob([bbs]));
  }

  /// Reads all data for the category.
  async readCategoryData(category) {
    if (this.categories[category] !== undefined) {
      return this.categories[category];
    }

    const prefix = `${category}-`;
    const a = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(prefix)) {
        const b64 = localStorage.getItem(key);
        if (b64 != null) {
          const data = await this.decompressData(b64);
          a.push(new History(category, data, key));
        }
      }
    }
    // sort in [new-old] - [new-old]
    a.sort((a, b) => { return a.cmp(b); });

    for (let i = 0; i < a.length; i++) {
      if (a.length > i + 1) {
        const a1 = a[i];
        const a2 = a[i + 1];
        a1.findDuplicated(a2);
      }
    }
    this.categories[category] = a;
    return a;
  }

  /// Returns most recent time from the history items for the category.
  async mostRecentTime(category) {
    const data = await this.readCategoryData(category);
    if (data.length > 0) {
      return data[0].endTime;
    } else {
      return 0;
    }
  }

  /// Returns history for the key.
  async getHistory(key) {
    const data = await this.getItem(key);
    return new UploadedHistory(key, data);
  }

  /// Loads all uploaded data.
  async loadAllUploaded(a) {
    const re = /h\d+/i;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (re.test(key)) {
        const b64 = localStorage.getItem(key);
        const data = await this.decompressData(b64);
        a.push(new UploadedHistory(key, data));
      }
    }
  }

  /// Adds uploaded data.
  async addNewUploaded(data) {
    const key = this.findNextKey();
    if (key != null) {
      this.setItem(key, data);

      for (const category of CATEGORIES) {
        const entries = data[category];
        if (entries) {
          await this.addNewCategoryData(category, entries);
        }
      }
      return new UploadedHistory(key, data);
    }
  }

  /// Appends history data to the last data for the category.
  async appendCategoryHistory(category, history) {
    const a = this.categories[category];
    if (a === undefined || a.length <= 0) {
      await this.addNewCategoryData(category, history.data);
    } else {
      const count = history.count();
      const lastHistory = a[0];
      // checks all history is already contained in the lastHistory
      if (count <= lastHistory.startIndex) {
        return;
      }
      if (lastHistory.data.length + count < 1000) {
        const key = lastHistory.key;
        const data = Array.from(history.data);
        lastHistory.appendTo(data);
        await this.setItem(key, data);
      } else {
        const slicedData = history.slice(history.startIndex, history.data.length - lastHistory.endIndex - 1);
        await this.addNewCategoryData(category, slicedData);
      }
    }
  }

  /// Adds new data for the category.
  async addNewCategoryData(category, data) {
    const key = this.findNextCategoryKey(category, 0);
    if (key != null) {
      this.setItem(key, data);
    }
  }

  /// Gets uncompressed data for the key.
  async getItem(key) {
    const b64 = localStorage.getItem(key);
    return await this.decompressData(b64);
  }

  /// Compresses the data and set it for the key.
  async setItem(key, data) {
    const b64 = await this.compressData(data);
    localStorage.setItem(key, b64);
  }

  /// Removes specified item.
  removeData(key) {
    localStorage.removeItem(key);
  }

  /// Tries to find last key for the category.
  findLastCategoryKey(category) {
    for (let i = 0; i < 10000; i++) {
      const key = this.getCategoryKey(category, i);
      if (localStorage.getItem(key) === null) {
        return this.getCategoryKey(category, i - 1);
      }
    }
    return this.getCategoryKey(category, 0);
  }

  /// Tries to find next key for category related key.
  findNextCategoryKey(category, current) {
    for (let i = current; i < 10000; i++) {
      const key = this.getCategoryKey(category, i);
      if (localStorage.getItem(key) === null) {
        return key;
      }
    }
    return null;
  }

  /// Returns cageory related key.
  getCategoryKey(category, i) {
    return `${category}-${i}`;
  }

  /// Tries to find next key for a uploaded history.
  findNextKey() {
    for (let i = 0; i < 10000; i++) {
      const key = this.getKey(i);
      if (localStorage.getItem(key) === null) {
        return key;
      }
    }
    return null;
  }

  /// Returns key for a uploaded history.
  getKey(i) {
    return `h${i}`;
  }
}

/// Compress data as JSON in gzip.
async function compressData(data) {
  const s = JSON.stringify(data);
  const stream = new Blob([s]).stream();
  const compressedStream = stream.pipeThrough(new CompressionStream("gzip"))
  return await new Response(compressedStream).arrayBuffer();
}

/// Decompress JSON data as gzip compressd into data.
async function decompressData(blob) {
  const readableStream = blob.stream();
  const decompressedStream = readableStream.pipeThrough(new DecompressionStream("gzip"));
  return await new Response(decompressedStream).json();
}

/// Converts from base64 to bytes.
function base64ToBytes(base64) {
  const binString = atob(base64);
  return Uint8Array.from(binString, (m) => m.codePointAt(0));
}

/// Converts from bytes to base64.
function bytesToBase64(bytes) {
  const binString = Array.from(bytes, (byte) =>
    String.fromCodePoint(byte),
  ).join("");
  return btoa(binString);
}

/// Starts download.
function startDownload(blob, id, name) {
  const url = URL.createObjectURL(blob);
  const a = getElement(id);
  a.href = url;
  a.download = name;
  a.click();
  window.URL.revokeObjectURL(url);
}

/// Returns date in 1970-08-12 12:05:10 format.
function dateString(date) {
  return `${date.getFullYear()}-${zeroFill(date.getMonth()+1)}-${zeroFill(date.getDate())} ` +
    `${zeroFill(date.getHours())}:${zeroFill(date.getMinutes())}:${zeroFill(date.getSeconds())}`;
}

/// Returns date in 1970-08-12120510 format
function fileDate(date) {
  return `${date.getFullYear()}-${zeroFill(date.getMonth()+1)}-${zeroFill(date.getDate())}` +
    `${zeroFill(date.getHours())}${zeroFill(date.getMinutes())}${zeroFill(date.getSeconds())}`;
}

/// Fills zero if nuber is single digit.
function zeroFill(v) {
  return v.toString().length == 1 ? "0" + v : v;
}

/// Rounds value in two precision.
function roundRatio(r) {
  return r.toPrecision(2);
}

/// Returns `true` if specified node does not have `hidden` class.
function isShownNode(node) {
  return !node.classList.contains('hidden');
}

/// Show or hide node by adding `hidden` class.
function showNode(node, visible) {
  if (visible || visible === undefined) {
    node.classList.remove('hidden');
  } else {
    node.classList.add('hidden');
  }
}

/// Returns `true` if a node specified by its id does not have `hidden` class.
function isShown(id) {
  return !getElement(id).classList.contains('hidden');
}

/// Show or hide node specified by its id.
function showElement(id, visible) {
  if (visible || visible === undefined) {
    getElement(id).classList.remove('hidden');
  } else {
    getElement(id).classList.add('hidden');
  }
}

/// Returns node specified by its id.
function getElement(id) {
  return document.getElementById(id);
}

/// Returns text content specified by its id.
function getText(id) {
  return document.getElementById(id).textContent;
}

/// Set text content to the node specified by its id.
function setText(id, s) {
  document.getElementById(id).textContent = s;
}

/// Returns node value specified by the id.
function getValue(id) {
  return document.getElementById(id).value;
}

/// Set event listener to the node specified by the id.
function addListener(id, ev, fn) {
  getElement(id).addEventListener(ev, fn);
}

/// Adds element to the specified parent.
function addElement(parent, tag, classes=null) {
  const child = document.createElement(tag);
  parent.appendChild(child);
  if (Array.isArray(classes)) {
    for (const c of classes) {
      child.classList.add(c);
    }
  }
  return child;
}

/// Removes specified node by its id.
function removeElement(id) {
  const node = getElement(id);
  if (node) {
    const parent = node.parentNode;
    parent.removeChild(node);
  }
}

function clearChildren(parent) {
  while (parent.lastElementChild) {
    parent.removeChild(parent.lastElementChild);
  }
}

/// Adds td element into the specified tr.
function addTd(tr, value, classes=null) {
  const td = addElement(tr, "td", classes);
  td.textContent = value;
  return td;
}

/// Adds button to the specified parent.
function addButton(parent, text) {
  const button = addElement(parent, "input");
  button.type = "button";
  button.value = text;
  return button;
}

/// Adds image to the specified parent.
function addImage(parent, id, src, width, height, title, alt) {
  const img = addElement(parent, "img");
  img.id = id;
  img.src = src;
  img.width = width;
  img.height = height;
  img.title = title;
  img.alt = alt;
  return img;
}

function addLink(parent, text, href, target=null) {
  const a = addElement(parent, "a");
  a.href = href;
  a.textContent = text;
  if (target) {
    a.target = target;
  }
  return a;
}

/// Helps to create table.
class TableCreator {
  constructor(parent, id, table=null) {
    this.parent = parent;
    this.table = table ? table : addElement(parent, "table");
    this.table.id = id;
    this.tr = null;
  }

  addRow(classes, id=null) {
    this.tr = addElement(this.table, 'tr', classes);
    if (id) {
      this.tr.id = id;
    }
    return this.tr;
  }

  addCell(cell) {
    if (!cell.skip) {
      return addTd(this.tr, cell.text, cell.classes);
    }
  }

  addCells(cells) {
    for (const cell of cells) {
      this.addCell(cell);
    }
  }
}
