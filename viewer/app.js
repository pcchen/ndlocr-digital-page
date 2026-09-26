const PAGE_CONFIGS = {
  "1218326-26": {
    pid: "1218326",
    frame: "26",
    title: "Tai-Japanese Dictionary",
    defaultOcr: "lite",
    ocrSources: {
      lite: {
        label: "NDLOCR-Lite · Full scan",
        imagePath: "../samples/1218326/images/1218326_R0000026.jpg",
        xmlPath: "../samples/1218326/ocr/1218326_R0000026.xml",
        exportName: "1218326_R0000026_lite_corrected.xml"
      },
      "cli-l": {
        label: "NDLOCR CLI · Left crop",
        imagePath: "../samples/1218326/ocr-cli/frame26/pred_img/input_L.jpg",
        xmlPath: "../samples/1218326/ocr-cli/frame26/xml/input.sorted.xml",
        pageImageName: "input_L.jpg",
        exportName: "1218326_R0000026_cli_left_corrected.xml"
      },
      "cli-r": {
        label: "NDLOCR CLI · Right crop",
        imagePath: "../samples/1218326/ocr-cli/frame26/pred_img/input_R.jpg",
        xmlPath: "../samples/1218326/ocr-cli/frame26/xml/input.sorted.xml",
        pageImageName: "input_R.jpg",
        exportName: "1218326_R0000026_cli_right_corrected.xml"
      }
    }
  },
  "1218326-11": {
    pid: "1218326",
    frame: "11",
    title: "Tai-Japanese Dictionary",
    defaultOcr: "lite",
    ocrSources: {
      lite: {
        label: "NDLOCR-Lite · Full scan",
        imagePath: "../samples/1218326/images/1218326_R0000011.jpg",
        xmlPath: "../samples/1218326/ocr/1218326_R0000011.xml",
        exportName: "1218326_R0000011_lite_corrected.xml"
      },
      "cli-l": {
        label: "NDLOCR CLI · Left crop",
        imagePath: "../samples/1218326/ocr-cli/frame11/pred_img/input_L.jpg",
        xmlPath: "../samples/1218326/ocr-cli/frame11/xml/input.sorted.xml",
        pageImageName: "input_L.jpg",
        exportName: "1218326_R0000011_cli_left_corrected.xml"
      },
      "cli-r": {
        label: "NDLOCR CLI · Right crop",
        imagePath: "../samples/1218326/ocr-cli/frame11/pred_img/input_R.jpg",
        xmlPath: "../samples/1218326/ocr-cli/frame11/xml/input.sorted.xml",
        pageImageName: "input_R.jpg",
        exportName: "1218326_R0000011_cli_right_corrected.xml"
      }
    }
  }
};

const initialState = new URLSearchParams(window.location.search);
const requestedPage = `${initialState.get("pid")}-${initialState.get("frame")}`;
const activePage = PAGE_CONFIGS[requestedPage] || PAGE_CONFIGS["1218326-26"];
const requestedOcr = initialState.get("ocr") || activePage.defaultOcr;
const activeOcrKey = activePage.ocrSources[requestedOcr] ? requestedOcr : activePage.defaultOcr;
const activeOcr = activePage.ocrSources[activeOcrKey];

const page = document.querySelector("#page");
const viewport = document.querySelector("#viewport");
const scan = document.querySelector("#scan");
const textLayer = document.querySelector("#text-layer");
const structureLayer = document.querySelector("#structure-layer");
const loading = document.querySelector("#loading");
const summary = document.querySelector("#summary");
const searchInput = document.querySelector("#search");
const threshold = document.querySelector("#threshold");
const thresholdValue = document.querySelector("#threshold-value");
const showRegions = document.querySelector("#show-regions");
const showOrder = document.querySelector("#show-order");
const lineEditor = document.querySelector("#line-editor");
const emptySelection = document.querySelector("#empty-selection");
const lineText = document.querySelector("#line-text");
const pageSelect = document.querySelector("#page-select");
const ocrSelect = document.querySelector("#ocr-select");
const comparisonView = document.querySelector("#comparison-view");
const comparisonList = document.querySelector("#comparison-list");
const comparisonStats = document.querySelector("#comparison-stats");
const comparisonCount = document.querySelector("#comparison-count");
const comparisonLoading = document.querySelector("#comparison-loading");
const inspectorTitle = document.querySelector("#inspector-title");

let xmlDocument;
let pageWidth = 3902;
let pageHeight = 2855;
let zoom = 1;
let selectedLine = null;
let lines = [];
let textLineCount = 0;
let rubyBlockCount = 0;
let rubyReadingCount = 0;
let comparisonRows = [];
let comparisonFilter = "all";
let comparisonPromise;

function numberAttribute(element, name, fallback = 0) {
  const value = Number(element.getAttribute(name));
  return Number.isFinite(value) ? value : fallback;
}

function classifyType(type) {
  if (type === "本文") return "type-main";
  if (type === "ルビ") return "type-ruby";
  if (type === "割注" || type === "頭注" || type === "キャプション") return "type-note";
  return "type-other";
}

function typeLabel(type) {
  const labels = {
    "本文": "Body text",
    "割注": "Interlinear note",
    "頭注": "Headnote",
    "キャプション": "Caption",
    "広告文字": "Advertisement",
    "ルビ": "Ruby"
  };
  return labels[type] || type || "Text";
}

function percentage(value, total) {
  return `${(value / total) * 100}%`;
}

function makeLine(element) {
  const x = numberAttribute(element, "X");
  const y = numberAttribute(element, "Y");
  const width = numberAttribute(element, "WIDTH");
  const height = numberAttribute(element, "HEIGHT");
  const confidence = numberAttribute(element, "CONF");
  const hasOrder = element.hasAttribute("ORDER");
  const order = numberAttribute(element, "ORDER", 999999);
  const type = element.getAttribute("TYPE") || "";
  const value = element.getAttribute("STRING") || "";
  const vertical = height > width;

  const node = document.createElement("div");
  node.className = `ocr-line ${vertical ? "vertical" : "horizontal"} ${classifyType(type)}`;
  node.style.left = percentage(x, pageWidth);
  node.style.top = percentage(y, pageHeight);
  node.style.width = percentage(width, pageWidth);
  node.style.height = percentage(height, pageHeight);
  node.dataset.confidence = confidence;
  node.dataset.order = order;
  node.dataset.search = value.toLocaleLowerCase();
  node.setAttribute("role", "button");
  node.setAttribute("tabindex", "0");
  const orderLabel = hasOrder ? `, order ${order}` : "";
  const valueLabel = value || "No recognized text";
  node.setAttribute("aria-label", `${typeLabel(type)}${orderLabel}: ${valueLabel}`);

  const string = document.createElement("span");
  string.className = "line-string";
  string.textContent = value;
  node.append(string);

  const badge = document.createElement("span");
  badge.className = "order-badge";
  if (hasOrder) {
    badge.textContent = order;
    node.append(badge);
  }

  const line = { element, node, string, x, y, width, height, confidence, order, hasOrder, type, vertical };
  node.addEventListener("click", () => selectLine(line));
  node.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectLine(line);
    }
  });
  return line;
}

function selectLine(line) {
  selectedLine?.node.classList.remove("is-selected");
  selectedLine = line;
  selectedLine.node.classList.add("is-selected");
  emptySelection.hidden = true;
  lineEditor.hidden = false;
  document.querySelector("#selection-type").textContent = typeLabel(line.type);
  document.querySelector("#selection-confidence").textContent = `${line.confidence.toFixed(3)} confidence`;
  document.querySelector("#selection-order").textContent = line.hasOrder ? line.order : "Not assigned";
  document.querySelector("#selection-direction").textContent = line.vertical ? "Vertical" : "Horizontal";
  document.querySelector("#selection-bounds").textContent = `${line.x}, ${line.y}, ${line.width} × ${line.height}`;
  lineText.value = line.element.getAttribute("STRING") || "";
}

function renderStructure(root) {
  structureLayer.setAttribute("viewBox", `0 0 ${pageWidth} ${pageHeight}`);
  structureLayer.replaceChildren();

  root.querySelectorAll("TEXTBLOCK SHAPE POLYGON").forEach(element => {
    const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    polygon.setAttribute("points", (element.getAttribute("POINTS") || "").replaceAll(",", " "));
    structureLayer.append(polygon);
  });

  root.querySelectorAll("BLOCK").forEach(element => {
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", element.getAttribute("X") || 0);
    rect.setAttribute("y", element.getAttribute("Y") || 0);
    rect.setAttribute("width", element.getAttribute("WIDTH") || 0);
    rect.setAttribute("height", element.getAttribute("HEIGHT") || 0);
    rect.dataset.type = element.getAttribute("TYPE") || "";
    structureLayer.append(rect);
  });
}

function updateFontSizes() {
  const scale = page.getBoundingClientRect().width / pageWidth;
  lines.forEach(line => {
    const sourceSize = line.vertical ? line.width * 0.72 : line.height * 0.72;
    line.node.style.fontSize = `${Math.max(5, sourceSize * scale)}px`;
  });
}

function updateVisibility() {
  const minimum = Number(threshold.value);
  const query = searchInput.value.trim().toLocaleLowerCase();
  let visible = 0;
  let matches = 0;

  lines.forEach(line => {
    const below = line.confidence < minimum;
    const match = query.length > 0 && line.node.dataset.search.includes(query);
    line.node.classList.toggle("below-threshold", below);
    line.node.classList.toggle("is-match", match && !below);
    if (!below) visible += 1;
    if (match && !below) matches += 1;
  });

  const matchText = query ? ` · ${matches} matches` : "";
  summary.textContent = `${visible}/${lines.length} regions · ${textLineCount} lines · ${rubyBlockCount} ruby regions · ${rubyReadingCount} readings${matchText}`;
  if (comparisonRows.length > 0) renderComparison();
}

function applyZoom(nextZoom) {
  zoom = Math.min(2.5, Math.max(0.5, nextZoom));
  const gutter = window.matchMedia("(max-width: 920px)").matches ? 28 : 56;
  const availableWidth = Math.max(180, viewport.clientWidth - gutter);
  const availableHeight = Math.max(280, viewport.clientHeight - gutter);
  const widthForHeight = Math.max(180, availableHeight * (pageWidth / pageHeight));
  const baseWidth = Math.min(1200, availableWidth, widthForHeight);
  page.style.width = `${Math.round(baseWidth * zoom)}px`;
  document.querySelector("#zoom-label").textContent = `${Math.round(zoom * 100)}%`;
  requestAnimationFrame(updateFontSizes);
}

function setMode(mode) {
  const comparing = mode === "compare";
  page.hidden = comparing;
  comparisonView.hidden = !comparing;
  document.body.classList.toggle("comparison-mode", comparing);
  inspectorTitle.textContent = comparing ? "Comparison review" : "OCR Inspector";
  const modeUrl = new URL(window.location.href);
  if (mode === "facsimile") modeUrl.searchParams.delete("view");
  else modeUrl.searchParams.set("view", mode);
  window.history.replaceState({}, "", modeUrl);
  page.classList.remove("mode-facsimile", "mode-overlay", "mode-text");
  if (!comparing) page.classList.add(`mode-${mode}`);
  document.querySelectorAll("[data-mode]").forEach(button => {
    button.classList.toggle("is-active", button.dataset.mode === mode);
  });
  if (comparing) loadComparison();
  else requestAnimationFrame(() => applyZoom(zoom));
}

async function fetchXmlDocument(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`XML request failed: ${response.status}`);
  const source = await response.text();
  const document = new DOMParser().parseFromString(source, "application/xml");
  if (document.querySelector("parsererror")) throw new Error("The OCR XML could not be parsed.");
  return document;
}

function orderedStrings(pageElement) {
  return [...pageElement.querySelectorAll("LINE")]
    .sort((left, right) => numberAttribute(left, "ORDER", 999999) - numberAttribute(right, "ORDER", 999999))
    .map(element => element.getAttribute("STRING") || "")
    .filter(value => OcrCompare.normalizeText(value).length > 0);
}

function makeDiffText(operations, side) {
  const paragraph = document.createElement("p");
  paragraph.className = "comparison-text";
  const visibleTypes = side === "left" ? ["equal", "delete"] : ["equal", "insert"];
  const changedType = side === "left" ? "delete" : "insert";

  operations.filter(operation => visibleTypes.includes(operation.type)).forEach(operation => {
    if (operation.type === changedType) {
      const mark = document.createElement("mark");
      mark.textContent = operation.value;
      paragraph.append(mark);
    } else {
      paragraph.append(document.createTextNode(operation.value));
    }
  });
  return paragraph;
}

function makeComparisonSource(label, text, operations, side) {
  const source = document.createElement("section");
  source.className = "comparison-source";
  const heading = document.createElement("h3");
  heading.textContent = label;
  source.append(heading);
  if (text.length === 0) {
    const paragraph = document.createElement("p");
    paragraph.className = "comparison-text";
    const missing = document.createElement("span");
    missing.className = "missing-text";
    missing.textContent = "No corresponding line";
    paragraph.append(missing);
    source.append(paragraph);
  } else {
    source.append(makeDiffText(operations, side));
  }
  return source;
}

function renderComparison() {
  const query = searchInput.value.trim().toLocaleLowerCase();
  const filtered = comparisonRows.filter(row => {
    if (comparisonFilter === "review" && row.status === "exact") return false;
    if (!query) return true;
    return `${row.left.join(" ")} ${row.right.join(" ")}`.toLocaleLowerCase().includes(query);
  });

  const labels = { exact: "Exact", close: "Review · close", conflict: "Review", missing: "Review" };
  comparisonList.replaceChildren(...filtered.map((row, index) => {
    const leftText = row.left.join("\n");
    const rightText = row.right.join("\n");
    const operations = OcrCompare.diffChars(leftText, rightText);
    const item = document.createElement("article");
    item.className = `comparison-row status-${row.status}`;

    const status = document.createElement("div");
    status.className = "comparison-status";
    const statusLabel = document.createElement("strong");
    statusLabel.textContent = labels[row.status];
    const score = document.createElement("span");
    score.textContent = row.status === "missing" ? "One source only" : `${Math.round(row.similarity * 100)}% similar`;
    status.append(statusLabel, score);

    item.append(
      status,
      makeComparisonSource("NDLOCR-Lite", leftText, operations, "left"),
      makeComparisonSource("NDLOCR CLI", rightText, operations, "right")
    );
    item.dataset.row = index;
    return item;
  }));
  comparisonCount.textContent = `${filtered.length} of ${comparisonRows.length} comparisons`;
}

function renderComparisonStats() {
  const counts = { exact: 0, close: 0, conflict: 0, missing: 0 };
  comparisonRows.forEach(row => { counts[row.status] += 1; });
  const definitions = [
    [counts.exact, "Exact"],
    [counts.close, "Close review"],
    [counts.conflict, "Conflict"],
    [counts.missing, "Missing"]
  ];
  comparisonStats.replaceChildren(...definitions.map(([count, label]) => {
    const item = document.createElement("div");
    item.className = "comparison-stat";
    const value = document.createElement("strong");
    value.textContent = count;
    const name = document.createElement("span");
    name.textContent = label;
    item.append(value, name);
    return item;
  }));
}

async function loadComparison() {
  if (comparisonPromise) return comparisonPromise;
  comparisonPromise = (async () => {
    try {
      const liteSource = activePage.ocrSources.lite;
      const cliSource = activePage.ocrSources["cli-r"] || activePage.ocrSources["cli-l"];
      if (!liteSource || !cliSource) throw new Error("Both Lite and CLI results are required for comparison.");
      const [liteDocument, cliDocument] = await Promise.all([
        fetchXmlDocument(liteSource.xmlPath),
        fetchXmlDocument(cliSource.xmlPath)
      ]);
      const litePage = liteDocument.querySelector("PAGE");
      const cliPageNames = ["cli-r", "cli-l"]
        .map(key => activePage.ocrSources[key]?.pageImageName)
        .filter(Boolean);
      const cliPages = cliPageNames
        .map(name => [...cliDocument.querySelectorAll("PAGE")].find(element => element.getAttribute("IMAGENAME") === name))
        .filter(Boolean);
      comparisonRows = OcrCompare.alignLines(
        orderedStrings(litePage),
        cliPages.flatMap(orderedStrings)
      );
      renderComparisonStats();
      renderComparison();
      comparisonLoading.hidden = true;
    } catch (error) {
      comparisonLoading.textContent = error.message;
      comparisonLoading.classList.add("is-error");
    }
  })();
  return comparisonPromise;
}

function exportComparison() {
  const escapeCell = value => `"${String(value).replaceAll('"', '""')}"`;
  const rows = [
    ["review", "status", "similarity", "ndlocr_lite", "ndlocr_cli"],
    ...comparisonRows.map(row => [
      row.status === "exact" ? "no" : "yes",
      row.status,
      row.similarity.toFixed(4),
      row.left.join("\n"),
      row.right.join("\n")
    ])
  ];
  const csv = rows.map(row => row.map(escapeCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${activePage.pid}_frame${activePage.frame}_lite_cli_comparison.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function exportXml() {
  const serialized = new XMLSerializer().serializeToString(xmlDocument);
  const blob = new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${serialized}`], { type: "application/xml" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = activeOcr.exportName;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function loadXml() {
  try {
    document.querySelector("#document-name").textContent = activePage.title;
    document.querySelector("#frame-name").textContent = `Frame ${activePage.frame}`;
    pageSelect.value = `${activePage.pid}-${activePage.frame}`;
    ocrSelect.replaceChildren(...Object.entries(activePage.ocrSources).map(([value, source]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = source.label;
      return option;
    }));
    ocrSelect.value = activeOcrKey;
    scan.src = activeOcr.imagePath;
    scan.alt = `${activeOcr.label} page from ${activePage.title}`;

    const response = await fetch(activeOcr.xmlPath);
    if (!response.ok) throw new Error(`XML request failed: ${response.status}`);
    const source = await response.text();
    xmlDocument = new DOMParser().parseFromString(source, "application/xml");
    if (xmlDocument.querySelector("parsererror")) throw new Error("The OCR XML could not be parsed.");

    const pageElements = [...xmlDocument.querySelectorAll("PAGE")];
    const pageElement = activeOcr.pageImageName
      ? pageElements.find(element => element.getAttribute("IMAGENAME") === activeOcr.pageImageName)
      : pageElements[0];
    if (!pageElement) throw new Error("The selected page was not found in the OCR XML.");
    pageWidth = numberAttribute(pageElement, "WIDTH", pageWidth);
    pageHeight = numberAttribute(pageElement, "HEIGHT", pageHeight);
    page.style.aspectRatio = `${pageWidth} / ${pageHeight}`;

    const textElements = [...pageElement.querySelectorAll("LINE")];
    const rubyElements = [...pageElement.querySelectorAll('BLOCK[TYPE="ルビ"]')];
    textLineCount = textElements.length;
    rubyBlockCount = rubyElements.length;
    rubyReadingCount = rubyElements.filter(element => (element.getAttribute("STRING") || "").length > 0).length;
    lines = [...textElements.map(makeLine).sort((a, b) => a.order - b.order), ...rubyElements.map(makeLine)];
    textLayer.replaceChildren(...lines.map(line => line.node));
    renderStructure(pageElement);
    updateVisibility();
    applyZoom(1);
    loading.hidden = true;
  } catch (error) {
    loading.textContent = error.message;
    loading.classList.add("is-error");
  }
}

document.querySelectorAll("[data-mode]").forEach(button => {
  button.addEventListener("click", () => setMode(button.dataset.mode));
});

showRegions.addEventListener("change", () => page.classList.toggle("show-regions", showRegions.checked));
showOrder.addEventListener("change", () => page.classList.toggle("show-order", showOrder.checked));
searchInput.addEventListener("input", updateVisibility);
threshold.addEventListener("input", () => {
  thresholdValue.value = Number(threshold.value).toFixed(2);
  updateVisibility();
});
lineText.addEventListener("input", () => {
  if (!selectedLine) return;
  selectedLine.element.setAttribute("STRING", lineText.value);
  selectedLine.string.textContent = lineText.value;
  selectedLine.node.dataset.search = lineText.value.toLocaleLowerCase();
  updateVisibility();
});
document.querySelector("#zoom-out").addEventListener("click", () => applyZoom(zoom - 0.25));
document.querySelector("#zoom-reset").addEventListener("click", () => applyZoom(1));
document.querySelector("#zoom-in").addEventListener("click", () => applyZoom(zoom + 0.25));
document.querySelector("#export-xml").addEventListener("click", exportXml);
document.querySelector("#export-comparison").addEventListener("click", exportComparison);
document.querySelectorAll("[data-comparison-filter]").forEach(button => {
  button.addEventListener("click", () => {
    comparisonFilter = button.dataset.comparisonFilter;
    document.querySelectorAll("[data-comparison-filter]").forEach(candidate => {
      candidate.classList.toggle("is-active", candidate === button);
    });
    renderComparison();
  });
});
pageSelect.addEventListener("change", () => {
  const [pid, frame] = pageSelect.value.split("-");
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set("pid", pid);
  nextUrl.searchParams.set("frame", frame);
  window.location.assign(nextUrl);
});
ocrSelect.addEventListener("change", () => {
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set("ocr", ocrSelect.value);
  window.location.assign(nextUrl);
});

new ResizeObserver(() => updateFontSizes()).observe(page);
window.addEventListener("resize", () => applyZoom(zoom));

const initialMode = initialState.get("view");
if (["facsimile", "overlay", "text", "compare"].includes(initialMode)) setMode(initialMode);
if (initialState.get("regions") === "1") {
  showRegions.checked = true;
  page.classList.add("show-regions");
}
if (initialState.get("order") === "1") {
  showOrder.checked = true;
  page.classList.add("show-order");
}

loadXml();
